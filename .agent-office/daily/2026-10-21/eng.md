# Terry (eng) — 2026-10-21

- Took T-001 (no changes_requested tickets). Branch `claude/T-001`, commit 40bd1e0.
- Moved `initials()` into packages/shared with a 6-case spec; web re-exports it, mobile
  imports it, mobile copy deleted.
- Tests: `npm test` 125 passed (shared 36, backend 89); `npm run build:web` passed.
- Setup gotcha: on a fresh clone `npm test` fails in 5 backend suites until you run
  `npm run build -w packages/shared` and `npm run prisma:generate -w apps/backend`.
  context.md should say so.
- `npx tsc --noEmit -p apps/mobile` fails on main before my change, so mobile wasn't type-checked.
- Kept `package-lock.json` and `apps/web/tsconfig.tsbuildinfo` churn out of the commit.
- Blocked on one thing: couldn't open the PR (no GitHub CLI). Branch is pushed; owner to open it.
- Handoff: handoffs/2026-10-21-eng-to-qa-T-001.md.
