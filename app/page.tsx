'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface SimplePoint {
  week: string
  value: number
}

interface SplitPoint {
  week: string
  player: number
  staff: number
  value: number
}

interface SplitSide {
  thisWeek: number
  previousWeek: number
  growthPct: number | null
}

interface MetricSplit {
  player: SplitSide & { history: SplitPoint[] }
  staff: SplitSide
}

interface MetricData {
  name: string
  thisWeek: number
  previousWeek: number
  growthPct: number | null
  split: MetricSplit | null
  history: SimplePoint[] | SplitPoint[]
}

interface GroupData {
  name: string
  metrics: MetricData[]
}

interface DashboardData {
  generatedAt: string
  weekLabel: string
  groups: GroupData[]
}

function GrowthBadge({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="text-sm text-[#64748B]">— WoW</span>
  }
  if (pct === 0) {
    return <span className="text-sm text-[#64748B]">0.0% WoW</span>
  }
  const pos = pct > 0
  return (
    <span className={`text-sm font-semibold ${pos ? 'text-[#16A34A]' : 'text-[#C8102E]'}`}>
      {pos ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}% WoW
    </span>
  )
}

function MetricCard({ metric }: { metric: MetricData }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const isSplit = metric.split !== null

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col gap-3">
      <p className="text-sm font-semibold text-[#0D2137] leading-snug">{metric.name}</p>

      <div className="flex flex-col gap-0.5">
        <span className="text-3xl font-bold text-[#1A202C] tabular-nums leading-tight">
          {metric.thisWeek.toLocaleString()}
        </span>
        <GrowthBadge pct={metric.growthPct} />
      </div>

      <div className="h-32">
        {mounted && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={metric.history}
              margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
              barCategoryGap="25%"
            >
              <XAxis
                dataKey="week"
                tick={{ fontSize: 9, fill: '#64748B' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip
                formatter={(value) => (typeof value === 'number' ? value.toLocaleString() : String(value))}
                labelFormatter={(label) => `Week of ${label}`}
                contentStyle={{
                  fontSize: 12,
                  border: '1px solid #E2E8F0',
                  borderRadius: 6,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                }}
              />
              {isSplit ? (
                <>
                  <Bar dataKey="player" stackId="s" fill="#0D2137" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="staff" stackId="s" fill="#C8102E" radius={[2, 2, 0, 0]} />
                </>
              ) : (
                <Bar dataKey="value" fill="#0D2137" radius={[2, 2, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {isSplit && (
        <div className="flex gap-4 text-xs text-[#64748B]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-[2px] bg-[#0D2137]" />
            Player
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-[2px] bg-[#C8102E]" />
            Staff
          </span>
        </div>
      )}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col gap-3 animate-pulse">
      <div className="h-4 bg-[#E2E8F0] rounded w-2/3" />
      <div className="flex flex-col gap-1.5">
        <div className="h-8 bg-[#E2E8F0] rounded w-1/3" />
        <div className="h-4 bg-[#E2E8F0] rounded w-1/5" />
      </div>
      <div className="h-32 bg-[#E2E8F0] rounded-lg" />
    </div>
  )
}

const SKELETON_GROUPS = [
  { name: 'General', count: 2 },
  { name: 'Player / Staff', count: 2 },
  { name: 'Habit Building', count: 4 },
]

function LoadingScreen({ visible }: { visible: boolean }) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!visible) return
    const start = Date.now()
    const duration = 8000
    let raf: number

    function tick() {
      const elapsed = Date.now() - start
      const pct = Math.min((elapsed / duration) * 100, 100)
      setProgress(pct)
      if (pct < 100) raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [visible])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 800ms ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >

      {/* Title */}
      <p
        style={{
          fontFamily: 'var(--font-bebas)',
          fontSize: 'clamp(2rem, 6vw, 4rem)',
          color: '#0D2137',
          letterSpacing: '0.05em',
          marginBottom: '2rem',
          textAlign: 'center',
          lineHeight: 1,
        }}
      >
        G&amp;C Weekly Check-In
      </p>

      {/* Video */}
      <video
        src="/justin-phone.mp4"
        autoPlay
        muted
        loop
        playsInline
        style={{
          width: 'clamp(180px, 30vw, 340px)',
          borderRadius: '12px',
          display: 'block',
        }}
      />

      {/* Progress bar */}
      <div
        style={{
          marginTop: '2rem',
          width: 'clamp(180px, 30vw, 340px)',
          height: '3px',
          backgroundColor: 'rgba(0,0,0,0.10)',
          borderRadius: '2px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            backgroundColor: '#C8102E',
            transition: 'width 100ms linear',
            borderRadius: '2px',
          }}
        />
      </div>

      {/* Label */}
      <p
        style={{
          marginTop: '0.75rem',
          color: '#64748B',
          fontSize: '0.7rem',
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
        }}
      >
        Loading this week&apos;s numbers...
      </p>

      {/* EP wordmark */}
      <p
        style={{
          position: 'absolute',
          bottom: '1.5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          color: 'rgba(13,33,55,0.35)',
          fontSize: '0.6rem',
          letterSpacing: '0.25em',
          textTransform: 'lowercase',
          whiteSpace: 'nowrap',
        }}
      >
        elite prospects
      </p>
    </div>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingVisible, setLoadingVisible] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [missingCreds, setMissingCreds] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/metrics')
      const json: DashboardData & { error?: string } = await res.json()

      if (json.error === 'missing_credentials') {
        setMissingCreds(true)
        setData(null)
        setLoading(false)
        return
      }

      if (!res.ok) throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`)

      setMissingCreds(false)
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Once the initial fetch resolves, fade out the loading screen
  useEffect(() => {
    if (!loading) {
      // Give the fade-out transition 800ms then fully hide
      const t = setTimeout(() => setLoadingVisible(false), 800)
      return () => clearTimeout(t)
    }
  }, [loading])

  const weekLabel = data?.weekLabel ?? '—'
  const generatedAt = data?.generatedAt

  return (
    <>
      <LoadingScreen visible={loading || loadingVisible} />

      <div
        className="min-h-screen bg-[#F0F4F8]"
        style={{
          opacity: loading ? 0 : 1,
          transition: 'opacity 600ms ease',
        }}
      >
        {/* Header */}
        <header style={{ backgroundColor: '#0D2137' }} className="w-full px-4 sm:px-6 py-4">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <div>
              <h1 className="text-white text-xl sm:text-2xl font-bold leading-tight">
                G&amp;C Weekly Check-In
              </h1>
              <p className="text-white/60 text-xs sm:text-sm mt-0.5">Elite Prospects Production</p>
            </div>
            {!loading && !missingCreds && (
              <p className="text-white/80 text-sm">
                Week of {weekLabel}
              </p>
            )}
          </div>
        </header>

        {/* Missing credentials banner */}
        {missingCreds && (
          <div className="bg-amber-50 border-l-4 border-amber-400 px-4 sm:px-6 py-3">
            <p className="text-amber-800 text-sm">
              Mixpanel credentials not configured — add them to <code className="font-mono bg-amber-100 px-1 rounded">.env.local</code> to load data.
            </p>
          </div>
        )}

        {/* Full-page error */}
        {error && (
          <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
            <p className="text-[#1A202C] text-lg font-semibold mb-2">Failed to load dashboard data</p>
            <p className="text-[#64748B] text-sm mb-6 max-w-sm">{error}</p>
            <button
              onClick={loadData}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: '#0D2137' }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Main content */}
        {!error && (
          <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10">
            {loading ? (
              SKELETON_GROUPS.map((g) => (
                <section key={g.name}>
                  <div className="h-5 bg-[#CBD5E1] rounded w-32 mb-4 animate-pulse" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {Array.from({ length: g.count }).map((_, i) => (
                      <SkeletonCard key={i} />
                    ))}
                  </div>
                </section>
              ))
            ) : data ? (
              data.groups.map((group) => (
                <section key={group.name}>
                  <h2
                    className="text-xs font-bold uppercase tracking-widest text-[#0D2137] pl-3 mb-4"
                    style={{ borderLeft: '3px solid #C8102E' }}
                  >
                    {group.name}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {group.metrics.map((metric) => (
                      <MetricCard key={metric.name} metric={metric} />
                    ))}
                  </div>
                </section>
              ))
            ) : null}
          </main>
        )}

        {/* Footer */}
        {!error && !loading && data && (
          <footer className="max-w-7xl mx-auto px-4 sm:px-6 pb-8 flex items-center justify-between">
            <p className="text-xs text-[#64748B]">
              Last refreshed:{' '}
              {generatedAt
                ? new Date(generatedAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—'}
            </p>
            <button
              onClick={loadData}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
              style={{ backgroundColor: '#0D2137' }}
            >
              Refresh
            </button>
          </footer>
        )}
      </div>
    </>
  )
}
