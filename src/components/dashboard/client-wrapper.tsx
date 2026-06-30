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
import { logout } from '@/app/login/actions'
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

  // --- Sidebar Active Tab ---
  const [sidebarTab, setSidebarTab] = useState<'home' | 'report' | 'sources' | 'support' | 'user'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tabParam = params.get('tab')
      if (tabParam === 'sources' || tabParam === 'home' || tabParam === 'report' || tabParam === 'support' || tabParam === 'user') {
        return tabParam as any
      }
    }
    return 'report'
  })

  // --- Sub-Tab State inside Customer Report ---
  const [activeTab, setActiveTab] = useState<'analytics' | 'offline'>('analytics')

  // --- Global State Management (Localization & Preferences) ---
  const [lang, setLang] = useState<Language>(initialPreferences?.language || 'TH')
  const [dateStart, setDateStart] = useState<string>(initialPreferences?.dateStart || '')
  const [dateEnd, setDateEnd] = useState<string>(initialPreferences?.dateEnd || '')
  const [searchQuery, setSearchQuery] = useState<string>('')
  
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    initialPreferences?.selectedPlatforms || ['facebook-ads', 'google-ads', 'tiktok-ads', 'tiktok-shop']
  )

  const defaultPriority = ['spend', 'impressions', 'reach', 'clicks', 'conversions', 'roas', 'ctr', 'cpa']
  const [priorityMetrics, setPriorityMetrics] = useState<string[]>(
    initialPreferences?.priorityMetrics || defaultPriority
  )

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [saveStatus, setSaveStatus] = useState<string>('')

  // --- States for Loading UX ---
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null)
  const [isAddingDomain, setIsAddingDomain] = useState(false)
  const [deletingDomainId, setDeletingDomainId] = useState<string | null>(null)

  // --- States for Share Link Modal ---
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [shareSelectedAccounts, setShareSelectedAccounts] = useState<string[]>([])
  const [generatedShareUrl, setGeneratedShareUrl] = useState('')
  const [shareLoading, setShareLoading] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)

  const t = locales[lang]

  const allAvailableMetrics = [
    { key: 'spend', name: t.spend },
    { key: 'impressions', name: t.impressions },
    { key: 'reach', name: t.reach },
    { key: 'clicks', name: t.clicks },
    { key: 'conversions', name: t.conversions },
    { key: 'roas', name: t.roas },
    { key: 'ctr', name: t.ctr },
    { key: 'cpa', name: t.cpa },
    { key: 'revenue', name: t.revenue },
    { key: 'cpc', name: t.cpc },
  ]

  // --- Filter & Data Normalization Logic (Memoized) ---
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
    let totalSpend = 0, totalClicks = 0, totalImpressions = 0, totalConversions = 0, totalRevenue = 0, totalReach = 0
    filteredData.forEach(item => {
      totalSpend += Number(item.metrics.spend || 0)
      totalClicks += Number(item.metrics.clicks || 0)
      totalImpressions += Number(item.metrics.impressions || 0)
      totalConversions += Number(item.metrics.conversions || 0)
      totalRevenue += Number(item.metrics.revenue || 0)
      totalReach += Number(item.metrics.reach || 0)
    })
    const averageCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) : 0
    const averageCpa = totalConversions > 0 ? (totalSpend / totalConversions) : 0
    const averageRoas = totalSpend > 0 ? (totalRevenue / totalSpend) : 0
    const averageCpc = totalClicks > 0 ? (totalSpend / totalClicks) : 0
    return { totalSpend, totalClicks, totalImpressions, totalConversions, totalRevenue, totalReach, averageCtr, averageCpa, averageRoas, averageCpc }
  }, [filteredData])

  const { totalSpend, totalClicks, totalImpressions, totalConversions, totalRevenue, totalReach, averageCtr, averageCpa, averageRoas, averageCpc } = aggregated

  const metricValuesMap = useMemo<Record<string, { value: string; color: string }>>(() => ({
    spend: { value: `฿${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, color: '#8B5CF6' },
    impressions: { value: totalImpressions.toLocaleString(), color: '#F59E0B' },
    reach: { value: totalReach.toLocaleString(), color: '#10B981' },
    clicks: { value: totalClicks.toLocaleString(), color: '#6366F1' },
    conversions: { value: totalConversions.toLocaleString(), color: '#EC4899' },
    roas: { value: `${averageRoas.toFixed(2)}x`, color: '#10B981' },
    ctr: { value: `${(averageCtr * 100).toFixed(2)}%`, color: '#3B82F6' },
    cpa: { value: `฿${averageCpa.toFixed(2)}`, color: '#EF4444' },
    revenue: { value: `฿${totalRevenue.toLocaleString()}`, color: '#10B981' },
    cpc: { value: `฿${averageCpc.toFixed(2)}`, color: '#06B6D4' },
  }), [totalSpend, totalClicks, totalImpressions, totalConversions, totalRevenue, totalReach, averageCtr, averageCpa, averageRoas, averageCpc])

  const marketingSummaryText = useMemo(() => {
    if (filteredData.length === 0) {
      return lang === 'TH' ? 'ไม่พบข้อมูลแคมเปญในช่วงเวลาที่เลือก' : 'No campaign data found for the selected period.'
    }

    const reachVal = totalReach.toLocaleString()
    const impressionsVal = totalImpressions.toLocaleString()
    const clicksVal = totalClicks.toLocaleString()
    const convsVal = totalConversions.toLocaleString()
    const spendVal = totalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })
    const cpaVal = averageCpa.toFixed(2)
    const ctrVal = (averageCtr * 100).toFixed(2)
    const roasVal = averageRoas.toFixed(2)

    if (lang === 'TH') {
      return `ในช่วงเวลาที่เลือก โฆษณาของคุณใช้งบไปทั้งหมด ฿${spendVal} โดยมียอดแสดงผล (Impressions) ทั้งหมด ${impressionsVal} ครั้ง และเข้าถึงลูกค้ากลุ่มเป้าหมายที่ไม่ซ้ำกัน (Reach) จำนวน ${reachVal} คน มีการคลิกเข้าชมโฆษณา ${clicksVal} ครั้ง คิดเป็นอัตราคลิกต่อการเห็น (CTR) อยู่ที่ ${ctrVal}% ซึ่งส่งผลลัพธ์เป็นผู้สนใจหรือผู้ทักแชท (Conversions) จำนวนทั้งสิ้น ${convsVal} ราย โดยมีค่าโฆษณาเฉลี่ยต่อผู้สนใจใหม่ (CPA) อยู่ที่ ฿${cpaVal} ต่อราย และสามารถสร้างผลตอบแทนการลงทุนโฆษณา (ROAS) คิดเป็นอัตราส่วน ${roasVal} เท่าของงบที่เสียไป`
    } else {
      return `During this selected period, your campaigns spent ฿${spendVal} in total. The ads achieved ${impressionsVal} impressions, reaching ${reachVal} unique users (Reach). This led to ${clicksVal} clicks, yielding an average click-through rate (CTR) of ${ctrVal}%, resulting in ${convsVal} conversions (leads/messages). The cost per acquisition (CPA) averaged ฿${cpaVal} per conversion, delivering a return on ad spend (ROAS) of ${roasVal}x.`
    }
  }, [filteredData, totalReach, totalImpressions, totalClicks, totalConversions, totalSpend, averageCpa, averageCtr, averageRoas, lang])

  // --- Save Preferences ---
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
    } catch {
      setSaveStatus('Failed')
      setTimeout(() => setSaveStatus(''), 2000)
    }
  }

  const handleDomainAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const domainVal = formData.get('domain') as string
    if (!domainVal) return

    setIsAddingDomain(true)
    try {
      await addAllowedDomain(formData)
      e.currentTarget.reset()
      router.refresh()
    } catch {
      alert('Failed to add domain')
    } finally {
      setIsAddingDomain(false)
    }
  }

  const handleDomainDelete = async (domainId: string) => {
    if (confirm(lang === 'TH' ? 'คุณแน่ใจหรือไม่ว่าต้องการลบโดเมนนี้?' : 'Are you sure you want to delete this domain?')) {
      setDeletingDomainId(domainId)
      try {
        await deleteAllowedDomain(domainId)
        router.refresh()
      } catch {
        alert('Failed to delete domain')
      } finally {
        setDeletingDomainId(null)
      }
    }
  }

  const handleSyncAccounts = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSyncing(true)
    setSyncMessage(lang === 'TH' ? 'กำลังดึงข้อมูลแคมเปญจริงทาง API... (กรุณารอ 5-10 วินาที)' : 'Fetching actual campaign stats via APIs... (Please wait 5-10s)')
    try {
      await syncAccounts()
      setSyncMessage(lang === 'TH' ? 'ซิงก์ข้อมูลบัญชีสำเร็จเรียบร้อย!' : 'Successfully synced campaign data!')
      router.refresh()
    } catch {
      setSyncMessage(lang === 'TH' ? 'เกิดข้อผิดพลาดในการเชื่อมต่อดึงข้อมูล' : 'Failed to synchronize data')
    } finally {
      setIsSyncing(false)
      setTimeout(() => setSyncMessage(''), 4000)
    }
  }

  const handleDeleteAdAccount = async (accId: string, accName: string) => {
    if (confirm(lang === 'TH' ? `คุณแน่ใจหรือไม่ว่าต้องการยกเลิกการเชื่อมต่อบัญชี ${accName}?` : `Are you sure you want to disconnect ${accName}?`)) {
      setDeletingAccountId(accId)
      try {
        await deleteAdAccount(accId)
        router.refresh()
      } catch {
        alert('Failed to disconnect account')
      } finally {
        setDeletingAccountId(null)
      }
    }
  }

  const handleConnectPlatform = (platform: string) => {
    const origin = window.location.origin
    
    if (platform === 'google-ads') {
      const clientId = "606936106469-lt91qnbglt5pfrt6l8oevik7mgh3v7o6.apps.googleusercontent.com"
      const redirectUri = encodeURIComponent(`${origin}/api/auth/google/callback`)
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fadwords&access_type=offline&prompt=consent`
    } 
    else if (platform === 'facebook-ads') {
      let appId = process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || ""
      if (!appId) {
        appId = prompt(lang === 'TH' ? 'กรุณากรอก Facebook App ID ของคุณ:' : 'Please enter your Facebook App ID:') || ''
      }
      if (!appId) return
      
      const redirectUri = encodeURIComponent(`${origin}/api/auth/facebook/callback`)
      window.location.href = `https://www.facebook.com/v25.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=ads_read,business_management`
    }
    else if (platform === 'tiktok-ads') {
      const appId = "7651553209164496897"
      const redirectUri = encodeURIComponent(`${origin}/tiktok/oauth/callback`)
      window.location.href = `https://business-api.tiktok.com/portal/auth?app_id=${appId}&state=tiktok_auth_state&redirect_uri=${redirectUri}`
    }
    else if (platform === 'tiktok-shop') {
      const clientKey = "7651553209164496897"
      const redirectUri = encodeURIComponent(`${origin}/tiktok/account-holder/callback`)
      window.location.href = `https://www.tiktok.com/v2/auth/authorize?client_key=${clientKey}&scope=user.info.basic,user.info.username,user.info.stats,user.info.profile,user.account.type,user.insights,video.list,video.insights,comment.list,comment.list.manage,video.publish,video.upload,biz.spark.auth,discovery.search.words&response_type=code&redirect_uri=${redirectUri}&state=tiktok_creator_state`
    }
  }

  // --- Drill-down Table Row Toggle ---
  const toggleRow = (rowId: string) => {
    const newSet = new Set(expandedRows)
    if (newSet.has(rowId)) {
      newSet.delete(rowId)
    } else {
      newSet.add(rowId)
    }
    setExpandedRows(newSet)
  }

  // --- Prepare Chart Datasets ---
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

  const dayOfWeekSpend = useMemo(() => {
    const spendArr = [0, 0, 0, 0, 0, 0, 0]
    filteredData.forEach(item => {
      if (!item.metric_date) return
      const date = new Date(item.metric_date)
      const day = date.getDay()
      const idx = day === 0 ? 6 : day - 1
      spendArr[idx] += Number(item.metrics.spend || 0)
    })
    if (spendArr.every(v => v === 0)) {
      return [450, 520, 490, 610, 890, 920, 580]
    }
    return spendArr
  }, [filteredData])

  // --- Grouping (Campaign -> Target -> Ad) ---
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
    impressions: number
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
    impressions: number
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
      cNode.impressions += impressions

      const tIdx = cNode.targets.findIndex(t => t.id === targetId)
      if (tIdx > -1) {
        const tNode = cNode.targets[tIdx]
        tNode.spend += spend
        tNode.clicks += clicks
        tNode.conversions += conversions
        tNode.impressions += impressions
        tNode.ads.push(adNode)
      } else {
        cNode.targets.push({
          id: targetId,
          targetingSpec: targetSpec,
          spend,
          clicks,
          conversions,
          impressions,
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
        impressions,
        targets: [
          {
            id: targetId,
            targetingSpec: targetSpec,
            spend,
            clicks,
            conversions,
            impressions,
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

  // --- Layout Render Helper ---
  return (
    <div className={readOnly ? '' : 'app-layout'}>
      
      {/* Sidebar Navigation (Hidden in readOnly preview) */}
      {!readOnly && (
        <aside className="sidebar">
          <div className="sidebar-brand">
            <span className="gradient-text">Marketing Hub</span>
          </div>
          <ul className="sidebar-menu">
            <li>
              <button 
                onClick={() => setSidebarTab('home')}
                className={`sidebar-item ${sidebarTab === 'home' ? 'active' : ''}`}
                style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'left' }}
              >
                🏠 {lang === 'TH' ? 'หน้าหลัก' : 'Home'}
              </button>
            </li>
            <li>
              <button 
                onClick={() => setSidebarTab('report')}
                className={`sidebar-item ${sidebarTab === 'report' ? 'active' : ''}`}
                style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'left' }}
              >
                📊 {lang === 'TH' ? 'รายงานสถิติ' : 'Customer Report'}
              </button>
            </li>
            <li>
              <button 
                onClick={() => setSidebarTab('sources')}
                className={`sidebar-item ${sidebarTab === 'sources' ? 'active' : ''}`}
                style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'left' }}
              >
                🔌 {lang === 'TH' ? 'ช่องทางโฆษณา' : 'Sources'}
              </button>
            </li>
            <li>
              <button 
                onClick={() => setSidebarTab('support')}
                className={`sidebar-item ${sidebarTab === 'support' ? 'active' : ''}`}
                style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'left' }}
              >
                💬 {lang === 'TH' ? 'ฝ่ายสนับสนุน' : 'Support'}
              </button>
            </li>
            <li>
              <button 
                onClick={() => setSidebarTab('user')}
                className={`sidebar-item ${sidebarTab === 'user' ? 'active' : ''}`}
                style={{ width: '100%', border: 'none', background: 'transparent', textAlign: 'left' }}
              >
                👤 {lang === 'TH' ? 'โปรไฟล์ผู้ใช้' : 'User Settings'}
              </button>
            </li>
          </ul>

          {/* Quick Sign Out at the Bottom */}
          <form action={logout}>
            <button type="submit" className="sidebar-item" style={{ width: '100%', border: 'none', background: 'transparent', color: '#EF4444', textAlign: 'left', marginTop: 'auto' }}>
              🚪 {lang === 'TH' ? 'ออกจากระบบ' : 'Log Out'}
            </button>
          </form>
        </aside>
      )}

      {/* Main Content Area */}
      <div className={readOnly ? '' : 'main-content'}>
        
        {/* Global Controls Header */}
        <header className="glass-card" style={{
          margin: '20px 20px 10px 20px',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderRadius: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h2 className="gradient-text" style={{ fontSize: '20px', fontWeight: '800' }}>
              {sidebarTab === 'report' ? t.dashboardTitle : sidebarTab === 'sources' ? (lang === 'TH' ? 'การตั้งค่าช่องทางโฆษณา' : 'Sources Settings') : sidebarTab.toUpperCase()}
            </h2>
            
            {readOnly && (
              <span className="badge" style={{ fontSize: '11px', background: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.1)' }}>
                👁️ {t.preview} (Read-only)
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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

            {!readOnly && sidebarTab === 'report' && (
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

        {/* ==========================================
            VIEW 1: HOME PAGE
            ========================================== */}
        {sidebarTab === 'home' && !readOnly && (
          <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <section className="glass-card" style={{ padding: '40px', textAlign: 'center' }}>
              <h2 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '12px' }}>
                สวัสดีคุณแอดมิน ยินดีต้อนรับกลับเข้าสู่ <span className="gradient-text">Marketing Hub Portal</span>
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '600px', margin: '0 auto 24px auto', lineHeight: '1.6' }}>
                รวบรวมและวิเคราะห์แคมเปญโฆษณาของคุณจาก 4 ช่องทางหลัก Meta Ads, Google Ads, TikTok Ads, และ TikTok Shop พร้อมวิเคราะห์การทำงานร่วมกับระบบเซลล์โครงการออฟไลน์แบบเรียลไทม์
              </p>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button onClick={() => setSidebarTab('report')} className="btn-primary" style={{ width: 'auto', padding: '10px 24px' }}>
                  📊 เข้าสู่หน้ารายงานสถิติ
                </button>
                <button onClick={() => setSidebarTab('sources')} className="btn-secondary" style={{ width: 'auto', padding: '10px 24px' }}>
                  🔌 ตั้งค่าเชื่อมโยงบัญชีโฆษณา
                </button>
              </div>
            </section>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="glass-card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '12px' }}>📊 สรุปยอดบัญชีเชื่อมต่อปัจจุบัน</h3>
                <ul style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: 'var(--text-muted)', listStyle: 'none' }}>
                  <li style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                    <span>Facebook Ads:</span>
                    <strong style={{ color: 'white' }}>{connectedAccounts.filter(a=>a.platform==='facebook-ads').length} บัญชี</strong>
                  </li>
                  <li style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                    <span>Google Ads:</span>
                    <strong style={{ color: 'white' }}>{connectedAccounts.filter(a=>a.platform==='google-ads').length} บัญชี</strong>
                  </li>
                  <li style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '6px' }}>
                    <span>TikTok Business Ads:</span>
                    <strong style={{ color: 'white' }}>{connectedAccounts.filter(a=>a.platform==='tiktok-ads').length} บัญชี</strong>
                  </li>
                </ul>
              </div>
              <div className="glass-card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '12px' }}>🛡️ ความปลอดภัยโดเมน</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '12px' }}>
                  มีโดเมนองค์กรทั้งหมด <strong style={{ color: 'white' }}>{allowedDomains.length} โดเมน</strong> ที่ได้รับอนุมัติสิทธิ์การล็อกอินเข้าระบบหลังบ้าน
                </p>
                <button onClick={() => setSidebarTab('sources')} className="btn-secondary" style={{ width: 'auto', padding: '6px 16px', fontSize: '12px' }}>
                  จัดการความปลอดภัย
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            VIEW 2: CUSTOMER REPORT (Dashboard)
            ========================================== */}
        {sidebarTab === 'report' && (
          <div style={{ width: '100%' }}>
            
            {/* Tab switch between analytics and offline CRM inside Customer Report */}
            {!readOnly && (
              <div style={{ display: 'flex', margin: '0 20px 15px 20px', background: 'rgba(0,0,0,0.25)', padding: '4px', borderRadius: '8px', width: 'fit-content' }}>
                <button 
                  onClick={() => setActiveTab('analytics')}
                  style={{
                    padding: '8px 16px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
                    background: activeTab === 'analytics' ? 'var(--primary)' : 'transparent',
                    color: activeTab === 'analytics' ? 'white' : 'var(--text-muted)'
                  }}
                >📊 {lang === 'TH' ? 'สถิติโฆษณาข้ามแพลตฟอร์ม' : 'Cross-Platform Analytics'}</button>
                <button 
                  onClick={() => setActiveTab('offline')}
                  style={{
                    padding: '8px 16px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer',
                    background: activeTab === 'offline' ? 'var(--primary)' : 'transparent',
                    color: activeTab === 'offline' ? 'white' : 'var(--text-muted)'
                  }}
                >🏠 {lang === 'TH' ? 'ตัววิเคราะห์วิถีออฟไลน์ & CRM' : 'Offline CRM Tracker'}</button>
              </div>
            )}

            {activeTab === 'offline' && !readOnly ? (
              <div style={{ padding: '0 20px 20px 20px', width: '100%' }}>
                <OfflineTracker userId={userId} offlineLeads={offlineLeads} onRefresh={() => router.refresh()} />
              </div>
            ) : (
              <main className="container" style={{
                width: '100%',
                maxWidth: '100%',
                padding: '0 20px 20px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px'
              }}>
                
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
                            {formatPlatformName(platform)}
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

                {/* 💡 สรุปวิเคราะห์ผลลัพธ์โฆษณา (Executive Marketing Summary) */}
                <div className="glass-card" style={{ 
                  padding: '16px 20px', 
                  marginBottom: '20px', 
                  borderLeft: '4px solid var(--primary)',
                  background: 'rgba(139, 92, 246, 0.03)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '18px' }}>💡</span>
                    <h3 style={{ fontSize: '13px', fontWeight: '700', color: 'white', margin: 0 }}>
                      {lang === 'TH' ? 'บทวิเคราะห์ผลลัพธ์แคมเปญ (Executive Marketing Summary)' : 'Campaign Performance Summary'}
                    </h3>
                  </div>
                  <p style={{ fontSize: '13px', lineHeight: '1.6', color: 'rgba(255,255,255,0.85)', margin: 0 }}>
                    {marketingSummaryText}
                  </p>
                </div>

                {/* Customizable Metric Cards Grid */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                  gap: '15px',
                  marginBottom: '25px'
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
                                      background: getPlatformColor(camp.platform),
                                      color: 'white',
                                      padding: '1px 5px',
                                      borderRadius: '4px'
                                    }}>
                                      {formatPlatformName(camp.platform)}
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
                                  <td style={{ padding: '12px 6px', textAlign: 'right' }}>฿{camp.spend.toLocaleString()}</td>
                                  <td style={{ padding: '12px 6px', textAlign: 'right' }}>
                                    {camp.clicks.toLocaleString()} <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({((camp.clicks / (camp.impressions || 1)) * 100).toFixed(1)}%)</span>
                                  </td>
                                  <td style={{ padding: '12px 6px', textAlign: 'right' }}>
                                    {camp.conversions.toLocaleString()} <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>(฿{(camp.conversions > 0 ? camp.spend / camp.conversions : 0).toFixed(1)})</span>
                                  </td>
                                  <td style={{ padding: '12px 6px', textAlign: 'right', fontWeight: 'bold' }}>{campRoas > 0 ? `${campRoas.toFixed(1)}x` : '-'}</td>
                                </tr>

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
                                        <td style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--text-muted)' }}>฿{target.spend.toLocaleString()}</td>
                                        <td style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--text-muted)' }}>
                                          {target.clicks.toLocaleString()} <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({((target.clicks / (target.impressions || 1)) * 100).toFixed(1)}%)</span>
                                        </td>
                                        <td style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--text-muted)' }}>
                                          {target.conversions.toLocaleString()} <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>(฿{(target.conversions > 0 ? target.spend / target.conversions : 0).toFixed(1)})</span>
                                        </td>
                                        <td style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--text-muted)' }}>-</td>
                                      </tr>

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
                                          <td style={{ padding: '6px 6px', textAlign: 'right', fontSize: '12px' }}>฿{ad.spend.toLocaleString()}</td>
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
                    <span suppressHydrationWarning>{t.lastUpdated}: {cachedAnalytics.length > 0 ? new Date(cachedAnalytics[0].updated_at).toLocaleTimeString() : 'N/A'}</span>
                  </div>
                </section>
              </main>
            )}
          </div>
        )}

        {/* ==========================================
            VIEW 3: SOURCES PAGE (Ad Accounts, Allowed Domains & Sync)
            ========================================== */}
        {sidebarTab === 'sources' && !readOnly && (
          <div className="container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Platform Connections Status Summary */}
            <section className="glass-card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '14px' }}>📡 สถานะช่องทางการเชื่อมต่อ (API Integration Channels)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                {['facebook-ads', 'google-ads', 'tiktok-ads', 'tiktok-shop'].map(platform => {
                  const accountsCount = connectedAccounts.filter(a => a.platform === platform).length
                  const hasConnection = accountsCount > 0
                  return (
                    <div key={platform} style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      padding: '16px',
                      borderRadius: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="badge" style={{ background: getPlatformColor(platform), color: 'white', fontSize: '10px' }}>
                          {formatPlatformName(platform)}
                        </span>
                        <span style={{ fontSize: '11px', color: hasConnection ? '#10B981' : 'var(--text-muted)' }}>
                          {hasConnection ? '● Connected' : '○ Disconnected'}
                        </span>
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        จำนวนบัญชีโฆษณา: <strong style={{ color: 'white' }}>{accountsCount}</strong>
                      </div>
                      {platform === 'google-ads' && (
                        <button 
                          onClick={() => handleConnectPlatform('google-ads')}
                          className="btn-secondary" 
                          style={{ marginTop: '10px', fontSize: '11px', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', borderRadius: '6px', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
                        >
                          🌐 เชื่อมต่อ Google Ads
                        </button>
                      )}
                      {platform === 'facebook-ads' && (
                        <button 
                          onClick={() => handleConnectPlatform('facebook-ads')}
                          className="btn-primary" 
                          style={{ marginTop: '10px', fontSize: '11px', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', borderRadius: '6px', cursor: 'pointer', background: '#1877F2', border: 'none', color: 'white', fontWeight: 'bold' }}
                        >
                          🔵 เชื่อมต่อ Facebook Ads
                        </button>
                      )}
                      {platform === 'tiktok-ads' && (
                        <button 
                          onClick={() => handleConnectPlatform('tiktok-ads')}
                          className="btn-primary" 
                          style={{ marginTop: '10px', fontSize: '11px', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', borderRadius: '6px', cursor: 'pointer', background: '#000000', border: '1px solid rgba(255,255,255,0.15)', color: 'white' }}
                        >
                          🎵 เชื่อมต่อ TikTok Ads
                        </button>
                      )}
                      {platform === 'tiktok-shop' && (
                        <button 
                          onClick={() => handleConnectPlatform('tiktok-shop')}
                          className="btn-primary" 
                          style={{ marginTop: '10px', fontSize: '11px', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', width: '100%', borderRadius: '6px', cursor: 'pointer', background: '#00F2FE', color: '#000000', border: 'none', fontWeight: 'bold' }}
                        >
                          🎵 เชื่อมสถิติช่อง TikTok
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '20px' }}>
              {/* Left Column: Accounts & Domains management (8 Columns) */}
              <div style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Connected Ad Accounts List */}
                <section className="glass-card" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '800' }}>🔌 บัญชีโฆษณาที่เชื่อมต่อ (Connected Ad Accounts)</h3>
                    <form action={addTestAdAccount.bind(null, userId)}>
                      <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '8px 16px', fontSize: '12px' }}>
                        + {t.addTestAccount}
                      </button>
                    </form>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '350px', overflowY: 'auto' }}>
                    {connectedAccounts.length === 0 ? (
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '30px' }}>
                        ยังไม่มีการเชื่อมต่อบัญชีโฆษณาในโปรไฟล์นี้
                      </p>
                    ) : (
                      connectedAccounts.map((acc) => (
                        <div key={acc.id} style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          padding: '14px 18px',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span className="badge" style={{ background: getPlatformColor(acc.platform), color: 'white', fontSize: '9px' }}>
                                {formatPlatformName(acc.platform)}
                              </span>
                              <strong style={{ fontSize: '14px', color: 'white' }}>{acc.account_name}</strong>
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>ID: {acc.account_id}</span>
                          </div>
                          
                           <button 
                             onClick={() => handleDeleteAdAccount(acc.id, acc.account_name)}
                             disabled={deletingAccountId !== null}
                             style={{ 
                               background: 'transparent', 
                               border: 'none', 
                               color: deletingAccountId === acc.id ? 'var(--text-muted)' : '#EF4444', 
                               cursor: deletingAccountId !== null ? 'not-allowed' : 'pointer', 
                               fontSize: '12px', 
                               fontWeight: 'bold' 
                             }}
                           >
                             {deletingAccountId === acc.id ? (lang === 'TH' ? 'กำลังลบ...' : 'Deleting...') : (lang === 'TH' ? 'ลบการเชื่อมต่อ' : 'Disconnect')}
                           </button>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                {/* Allowed Domains Security */}
                <section className="glass-card" style={{ padding: '24px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '8px' }}>🛡️ ความปลอดภัยโดเมนล็อกอิน (Domain Security Access)</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.4' }}>
                    จำกัดการล็อกอินเข้าระบบหลังบ้านเฉพาะผู้ใช้งานที่มีโดเมนอีเมลบริษัทตรงกับที่ลงทะเบียนไว้ด้านล่างนี้
                  </p>
                  
                  <form onSubmit={handleDomainAdd} style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                    <input name="domain" type="text" disabled={isAddingDomain} placeholder={t.domainInputPlaceholder} required className="input-field" style={{ padding: '10px 14px', fontSize: '13px' }} />
                    <button type="submit" disabled={isAddingDomain} className="btn-primary" style={{ width: 'auto', padding: '10px 20px', fontSize: '13px', whiteSpace: 'nowrap' }}>
                      {isAddingDomain ? (lang === 'TH' ? 'กำลังเพิ่ม...' : 'Adding...') : (lang === 'TH' ? 'เพิ่มโดเมน' : 'Add Domain')}
                    </button>
                  </form>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                    {allowedDomains.map((d: any) => (
                      <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.04)', padding: '10px 14px', borderRadius: '8px', fontSize: '13px' }}>
                        <span>{d.domain}</span>
                        <button 
                          onClick={() => handleDomainDelete(d.id)}
                          disabled={deletingDomainId !== null}
                          style={{ 
                            background: 'transparent', 
                            border: 'none', 
                            color: deletingDomainId === d.id ? 'var(--text-muted)' : '#EF4444', 
                            cursor: deletingDomainId !== null ? 'not-allowed' : 'pointer', 
                            fontSize: '11px' 
                          }}
                        >
                          {deletingDomainId === d.id ? (lang === 'TH' ? '...' : '...') : (lang === 'TH' ? 'ลบ' : 'Delete')}
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

              </div>

              {/* Right Column: Sync controls (4 Columns) */}
              <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <section className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '800' }}>⚡ ซิงก์ข้อมูลแคมเปญ</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                    กดปุ่มนี้เพื่อดึงข้อมูลสถิติล่าสุดจาก Meta, Google, TikTok เข้ามาคำนวณและเก็บไว้ในระบบฐานข้อมูลแคชความไวสูง
                  </p>
                  
                  <form onSubmit={handleSyncAccounts}>
                    <button 
                      type="submit" 
                      disabled={isSyncing}
                      className="btn-primary" 
                      style={{ 
                        width: '100%', 
                        padding: '12px', 
                        fontSize: '14px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        gap: '8px',
                        cursor: isSyncing ? 'not-allowed' : 'pointer',
                        opacity: isSyncing ? 0.7 : 1
                      }}
                    >
                      {isSyncing ? (
                        <>
                          <span className="spinner" style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></span>
                          <span>{lang === 'TH' ? 'กำลังซิงก์ข้อมูล...' : 'Syncing...'}</span>
                        </>
                      ) : (
                        <>
                          <span>⚡</span> {t.syncNow}
                        </>
                      )}
                    </button>
                  </form>
                  {syncMessage && (
                    <div style={{ 
                      fontSize: '12px', 
                      textAlign: 'center', 
                      padding: '8px', 
                      borderRadius: '6px', 
                      background: 'rgba(139,92,246,0.1)', 
                      color: 'white', 
                      marginTop: '8px' 
                    }}>
                      {syncMessage}
                    </div>
                  )}
                  
                  <a href="/api/cron/sync?manual=true" target="_blank" className="btn-secondary" style={{ display: 'block', textAlign: 'center', padding: '10px', fontSize: '12px', textDecoration: 'none' }}>
                    เปิด Cron API Endpoint 🌐
                  </a>
                </section>
              </div>
            </div>

          </div>
        )}

        {/* ==========================================
            VIEW 4: SUPPORT PAGE
            ========================================== */}
        {sidebarTab === 'support' && !readOnly && (
          <div className="container">
            <section className="glass-card" style={{ padding: '40px', textAlign: 'center' }}>
              <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>💬</span>
              <h2 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '10px' }}>ฝ่ายบริการลูกค้าและซัพพอร์ต (Support Desk)</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', maxWidth: '480px', margin: '0 auto', lineHeight: '1.6' }}>
                ระบบซัพพอร์ตและจองสิทธิ์ปรึกษาสำหรับวิเคราะห์แคมเปญโฆษณาอสังหาริมทรัพย์และอีคอมเมิร์ซ ยินดีให้บริการผู้พัฒนาและแอดมินทุกวันตลอด 24 ชั่วโมง
              </p>
              <button className="btn-primary" style={{ width: 'auto', padding: '10px 24px', marginTop: '20px' }}>
                ส่งข้อความหาทีมงาน
              </button>
            </section>
          </div>
        )}

        {/* ==========================================
            VIEW 5: USER SETTINGS PAGE
            ========================================== */}
        {sidebarTab === 'user' && !readOnly && (
          <div className="container" style={{ maxWidth: '600px' }}>
            <section className="glass-card" style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                  👤
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '800' }}>Admin Account</h3>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>สิทธิ์การเข้าใช้งาน: ผู้ดูแลระบบสูงสุด (Super Admin)</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>ID บัญชีปัจจุบัน:</span>
                  <strong style={{ fontFamily: 'var(--font-mono)' }}>{userId}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>ภาษาใช้งานเริ่มต้น:</span>
                  <strong>{lang === 'TH' ? 'ภาษาไทย (TH)' : 'English (EN)'}</strong>
                </div>
              </div>

              <form action={logout}>
                <button type="submit" className="btn-primary" style={{ background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)', boxShadow: '0 4px 14px 0 rgba(239, 68, 68, 0.25)' }}>
                  🚪 ออกจากระบบรักษาความปลอดภัย (Log Out)
                </button>
              </form>
            </section>
          </div>
        )}

      </div>

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
          header, section:nth-of-type(1), form, .btn-primary, .btn-secondary, button, .sidebar {
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
