---
id: web-components-modal-shell
title: ModalShell
description: "Shared portaled dialog for apps/web: scroll architecture, variants, and keyboard behaviour (initial focus, Tab containment, Escape for the top-most dialog, focus return)."
type: spec
status: active
scope: web
tags: [web, components, a11y]
updated_at: 2026-11-19
related:
  - docs/apps/web/spec/overview.md
  - docs/apps/web/spec/web-conventions.md
---

# ModalShell (shared)

**Back:** [web overview](../overview.md) · **Rules:** [apps/web/AGENTS.md → Modals and overlays](../../../../../apps/web/AGENTS.md)

## Purpose

Every portaled `role="dialog"` in `apps/web` renders through `ModalShell` (or `AppModal`, which wraps it). The scroll architecture and the variants (`dialog`, `fullscreen`, `sheet`) are rules in `apps/web/AGENTS.md`; this page covers keyboard behaviour.

## Code locations

| Piece | Path |
|-------|------|
| Component | `apps/web/src/shared/presentation/components/modal-shell.tsx` |
| Keyboard helpers (dialog stack, focusables, open-popup check) | `apps/web/src/shared/presentation/components/modal-shell-focus.ts` |
| Tests | `apps/web/src/shared/presentation/components/modal-shell.spec.tsx` |

## Keyboard

| Moment | Behaviour |
|--------|-----------|
| Open | Focus moves to the dialog panel (`tabIndex=-1`, announced with its label), unless a child already took focus with `autoFocus`. `preventScroll`, and no input is focused, so mobile keyboards stay closed. |
| Tab / Shift+Tab | Cycle through the focusable elements of the panel and its optional `aside`; focus never walks the page behind the scrim. |
| Escape | Closes the **top-most** open dialog only (an open-dialog stack), when `closeOnEscape` is true. Skipped when the event was `defaultPrevented`, during IME composition, or while an element inside the dialog has `aria-expanded="true"`: an open select, menu or combobox takes that Escape and the next one closes the dialog. |
| Close | Focus returns to the element that was focused when the dialog opened, if it is still in the document. |

Other keys stay inside the dialog (`stopPropagation`), so page shortcuts do not fire while it is open.

## Rules for content inside a dialog

- Popups (selects, menus, comboboxes) set `aria-expanded` on their trigger: that is how `ModalShell` leaves Escape to them.
- Do not add a `window` Escape listener for a dialog: `ModalShell` owns Escape and focus. A component that keeps its own listener (the gallery viewer) must skip Escape while a dialog above it is open.
