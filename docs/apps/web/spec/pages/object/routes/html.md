---
id: web-pages-object-routes-html
title: Object page — HTML tab
description: "html objects open on an HTML tab: the htmlContent page in a sandboxed iframe; in edit mode, the app editor with a preview step that publishes a new htmlContent update."
type: spec
status: active
scope: web
tags: [web, page, object, html]
updated_at: 2026-11-18
related:
  - docs/apps/web/spec/pages/object/navigation.md
  - docs/apps/web/spec/pages/object/page-shell.md
  - docs/apps/web/spec/pages/object/routes/edit-mode.md
  - docs/apps/web/spec/pages/editor/page.md
---

# Object page — HTML tab

**Back:** [page shell](../page-shell.md) · **Related:** [navigation](../navigation.md), [edit mode](edit-mode.md), [editor](../../editor/page.md)

An `html` object is a standalone web page (HTML, CSS and JavaScript) stored in its `htmlContent` update (localizable, single value; query-api picks the winner per locale).

## Tab and URL

| Item | Behavior |
|------|----------|
| Tab | **HTML**, first primary tab, before Social (`HTML_PRIMARY_TAB_SEGMENT = 'html'`) |
| Default landing | `primaryTab: html` — opens at the clean `/object/:id` URL. There is no `/object/:id/html` path |
| Legacy URL | `/object/:id/code` (Waivio) → **308** to `/object/:id` in `proxy.ts`, query kept |
| Layout | No right rail on this tab, in view and edit mode: the page spans the center and right columns (`objectPageHidesRightRail` → `ObjectViewShell hideRightRail`, grid modifier `.shell-object-page-grid--no-right-rail` in `theme.css`) |

## View

`ObjectHtmlContent` renders the page with `HtmlSandboxFrame`:

- **Source.** `projectedHtmlContent` strips what legacy editors wrapped around the page: a markdown fence (```` ```javascript … ``` ````), a `<pre><code>` block, or fully escaped markup (`normalizeHtmlContentSource`).
- **Isolation.** The page is untrusted on-chain HTML. It runs in an `iframe srcdoc` with `sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"` — never `allow-same-origin`, so its scripts run in an opaque origin and cannot read the app's cookies, storage or DOM. Nothing is injected into the parent document. The parent CSP (`form-action 'self'`) also applies inside, so forms cannot post to other sites.
- **Bootstrap.** `buildHtmlSandboxDocument` adds one script at the top of `<head>` (a fragment is wrapped in a minimal document): links without a target open in a new tab (the sandbox has no top navigation), and the document height is posted to the parent.
- **Height.** The frame is always as tall as its content and never scrolls itself (`overflow: hidden` on its root). The bootstrap measures the bottom of the body's children, not `scrollHeight` (which never drops below the frame's own height, so the frame could not shrink back), and posts it on DOM ready, image/font loads, DOM changes and resizes. The parent accepts resize messages only from its own frame's window (`parseHtmlSandboxResizeMessage`), within 320–50 000 px.
- **First paint.** The frame is client-only: its document is built with the window height (for `vh`), which the server does not know. Until the page reports `complete` (images and fonts loaded) or 1.5 s pass, the frame is invisible behind a placeholder; it then appears once at its height instead of growing in steps. On window resize the parent sends the new height; the frame updates `--odl-vh` and re-measures.
- **`vh`.** Inside an auto-sized frame `vh` is a share of the frame, so a `100vh` section would grow the frame forever. In the page's CSS (`<style>` blocks, `style` attributes) `vh`/`dvh`/`svh`/`lvh` lengths become `calc(var(--odl-vh) * N)`, where `--odl-vh` is 1% of the app window (not the screen) — the page looks as it would in its own tab. `vh` set from scripts is not rewritten.
- **Empty.** No `htmlContent` → "This page has no HTML yet."

## Edit (edit mode, signed in)

In edit mode the tab shows `ObjectHtmlEditor` instead of the page:

1. **Edit** — the one app editor (in a column without `FeedColumn`'s `overflow-x-clip`, so the insert `+` on the editor's edge is not cut off) (`LexicalPostEditor`) seeded with the current page in a single `html` code block (`buildHtmlEditorMarkdown` picks a fence longer than any backtick run in the page).
2. **Preview** — the body goes through `editorBodyToMarkdown`, then `extractHtmlFromEditorMarkdown`. Errors (inline, `role="alert"`): empty page; text outside the code block or several blocks (markdown escaping would corrupt markup and scripts); no HTML tags; nothing changed since the current version. Otherwise the page is shown in the same sandbox as the view, with **Back to editing** (the edit is kept) and **Publish**.
3. **Publish** — a new `htmlContent` update (`buildOdlUpdateCreateOp`, locale picker defaulting to the UI locale) through `broadcastOdlOpWithOverflow` (IPFS batch import when the page exceeds the custom_json limit — no client chunking), then `refreshAfterBroadcast` + `revalidateObjectAfterBroadcast`. The editor stays open with a notice; the tab shows the new page once the update wins.

`#` object search is off inside code blocks in every editor (CSS colors and anchors are not mentions).

## Not covered

- Server-side drafts of unpublished edits (legacy `saveDraftPage`) — an edit lives only until the page is left.
- Vote / follow options on publish (legacy `LikeSection`, `FollowObjectForm`).
- `html` objects opened inside another object's menu (nested `?path=`) still use the nested host content path.
