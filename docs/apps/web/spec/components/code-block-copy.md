---
id: web-components-code-block-copy
title: Code block Copy button
description: "Every `<pre>` rendered through `SocialEmbedHtml` gets a Copy button that puts the block text on the clipboard."
type: spec
status: active
scope: web
tags: [web, components, markdown]
updated_at: 2026-11-12
related:
  - docs/apps/web/spec/activity-notes.md
  - docs/apps/web/spec/messaging.md
  - docs/apps/web/spec/feed.md
---

# Code block Copy button

Wherever markdown/HTML renders through [`SocialEmbedHtml`](../../../../../apps/web/src/shared/presentation/components/social-embed-html.tsx) — blog posts and the editor preview, story comments, activity messages, DM threads, activity notes — each code block shows a **Copy** button in its top corner.

| Piece | Where |
|-------|-------|
| Hook | [`useCodeBlockCopyButtons(ref, html)`](../../../../../apps/web/src/shared/presentation/hooks/use-code-block-copy-buttons.tsx) — after mount and on every `html` change, wraps each `pre` in `div.code-block`, appends a `span.code-block-copy` host and portals the button into it. Cleanup unwraps, so Strict Mode never double-wraps |
| Button | [`CodeBlockCopyButton`](../../../../../apps/web/src/shared/presentation/components/code-block-copy-button.tsx) — `CopyIcon` + `copy_button`; shows `copy_button_copied` for 2 s |
| Copied text | `pre.textContent` minus the single trailing newline markdown renderers add — the exact fenced text |
| Styles | `.code-block`, `div.code-block > pre` (top padding so the button never covers the first line) and `.code-block-copy` in [`global.css`](../../../../../apps/web/src/app/global.css), next to the `pre` rules |

No clipboard (insecure context, permission denied) → the button stays on **Copy**; nothing throws.

`SocialEmbedHtml` memoizes its `{ __html }` object: React 19 compares `dangerouslySetInnerHTML` by identity and would otherwise reset `innerHTML` on every re-render, dropping the wrappers (and reloading embeds). Any other container that uses the hook must do the same.

Every editor can insert a code block: the full post editor via **Insert → Code block** (with Line and Table), the compact messaging compose (Activity, DMs, activity notes) via **Insert → Code** only (`enableCodeBlockInsert`). Edit seeds of Activity, DM and note bodies import as markdown (`initialBodyMarkdown`), so fences survive editing. Agents write copyable text as ``` fences (see [activity-notes.md](../activity-notes.md#import-link-agent-contract)).
