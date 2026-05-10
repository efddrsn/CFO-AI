import type { GmailOAuthTokens, GmailUserProfile } from "./types";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export interface GmailOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function buildAuthUrl(
  cfg: GmailOAuthConfig,
  opts: { state: string; loginHint?: string },
): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline", // pra receber refresh_token
    prompt: "consent", // força refresh_token mesmo em re-autorizações
    state: opts.state,
    include_granted_scopes: "true",
  });
  if (opts.loginHint) params.set("login_hint", opts.loginHint);
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  cfg: GmailOAuthConfig,
  code: string,
): Promise<GmailOAuthTokens> {
  const body = new URLSearchParams({
    code,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(
      `Google token exchange failed: ${res.status} ${await res.text().catch(() => "")}`,
    );
  }
  return (await res.json()) as GmailOAuthTokens;
}

export async function refreshAccessToken(
  cfg: GmailOAuthConfig,
  refreshToken: string,
): Promise<GmailOAuthTokens> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    grant_type: "refresh_token",
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(
      `Google refresh failed: ${res.status} ${await res.text().catch(() => "")}`,
    );
  }
  return (await res.json()) as GmailOAuthTokens;
}

export async function getUserProfile(
  accessToken: string,
): Promise<GmailUserProfile> {
  const res = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    throw new Error(`Gmail profile fetch failed: ${res.status}`);
  }
  return (await res.json()) as GmailUserProfile;
}
