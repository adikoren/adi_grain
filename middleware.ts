import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    // Admin-only routes
    if (pathname.startsWith('/admin') && token?.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/', req.url))
    }

    // Manager+ routes
    if (
      pathname.startsWith('/manager') &&
      token?.role !== 'MANAGER' &&
      token?.role !== 'ADMIN'
    ) {
      return NextResponse.redirect(new URL('/', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: ['/((?!login|invite|api/auth|_next/static|_next/image|favicon.ico|public).*)'],
}
