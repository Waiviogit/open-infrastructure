# CLAUDE.md

Single source of truth for agent rules in this repo is [`AGENTS.md`](AGENTS.md) (shared with Cursor, Codex and other agents).
Do not put rules here — edit `AGENTS.md` instead. This file only wires it into Claude Code.

@AGENTS.md

## Claude Code notes

- Nested rules: apps under `apps/<app>/` have their own `AGENTS.md` (with a matching `CLAUDE.md` that imports it).
  Claude Code loads them automatically when working with files in that app. When a change touches several apps,
  read every affected app's `AGENTS.md` (see "Conflict resolution" in `AGENTS.md`).
- Skills layout is described in "Agent skills" in `AGENTS.md`. Nx skills for Claude Code come from the
  `nx@nx-claude-plugins` plugin enabled in `.claude/settings.json`.
- If an `AGENTS.md` is added to a new app or lib, add a sibling `CLAUDE.md` containing `@AGENTS.md`.

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
