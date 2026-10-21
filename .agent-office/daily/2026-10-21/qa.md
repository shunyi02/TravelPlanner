# JQ (qa) — 2026-10-21

## T-001 — approved

Tested `claude/T-001` (40bd1e0) from Terry's handoff, starting from a clean shared build.

| Acceptance criterion | Result |
| --- | --- |
| `initials()` in `packages/shared/src/initials.ts`, exported from the index | Pass (index.ts line 15) |
| Spec covers two words, one word, 3+ words, whitespace, lowercase, empty | Pass (6 tests) |
| Web and mobile use shared; mobile file deleted; web no longer defines it | Pass: only definition is in shared; web re-exports it in format.ts; 4 mobile files import from shared |
| `npm test` and `npm run build:web` pass | Pass: 125 tests (shared 36, backend 89); web build exit 0 |

Edge cases (on the built `dist`):

1. Hyphenated, accented, CJK and non-breaking-space names: "Mary-Jane Watson" -> "MW",
   "émile zola" -> "ÉZ", "李 小龙" -> "李小", NBSP-separated -> "AL". All as expected.
2. Name starting with an emoji: "😀 Ada" -> "\ud83dA", a lone surrogate (renders as a broken
   character). Both old copies behaved the same, so it is **not a regression** and not in the
   acceptance criteria. Suggest a follow-up ticket to the PM: take the first code point
   (`[...word][0]`), not the first UTF-16 unit.

## Notes

- Couldn't comment on the PR: it isn't open yet (no GitHub CLI). The approval is recorded
  here and on the ticket. The owner opens and merges the PR:
  https://github.com/shunyi02/TravelPlanner/pull/new/claude/T-001
- Terry's setup steps in the handoff were needed and correct; without them 5 backend suites fail.
