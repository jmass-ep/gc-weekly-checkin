import { unstable_cache } from 'next/cache'
import Anthropic from '@anthropic-ai/sdk'

const PROJECT_ID = '2874875'
const BASE_URL = 'https://eu.mixpanel.com/api/query/segmentation'
const FUNNEL_URL = 'https://eu.mixpanel.com/api/query/funnels'
const ONBOARDING_FUNNEL_ID = '87658067'
const CONVERSION_FUNNEL_ID = '53623257'

const PREMIUM_BREAKDOWN_ON = 'user["ep_premium_access"]'
const PREMIUM_USER_FILTER   = 'user["ep_premium_access"] == true'

const FEATURE_EVENTS = [
  { name: 'Video Upload',     event: 'Video Uploaded',  color: '#1D9E75' },
  { name: 'Create Watchlist', event: 'Create Watchlist', color: '#3266ad' },
  { name: 'Message Sent',     event: 'Message sent',     color: '#BA7517' },
  { name: 'Visited My Feed',  event: 'Visited My Feed',  color: '#7F77DD' },
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface FunnelResult {
  series: string[]
  stepCounts: number[][]
}

interface SegResult {
  series: string[]
  values: number[]
}

interface BreakdownResult {
  series: string[]
  breakdown: Record<string, number[]>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

// Mixpanel allows max 5 concurrent queries per service account.
// Run all tasks through a pool to avoid hitting that limit.
async function runConcurrent<T>(tasks: (() => Promise<T>)[], limit = 4): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let next = 0
  async function worker() {
    while (next < tasks.length) {
      const i = next++
      results[i] = await tasks[i]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
  return results
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

function formatWeekLabel(dateStr: string): string {
  const [y, m, day] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function calcGrowth(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

// Detect a partial week: latest value is less than 30% of the prior rolling average
function isPartialWeek(values: number[]): boolean {
  const n = values.length
  if (n < 3) return false
  const latest = values[n - 1]
  const prior = values.slice(Math.max(0, n - 8), n - 1)
  const avg = prior.reduce((a, b) => a + b, 0) / prior.length
  return avg > 0 && latest < avg * 0.3
}

// ─── Mixpanel queries ─────────────────────────────────────────────────────────

async function queryMixpanel(
  auth: string,
  event: string,
  fromDate: string,
  toDate: string,
  type: 'general' | 'unique' = 'general',
  where?: string,
  attempt = 0
): Promise<SegResult> {
  const params = new URLSearchParams({
    project_id: PROJECT_ID,
    event,
    from_date: fromDate,
    to_date: toDate,
    unit: 'week',
    type,
  })
  if (where) params.append('where', where)

  const res = await fetch(`${BASE_URL}?${params}`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: 'no-store',
  })

  if (res.status === 429 && attempt < 2) {
    await sleep(3000 * (attempt + 1))
    return queryMixpanel(auth, event, fromDate, toDate, type, where, attempt + 1)
  }
  if (!res.ok) throw new Error(`Mixpanel "${event}" → HTTP ${res.status}`)

  const json = await res.json()
  const series: string[] = json.data?.series ?? []
  const rawValues = json.data?.values ?? {}
  const eventValues: Record<string, number> =
    (Object.values(rawValues)[0] as Record<string, number>) ?? {}
  const values = series.map((date) => eventValues[date] ?? 0)
  return { series, values }
}

async function queryMixpanelBreakdown(
  auth: string,
  event: string,
  fromDate: string,
  toDate: string,
  on: string,
  attempt = 0
): Promise<BreakdownResult> {
  const params = new URLSearchParams({
    project_id: PROJECT_ID,
    event,
    from_date: fromDate,
    to_date: toDate,
    unit: 'week',
    type: 'unique',
    on,
  })

  const res = await fetch(`${BASE_URL}?${params}`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: 'no-store',
  })

  if (res.status === 429 && attempt < 2) {
    await sleep(3000 * (attempt + 1))
    return queryMixpanelBreakdown(auth, event, fromDate, toDate, on, attempt + 1)
  }
  if (!res.ok) throw new Error(`Mixpanel breakdown "${event}" → HTTP ${res.status}`)

  const json = await res.json()
  const series: string[] = json.data?.series ?? []
  const rawValues: Record<string, Record<string, number>> = json.data?.values ?? {}

  const breakdown: Record<string, number[]> = {}
  for (const [key, dateValues] of Object.entries(rawValues)) {
    breakdown[key] = series.map((date) => dateValues[date] ?? 0)
  }
  return { series, breakdown }
}

async function queryFunnel(
  auth: string,
  funnelId: string,
  fromDate: string,
  toDate: string,
  attempt = 0,
): Promise<FunnelResult> {
  const params = new URLSearchParams({
    project_id: PROJECT_ID,
    funnel_id: funnelId,
    from_date: fromDate,
    to_date: toDate,
    unit: 'week',
    length: '7',
    length_unit: 'day',
  })

  const res = await fetch(`${FUNNEL_URL}?${params}`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: 'no-store',
  })

  if (res.status === 429 && attempt < 2) {
    await sleep(3000 * (attempt + 1))
    return queryFunnel(auth, funnelId, fromDate, toDate, attempt + 1)
  }
  if (!res.ok) throw new Error(`Funnel → HTTP ${res.status}`)

  const json = await res.json()
  const series: string[] = json.meta?.dates ?? []
  const stepCounts: number[][] = series.map((date) => {
    const steps: { count?: number }[] = json.data?.[date]?.steps ?? []
    return steps.map((s) => s.count ?? 0)
  })
  return { series, stepCounts }
}

function safeQuery(
  auth: string,
  event: string,
  fromDate: string,
  toDate: string,
  type: 'general' | 'unique' = 'general',
  where?: string
): Promise<SegResult> {
  return queryMixpanel(auth, event, fromDate, toDate, type, where).catch((err) => {
    const msg = err instanceof Error ? err.message : String(err)
    // Don't swallow rate-limit errors — let them propagate so unstable_cache
    // doesn't store a zeros result for 6 hours.
    if (msg.includes('429')) throw err
    console.error(`safeQuery failed for "${event}":`, err)
    return { series: [], values: [] }
  })
}

// ─── Metric builders ──────────────────────────────────────────────────────────

// Returns the last value in a SegResult (the most recent week's count).
function lastVal(r: SegResult): number {
  return r.values.length > 0 ? r.values[r.values.length - 1] : 0
}

function buildSimpleMetric(name: string, data: SegResult, yoyValue: number | null = null, yoyData: SegResult | null = null) {
  const { series, values } = data
  const n = values.length
  const thisWeek = n > 0 ? values[n - 1] : 0
  const previousWeek = n > 1 ? values[n - 2] : 0
  const yoyPct = yoyValue !== null ? calcGrowth(thisWeek, yoyValue) : null
  const yoyVals = yoyData?.values ?? []
  return {
    name,
    thisWeek,
    previousWeek,
    growthPct: calcGrowth(thisWeek, previousWeek),
    yoyPct,
    split: null,
    history: series.map((date, i) => ({
      week: formatWeekLabel(date),
      value: values[i],
      lastYear: yoyVals.length > 0 ? (yoyVals[i] ?? null) : null,
    })),
  }
}

function buildSplitMetric(name: string, playerData: SegResult, staffData: SegResult, yoyValue: number | null = null, yoyPlayerData: SegResult | null = null, yoyStaffData: SegResult | null = null) {
  const series = playerData.series.length > 0 ? playerData.series : staffData.series
  const n = series.length
  const pVals = playerData.values.length === n ? playerData.values : new Array(n).fill(0) as number[]
  const sVals = staffData.values.length === n ? staffData.values : new Array(n).fill(0) as number[]
  const totalVals = series.map((_, i) => (pVals[i] ?? 0) + (sVals[i] ?? 0))

  const thisWeek = n > 0 ? totalVals[n - 1] : 0
  const previousWeek = n > 1 ? totalVals[n - 2] : 0
  const yoyPct = yoyValue !== null ? calcGrowth(thisWeek, yoyValue) : null
  const pThis = n > 0 ? pVals[n - 1] : 0
  const pPrev = n > 1 ? pVals[n - 2] : 0
  const sThis = n > 0 ? sVals[n - 1] : 0
  const sPrev = n > 1 ? sVals[n - 2] : 0

  const yoyPVals = yoyPlayerData?.values ?? []
  const yoySVals = yoyStaffData?.values ?? []
  const hasYoy = yoyPVals.length > 0 || yoySVals.length > 0

  const history = series.map((date, i) => ({
    week: formatWeekLabel(date),
    player: pVals[i] ?? 0,
    staff: sVals[i] ?? 0,
    value: (pVals[i] ?? 0) + (sVals[i] ?? 0),
    lastYear: hasYoy ? ((yoyPVals[i] ?? 0) + (yoySVals[i] ?? 0)) : null,
  }))

  return {
    name,
    thisWeek,
    previousWeek,
    growthPct: calcGrowth(thisWeek, previousWeek),
    yoyPct,
    split: {
      player: { thisWeek: pThis, previousWeek: pPrev, growthPct: calcGrowth(pThis, pPrev), history },
      staff: { thisWeek: sThis, previousWeek: sPrev, growthPct: calcGrowth(sThis, sPrev) },
    },
    history,
  }
}

function buildConversionRate(rawFunnel: FunnelResult, yoyValue: number | null = null, yoyFunnel: FunnelResult | null = null) {
  const { series, stepCounts } = rawFunnel
  const n = stepCounts.length
  const rates = stepCounts.map((steps) => {
    const signUps = steps[0] ?? 0
    const subs = steps[1] ?? 0
    return signUps > 0 ? round1((subs / signUps) * 100) : 0
  })
  const thisWeek = n > 0 ? rates[n - 1] : 0
  const previousWeek = n > 1 ? rates[n - 2] : 0
  const yoyPct = yoyValue !== null ? calcGrowth(thisWeek, yoyValue) : null
  const yoyRates = yoyFunnel?.stepCounts.map((steps) => {
    const signUps = steps[0] ?? 0
    const subs = steps[1] ?? 0
    return signUps > 0 ? round1((subs / signUps) * 100) : 0
  }) ?? []
  return {
    thisWeek,
    previousWeek,
    growthPct: calcGrowth(thisWeek, previousWeek),
    yoyPct,
    history: series.map((date, i) => ({
      week: formatWeekLabel(date.split('T')[0]),
      value: rates[i],
      lastYear: yoyRates.length > 0 ? (yoyRates[i] ?? null) : null,
    })),
  }
}

function buildFeatureAdoption(
  wauBreakdown: BreakdownResult,
  featureResults: SegResult[],
  yoyFeatureResults: SegResult[] = [],
  yoyWauBreakdown: BreakdownResult | null = null,
) {
  // Extract premium WAU series — breakdown key may be 'true' or the boolean string
  const premiumWAUValues: number[] =
    wauBreakdown.breakdown['true'] ??
    wauBreakdown.breakdown['True'] ??
    new Array(wauBreakdown.series.length).fill(0)

  // Use WAU breakdown series if present; otherwise fall back to the first feature series
  // so bar charts still have data even when the $session_start breakdown returns nothing.
  const wauSeries = wauBreakdown.series.length > 0
    ? wauBreakdown.series
    : (featureResults.find((r) => r.series.length > 0)?.series ?? [])

  // YoY premium WAU values (positionally aligned with yoyFeatureResults)
  const yoyPremiumWAUValues: number[] = yoyWauBreakdown
    ? (yoyWauBreakdown.breakdown['true'] ?? yoyWauBreakdown.breakdown['True'] ?? [])
    : []

  // Align feature series to WAU series by date
  const partial = isPartialWeek(premiumWAUValues)
  const effectiveN = partial ? premiumWAUValues.length - 1 : premiumWAUValues.length

  // Current and previous week indices
  const curr = effectiveN - 1
  const prev = effectiveN - 2

  const premiumWAU = curr >= 0 ? premiumWAUValues[curr] : 0

  const features = FEATURE_EVENTS.map(({ name, color }, fi) => {
    const raw = featureResults[fi]

    // Build per-week values aligned to WAU series
    const featureDateMap: Record<string, number> = {}
    raw.series.forEach((d, i) => { featureDateMap[d] = raw.values[i] ?? 0 })
    const featureValues = wauSeries.map((d) => featureDateMap[d] ?? 0)

    const adoptionRates = featureValues.map((users, i) => {
      const wau = premiumWAUValues[i] ?? 0
      return wau > 0 ? round1((users / wau) * 100) : null
    })

    const thisWeekUsers = curr >= 0 ? featureValues[curr] : 0
    const prevWeekUsers = prev >= 0 ? featureValues[prev] : 0
    const adoptionPct = curr >= 0 ? adoptionRates[curr] : null
    const adoptionPctPrev = prev >= 0 ? adoptionRates[prev] : null

    const yoyFeatValues = yoyFeatureResults[fi]?.values ?? []
    const yoyUsers = yoyFeatValues.length > 0 ? (yoyFeatValues[yoyFeatValues.length - 1] ?? 0) : 0
    const yoyPct = yoyUsers > 0 ? calcGrowth(thisWeekUsers, yoyUsers) : null

    const yoyAdoptionRates = yoyPremiumWAUValues.length > 0
      ? yoyFeatValues.map((users, i) => {
          const wau = yoyPremiumWAUValues[i] ?? 0
          return wau > 0 ? round1((users / wau) * 100) : null
        })
      : []

    const history = wauSeries.map((date, i) => ({
      week: formatWeekLabel(date.split('T')[0]),
      users: featureValues[i],
      adoptionPct: adoptionRates[i],
      usersLastYear: yoyFeatValues.length > 0 ? (yoyFeatValues[i] ?? null) : null,
      adoptionPctLastYear: yoyAdoptionRates.length > 0 ? (yoyAdoptionRates[i] ?? null) : null,
    }))

    return {
      name,
      color,
      thisWeek: thisWeekUsers,
      previousWeek: prevWeekUsers,
      growthPct: calcGrowth(thisWeekUsers, prevWeekUsers),
      yoyPct,
      adoptionPct,
      adoptionPctPrev,
      adoptionGrowthPct: adoptionPct !== null && adoptionPctPrev !== null
        ? calcGrowth(adoptionPct, adoptionPctPrev)
        : null,
      history,
    }
  })

  return { premiumWAU, features }
}

// ─── AI Insight ───────────────────────────────────────────────────────────────

async function generateInsight(
  features: ReturnType<typeof buildFeatureAdoption>['features'],
  premiumWAU: number
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  try {
    const lines = features
      .filter((f) => f.adoptionPct !== null)
      .map((f) => {
        const wow = f.adoptionGrowthPct !== null ? `, ${f.adoptionGrowthPct > 0 ? '+' : ''}${f.adoptionGrowthPct}% WoW` : ''
        return `- ${f.name}: ${f.thisWeek} unique users, ${f.adoptionPct}% of Premium WAU${wow}`
      })
      .join('\n')

    const userMessage =
      `Here is this week's feature adoption data for Premium users (ep_premium_access = true):\n\n` +
      `${lines}\n` +
      `- Premium WAU (total active Premium users): ${premiumWAU}\n\n` +
      `Write a 2-3 sentence summary of what these numbers mean this week.`

    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system:
        'You are a product analytics assistant for Elite Prospects, a hockey player database and recruitment platform. ' +
        'Write a 2-3 sentence weekly insight summarising feature adoption among Premium users. ' +
        'Be direct and specific. Focus on what\'s notable — highest adoption, fastest growth, biggest drop, or lowest engagement worth flagging. ' +
        'No filler phrases. No bullet points. Plain prose only.',
      messages: [{ role: 'user', content: userMessage }],
    })

    const block = msg.content[0]
    return block.type === 'text' ? block.text : null
  } catch (err) {
    console.error('Anthropic insight failed:', err)
    return null
  }
}

// ─── Cached computation ───────────────────────────────────────────────────────

async function computeMetrics(auth: string, fromDateStr: string, toDate: string, weekLabel: string) {
  const VERIF_PLAYER_FILTER = 'properties["playerId"] > 0'
  const VERIF_STAFF_FILTER  = 'properties["staffId"] > 0'
  const EDIT_PLAYER_FILTER  = 'properties["player"] > 0'
  const EDIT_STAFF_FILTER   = 'properties["staff"] > 0'
  const emptyFunnel         = { series: [], stepCounts: [] as number[][] }
  const emptyBreakdown      = { series: [], breakdown: {} }

  // YoY reference window: 7 days ending exactly 52 weeks before toDate
  const toDateObj = new Date(toDate + 'T00:00:00')
  const yoyToObj  = new Date(toDateObj)
  yoyToObj.setDate(toDateObj.getDate() - 364)
  const yoyFromObj = new Date(yoyToObj)
  yoyFromObj.setDate(yoyToObj.getDate() - 62) // same 9-week window as main queries
  const yoyToStr   = toDateStr(yoyToObj)
  const yoyFromStr = toDateStr(yoyFromObj)

  // Run all queries through a 4-concurrency pool to stay under Mixpanel's
  // 5 concurrent-query limit and avoid 429s causing zeros in charts.
  const [
    wau, subscriptions,
    verifPlayer, verifStaff,
    editPlayer, editStaff,
    feedVisits, videoViews, messages, watchlisted,
    rawOnboarding, rawConversion,
    wauBreakdown,
    ...featureResults
  ] = await runConcurrent([
    () => safeQuery(auth, 'Visited Player Page',         fromDateStr, toDate, 'unique'),
    () => safeQuery(auth, 'Subscription Started',       fromDateStr, toDate, 'general'),
    () => safeQuery(auth, 'Requested Verification',     fromDateStr, toDate, 'unique', VERIF_PLAYER_FILTER),
    () => safeQuery(auth, 'Requested Verification',     fromDateStr, toDate, 'unique', VERIF_STAFF_FILTER),
    () => safeQuery(auth, 'Profile Edit Section Saved', fromDateStr, toDate, 'unique', EDIT_PLAYER_FILTER),
    () => safeQuery(auth, 'Profile Edit Section Saved', fromDateStr, toDate, 'unique', EDIT_STAFF_FILTER),
    () => safeQuery(auth, 'Visited My Feed',            fromDateStr, toDate, 'general'),
    () => safeQuery(auth, 'Viewed Video',               fromDateStr, toDate, 'general'),
    () => safeQuery(auth, 'Message sent',               fromDateStr, toDate, 'general'),
    () => safeQuery(auth, 'Add Player to Watchlist',    fromDateStr, toDate, 'general'),
    () => queryFunnel(auth, ONBOARDING_FUNNEL_ID, fromDateStr, toDate).catch((err) => {
      console.error('Onboarding funnel failed:', err); return emptyFunnel
    }),
    () => queryFunnel(auth, CONVERSION_FUNNEL_ID, fromDateStr, toDate).catch((err) => {
      console.error('Conversion funnel failed:', err); return emptyFunnel
    }),
    () => queryMixpanelBreakdown(auth, 'Visited Player Page', fromDateStr, toDate, PREMIUM_BREAKDOWN_ON).catch((err) => {
      console.error('WAU breakdown failed:', err); return emptyBreakdown
    }),
    ...FEATURE_EVENTS.map(({ event }) =>
      () => safeQuery(auth, event, fromDateStr, toDate, 'unique', PREMIUM_USER_FILTER)
    ),
  ] as Array<() => Promise<SegResult | FunnelResult | BreakdownResult>>) as [
    SegResult, SegResult, SegResult, SegResult, SegResult, SegResult,
    SegResult, SegResult, SegResult, SegResult,
    FunnelResult, FunnelResult,
    BreakdownResult,
    ...SegResult[]
  ]

  // ── YoY reference queries (62-day window, 52 weeks ago) ───────────────
  const [
    yoyWau, yoySubs,
    yoyVerifP, yoyVerifS,
    yoyEditP, yoyEditS,
    yoyFeed, yoyVid, yoyMsg, yoyWatch,
    yoyConvFunnel,
    yoyWauBreakdown,
    ...yoyFeatureResults
  ] = await runConcurrent([
    () => safeQuery(auth, 'Visited Player Page',         yoyFromStr, yoyToStr, 'unique'),
    () => safeQuery(auth, 'Subscription Started',        yoyFromStr, yoyToStr, 'general'),
    () => safeQuery(auth, 'Requested Verification',      yoyFromStr, yoyToStr, 'unique', VERIF_PLAYER_FILTER),
    () => safeQuery(auth, 'Requested Verification',      yoyFromStr, yoyToStr, 'unique', VERIF_STAFF_FILTER),
    () => safeQuery(auth, 'Profile Edit Section Saved',  yoyFromStr, yoyToStr, 'unique', EDIT_PLAYER_FILTER),
    () => safeQuery(auth, 'Profile Edit Section Saved',  yoyFromStr, yoyToStr, 'unique', EDIT_STAFF_FILTER),
    () => safeQuery(auth, 'Visited My Feed',             yoyFromStr, yoyToStr, 'general'),
    () => safeQuery(auth, 'Viewed Video',                yoyFromStr, yoyToStr, 'general'),
    () => safeQuery(auth, 'Message sent',                yoyFromStr, yoyToStr, 'general'),
    () => safeQuery(auth, 'Add Player to Watchlist',     yoyFromStr, yoyToStr, 'general'),
    () => queryFunnel(auth, CONVERSION_FUNNEL_ID, yoyFromStr, yoyToStr).catch(() => emptyFunnel),
    () => queryMixpanelBreakdown(auth, 'Visited Player Page', yoyFromStr, yoyToStr, PREMIUM_BREAKDOWN_ON).catch(() => emptyBreakdown),
    ...FEATURE_EVENTS.map(({ event }) =>
      () => safeQuery(auth, event, yoyFromStr, yoyToStr, 'unique', PREMIUM_USER_FILTER)
    ),
  ] as Array<() => Promise<SegResult | FunnelResult | BreakdownResult>>) as [
    SegResult, SegResult, SegResult, SegResult, SegResult, SegResult,
    SegResult, SegResult, SegResult, SegResult,
    FunnelResult,
    BreakdownResult,
    ...SegResult[]
  ]

  // Derive YoY scalar values from the single-week results
  const yoyConvRate = (() => {
    const steps = yoyConvFunnel.stepCounts[0] ?? []
    const signUps = steps[0] ?? 0
    const subs = steps[1] ?? 0
    return signUps > 0 ? round1((subs / signUps) * 100) : null
  })()

  // ── Onboarding funnel ────────────────────────────────────────────────────
  const FUNNEL_STEP_NAMES = [
    'Visited Sign Up', 'Sign Up',
    'Onboarding Step 1', 'Onboarding Step 2', 'Onboarding Step 3', 'Onboarding Step 4',
  ]
  const fn = rawOnboarding.stepCounts.length
  const funnelSteps = FUNNEL_STEP_NAMES.map((name, i) => {
    const thisWeek     = fn > 0 ? (rawOnboarding.stepCounts[fn - 1]?.[i] ?? 0) : 0
    const previousWeek = fn > 1 ? (rawOnboarding.stepCounts[fn - 2]?.[i] ?? 0) : 0
    const history = rawOnboarding.series.map((date, wi) => ({
      week: formatWeekLabel(date.split('T')[0]),
      value: rawOnboarding.stepCounts[wi]?.[i] ?? 0,
    }))
    return { name, thisWeek, previousWeek, growthPct: calcGrowth(thisWeek, previousWeek), yoyPct: null, split: null, history }
  })
  const activationRate = funnelSteps[1].thisWeek > 0
    ? round1((funnelSteps[5].thisWeek / funnelSteps[1].thisWeek) * 100)
    : null

  // Per-week signup→completed-onboarding conversion rate history
  const activationRateHistory = rawOnboarding.series.map((date, wi) => {
    const signUps   = rawOnboarding.stepCounts[wi]?.[1] ?? 0
    const completed = rawOnboarding.stepCounts[wi]?.[5] ?? 0
    return {
      week: formatWeekLabel(date.split('T')[0]),
      value: signUps > 0 ? round1((completed / signUps) * 100) : null,
    }
  })

  // ── Feature adoption ─────────────────────────────────────────────────────
  const { premiumWAU, features } = buildFeatureAdoption(wauBreakdown, featureResults, yoyFeatureResults, yoyWauBreakdown)
  const insight = await generateInsight(features, premiumWAU)

  return {
    generatedAt: new Date().toISOString(),
    weekLabel,
    conversionRate: buildConversionRate(rawConversion, yoyConvRate, yoyConvFunnel),
    funnel: { steps: funnelSteps, activationRate, activationRateHistory },
    featureAdoption: { premiumWAU, features, insight },
    groups: [
      {
        name: 'General',
        metrics: [
          buildSimpleMetric('Weekly Active Users', wau, lastVal(yoyWau), yoyWau),
          buildSimpleMetric('New Subscriptions', subscriptions, lastVal(yoySubs), yoySubs),
        ],
      },
      {
        name: 'Player / Staff',
        metrics: [
          buildSplitMetric('New Verification Requests', verifPlayer, verifStaff, lastVal(yoyVerifP) + lastVal(yoyVerifS), yoyVerifP, yoyVerifS),
          buildSplitMetric('Profile Edits Saved', editPlayer, editStaff, lastVal(yoyEditP) + lastVal(yoyEditS), yoyEditP, yoyEditS),
        ],
      },
      {
        name: 'Habit Building',
        metrics: [
          buildSimpleMetric('Feed Visits', feedVisits, lastVal(yoyFeed), yoyFeed),
          buildSimpleMetric('Video Views', videoViews, lastVal(yoyVid), yoyVid),
          buildSimpleMetric('Messages Sent', messages, lastVal(yoyMsg), yoyMsg),
          buildSimpleMetric('Players Watchlisted', watchlisted, lastVal(yoyWatch), yoyWatch),
        ],
      },
    ],
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  const username = process.env.MIXPANEL_SERVICE_ACCOUNT_USERNAME
  const secret = process.env.MIXPANEL_SERVICE_ACCOUNT_SECRET

  if (!username || !secret) {
    return Response.json({ error: 'missing_credentials' })
  }

  const auth = Buffer.from(`${username}:${secret}`).toString('base64')

  // Dynamic date range: 9 completed weeks ending last Sunday
  const today = new Date()
  const dow = today.getDay()
  const daysToLastSunday = dow === 0 ? 7 : dow
  const lastSunday = new Date(today)
  lastSunday.setDate(today.getDate() - daysToLastSunday)

  const fromDate = new Date(lastSunday)
  fromDate.setDate(lastSunday.getDate() - 62)

  const toDate = toDateStr(lastSunday)
  const fromDateStr = toDateStr(fromDate)

  const weekStart = new Date(lastSunday)
  weekStart.setDate(lastSunday.getDate() - 6)
  const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${lastSunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${lastSunday.getFullYear()}`

  // unstable_cache persists the fully-computed payload in Next.js Data Cache,
  // which IS durable across Vercel serverless instances (unlike next: { revalidate }).
  // The cache key includes the date range so stale entries are never served after a week rolls over.
  const getCached = unstable_cache(
    () => computeMetrics(auth, fromDateStr, toDate, weekLabel),
    [`metrics-${fromDateStr}-${toDate}`],
    { revalidate: 21600 } // 6 hours — weekly dashboard, no need to re-query more often
  )

  const payload = await getCached()
  return Response.json(payload)
}
