# Cuti

A trip planner for groups: one shared itinerary and one shared expense ledger,
built to hold up for anything from a weekend for two to a 15-person group
trip that splits into sub-groups on some days.

## Features

- **Day-by-day itinerary** — stops, hotels and flights, with a route map and
  that day's weather alongside it.
- **Group splitting** — an itinerary item (or a whole day) can be scoped to
  just the members going. The route map draws each sub-group as its own
  line and only reconnects them where the group is actually back together.
- **Expense splitting** — log what was spent, attach a receipt, split
  service charge/tax automatically, track who's settled up.
- **Budgeting & reports** — spend-vs-budget tracking, a per-category and
  per-member breakdown, PDF/CSV export.
- **Suggested places** — nearby points of interest by category (landmarks,
  leisure, shopping, city walk), sourced from OpenStreetMap and Wikidata.

## Project structure

An npm workspaces monorepo:

```
apps/
  backend/   NestJS + Prisma (PostgreSQL) API
  web/       React + Vite web app
  mobile/    Expo (React Native) app
packages/
  shared/    Types and pure logic shared across apps (e.g. expense splitting math)
```

## Prerequisites

- Node.js (LTS) and npm
- A PostgreSQL database

## Setup

Install dependencies for every workspace from the repo root:

```bash
npm install
```

Configure the backend:

```bash
cp apps/backend/.env.example apps/backend/.env
# edit apps/backend/.env — at minimum, point DATABASE_URL at your Postgres instance
```

Run migrations and start the backend:

```bash
npm run prisma:migrate --workspace=apps/backend
npm run dev:backend
```

In another terminal, start the web app:

```bash
npm run dev:web
```

The web app expects the backend at `http://localhost:3000` by default; the
backend expects the web app at `http://localhost:5173` (used to build links
in emails). Both API URLs and mail delivery are configurable via
`apps/backend/.env` — see the comments in `apps/backend/.env.example`. Email
sending is optional: leave `SMTP_HOST` unset and password-reset/invite
emails are logged to the console instead, which is fine for local dev.

### Mobile

```bash
cp apps/mobile/.env.example apps/mobile/.env
# edit EXPO_PUBLIC_API_URL if the backend isn't reachable at localhost from your device/simulator
npm run start --workspace=apps/mobile
```

## Scripts

Run from the repo root:

| Command | Description |
| --- | --- |
| `npm run dev:backend` | Start the API in watch mode |
| `npm run dev:web` | Start the web app dev server |
| `npm run build` | Build every workspace that has a build script |
| `npm test` | Run tests in every workspace that has them |

## Tech stack

- **Backend**: NestJS, Prisma, PostgreSQL, JWT auth, nodemailer
- **Web**: React, Vite, React Router, Leaflet
- **Mobile**: Expo / React Native
- **Shared**: TypeScript, Jest
