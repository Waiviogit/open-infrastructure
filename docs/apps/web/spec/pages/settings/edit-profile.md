---
id: web-pages-edit-profile
title: Edit profile page
description: "Signed-in user edits the Hive account profile (posting_json_metadata.profile): name, about, location, email, website, avatar, cover, social handles, crypto wallets and the comment signature."
tags: [web, page, settings, profile]
related:
  - docs/apps/web/spec/pages/index.md
  - docs/apps/web/spec/pages/tools/page.md
  - docs/apps/web/spec/comment-edit.md
type: spec
status: active
scope: web
updated_at: 2026-11-19
---

# Edit profile page (`/edit-profile`)

**Back:** [site map](../index.md) · **Related:** [tools hub](../tools/page.md), [settings](page.md)

## Purpose

Port of the legacy Waivio Edit profile page. The viewer edits their own Hive account profile; nothing is stored off chain.

## Route

| Item | Detail |
|------|--------|
| Path | `/edit-profile` — `apps/web/src/app/(app)/(hub)/(tools-shell)/edit-profile/page.tsx` (+ `loading.tsx`) |
| Shell | Tools hub sidebar; **Edit profile** is the first item of the **Personal** group (`ToolsLayoutNav`) |
| Entry points | Own-profile header **Edit profile** button (`user-header.tsx`), tools sidebar |
| Auth | Anonymous request → 307 to `/sign-in` (`signed-in-routes.ts`); the page keeps its own `redirect('/sign-in')` fallback |
| Robots | `disallow` in `app/robots.ts`; page metadata `noindex` |

## Data

Prefill reads the account live from a Hive node (`condenser_api.get_accounts`, `loadHiveAccountMetadata`), not from query-api: the save merges into the same live metadata. The profile is `posting_json_metadata.profile`, falling back to `json_metadata.profile` when the posting one has none (`mergeHiveProfileMetadata` precedence in `@opden-data-layer/hive-broadcast`). If every node fails the page shows `profile_load_error` instead of an empty form.

## Fields

All keys are flat on `profile` (legacy Waivio names). An emptied field removes the key.

| Group | Keys | Rule |
|-------|------|------|
| Basic | `name`, `about`, `location`, `email`, `website` | Trimmed; `email` basic shape; `website` must parse as an http(s) URL (`https://` assumed when no scheme) |
| Images | `profile_image`, `cover_image` | Uploaded to IPFS (`IpfsImageDropZone`), stored as the content-gateway URL; must be an absolute http(s) URL |
| Social profiles | `facebook`, `twitter`, `youtube`, `instagram`, `tiktok`, `snapchat`, `github`, `reddit`, `telegram`, `whatsapp`, `pinterest`, `twitch`, `linkedin` | Handle, not URL: leading `@` stripped, `[0-9A-Za-z._-]+`; `whatsapp`: `+` and 6–15 digits |
| Crypto wallets | `bitcoin`, `litecoin`, `ethereum`, `lightningBitcoin` | Format check only: BTC base58 `1…`/`3…` or `bc1…`; LTC `L…`/`M…`/`3…` or `ltc1…`; ETH `0x` + 40 hex; Lightning `name@domain` or `lnurl1…` |
| Signature | `signature` | Markdown from the shared editor, with a live preview |

Every value is capped at 5000 characters. Rules apply only to fields the user changed, so a legacy value that fails today's rules never blocks saving other fields. Field ids, rules and the form → patch diff live in `modules/profile-settings/domain/profile-form.schema.ts`; the same schema re-validates the patch in the server action.

## Save

1. The client sends only the changed fields (`HiveProfilePatch`) to `buildProfileUpdateOpAction`.
2. The action checks the cookie user is the account, re-validates the patch, reads the account live and merges with `mergeHiveProfileMetadata` (every other profile key and every other top-level key of `posting_json_metadata` is kept; `version: 2` added when missing).
3. It returns a typed `account_update2` with empty `json_metadata` → **posting key** (Keychain `Posting`, HiveSigner token broadcast, HAS posting).
4. `awaitTrxConfirmation` → `refreshAfterBroadcast` with `revalidateUserSocialAfterBroadcast` (profile hero + account sidebar caches) → navigate to `/@name`.

Errors: field errors inline under each input; action and wallet errors in one `role="alert"` line. A HiveSigner redirect is not an error.

## Signature on comments

New Hive replies (`StoryCommentEditor`) and object threads (`ObjectThreadComposeBar`) end with the author's signature as its own paragraph (`appendSignature`). Threads add it before the object anchor, which must stay the last paragraph. Not added to posts, comment or thread edits, DMs, activity notes or object Activity. The signature is read once per page session (`getViewerSignature`, server action on chain) and replaced right after a profile save.

Out of scope: Waivio guest accounts (`waivio_*`) and avatar crop/rotate.

## Verification

| Check | How |
|-------|-----|
| Unit | `pnpm nx test web --testPathPatterns=profile-settings`, `pnpm nx test hive-broadcast` |
| Runtime | Own profile → **Edit profile** → menu item active, fields prefilled; change a field → Save → posting-key prompt → back on `/@name` with the new value; new comment ends with the signature |

## Related code paths

| Path | Role |
|------|------|
| `apps/web/src/modules/profile-settings/` | Form, schema, save hook, signature cache |
| `apps/web/src/modules/profile-settings/infrastructure/actions/profile-update.actions.ts` | Build op (live merge), viewer signature |
| `libs/hive-broadcast/src/hive-account-profile-operations.ts` | Profile field list, merge, `account_update2` builders |
| `apps/web/src/modules/auth/infrastructure/signers/` | `account_update2` wire mapping and posting-key signing |
