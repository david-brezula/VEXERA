import { type NextRequest, NextResponse } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

const PUBLIC_ROUTES = ["/", "/login", "/register", "/invite"]

export async function middleware(request: NextRequest) {
  const { user, supabaseResponse } = await updateSession(request)

  const { pathname } = request.nextUrl
  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    route === "/" ? pathname === "/" : pathname.startsWith(route)
  )

  // Authenticated user on landing page: redirect to dashboard
  if (user && pathname === "/") {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  // Authenticated user on login page: redirect to dashboard
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  // Unauthenticated user on protected route: redirect to landing page
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // Authenticated user with no active org: redirect to onboarding
  if (
    user &&
    !isPublicRoute &&
    pathname !== "/onboarding" &&
    !pathname.startsWith("/api/") &&
    !request.cookies.get("active_organization_id")?.value
  ) {
    const url = request.nextUrl.clone()
    url.pathname = "/onboarding"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)",
  ],
}
