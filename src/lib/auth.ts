import { DERIV_APP_ID, DERIV_AUTH_URL, OAUTH_SCOPES } from "@/lib/constants";

// Generate cryptographically random string for PKCE
function generateRandomString(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => chars[byte % chars.length]).join("");
}

// SHA-256 hash → base64url encoding for code_challenge
async function sha256Base64url(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function generatePKCE(): Promise<{
  codeVerifier: string;
  codeChallenge: string;
  state: string;
}> {
  const codeVerifier = generateRandomString(64);
  const codeChallenge = await sha256Base64url(codeVerifier);
  const state = generateRandomString(32);
  return { codeVerifier, codeChallenge, state };
}

export function buildAuthUrl(
  codeChallenge: string,
  state: string,
  redirectUri: string
): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: DERIV_APP_ID,
    redirect_uri: redirectUri,
    scope: OAUTH_SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${DERIV_AUTH_URL}?${params.toString()}`;
}

// Store/retrieve PKCE params in sessionStorage
export function storePKCE(codeVerifier: string, state: string): void {
  sessionStorage.setItem("deriv_code_verifier", codeVerifier);
  sessionStorage.setItem("deriv_state", state);
}

export function retrievePKCE(): { codeVerifier: string | null; state: string | null } {
  return {
    codeVerifier: sessionStorage.getItem("deriv_code_verifier"),
    state: sessionStorage.getItem("deriv_state"),
  };
}

export function clearPKCE(): void {
  sessionStorage.removeItem("deriv_code_verifier");
  sessionStorage.removeItem("deriv_state");
}
