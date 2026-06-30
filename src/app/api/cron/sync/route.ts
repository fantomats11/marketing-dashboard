import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CentralApiHub } from '@/lib/services/api-hub'

export async function GET(request: Request) {
  // 🔒 Security: ตรวจสอบ CRON_SECRET เพื่อป้องกันการเรียกใช้ Endpoint โดยไม่ได้รับอนุญาต
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized: Invalid or missing CRON_SECRET' }, { status: 401 })
  }

  const supabase = await createClient()

  // 1. เรียกใช้งาน RPC เพื่อดึงบัญชีทั้งหมดสำหรับการซิงก์
  const { data: accounts, error: accountsError } = await supabase
    .rpc('get_all_accounts_for_sync')

  if (accountsError) {
    return NextResponse.json({ error: 'Failed to fetch connected ad accounts', details: accountsError.message }, { status: 500 })
  }

  const accountsList = accounts as any[]

  if (!accountsList || accountsList.length === 0) {
    return NextResponse.json({
      message: 'No connected ad accounts to sync',
      processed: 0,
      success: 0,
      failed: 0
    })
  }

  let successCount = 0
  let errorCount = 0
  const syncLogs: string[] = []
  const today = new Date().toISOString().split('T')[0] // คำนวณครั้งเดียวนอกลูป

  // 2. วนลูปประมวลผลบัญชีโฆษณาแบบ Batch
  const batchSize = 10
  for (let i = 0; i < accountsList.length; i += batchSize) {
    const batch = accountsList.slice(i, i + batchSize)

    await Promise.all(
      batch.map(async (acc) => {
        try {
          const records = await CentralApiHub.fetchAccountData(
            acc.platform,
            acc.account_id,
            acc.metadata
          )

          // รวบรวม RPC calls ทั้งหมดของบัญชีนี้แล้วส่งแบบ parallel
          const upsertPromises = records.map(async (item) => {
            const { spend, clicks, impressions, conversions, revenue } = item.metrics

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
              spend,
              clicks,
              impressions,
              conversions,
              revenue,
              ctr,
              cpa,
              roas
            }

            const { error: upsertError } = await supabase
              .rpc('upsert_analytics_cache', {
                p_account_id: acc.id,
                p_metric_date: today,
                p_dimensions: dimensions,
                p_metrics: metrics
              })

            if (upsertError) {
              throw new Error(`Failed to upsert cache: ${upsertError.message}`)
            }
          })

          await Promise.all(upsertPromises)
          successCount++
          syncLogs.push(`Successfully synced account ${acc.account_name} (${acc.platform})`)
        } catch (err: any) {
          errorCount++
          syncLogs.push(`Failed to sync account ${acc.account_name} (${acc.platform}): ${err.message || err}`)
        }
      })
    )
  }

  return NextResponse.json({
    message: 'Data synchronization completed successfully via Secure RPC',
    summary: {
      totalAccounts: accountsList.length,
      successCount,
      errorCount
    },
    logs: syncLogs
  })
}
