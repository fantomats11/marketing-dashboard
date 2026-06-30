import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  if (!code) {
    console.error('TikTok Account Holder OAuth Callback Error: Missing code parameter')
    return NextResponse.redirect(`${origin}/?tab=sources&error=missing_creator_code`)
  }

  // 1. แลกโทเค็นสำหรับสิทธิ์ผู้ใช้/ผู้ถือบัญชีออร์แกนิก (TikTok Creator Marketplace / User Info API)
  const clientKey = "7651553209164496897"
  const clientSecret = "2e9e94ac737437e5ce4bc76541bbf66915102adc"

  try {
    const tokenResponse = await fetch('https://open-api.tiktok.com/v2/oauth/token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache'
      },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: `${origin}/tiktok/account-holder/callback`
      })
    })

    const json = await tokenResponse.json()

    if (json.error || json.data?.error_code) {
      const errorMsg = json.message || json.data?.description || 'Token exchange failed'
      console.error('TikTok Creator Token Exchange Failed:', errorMsg)
      return NextResponse.redirect(`${origin}/?tab=sources&error=creator_token_failed&details=${encodeURIComponent(errorMsg)}`)
    }

    const { access_token, open_id } = json.data || {}

    if (!access_token || !open_id) {
      console.error('TikTok Creator OAuth returned empty data')
      return NextResponse.redirect(`${origin}/?tab=sources&error=empty_creator_data`)
    }

    // 2. ดึงข้อมูลเซสชันผู้ใช้งานปัจจุบัน
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      console.error('Unauthorized TikTok Creator OAuth: No active user session')
      return NextResponse.redirect(`${origin}/login?error=unauthorized_oauth_callback`)
    }

    // 3. บันทึกบัญชี TikTok Creator Account ลงตาราง connected_ad_accounts
    // ใช้ platform = 'tiktok-creator' หรือประยุกต์ไว้สำหรับสถิติออแกนิกวิดีโอ
    const { data: existing } = await supabase
      .from('connected_ad_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('platform', 'tiktok-creator')
      .eq('account_id', open_id)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('connected_ad_accounts')
        .update({
          metadata: {
            access_token: access_token,
            open_id: open_id,
            connected_at: new Date().toISOString(),
            status: 'active'
          }
        })
        .eq('id', existing.id)
    } else {
      await supabase.from('connected_ad_accounts').insert({
        user_id: user.id,
        platform: 'tiktok-creator',
        account_id: open_id,
        account_name: 'TikTok Creator Account (Organic Videos)',
        metadata: {
          access_token: access_token,
          open_id: open_id,
          connected_at: new Date().toISOString(),
          status: 'active'
        }
      })
    }

    return NextResponse.redirect(`${origin}/?tab=sources&sync=success`)

  } catch (err: any) {
    console.error('TikTok Creator OAuth Callback System Error:', err.message || err)
    return NextResponse.redirect(`${origin}/?tab=sources&error=system_error&details=${encodeURIComponent(err.message || err)}`)
  }
}
