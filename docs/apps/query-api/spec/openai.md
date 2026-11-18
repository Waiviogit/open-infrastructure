---
id: docs-apps-query-api-spec-openai
title: query-api OpenAI client
description: Optional OpenAI chat completions helper used by Instacart recipe ingredient formatting.
type: spec
status: active
scope: query-api
tags: [query-api, openai]
updated_at: 2026-11-18
related:
  - docs/apps/query-api/spec/overview.md
  - docs/apps/query-api/spec/instacart-recipe-link.md
---

# OpenAI client

**Back:** [overview](overview.md) · **Used by:** [Instacart recipe link](instacart-recipe-link.md)

Reusable Nest module at `apps/query-api/src/domain/openai/`. Official [`openai`](https://www.npmjs.com/package/openai) package. No recipe or Instacart knowledge.

## API

`OpenAiJsonClient.promptWithJsonSchema({ prompt, jsonSchema, timeoutMs?, reasoningEffort? })` calls `chat.completions.create` with `response_format: { type: 'json_schema', json_schema }`. `jsonSchema.strict` (default `false`) turns on Structured Outputs strict mode. `reasoningEffort` is sent as `reasoning_effort` and only works with reasoning models.

Returns `{ result }` or `{ error }`. Missing `OPENAI_API_KEY`, timeout, empty completion, or parse failure never throw.

## Env

| Variable | Default |
| -------- | ------- |
| `OPENAI_API_KEY` | unset (skip outbound calls) |
| `OPENAI_MODEL` | `gpt-5.6-luna` |

Request timeout is `CURRENCY_EXTERNAL_REQUEST_TIMEOUT_MS` unless the caller passes `timeoutMs`.
