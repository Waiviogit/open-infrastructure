---
id: docs-apps-agent-wallet-spec-hive-profile-update
title: Hive account profile update
description: MCP tool that merges a profile patch into posting_json_metadata and builds a posting-key account_update2 op.
type: spec
status: active
scope: agent-wallet
tags: [agent-wallet, hive, profile, avatar, account_update2]
updated_at: 2026-11-03
related:
  - docs/apps/agent-wallet/spec/overview.md
---

# Hive account profile update

MCP tool `hive_build_profile_update` changes the **Hive account** profile (avatar, cover, display name, about, location, website). It is not for ODL objects — object avatars use `odl_build_update_create` with `updateType: "image"`.

Agent playbook: skill `hive-account-profile-update` (`npx skills add https://github.com/Waiviogit/skills`).

## Why `account_update2`

| Op | Key | Field written | Use for profile? |
|----|-----|---------------|------------------|
| `account_update2` with only `posting_json_metadata` | posting | `posting_json_metadata` | **Yes** |
| `account_update` | active | `json_metadata` (+ authorities, memo key) | No — legacy field |

Readers prefer `posting_json_metadata.profile` over `json_metadata.profile` (chain-indexer `account-hive-metadata.util.ts`, query-api `avatarUrlFromJoinedAccountRow`). Once `posting_json_metadata` holds a profile, an `account_update` to `json_metadata` changes nothing visible.

## Behavior

1. Normalize `account` (`trim`, strip `@`, lowercase). Empty `profile` → error.
2. `HiveChainContextService.getAccount` (`get_accounts`). Missing account → `Hive account not found: <name>`.
3. `mergeHiveProfileMetadata` (`@opden-data-layer/hive-broadcast`):
   - base profile = `posting_json_metadata.profile`, else `json_metadata.profile`, else `{}`;
   - patch fields: string sets, `null` removes, omitted keeps;
   - all other top-level keys and unknown profile keys are kept; `version: 2` is added when absent;
   - `__proto__` / `constructor` / `prototype` keys are dropped.
4. No changed fields → `ops: []` with a warning. Otherwise one `account_update2` (`json_metadata: ""`, `extensions: []`, no authorities, no `memo_key`) from `buildAccountUpdate2ProfileOp`.

## Input

| Field | Type |
|-------|------|
| `account` | Hive account (owner of the profile and signer) |
| `profile.name` / `about` / `location` | string ≤ 512 chars, or `null` |
| `profile.website` / `profile_image` / `cover_image` | http(s) URL, or `null` |

## Output

`ops`, `opsCount`, `keyType: "posting"`, `signerAccount`, `canSignLocally`, `changedFields`, `previousProfile`, `profile`, `warnings`.

Broadcast with `wallet_broadcast({ ops, keyType: "posting", account })`, or `has_broadcast({ ops, keyType: "posting" })` when the HAS session is that account. Verify with query-api `get_user_profile` after the indexer catches up.
