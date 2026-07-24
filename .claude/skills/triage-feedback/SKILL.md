---
name: triage-feedback
description: Pull in-app product feedback from Supabase, analyze it (duplicates, actionable vs. needs-decision, dependencies, effort, execution order), and fold the results into BACKLOG.md. Use when Andrew asks to "pull down feedback," "check feedback," or "triage feedback" for Dog Life OS.
---

# Triage feedback

Runs the full loop from raw in-app feedback submissions to an updated `BACKLOG.md`. Three phases — do not skip to phase 3 without doing 1 and 2 first, and do not fold anything in without Andrew having seen the analysis (unless he's explicitly pre-approved skipping the review step for this run).

## Phase 1 — Pull

```
npx tsx scripts/export-feedback.ts
```

Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`; the script errors with clear instructions if it's missing. Writes `FEEDBACK.md` (all rows, newest first) at the repo root, overwriting the previous export.

## Phase 2 — Analyze

`BACKLOG.md` already has a "Feedback backlog" table at the bottom with a status legend (🟡/✅/⏸️/🚧/⬜). Only the rows **not yet in that table** are new — diff `FEEDBACK.md` against it by timestamp/message rather than re-triaging everything.

For each new row:

1. **Duplicates.** Same message text (even across different `feedback_type` values) submitted close together = one item, not two.
2. **Clusters.** Group items that touch the same component, same UI technique (e.g. multiple "freeze on scroll" asks), or the same underlying data model — note them even if you keep them as separate rows, since batching avoids touching the same file/pattern twice.
3. **Cross-cutting decisions.** If several items assume something that doesn't exist yet (e.g. a category taxonomy, a naming convention), don't quietly build four different guesses — surface it as one open decision that blocks all of them, propose a default grounded in what's actually in the code, and let Andrew confirm or edit it.
4. **Verify against code, don't guess.** Before writing an effort estimate or claiming a field/component exists, grep for it (`src/types.ts` for data shapes, `src/components.tsx` / `src/views.tsx` for UI). Cite `file:line` in the assessment when a claim depends on current code shape — memory and prior write-ups go stale.
5. **Effort estimate.** Rough hours, calibrated against similar work already shipped (check the existing Feedback backlog table for comparable items and their actual scope).
6. **Quick-fix vs. backlog item.** Per [[dog_life_backlog_workflow]]: small, unambiguous tweaks stay as a Feedback backlog row only. Anything that's a meaningful chunk of work — especially with an unresolved architectural fork (new data model, unclear design, or removes/replaces existing working UI) — gets promoted to a new numbered top-level `BACKLOG.md` item, with the Feedback backlog row pointing at it ("promoted to backlog item N").
7. **Recommended execution order.** Sequence into phases: no-dependency quick wins first, then anything blocked on a decision (after the decision lands), then UI areas that overlap (build together, not twice), then the biggest/least-defined items last.

Present this analysis to Andrew (duplicates found, cluster/dependency notes, effort, promoted items, proposed order) before writing to `BACKLOG.md`, unless he's already asked you to go straight to folding it in.

## Phase 3 — Fold into BACKLOG.md

- New rows go in the "Feedback backlog" table, status ⬜ Not started (or 🚧 Blocked if waiting on Andrew for a decision), Assessment column carrying the effort/dependency/sequencing notes from Phase 2.
- Promoted items get a new row in the top summary table (next `#`, Priority/Impact/Est. hours/Depends on) plus a `### N. Title` entry in the Details section, following the existing voice: state what came up and when, the open fork if any, and what NOT to assume/build until it's resolved.
- Cross-cutting decisions (like a taxonomy) get a short callout paragraph near the top of the Feedback backlog section — proposed default included, marked pending confirmation — not buried in a single row.
- Never mark a row 🟡 or ✅ during triage-only work — those require actually building + verifying (🟡) or Andrew's explicit confirmation (✅). A freshly-triaged row is ⬜ or 🚧 at most.

## Notes

- This whole flow assumes `BACKLOG.md`'s existing structure and status legend — read the current file rather than assuming its shape, it evolves.
- See memory [[dog-life-backlog-workflow]] and [[dog-life-project-scope]] for the broader why behind this process.
