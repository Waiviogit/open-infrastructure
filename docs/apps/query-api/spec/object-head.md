---
id: docs-apps-query-api-spec-object-head
title: Object head
description: Viewer-independent hero fields of one object (GET /objects/:id/head) — painted by the web object page before the full resolve.
type: spec
status: active
scope: query-api
tags: [query-api, objects, object-page, performance]
updated_at: 2026-11-26
related:
  - docs/apps/query-api/spec/overview.md
  - docs/apps/query-api/spec/objects-resolve.md
  - docs/apps/web/spec/pages/object/data-loading.md
---

# Object head

**Back:** [query-api overview](overview.md) · **Related:** [Objects resolve](objects-resolve.md), [web object page data loading](../../web/spec/pages/object/data-loading.md)

The cheap subset of [`POST /objects/resolve`](objects-resolve.md) that the object page hero needs: name, subtitle, avatar, cover, type, status, weight. The web paints the hero from it while the full model (every field, counts, SEO, affiliate links, viewer flags) is still loading.

## Route

| Method | Path |
| ------ | ---- |
| `GET` | `/query/v1/objects/{objectId}/head` |

Headers: `Accept-Language` / `X-Locale`, optional `X-Governance-Object-Id`. There is **no `X-Viewer`**: the response is the same for every visitor, so callers can cache it per object and locale.

**404** when the object does not exist, its status is not visible on the object page (`OBJECT_PAGE_VISIBLE_STATUSES`) or governance masking leaves no view.

MCP tool: `get_object_head`.

## Response

```ts
{
  object_id: string;
  object_type: string;
  semantic_type: string | null;
  status: string;                 // objects_core.status
  weight: number | null;          // objects_core.weight
  fields: {                       // only keys with a winning value
    name?: string;
    title?: string;
    image?: string;               // own avatar, else the parent object's image
    imageBackground?: string;
    identifier?: unknown[];       // recipe Instacart button
  };
  previewGallery: ProjectedGalleryPhoto[]; // built from the avatar only
  galleryAlbums: ProjectedGalleryAlbum[];
}
```

## Pipeline

`GetObjectHeadEndpoint` runs the same steps as resolve, restricted to `OBJECT_HEAD_UPDATE_TYPES` (`name`, `title`, `image`, `imageBackground`, `parent`, `identifier`):

1. `AggregatedObjectRepository.loadByObjectIds([id], { includeRankVoteProjection: false, statuses: OBJECT_PAGE_VISIBLE_STATUSES })`.
2. Governance snapshot (`GovernanceResolverService`, cached in process).
3. `ObjectViewService.resolve` for the head update types only.
4. `ObjectProjectionService.project` without a viewer and without SEO — the same projection as resolve, so the hero fields are identical. `parent` is resolved only for the avatar fallback and is dropped from the response.

No counts, SEO, JSON-LD, affiliate enrichment, ref expansion beyond `parent`, or viewer lookups.

## Verification

| Command | Purpose |
|---------|---------|
| `pnpm nx test query-api --testPathPatterns=get-object-head` | Endpoint behaviour (missing object, statuses, parent dropped) |
| `curl -s localhost:7000/query/v1/objects/hive/head` | Manual smoke |
