# TravelPlanner (Cuti) — project context

Read this before any work on this project. The owner wrote it; the PM keeps it current.

## What it is

Cuti is a group trip planner: one shared day-by-day itinerary (stops, hotels, flights,
route map, weather) and one shared expense ledger (splitting, receipts, tax/service
charge, settle-up), plus budgets, reports (PDF/CSV export), a packing checklist and
suggested places from OpenStreetMap/Wikidata. Trips can split into sub-groups per day.

## Stack

npm workspaces monorepo, Node >= 22:

| Path | What |
| --- | --- |
| `apps/backend` | NestJS API, Prisma ORM, PostgreSQL, JWT auth, nodemailer |
| `apps/web` | React + Vite + React Router + Leaflet web app |
| `apps/mobile` | Expo (React Native) app |
| `packages/shared` | Types and pure logic used by all apps (splitting math, dates, passport, etc.) |

Web and mobile implement most features twice (e.g. `ExpensesTab` in both). A feature
ticket should say whether it covers web, mobile or both.

## How to run

```bash
npm install
```

- Backend needs a local Postgres and `apps/backend/.env` copied from `.env.example`.
  Agents have no database, so do not try to start the backend or run migrations.
- Web: `npm run dev:web` (expects the API at http://localhost:3000).
- Build check (no database needed): `npm run build:web` and `npm run build -w apps/backend`.

## How to test

```bash
npm run build -w packages/shared
npm run prisma:generate -w apps/backend
npm test
```

- On a fresh clone the first two commands are required; otherwise 5 backend suites fail
  with "Cannot find module".

- Jest runs in `packages/shared` and `apps/backend`. Backend service specs mock Prisma,
  so no database is needed.
- Web and mobile have no tests; check them with `npm run build:web` (type-check + build).
- New pure logic goes in `packages/shared` with a `*.spec.ts` next to it.
- A ticket is not ready for review unless `npm test` and `npm run build:web` both pass.

## Never touch

- `apps/backend/prisma/migrations/**` — never edit or delete an existing migration. If a
  ticket needs a schema change, stop and record it as blocked for the owner.
- `apps/backend/prisma/schema.prisma` — only with the owner's written approval on the ticket.
- `.env`, `.env.*` (except `.env.example`), any secrets, keys or credentials. Never commit
  real values for `JWT_SECRET`, `FIELD_ENCRYPTION_KEY`, `DATABASE_URL` or `SMTP_*`.
- Field encryption (`apps/backend/src/users/field-cipher.service.ts`) and auth
  (`apps/backend/src/auth/**`) — changes need the owner's approval on the ticket.
- Deployment config and the `build:*` / `start:*` scripts in `package.json`.
- Production or hosted databases, Render, Cloudflare Pages, or any live service.
- `apps/mobile/.claude/`, `apps/mobile/CLAUDE.md`, `apps/mobile/AGENTS.md`, `.claude/`.
- No new dependencies without saying why in the PR.

## Notes

- Users' passport numbers are personal data; never log, print or put them in fixtures.
- Keep tickets small: one feature or fix, one app where possible.
