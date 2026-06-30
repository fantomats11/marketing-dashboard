import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// แคช Domain ที่อนุญาตแล้วใน Memory (TTL 5 นาที)
let cachedDomains: { domains: Set<string>; fetchedAt: number } | null = null
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 นาที

// ฟังก์ชันช่วยเคลียร์ Supabase Cookies จาก Response ลดโค้ดซ้ำซ้อน
function clearSupabaseCookies(request: NextRequest, response: NextResponse) {
  request.cookies.getAll().forEach(cookie => {
    if (cookie.name.includes('supabase') || cookie.name.startsWith('sb-')) {
      response.cookies.set(cookie.name, '', { maxAge: 0 })
    }
  })
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublicRoute = 
    pathname.startsWith('/login') || 
    pathname.startsWith('/api/auth/callback') ||
    pathname.startsWith('/api/cron') || 
    pathname.startsWith('/share') || 
    pathname === '/favicon.ico'

  // สำหรับ Public Route ไม่ต้องสร้าง Supabase client เลย → ลดโหลด
  if (isPublicRoute) {
    return NextResponse.next()
  }

  const { supabase, user, response } = await updateSession(request)

  // หากไม่มีผู้ใช้เข้าสู่ระบบ ให้เปลี่ยนเส้นทางไปยังหน้า /login
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // ดึง Domain จากอีเมลของผู้ใช้
  const email = user.email
  if (!email) {
    await supabase.auth.signOut()
    const errorResponse = NextResponse.redirect(new URL('/login?error=invalid_user_data', request.url))
    return clearSupabaseCookies(request, errorResponse)
  }

  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) {
    await supabase.auth.signOut()
    const errorResponse = NextResponse.redirect(new URL('/login?error=invalid_email_domain', request.url))
    return clearSupabaseCookies(request, errorResponse)
  }

  // ตรวจสอบสิทธิ์ของโดเมน
  let isAllowed = false

  // 1. ตรวจสอบกับ Environment Variable (Fallback)
  const envDomains = process.env.ALLOWED_DOMAINS_FALLBACK
    ? process.env.ALLOWED_DOMAINS_FALLBACK.split(',').map((d) => d.trim().toLowerCase())
    : []

  if (envDomains.includes(domain)) {
    isAllowed = true
  }

  // 2. ตรวจสอบกับฐานข้อมูล (พร้อม In-Memory Cache เพื่อลด DB Hit)
  if (!isAllowed) {
    try {
      const now = Date.now()
      
      // ตรวจสอบว่า Cache ยังใช้ได้อยู่หรือไม่
      if (!cachedDomains || (now - cachedDomains.fetchedAt) > CACHE_TTL_MS) {
        const { data: domainList } = await supabase
          .from('allowed_domains')
          .select('domain')

        cachedDomains = {
          domains: new Set((domainList || []).map(d => d.domain?.toLowerCase())),
          fetchedAt: now
        }
      }

      if (cachedDomains.domains.has(domain)) {
        isAllowed = true
      }
    } catch (err) {
      console.error('Error verifying allowed domain in database:', err)
    }
  }

  // บล็อกสิทธิ์และทำลายเซสชันทันทีหากโดเมนไม่ตรงเงื่อนไข
  if (!isAllowed) {
    await supabase.auth.signOut()
    const errorResponse = NextResponse.redirect(new URL('/login?error=domain_not_allowed', request.url))
    return clearSupabaseCookies(request, errorResponse)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
