# @cfo-ai/mcp

MCP server expondo as tools do CFO-AI. Conecte-o ao Claude Desktop, Claude
Code ou Cursor pra conversar com seu CFO.

## Tools (Fase 0)

- `list_accounts`
- `list_transactions(from_date, to_date, account_id, limit)`
- `list_pending_syncs`
- `approve_sync(sync_log_id)`
- `reject_sync(sync_log_id)`
- `expense_summary(from_date, to_date)`

Mais tools entram nas Fases 1-5 (ver SPEC §5).

## Configurar Claude Desktop

Adicione ao `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cfo-ai": {
      "command": "node",
      "args": ["/caminho/absoluto/para/CFO-AI/apps/mcp/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://..."
      }
    }
  }
}
```

Build: `pnpm --filter @cfo-ai/mcp build`.
