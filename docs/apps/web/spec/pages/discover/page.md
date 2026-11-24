---
id: web-pages-discover
title: Discover page
description: Browse objects by type or users with optional text search and tag-category filters (AND semantics).
tags: [web, page, discover]
related:
  - docs/apps/web/spec/pages/index.md
type: spec
status: active
scope: web
updated_at: 2026-11-24
---

# Discover page (`/discover`)

Browse objects by type or users with optional text search and tag-category filters (AND semantics).

Hub chrome: under `(app)/(hub)` with FEED / DISCOVER / MARKET section nav (`AppSectionNav`). DISCOVER is active on this route, and the hub's second-level band is the [type menu](#type-menu). See [home](../home/page.md).

## Routes

| URL | Mode |
|-----|------|
| `/discover` (no `type`, no `users`) | Redirects to remembered `discover_object_type` cookie, otherwise `type=product`. Other query params (`q`, `tags`, `sort`, `box`, `map`) are preserved. 307 from `proxy.ts` ([routing-proxy](../../routing-proxy.md#redirects-before-rendering)). |
| `/discover?type={object_type}` | Object feed for one registry type |
| `/discover?type=all` | Mixed object-type feed (no `object_type` sent to query-api) |
| `/discover?users=1` | User list (optional `q` prefix search) |
| `/discover?type={category type}&cat=A&cat=B` | Object feed inside a category lineage (root first); `cat` is kept only with a type |
| `q`, `tags`, `sort`, `box`, `map` | Shared query params |

Bare `/discover` always resolves to a type. A valid remembered cookie wins; first-time visitors land on **Product**. The automatic redirect does not write the cookie.

### Map area (`box`)

Geo-capable registry types (`restaurant`, `place`, `business`, `person`, `service`) show a map on desktop (right rail above filters) and a **Map** entry on mobile (fullscreen modal). The URL param is:

`box=swLng,swLat,neLng,neLat` (WGS84; same order as query-api `ST_MakeEnvelope`).

- Applying **Search area** replace-navigates with `box` set; other params (`type`, `q`, `tags`, `sort`) are preserved.
- A removable **Map area** chip clears `box` without opening the map.
- No map on `type=all`, users mode, or non-geo types.
- Object feed and tag-category facets both respect `box` when present.

### Map camera (`map`)

`map=lat,lng,zoom` stores the **map camera only** (WGS84 latitude/longitude plus integer zoom `0–19`). It is **not** sent to query-api — only `box` filters results.

- Written to the URL when opening the fullscreen map or applying **Search area** (replace navigation, `scroll: false`).
- Not updated on every pan/zoom (avoids feed skeleton flicker during navigation).
- Preserved alongside `box`, `tags`, and `sort` when those params change.
- Initial map view order: URL `map` → fit applied `box` → default world view.

### Remembered object type

Cookie `discover_object_type` stores the last picked registry object type (client write on type selection in the type menu, tab or More row; server read on page load). Returning visitors with a valid cookie are redirected to `/discover?type={remembered}`. The cookie is never set for `users` mode, `type=all`, or the automatic Product default.

## Type menu

`HubDiscoverTabBand` (`modules/discover`), mounted in `(hub)/layout.tsx` next to the Feed and Market bands: a full-width band under the hub section nav with the same chrome (`ScrollableHorizontalTabNav`, primary tabs with a glyph from `@/icons`, centred when it fits, horizontal scroll with arrows when it does not). It follows the optimistic navigation target, so the active tab switches on click.

Tabs, in order:

1. **Popular types** — `product`, `business`, `restaurant`, `person`, `book` (`DISCOVER_POPULAR_OBJECT_TYPES`). No "Popular" heading.
2. **Users** — `?users=1`.
3. **Active More type** — when the active type was picked from More (e.g. `recipe`), it shows as an active tab here. Picking a popular type removes it.
4. **More ▾** — popover with a type search (`discover_search_object_types`) and every other registry type, alphabetical, each with its glyph. The active type uses `bg-accent-soft`. Escape, an outside click or a pick closes it. It is portaled with fixed positioning so the scrollable tab row does not clip it.

Type links replace the URL and keep `q` and `sort`; `tags`, `box` and `map` are dropped (they are type-specific). Mixed search results (`type=all`, from header search) leave every tab inactive.

## Layout

Three columns from `lg` up, on the hub shell grid (`--shell-left-width` / feed / `--shell-right-width`):

- **Left** — the active type's [category tree](#categories) (category types only); empty otherwise.
- **Center** — `Discover` title + sort, category breadcrumbs, active-filter chips, then the object or user feed.
- **Right** — map rail (geo types) above the tag-category filters; sticky under the hub section nav.

### Categories

For a type whose registry supports the `category` update (`objectTypeSupportsCategories`), Discover shows the type's category tree, like profile Favorites. Data: BFF `GET /api/discover/categories` → query-api [`discover/categories`](../../../../query-api/spec/discover-categories.md), one level per request, counted in groups and narrowed by `q`, `tags` and `box`. Categories with fewer than 3 groups or over 60% of the level are not listed; there is no Uncategorized node (those objects are in `All`).

- **URL:** repeated `cat`, root first (`?type=product&cat=Electronics&cat=Audio`). The feed, map markers and tag facets send it as `category_path`. A type change drops it; a category link keeps `q`, `tags`, `sort`, `box` and `map`; every Discover control (sort, chips, filters, map area) keeps it.
- **Rail (`lg+`)** — `DiscoverCategoryRail`: a card in page flow (not sticky) with the type label, ← Up / All categories below the root, then the level's categories with their group counts (`›` when they have children). A leaf shows its siblings with the leaf highlighted (`useDiscoverCategoryNav`). A skeleton while a level loads; a type whose root has no category hides the rail.
- **Breadcrumbs** — `All › Electronics › Audio` (shared `CategoryBreadcrumbs`); `All` is the type root. Below `lg` the current crumb is a tinted pill (`bg-accent-soft`) that opens the drawer.
- **Drawer (`< lg`)** — `DiscoverCategoryDrawer`: `DrawerRegion side="left" belowHeader size="wide" closeOnBack`, one level at a time (shared `CategoryNavDrawerList`): ‹ parent, the level itself, child categories with counts. A category with children opens its level and keeps the drawer; a leaf or the level closes it. Back closes the drawer; its links replace the URL.
- **Toolbar (`< lg`)** — like Favorites: at the type root without filters the Filter pill shares the crumb row; with a category path or active filters it goes after the chips.
- **Center column: blocks or feed.** Inside a category that has subcategories, without `q` / `tags` / `box`, the center shows one block per subcategory (`DiscoverSections`, BFF `GET /api/discover/sections` → query-api [`discover/sections`](../../../../query-api/spec/discover-categories.md#category-blocks)): the shared `CategorySectionCard` with the title link and `›`, the group count, the top 3 objects by rank and `Show more {category}`. More blocks load on scroll; on Back the loaded blocks are seeded from the session cache (`discover-feed-cache.ts`) so the scroll offset is restored. The type root (`All`, which also lists objects without a category), a category without subcategories and any filtered view keep the flat feed. Sort is hidden in block mode; the map still shows the whole lineage. While the category tree loads, a list skeleton.

Shared components: `@/shared/presentation/category-nav` (list, ← Up links, drawer list, breadcrumbs, skeleton), used by Favorites too.

### Active filters

Shared `ActiveFilterChips` (`@/shared/presentation`), the same component as profile Favorites. Chips: `Search: {q}`, each tag as `Category: value`, `Map area`. From `lg` up they sit under `Active filters (n) · Clear all`; Clear all drops `q`, `tags` and `box` and keeps the type and sort.

### Mobile (< `lg`)

- **Type** — the same band; it scrolls horizontally, More opens the same popover.
- **Filters** — the chips wrap in one row with the `Filter` pill (shared `MobileFilterButton`) after them; with no active filter the pill is alone in its row. It opens the filter bottom sheet (shared `MobileFilterSheet`, tag categories only; same data as the desktop right column); toggles apply immediately via URL replace. No heading above the chips (the sheet has its own Clear).
- **List / Map** — geo types show underline sub-nav (`List` | `Map`) below the chips. **List** shows the object feed + `Sort: …` dropdown. **Map** shows the inline map (`DiscoverMapPanel variant="feed"`) with Search area, zoom, locate and expand-to-fullscreen; **Search area** writes `box` to the URL.
- No page title and no left or right column on mobile.

## API (via BFF)

| BFF | query-api |
|-----|-----------|
| `GET /api/discover/objects` | `GET /query/v1/discover/objects` |
| `GET /api/discover/users` | `GET /query/v1/discover/users` |
| `GET /api/discover/tag-categories` | `GET /query/v1/discover/tag-categories` |
| `GET /api/discover/categories` | `GET /query/v1/discover/categories` |
| `GET /api/discover/sections` | `GET /query/v1/discover/sections` |

### Object feed

- Filters: `object_type`, optional FTS `q`, `tags[]` (each tag = `category:value` encoding, e.g. `Cuisine:asian`; AND across all selected tags; both `value_json.category` and `value_json.value` must match), optional `box` (map bounding box: `swLng,swLat,neLng,neLat`).
- Sort: `rank` (default, `objects_core.weight DESC`), `newest` (`created_at DESC`), `oldest`.
- Cursor: opaque base64 JSON (`created_at`, `weight`, `object_id`, `sort`).
- Cards: projected with shop card update types (`name`, `image`, `description`, `tagCategoryItem`, `aggregateRating`) plus `geo` for map markers. Query-api returns **one card per `meta_group_id`** (highest-weight / newest / oldest SKU under the active sort).
- Tag facet counts are distinct groups of active objects, not option SKUs.

### User feed (`?users=1`)

- Cursor: opaque base64 JSON (`wobjects_weight`, `name`).
- Sort: `wobjects_weight DESC NULLS LAST`, `name ASC`.
- Row UI (`DiscoverUserFeed`): avatar, username, expertise chip (`wobjects_weight`, 2 decimals) + `·` + plain `followers_count`; `StatHoverTooltip` on expertise and followers (same i18n keys as header search). Optional `search_user_following` label when `is_following`.

### Tag categories sidebar

- Aggregated from `object_updates` where `update_type = tagCategoryItem`, grouped by `value_json.category` / `value_json.value`.
- Optional `q` and `box` narrow facet counts (same geographic predicate as the object feed when `box` is set).
- Redis cache: `query-api:cache:tag-categories:{objectType}` (TTL 300s). Skipped when `q`, active `tags`, or `box` is present.
- Section order follows `supposed_updates` TAG_CATEGORY values in `@opden-data-layer/core` object-type registry.

### Indexes

Migration `00013_discover_indexes`: expression index on tag item `(value, category)`; `(object_type, seq DESC)` on active `objects_core`.

## Search integration

Header search dropdown chips (per `object_type` and Users) link to `/discover` with `q` and `type` / `users=1`. The **All** chip links to `/discover?type=all&q=…`.

**Enter key** (when no highlighted result): navigate to discover with selected type (URL or remembered cookie), exact username profile match, or mixed results (`type=all`).

## Object page tags

On `/object/:object_id`, tag chips in the left rail **Tags** block link to `/discover?type={object_type}&tags={category}:{value}` (e.g. `Cuisine:asian`) where `object_type` is `ObjectPageViewModel.objectTypeKey` (registry key from query-api, e.g. `recipe`). Legacy value-only `tags` in the URL are ignored by query-api.

## Verification

```bash
pnpm nx test query-api --testPathPattern=discover
pnpm nx test web --testPathPattern=discover
pnpm check:web-i18n-utf8
pnpm exec playwright test src/discover-map.spec.ts
```
