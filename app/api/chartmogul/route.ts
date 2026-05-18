import { unstable_cache } from 'next/cache'

const CM_BASE = 'https://api.chartmogul.com/v1/metrics'

function calcGrowth(current: number, previous: number): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

function formatWeekLabel(dateStr: string): string {
  const [y, m, day] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

async function fetchCM(
  auth: string,
  path: string,
  startDate: string,
  endDate: string,
): Promise<Record<string, unknown>> {
  const params = new URLSearchParams({
    'start-date': startDate,
    'end-date': endDate,
    interval: 'week',
  })
  const res = await fetch(`${CM_BASE}${path}?${params}`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`ChartMogul ${path} → HTTP ${res.status}`)
  return res.json()
}

async function computeChartMogul(auth: string, startDate: string, endDate: string) {
  const [mrrJson, custJson] = await Promise.all([
    fetchCM(auth, '/mrr', startDate, endDate),
    fetchCM(auth, '/customer-count', startDate, endDate),
  ])

  const mrrEntries = (mrrJson.entries ?? []) as { date: string; mrr: number }[]
  const custEntries = (custJson.entries ?? []) as { date: string; customers: number }[]

  const mrrValues = mrrEntries.map((e) => e.mrr / 100) // cents → dollars
  const custValues = custEntries.map((e) => e.customers)

  const mrrThis = mrrValues.at(-1) ?? 0
  const mrrPrev = mrrValues.at(-2) ?? 0
  const custThis = custValues.at(-1) ?? 0
  const custPrev = custValues.at(-2) ?? 0

  return {
    mrr: {
      thisWeek: mrrThis,
      previousWeek: mrrPrev,
      growthPct: calcGrowth(mrrThis, mrrPrev),
      history: mrrEntries.map((e, i) => ({
        week: formatWeekLabel(e.date),
        value: mrrValues[i],
      })),
    },
    arr: {
      thisWeek: mrrThis * 12,
      previousWeek: mrrPrev * 12,
      growthPct: calcGrowth(mrrThis * 12, mrrPrev * 12),
    },
    subscribers: {
      thisWeek: custThis,
      previousWeek: custPrev,
      growthPct: calcGrowth(custThis, custPrev),
      history: custEntries.map((e, i) => ({
        week: formatWeekLabel(e.date),
        value: custValues[i],
      })),
    },
  }
}

export async function GET() {
  const apiKey = process.env.CHARTMOGUL_API_KEY
  if (!apiKey) return Response.json({ error: 'missing_credentials' })

  const auth = Buffer.from(`${apiKey}:`).toString('base64')

  const today = new Date()
  const endDate = toDateStr(today)
  const startDateObj = new Date(today)
  startDateObj.setDate(today.getDate() - 63) // ~9 weeks back
  const startDateStr = toDateStr(startDateObj)

  const getCached = unstable_cache(
    () => computeChartMogul(auth, startDateStr, endDate),
    [`chartmogul-${startDateStr}-${endDate}`],
    { revalidate: 1800 },
  )

  try {
    const payload = await getCached()
    return Response.json(payload)
  } catch (err) {
    console.error('ChartMogul fetch failed:', err)
    return Response.json({ error: 'fetch_failed' }, { status: 500 })
  }
}
