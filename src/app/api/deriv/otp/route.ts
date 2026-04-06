import { NextRequest, NextResponse } from "next/server";
import { DERIV_REST_BASE } from "@/lib/constants";

// Generate OTP for authenticated WebSocket connection
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      account_id: string;
      access_token: string;
    };

    const { account_id, access_token } = body;

    if (!account_id || !access_token) {
      return NextResponse.json(
        { error: { code: "InvalidRequest", message: "Missing account_id or access_token" } },
        { status: 400 }
      );
    }

    const appId = process.env.DERIV_APP_ID || "1089";

    const response = await fetch(
      `${DERIV_REST_BASE}/trading/v1/options/accounts/${account_id}/otp`,
      {
        method: "POST",
        headers: {
          "Deriv-App-ID": appId,
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: { code: "OTPFailed", message: data.error?.message || "Failed to generate OTP" } },
        { status: response.status }
      );
    }

    return NextResponse.json({ url: data.data.url });
  } catch {
    return NextResponse.json(
      { error: { code: "ServerError", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
