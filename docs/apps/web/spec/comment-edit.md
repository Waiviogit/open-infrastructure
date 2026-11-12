---
id: web-comment-edit
title: Comment and thread edit
description: "The author edits a published comment or thread inline, in the same compose editor used to write it. `/editor` edits root posts only."
type: spec
status: active
scope: web
tags: [web, feed, editor]
updated_at: 2026-11-12
related:
  - docs/apps/web/spec/feed.md
  - docs/apps/web/spec/pages/editor/page.md
  - docs/apps/web/spec/components/story-overflow-menu.md
  - docs/apps/query-api/spec/single-post-endpoint.md
---

# Comment and thread edit

**Back:** [web overview](overview.md)

## Purpose

Hive `comment` ops edit a published item when they reuse its author, permlink and parent. The post editor always publishes a root post (`parent_author: ''`, required title), so comments and Leo threads are edited inline instead, in the same `CompactComposeEditor` that wrote them.

## Where Edit appears

Only for the signed-in author (`viewerIsAuthor`, case-insensitive).

| Surface | Control | Result |
|---------|---------|--------|
| Feed card (`Story`) of a comment or thread | ⋯ menu → **Edit** (`edit`) | The inline editor replaces the card's title, media and excerpt |
| Comment row in the post modal / page (`StoryCommentRow`) | **Edit** next to **Reply** | The inline editor replaces the comment body |
| Feed card or post page of a root post | ⋯ menu → **Edit post** | `/editor?author=<me>&permlink=<p>` |

A feed item is a reply when `parentAuthor` (query-api `FeedStoryItem`) is non-empty; items on the `comments` and `threads` tabs count as replies too (`isReplyFeedItem`, `modules/feed/domain/feed-item-kind.ts`). A comment opened at its own permalink (`BlogPostScreen`) has no **Edit post**.

`/editor` refuses a reply: `fetchPublishedPostForEdit` returns `not_a_post` and the page shows `editor_not_a_post_notice`.

## Data

Feed cards carry only an excerpt. A click on **Edit** calls **`loadCommentEditTargetAction(author, permlink)`** (Server Action, `Result`, never throws). It reads `GET /query/v1/posts/:author/:permlink` live (`fetchSinglePostLive`, no cache) and maps it with `mapSinglePostToCommentEditTarget`:

- `author`, `permlink`, `parentAuthor`, `parentPermlink`, `title`, `body` (markdown), `jsonMetadata` (raw string);
- errors: `unauthorized` (no session), `not_author`, `not_a_reply` (root post), `not_found`, `service_unavailable` → inline `comment_edit_load_failed` (`role="alert"`) with **Cancel**.

While loading, the row shows `comment_edit_loading`. State lives in `useCommentEditTarget`.

## Save

`StoryCommentEditor` with `editTarget` seeds `initialBody` with the published markdown (imported as markdown). Save (`comment_update_send`) builds the op with **`buildCommentEditOp`** (`modules/feed/application/build-comment-edit-op.ts`):

| Field | Value |
|-------|-------|
| `author`, `permlink`, `parent_author`, `parent_permlink` | unchanged from the published item |
| `title` | the published title (`''` for almost every comment and thread) |
| `body` | `editorBodyToMarkdown(lexicalJson)` |
| `json_metadata` | published keys kept (tags, links, image, community, …); `app` = this client, `format` = `markdown` (`mergeEditedPostJsonMetadata`) |

Threads (`parent_author` in `THREAD_ACCOUNTS`): the object anchor the compose bar appended as the last paragraph (`#object_id` or `/object/{id}`, `extractTrailingObjectAnchorId`) is re-applied with `appendObjectAnchorToThreadBody`, which skips it when the body still has it — the thread never leaves the object's feed and the anchor never doubles.

After the broadcast: `awaitTrxConfirmation` → `refreshAfterBroadcast` (author feed tags, home feed, the caller's revalidate) → the editor closes (`onSaved`); the post modal also reloads its discussion. A wallet error stays inline (`role="alert"`, fallback `comment_edit_failed`) with the editor open. **Cancel** (`cancel`) closes without a broadcast.

## Code

| Area | Location |
|------|----------|
| Edit target type | `apps/web/src/modules/feed/domain/comment-edit-target.ts` |
| Op builder | `apps/web/src/modules/feed/application/build-comment-edit-op.ts` |
| Loader action | `apps/web/src/modules/feed/infrastructure/actions/load-comment-edit-target.action.ts` |
| Inline UI | `story-inline-comment-edit.tsx`, `story-comment-editor.tsx`, `story.tsx`, `story-comment-row.tsx` |
| `/editor` guard | `apps/web/src/modules/editor/infrastructure/fetch-published-post-for-edit.server.ts`, `app/(app)/editor/page.tsx` |

## Verification

`pnpm nx test web --testPathPatterns="(build-comment-edit-op|comment-edit-target|fetch-published-post-for-edit|story-comment-editor|story-comment-row|story-overflow-menu|feed-item-kind|append-object-anchor)"`.
