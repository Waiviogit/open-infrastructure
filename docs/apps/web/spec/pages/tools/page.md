---
id: web-pages-tools
title: Tools hub
description: Personal tools area (Edit profile, Notifications settings, Drafts, Settings). Not in hub section nav; reachable via direct URL or avatar menu.
type: spec
status: active
scope: web
tags: [web, page, tools]
updated_at: 2026-11-19
related:
  - docs/apps/web/spec/pages/index.md
  - docs/apps/web/spec/pages/drafts/page.md
  - docs/apps/web/spec/pages/notifications/settings.md
  - docs/apps/web/spec/pages/settings/edit-profile.md
---

# Tools hub

**Back:** [site map](index.md)

## Routes

| URL | Content |
|-----|---------|
| `/tools` | Redirects to `/notifications/settings` |
| `/edit-profile` | Hive account profile form (auth required) — [edit-profile.md](../settings/edit-profile.md) |
| `/drafts` | Post drafts list (auth required) |
| `/notifications/settings` | Notification toggles + Telegram link |
| `/settings` | Locale, theme, and shell mode preferences |

All of them use the hub layout (FEED / DISCOVER / MARKET section nav above) and the **Personal:** left sidebar, in this order: **Edit profile**, **Notifications**, **Drafts**, **Settings**. TOOLS is not a section-nav tab; open via `/tools`, `/edit-profile`, `/drafts`, `/notifications/settings`, `/settings`, the avatar menu **Settings** link, or the own-profile header **Edit profile** button.

Implementation: [`apps/web/src/modules/tools/`](../../../../apps/web/src/modules/tools/), layout at [`(hub)/(tools-shell)/layout.tsx`](../../../../apps/web/src/app/(app)/(hub)/(tools-shell)/layout.tsx).

## Avatar menu

- **Settings** → `/settings` (entry into tools-shell; the other tools via the `ToolsLayoutNav` sidebar)
- **Wallet** → `/@:username/transfers?type=WAIV`
- **Earn** removed from menu

`/notifications` feed remains outside the tools shell (no sidebar).
