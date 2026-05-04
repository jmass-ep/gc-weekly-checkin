export const dynamic = 'force-dynamic'

const PROJECT_ID = '2874875'
const BASE_URL = 'https://eu.mixpanel.com/api/query/segmentation'
const FUNNEL_URL = 'https://eu.mixpanel.com/api/query/funnels'
const ONBOARDING_FUNNEL_ID = '87658067'   // "Onboarding Funnel" in Mixpanel
const CONVERSION_FUNNEL_ID = '53623257'   // "Sign-ups to conversion within 7 days" in Mixpanel

interface FunnelResult {
  series: string[]
  stepCounts: number[][]
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

interface SegResult {
  series: string[]
  values: number[]
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

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

function safeQuery(
  auth: string,
  event: string,
  fromDate: string,
  toDate: string,
  type: 'general' | 'unique' = 'general',
  where?: string
): Promise<SegResult> {
  return queryMixpanel(auth, event, fromDate, toDate, type, where).catch((err) => {
    console.error(`safeQuery failed for "${event}":`, err)
    return { series: [], values: [] }
  })
}

function buildSimpleMetric(name: string, data: SegResult) {
  const { series, values } = data
  const n = values.length
  const thisWeek = n > 0 ? values[n - 1] : 0
  const previousWeek = n > 1 ? values[n - 2] : 0
  return {
    name,
    thisWeek,
    previousWeek,
    growthPct: calcGrowth(thisWeek, previousWeek),
    split: null,
    history: series.map((date, i) => ({ week: formatWeekLabel(date), value: values[i] })),
  }
}

function buildSplitMetric(
  name: string,
  playerData: SegResult,
  staffData: SegResult
) {
  // Use player series as the reference; fall back to staff if player is empty
  const series = playerData.series.length > 0 ? playerData.series : staffData.series
  const n = series.length

  const pVals = playerData.values.length === n ? playerData.values : new Array(n).fill(0) as number[]
  const sVals = staffData.values.length === n ? staffData.values : new Array(n).fill(0) as number[]
  const totalVals = series.map((_, i) => (pVals[i] ?? 0) + (sVals[i] ?? 0))

  const thisWeek = n > 0 ? totalVals[n - 1] : 0
  const previousWeek = n > 1 ? totalVals[n - 2] : 0
  const pThis = n > 0 ? pVals[n - 1] : 0
  const pPrev = n > 1 ? pVals[n - 2] : 0
  const sThis = n > 0 ? sVals[n - 1] : 0
  const sPrev = n > 1 ? sVals[n - 2] : 0

  const history = series.map((date, i) => ({
    week: formatWeekLabel(date),
    player: pVals[i] ?? 0,
    staff: sVals[i] ?? 0,
    value: (pVals[i] ?? 0) + (sVals[i] ?? 0),
  }))

  return {
    name,
    thisWeek,
    previousWeek,
    growthPct: calcGrowth(thisWeek, previousWeek),
    split: {
      player: { thisWeek: pThis, previousWeek: pPrev, growthPct: calcGrowth(pThis, pPrev), history },
      staff: { thisWeek: sThis, previousWeek: sPrev, growthPct: calcGrowth(sThis, sPrev) },
    },
    history,
  }
}

function buildConversionRate(rawFunnel: FunnelResult) {
  const { series, stepCounts } = rawFunnel
  const n = stepCounts.length

  const rates = stepCounts.map((steps) => {
    const signUps = steps[0] ?? 0
    const subs = steps[1] ?? 0
    return signUps > 0 ? Math.round((subs / signUps) * 1000) / 10 : 0
  })

  const thisWeek = n > 0 ? rates[n - 1] : 0
  const previousWeek = n > 1 ? rates[n - 2] : 0

  return {
    thisWeek,
    previousWeek,
    growthPct: calcGrowth(thisWeek, previousWeek),
    history: series.map((date, i) => ({
      week: formatWeekLabel(date.split('T')[0]),
      value: rates[i],
    })),
  }
}

export async function GET() {
  const username = process.env.MIXPANEL_SERVICE_ACCOUNT_USERNAME
  const secret = process.env.MIXPANEL_SERVICE_ACCOUNT_SECRET

  if (!username || !secret) {
    return Response.json({ error: 'missing_credentials' })
  }

  const auth = Buffer.from(`${username}:${secret}`).toString('base64')

  // Dynamic date range: 9 completed weeks ending last Sunday
  const today = new Date()
  const dow = today.getDay() // 0=Sun
  const daysToLastSunday = dow === 0 ? 7 : dow
  const lastSunday = new Date(today)
  lastSunday.setDate(today.getDate() - daysToLastSunday)

  const fromDate = new Date(lastSunday)
  fromDate.setDate(lastSunday.getDate() - 62) // Monday of the oldest week

  const toDate = toDateStr(lastSunday)
  const fromDateStr = toDateStr(fromDate)

  const weekStart = new Date(lastSunday)
  weekStart.setDate(lastSunday.getDate() - 6)
  const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${lastSunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${lastSunday.getFullYear()}`

  const VERIF_PLAYER_FILTER = 'properties["playerId"] > 0'
  const VERIF_STAFF_FILTER  = 'properties["staffId"] > 0'
  const EDIT_PLAYER_FILTER  = 'properties["player"] > 0'
  const EDIT_STAFF_FILTER   = 'properties["staff"] > 0'

  const emptyFunnel = { series: [], stepCounts: [] as number[][] }

  const [results, rawOnboarding, rawConversion] = await Promise.all([
    Promise.all([
      safeQuery(auth, '$session_start', fromDateStr, toDate, 'unique'),
      safeQuery(auth, 'Subscription Started', fromDateStr, toDate, 'general'),
      safeQuery(auth, 'Requested Verification', fromDateStr, toDate, 'unique', VERIF_PLAYER_FILTER),
      safeQuery(auth, 'Requested Verification', fromDateStr, toDate, 'unique', VERIF_STAFF_FILTER),
      safeQuery(auth, 'Profile Edit Section Saved', fromDateStr, toDate, 'unique', EDIT_PLAYER_FILTER),
      safeQuery(auth, 'Profile Edit Section Saved', fromDateStr, toDate, 'unique', EDIT_STAFF_FILTER),
      safeQuery(auth, 'Visited My Feed', fromDateStr, toDate, 'general'),
      safeQuery(auth, 'Viewed Video', fromDateStr, toDate, 'general'),
      safeQuery(auth, 'Message sent', fromDateStr, toDate, 'general'),
      safeQuery(auth, 'Add Player to Watchlist', fromDateStr, toDate, 'general'),
    ]),
    queryFunnel(auth, ONBOARDING_FUNNEL_ID, fromDateStr, toDate).catch((err) => {
      console.error('Onboarding funnel query failed:', err)
      return emptyFunnel
    }),
    queryFunnel(auth, CONVERSION_FUNNEL_ID, fromDateStr, toDate).catch((err) => {
      console.error('Conversion funnel query failed:', err)
      return emptyFunnel
    }),
  ])

  const [
    wau,           // Weekly Active Users
    subscriptions, // New Subscriptions
    verifPlayer,   // New Verification Requests — player
    verifStaff,    // New Verification Requests — staff
    editPlayer,    // Profile Edits Saved — player
    editStaff,     // Profile Edits Saved — staff
    feedVisits,    // Feed Visits
    videoViews,    // Video Views
    messages,      // Messages Sent
    watchlisted,   // Players Watchlisted
  ] = results

  const FUNNEL_STEP_NAMES = [
    'Visited Sign Up', 'Sign Up',
    'Onboarding Step 1', 'Onboarding Step 2', 'Onboarding Step 3', 'Onboarding Step 4',
  ]
  const n = rawOnboarding.stepCounts.length
  const funnelSteps = FUNNEL_STEP_NAMES.map((name, i) => {
    const thisWeek = n > 0 ? (rawOnboarding.stepCounts[n - 1]?.[i] ?? 0) : 0
    const previousWeek = n > 1 ? (rawOnboarding.stepCounts[n - 2]?.[i] ?? 0) : 0
    const history = rawOnboarding.series.map((date, wi) => ({
      week: formatWeekLabel(date.split('T')[0]),
      value: rawOnboarding.stepCounts[wi]?.[i] ?? 0,
    }))
    return { name, thisWeek, previousWeek, growthPct: calcGrowth(thisWeek, previousWeek), split: null, history }
  })

  const signUpWeek = funnelSteps[1].thisWeek
  const completedWeek = funnelSteps[5].thisWeek
  const activationRate = signUpWeek > 0
    ? Math.round((completedWeek / signUpWeek) * 1000) / 10
    : null

  const funnel = { steps: funnelSteps, activationRate }
  const conversionRate = buildConversionRate(rawConversion)

  const payload = {
    generatedAt: new Date().toISOString(),
    weekLabel,
    conversionRate,
    funnel,
    groups: [
      {
        name: 'General',
        metrics: [
          buildSimpleMetric('Weekly Active Users', wau),
          buildSimpleMetric('New Subscriptions', subscriptions),
        ],
      },
      {
        name: 'Player / Staff',
        metrics: [
          buildSplitMetric('New Verification Requests', verifPlayer, verifStaff),
          buildSplitMetric('Profile Edits Saved', editPlayer, editStaff),
        ],
      },
      {
        name: 'Habit Building',
        metrics: [
          buildSimpleMetric('Feed Visits', feedVisits),
          buildSimpleMetric('Video Views', videoViews),
          buildSimpleMetric('Messages Sent', messages),
          buildSimpleMetric('Players Watchlisted', watchlisted),
        ],
      },
    ],
  }

  return Response.json(payload, {
    headers: {
      'Cache-Control': 's-maxage=1800, stale-while-revalidate=86400',
    },
  })
}
