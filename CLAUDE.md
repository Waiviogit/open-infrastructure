# CLAUDE.md

Single source of truth for agent rules in this repo is [`AGENTS.md`](AGENTS.md) (shared with Cursor, Codex and other agents).
Do not put rules here — edit `AGENTS.md` instead. This file only wires it into Claude Code.

@AGENTS.md

## Claude Code notes

- Nested rules: apps under `apps/<app>/` have their own `AGENTS.md` (with a matching `CLAUDE.md` that imports it).
  Claude Code loads them automatically when working with files in that app. When a change touches several apps,
  read every affected app's `AGENTS.md` (see "Conflict resolution" in `AGENTS.md`).
- Extra agent skills/commands live outside `.claude/`: `.agents/skills/` (Next.js) and `.cursor/skills/`, `.cursor/commands/` (Nx, CI).
  Read the relevant `SKILL.md` when the task matches.
- If an `AGENTS.md` is added to a new app or lib, add a sibling `CLAUDE.md` containing `@AGENTS.md`.
