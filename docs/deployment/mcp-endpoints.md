---
id: docs-deployment-mcp-endpoints
title: Public MCP endpoints
description: Public URLs of the MCP servers behind nginx and what a plain GET on them returns.
type: spec
status: active
scope: platform
tags: [platform, deployment, mcp, nginx]
updated_at: 2026-11-25
related:
  - docs/apps/knowledge-api/spec/overview.md
  - docs/apps/query-api/spec/mcp.md
---

# Public MCP endpoints

All MCP servers use Streamable HTTP, stateless, no auth. JSON-RPC goes in with `POST`; every request needs `Content-Type: application/json` and `Accept: application/json, text/event-stream`.

| Server | Public URL | Local URL | Answers GET |
|--------|------------|-----------|-------------|
| knowledge-api (docs, specs, skills) | `https://<site>/mcp` | `http://localhost:7400/mcp` | app |
| query-api (live data) | `https://<site>/query/mcp` | `http://localhost:7000/query/mcp` | app |
| vip-tickets | `https://<site>/vip-tickets/mcp` | — (not in this repo) | nginx |

**Breaking change (2026-11-25):** knowledge MCP moved from `/knowledge/mcp` to `/mcp`. The old path is removed (no alias, no redirect) and returns 404. Other knowledge-api routes keep the `/knowledge` prefix (`GET /knowledge/health`).

## GET on an MCP URL

Agents often open the URL with GET first. A bare 403 made them conclude the server is closed, so GET is allowed and explains itself:

| Request | Response |
|---------|----------|
| `GET` with `Accept` containing `text/event-stream` (an MCP client asking for an SSE stream) | **405**, `Allow: POST`, JSON-RPC error `-32000` "Method not allowed: stateless MCP server, no SSE stream…" (MCP spec answer) |
| Any other `GET` / `HEAD` (agent web-fetch, curl, browser) | **200** `text/markdown`, `X-Robots-Tag: noindex`: what the server is, client config snippet with the absolute URL, a `curl` `initialize` example, first steps, related servers |

A 200 is used for the guide because many agent fetch tools drop the body of a 4xx and report only the status.

- Apps: `respondToMcpGet` in `libs/clients/src/mcp-http/mcp-get-guide.ts`; per-server text in `apps/knowledge-api/src/constants/mcp.ts` and `apps/query-api/src/constants/mcp.constants.ts`. The absolute URL comes from `X-Forwarded-Proto` + `Host`; an invalid `Host` falls back to the path.
- vip-tickets: `map $vip_tickets_mcp_get` and the `@vip_tickets_mcp_*` named locations in `nginx/conf.d/default.conf.template`.

nginx allows `GET POST OPTIONS` on all three locations (`OPTIONS` for CORS preflight); other methods get 403.
