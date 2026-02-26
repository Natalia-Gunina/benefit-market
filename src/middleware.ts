import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Demo mode: bypass auth when NEXT_PUBLIC_DEMO_MODE is set
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/dashboard/employee/catalog", request.url));
    }
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", pathname);
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

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
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
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

  // Refresh session — important for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // --- Public routes: /auth/* ---
  if (pathname.startsWith("/auth")) {
    // If user is already authenticated, redirect to their dashboard
    if (user) {
      const role = getUserRole(user);
      const dashboardUrl = getDashboardByRole(role);
      return NextResponse.redirect(new URL(dashboardUrl, request.url));
    }
    return supabaseResponse;
  }

  // --- No session → redirect to login ---
  if (!user) {
    const redirectUrl = new URL("/auth/login", request.url);
    redirectUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  const role = getUserRole(user);

  // --- Root page → redirect to appropriate dashboard ---
  if (pathname === "/") {
    const dashboardUrl = getDashboardByRole(role);
    return NextResponse.redirect(new URL(dashboardUrl, request.url));
  }

  // --- Route protection by role ---

  // /dashboard/admin/* — admin only
  if (pathname.startsWith("/dashboard/admin")) {
    if (role !== "admin") {
      return NextResponse.redirect(
        new URL(getDashboardByRole(role), request.url)
      );
    }
    return supabaseResponse;
  }

  // /dashboard/hr/* — hr or admin
  if (pathname.startsWith("/dashboard/hr")) {
    if (role !== "hr" && role !== "admin") {
      return NextResponse.redirect(
        new URL(getDashboardByRole(role), request.url)
      );
    }
    return supabaseResponse;
  }

  // /dashboard/employee/* — any authenticated user
  if (pathname.startsWith("/dashboard/employee")) {
    return supabaseResponse;
  }

  // All other routes — allow authenticated users
  return supabaseResponse;
}

function getUserRole(user: { user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> }): string {
  const role =
    user.app_metadata?.role ?? user.user_metadata?.role ?? "employee";
  return role as string;
}

function getDashboardByRole(role: string): string {
  switch (role) {
    case "admin":
      return "/dashboard/admin";
    case "hr":
      return "/dashboard/hr";
    default:
      return "/dashboard/employee";
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
