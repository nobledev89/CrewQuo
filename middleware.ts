import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Check if the request is for a dashboard route
  if (pathname.startsWith('/dashboard')) {
    // Check for Firebase auth token in cookies
    // Firebase sets cookies with patterns like firebase-auth-*
    const cookies = request.cookies
    let hasAuthCookie = false
    
    // Check for any Firebase auth-related cookies
    cookies.getAll().forEach((cookie) => {
      if (cookie.name.startsWith('firebase-auth-') || cookie.name === 'auth-token') {
        hasAuthCookie = true
      }
    })
    
    // If no auth cookie exists, redirect to login
    if (!hasAuthCookie) {
      const loginUrl = new URL('/login', request.url)
      // Add a redirect parameter so user can return after login
      loginUrl.searchParams.set('from', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/super-admin/:path*',
  ],
}
