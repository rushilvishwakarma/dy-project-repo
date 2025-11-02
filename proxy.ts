import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthCallback = request.nextUrl.pathname === "/auth/callback";
  const isAuthError = request.nextUrl.pathname === "/auth/error";
  const isPublicRoute = 
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname === "/callback" ||
    request.nextUrl.pathname.startsWith("/api/auth/login") ||
    isAuthCallback ||
    isAuthError;

  // Allow auth callback and error pages without authentication
  if (isAuthCallback || isAuthError) {
    return supabaseResponse;
  }

  // If user is not signed in and the current path is not a public route, redirect to home
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // If user is signed in and trying to access home, redirect to dashboard
  // BUT: Skip this redirect if there's a hash fragment (OAuth tokens in URL)
  const hasHashFragment = request.nextUrl.hash && request.nextUrl.hash.includes("access_token");
  if (user && request.nextUrl.pathname === "/" && !hasHashFragment) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
