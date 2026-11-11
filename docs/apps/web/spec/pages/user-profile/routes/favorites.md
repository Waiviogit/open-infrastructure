---
id: web-pages-user-profile-routes-favorites
title: User profile — favorites
description: "One Favorites tab at `/@:name/favorites`: type accordion with category navigation, breadcrumbs, filters and an infinite object list."
type: spec
status: active
scope: web
tags: [web, page, user-profile, favorites]
updated_at: 2026-11-11
related:
  - docs/apps/web/spec/pages/user-profile/profile-shell.md
  - docs/apps/query-api/spec/users-favorites-endpoint.md
  - docs/apps/query-api/spec/shop-feed-endpoints.md
  - docs/apps/query-api/spec/categories.md
  - docs/apps/web/spec/object-card.md
---

# User profile — favorites

**Back:** [profile shell](../profile-shell.md) · **Related:** [object-card.md](../../../object-card.md)

## Purpose

One tab for every object the user keeps: the former Shop (`book`, `product`), Recipe and Favorites tabs are merged. Which objects belong to the user (favorites, objects linked from their posts, hide flags) is defined once in [users-favorites-endpoint.md](../../../../../query-api/spec/users-favorites-endpoint.md); this page only renders it.

`/@:name/user-shop` and `/@:name/recipe` were removed **without redirects**: those segments are no longer reserved, so `proxy.ts` sends them to the post route.

## Routes

| Public URL | Center `(main)` | Left `@leftSidebar` |
|------------|-----------------|---------------------|
| `/@:name/favorites` | `favorites/page.tsx` (first type) | `@leftSidebar/favorites/page.tsx` |
| `/@:name/favorites/:type[/...category]` | `favorites/[objectType]/[[...categoryPath]]/page.tsx` | `@leftSidebar/favorites/[objectType]/[[...categoryPath]]/page.tsx` |

`/:type/uncategorized` is the reserved Uncategorized node (objects of a category type with no category). There is no sibling `[objectType]/page.tsx`: the optional catch-all also matches the type root. URL helpers: `parseFavoritesPath` / `buildFavoritesPath` (`modules/user-profile/domain/favorites-path.ts`).

## Types and categories

- Types come from `GET …/favorites/types` (`items`, count desc). Bare `/favorites` shows the first one.
- A type has category navigation when it supports the `category` update in `OBJECT_TYPE_REGISTRY` (`objectTypeSupportsCategories`). Adding `category` to a type is enough; nothing in web lists category types. Book and product are separate types with their own trees.
- Not found (`notFound()` inside Suspense): a type outside `USER_FAVORITES_OBJECT_TYPES`, or a category path on a type without categories.

## Layout

| Region | Component | Behavior |
|--------|-----------|----------|
| Left rail (`lg+`) | `FavoritesRail` → `FavoritesRailPanel` | Accordion of types with counts. Type links drop filters. Only the active type is expanded (`aria-expanded`); the chevron (after the type label) and `CategoryNavChrome` appear only when the type `has_categories` (`favorites/types`): ← Up / All categories, children (`›` when they have children), Uncategorized. A type that supports categories but has none yet looks like any type without categories — no chevron, no "No categories yet", no lone Uncategorized. Uncategorized is listed only next to real categories. A leaf shows its siblings with the leaf highlighted. |
| Center | `ProfileFavoritesMainContent` | `FavoritesBreadcrumbs`, `FavoritesMobileNav`, filter chips, then content (below). |
| Mobile (`< lg`) | `FavoritesMobileNav` | Scrollable type chips; for a type with categories, child-category chips and (next to them) Uncategorized. A mobile filters sheet is a follow-up. |
| Right rail (`lg+`) | `ProfileFavoritesFiltersFromUrl` | Rating + tag facets of the URL type (and category path) for **every** type the registry gives tag/rating updates. Bare `/favorites` reads the first type from BFF `GET /api/users/:name/favorites/types`. |

### Center content

