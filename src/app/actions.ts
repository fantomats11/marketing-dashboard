'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import crypto from 'crypto'
import { CentralApiHub } from '@/lib/services/api-hub'


export async function addAllowedDomain(formData: FormData) {
  const domain = formData.get('domain') as string
  if (!domain) return

  const supabase = await createClient()
  
  // 🔒 ตรวจสอบซ้ำก่อน Insert
  const trimmed = domain.trim().toLowerCase()
  const { data: existing } = await supabase
    .from('allowed_domains')
    .select('id')
    .eq('domain', trimmed)
    .maybeSingle()

  if (existing) return // โดเมนนี้มีอยู่แล้ว ไม่ต้อง Insert ซ้ำ

  await supabase.from('allowed_domains').insert({ domain: trimmed })
  revalidatePath('/')
}

export async function deleteAllowedDomain(id: string) {
  const supabase = await createClient()
  await supabase.from('allowed_domains').delete().eq('id', id)
  
  revalidatePath('/')
}

export async function addTestAdAccount(userId: string) {
  const supabase = await createClient()
  
  const platforms = ['google-ads', 'facebook-ads', 'tiktok-ads']
  const randomPlatform = platforms[Math.floor(Math.random() * platforms.length)]
  const randomId = Math.floor(Math.random() * 1000000000).toString()
  
  const { data: account, error } = await supabase.from('connected_ad_accounts').insert({
    user_id: userId,
    platform: randomPlatform,
    account_id: randomId,
    account_name: `Test ${randomPlatform.replace('-', ' ').toUpperCase()} Account`,
    metadata: {
      connected_at: new Date().toISOString(),
      ad_spend_limit: Math.floor(Math.random() * 8000) + 2000,
      api_version: 'v18.0',
      status: 'active',
      scopes: ['read_insights', 'manage_campaigns']
    }
  }).select().single()

  if (account && !error) {
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('analytics_cache').insert([
      {
        account_id: account.id,
        metric_date: today,
        // 🐛 Fix: spend เป็น number ไม่ใช่ string (.toFixed สร้างสตริง)
        dimensions: { campaign: 'Summer Promo 2026', device: 'mobile' },
        metrics: { spend: Math.round((Math.random() * 500 + 100) * 100) / 100, clicks: Math.floor(Math.random() * 1000) + 200, impressions: Math.floor(Math.random() * 40000) + 10000 }
      },
      {
        account_id: account.id,
        metric_date: today,
        dimensions: { campaign: 'Summer Promo 2026', device: 'desktop' },
        metrics: { spend: Math.round((Math.random() * 300 + 50) * 100) / 100, clicks: Math.floor(Math.random() * 600) + 100, impressions: Math.floor(Math.random() * 20000) + 5000 }
      }
    ])
  }

  revalidatePath('/')
}

export async function deleteAdAccount(id: string) {
  const supabase = await createClient()
  // ลบข้อมูลแคชที่เกี่ยวข้องก่อน (ถ้าไม่มี ON DELETE CASCADE)
  await supabase.from('analytics_cache').delete().eq('account_id', id)
  await supabase.from('connected_ad_accounts').delete().eq('id', id)
  revalidatePath('/')
}

export async function syncAccounts() {
  const supabase = await createClient()

  const { data: accounts } = await supabase.from('connected_ad_accounts').select('*')
  if (!accounts || accounts.length === 0) return

  const today = new Date().toISOString().split('T')[0]

  // ใช้ Promise.all เพื่อเร่งความเร็ว แทน sequential for...of
  await Promise.all(
    accounts.map(async (acc) => {
      try {
        const records = await CentralApiHub.fetchAccountData(
          acc.platform,
          acc.account_id,
          acc.metadata
        )

        // รวบรวม RPC calls ของแต่ละบัญชีเป็น parallel
        await Promise.all(
          records.map(async (item) => {
            const { spend, clicks, impressions, conversions, revenue, reach } = item.metrics
            const ctr = impressions > 0 ? clicks / impressions : 0
            const cpa = conversions > 0 ? spend / conversions : 0
            const roas = spend > 0 ? revenue / spend : 0

            const dimensions = {
              campaign_id: item.campaignId,
              campaign_name: item.campaignName,
              status: item.status,
              targeting: item.targeting,
              ad_id: item.content.adId,
              ad_name: item.content.adName,
              creative_url: item.content.creativeUrl || null
            }

            const metrics = {
              spend, clicks, impressions, conversions, revenue, reach: reach || 0,
              ctr, cpa, roas
            }

            await supabase.rpc('upsert_analytics_cache', {
              p_account_id: acc.id,
              p_metric_date: item.metricDate || today,
              p_dimensions: dimensions,
              p_metrics: metrics
            })
          })
        )
      } catch (err) {
        console.error(`Error in manual sync for account ${acc.id}:`, err)
      }
    })
  )

  revalidatePath('/')
}

export async function saveViewPreferences(userId: string, preferences: Record<string, unknown>) {
  const supabase = await createClient()
  await supabase
    .from('users')
    .update({
      metadata: preferences
    })
    .eq('id', userId)
}

export async function createShareableLink(userId: string, allowedAccountIds: string[]) {
  const supabase = await createClient()
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7) // ลิงก์มีอายุ 7 วัน

  const { error } = await supabase.from('shareable_dashboards').insert({
    token,
    user_id: userId,
    allowed_accounts: allowedAccountIds,
    expires_at: expiresAt.toISOString()
  })

  if (error) {
    throw new Error(error.message)
  }

  return token
}

export async function simulateAdClick(
  adNetwork: string,
  campaignId: string,
  campaignName: string,
  targetAudience: string,
  adId: string,
  adName: string,
  creativeUrl?: string
) {
  const supabase = await createClient()
  const randNum = Math.floor(Math.random() * 900) + 100
  const netShort = adNetwork.replace('-ads', '').substring(0, 4).toUpperCase()
  const promoCode = `RE-${netShort}-${randNum}`

  const { error } = await supabase.from('attributed_clicks').insert({
    promo_code: promoCode,
    ad_network: adNetwork,
    campaign_id: campaignId,
    campaign_name: campaignName,
    target_audience: targetAudience,
    ad_id: adId,
    ad_name: adName,
    creative_url: creativeUrl || null
  })

  if (error) throw new Error(error.message)
  return promoCode
}

export async function simulateOfflineLead(
  customerName: string,
  phoneNumber: string,
  leadType: string,
  promoCodeUsed: string,
  status: string,
  revenueGenerated: number
) {
  const supabase = await createClient()
  const { error } = await supabase.from('offline_leads').insert({
    customer_name: customerName,
    phone_number: phoneNumber,
    lead_type: leadType,
    promo_code_used: promoCodeUsed || null,
    status,
    revenue_generated: revenueGenerated,
    visited_at: new Date().toISOString()
  })

  if (error) throw new Error(error.message)
  revalidatePath('/')
}
