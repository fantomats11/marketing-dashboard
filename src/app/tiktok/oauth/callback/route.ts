import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const authCode = searchParams.get('auth_code')
  
  if (!authCode) {
    console.error('TikTok OAuth Callback Error: Missing auth_code parameter')
    return NextResponse.redirect(`${origin}/?tab=sources&error=missing_auth_code`)
  }

  // 1. นำ App ID และ Secret ที่ได้รับจากผู้ใช้งานมาแลก Access Token จาก TikTok Business API
  const appId = "7651553209164496897"
  const secret = "2e9e94ac737437e5ce4bc76541bbf66915102adc"

  try {
    const tokenResponse = await fetch('https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        app_id: appId,
        secret: secret,
        auth_code: authCode,
        grant_type: 'authorization_code'
      })
    })

    const json = await tokenResponse.json()

    if (json.code !== 0) {
      console.error('TikTok Token Exchange Failed:', json.message)
      return NextResponse.redirect(`${origin}/?tab=sources&error=token_exchange_failed&details=${encodeURIComponent(json.message)}`)
    }

    const { access_token, advertiser_ids } = json.data || {}

    if (!access_token || !advertiser_ids || advertiser_ids.length === 0) {
      console.error('TikTok OAuth returned empty access token or advertiser IDs')
      return NextResponse.redirect(`${origin}/?tab=sources&error=empty_oauth_data`)
    }

    // 2. ดึงเซสชันผู้ใช้งานปัจจุบันผ่าน Supabase Cookies
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      console.error('Unauthorized TikTok OAuth callback: No active user session')
      return NextResponse.redirect(`${origin}/login?error=unauthorized_oauth_callback`)
    }

    // 3. บันทึกบัญชีโฆษณา TikTok ทั้งหมดที่ได้รับอนุมัติสิทธิ์ลงฐานข้อมูล
    for (const advId of advertiser_ids) {
      // ตรวจสอบก่อนว่าเคยเชื่อมโยงไว้แล้วหรือยัง
      const { data: existing } = await supabase
        .from('connected_ad_accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('platform', 'tiktok-ads')
        .eq('account_id', advId)
        .maybeSingle()

      if (existing) {
        // อัปเดตคีย์โทเค็นใหม่
        await supabase
          .from('connected_ad_accounts')
          .update({
            metadata: {
              access_token: access_token,
              connected_at: new Date().toISOString(),
              status: 'active'
            }
          })
          .eq('id', existing.id)
      } else {
        // เพิ่มสิทธิ์บัญชีใหม่
        await supabase.from('connected_ad_accounts').insert({
          user_id: user.id,
          platform: 'tiktok-ads',
          account_id: advId,
          account_name: `TikTok Ads Account ${advId}`,
          metadata: {
            access_token: access_token,
            connected_at: new Date().toISOString(),
            status: 'active'
          }
        })
      }
    }

    // รีไดเรกต์กลับไปที่หน้า Sources พร้อมแจ้งสถานะสำเร็จ
    return NextResponse.redirect(`${origin}/?tab=sources&sync=success`)

  } catch (err: any) {
    console.error('TikTok OAuth Callback System Error:', err.message || err)
    return NextResponse.redirect(`${origin}/?tab=sources&error=system_error&details=${encodeURIComponent(err.message || err)}`)
  }
}