| Type / URL | Content |
|------------|---------|
| Type without categorized objects (`has_categories` false; a category path 404s) | `FavoritesObjectList` (flat, weight order) |
| Category type, Uncategorized node or active `tags` / `rating` | `FavoritesObjectList` (flat, facet counts match rows) |
| Category type, leaf (no child categories) | `FavoritesObjectList` for the lineage |
| Category type, inner node | `FavoritesSections` (child categories × 3 previews); the type root appends an **Uncategorized** section after the last category once all sections are loaded |

Displayed counts are live counts over the same scope as the lists (see [shop-feed-endpoints.md](../../../../../query-api/spec/shop-feed-endpoints.md) and [categories.md](../../../../../query-api/spec/categories.md)).

## Breadcrumbs

`FavoritesBreadcrumbs`: `<nav aria-label={favorites_breadcrumb_aria}>` with an `<ol>` — `Recipe › German Cuisine › Comfort Food`. Every crumb but the last is a `UserProfileNavLink` that keeps `?tags=&rating=`; the last has `aria-current="page"`; the `›` separator is `aria-hidden`. Uncategorized renders as `Type › Uncategorized`. The pending overlay (`ProfileMainPendingSkeleton`) renders the same breadcrumbs from the pending pathname, so they change on click.

## Navigation and loading

- All rail, chip, crumb and section links are `UserProfileNavLink` (instant URL + optimistic active state). The rail and chips read the effective pathname (`useEffectiveProfileNav` + `parseFavoritesPath`); while a newly picked type is pending, the rail shows a category skeleton under it.
- Pending overlay: breadcrumbs, then a sections skeleton (same card shell as a loaded section) for a category type without filters (not Uncategorized), else a list skeleton. Route `loading.tsx`: `ProfileFavoritesContentSkeleton`; rail fallback: `ProfileFavoritesRailSkeleton`.
- No layout shift while switching types or categories: the breadcrumb row has a fixed one-line height (`FAVORITES_CRUMBS_ROW_CLASS` in `favorites-layout-classes.ts`) shared by the real breadcrumbs and both skeletons, and the pending overlay has no inset on this tab. On `lg+` both side rails are offset by that row (`FAVORITES_SIDE_RAIL_OFFSET_CLASS`) so they start level with the first card. The left rail has no title (the active hero tab already says Favorites).
- Filters: URL `tags=Category:value` (repeatable, AND) and `rating` (`6` | `8` | `10`). Category, section, crumb and Uncategorized links keep them.

## Data loading

| Data | Source |
|------|--------|
| Types | `getFavoritesTypesQuery` (`react.cache`, shared by rail and center) |
| Category nav | `getCategoryNav(account, type, {name, path})` — exactly one type; rail via `getFavoritesRailNavQuery` |
| Objects / sections | `shop-objects` / `shop-sections` with `types=<type>` (`shop-objects.client.ts`) |
| Next pages | `favorites-feed.actions.ts`: `loadMoreFavoritesObjectsAction`, `loadMoreFavoritesSectionsAction` → `Result<page, 'service_unavailable'>` |

Lists and sections use `useSyncedPaginatedList` + `useInfiniteScroll` (sentinel + `sr-only` keyboard button, no visible Load more). A failed page shows an inline `role="alert"` (`favorites_load_more_error`) with Retry.

## Cache invalidation

`favorites/types` is tagged `userFavoritesTypes`; `categories`, `shop-objects` and `shop-sections` are tagged `userFavorites`. Toggling the administrative heart revalidates both for the account (`revalidateUserSocialAfterBroadcast`), so the rail, counts and lists update on `router.refresh()`.

## Verification

| Command | Purpose |
|---------|---------|
| `pnpm nx test web --testPathPatterns=favorites` | Path helpers, breadcrumbs, rail panel, clients |
| `pnpm typecheck:web` | Route and component types |
| Manual | `/@acc/favorites`, `/@acc/favorites/recipe/German%20Cuisine/Comfort%20Food?tags=Cuisine:german`, `/@acc/favorites/place`: accordion, crumbs keep filters, filters on a type without categories, Uncategorized, infinite scroll, Back/Forward, mobile chips; `/@acc/recipe` opens the post route |
