import { NextRequest, NextResponse } from "next/server";
import { DERIV_TOKEN_URL } from "@/lib/constants";

// Server-side token exchange — keeps code_verifier secure
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      code: string;
      code_verifier: string;
      redirect_uri: string;
    };

    const { code, code_verifier, redirect_uri } = body;

    if (!code || !code_verifier || !redirect_uri) {
      return NextResponse.json(
        { error: { code: "InvalidRequest", message: "Missing required fields" } },
        { status: 400 }
      );
    }

    const appId = process.env.DERIV_APP_ID || "1089";

    const response = await fetch(DERIV_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        code_verifier,
        redirect_uri,
        client_id: appId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: { code: "TokenExchangeFailed", message: data.error_description || "Token exchange failed" } },
        { status: response.status }
      );
    }

    // Return token to client — client stores it
    return NextResponse.json({
      access_token: data.access_token,
      expires_in: data.expires_in,
      token_type: data.token_type,
    });
  } catch {
    return NextResponse.json(
      { error: { code: "ServerError", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
