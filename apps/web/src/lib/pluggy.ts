import { pluggy } from "@cfo-ai/integrations";

let _client: pluggy.PluggyClient | null = null;

export function getPluggyClient(): pluggy.PluggyClient {
  if (_client) return _client;
  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "PLUGGY_CLIENT_ID and PLUGGY_CLIENT_SECRET are required",
    );
  }
  _client = new pluggy.PluggyClient({ clientId, clientSecret });
  return _client;
}
