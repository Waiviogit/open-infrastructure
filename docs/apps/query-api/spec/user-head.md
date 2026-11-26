---
id: docs-apps-query-api-spec-user-head
title: User head
description: Viewer-independent profile hero fields (GET /users/:name/head) — painted by the web profile page before the full profile.
type: spec
status: active
scope: query-api
tags: [query-api, users, profile, performance]
updated_at: 2026-11-26
related:
  - docs/apps/query-api/spec/overview.md
  - docs/apps/query-api/spec/users-profile-endpoint.md
  - docs/apps/web/spec/pages/user-profile/data-loading.md
---

# User head

**Back:** [query-api overview](overview.md) · **Related:** [User profile endpoint](users-profile-endpoint.md), [web profile data loading](../../web/spec/pages/user-profile/data-loading.md)

The cheap subset of [`GET /users/:name/profile`](users-profile-endpoint.md) that the profile hero needs. The web paints the hero (and checks that the account exists) from it, while the full profile, follow state and the account sidebar are still loading.

## Route

| Method | Path |
| ------ | ---- |
| `GET` | `/query/v1/users/{name}/head` |

No headers: the response is the same for every visitor, so callers cache it per account. **404** when `accounts_current` has no row for `name`.

MCP tool: `get_user_head`.

## Response: `UserHeadView`

`UserProfileView` without `is_following` / `viewer_bell`: `name`, `displayName`, `bio`, `avatarUrl`, `coverImageUrl`, `followerCount`, `followingCount`, `postingCount`, `reputation`, `wobjectsWeight`.

## Pipeline

`GetUserHeadEndpoint`: one `accounts_current` primary-key read (`AccountsCurrentRepository.findByName`), mapped by the same `mapAccountToUserProfileView` as the profile with no chain metadata. The avatar follows the one resolver (`avatarUrlFromJoinedAccountRow` order: posting metadata, `json_metadata`, `profile_image` column).

Difference from `/profile`: the profile prefers the live Hive `posting_json_metadata` (`get_accounts`, Redis 60 s) for name, bio, avatar and cover. The head uses only the indexed row, so right after a profile edit — until the indexer applies it — the two can differ for a moment.

## Verification

| Command | Purpose |
|---------|---------|
| `pnpm nx test query-api --testPathPatterns=get-user-head` | Missing account, mapping parity with the profile, avatar fallback |
| `curl -s localhost:7000/query/v1/users/alice/head` | Manual smoke |
