'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis,
  Tooltip, Legend,
  ReferenceLine,
  ResponsiveContainer,
  LabelList,
} from 'recharts'

interface SimplePoint {
  week: string
  value: number
  lastYear?: number | null
}

interface SplitPoint {
  week: string
  player: number
  staff: number
  value: number
  lastYear?: number | null
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
  yoyPct: number | null
  split: MetricSplit | null
  history: SimplePoint[] | SplitPoint[]
}

interface GroupData {
  name: string
  metrics: MetricData[]
}

interface FunnelData {
  steps: MetricData[]
  activationRate: number | null
  activationRateHistory: { week: string; value: number | null }[]
}

interface ConversionRateData {
  thisWeek: number
  previousWeek: number
  growthPct: number | null
  yoyPct: number | null
  history: SimplePoint[]
}

interface FeatureHistory {
  week: string
  users: number
  adoptionPct: number | null
  usersLastYear?: number | null
  adoptionPctLastYear?: number | null
}

interface FeatureMetric {
  name: string
  color: string
  thisWeek: number
  previousWeek: number
  growthPct: number | null
  yoyPct: number | null
  adoptionPct: number | null
  adoptionPctPrev: number | null
  adoptionGrowthPct: number | null
  history: FeatureHistory[]
}

interface FeatureAdoptionData {
  premiumWAU: number
  features: FeatureMetric[]
  insight: string | null
}

interface DashboardData {
  generatedAt: string
  weekLabel: string
  conversionRate: ConversionRateData
  funnel: FunnelData
  featureAdoption: FeatureAdoptionData
  groups: GroupData[]
}

interface CmSimple {
  thisWeek: number
  previousWeek: number
  growthPct: number | null
}

interface CmWithHistory extends CmSimple {
  history: SimplePoint[]
}

interface ChartMogulData {
  mrr: CmWithHistory
  arr: CmSimple
  subscribers: CmWithHistory
}

function GrowthBadge({ pct, label = 'WoW' }: { pct: number | null; label?: string }) {
  if (pct === null) {
    return <span className="text-sm text-[#64748B]">— {label}</span>
  }
  if (pct === 0) {
    return <span className="text-sm text-[#64748B]">0.0% {label}</span>
  }
  const pos = pct > 0
  return (
    <span className={`text-sm font-semibold ${pos ? 'text-[#16A34A]' : 'text-[#C8102E]'}`}>
      {pos ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}% {label}
    </span>
  )
}

