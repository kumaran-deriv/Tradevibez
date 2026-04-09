import { NextRequest, NextResponse } from "next/server";

// OAuth callback — receives authorization code from Deriv
// Redirects to frontend with the code so client can trigger token exchange
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Build origin from headers — Netlify serverless functions may have
  // a different internal request.url than the public site URL
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const origin = `${proto}://${host}`;

  if (error) {
    const description = searchParams.get("error_description") || "Authentication failed";
    return NextResponse.redirect(
      new URL(`/?auth_error=${encodeURIComponent(description)}`, origin)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/?auth_error=Missing+authorization+code", origin)
    );
  }

  // Redirect to frontend with code + state for client-side token exchange
  return NextResponse.redirect(
    new URL(`/?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`, origin)
  );
}
