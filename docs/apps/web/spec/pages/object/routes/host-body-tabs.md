---
id: web-pages-object-routes-host-body-tabs
title: Object page — HTML, Page and Document tabs
description: "html, page and legal_document objects open on a leading tab that shows their body wide (no right rail); in edit mode, the app editor with a preview step that publishes a new body update."
type: spec
status: active
scope: web
tags: [web, page, object, html, page-content, legal-document]
updated_at: 2026-11-18
related:
  - docs/apps/web/spec/pages/object/navigation.md
  - docs/apps/web/spec/pages/object/page-shell.md
  - docs/apps/web/spec/pages/object/routes/edit-mode.md
  - docs/apps/web/spec/pages/editor/page.md
---

# Object page — HTML, Page and Document tabs

**Back:** [page shell](../page-shell.md) · **Related:** [navigation](../navigation.md), [edit mode](edit-mode.md), [editor](../../editor/page.md)

Some object types *are* one body update. They share one tab behavior (`host-body-tab.ts`, `HOST_BODY_TABS`):

| `object_type` | Tab | Update (localizable, single) | Format | Empty view |
|---------------|-----|------------------------------|--------|------------|
| `html` | **HTML** | `htmlContent` | `html` — a standalone web page | "This page has no HTML yet." |
| `page` | **Page** | `pageContent` | `markdown` | "This page has no content yet." |
| `legal_document` | **Document** | `legalText` | `markdown` | "This document has no content yet." |

query-api picks the winning body per locale; the web reads it from the projected fields.

## Tab, URL and layout

| Item | Behavior |
|------|----------|
| Tab | First primary tab, before Social (`segment`: `html`, `page`, `document`) |
| Default landing | `primaryTab: <segment>` at the clean `/object/:id` URL. There is no `/object/:id/<segment>` path |
| Legacy URLs | `/object/:id/code` (Waivio `html`) and `/object/:id/page` (Waivio `page`) → **308** to `/object/:id` in `proxy.ts` (`LEGACY_HOST_BODY_PATH_SEGMENTS`), query kept |
| Layout | No right rail on the tab, in view and edit mode: the body spans the center and right columns (`objectPageHidesRightRail` → `ObjectViewShell hideRightRail`, grid modifier `.shell-object-page-grid--no-right-rail` in `theme.css`) |

`?path=` (nested object in the column) still renders the nested content, not the tab.

## View (`ObjectHostBodyContent`)

**Markdown** (`page`, `legal_document`): `ObjectPageContentBody` — the post body renderer (`sanitizePostBodyHtml`), images open the gallery viewer.

**HTML** (`html`): `HtmlSandboxFrame`.

- **Source.** `projectedHtmlContent` strips what legacy editors wrapped around the page: a markdown fence (```` ```javascript … ``` ````), a `<pre><code>` block, or fully escaped markup (`normalizeHtmlContentSource`).
- **Isolation.** The page is untrusted on-chain HTML. It runs in an `iframe srcdoc` with `sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"` — never `allow-same-origin`, so its scripts run in an opaque origin and cannot read the app's cookies, storage or DOM. Nothing is injected into the parent document. The parent CSP (`form-action 'self'`) also applies inside, so forms cannot post to other sites.
- **Bootstrap.** `buildHtmlSandboxDocument` adds one script at the top of `<head>` (a fragment is wrapped in a minimal document): links without a target open in a new tab (the sandbox has no top navigation), and the content height is posted to the parent.
- **Height.** The frame is always as tall as its content and never scrolls itself (`overflow: hidden` on its root). The bootstrap measures the bottom of the body's children, not `scrollHeight` (which never drops below the frame's own height, so the frame could not shrink back), and posts it on DOM ready, image/font loads, DOM changes and resizes. The parent accepts resize messages only from its own frame's window (`parseHtmlSandboxResizeMessage`), within 320–50 000 px.
- **First paint.** The frame is client-only: its document is built with the window height (for `vh`), which the server does not know. Until the page reports `complete` (images and fonts loaded) or 1.5 s pass, the frame is invisible behind a placeholder; it then appears once at its height instead of growing in steps. On window resize the parent sends the new height; the frame updates `--odl-vh` and re-measures.
- **`vh`.** Inside an auto-sized frame `vh` is a share of the frame, so a `100vh` section would grow the frame forever. In the page's CSS (`<style>` blocks, `style` attributes) `vh`/`dvh`/`svh`/`lvh` lengths become `calc(var(--odl-vh) * N)`, where `--odl-vh` is 1% of the app window (not the screen). `vh` set from scripts is not rewritten.

## Edit (edit mode, signed in) — `ObjectHostBodyEditor`

1. **Edit** — the one app editor (`LexicalPostEditor`, in a column without `FeedColumn`'s `overflow-x-clip`, so the insert `+` on the editor's edge is not cut off). Markdown bodies are imported as they are; an HTML page sits in a single `html` code block (`buildHtmlEditorMarkdown` picks a fence longer than any backtick run in the page).
2. **Preview** — the body goes through `editorBodyToMarkdown`, then `extractHostBodyFromEditorMarkdown`. Errors (inline, `role="alert"`): empty body; for HTML, text outside the code block or several blocks (markdown escaping would corrupt markup and scripts) and no HTML tags; nothing changed since the current version. Otherwise the body is shown with the tab's own renderer, with **Back to editing** (the edit is kept) and **Publish**.
3. **Publish** — a new body update (`buildOdlUpdateCreateOp`, locale picker defaulting to the UI locale) through `broadcastOdlOpWithOverflow` (IPFS batch import when the body exceeds the custom_json limit — no client chunking), then `refreshAfterBroadcast` + `revalidateObjectAfterBroadcast`. The editor stays open with a notice; the tab shows the new body once the update wins.

`#` object search is off inside code blocks in every editor (CSS colors and anchors are not mentions).

**Round trip.** Publishing re-exports the whole body through the editor, so the markdown import must keep what the renderer shows. Over the local `page` bodies most differences are equivalent markdown (`***` → `---`, `*` → `-` bullets, table cell spacing, numbered text becoming real lists). Known visible changes left: an empty link `[](url)` and an empty heading `###` come back as escaped text.

## Not covered

- Server-side drafts of unpublished edits (legacy `saveDraftPage`) — an edit lives only until the page is left.
- Vote / follow options on publish (legacy `LikeSection`, `FollowObjectForm`).
