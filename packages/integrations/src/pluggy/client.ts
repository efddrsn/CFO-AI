import type {
  PluggyAccount,
  PluggyAuthResponse,
  PluggyConnectTokenResponse,
  PluggyItem,
  PluggyPagedResult,
  PluggyTransaction,
} from "./types";

export interface PluggyClientOptions {
  clientId: string;
  clientSecret: string;
  baseUrl?: string;
}

const DEFAULT_BASE = "https://api.pluggy.ai";

/**
 * Cliente HTTP da Pluggy.
 * Mantém apiKey em memória; renova se a próxima chamada receber 401.
 */
export class PluggyClient {
  private apiKey: string | null = null;
  private apiKeyExpiry = 0; // epoch ms
  readonly baseUrl: string;

  constructor(private readonly opts: PluggyClientOptions) {
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE;
  }

  private async getApiKey(): Promise<string> {
    if (this.apiKey && Date.now() < this.apiKeyExpiry) return this.apiKey;
    const res = await fetch(`${this.baseUrl}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: this.opts.clientId,
        clientSecret: this.opts.clientSecret,
      }),
    });
    if (!res.ok) {
      throw new Error(
        `Pluggy auth failed: ${res.status} ${await res.text().catch(() => "")}`,
      );
    }
    const json = (await res.json()) as PluggyAuthResponse;
    this.apiKey = json.apiKey;
    // ApiKey vale 2h; refresh com 5min de margem.
    this.apiKeyExpiry = Date.now() + (2 * 60 - 5) * 60_000;
    return this.apiKey;
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
    retry = true,
  ): Promise<T> {
    const apiKey = await this.getApiKey();
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
        ...(init.headers ?? {}),
      },
    });
    if (res.status === 401 && retry) {
      this.apiKey = null;
      return this.request<T>(path, init, false);
    }
    if (!res.ok) {
      throw new Error(
        `Pluggy ${init.method ?? "GET"} ${path} failed: ${res.status} ${await res
          .text()
          .catch(() => "")}`,
      );
    }
    return (await res.json()) as T;
  }

  /**
   * Força uma autenticação imediata pra validar credenciais.
   * Use no startup de workers/CLIs pra falhar cedo quando clientId/secret
   * estão errados, em vez de só descobrir no primeiro item sincronizado.
   */
  async verifyAuth(): Promise<void> {
    this.apiKey = null;
    await this.getApiKey();
  }

  /**
   * Cria um connect_token pro widget Pluggy Connect (client-side).
   * Opcional: `clientUserId` pra rastreabilidade; `itemId` pra atualizar item existente.
   */
  async createConnectToken(opts?: {
    clientUserId?: string;
    itemId?: string;
  }): Promise<string> {
    const body: Record<string, unknown> = {};
    if (opts?.clientUserId) body.clientUserId = opts.clientUserId;
    if (opts?.itemId) body.itemId = opts.itemId;
    const res = await this.request<PluggyConnectTokenResponse>(
      "/connect_token",
      { method: "POST", body: JSON.stringify(body) },
    );
    return res.accessToken;
  }

  async getItem(itemId: string): Promise<PluggyItem> {
    return this.request<PluggyItem>(`/items/${itemId}`);
  }

  /** Dispara refresh do item (puxa dados frescos da instituição). Operação assíncrona. */
  async refreshItem(itemId: string): Promise<PluggyItem> {
    return this.request<PluggyItem>(`/items/${itemId}`, { method: "PATCH" });
  }

  async listAccounts(itemId: string): Promise<PluggyAccount[]> {
    const res = await this.request<PluggyPagedResult<PluggyAccount>>(
      `/accounts?itemId=${encodeURIComponent(itemId)}`,
    );
    return res.results;
  }

  /**
   * Lista transações de uma conta. Pagina até pegar tudo (até `maxPages`).
   * `from`/`to` em ISO yyyy-mm-dd.
   */
  async listTransactions(
    accountId: string,
    opts?: { from?: string; to?: string; maxPages?: number; pageSize?: number },
  ): Promise<PluggyTransaction[]> {
    const pageSize = opts?.pageSize ?? 500;
    const maxPages = opts?.maxPages ?? 20;
    const all: PluggyTransaction[] = [];

    for (let page = 1; page <= maxPages; page++) {
      const params = new URLSearchParams({
        accountId,
        pageSize: String(pageSize),
        page: String(page),
      });
      if (opts?.from) params.set("from", opts.from);
      if (opts?.to) params.set("to", opts.to);

      const res = await this.request<PluggyPagedResult<PluggyTransaction>>(
        `/transactions?${params.toString()}`,
      );
      all.push(...res.results);
      if (page >= res.totalPages) break;
    }
    return all;
  }
}
