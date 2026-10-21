# Mutu (data) — 2026-10-21

First baseline. Sources: `.agent-office/tickets/`, `events/travel-planner/2026-10-21.jsonl`,
`git log --all` since 2026-10-19.

| Metric | Value |
| --- | --- |
| Tickets done this week | 0 |
| Average cycle time (todo to merged) | n/a, nothing merged yet |
| QA pass rate | n/a, nothing tested yet |
| Open bugs | 0 |
| Open tickets | 3 (1 in_review, 2 todo) |
| Tests passing on claude/T-001 | 125 (shared 36, backend 89) |

## Finding

Test coverage of `packages/shared` is thin: on main, 5 of the 14 shared modules have a spec
(age, apiError, itinerarySheet, passport, splitting). T-002 and T-003 cover two more;
T-001 adds `initials`. Web and mobile have no tests at all, so shared is where tests pay off.

## Suggested ticket for the PM

Add `npm run build -w packages/shared` and `npm run prisma:generate -w apps/backend` to the
test steps in context.md (or a `pretest` script). Terry hit 5 failing backend suites on a
fresh clone without them; every engineer and QA run starts from a fresh clone.
