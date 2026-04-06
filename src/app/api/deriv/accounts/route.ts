import { NextRequest, NextResponse } from "next/server";
import { DERIV_REST_BASE } from "@/lib/constants";

// Fetch all trading accounts for authenticated user
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json(
        { error: { code: "Unauthorized", message: "Missing authorization header" } },
        { status: 401 }
      );
    }

    const appId = process.env.DERIV_APP_ID || "1089";

    const response = await fetch(
      `${DERIV_REST_BASE}/trading/v1/options/accounts`,
      {
        headers: {
          "Deriv-App-ID": appId,
          Authorization: authHeader,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: { code: "FetchFailed", message: "Failed to fetch accounts" } },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: { code: "ServerError", message: "Internal server error" } },
      { status: 500 }
    );
  }
}
