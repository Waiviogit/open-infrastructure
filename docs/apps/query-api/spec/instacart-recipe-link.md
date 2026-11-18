---
id: docs-apps-query-api-spec-instacart-recipe-link
title: Instacart recipe shopping link
description: Recipe-only Instacart shopping URL — storefront without keys, IDP recipe link when INSTACART_KEY is set.
type: spec
status: active
scope: query-api
tags: [query-api, instacart, recipe]
updated_at: 2026-11-18
related:
  - docs/apps/query-api/spec/overview.md
  - docs/apps/query-api/spec/openai.md
  - docs/apps/query-api/spec/affiliate-links.md
  - docs/apps/query-api/spec/geoip.md
  - docs/apps/query-api/spec/object-featured-post.md
  - docs/apps/web/spec/object-card.md
  - docs/apps/web/spec/pages/instacart/page.md
  - docs/apps/web/spec/pages/object/routes/recipe-left-rail.md
---

# Instacart recipe shopping link

**Back:** [overview](overview.md) · **Related:** [OpenAI](openai.md), [affiliate links](affiliate-links.md), [GeoIP](geoip.md)

Returns a shopping URL for a `recipe` object that has an `identifier` of type `instacart` (case-insensitive; value optional). Recipes never receive `affiliateLinks` — Instacart is the only merchant surface on that type. Web opens [`/instacart/:id`](../../web/spec/pages/instacart/page.md) first, then this endpoint.

## Route

| Method | Path |
| ------ | ---- |
| `GET` | `/query/v1/objects/{objectId}/instacart-link` |

MCP: `get_object_instacart_link`.

## Headers / query

Same locale and governance headers as other object reads (`Accept-Language` / `X-Locale`, optional `X-Governance-Object-Id`). Optional `?country=` plus GeoIP from `@ReqClientIp` — same resolver as affiliate links.

## Response

Success is always `{ url: string }`.

| Status | When |
| ------ | ---- |
| 200 | Recipe with an instacart identifier |
| 404 | Object missing / not visible |
| 422 | Not a recipe, no instacart identifier, or no usable ingredients on the IDP path |

Missing `INSTACART_KEY` / `OPENAI_API_KEY` is never 503.

## Behavior

1. Require `object_type === recipe` and identifier type `instacart`.
2. **No `INSTACART_KEY`:** `https://www.instacart.com` (host `.ca` when country is `CA`). Optional UTM if a governance instacart affiliate **code** exists. No Redis, OpenAI, or IDP. Ingredients are not required.
3. **Key:** empty ingredients → 422. Load the recipe's [featured post](object-featured-post.md) (top pin, else newest post) as the method source; a lookup failure counts as no post.
4. **Cache key** `query-api:cache:instacart-recipe:{objectId}:{fingerprint}` — `fingerprint` is 16 hex chars of SHA-256 over the prompt version, name, description, ingredients, servings field, image and post markdown. Editing the recipe, pinning another post or changing the prompt yields a new Instacart link. **Hit:** apply CA + UTM to the cached **bare** URL; skip OpenAI / IDP. Cache never stores query params.
5. **Miss:** format with OpenAI when `OPENAI_API_KEY` is set (see [Recipe formatting](#recipe-formatting)); else `{ name }[]` + `[description]` (no steps when the description is empty). `servings` is the first integer ≥ 1 from the object `servings` field, else OpenAI `servings`, else `1`. POST Instacart IDP `/idp/v1/products/recipe`. Cache TTL `2_592_000`. IDP failure → storefront URL, no cache write.

## Recipe formatting

Prompt and strict `json_schema`: `apps/query-api/src/domain/instacart/instacart-recipe-prompt.ts` (bump `INSTACART_RECIPE_PROMPT_VERSION` on any change). Request timeout 30 s, `reasoning_effort: low`.

- **Ingredients** come from the `ingredients` field only. A product listed several times (e.g. flour in dough and filling) becomes one entry with the summed total; `measurements` holds that same total in alternative units, never partial amounts. "A or B" keeps only A. No items from notes or serving suggestions.
- **Instructions** follow the post's method (markdown, images stripped, first 12 000 chars) step for step, keeping temperatures, times, chill durations and pan sizes, and adding nothing the source does not say. Time summaries, equipment lists, tips and credits are left out. Without a post, steps follow the description.

UTM (only when a partner code exists):

`utm_campaign=instacart-idp&utm_medium=affiliate&utm_source=instacart_idp&utm_term=partnertype-mediapartner&utm_content=campaignid-20313_partnerid-{code}&subId1={uuid}&subId2={host}`

`subId2` is `SITE_CANONICAL_FALLBACK_ORIGIN` hostname with dots stripped.

## Env

All optional. Defaults: `INSTACART_HOST=connect.dev.instacart.tools`, `OPENAI_MODEL=gpt-5.6-luna`.

## Verification

```bash
pnpm nx test query-api -- --testPathPatterns="instacart|openai|env.validation"
```
