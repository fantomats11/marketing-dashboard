'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { locales, Language } from '@/lib/locales'
import { useRouter } from 'next/navigation'
import { 
  DualAxisLineChart, 
  BudgetDonutChart, 
  UserJourneyFunnel, 
  HourlyPerformanceAreaChart, 
  DayOfWeekBarChart,
  getPlatformColor,
  formatPlatformName
} from '../ui/custom-charts'
import OfflineTracker from './offline-tracker'
import { 
  saveViewPreferences, 
  addAllowedDomain, 
  deleteAllowedDomain, 
  addTestAdAccount, 
  deleteAdAccount,
  createShareableLink,
  syncAccounts
} from '@/app/actions'

import { AdAccount, AnalyticsItem, OfflineLead } from '@/types'

interface ClientWrapperProps {
  userId: string
  initialPreferences: any
  allowedDomains: any[]
  connectedAccounts: AdAccount[]
  cachedAnalytics: AnalyticsItem[]
  offlineLeads?: OfflineLead[]
  readOnly?: boolean
}

export default function DashboardClientWrapper({
  userId,
  initialPreferences,
  allowedDomains,
  connectedAccounts,
  cachedAnalytics,
  offlineLeads = [],
  readOnly = false
}: ClientWrapperProps) {
  const router = useRouter()

  // --- Tab State ---
  const [activeTab, setActiveTab] = useState<'analytics' | 'offline'>('analytics')

  // --- 1. Global State Management (Localization & Preferences) ---
  const [lang, setLang] = useState<Language>(initialPreferences?.language || 'TH')
  const [dateStart, setDateStart] = useState<string>(initialPreferences?.dateStart || '')
  const [dateEnd, setDateEnd] = useState<string>(initialPreferences?.dateEnd || '')
  const [searchQuery, setSearchQuery] = useState<string>('')
  
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    initialPreferences?.selectedPlatforms || ['facebook-ads', 'google-ads', 'tiktok-ads', 'tiktok-shop']
  )

  // เมตริกเริ่มต้นที่ต้องการแสดงและจัดลำดับความสำคัญ (Prioritized Cards)
  const defaultPriority = ['spend', 'roas', 'cpa', 'ctr', 'conversions', 'clicks']
  const [priorityMetrics, setPriorityMetrics] = useState<string[]>(
    initialPreferences?.priorityMetrics || defaultPriority
  )

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [saveStatus, setSaveStatus] = useState<string>('')

  // --- States for Share Link Modal ---
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [shareSelectedAccounts, setShareSelectedAccounts] = useState<string[]>([])
  const [generatedShareUrl, setGeneratedShareUrl] = useState('')
  const [shareLoading, setShareLoading] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)

  const t = locales[lang]

  // รายชื่อเมตริกทั้งหมดที่มีให้เลือก
  const allAvailableMetrics = [
    { key: 'spend', name: t.spend },
    { key: 'roas', name: t.roas },
    { key: 'cpa', name: t.cpa },
    { key: 'ctr', name: t.ctr },
    { key: 'conversions', name: t.conversions },
    { key: 'clicks', name: t.clicks },
    { key: 'impressions', name: t.impressions },
    { key: 'revenue', name: t.revenue },
    { key: 'cpc', name: t.cpc },
    { key: 'costPerConv', name: t.costPerConv },
  ]

  // --- 2. Filter & Data Normalization Logic (Memoized) ---
  const filteredData = useMemo(() => cachedAnalytics.filter(item => {
    const platform = item.connected_ad_accounts?.platform
    if (platform && !selectedPlatforms.includes(platform)) return false
    if (dateStart && item.metric_date < dateStart) return false
    if (dateEnd && item.metric_date > dateEnd) return false
    if (searchQuery) {
      const campName = (item.dimensions.campaign_name || '').toLowerCase()
      if (!campName.includes(searchQuery.toLowerCase())) return false
    }
    return true
  }), [cachedAnalytics, selectedPlatforms, dateStart, dateEnd, searchQuery])

  // คำนวณผลรวม (Aggregated Metrics) — Memoized
  const aggregated = useMemo(() => {
    let totalSpend = 0, totalClicks = 0, totalImpressions = 0, totalConversions = 0, totalRevenue = 0
    filteredData.forEach(item => {
      totalSpend += Number(item.metrics.spend || 0)
      totalClicks += Number(item.metrics.clicks || 0)
      totalImpressions += Number(item.metrics.impressions || 0)
      totalConversions += Number(item.metrics.conversions || 0)
      totalRevenue += Number(item.metrics.revenue || 0)
    })
    const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) : 0
    const averageCpa = totalConversions > 0 ? (totalSpend / totalConversions) : 0
    const averageRoas = totalSpend > 0 ? (totalRevenue / totalSpend) : 0
    const averageCpc = totalClicks > 0 ? (totalSpend / totalClicks) : 0
    return { totalSpend, totalClicks, totalImpressions, totalConversions, totalRevenue, averageCtr, averageCpa, averageRoas, averageCpc }
  }, [filteredData])

  const { totalSpend, totalClicks, totalImpressions, totalConversions, totalRevenue, averageCtr, averageCpa, averageRoas, averageCpc } = aggregated

  // ข้อมูลสถิติสำหรับการ์ด (Metric Cards Values)
  const metricValuesMap = useMemo<Record<string, { value: string; color: string }>>(() => ({
    spend: { value: `฿${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, color: '#8B5CF6' },
    roas: { value: `${averageRoas.toFixed(2)}x`, color: '#10B981' },
    cpa: { value: `฿${averageCpa.toFixed(2)}`, color: '#EF4444' },
    ctr: { value: `${(averageCtr * 100).toFixed(2)}%`, color: '#3B82F6' },
    conversions: { value: totalConversions.toLocaleString(), color: '#EC4899' },
    clicks: { value: totalClicks.toLocaleString(), color: '#6366F1' },
    impressions: { value: totalImpressions.toLocaleString(), color: '#F59E0B' },
    revenue: { value: `฿${totalRevenue.toLocaleString()}`, color: '#10B981' },
    cpc: { value: `฿${averageCpc.toFixed(2)}`, color: '#06B6D4' },
  }), [totalSpend, totalClicks, totalImpressions, totalConversions, totalRevenue, averageCtr, averageCpa, averageRoas, averageCpc])

  // --- 3. Save Preferences Action ---
  const handleSavePreferences = async () => {
    setSaveStatus('Saving...')
    try {
      await saveViewPreferences(userId, {
        language: lang,
        dateStart,
        dateEnd,
        selectedPlatforms,
        priorityMetrics
      })
      setSaveStatus('Saved!')
      setTimeout(() => setSaveStatus(''), 2000)
    } catch (err) {
      setSaveStatus('Failed')
      setTimeout(() => setSaveStatus(''), 2000)
    }
  }

  // --- 4. Drill-down Table Row Toggle Logic ---
  const toggleRow = (rowId: string) => {
    const newSet = new Set(expandedRows)
    if (newSet.has(rowId)) {
      newSet.delete(rowId)
    } else {
      newSet.add(rowId)
    }
    setExpandedRows(newSet)
  }

  // --- 5. Prepare Chart Datasets ---
  const dailyDataMap = new Map<string, { spend: number; revenue: number }>()
  filteredData.forEach(d => {
    const date = d.metric_date
    const spend = Number(d.metrics.spend || 0)
    const revenue = Number(d.metrics.revenue || 0)
    if (dailyDataMap.has(date)) {
      const existing = dailyDataMap.get(date)!
      existing.spend += spend
      existing.revenue += revenue
    } else {
      dailyDataMap.set(date, { spend, revenue })
    }
  })
  const lineChartData = Array.from(dailyDataMap.entries())
    .map(([date, vals]) => ({
      label: date,
      value1: vals.spend,
      value2: vals.revenue > 0 ? (vals.revenue / (vals.spend || 1)) : 0
    }))
    .sort((a, b) => a.label.localeCompare(b.label))

  const platformSpendMap = new Map<string, number>()
  filteredData.forEach(d => {
    const platform = d.connected_ad_accounts?.platform || 'unknown'
    const spend = Number(d.metrics.spend || 0)
    platformSpendMap.set(platform, (platformSpendMap.get(platform) || 0) + spend)
  })
  const donutChartData = Array.from(platformSpendMap.entries()).map(([name, value]) => ({
    name: name.replace('-ads', '').toUpperCase(),
    value
  }))

  // คำนวณยอดเงินตามวันในสัปดาห์ (Day of Week spend) แบบไดนามิก
  const dayOfWeekSpend = useMemo(() => {
    const spendArr = [0, 0, 0, 0, 0, 0, 0] // 0 = จันทร์, ..., 6 = อาทิตย์
    filteredData.forEach(item => {
      if (!item.metric_date) return
      const date = new Date(item.metric_date)
      const day = date.getDay() // 0 = Sunday, 1 = Monday, ...
      const idx = day === 0 ? 6 : day - 1
      spendArr[idx] += Number(item.metrics.spend || 0)
    })
    // ถ้าไม่มีข้อมูลค่าใช้จ่ายจริงเลย ให้ใช้ mock values เป็น fallback
    if (spendArr.every(v => v === 0)) {
      return [450, 520, 490, 610, 890, 920, 580]
    }
    return spendArr
  }, [filteredData])

  // --- 6. Hierarchical Data Grouping (Campaign -> Targeting -> Ad) ---
  interface AdNode {
    id: string
    name: string
    creativeUrl?: string
    spend: number
    clicks: number
    conversions: number
    ctr: number
    cpa: number
  }

  interface TargetNode {
    id: string
    targetingSpec: string
    spend: number
    clicks: number
    conversions: number
    ads: AdNode[]
  }

  interface CampaignNode {
    id: string
    name: string
    platform: string
    status: string
    spend: number
    clicks: number
    conversions: number
    targets: TargetNode[]
  }

  const campaignNodesMap = new Map<string, CampaignNode>()

  filteredData.forEach(item => {
    const platform = item.connected_ad_accounts?.platform || 'unknown'
    const cId = item.dimensions.campaign_id || 'unknown'
    const cName = item.dimensions.campaign_name || 'Unnamed Campaign'
    const status = item.dimensions.status || 'ACTIVE'

    const targeting = item.dimensions.targeting || {}
    const targetSpec = targeting.locations ? `Loc: ${targeting.locations.join(', ')} | Ages: ${targeting.ageRanges?.join(', ') || 'All'}` : 'Broad Target'
    const targetId = `${cId}-${targetSpec}`

    const adId = item.dimensions.ad_id || 'unknown'
    const adName = item.dimensions.ad_name || 'Unnamed Ad'
    const creativeUrl = item.dimensions.creative_url || undefined

    const spend = Number(item.metrics.spend || 0)
    const clicks = Number(item.metrics.clicks || 0)
    const conversions = Number(item.metrics.conversions || 0)

    const impressions = Number(item.metrics.impressions || 0)
    const adNode: AdNode = {
      id: adId,
      name: adName,
      creativeUrl,
      spend,
      clicks,
      conversions,
      ctr: impressions > 0 ? (clicks / impressions) : 0,
      cpa: conversions > 0 ? (spend / conversions) : 0
    }

    if (campaignNodesMap.has(cId)) {
      const cNode = campaignNodesMap.get(cId)!
      cNode.spend += spend
      cNode.clicks += clicks
      cNode.conversions += conversions

      const tIdx = cNode.targets.findIndex(t => t.id === targetId)
      if (tIdx > -1) {
        const tNode = cNode.targets[tIdx]
        tNode.spend += spend
        tNode.clicks += clicks
        tNode.conversions += conversions
        tNode.ads.push(adNode)
      } else {
        cNode.targets.push({
          id: targetId,
          targetingSpec: targetSpec,
          spend,
          clicks,
          conversions,
          ads: [adNode]
        })
      }
    } else {
      campaignNodesMap.set(cId, {
        id: cId,
        name: cName,
        platform,
        status,
        spend,
        clicks,
        conversions,
        targets: [
          {
            id: targetId,
            targetingSpec: targetSpec,
            spend,
            clicks,
            conversions,
            ads: [adNode]
          }
        ]
      })
    }
  })

  const campaigns = Array.from(campaignNodesMap.values()).sort((a, b) => b.spend - a.spend)

  const handlePlatformToggle = (platform: string) => {
    if (selectedPlatforms.includes(platform)) {
      if (selectedPlatforms.length > 1) {
        setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform))
      }
    } else {
      setSelectedPlatforms([...selectedPlatforms, platform])
    }
  }

  const handleTogglePriority = (key: string) => {
    if (priorityMetrics.includes(key)) {
      if (priorityMetrics.length > 3) {
        setPriorityMetrics(priorityMetrics.filter(m => m !== key))
      }
    } else {
      setPriorityMetrics([...priorityMetrics, key])
    }
  }

  const handlePrintPdf = () => {
    window.print()
  }

  // --- 7. Secure Share URL Generator ---
  const handleToggleShareAccount = (accId: string) => {
    if (shareSelectedAccounts.includes(accId)) {
      setShareSelectedAccounts(shareSelectedAccounts.filter(id => id !== accId))
    } else {
      setShareSelectedAccounts([...shareSelectedAccounts, accId])
    }
  }

  const handleGenerateShareLink = async () => {
    if (shareSelectedAccounts.length === 0) return
    setShareLoading(true)
    setGeneratedShareUrl('')
    try {
      const token = await createShareableLink(userId, shareSelectedAccounts)
      const url = `${window.location.origin}/share/${token}`
      setGeneratedShareUrl(url)
    } catch (err) {
      console.error('Error generating share link:', err)
    } finally {
      setShareLoading(false)
    }
  }

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generatedShareUrl)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch {
      // Fallback: สร้าง textarea ชั่วคราวสำหรับ copy
      const ta = document.createElement('textarea')
      ta.value = generatedShareUrl
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    }
  }, [generatedShareUrl])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      
      {/* 1. Global Controls Header */}
      <header className="glass-card" style={{
        margin: '20px 20px 10px 20px',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 className="gradient-text" style={{ fontSize: '20px', fontWeight: '800' }}>
            {t.dashboardTitle}
          </h1>
          
          {/* Tab Switcher (Only when NOT readOnly) */}
          {!readOnly && (
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.25)', padding: '3px', borderRadius: '8px' }}>
              <button 
                onClick={() => setActiveTab('analytics')}
                style={{
                  padding: '6px 12px', borderRadius: '6px', border: 'none', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer',
                  background: activeTab === 'analytics' ? 'var(--primary)' : 'transparent',
                  color: activeTab === 'analytics' ? 'white' : 'var(--text-muted)'
                }}
              >📊 {lang === 'TH' ? 'แดชบอร์ดหลัก' : 'Dashboard'}</button>
              <button 
                onClick={() => setActiveTab('offline')}
                style={{
                  padding: '6px 12px', borderRadius: '6px', border: 'none', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer',
                  background: activeTab === 'offline' ? 'var(--primary)' : 'transparent',
                  color: activeTab === 'offline' ? 'white' : 'var(--text-muted)'
                }}
              >🏠 {lang === 'TH' ? 'โมดูลออฟไลน์ & CRM' : 'Offline CRM'}</button>
            </div>
          )}

          {readOnly ? (
            <span className="badge" style={{ fontSize: '11px', background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.1)' }}>
              👁️ {t.preview} (Read-only)
            </span>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* EN/TH Language Toggle */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '3px', borderRadius: '8px' }}>
            <button 
              onClick={() => setLang('TH')}
              style={{
                padding: '6px 12px', borderRadius: '6px', border: 'none', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer',
                background: lang === 'TH' ? 'var(--primary)' : 'transparent',
                color: lang === 'TH' ? 'white' : 'var(--text-muted)'
              }}
            >TH</button>
            <button 
              onClick={() => setLang('EN')}
              style={{
                padding: '6px 12px', borderRadius: '6px', border: 'none', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer',
                background: lang === 'EN' ? 'var(--primary)' : 'transparent',
                color: lang === 'EN' ? 'white' : 'var(--text-muted)'
              }}
            >EN</button>
          </div>

          {!readOnly && (
            <>
              <button onClick={handleSavePreferences} className="btn-primary" style={{ width: 'auto', padding: '8px 16px', fontSize: '13px' }}>
                💾 {saveStatus || t.savePreferences}
              </button>
              
              <button onClick={() => {
                setShareSelectedAccounts(connectedAccounts.map(a => a.id))
                setGeneratedShareUrl('')
                setIsShareModalOpen(true)
              }} className="btn-primary" style={{ width: 'auto', padding: '8px 16px', fontSize: '13px', background: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)' }}>
                🔗 แชร์ลิงก์
              </button>
            </>
          )}

          <button onClick={handlePrintPdf} className="btn-secondary" style={{ width: 'auto', padding: '8px 16px', fontSize: '13px' }}>
            📄 {t.exportPdf}
          </button>
        </div>
      </header>

      {/* Main Tab Render */}
      {activeTab === 'offline' && !readOnly ? (
        <div style={{ padding: '0 20px 20px 20px', flex: 1, display: 'flex' }}>
          <OfflineTracker userId={userId} offlineLeads={offlineLeads} onRefresh={() => router.refresh()} />
        </div>
      ) : (
        /* 2. Main Grid Layout for Analytics Dashboard */
        <main className="container" style={{
          flex: 1,
          width: '100%',
          maxWidth: '100%',
          padding: '10px 20px 20px 20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gap: '20px'
        }}>
          
          {/* Left Side Settings (Only rendered when NOT readOnly) */}
          {!readOnly && (
            <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Sync controls */}
              <section className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '700' }}>{t.syncControl}</h2>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  {t.syncDesc}
                </p>
                <form action={syncAccounts}>
                  <button type="submit" className="btn-primary" style={{ width: '100%', padding: '12px', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <span>⚡</span> {t.syncNow}
                  </button>
                </form>
                <a href="/api/cron/sync?manual=true" target="_blank" className="btn-secondary" style={{ display: 'block', textAlign: 'center', padding: '10px', fontSize: '12px', textDecoration: 'none' }}>
                  🌐 {t.openCronApi}
                </a>
              </section>

              {/* Ad Accounts list */}
              <section className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h2 style={{ fontSize: '16px', fontWeight: '700' }}>{t.adAccounts} ({connectedAccounts.length})</h2>
                  <form action={addTestAdAccount.bind(null, userId)}>
                    <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '6px 12px', fontSize: '11px' }}>
                      {t.addTestAccount}
                    </button>
                  </form>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto' }}>
                  {connectedAccounts.length === 0 ? (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '15px' }}>
                      ยังไม่มีการเชื่อมต่อบัญชีโฆษณา
                    </p>
                  ) : (
                    connectedAccounts.map((acc) => (
                      <div key={acc.id} style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        padding: '10px',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="badge" style={{ 
                            fontSize: '9px', 
                            background: acc.platform === 'google-ads' ? '#EAB308' : acc.platform === 'facebook-ads' ? '#2563EB' : acc.platform === 'tiktok-ads' ? '#10B981' : '#EC4899', 
                            color: 'white',
                            padding: '2px 6px'
                          }}>
                            {acc.platform.replace('-ads', '').toUpperCase()}
                          </span>
                          <form action={deleteAdAccount.bind(null, acc.id)}>
                            <button type="submit" style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '11px' }}>
                              ลบ
                            </button>
                          </form>
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: '600' }}>{acc.account_name}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>ID: {acc.account_id}</div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              {/* Allowed Domains management */}
              <section className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: '700' }}>{t.domainSecurity}</h2>
                <form action={addAllowedDomain} style={{ display: 'flex', gap: '6px' }}>
                  <input name="domain" type="text" placeholder={t.domainInputPlaceholder} required className="input-field" style={{ padding: '8px 12px', fontSize: '13px' }} />
                  <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '8px 12px', fontSize: '13px', whiteSpace: 'nowrap' }}>{t.add}</button>
                </form>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '150px', overflowY: 'auto' }}>
                  {allowedDomains.map((d: any) => (
                    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.02)', padding: '6px 10px', borderRadius: '6px', fontSize: '12px' }}>
                      <span>{d.domain}</span>
                      <form action={deleteAllowedDomain.bind(null, d.id)}>
                        <button type="submit" style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '11px' }}>ลบ</button>
                      </form>
                  </div>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* Right Side Dashboard View (Takes full 12 columns if readOnly) */}
          <div style={{ gridColumn: readOnly ? 'span 12' : 'span 8', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Global Filter Toolbar */}
            <section className="glass-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
                {/* Platform Switcher */}
                <div style={{ display: 'flex', background: 'rgba(0, 0, 0, 0.2)', padding: '4px', borderRadius: '8px', gap: '4px' }}>
                  {['facebook-ads', 'google-ads', 'tiktok-ads', 'tiktok-shop'].map((platform) => {
                    const isActive = selectedPlatforms.includes(platform)
                    return (
                      <button
                        key={platform}
                        onClick={() => handlePlatformToggle(platform)}
                        style={{
                          padding: '6px 12px', borderRadius: '6px', border: 'none', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer',
                          background: isActive ? 'var(--primary)' : 'transparent',
                          color: isActive ? 'white' : 'var(--text-muted)'
                        }}
                      >
                        {platform.replace('-ads', '').toUpperCase()}
                      </button>
                    )
                  })}
                </div>

                {/* Date Ranges Picker */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input 
                    type="date" 
                    value={dateStart} 
                    onChange={(e) => setDateStart(e.target.value)} 
                    className="input-field" 
                    style={{ width: 'auto', padding: '6px 10px', fontSize: '11px' }} 
                  />
                  <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>to</span>
                  <input 
                    type="date" 
                    value={dateEnd} 
                    onChange={(e) => setDateEnd(e.target.value)} 
                    className="input-field" 
                    style={{ width: 'auto', padding: '6px 10px', fontSize: '11px' }} 
                  />
                </div>
              </div>

              {/* Campaign Search Filter & Customizer Checkboxes */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder={t.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field"
                  style={{ flex: 1, minWidth: '200px', padding: '8px 12px', fontSize: '12px' }}
                />

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{lang === 'TH' ? 'ปรับสถิติหลัก:' : 'Metrics:'}</span>
                  {allAvailableMetrics.map(m => {
                    const isActive = priorityMetrics.includes(m.key)
                    return (
                      <button
                        key={m.key}
                        onClick={() => handleTogglePriority(m.key)}
                        style={{
                          padding: '2px 8px', borderRadius: '9999px', border: '1px solid', fontSize: '10px', cursor: 'pointer',
                          borderColor: isActive ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
                          background: isActive ? 'rgba(139,92,246,0.1)' : 'transparent',
                          color: isActive ? 'white' : 'var(--text-muted)'
                        }}
                      >
                        {m.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            </section>

            {/* Customizable Metric Cards Grid */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
              gap: '15px' 
            }}>
              {priorityMetrics.map((key) => {
                const matched = allAvailableMetrics.find(m => m.key === key)
                if (!matched) return null
                const item = metricValuesMap[key]
                return (
                  <div key={key} className="glass-card" style={{ padding: '16px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: item.color }}></div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600' }}>{matched.name}</div>
                    <div style={{ fontSize: '20px', fontWeight: '800', marginTop: '6px', color: 'white' }}>{item.value}</div>
                  </div>
                )
              })}
            </div>

            {/* SVG Visualizations Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '20px' }}>
              <div className="glass-card" style={{ gridColumn: 'span 8', padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '14px' }}>{t.dailyCompare}</h3>
                <DualAxisLineChart data={lineChartData} label1={t.spend} label2={t.roas} />
              </div>

              <div className="glass-card" style={{ gridColumn: 'span 4', padding: '20px', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '14px' }}>{t.budgetBreakdown}</h3>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                  <BudgetDonutChart data={donutChartData} />
                </div>
              </div>

              <div className="glass-card" style={{ gridColumn: 'span 4', padding: '20px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', marginBottom: '14px' }}>{t.funnelTitle}</h3>
                <UserJourneyFunnel data={{
                  impressions: totalImpressions,
                  clicks: totalClicks,
                  conversions: totalConversions
                }} />
              </div>

              <div className="glass-card" style={{ gridColumn: 'span 8', padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '10px' }}>{t.hourlyPerformance}</h4>
                  <HourlyPerformanceAreaChart />
                </div>
                <div>
                  <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '10px' }}>{t.dayOfWeek}</h4>
                  <DayOfWeekBarChart data={dayOfWeekSpend} />
                </div>
              </div>
            </div>

            {/* Hierarchical Drill-down Data Table */}
            <section className="glass-card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '14px' }}>
                {lang === 'TH' ? 'เจาะลึกผลลัพธ์รายโครงสร้าง' : 'Deep Drill-Down Results'}
              </h3>

              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '10px 6px' }}>{t.campaign} / {t.targeting} / {t.adContent}</th>
                      <th style={{ padding: '10px 6px' }}>{t.status}</th>
                      <th style={{ padding: '10px 6px', textAlign: 'right' }}>{t.spend}</th>
                      <th style={{ padding: '10px 6px', textAlign: 'right' }}>{t.clicks} (CTR)</th>
                      <th style={{ padding: '10px 6px', textAlign: 'right' }}>{t.conversions} (CPA)</th>
                      <th style={{ padding: '10px 6px', textAlign: 'right' }}>ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaigns.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '25px', color: 'var(--text-muted)' }}>
                          {t.emptyAnalytics}
                        </td>
                      </tr>
                    ) : (
                      campaigns.map(camp => {
                        const isCampExpanded = expandedRows.has(camp.id)
                        const campRoas = averageRoas

                        return (
                          <React.Fragment key={camp.id}>
                            {/* Campaign Level */}
                            <tr 
                              onClick={() => toggleRow(camp.id)}
                              style={{ 
                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                                cursor: 'pointer',
                                background: isCampExpanded ? 'rgba(139, 92, 246, 0.05)' : 'transparent',
                              }}
                            >
                              <td style={{ padding: '12px 6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ transform: isCampExpanded ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', fontSize: '9px', transition: 'transform 0.2s' }}>▶</span>
                                <span className="badge" style={{ 
                                  fontSize: '8px', 
                                  background: camp.platform === 'google-ads' ? '#EAB308' : camp.platform === 'facebook-ads' ? '#2563EB' : '#10B981',
                                  color: 'white',
                                  padding: '1px 5px',
                                  borderRadius: '4px'
                                }}>
                                  {camp.platform.replace('-ads', '').toUpperCase()}
                                </span>
                                <strong>{camp.name}</strong>
                              </td>
                              <td style={{ padding: '12px 6px' }}>
                                {camp.status === 'ACTIVE' ? (
                                  <span className="badge badge-success" style={{ fontSize: '10px' }}>{t.active}</span>
                                ) : (
                                  <span className="badge badge-danger" style={{ fontSize: '10px', background: 'rgba(255,255,255,0.1)', color: 'var(--text-muted)', border: 'none' }}>{t.inactive}</span>
                                )}
                              </td>
                              <td style={{ padding: '12px 6px', textAlign: 'right' }}>${camp.spend.toLocaleString()}</td>
                              <td style={{ padding: '12px 6px', textAlign: 'right' }}>{camp.clicks.toLocaleString()}</td>
                              <td style={{ padding: '12px 6px', textAlign: 'right' }}>{camp.conversions.toLocaleString()}</td>
                              <td style={{ padding: '12px 6px', textAlign: 'right', fontWeight: 'bold' }}>{campRoas > 0 ? `${campRoas.toFixed(1)}x` : '-'}</td>
                            </tr>

                            {/* Target Level */}
                            {isCampExpanded && camp.targets.map(target => {
                              const isTargetExpanded = expandedRows.has(target.id)

                              return (
                                <React.Fragment key={target.id}>
                                  <tr 
                                    onClick={() => toggleRow(target.id)}
                                    style={{ 
                                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                                      cursor: 'pointer',
                                      background: 'rgba(255,255,255,0.01)'
                                    }}
                                  >
                                    <td style={{ padding: '8px 6px 8px 30px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ transform: isTargetExpanded ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', fontSize: '8px', transition: 'transform 0.2s' }}>▶</span>
                                      <span style={{ color: '#8B5CF6' }}>🎯</span>
                                      <span style={{ fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '12px' }}>{target.targetingSpec}</span>
                                    </td>
                                    <td style={{ padding: '8px 6px' }}>-</td>
                                    <td style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--text-muted)' }}>${target.spend.toLocaleString()}</td>
                                    <td style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--text-muted)' }}>{target.clicks.toLocaleString()}</td>
                                    <td style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--text-muted)' }}>{target.conversions.toLocaleString()}</td>
                                    <td style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--text-muted)' }}>-</td>
                                  </tr>

                                  {/* Ad Level */}
                                  {isTargetExpanded && target.ads.map(ad => (
                                    <tr 
                                      key={ad.id} 
                                      style={{ 
                                        borderBottom: '1px solid rgba(255,255,255,0.02)',
                                        background: 'rgba(0, 0, 0, 0.15)'
                                      }}
                                    >
                                      <td style={{ padding: '6px 6px 6px 60px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {ad.creativeUrl ? (
                                          <img src={ad.creativeUrl} alt="creative" style={{ width: '24px', height: '24px', objectFit: 'cover', borderRadius: '4px' }} />
                                        ) : (
                                          <span>🖼️</span>
                                        )}
                                        <span style={{ fontSize: '12px' }}>{ad.name}</span>
                                      </td>
                                      <td style={{ padding: '6px 6px', fontSize: '11px', color: 'var(--text-muted)' }}>ID: {ad.id}</td>
                                      <td style={{ padding: '6px 6px', textAlign: 'right', fontSize: '12px' }}>${ad.spend.toLocaleString()}</td>
                                      <td style={{ padding: '6px 6px', textAlign: 'right', fontSize: '12px' }}>
                                        {ad.clicks.toLocaleString()} <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({(ad.ctr * 100).toFixed(1)}%)</span>
                                      </td>
                                      <td style={{ padding: '6px 6px', textAlign: 'right', fontSize: '12px' }}>
                                        {ad.conversions.toLocaleString()} <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>(${ad.cpa.toFixed(1)})</span>
                                      </td>
                                      <td style={{ padding: '6px 6px', textAlign: 'right' }}>-</td>
                                    </tr>
                                  ))}
                                </React.Fragment>
                              )
                            })}
                          </React.Fragment>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '16px' }}>
                <span>{t.historicalDataNotice}</span>
                <span>{t.lastUpdated}: {cachedAnalytics.length > 0 ? new Date(cachedAnalytics[0].updated_at).toLocaleTimeString() : 'N/A'}</span>
              </div>
            </section>
          </div>
        </main>
      )}

      {/* --- 8. Secure Share Modal Overlay --- */}
      {isShareModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div className="glass-card" style={{
            width: '100%', maxWidth: '480px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800' }}>🔗 สร้างลิงก์แชร์ภายนอก (Share Preview URL)</h3>
              <button onClick={() => setIsShareModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'white', fontSize: '18px', cursor: 'pointer' }}>×</button>
            </div>
            
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              เลือกบัญชีโฆษณาที่อนุญาตให้บุคคลภายนอก/ลูกค้าสามารถดูได้ ระบบจะเข้ารหัสโทเค็นความปลอดภัยและเปิดสิทธิ์ในโหมดอ่านอย่างเดียว (Read-only) โดยอัตโนมัติ
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '160px', overflowY: 'auto', background: 'rgba(0,0,0,0.15)', padding: '10px', borderRadius: '8px' }}>
              {connectedAccounts.map(acc => {
                const isSelected = shareSelectedAccounts.includes(acc.id)
                return (
                  <label key={acc.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px', cursor: 'pointer', padding: '4px 0' }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleShareAccount(acc.id)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>{acc.account_name} ({acc.platform.replace('-ads','').toUpperCase()})</span>
                  </label>
                )
              })}
            </div>

            <button
              onClick={handleGenerateShareLink}
              disabled={shareSelectedAccounts.length === 0 || shareLoading}
              className="btn-primary"
              style={{
                background: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)',
                opacity: shareSelectedAccounts.length === 0 || shareLoading ? 0.6 : 1
              }}
            >
              {shareLoading ? 'Generating...' : 'สร้างลิงก์และโทเค็นข้อมูลปลอดภัย'}
            </button>

            {generatedShareUrl && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                <span style={{ fontSize: '11px', color: '#10B981', fontWeight: 'bold' }}>✓ เจนเนอเรทลิงก์สิทธิ์แชร์เรียบร้อย (มีอายุใช้งาน 7 วัน):</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    readOnly
                    value={generatedShareUrl}
                    className="input-field"
                    style={{ flex: 1, padding: '8px 12px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}
                  />
                  <button onClick={handleCopyLink} className="btn-secondary" style={{ width: 'auto', fontSize: '11px', whiteSpace: 'nowrap' }}>
                    {copySuccess ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Print custom styles */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          header, section:nth-of-type(1), form, .btn-primary, .btn-secondary, button {
            display: none !important;
          }
          .glass-card {
            background: none !important;
            border: none !important;
            box-shadow: none !important;
            backdrop-filter: none !important;
            color: black !important;
            padding: 10px !important;
            margin: 0 !important;
          }
          text {
            fill: black !important;
          }
          path, circle {
            stroke-width: 2.5 !important;
          }
          svg {
            filter: brightness(0) saturate(100%) invert(0%) !important;
          }
          table {
            color: black !important;
          }
          tr {
            border-bottom: 1px solid #ccc !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  )
}
