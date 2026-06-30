import { createClient } from '@/lib/supabase/server'
import DashboardClientWrapper from '@/components/dashboard/client-wrapper'

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()

  // 1. ดึงข้อมูลสถิติที่ได้รับสิทธิ์ตาม Token จาก Secure RPC
  const { data, error } = await supabase
    .rpc('get_shared_analytics_by_token', { p_token: token })

  if (error || !data || data.length === 0) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#080B11',
        color: 'white',
        fontFamily: 'system-ui, sans-serif',
        padding: '20px'
      }}>
        <div className="glass-card" style={{
          maxWidth: '480px',
          width: '100%',
          padding: '40px',
          textAlign: 'center',
          borderRadius: '16px',
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.02)',
          backdropFilter: 'blur(12px)'
        }}>
          <span style={{ fontSize: '48px', display: 'block', marginBottom: '20px' }}>⚠️</span>
          <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '10px' }}>ลิงก์พรีวิวหมดอายุหรือไม่มีสิทธิ์เข้าถึง</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
            ลิงก์แชร์แดชบอร์ดภายนอกนี้ไม่ถูกต้อง ถูกยกเลิก หรือหมดอายุการใช้งานแล้ว (ปกติมีอายุใช้งาน 7 วันนับจากวันที่สร้าง)
          </p>
          <a href="/login" style={{
            display: 'inline-block',
            marginTop: '24px',
            padding: '10px 24px',
            background: 'var(--primary)',
            color: 'white',
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            เข้าสู่ระบบแอดมิน
          </a>
        </div>
      </div>
    )
  }

  const dataList = data as any[]

  // 2. แปลงผลข้อมูลกลับไปเป็นบัญชีโฆษณาจำลองสำหรับ Client Wrapper
  const uniqueAccountsMap = new Map<string, any>()
  dataList.forEach((row: any) => {
    if (!uniqueAccountsMap.has(row.account_id)) {
      uniqueAccountsMap.set(row.account_id, {
        id: row.account_id,
        platform: row.platform,
        account_id: row.account_id,
        account_name: row.account_name,
        metadata: {},
        created_at: new Date().toISOString()
      })
    }
  })
  
  const connectedAccounts = Array.from(uniqueAccountsMap.values())

  // 3. ปรับรูปแบบข้อมูลแคชสำหรับส่งต่อไปตัวแดชบอร์ดหลัก
  const cachedAnalytics = dataList.map((row: any) => ({
    id: row.id,
    account_id: row.account_id,
    metric_date: row.metric_date,
    dimensions: row.dimensions,
    metrics: row.metrics,
    updated_at: row.updated_at,
    connected_ad_accounts: {
      account_name: row.account_name,
      platform: row.platform
    }
  }))

  return (
    <DashboardClientWrapper
      userId=""
      initialPreferences={{}}
      allowedDomains={[]}
      connectedAccounts={connectedAccounts}
      cachedAnalytics={cachedAnalytics}
      readOnly={true}
    />
  )
}
