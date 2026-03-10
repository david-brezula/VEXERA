import { type NextRequest, NextResponse } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

const PUBLIC_ROUTES = ["/login", "/register", "/invite"]

export async function middleware(request: NextRequest) {
  const { user, supabaseResponse } = await updateSession(request)

  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  )

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url)
  }

  // Authenticated user with no active org: redirect to onboarding
  if (
    user &&
    !isPublicRoute &&
    request.nextUrl.pathname !== "/onboarding" &&
    !request.nextUrl.pathname.startsWith("/api/") &&
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
