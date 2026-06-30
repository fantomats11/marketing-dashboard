import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    console.error('Google Ads OAuth Redirect Error:', error)
    return NextResponse.redirect(`${origin}/?tab=sources&error=oauth_refused&details=${encodeURIComponent(error)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/?tab=sources&error=missing_code`)
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const devToken = process.env.GOOGLE_DEVELOPER_TOKEN
  const redirectUri = `${origin}/api/auth/google/callback`

  if (!clientId || !clientSecret || !devToken) {
    console.error('Google Ads OAuth configuration is missing on server')
    return NextResponse.redirect(`${origin}/?tab=sources&error=server_configuration_missing`)
  }

  try {
    // 1. แลกเปลี่ยน Authorization Code เป็น Access/Refresh Tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    })

    const tokenJson = await tokenRes.json()

    if (tokenJson.error) {
      console.error('Google token exchange error:', tokenJson.error_description || tokenJson.error)
      return NextResponse.redirect(`${origin}/?tab=sources&error=token_exchange_failed&details=${encodeURIComponent(tokenJson.error_description || tokenJson.error)}`)
    }

    const { access_token, refresh_token } = tokenJson

    if (!access_token) {
      return NextResponse.redirect(`${origin}/?tab=sources&error=empty_access_token`)
    }

    // 2. ดึงลูกค้า (Customer IDs) ที่อยู่ภายใต้สิทธิ์บัญชีนี้
    const customersRes = await fetch('https://googleads.googleapis.com/v17/customers:listAccessibleCustomers', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'developer-token': devToken,
        'Content-Type': 'application/json'
      }
    })

    const customersJson = await customersRes.json()

    if (customersJson.error) {
      console.error('Google listAccessibleCustomers API Error:', customersJson.error.message)
      return NextResponse.redirect(`${origin}/?tab=sources&error=list_customers_failed&details=${encodeURIComponent(customersJson.error.message)}`)
    }

    const resourceNames = customersJson.resourceNames || []
    const customerIds = resourceNames.map((rn: string) => rn.replace('customers/', ''))

    if (customerIds.length === 0) {
      console.warn('No accessible Google Ads customer accounts found.')
      return NextResponse.redirect(`${origin}/?tab=sources&error=no_google_ads_accounts`)
    }

    // 3. ดึงข้อมูลเซสชันผู้ใช้ปัจจุบัน
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      console.error('Unauthorized Google Ads OAuth callback: No active session')
      return NextResponse.redirect(`${origin}/login?error=unauthorized_oauth_callback`)
    }

    // 4. บันทึกบัญชี Google Ads ทุกตัวที่ได้รับสิทธิ์ลงฐานข้อมูล
    for (const custId of customerIds) {
      const formattedCustId = custId.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3') // Format: XXX-XXX-XXXX
      const { data: existing } = await supabase
        .from('connected_ad_accounts')
        .select('id, metadata')
        .eq('user_id', user.id)
        .eq('platform', 'google-ads')
        .eq('account_id', formattedCustId)
        .maybeSingle()

      const newMetadata = {
        client_id: clientId,
        client_secret: clientSecret,
        developer_token: devToken,
        refresh_token: refresh_token || existing?.metadata?.refresh_token, // ใช้ Refresh Token ตัวเดิมที่มีอยู่ถ้าตัวใหม่ไม่ได้ส่งมา
        connected_at: new Date().toISOString(),
        status: 'active'
      }

      if (existing) {
        await supabase
          .from('connected_ad_accounts')
          .update({ metadata: newMetadata })
          .eq('id', existing.id)
      } else {
        await supabase.from('connected_ad_accounts').insert({
          user_id: user.id,
          platform: 'google-ads',
          account_id: formattedCustId,
          account_name: `Google Ads Account ${formattedCustId}`,
          metadata: newMetadata
        })
      }
    }

    // ซิงก์ข้อมูลทันที
    return NextResponse.redirect(`${origin}/?tab=sources&sync=success`)

  } catch (err: any) {
    console.error('Google Ads OAuth Callback System Error:', err.message || err)
    return NextResponse.redirect(`${origin}/?tab=sources&error=system_error&details=${encodeURIComponent(err.message || err)}`)
  }
}
