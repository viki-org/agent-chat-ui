import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Check if accessing root path without query parameters from ops-gpt.viki.net
  const url = request.nextUrl;
  const hostname = request.headers.get("host") || "";

  if (
    hostname === "ops-gpt.viki.net" &&
    url.pathname === "/" &&
    !url.searchParams.has("apiUrl") &&
    !url.searchParams.has("assistantId")
  ) {
    // Redirect to the same URL with required query parameters
    const redirectUrl = new URL(url);
    redirectUrl.searchParams.set("apiUrl", "https://ops-gpt.viki.net");
    redirectUrl.searchParams.set("assistantId", "agent");
    return NextResponse.redirect(redirectUrl);
  }

  const response = NextResponse.next();
  const user_id = request.headers.get("X-Goog-Authenticated-User-Id");
  const email = request.headers.get("X-Goog-Authenticated-User-Email");

  if (user_id) {
    response.cookies.set("gcp_iap_uid", user_id, {
      httpOnly: false, // so it can be read by client-side script
    });
  }
  if (email) {
    response.cookies.set("gcp_iap_email", email, {
      httpOnly: false, // so it can be read by client-side script
    });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
