# Game Scoreboard

A private scoreboard app for tracking players and scores across game sessions. Built with React 19, Tailwind CSS 4, and a Bun + SQLite backend (Drizzle ORM).

## Features

- **Scoreboard tab** — add players in order, enter scores per round, live leader highlight. Player order is preserved (never reordered).
- **Spades tab** — a separate scorecard with nil-bid tracking (nil made/missed, blind nil made/missed). Each tab is independent.

## Stack

- Client: React 19, TypeScript, Tailwind CSS 4, TanStack React Query, Recharts
- Server: Bun, Drizzle ORM, SQLite
- Package manager: Bun 1.3.10

## Getting started

```bash
bun install
bun run build
```

## Scripts

| Script             | What it does                              |
|--------------------|-------------------------------------------|
| `bun run build`    | Build server bundle and client            |
| `bun run typecheck`| Type-check client and server              |

Database migrations live in `drizzle/` and apply on startup.

## Notes

- This codebase was originally scaffolded as a hosted web-artifact "space" (`space.json`, `AGENTS.md`, and `DATA-PLAN.md` describe that setup). The app logic in `client/` and `server/` is plain React + TypeScript and can be adapted to any host.
- `app.db` (SQLite) is gitignored — game data is not committed.
