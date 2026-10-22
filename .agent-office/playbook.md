# TravelPlanner playbook

Lessons for this project only. Added by the retro, newest first, never deleted.

## Lessons

- 2026-10-21: On a fresh clone, run `npm run build -w packages/shared` and
  `npm run prisma:generate -w apps/backend` before `npm test`; otherwise 5 backend suites
  fail with "Cannot find module". Evidence: daily/2026-10-21/eng.md, qa.md.
- 2026-10-22: Date-helper specs should use zone-less local ISO strings and be run under at least two other TZ values (e.g. Pacific/Auckland, America/Los_Angeles) so they are stable on any machine. Evidence: daily/2026-10-22/qa.md, handoffs/2026-10-22-eng-to-qa-T-002.md.
