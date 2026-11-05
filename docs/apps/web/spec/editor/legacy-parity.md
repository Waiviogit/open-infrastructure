---
id: web-editor-legacy-parity
title: Editor — legacy feature parity
description: "Legacy Waivio post editor (Slate + markdown) features and where each one lives in the new Lexical editor."
type: spec
status: active
scope: web
tags: [web, editor, legacy]
updated_at: 2026-11-05
related:
  - docs/apps/web/spec/pages/editor/page.md
  - docs/apps/web/spec/editor/hash-object-search.md
---

# Editor — legacy feature parity

**Back:** [Post editor](../pages/editor/page.md)

The legacy editor (Slate, markdown storage, Redux) is replaced by one Lexical component, `LexicalPostEditor`. Post-only features are enabled by props from `EditorScreen`; compact editors (comments, messaging) reuse the same component.

| Legacy feature | New editor |
|----------------|------------|
| Title ≤ 255 | `POST_TITLE_MAX_LENGTH` |
| Bold / italic / underline / headings / quote / lists / code / link, selection toolbar | Format toolbar; underline publishes as `<u>` |
| Side "+" toolbar | Insert menu at the caret |
| Photo (upload / URL / paste / drop) | IPFS upload (`ImageNode` with `cid`) |
| Video by URL (inline field, embedded player in the editor), pasted YouTube link → player | Insert → Video inline field → `VideoNode` player; `EditorPasteVideoUrlPlugin` |
| Object by `#` at the caret | [`#` object search](hash-object-search.md) |
| Nearby (Google Maps import modal) | `#` search Google section (no separate menu item). Objects are created by the user (no import service) |
| Line, Code, Table, Emoji | Insert → Line / Code / Table / Emoji |
| Table toolbar: +Row, +Column, Remove table (2×2 default) | `EditorBlockToolbarPlugin` (also ↑ / ↓ Line for every non-text block, for touch) |
| Paste HTML with `/object/` links → attach objects | `EditorPasteObjectLinksPlugin` |
| Linked objects + influence percents, hashtag objects → tags | Linked objects panel |
| Create object from the editor | `EditorCreateObjectModal` |
| Drafts: autosave, last drafts, list | Drafts (query-api) |
| Preview, legal checkbox | Preview modal, publish dock |
| Reward 50/50 · 100% HP · declined, beneficiaries | Advanced settings |
| "Like this post" self-upvote | Advanced settings → `vote` in the publish transaction |
| Edit a published post | `/editor?author=&permlink=`, `comment`-only re-broadcast |
| Campaign review / mentions, review check, giveaway | **Not ported** — no campaigns in the new stack |
