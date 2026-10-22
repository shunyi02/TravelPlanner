# JQ (qa) — 2026-10-22

- Tested T-002 (PR #2, branch claude/T-002, commit 0d8d50b), the only ticket in review.
- Fresh clone setup (shared build, prisma generate) then `npm test`: shared 47, backend 89 pass. `npm run build:web` passes.
- Criteria: spec exists, covers daysBetween/shiftDay/dayDelta/groupByDay, source unchanged, tests pass. All met.
- Edge cases: 17 new tests pass in Auckland, Los Angeles and Singapore time zones. Mutation check (shiftDay off by one) makes 5 tests fail, then reverted.
- Gap, not a bug: dateKey, flight path of dayKeysFor, hotelDayLabel, formatTime have no tests (out of ticket scope).
- Result: T-002 approved; comment posted on PR #2 (draft). Owner merges, PM sets done.
