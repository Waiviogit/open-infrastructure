---
id: web-i18n-messages
title: i18n — message catalogs and the translator
description: Catalog format, typed keys, `t(key, values)`, plural forms, catalog tooling and CI checks for `apps/web`.
type: spec
status: active
scope: web
tags: [web, i18n]
updated_at: 2026-11-24
related:
  - docs/apps/web/spec/i18n.md
---

# i18n — message catalogs and the translator

**Back:** [web overview](overview.md) · **Related:** [i18n runtime](i18n.md)

## Catalogs

- One flat JSON file per locale: `apps/web/src/i18n/locales/<locale>.json` — `{ "<key>": "<text>" }`, strict UTF-8 without BOM.
- **`en-US.json` is the reference.** Every other catalog has exactly its keys; a key missing from a locale falls back to the en-US text at load time (`loadMessages`), so users never see a raw key.
- Keys: ASCII `snake_case`, named `<module>_<area>_<meaning>` (`business_offers_tab_drafts`, `wallet_broadcast_failed`). One key per UI meaning — the same English word in two places may need two keys, because other languages translate it differently.
- Placeholders: `{name}` only (ICU-compatible). No `${name}`, `@name`, `%s` or HTML in values; put a literal `@` before `{account}` in the text when the UI shows a handle.
- The catalog is loaded whole per request and passed to the client `I18nProvider`, so every key costs bytes in each HTML document — remove keys the code no longer uses.

## Translator

`useI18n().t` (client) and `createTranslator(messages, locale)` (server, `@/i18n/domain/create-translator`) are the same function:

| Call | Result |
|------|--------|
| `t('key')` | catalog text; the key itself if the catalog lacks it |
| `t('key', { name: 'Ann', amount: 5 })` | text with every `{name}` / `{amount}` filled; unknown placeholders stay visible |
| `t('base', { count: n, … })` | plural form `base_<category>` for the active locale, then filled |

- Keys are typed: `t` accepts `MessageKey` (`keyof` en-US.json) — a typo or a deleted key fails `pnpm typecheck:web`. Carry keys in typed fields (`labelKey: MessageKey`, `Record<Status, MessageKey>`), never as `string`.
- Keys built from data use template literals over typed unions (`` t(`business_tab_${tab}`) `` with `tab: BusinessTab`). Keys coming from a library (notification builders, `libs/core` registries) are cast once at the boundary and covered by a `*.i18n.spec.ts` that asserts they exist in en-US.
- To place a React element inside a sentence (a link, an input), split the translated text with `splitMessage(text, 'name')` from `@/i18n/domain/format-message` — never append the element at the end, word order differs between languages.

## Plural forms

A plural message is stored as `<base>_<category>` keys with the [CLDR categories](https://cldr.unicode.org/index/cldr-spec/plural-rules) of each locale (`Intl.PluralRules`; the i18next v4 layout): en-US `one`/`other`, ru-RU `one`/`few`/`many`/`other`, ja-JP `other` only, ar-SA all six. An optional `<base>_zero` is used for a count of 0 in every locale.

```json
"messaging_members_count_one": "{count} member",
"messaging_members_count_other": "{count} members"
```

`t('messaging_members_count', { count })` picks the form; `PluralMessageKey` types the base. Never choose a form in code (`count === 1 ? …`) — that is English-only.

## Tooling

| Command | Purpose |
|---------|---------|
| `pnpm i18n:add-keys <file.json> [--overwrite] [--dry-run]` | Add or update keys in all 24 catalogs from one file with every locale's text; a plural message is an object of forms per locale (see the script header) |
| `pnpm i18n:remove-keys <key…> [--from-file <file>]` | Remove keys from all catalogs |
| `pnpm i18n:unused [--prefix p] [--out file]` | List en-US keys no source file references (input for `remove-keys --from-file`) |
| `pnpm check:web-i18n-keys [--verbose]` | CI: key names, key parity with en-US, placeholder sets, plural categories; warns about values still identical to en-US |
| `pnpm check:web-i18n-utf8` | CI: strict UTF-8, no BOM, valid JSON |

Catalogs are 2 000+ lines each: find keys with grep (`rg '"wallet_' apps/web/src/i18n/locales/en-US.json`) instead of reading files whole. After removing keys run `pnpm typecheck:web` and the web tests — typed `t()` reports a key that is still used.
