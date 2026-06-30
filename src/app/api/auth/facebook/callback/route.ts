import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    console.error('Facebook OAuth Redirect Error:', error)
    return NextResponse.redirect(`${origin}/?tab=sources&error=oauth_refused&details=${encodeURIComponent(error)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/?tab=sources&error=missing_code`)
  }

  const appId = process.env.FACEBOOK_APP_ID
  const appSecret = process.env.FACEBOOK_CLIENT_SECRET
  const redirectUri = `${origin}/api/auth/facebook/callback`

  if (!appId || !appSecret) {
    console.error('Facebook App Credentials are missing on server')
    return NextResponse.redirect(`${origin}/?tab=sources&error=server_configuration_missing`)
  }

  try {
    // 1. แลกเปลี่ยน Code เป็น Short-Lived Access Token
    const tokenRes = await fetch(`https://graph.facebook.com/v25.0/oauth/access_token?` + new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      client_secret: appSecret,
      code: code
    }))

    const tokenJson = await tokenRes.json()

    if (tokenJson.error) {
      console.error('Facebook token exchange error:', tokenJson.error.message)
      return NextResponse.redirect(`${origin}/?tab=sources&error=token_exchange_failed&details=${encodeURIComponent(tokenJson.error.message)}`)
    }

    const shortLivedToken = tokenJson.access_token

    // 2. แลกเปลี่ยน Short-Lived เป็น Long-Lived Access Token (มีอายุ 60 วัน)
    const longLivedRes = await fetch(`https://graph.facebook.com/v25.0/oauth/access_token?` + new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortLivedToken
    }))

    const longLivedJson = await longLivedRes.json()

    if (longLivedJson.error) {
      console.error('Facebook Long-Lived token exchange error:', longLivedJson.error.message)
      return NextResponse.redirect(`${origin}/?tab=sources&error=long_lived_token_failed&details=${encodeURIComponent(longLivedJson.error.message)}`)
    }

    const longLivedToken = longLivedJson.access_token

    // 3. ดึงรายการบัญชีโฆษณา (Ad Accounts) ทั้งหมดที่มีสิทธิ์เข้าถึง
    const adAccountsRes = await fetch(`https://graph.facebook.com/v25.0/me/adaccounts?` + new URLSearchParams({
      fields: 'name,account_id',
      access_token: longLivedToken,
      limit: '100'
    }))

    const adAccountsJson = await adAccountsRes.json()

    if (adAccountsJson.error) {
      console.error('Facebook list ad accounts error:', adAccountsJson.error.message)
      return NextResponse.redirect(`${origin}/?tab=sources&error=list_accounts_failed&details=${encodeURIComponent(adAccountsJson.error.message)}`)
    }

    const adAccounts = adAccountsJson.data || []

    if (adAccounts.length === 0) {
      console.warn('No accessible Facebook Ad accounts found.')
      return NextResponse.redirect(`${origin}/?tab=sources&error=no_facebook_ads_accounts`)
    }

    // 4. ดึงข้อมูลเซสชันผู้ใช้ปัจจุบัน
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      console.error('Unauthorized Facebook Ads OAuth callback: No active session')
      return NextResponse.redirect(`${origin}/login?error=unauthorized_oauth_callback`)
    }

    // 5. บันทึกบัญชี Facebook Ads ทั้งหมดลงฐานข้อมูล
    for (const adAcc of adAccounts) {
      const formattedAccId = adAcc.account_id // ID บัญชีปกติไม่ใส่ act_ ในฐานข้อมูล
      const cleanName = adAcc.name || `Facebook Ad Account ${formattedAccId}`

      const { data: existing } = await supabase
        .from('connected_ad_accounts')
        .select('id')
        .eq('user_id', user.id)
        .eq('platform', 'facebook-ads')
        .eq('account_id', formattedAccId)
        .maybeSingle()

      const newMetadata = {
        access_token: longLivedToken,
        connected_at: new Date().toISOString(),
        status: 'active'
      }

      if (existing) {
        await supabase
          .from('connected_ad_accounts')
          .update({
            account_name: cleanName,
            metadata: newMetadata
          })
          .eq('id', existing.id)
      } else {
        await supabase.from('connected_ad_accounts').insert({
          user_id: user.id,
          platform: 'facebook-ads',
          account_id: formattedAccId,
          account_name: cleanName,
          metadata: newMetadata
        })
      }
    }

    // ซิงก์ข้อมูลสำเร็จ
    return NextResponse.redirect(`${origin}/?tab=sources&sync=success`)

  } catch (err: any) {
    console.error('Facebook Ads OAuth Callback System Error:', err.message || err)
    return NextResponse.redirect(`${origin}/?tab=sources&error=system_error&details=${encodeURIComponent(err.message || err)}`)
  }
}
