'use client'

import React, { useId, useMemo } from 'react'

// ========================================================================
// Shared Types
// ========================================================================
interface LineChartData {
  label: string
  value1: number
  value2: number
}

interface DonutData {
  name: string
  value: number
}

interface FunnelData {
  impressions: number
  clicks: number
  conversions: number
}

// ========================================================================
// Helper: สร้าง platform display name จากชื่อแพลตฟอร์ม
// ========================================================================
export function formatPlatformName(platform: string): string {
  return platform.replace('-ads', '').replace('-shop', ' Shop').toUpperCase()
}

// ========================================================================
// Helper: สีตาม platform
// ========================================================================
export function getPlatformColor(platform: string): string {
  switch (platform) {
    case 'google-ads': return '#EAB308'
    case 'facebook-ads': return '#2563EB'
    case 'tiktok-ads': return '#10B981'
    case 'tiktok-shop': return '#EC4899'
    default: return '#6366F1'
  }
}

// ========================================================================
// 1. DualAxisLineChart — กราฟเส้นเปรียบเทียบสองแกน
// ========================================================================
export const DualAxisLineChart = React.memo(function DualAxisLineChart({
  data,
  label1 = 'Spend ($)',
  label2 = 'ROAS (x)'
}: {
  data: LineChartData[]
  label1?: string
  label2?: string
}) {
  const gradientId = useId()
  const width = 600
  const height = 280
  const paddingLeft = 50
  const paddingRight = 50
  const paddingTop = 30
  const paddingBottom = 40

  const chartData = useMemo(() => {
    if (data.length === 0) return null

    const maxVal1 = Math.max(...data.map(d => d.value1), 1)
    const maxVal2 = Math.max(...data.map(d => d.value2), 1)

    const chartWidth = width - paddingLeft - paddingRight
    const chartHeight = height - paddingTop - paddingBottom

    const points1 = data.map((d, i) => {
      const x = paddingLeft + (i / (data.length - 1 || 1)) * chartWidth
      const y = paddingTop + chartHeight - (d.value1 / maxVal1) * chartHeight
      return { x, y }
    })

    const points2 = data.map((d, i) => {
      const x = paddingLeft + (i / (data.length - 1 || 1)) * chartWidth
      const y = paddingTop + chartHeight - (d.value2 / maxVal2) * chartHeight
      return { x, y }
    })

    const pathData1 = points1.reduce((acc, p, i) => i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, '')
    const pathData2 = points2.reduce((acc, p, i) => i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, '')

    return { maxVal1, maxVal2, points1, points2, pathData1, pathData2, chartWidth, chartHeight }
  }, [data])

  if (!chartData) {
    return (
      <div style={{ height: `${height}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        No data available
      </div>
    )
  }

  const { maxVal1, maxVal2, points1, points2, pathData1, pathData2, chartHeight: ch } = chartData

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '10px', fontSize: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ display: 'inline-block', width: '12px', height: '3px', background: '#8B5CF6' }}></span>
          <span style={{ color: 'var(--foreground)' }}>{label1}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ display: 'inline-block', width: '12px', height: '3px', background: '#10B981' }}></span>
          <span style={{ color: 'var(--foreground)' }}>{label2}</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.2"/>
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0"/>
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((r, idx) => {
          const y = paddingTop + r * ch
          return (
            <line key={idx} x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="rgba(255, 255, 255, 0.05)" strokeDasharray="3" />
          )
        })}

        <text x={paddingLeft - 10} y={paddingTop + 5} textAnchor="end" fill="#A78BFA" fontSize="10" fontWeight="600">
          ${Math.round(maxVal1)}
        </text>
        <text x={paddingLeft - 10} y={paddingTop + ch + 4} textAnchor="end" fill="#A78BFA" fontSize="10" fontWeight="600">
          $0
        </text>

        <text x={width - paddingRight + 10} y={paddingTop + 5} textAnchor="start" fill="#34D399" fontSize="10" fontWeight="600">
          {maxVal2.toFixed(1)}x
        </text>
        <text x={width - paddingRight + 10} y={paddingTop + ch + 4} textAnchor="start" fill="#34D399" fontSize="10" fontWeight="600">
          0x
        </text>

        {points1.length > 0 && (
          <path
            d={`${pathData1} L ${points1[points1.length - 1].x} ${paddingTop + ch} L ${points1[0].x} ${paddingTop + ch} Z`}
            fill={`url(#${gradientId})`}
          />
        )}

        <path d={pathData1} fill="none" stroke="#8B5CF6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d={pathData2} fill="none" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        {data.map((d, i) => {
          const p1 = points1[i]
          const p2 = points2[i]
          
          return (
            <g key={i}>
              <circle cx={p1.x} cy={p1.y} r="4" fill="#8B5CF6" stroke="#080B11" strokeWidth="1.5" />
              <circle cx={p2.x} cy={p2.y} r="4" fill="#10B981" stroke="#080B11" strokeWidth="1.5" />
              {(data.length < 8 || i % 2 === 0 || i === data.length - 1) && (
                <text x={p1.x} y={paddingTop + ch + 20} textAnchor="middle" fill="var(--text-muted)" fontSize="9">
                  {d.label.length > 10 ? d.label.substring(5) : d.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
})

// ========================================================================
// 2. BudgetDonutChart — กราฟโดนัทแสดงสัดส่วนงบประมาณ (Fixed segment overlap bug)
// ========================================================================
export const BudgetDonutChart = React.memo(function BudgetDonutChart({ data }: { data: DonutData[] }) {
  const size = 180
  const radius = 60
  const strokeWidth = 18
  const center = size / 2
  const circumference = 2 * Math.PI * radius

  const colors = ['#8B5CF6', '#10B981', '#3B82F6', '#EC4899', '#F59E0B']

  const total = data.reduce((acc, d) => acc + d.value, 0)

  if (total === 0) {
    return (
      <div style={{ height: `${size}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        No data
      </div>
    )
  }

  // 🐛 Fix: คำนวณ segment offsets ที่ถูกต้อง ป้องกัน segment ทับซ้อนกัน
  let cumulativePercent = 0
  const segments = data.map((item, idx) => {
    const percent = item.value / total
    const dashArray = `${percent * circumference} ${(1 - percent) * circumference}`
    const rotation = cumulativePercent * 360 - 90
    cumulativePercent += percent
    return { dashArray, rotation, color: colors[idx % colors.length] }
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', width: '100%' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={center} cy={center} r={radius} fill="transparent" stroke="rgba(255,255,255,0.03)" strokeWidth={strokeWidth} />
        {segments.map((seg, idx) => (
          <circle
            key={idx}
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={seg.dashArray}
            strokeDashoffset="0"
            transform={`rotate(${seg.rotation} ${center} ${center})`}
            strokeLinecap="round"
          />
        ))}
        <text x="50%" y="47%" textAnchor="middle" fill="var(--text-muted)" fontSize="10" fontWeight="600">
          TOTAL
        </text>
        <text x="50%" y="60%" textAnchor="middle" fill="white" fontSize="16" fontWeight="800">
          ฿{Math.round(total).toLocaleString()}
        </text>
      </svg>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        {data.map((item, idx) => {
          const percent = total > 0 ? (item.value / total * 100).toFixed(1) : '0'
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: colors[idx % colors.length] }}></span>
                <span style={{ color: 'var(--text-muted)' }}>{item.name}</span>
              </div>
              <strong>{percent}%</strong>
            </div>
          )
        })}
      </div>
    </div>
  )
})

// ========================================================================
// 3. UserJourneyFunnel — แฟนเนลกรวยประสิทธิภาพโฆษณา
// ========================================================================
export const UserJourneyFunnel = React.memo(function UserJourneyFunnel({ data }: { data: FunnelData }) {
  const steps = [
    { name: 'Impressions (การเห็น)', value: data.impressions, color: '#3B82F6' },
    { name: 'Clicks (การกด)', value: data.clicks, color: '#8B5CF6' },
    { name: 'Conversions (ผลลัพธ์)', value: data.conversions, color: '#10B981' }
  ]

  const maxVal = steps[0].value || 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
      {steps.map((step, idx) => {
        const percentOfMax = maxVal > 0 ? (step.value / maxVal) * 100 : 0
        const prevStepVal = idx > 0 ? steps[idx - 1].value : 0
        const dropoff = idx > 0 && prevStepVal > 0 ? ((step.value / prevStepVal) * 100).toFixed(1) : null

        return (
          <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
              <span style={{ color: 'var(--foreground)', fontWeight: '600' }}>{step.name}</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <strong style={{ color: step.color }}>{step.value.toLocaleString()}</strong>
                {dropoff && (
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px', background: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: '4px' }}>
                    Conversion: {dropoff}%
                  </span>
                )}
              </div>
            </div>
            
            <div style={{ width: '100%', height: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', overflow: 'hidden', position: 'relative' }}>
              <div style={{
                width: `${Math.max(percentOfMax, 2)}%`,
                height: '100%',
                background: `linear-gradient(90deg, ${step.color} 0%, rgba(255,255,255,0.1) 100%)`,
                borderRadius: '6px',
                transition: 'width 0.5s ease-in-out'
              }}></div>
            </div>
          </div>
        )
      })}
    </div>
  )
})

// ========================================================================
// 4. HourlyPerformanceAreaChart — แผนภูมิพื้นที่สถิติรายชั่วโมง
// ========================================================================
export const HourlyPerformanceAreaChart = React.memo(function HourlyPerformanceAreaChart() {
  const gradientId = useId()
  const width = 500
  const height = 150
  const hours = Array.from({ length: 12 }, (_, i) => `${i * 2}:00`)
  const mockHourlyValues = [12, 18, 15, 8, 25, 45, 68, 85, 120, 110, 95, 60]
  const maxVal = Math.max(...mockHourlyValues, 1)

  const points = mockHourlyValues.map((val, i) => {
    const x = (i / (mockHourlyValues.length - 1)) * width
    const y = height - (val / maxVal) * height
    return { x, y }
  })

  const pathLine = points.reduce((acc, p, i) => i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, '')
  const pathArea = `${pathLine} L ${width} ${height} L 0 ${height} Z`

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.35"/>
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.02"/>
          </linearGradient>
        </defs>

        <path d={pathArea} fill={`url(#${gradientId})`} />
        <path d={pathLine} fill="none" stroke="#3B82F6" strokeWidth="2.5" />

        {points.map((p, i) => (
          (i % 2 === 0) && (
            <text key={i} x={p.x} y={height + 15} textAnchor="middle" fill="var(--text-muted)" fontSize="8">
              {hours[i]}
            </text>
          )
        ))}
      </svg>
    </div>
  )
})// ========================================================================
// 5. DayOfWeekBarChart — กราฟแท่งแสดงสถิติรายสัปดาห์
// ========================================================================
export const DayOfWeekBarChart = React.memo(function DayOfWeekBarChart({ data }: { data: number[] }) {
  const daysTH = ['จัน', 'อัง', 'พุธ', 'พฤ', 'ศุก', 'ส.', 'อา.']
  const values = data && data.length === 7 ? data : [450, 520, 490, 610, 890, 920, 580]
  const maxVal = Math.max(...values, 1)

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '140px', width: '100%', paddingTop: '10px' }}>
      {values.map((val, idx) => {
        const percent = (val / maxVal) * 100
        return (
          <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 }}>
            <span style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--text-muted)' }}>{Math.round(val)}</span>
            <div style={{ width: '16px', height: '100px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
              <div style={{
                width: '100%',
                height: `${percent}%`,
                background: 'linear-gradient(180deg, #EC4899 0%, #8B5CF6 100%)',
                borderRadius: '4px',
                transition: 'height 0.4s ease-out'
              }}></div>
            </div>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{daysTH[idx]}</span>
          </div>
        )
      })}
    </div>
  )
})
