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
| `npm run build:backend` | Production build of the API (shared package, Prisma client, Nest) |
| `npm run start:backend` | Apply pending migrations, then start the built API |
| `npm run build:web` | Production build of the web app into `apps/web/dist` |

## Deploying the web app

The API and the web app deploy separately: the API as a Node service, the
web app as static files. Both build from the repo root.

**API** (e.g. a Render web service)

- Build: `npm ci && npm run build:backend`
- Start: `npm run start:backend` (runs `prisma migrate deploy` first)
- Keep dev dependencies installed (don't set `NODE_ENV=production` for the
  install step): the build uses the Nest CLI and `start` uses the Prisma CLI.
- Environment:
  - `DATABASE_URL`: a hosted Postgres (e.g. Neon)
  - `JWT_SECRET` and `FIELD_ENCRYPTION_KEY`: each from `openssl rand -base64 32`.
    Back up `FIELD_ENCRYPTION_KEY`: saved passport numbers can't be
    decrypted without it.
  - `FRONTEND_URL`: the web app's URL, used in email links
  - `CORS_ORIGINS`: the web app's URL
  - `TRUST_PROXY`: the number of proxies in front of the API (`1` on Render),
    so the login rate limit sees each visitor's IP
  - `SMTP_*`: optional, for sending password-reset and invite emails

**Web app** (e.g. Cloudflare Pages)

- Build: `npm ci && npm run build:web`
- Output directory: `apps/web/dist`
- Environment: `VITE_API_URL` set to the API's URL (read at build time)
- Serve `index.html` for unknown paths, so links like `/profile` load the app.
  Cloudflare Pages does this by default for a single-page app with no `404.html`.

## Tech stack

- **Backend**: NestJS, Prisma, PostgreSQL, JWT auth, nodemailer
- **Web**: React, Vite, React Router, Leaflet
- **Mobile**: Expo / React Native
- **Shared**: TypeScript, Jest
