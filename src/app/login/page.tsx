import { login, signup } from './actions'

interface SearchParams {
  error?: string
  message?: string
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const error = params.error
  const message = params.message

  // แปลง Error Message ให้เป็นภาษาไทยที่สวยงาม
  let errorMessage = ''
  if (error) {
    if (error === 'domain_not_allowed') {
      errorMessage = 'โดเมนอีเมลของคุณไม่ได้รับอนุญาตให้เข้าใช้งานระบบ โปรดตรวจสอบโดเมนอีเมลของคุณ'
    } else if (error === 'missing_credentials') {
      errorMessage = 'กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน'
    } else if (error === 'invalid_user_data' || error === 'invalid_email_domain') {
      errorMessage = 'ข้อมูลอีเมลไม่ถูกต้องหรือไม่พบโดเมนที่สามารถตรวจสอบได้'
    } else if (error === 'Invalid login credentials') {
      errorMessage = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
    } else {
      errorMessage = 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง'
    }
  }

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      position: 'relative',
      zIndex: 1
    }}>
      <div className="glass-card" style={{
        width: '100%',
        maxWidth: '450px',
        padding: '40px',
        display: 'flex',
        flexDirection: 'column',
        gap: '28px'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 className="gradient-text" style={{
            fontSize: '32px',
            fontWeight: '800',
            letterSpacing: '-0.5px',
            marginBottom: '8px'
          }}>
            Marketing Portal
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            เข้าใช้งานระบบควบคุมและวิเคราะห์โฆษณาของคุณ
          </p>
        </div>

        {errorMessage && (
          <div className="badge badge-danger" style={{
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            display: 'block',
            lineHeight: '1.5',
            textAlign: 'center'
          }}>
            ⚠️ {errorMessage}
          </div>
        )}

        {message === 'check_email' && (
          <div className="badge badge-success" style={{
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            display: 'block',
            lineHeight: '1.5',
            textAlign: 'center'
          }}>
            📧 ลงทะเบียนสำเร็จ! โปรดตรวจสอบอีเมลของคุณเพื่อยืนยันบัญชี
          </div>
        )}

        <form style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--foreground)', opacity: 0.85 }}>
              อีเมลของบริษัท (เช่น name@company.com)
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              placeholder="name@company.com"
              className="input-field"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: '500', color: 'var(--foreground)', opacity: 0.85 }}>
              รหัสผ่าน
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              placeholder="••••••••"
              className="input-field"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
            <button formAction={login} className="btn-primary">
              เข้าสู่ระบบ
            </button>
            <button formAction={signup} className="btn-secondary">
              ลงทะเบียนใช้งานใหม่
            </button>
          </div>
        </form>

        <div style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          paddingTop: '20px',
          textAlign: 'center'
        }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.6' }}>
            * ระบบอนุญาตให้เข้าใช้งานเฉพาะโดเมนอีเมลขององค์กรที่ระบุไว้ในตาราง Allowed Domains เท่านั้น
          </p>
        </div>
      </div>
    </main>
  )
}
