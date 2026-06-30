import { createClient } from '@/lib/supabase/server'
import DashboardClientWrapper from '@/components/dashboard/client-wrapper'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()

  // 1. ตรวจสอบและดึงข้อมูลผู้ใช้งานปัจจุบัน
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return redirect('/login')
  }

  // 2. ดึงข้อมูลทั้งหมดแบบ Parallel เพื่อลด Latency (แทน sequential 6 queries)
  const [
    { data: userProfile },
    { data: allowedDomainsRaw },
    { data: connectedAccountsRaw },
    { data: offlineLeadsRaw }
  ] = await Promise.all([
    supabase.from('users').select('metadata').eq('id', user.id).maybeSingle(),
    supabase.from('allowed_domains').select('id, domain').order('domain', { ascending: true }),
    supabase.from('connected_ad_accounts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('offline_leads').select('*').order('visited_at', { ascending: false }).limit(200)
  ])

  const initialPreferences = userProfile?.metadata || {}
  const allowedDomains = allowedDomainsRaw || []
  const connectedAccounts = connectedAccountsRaw || []
  const accountIds = connectedAccounts.map((a: any) => a.id)

  // 3. ดึงแคชสถิติโฆษณา (ต้องรอ accountIds ก่อน)
  let cachedAnalytics: any[] = []
  if (accountIds.length > 0) {
    const { data: cachedAnalyticsRaw } = await supabase
      .from('analytics_cache')
      .select(`
        id,
        account_id,
        metric_date,
        dimensions,
        metrics,
        updated_at,
        connected_ad_accounts (
          account_name,
          platform
        )
      `)
      .in('account_id', accountIds)
      .order('metric_date', { ascending: false })

    cachedAnalytics = cachedAnalyticsRaw || []
  }

  return (
    <DashboardClientWrapper
      userId={user.id}
      initialPreferences={initialPreferences}
      allowedDomains={allowedDomains}
      connectedAccounts={connectedAccounts as any}
      cachedAnalytics={cachedAnalytics as any}
      offlineLeads={offlineLeadsRaw as any}
    />
  )
}
