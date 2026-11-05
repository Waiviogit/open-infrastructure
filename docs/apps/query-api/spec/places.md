---
id: query-api-places
title: Google Maps places
description: "GET /query/v1/places/search, /places/:place_id and /places/:place_id/object — Google Places (New) near the caller's IP location, with links to existing ODL objects."
type: spec
status: active
scope: query-api
tags: [query-api, google-maps, geoip, objects]
updated_at: 2026-11-05
related:
  - docs/apps/query-api/spec/geoip.md
  - docs/apps/web/spec/editor/hash-object-search.md
---

# Google Maps places

**Back:** [query-api overview](overview.md) · **Consumer:** [editor `#` search](../../web/spec/editor/hash-object-search.md)

## Endpoints

| Route | Result |
|-------|--------|
| `GET /query/v1/places/search?q=&limit=` | `{ enabled, places: PlaceSearchItem[] }` — Google relevance order |
| `GET /query/v1/places/:place_id` | `PlaceDetails` or 404 (unknown place / Google unavailable) |
| `GET /query/v1/places/:place_id/object` | `{ object_id }` or 404 — no Google call |

`PlaceSearchItem`: `place_id`, `name`, `formatted_address`, `latitude`, `longitude`, `primary_type`, `suggested_object_type` (`restaurant` ⊃ `place` ⊃ `business` by Google types), `existing_object_id`. `PlaceDetails` adds `address {street, locality, state, postal_code, country}` (null parts when Google has none), `phone`, `website`, `work_hours[]`, `photo_uri` (short-lived public URL, key never exposed), `maps_uri`.

MCP mirrors: `search_places`, `get_place_details`, `get_place_object`.

## Behavior

- **Google:** Places API (New) `places:searchText` with a Pro-SKU field mask; details (`GET places/{id}`) and photo (`…/media?skipHttpRedirect=true`) only for the place a user picked. Language = request locale.
- **Location:** client IP (`trust proxy`) → [GeoIP](geoip.md) GeoLite2-City → `locationBias.circle` (50 km). No coordinates → no bias.
- **Dedup:** `existing_object_id` = object with `identifier {type: 'googleMaps', value: place_id}` (`ObjectIdentifiersRepository`, exact case-sensitive match). Always recomputed, never cached.
- **Budget:** queries under 3 chars return no places. Redis cache: search 10 min per (normalized query, limit, locale, location rounded to 0.1°), details 10 min. A per-IP fixed window (60 Google-backed requests / minute) answers **429** and skips Google. Redis failures degrade to no cache / no limit.
- **Failures:** missing `GOOGLE_PLACES_API_KEY` → `enabled: false`; Google error, timeout or malformed body → empty places (search) / 404 (details). Malformed places are dropped individually.

## Config

| Env | Default | Notes |
|-----|---------|-------|
| `GOOGLE_PLACES_API_KEY` | unset | Unset disables the Google section |
| `GOOGLE_PLACES_BASE_URL` | `https://places.googleapis.com/v1` | Override for tests / proxies |

Timeout: `CURRENCY_EXTERNAL_REQUEST_TIMEOUT_MS` (shared external timeout).

## Code

`apps/query-api/src/domain/places/`, `controllers/places.controller.ts`, `repositories/object-identifiers.repository.ts`, `mcp/tools/places.tools.ts`, `openapi/places.openapi.ts`.
