# TravelPlanner playbook

Lessons for this project only. Added by the retro, newest first, never deleted.

## Lessons

- 2026-10-21: On a fresh clone, run `npm run build -w packages/shared` and
  `npm run prisma:generate -w apps/backend` before `npm test`; otherwise 5 backend suites
  fail with "Cannot find module". Evidence: daily/2026-10-21/eng.md, qa.md.
