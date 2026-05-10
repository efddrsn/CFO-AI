import {
  type GmailOAuthConfig,
  refreshAccessToken,
} from "./oauth";
import type {
  GmailAttachment,
  GmailListMessagesResponse,
  GmailMessage,
  GmailOAuthTokens,
} from "./types";

const API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export interface GmailClientCredentials {
  accessToken: string;
  refreshToken: string;
  /** Epoch ms quando o access_token expira; refresh automático se < now + 60s */
  expiresAt: number;
}

/**
 * Cliente Gmail com refresh automático de access_token.
 * Pra usar:
 *   const c = new GmailClient(cfg, creds, onRefresh)
 *   onRefresh é chamado quando o token foi rotacionado — use pra persistir.
 */
export class GmailClient {
  constructor(
    private readonly cfg: GmailOAuthConfig,
    private creds: GmailClientCredentials,
    private readonly onRefresh: (tokens: GmailOAuthTokens) => Promise<void>,
  ) {}

  private async getAccessToken(): Promise<string> {
    if (Date.now() < this.creds.expiresAt - 60_000) {
      return this.creds.accessToken;
    }
    const fresh = await refreshAccessToken(this.cfg, this.creds.refreshToken);
    this.creds = {
      accessToken: fresh.access_token,
      refreshToken: fresh.refresh_token ?? this.creds.refreshToken,
      expiresAt: Date.now() + fresh.expires_in * 1000,
    };
    await this.onRefresh(fresh);
    return this.creds.accessToken;
  }

  private async req<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.getAccessToken();
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      throw new Error(
        `Gmail ${init.method ?? "GET"} ${path} failed: ${res.status} ${await res
          .text()
          .catch(() => "")}`,
      );
    }
    return (await res.json()) as T;
  }

  /**
   * Lista até `maxResults` IDs de mensagens que casam com a query Gmail.
   * Use `pageToken` pra paginar. Query syntax:
   * https://support.google.com/mail/answer/7190
   */
  async listMessages(
    query: string,
    opts: { maxResults?: number; pageToken?: string } = {},
  ): Promise<GmailListMessagesResponse> {
    const params = new URLSearchParams({
      q: query,
      maxResults: String(opts.maxResults ?? 100),
    });
    if (opts.pageToken) params.set("pageToken", opts.pageToken);
    return this.req<GmailListMessagesResponse>(`/messages?${params}`);
  }

  /** Itera por todas as páginas. */
  async listAllMessages(
    query: string,
    opts: { maxTotal?: number; pageSize?: number } = {},
  ): Promise<string[]> {
    const maxTotal = opts.maxTotal ?? 500;
    const pageSize = opts.pageSize ?? 100;
    const ids: string[] = [];
    let pageToken: string | undefined;
    while (ids.length < maxTotal) {
      const page = await this.listMessages(query, {
        maxResults: Math.min(pageSize, maxTotal - ids.length),
        pageToken,
      });
      for (const m of page.messages ?? []) ids.push(m.id);
      if (!page.nextPageToken) break;
      pageToken = page.nextPageToken;
    }
    return ids;
  }

  async getMessage(id: string, format: "full" | "metadata" | "minimal" = "full"): Promise<GmailMessage> {
    return this.req<GmailMessage>(`/messages/${id}?format=${format}`);
  }

  async getAttachment(
    messageId: string,
    attachmentId: string,
  ): Promise<GmailAttachment> {
    return this.req<GmailAttachment>(
      `/messages/${messageId}/attachments/${attachmentId}`,
    );
  }
}

// ---------- helpers de payload ---------------------------------------------

export function getHeader(msg: GmailMessage, name: string): string | undefined {
  const headers = msg.payload?.headers ?? [];
  const target = name.toLowerCase();
  return headers.find((h) => h.name.toLowerCase() === target)?.value;
}

/** Decode base64url (Gmail) to UTF-8 string. */
export function decodeBody(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
    "utf-8",
  );
}

/** Walk all parts and yield each one (depth-first). */
export function* walkParts(part: import("./types").GmailPart | undefined): Generator<import("./types").GmailPart> {
  if (!part) return;
  yield part;
  for (const child of part.parts ?? []) yield* walkParts(child);
}

/** Extrai texto plain do email (concat de todas as partes text/plain). */
export function extractPlainText(msg: GmailMessage): string {
  const chunks: string[] = [];
  for (const p of walkParts(msg.payload)) {
    if (p.mimeType === "text/plain" && p.body.data) {
      chunks.push(decodeBody(p.body.data));
    }
  }
  return chunks.join("\n\n");
}

/** Extrai HTML do email (concat). */
export function extractHtml(msg: GmailMessage): string {
  const chunks: string[] = [];
  for (const p of walkParts(msg.payload)) {
    if (p.mimeType === "text/html" && p.body.data) {
      chunks.push(decodeBody(p.body.data));
    }
  }
  return chunks.join("\n\n");
}

/** Lista anexos (PDF, etc). */
export function listAttachments(msg: GmailMessage): Array<{
  filename: string;
  mimeType: string;
  attachmentId: string;
  size: number;
}> {
  const out: Array<{ filename: string; mimeType: string; attachmentId: string; size: number }> = [];
  for (const p of walkParts(msg.payload)) {
    if (p.filename && p.body.attachmentId) {
      out.push({
        filename: p.filename,
        mimeType: p.mimeType,
        attachmentId: p.body.attachmentId,
        size: p.body.size,
      });
    }
  }
  return out;
}
