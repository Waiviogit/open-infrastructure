---
id: web-pages-user-profile-routes-favorites
title: User profile — favorites
description: "One Favorites tab at `/@:name/favorites`: horizontal type menu, category navigation in the left rail, breadcrumbs, filters and an infinite object list."
type: spec
status: active
scope: web
tags: [web, page, user-profile, favorites]
updated_at: 2026-11-16
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
| Type menu (all widths) | `FavoritesTypesMenu` → `FavoritesTypesMenuNav` | Horizontal tabs of the user's types with counts, in the profile submenu card — same slot and look as the wallet tabs (`UserProfileSubmenu`, variant `favorites`). Rendered by `(main)/layout.tsx`, so it stays mounted and outside the pending overlay. Type links drop filters; the active tab follows the effective pathname (first type on bare `/favorites`). No types → no card. |
| Left rail (`lg+`) | `FavoritesRail` → `FavoritesRailPanel` | Only the category navigation of the active type, under the type label: `CategoryNavChrome` — ← Up / All categories, children (`›` when they have children), Uncategorized. Shown only when the type `has_categories` (`favorites/types`); otherwise the left column is empty (a type that supports categories but has none yet counts as without). Uncategorized is listed only next to real categories. A leaf shows its siblings with the leaf highlighted. The rail is in page flow (`FAVORITES_LEFT_RAIL_FLOW_CLASS`): not sticky and no own scroll — a long category list grows the page. |
| Center | `ProfileFavoritesMainContent` | `FavoritesBreadcrumbs`, filter chips, then content (below). |
| Mobile (`< lg`) | `FavoritesCategoryDrawer` + `CategoryNavDrawerList` | For a type with categories the current breadcrumb is an accent button (`Type ▾` at the root, `Type › Category ▾` deeper) that opens the left rail in a left `DrawerRegion` under the app header (`belowHeader`, `size="wide"`) — same pattern as the hub feed filters and the Discover type picker. `(main)/layout.tsx` renders the same `leftSidebar` node in the drawer and owns its open state (`FavoritesCategoryDrawerProvider`), because the page remounts on every category URL. One level at a time: ‹ parent level, the level itself (✓ when it is the page), child categories, Uncategorized at the type root. A category with children (`›`) opens its page and keeps the drawer on its subcategories (category skeleton while the level loads); a leaf, the level itself or Uncategorized opens and closes the drawer. Browser / phone Back closes it and stays on the page (`DrawerRegion closeOnBack` → `useCloseOnHistoryBack`: a same-URL history entry while open; drawer links navigate with `replace`, so history matches plain links). Leaving Favorites closes it. Types are in the type menu. |
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

- All type tab, rail, drawer, crumb and section links are `UserProfileNavLink` (instant URL + optimistic active state). The type menu, rail and drawer read the effective pathname (`useEffectiveProfileNav` + `parseFavoritesPath`); while a newly picked category type is pending, the rail shows a category skeleton under its label, and a type without categories empties the rail at once.
- Pending overlay: breadcrumbs, then a sections skeleton (same card shell as a loaded section) for a category type without filters (not Uncategorized), else a list skeleton. Route `loading.tsx`: `ProfileFavoritesContentSkeleton`; rail fallback: `ProfileFavoritesRailSkeleton`; type menu fallback: `FavoritesTypesMenuSkeleton`.
- No layout shift while switching types or categories: the breadcrumb row has a fixed one-line height (`FAVORITES_CRUMBS_ROW_CLASS` in `favorites-layout-classes.ts`) shared by the real breadcrumbs and both skeletons, and the pending overlay has no inset on this tab. Both side rails start at the top of the column, level with the type menu card.
- Filters: URL `tags=Category:value` (repeatable, AND) and `rating` (`6` | `8` | `10`). Category, section, crumb and Uncategorized links keep them.

## Data loading

| Data | Source |
|------|--------|
| Types | `getFavoritesTypesQuery` (`react.cache`, shared by type menu, rail and center; the menu fetch runs once per profile layout render, cached by `queryApiFetch`) |
| Category nav | `getCategoryNav(account, type, {name, path})` — exactly one type; rail via `getFavoritesRailNavQuery` |
| Objects / sections | `shop-objects` / `shop-sections` with `types=<type>` (`shop-objects.client.ts`) |
| Next pages | `favorites-feed.actions.ts`: `loadMoreFavoritesObjectsAction`, `loadMoreFavoritesSectionsAction` → `Result<page, 'service_unavailable'>` |

Lists and sections use `useSyncedPaginatedList` + `useInfiniteScroll` (sentinel + `sr-only` keyboard button, no visible Load more). A failed page shows an inline `role="alert"` (`favorites_load_more_error`) with Retry.

## Cache invalidation

`favorites/types` is tagged `userFavoritesTypes`; `categories`, `shop-objects` and `shop-sections` are tagged `userFavorites`. Toggling the administrative heart revalidates both for the account (`revalidateUserSocialAfterBroadcast`), so the type menu, rail, counts and lists update on `router.refresh()`.

## Verification

| Command | Purpose |
|---------|---------|
| `pnpm nx test web --testPathPatterns=favorites` | Path helpers, breadcrumbs, type menu, rail panel (desktop and drawer), clients |
| `pnpm typecheck:web` | Route and component types |
| Manual | `/@acc/favorites`, `/@acc/favorites/recipe/German%20Cuisine/Comfort%20Food?tags=Cuisine:german`, `/@acc/favorites/place`: type tabs, categories rail (empty on Place, scrolls with the page), crumbs keep filters, filters on a type without categories, Uncategorized, infinite scroll, Back/Forward, mobile category drawer (drill in, leaf closes, Back closes); `/@acc/recipe` opens the post route |
