# Mutu (data) — 2026-10-22

Sources: `.agent-office/tickets/`, `events/travel-planner/2026-10-22.jsonl`, `git log --all`,
open/closed PRs on GitHub.

| Metric | Value |
| --- | --- |
| Tickets done this week | 0 (T-001 approved, T-002 in review; nothing merged) |
| Average cycle time (todo to merged) | n/a, nothing merged yet |
| QA pass rate | 1/1 (T-001 approved 2026-10-21; T-002 not yet tested) |
| Open bugs | 0 filed (T-004 is a known emoji-initials bug, status todo) |
| Open tickets | 5 (1 approved, 1 in_review, 3 todo) |
| Tests passing on claude/T-002 | 136 (shared 47, backend 89), per eng; not re-run by data |
| Shared modules with a spec | 6 of 14 on claude/T-002 (5 on main) |

## Finding

Merging is the bottleneck, not building. T-001 has been approved for a day and its PR is
still not opened (only the compare link exists), and it now blocks T-004. Only PR #2 (T-002)
is open, as a draft. Until the owner merges, "done" stays at 0 and cycle time cannot be
measured, even though two tickets are built.

## Suggested ticket for the PM

None for engineering. For the owner: open the T-001 PR (agents now have GitHub tools, so eng can
open it on the next run if the owner agrees) and review the draft PR #2.
