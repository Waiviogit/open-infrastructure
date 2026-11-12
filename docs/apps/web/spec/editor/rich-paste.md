---
id: web-editor-rich-paste
title: Editor — rich paste of copied posts and web pages
description: "Pasting a selection from a rendered post (full page or modal), another Hive front or any web page keeps its blocks and formatting: headings, lists, quotes, tables, code, bold / italic / struck text, links, image and video blocks, lines."
type: spec
status: active
scope: web
tags: [web, editor, paste]
updated_at: 2026-11-06
related:
  - docs/apps/web/spec/pages/editor/page.md
  - docs/apps/web/spec/editor/legacy-parity.md
---

# Editor — rich paste

**Back:** [Post editor](../pages/editor/page.md)

Every editor instance (post, comment, thread, Activity, DM, note). A selection copied from a post — full page or the post modal — pastes with the same blocks and formatting it shows. Any other clipboard HTML (Hive fronts, Google Docs, web pages) goes through the same rules.

## Paste order

Lexical runs `PASTE_COMMAND` listeners from high to low priority; the first one that handles the event wins.

| Priority | Plugin | Handles |
|----------|--------|---------|
| HIGH | `EditorPasteImagePlugin` | An image file (unless the clipboard HTML has text — Word / Docs put a picture of the selection next to it), or clipboard text that is **exactly one** image URL. A URL inside copied text stays part of that text. |
| HIGH | `EditorPasteVideoUrlPlugin` | Clipboard text that is exactly one video link → video block. |
| NORMAL | `EditorPasteObjectLinksPlugin` | Observes only: `/object/<id>` links attach objects. |
| LOW | `EditorPasteRichHtmlPlugin` | Clipboard HTML → normalized → Lexical nodes. Skipped for copies made inside the editor (`application/x-lexical-editor`, Lexical's own format). |
| EDITOR | Lexical rich text | Plain text. |

## HTML → blocks

`normalizePastedHtml` rewrites the clipboard document, then each node's `importDOM` builds the blocks:

| Clipboard HTML | Editor |
|----------------|--------|
| `h1`–`h6`, `ul` / `ol`, `blockquote`, `table`, `code`, `strong` / `b`, `em` / `i`, `u`, `s`, `a` | Lexical's own nodes |
| `del`, `strike` | struck text (renamed to `s`) |
| `pre` (with or without inner `code`) | one code block, trailing newline dropped |
| `img` | image block (`ImageNode.importDOM`) with the **original** URL: `data-fallback-src` (our renderer), else the `images.hive.blog/0x0/` prefix stripped. Not re-uploaded to IPFS; a content-gateway URL keeps its `cid`. |
| `iframe` of a YouTube / Instagram / TikTok / Facebook / X / LinkedIn player | video block (`VideoNode.importDOM`) storing the public page URL (`mediaUrlFromEmbedSrc`; portrait YouTube → Shorts URL) |
| `iframe` of another known player (3Speak, Vimeo) | link to its page — the post renderer embeds 3Speak links again |
| `hr` | line block (`LineNode.importDOM`) |

Images and videos cannot sit inside a paragraph: they are lifted out of paragraphs, headings, links and inline wrappers, which are split around them (`<p>a<img>b</p>` → paragraph, image, paragraph). Inside a list item, table cell or quote they become a link instead. Dropped: images with `data:` / relative sources, iframes of unknown players, empty paragraphs, Chrome's `<span>&nbsp;</span>` spacers (→ a plain space).

## Known limits

- Spoilers render as text in posts, so they paste as text.
- An image that was a link (`<a><img></a>`) keeps the image, not the link.

## Verification

- Unit: `apps/web/src/modules/editor/application/normalize-pasted-html.spec.ts` (copied post → blocks → published markdown), `clipboard-paste.spec.ts`, `mediaUrlFromEmbedSrc` in `apps/web/src/shared/infrastructure/media-embed.spec.ts`.
- E2E: `apps/web-e2e/src/editor/editor-paste-post.spec.ts` — copies the fixture post (`support/rich-post-fixture.cjs`, served by the query-api stub) from its page and from the post modal with Ctrl+C and pastes with Ctrl+V. Run `pnpm nx run web-e2e:e2e-editor`.

## Code

| Piece | Path |
|-------|------|
| Plugin | `apps/web/src/modules/editor/presentation/components/editor-paste-rich-html-plugin.tsx` |
| HTML normalization | `apps/web/src/modules/editor/application/normalize-pasted-html.ts` |
| Clipboard helpers | `apps/web/src/modules/editor/application/clipboard-paste.ts` |
| Pasted image / player → URL | `apps/web/src/modules/editor/domain/pasted-media.ts` |
| Player src → page URL | `apps/web/src/shared/infrastructure/media-embed.ts` (`mediaUrlFromEmbedSrc`) |
