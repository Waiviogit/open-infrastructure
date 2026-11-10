---
id: web-user-follow
title: User follow
description: "- Profile hero: `UserProfileHeroClient` on `/@{account}` (layout under `user-profile/[name]`). - Account lists: `UserSocialAccountRow` on `/@{account}/followers` and `/@{account}/following`. - Objects tab: `UserSocialObjectRow` on `/@{account}/following-objects` (viewer **Follow** / **Following** per object via ODL `object_follow`)."
type: spec
status: active
scope: web
tags: [web, user-profile, social]
updated_at: 2026-11-10
related:
  - docs/apps/web/spec/overview.md
  - docs/apps/web/spec/pages/user-profile/routes/social-graph.md
---

# User follow (profile hero & social lists)

**Back:** [web overview](overview.md) · **Related:** [object-follow.md](object-follow.md), [chain-indexer ODL pipeline](../../chain-indexer/spec/odl-pipeline.md), [chain-indexer social parsers](../../chain-indexer/spec/social-parsers.md)

## Route context

- Profile hero: `UserProfileHeroClient` on `/@{account}` (layout under `user-profile/[name]`).
- Account lists: `UserSocialAccountRow` on `/@{account}/followers` and `/@{account}/following`.
- Objects tab: `UserSocialObjectRow` on `/@{account}/following-objects` (viewer **Follow** / **Following** per object via ODL `object_follow`).

Every row button shows the **logged-in viewer's** state, not the profile owner's: on `/@bob/following` a viewer sees **Follow** for accounts they do not follow, even though bob follows all of them. Rows on your own profile never show a button for yourself (`isSelf`, case-insensitive).

## Follow / Unfollow (user-to-user)

- Broadcasts standard Hive `custom_json` with `id: "follow"` via `buildHiveFollowOp` / `buildHiveUnfollowOp` (`what: ["blog"]` / `what: []`).
- Indexed by existing `FollowSocialService` into `user_subscriptions`.
- UI: `SocialFollowButton` — **Follow** / **Following** with hover → **Unfollow** (same pattern as object hero).
- Guests see **Follow**; clicking it opens the login modal (`useLoginModal().openLogin`). The button is never disabled for guests.
- Optimistic toggle; after `awaitTrxConfirmation`, `refreshAfterBroadcast` revalidates the list owner (`onBroadcastRevalidate`), the viewer and the target account (`revalidateUserSocialAfterBroadcast`).

## Bell (user subscriptions)

- Shown on profile hero when `isFollowing` is true.
- Broadcasts ODL `user_follow` with `method: 'bell'` via `buildOdlUserFollowBellOp`.
- Indexed by `FollowUserBellHandler` → `user_subscriptions.bell`.
- Reflected as `viewer_bell` on `GET /query/v1/users/{name}/profile` when `X-Viewer` is set.

## Initial state (profile)

From `UserProfileShellUser` (`isFollowing`, `viewerBell`), mapped from query-api profile:

- `is_following` — viewer has a `user_subscriptions` row to this account.
- `viewer_bell` — `bell` on that row (false when not following or null).

## Object follow (following-objects tab)

- Row state is `isCurrentFollowing` from `GET /users/{name}/following-objects` — whether the **viewer** (`X-Viewer`) follows the object. On your own profile every row is **Following**.
- Same `SocialFollowButton` as account rows; guests see **Follow** and get the login modal.
- Broadcasts ODL `object_follow` `method: 'follow' | 'unfollow'` via `broadcastObjectFollowToggle` (`buildOdlObjectFollowOp`).
- Optimistic toggle; after confirmation revalidates the profile owner, the viewer and the object (`revalidateObjectAfterBroadcast`). The row stays in place; on your own profile an unfollowed object drops out after the refresh (`useSyncedPaginatedList`).

## Verification

- `pnpm nx test hive-broadcast` — Hive follow + `buildOdlUserFollowBellOp` specs
- `pnpm nx test chain-indexer --testPathPatterns=follow-user-bell`
- Manual: follow user from profile hero, toggle bell, unfollow from following list and objects tab
- Manual: as another user on `/@{account}/following-objects`, rows show your own state; as a guest, **Follow** opens login
