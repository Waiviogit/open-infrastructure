---
id: web-business-ui-building-blocks
title: Business (Market) UI building blocks
description: Shared buttons, fields, cards, tabs, modals and states for /business screens.
type: spec
status: active
scope: web
tags: [web, business, obl, ui]
updated_at: 2026-11-19
related:
  - docs/apps/web/spec/pages/business/overview.md
  - docs/apps/web/spec/theme.md
---

# Business (Market) UI building blocks

**Back:** [Business overview](overview.md)

Market screens compose `modules/business/presentation/ui/` instead of ad-hoc class strings:

| Block | Use |
|-------|-----|
| `businessButtonClass` / `BusinessButton` | Primary, secondary, ghost, quiet (neutral row actions such as Remove), destructive; `busy` spinner; ≥40px (44px below `lg`) |
| `BusinessBreadcrumbs` | Trail above entity pages; below `sm` only the parent stays, as a 44px `‹ Parent` back link |
| `BUSINESS_FIELD_CLASS` / `BusinessField` | Inputs, selects, textareas with label, hint and field error |
| `businessCardClass` | Card surface (Feed / Discover recipe); `interactive` when the whole card is the link |
| `BusinessSubTabs` | Underlined, scrolling, optimistic sub-tabs (`profileSectionTabClass('sub')`) |
| `BusinessFormModal` / `BusinessConfirmDialog` | Action modals: close only after a successful broadcast; confirmations for irreversible on-chain actions |
| `BusinessEmptyState` / `BusinessErrorState` / `BusinessActionError` | Empty lists, load failures (retry), failed broadcasts |
| `CopyableId` | Technical ids as secondary info (shortened, copy button) |

Money goes through `formatUsd` (`domain/usd-format.ts`, deterministic `$1,234.56` / `−$5.00`); contract labels through `contractDisplayLabel` (`domain/contract-label.ts`). Status badges (`StateBadge`) are neutral pills with a coloured dot.
