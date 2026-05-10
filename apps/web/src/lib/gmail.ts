import { gmail } from "@cfo-ai/integrations";

export const GMAIL_STATE_COOKIE = "gmail_oauth_state";

export function getGmailConfig(): gmail.GmailOAuthConfig {
  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GMAIL_OAUTH_CLIENT_SECRET;
  const redirectUri =
    process.env.GMAIL_OAUTH_REDIRECT_URI ??
    `${process.env.APP_URL ?? "http://localhost:3000"}/api/gmail/callback`;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GMAIL_OAUTH_CLIENT_ID and GMAIL_OAUTH_CLIENT_SECRET are required",
    );
  }
  return { clientId, clientSecret, redirectUri };
}