function MetricCard({ metric, note }: { metric: MetricData; note?: string }) {
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
        <GrowthBadge pct={metric.yoyPct} label="YoY" />
        {note && (
          <p className="text-[10px] text-[#94A3B8] mt-1 leading-snug">{note}</p>
        )}
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
                formatter={(value, name) => [
                  typeof value === 'number' ? value.toLocaleString() : String(value),
                  name === 'lastYear' ? 'Last Year' : name === 'player' ? 'Player' : name === 'staff' ? 'Staff' : 'This Year',
                ]}
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
              {(() => {
                const ly = metric.history.at(-1)?.lastYear
                return ly != null ? (
                  <ReferenceLine y={ly} stroke="#94A3B8" strokeDasharray="4 4" strokeWidth={1.5} />
                ) : null
              })()}
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
  { name: 'General', count: 3 },
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
          width: 'clamp(340px, 60vw, 660px)',
          maxWidth: '100%',
          borderRadius: '12px',
          display: 'block',
        }}
      />

      {/* Progress bar */}
      <div
        style={{
          marginTop: '2rem',
          width: 'clamp(340px, 60vw, 660px)',
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

function FunnelCard({ funnel }: { funnel: FunnelData }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const chartData = funnel.steps.map((s) => ({ name: s.name, value: s.thisWeek }))

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
      <div className="flex items-start justify-between mb-6">
        <p className="text-sm font-semibold text-[#0D2137] leading-snug">Onboarding Funnel</p>
        <div className="text-right">
          <span className="text-5xl font-bold text-[#1A202C] tabular-nums leading-none">
            {funnel.activationRate !== null ? `${funnel.activationRate.toFixed(1)}%` : '—'}
          </span>
          <p className="text-xs text-[#64748B] mt-1">Sign Up → Completed Onboarding</p>
        </div>
      </div>
      {mounted && (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            layout="vertical"
            data={chartData}
            margin={{ top: 0, right: 64, bottom: 0, left: 0 }}
            barCategoryGap="28%"
          >
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: '#64748B' }}
              axisLine={false}
              tickLine={false}
              width={130}
            />
            <Bar dataKey="value" fill="#0D2137" radius={[0, 4, 4, 0]} barSize={20}>
              <LabelList
                dataKey="value"
                position="right"
                formatter={(v: unknown) => typeof v === 'number' ? v.toLocaleString() : String(v)}
                style={{ fontSize: 11, fill: '#64748B' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Activation rate trend sparkline */}
      {mounted && funnel.activationRateHistory && funnel.activationRateHistory.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[#E2E8F0]">
          <p className="text-xs text-[#64748B] mb-2">Conversion Rate Trend (Sign Up → Completed Onboarding)</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={funnel.activationRateHistory} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 9, fill: '#64748B' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
                width={28}
              />
              <Tooltip
                formatter={(v) => [`${Number(v).toFixed(1)}%`, 'Conversion Rate']}
                labelFormatter={(label) => `Week of ${label}`}
                contentStyle={{ fontSize: 12, border: '1px solid #E2E8F0', borderRadius: 6 }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#C8102E"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function ConversionRateCard({ data: cr }: { data: ConversionRateData }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col gap-3">
      <p className="text-sm font-semibold text-[#0D2137] leading-snug">Free to Paid Conversion</p>

      <div className="flex flex-col gap-0.5">
        <span className="text-3xl font-bold text-[#1A202C] tabular-nums leading-tight">
          {cr.thisWeek > 0 ? `${cr.thisWeek.toFixed(1)}%` : '—'}
        </span>
        <GrowthBadge pct={cr.growthPct} />
        <GrowthBadge pct={cr.yoyPct} label="YoY" />
      </div>

      <div className="h-32">
        {mounted && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={cr.history}
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
                formatter={(v) => typeof v === 'number' ? `${v.toFixed(1)}%` : String(v)}
                labelFormatter={(label) => `Week of ${label}`}
                contentStyle={{
                  fontSize: 12,
                  border: '1px solid #E2E8F0',
                  borderRadius: 6,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                }}
              />
              <Bar dataKey="value" fill="#0D2137" radius={[2, 2, 0, 0]} />
              {(() => {
                const ly = cr.history.at(-1)?.lastYear
                return ly != null ? (
                  <ReferenceLine y={ly} stroke="#94A3B8" strokeDasharray="4 4" strokeWidth={1.5} />
                ) : null
              })()}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

function ChartMogulSection({ data: cm }: { data: ChartMogulData }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  function formatMoney(n: number) {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
    return `$${n.toFixed(0)}`
  }

  const cards: {
    label: string
    value: string
    growthPct: number | null
    history?: SimplePoint[]
    color: string
  }[] = [
    { label: 'MRR', value: formatMoney(cm.mrr.thisWeek), growthPct: cm.mrr.growthPct, history: cm.mrr.history, color: '#0D2137' },
    { label: 'ARR', value: formatMoney(cm.arr.thisWeek), growthPct: cm.arr.growthPct, history: cm.mrr.history.map((h) => ({ ...h, value: h.value * 12 })), color: '#0D2137' },
    { label: 'Active Subscribers', value: cm.subscribers.thisWeek.toLocaleString(), growthPct: cm.subscribers.growthPct, history: cm.subscribers.history, color: '#C8102E' },
  ]

  return (
    <section>
      <h2
        className="text-xs font-bold uppercase tracking-widest text-[#0D2137] pl-3 mb-4"
        style={{ borderLeft: '3px solid #C8102E' }}
      >
        ChartMogul Weekly Summary
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col gap-3">
            <p className="text-sm font-semibold text-[#0D2137] leading-snug">{c.label}</p>
            <div className="flex flex-col gap-0.5">
              <span className="text-3xl font-bold text-[#1A202C] tabular-nums leading-tight">{c.value}</span>
              <GrowthBadge pct={c.growthPct} />
            </div>
            {c.history && c.history.length > 0 && (
              <div className="h-24">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={c.history} margin={{ top: 2, right: 0, bottom: 0, left: 0 }} barCategoryGap="25%">
                      <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#64748B' }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip
                        formatter={(v) =>
                          typeof v === 'number'
                            ? c.label === 'Active Subscribers'
                              ? v.toLocaleString()
                              : formatMoney(v)
                            : String(v)
                        }
                        labelFormatter={(label) => `Week of ${label}`}
                        contentStyle={{ fontSize: 12, border: '1px solid #E2E8F0', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                      />
                      <Bar dataKey="value" fill={c.color} radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function FeatureCard({ feature, premiumWAU }: { feature: FeatureMetric; premiumWAU: number }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const chartData = feature.history.map((h) => ({ week: h.week, value: h.users, lastYear: h.usersLastYear ?? null }))

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: feature.color }} />
        <p className="text-sm font-semibold text-[#0D2137] leading-snug">{feature.name}</p>
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-3xl font-bold text-[#1A202C] tabular-nums leading-tight">
          {feature.thisWeek.toLocaleString()}
        </span>
        <div className="flex items-center gap-2">
          {feature.adoptionPct !== null && (
            <span className="text-xs text-[#64748B]">
              {feature.adoptionPct.toFixed(1)}% of {premiumWAU > 0 ? premiumWAU.toLocaleString() : '—'} Premium users
            </span>
          )}
        </div>
        <GrowthBadge pct={feature.growthPct} />
        <GrowthBadge pct={feature.yoyPct} label="YoY" />
      </div>

      <div className="h-24">
        {mounted && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }} barCategoryGap="25%">
              <XAxis dataKey="week" tick={{ fontSize: 9, fill: '#64748B' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                formatter={(v) => typeof v === 'number' ? v.toLocaleString() : String(v)}
                labelFormatter={(label) => `Week of ${label}`}
                contentStyle={{ fontSize: 12, border: '1px solid #E2E8F0', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
              />
              <Bar dataKey="value" fill={feature.color} radius={[2, 2, 0, 0]} />
              {(() => {
                const ly = chartData.at(-1)?.lastYear
                return ly != null ? (
                  <ReferenceLine y={ly} stroke="#94A3B8" strokeDasharray="4 4" strokeWidth={1.5} />
                ) : null
              })()}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

function FeatureAdoptionSection({ data: fa }: { data: FeatureAdoptionData }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const hasAdoptionData = fa.features.some((f) => f.history.some((h) => (h.adoptionPct ?? 0) > 0))

  // Build combined chart data — adoption % when available, user counts as fallback
  // Also include _ly (last year) keys for dashed YoY overlay lines
  const weekMap = new Map<string, Record<string, number | null>>()
  fa.features.forEach((f) => {
    f.history.forEach((h) => {
      if (!weekMap.has(h.week)) weekMap.set(h.week, { week: h.week as unknown as number } as Record<string, number | null>)
      weekMap.get(h.week)![f.name] = hasAdoptionData ? h.adoptionPct : h.users
      weekMap.get(h.week)![`${f.name}_ly`] = hasAdoptionData
        ? (h.adoptionPctLastYear ?? null)
        : (h.usersLastYear ?? null)
    })
  })
  const combinedData = Array.from(weekMap.values())

  return (
    <section>
      <h2
        className="text-xs font-bold uppercase tracking-widest text-[#0D2137] pl-3 mb-4"
        style={{ borderLeft: '3px solid #C8102E' }}
      >
        Feature Adoption — Premium Users
      </h2>

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {fa.features.map((f) => (
          <FeatureCard key={f.name} feature={f} premiumWAU={fa.premiumWAU} />
        ))}
      </div>

      {/* Combined 8-week adoption rate trend */}
      {mounted && combinedData.length > 0 && (
        <div className="bg-white border border-[#E2E8F0] rounded-xl p-5">
          <p className="text-sm font-semibold text-[#0D2137] mb-4">
            {hasAdoptionData ? '8-Week Adoption Rate Trend' : '8-Week User Trend'}
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={combinedData} margin={{ top: 4, right: 48, bottom: 0, left: 0 }}>
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} />
              {/* Left axis: Visited My Feed (high values) */}
              <YAxis
                yAxisId="feed"
                orientation="left"
                tick={{ fontSize: 10, fill: '#64748B' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => hasAdoptionData ? `${v}%` : v.toLocaleString()}
                width={36}
              />
              {/* Right axis: other 3 features (lower values) */}
              <YAxis
                yAxisId="others"
                orientation="right"
                tick={{ fontSize: 10, fill: '#64748B' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => hasAdoptionData ? `${v}%` : v.toLocaleString()}
                width={36}
              />
              <Tooltip
                formatter={(v, name) => {
                  const n = String(name)
                  const isLy = n.endsWith('_ly')
                  const label = isLy ? `${n.slice(0, -3)} (LY)` : n
                  const display = hasAdoptionData ? `${Number(v).toFixed(2)}%` : Number(v).toLocaleString()
                  return [display, label]
                }}
                labelFormatter={(label) => `Week of ${label}`}
                contentStyle={{ fontSize: 12, border: '1px solid #E2E8F0', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
              />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              {fa.features.map((f) => (
                <Line
                  key={f.name}
                  type="monotone"
                  dataKey={f.name}
                  stroke={f.color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  yAxisId={f.name === 'Visited My Feed' ? 'feed' : 'others'}
                />
              ))}
              {fa.features.map((f) => (
                <Line
                  key={`${f.name}_ly`}
                  type="monotone"
                  dataKey={`${f.name}_ly`}
                  stroke={f.color}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  strokeOpacity={0.5}
                  dot={false}
                  activeDot={false}
                  legendType="none"
                  connectNulls={false}
                  yAxisId={f.name === 'Visited My Feed' ? 'feed' : 'others'}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* AI-generated insight */}
      {fa.insight && (
        <div className="mt-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-5 py-4 flex gap-3">
          <span className="text-[#C8102E] text-lg leading-none mt-0.5">✦</span>
          <p className="text-sm text-[#1A202C] leading-relaxed">{fa.insight}</p>
        </div>
      )}
    </section>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingVisible, setLoadingVisible] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [missingCreds, setMissingCreds] = useState(false)
  const [cmData, setCmData] = useState<ChartMogulData | null>(null)

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
    fetch('/api/chartmogul')
      .then((r) => r.json())
      .then((j: ChartMogulData & { error?: string }) => { if (!j.error) setCmData(j) })
      .catch(() => {})
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
            {/* ChartMogul Weekly Summary — always first */}
            {cmData && (
              <ChartMogulSection data={cmData} />
            )}

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
              data.groups.map((group, gi) => (
                <section key={group.name}>
                  <h2
                    className="text-xs font-bold uppercase tracking-widest text-[#0D2137] pl-3 mb-4"
                    style={{ borderLeft: '3px solid #C8102E' }}
                  >
                    {group.name}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {group.metrics.map((metric) => (
                      <MetricCard
                        key={metric.name}
                        metric={metric}
                        note={metric.name === 'Weekly Active Users' ? 'Proxied via Visited Player Page — tracks closely with session starts' : undefined}
                      />
                    ))}
                    {gi === 0 && data.conversionRate && (
                      <ConversionRateCard data={data.conversionRate} />
                    )}
                  </div>
                </section>
              ))
            ) : null}

            {/* Activation funnel */}
            {data?.funnel && (
              <section>
                <h2
                  className="text-xs font-bold uppercase tracking-widest text-[#0D2137] pl-3 mb-4"
                  style={{ borderLeft: '3px solid #C8102E' }}
                >
                  Activation
                </h2>
                <FunnelCard funnel={data.funnel} />
              </section>
            )}

            {/* Feature Adoption */}
            {data?.featureAdoption && (
              <FeatureAdoptionSection data={data.featureAdoption} />
            )}
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
