---
id: web-editor-hash-object-search
title: Editor — `#` object and Google Maps place search
description: "Typing `#` in the post editor searches our objects first, then Google Maps places near the user; a new place is created as an object signed by the author, with dedup by Google place id."
type: spec
status: active
scope: web
tags: [web, editor, objects, google-maps]
updated_at: 2026-11-05
related:
  - docs/apps/web/spec/pages/editor/page.md
  - docs/apps/query-api/spec/places.md
  - docs/spec/data-model/post-json-metadata-objects.md
---

# Editor — `#` object and Google Maps place search

**Back:** [Post editor](../pages/editor/page.md) · **API:** [query-api places](../../../query-api/spec/places.md)

## Feature flag

Google Maps places are **off by default**: `POST_EDITOR_GOOGLE_PLACES_ENABLED=true` (web, runtime, server-only — `isPostEditorGooglePlacesEnabled` in `apps/web/src/config/post-editor-defaults.ts`) turns them on. When off, `#` searches our objects only (no Google section, hint `objects_auto_complete_placeholder`) and the `/api/places/*` BFF answers 404 without calling query-api. query-api also needs `GOOGLE_PLACES_API_KEY` ([places.md](../../../query-api/spec/places.md)).

## Flow

1. Typing `#` at the start of text or after a space / `(` opens a menu at the caret (`EditorHashObjectSearchPlugin`, Lexical `LexicalTypeaheadMenuPlugin`). The query may contain single spaces (place names) and stops at a second `#`, a line break, a double space or sentence punctuation (`matchHashObjectQuery`).
2. **Objects** section — our search (`/api/search`, ≥ 2 chars, 300 ms debounce).
3. **Google Maps nearby** section — `/api/places/search` (≥ 3 chars, 500 ms debounce; signed-in users only). Places are biased to the user's IP location by query-api.
4. Order and dedup (`buildHashSearchEntries`): objects first; a place that already has an object (`existing_object_id`) is never offered for creation — it is listed once as that object, or dropped when the object is already in the first section.
5. Picking an object (or a linked place) replaces `#query` with an object link and attaches the object (`jsonMetadata.objects`, hashtag objects also add a tag).
6. Picking a new place removes `#query` and opens **`EditorPlaceCreateModal`** (confirmation): name, address, phone, website, photo, object type (`restaurant` / `place` / `business`, preselected from Google types).

## Creating an object from a place

No import service and no `batch_import`: the author signs the create, like quick create (`createObjectFromPlace`).

1. If the place details or a last-moment check (`GET /api/places/:id/object`) find an object → that object is linked, nothing is broadcast. If the check fails (`unknown`), creation is refused (`editor_place_error_unavailable`) rather than risking a duplicate.
2. The Google photo (`photo_uri`) is uploaded to IPFS (`uploadImageFromUrl`); failure only drops the image.
3. Fields (`buildPlaceObjectFields`, each validated against `UPDATE_REGISTRY`, invalid ones dropped): `name`, `identifier {type: 'googleMaps', value: placeId}` (always), `address` (only when complete — postal code required), `geo`, `telephone`, `website {title: name, link}`, `workHours` (weekday lines), `image {cid}`; plus the type's seed updates.
4. Object id `xxx-slug(name)`; a taken id gets a new random prefix (3 attempts).
5. Broadcast `custom_json` (`object_create` + `update_create`…) with `required_posting_auths: [author]` via the wallet facade. On success the link is inserted immediately (id known before broadcast); trx confirmation / indexing / refresh run in the background.

`identifier` type `googleMaps` is the same key the legacy migration wrote for `companyId {companyIdType: 'googleMaps'}`, so migrated legacy places are deduplicated too.

## Known limits

- Two users creating the same place at the same moment: the indexer keeps the first `identifier` (global `(value, type)` uniqueness) but the second `object_create` still succeeds without it.
- Without `GOOGLE_PLACES_API_KEY` or a GeoIP database the Google section is empty / unbiased; object search keeps working.

## Code

| Piece | Path |
|-------|------|
| Plugin + menu | `apps/web/src/modules/editor/presentation/components/editor-hash-object-search-plugin.tsx` |
| Trigger, ordering | `apps/web/src/modules/editor/application/hash-object-search.ts` |
| Confirmation modal | `apps/web/src/modules/editor/presentation/components/editor-place-create-modal.tsx` |
| Create use case | `apps/web/src/modules/editor/application/create-object-from-place.ts` |
| Place → fields | `apps/web/src/modules/object-create/application/build-place-object-fields.ts` |
| BFF | `apps/web/src/app/api/places/**` → `modules/editor/infrastructure/places-proxy.server.ts` |
