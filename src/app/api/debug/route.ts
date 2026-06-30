import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({
        authenticated: false,
        userError: userError?.message || null,
        message: 'No active user session found in cookies'
      })
    }

    const [
      { data: userProfile, error: profileError },
      { data: allowedDomains, error: domainsError },
      { data: connectedAccounts, error: accountsError }
    ] = await Promise.all([
      supabase.from('users').select('metadata').eq('id', user.id).maybeSingle(),
      supabase.from('allowed_domains').select('domain'),
      supabase.from('connected_ad_accounts').select('*').eq('user_id', user.id)
    ])

    return NextResponse.json({
      authenticated: true,
      userId: user.id,
      email: user.email,
      userProfile,
      profileError: profileError?.message || null,
      allowedDomains: allowedDomains?.map(d => d.domain) || [],
      domainsError: domainsError?.message || null,
      connectedAccounts,
      accountsError: accountsError?.message || null
    })

  } catch (err: any) {
    return NextResponse.json({
      error: 'System Error',
      message: err.message || err
    })
  }
}
