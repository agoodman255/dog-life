# Backlog

Feature ideas for Dog Life OS beyond the current build, captured for prioritization rather than built immediately. Say "return my backlog" to get this list back with priority/impact/cost.

Vision shift noted here: Dog Life OS is expanding from a dog-training app into a full household life app — dog training is the first chapter, not the whole book. Humans in the household get their own health, spending, chores, and planning support alongside the dogs'.

| # | Feature | Priority | Impact | Est. hours | Depends on |
|---|---------|----------|--------|------------|------------|
| 1 | Human health & wellness tracking | High | High | ~5h | none |
| 2 | Cost field on events/tasks + spending analytics | High | High | ~6h | none |
| 3 | Household chores tracker for humans | Medium | Medium | ~4h | none |
| 4 | Person availability / travel tracker | Medium-High | Medium (High w/ #5) | ~3h | none |
| 5 | Travel-aware chore/task reassignment | Medium | High | ~6h | #4 |
| 6 | Guided multi-day trip/event planner (manual wizard) | Medium-High | High | ~7h | #2 |
| 7 | AI-assisted natural-language idea capture | Medium | Very High | ~10-14h | #6, **and a decision on which LLM/API to wire up** |
| 8 | "Full life" reframe of nav/profiles for humans | Low-Medium | Medium | ~3h | #1-3 give it substance |
| 9 | In-app file upload (dog photos + vet receipts/records), private storage | Medium-High | Medium-High | ~6-8h | Decision on anonymization (see notes) |
| 10 | Daily AI coach summary (dynamic, milestone-aware) | Low | Medium | Unscoped | Same LLM/API decision as #7 |
| 11 | Task-completion-flow rework (mandatory checklist/comments, edit-after-end, per-item scoring) | High | High | Built | 🟡 **Built 2026-07-25** as part of item 16's unification. Andrew resolved the open scoring fork: per-checklist-row 1-5 + notes AND an overall 1-5 + notes. Completion is now date-aware and lives in one place (see item 16). |
| 12 | Daily training auto-scheduling (embed training tasks into every day, driven by relationships to meals/potty/etc.) | Medium | High | ~8-12h | Category taxonomy (below) + a design pass on the rule engine — most open-ended item in the backlog |
| 13 | Readiness/milestones as their own section (out of Dashboard, subcategories, click-through from tasks) | Medium | Medium-High | ~4-5h | Subcategory taxonomy decision; sequence after #4-equivalent Dashboard task-list cleanup lands |
| 14 | Condensed top navigation (hamburger menu replacing page nav bar) | Medium | Medium | ~3-4h | **Needs Andrew's confirmation before removing the existing nav bar** — build alongside the calendar view-switcher dropdown (Feedback backlog) since both restyle the same header |
| 15 | Calendar event editing overhaul (delete + recurring exceptions, real recurrence engine, structured time fields, formulaic alone-time coverage) | High | High | Built | 🟡 **Built 2026-07-24 — all 3 open questions answered by Andrew, built same session.** Browser-verified end-to-end (see item 15 notes). |
| 16 | Unify Task/Event/Health into one item type with capability toggles | High | Very High | Built | 🟡 **Built and migrated to production 2026-07-25.** Supersedes the three-type split. Old source tables (`tasks`, `calendar_events`, `health_events`, `task_instances`) still exist, unused, pending an explicit go-ahead to drop — see item 16 notes. |
| 17 | Quick Log v2 — structured Dashboard "Log" tab (potty/play/training/food/water) | Medium-High | High | Built | 🟡 **Built and browser-verified 2026-07-26.** Migration `migrate-quick-logs-2026-07-26.sql` written but **not yet run against production** — see item 17 notes. |

## Details

### 1. Human health & wellness tracking
Extend the existing `HealthEvent` pattern (currently dog-only) to household members: gym sessions, doctor/dentist/specialist visits, medications, symptoms. Reuses the Health view and calendar layer already built for dogs — same data shape, new `personId` alongside `dogId`.

### 2. Cost field on events/tasks + spending analytics
Add an optional `cost` (amount + category) to calendar events and tasks. When you add something to the calendar, it asks how much it costs (or lets you skip). New Analytics section rolls spending up by category (entertainment, medical, chores/supplies, etc.) so you can see running totals and decide whether to pull back — this is the direct "should I wind back" ask.

### 3. Household chores tracker for humans
Recurring, assignable human chores (laundry, yard work, dishes, trash) as their own category, distinct from dog-care tasks, rotating between household members. Mostly reuses the existing `Task`/assignment model.

### 4. Person availability / travel tracker
Let a household member be marked "traveling" or "unavailable" for a date range. This alone doesn't change behavior — it's the data #5 needs to reason about who's around.

### 5. Travel-aware chore/task reassignment
When someone is marked traveling (#4), the app flags their essential chores/tasks and either reassigns them to the other adult for the trip's duration, or — if the task genuinely needs the traveling person specifically — surfaces a "finish before you leave" list in the days before departure.

### 6. Guided multi-day trip/event planner (manual wizard)
A structured "Add a trip" flow: pick a date range, then add items per day (Tuesday: X, Y; Wednesday: Z), with the form prompting for time/cost/location per item as you go. No AI required — this is the deterministic version of what you described, and it's the fallback/data model that #7 would build on top of.

### 7. AI-assisted natural-language idea capture
The version you actually described: type or paste free text ("for my trip next week to Atlanta I want to do these things Tuesday...") and have it parsed into the structured events from #6 automatically, with the app asking clarifying follow-ups only for what's missing (time, cost, location). This is the highest-value, highest-cost item because it requires actually wiring up an LLM API — picking a provider, handling the key/cost-control questions the README's feedback-loop section already flags as unresolved. Worth doing once #6 exists so there's a manual fallback and a clear data target for the model to fill in.

### 8. "Full life" reframe of nav/profiles for humans
Once humans have health/chores/spending of their own (#1-3), the Profile/Dashboard framing should stop being pet-centric-with-humans-as-an-afterthought and treat both symmetrically. Mostly a UI/IA pass once the underlying data exists.

### 9. In-app file upload (dog photos + vet receipts/records), private storage
Came up 2026-07-12 while triaging feedback (dog photo upload + vet receipt storage, see Feedback backlog below). Original plan was a backend-only script (I run it manually, hand back a URL to paste into the existing Photo URL text field) using a **public** Supabase Storage bucket — Andrew redirected this: he'd rather have real in-app upload for both photos and receipts, not a manual round-trip through me, and since receipts can carry personal info (address, payment details), the bucket should be **private**, not public. Notes for whoever builds this:
- **Storage**: one private Supabase Storage bucket (or two — photos vs. receipts — if that ends up simpler for RLS policy scoping). Private means reads need either a signed URL (time-limited — bad for a persisted `photo` field that should never break) or an authenticated fetch through the app itself (better: the app holds the session, so it can request the file directly rather than storing a bare URL that has to stay valid forever).
- **Upload UI**: a real `<input type="file">` in DogForm (photo) and HealthEventForm (receipt/record), replacing the current "paste a URL" fields — those free-text URL fields already exist and work fine as a fallback/manual option, so this is additive, not a breaking change.
- **Receipt anonymization**: Andrew's idea — before storing a vet receipt, strip personal info (address, phone, card/payment details) and keep only what's clinically useful, possibly via a Python OCR/text-extraction package run server-side (not client-side, since that'd need the file uploaded somewhere to run Python on it anyway). This needs a concrete decision on: which fields count as "personal" vs. "keep," whether OCR is reliable enough to trust unsupervised, and whether it runs automatically on upload or as a manual "clean this up" step Andrew triggers per receipt. Flagged as unresolved — don't assume an approach, ask when this gets picked up.
- Do not default to a public bucket for anything in this app going forward without explicitly confirming with Andrew first — that was the wrong call once already.

### 10. Daily AI coach summary (dynamic, milestone-aware)
Came up 2026-07-15 during mobile design feedback. Andrew liked the idea of a daily coach/summary box on the Dashboard that changes based on that day's milestones, but flagged the real blocker himself: **how do you keep it fresh without either (a) a human rewriting copy forever, or (b) a live LLM call** — which is the same unresolved cost/latency/provider question already blocking item 7 (AI-assisted idea capture). Removed the old static version (`hero-panel`/"Balanced workload" box, which was just canned copy claiming to be adaptive) rather than keep something fake in its place. Don't rebuild this until either #7's LLM decision lands, or a cheaper non-LLM heuristic (e.g. templated sentences driven by real state: next milestone, overdue count, today's heaviest task) is explicitly requested instead.

### 11. Task-completion-flow rework
**Built 2026-07-25** alongside item 16. Andrew resolved the scoring fork that had blocked this: **both** levels get scored — every checklist row carries its own 1-5 and notes, and the item as a whole carries an overall 1-5 and notes. My earlier recommendation (parent-level only) was overridden, deliberately: a session can go fine overall while one specific step went badly, and only per-row scores make that visible to the weekly ingest pass.

What shipped:
- Per-row score + notes on every checklist row (`ChecklistItemValue.rating`), overall score + notes on the occurrence (`ItemOccurrence.rating` / `ratingNotes`).
- "Edit this completion" on a completed occurrence — reopens the same review panel, closing the no-way-to-fix-a-mistake gap.
- Quick-complete now only appears for items with **no** checklist. Once there are rows to work through, skipping to a bare score would bypass exactly the data this rework exists to capture. Not removed outright, since it's still the right affordance for a trivial item.

Still open from the original bundle: requiring a comment before close (currently optional), and the embedded meal-detail panel (training-milestone panels already exist and now drive checklists directly — see item 16).

### 12. Daily training auto-scheduling
Came up 2026-07-18 (submitted twice, comment + feature, identical text — one item). Andrew wants training embedded into every day automatically, using "relationships" to decide what's needed when: around every meal, every potty break, very frequently; lighter/hands-off during the work day, more hands-on after work. This is the least-defined item in the backlog — unclear whether "relationships" means the existing `Milestone`/training-link data driving a deterministic rules engine (preferred starting point, no LLM needed — same precedent as item 6's manual wizard before item 7's AI version) or something that needs real-time judgment. Do not scope hours precisely or start building until there's a concrete design pass on the rule engine. The category taxonomy this depended on is resolved (see item 15) — the remaining blocker is purely the rule-engine design.

### 13. Readiness/milestones as their own section
Came up 2026-07-18. Readiness and milestone tracking should move off the Dashboard into their own section, with broader categories and subcategories (examples given: Alone time; Training + subs like etiquette/tricks; Lifestyle + subs like camping/hiking/skiing — Andrew explicitly said "or other ones you define," so propose a default and confirm rather than guess indefinitely). Tasks should still be able to click through to the relevant readiness area (e.g. an alone-time task links to alone-time readiness). Build after the Dashboard task-list cleanup (Feedback backlog: task ordering/collapse, per-card collapse/expand) lands, so the Dashboard layout isn't restructured twice.

### 14. Condensed top navigation (hamburger menu)
Came up 2026-07-18. Replace the visible page nav bar with a hamburger icon (between logo and search) that opens a dropdown pre-filled with the current page. Unlike most Feedback backlog items, this **removes existing, working UI** rather than just adding to it — flagging for Andrew's explicit confirmation before building rather than assuming, per the "don't build big changes on assumption" pattern used elsewhere in this file. Build together with the calendar view-switcher dropdown (Feedback backlog, 2026-07-18 Calendar navigation items) since both restyle the same top-of-app chrome — doing them separately risks two passes fighting over the same layout.

### 16. Unify Task/Event/Health into one item type
Came up 2026-07-25. Andrew: "the item types of task, event, and health don't make much sense and don't seem to be adding value" — and, the headline: "the biggest thing lacking right now is user experience and understanding how to easily add items to the calendar, which items require checklist and completion tasks, vs which items are just events to track vs. which ones require notes or logging for AI powered adaption."

**The actual problem** wasn't the three types — it was that picking a type up front silently decided whether you'd ever be asked to complete or log anything, with nothing in the UI saying so. The scheduling machinery (recurrence, times, coverage) lived on `CalendarEvent`; the completion machinery (checklist, lifecycle, rating) lived on `Task`; `HealthEvent` had neither.

**What shipped:** one `Item` type with two independent capability flags — `requiresCompletion` and `requiresLog` — plus `ItemOccurrence` (per-date state, invisible to the user) and `ItemLog` (timestamped structured + free-text entries). Five Add-menu presets state their consequence on the button ("You check it off…", "Just goes on the calendar…"), and the form's two toggles say in plain language what each will ask for later. Tasks and Health survive as filtered lenses over the same data. Checklists can pull from a training milestone's steps and ticking rows advances that milestone's `completedSessions` (Andrew's call — logging the session *is* the training progress, no double entry).

**Decisions Andrew made** (2026-07-25): both-level scoring (see item 11); Tasks + Health stay as lenses; milestone auto-advance yes; the ingest agent proposes only and writes nothing without confirmation.

**Follow-up pass, same day (2026-07-25):**
- **Per-dog checklist steps.** `ChecklistItemDef.dogId` lets one training item carry different work for each dog — Griz proofing "leave it" while Mara charges a marker word — instead of forcing two calendar items. The form shows a per-row dog selector once 2+ dogs are involved; the completion review groups rows under dog headings. This is what Andrew actually wanted from the old `grizParticipation` field, generalized to any dog. A milestone targeting exactly one dog stamps that dog onto its pulled-through steps automatically.
- **`DailyFeedback` collapsed into `ItemOccurrence`.** There had been two completion systems that never spoke: card ratings wrote a `DailyFeedback` row keyed on item id with *no date* (so completing a daily routine once marked it done forever), while Start→Finish wrote a dated occurrence. `DailyFeedback` is gone from the app entirely — type, mapper, store collection. Its fabricated fields went with it: `mood`, `notes`, `accident`, `fear`, `guarding` were all derived from the rating and category, never observed. Analytics now counts real completed occurrences, real ratings, and — for accidents — real journal entries tagged `accident` from Quick log. The `feedback` table is left untouched in the DB; nothing drops it.
- **Field-wipe regression fixed.** `itemFormValuesToItem` had been hardcoding `supplies: []` / `setting: "either"` / `difficulty: 1` and omitting `location`, `formation`, `relatedMilestoneId`, so opening any item and saving silently wiped six fields. All six now round-trip through real inputs under "Show more options".
- **"Edit item" added to the detail modal.** Unifying the calendar's open handler had accidentally made the detail modal a dead end — you could start, skip or delete an item but never change what it is. Wired in Calendar and Tasks.
- **Dashboard "Today" now means today.** `useAdaptivePlan` filters to items that actually have an occurrence on the current date. Tasks never had recurrence before, so the old agenda listed every routine regardless of date.

### 17. Quick Log v2 — structured Dashboard "Log" tab
Came up 2026-07-26. Andrew wants the Dashboard's existing Quick Log button reworked into five structured categories instead of today's flat accident/potty-win/other picker (`QuickLogForm` in [views.tsx](src/views.tsx:359)):
- **Potty** — pee or poo, a rating, and a note.
- **Play time** — duration, and a note.
- **Training** — pick a linked training type and complete the required training task, so the milestone-progress logic already wired up in item 16 (checking a checklist row advances `Milestone.completedSessions`) tracks it and the app can say what's next / what just unlocked.
- **Food** — rating and a note.
- **Water** — rating and a note.

This data then surfaces on the Dashboard under a new **4th toolbar tab, "Log"**, ordered Today → Log → Milestone → Readiness (today's jump-nav only has Today/Milestone/Readiness — see the `dashboard-jump-nav` block in [views.tsx](src/views.tsx:239)).

**Folds in the Alone-time readiness log.** Dashboard currently has a second, separate log entry point — the `AloneTimeReadinessPanel` with its own "Log" button and `AloneTimeLogForm` ([views.tsx](src/views.tsx:161)) writing to `aloneTimeLogs`. Andrew's read: alone time is really just one training type, so it should become an option under the new Training category rather than living in its own panel/button. `TrainingView` already lists alone-time as a tab alongside Obedience/Socialization/Confidence/Handling ([views.tsx](src/views.tsx:1534)), so the category set for the Training quick-log picker already exists — this is about routing through one entry point, not inventing new categories.

**Resolved fork — the data lives in `item_logs`.** The open question was whether to extend `ItemLog`, extend `JournalEntry`, or add a new entity. Went with extending `ItemLog`: `item_id` is now nullable, and a Quick log carries `quick_log_kind` instead, plus `rating` (1-5) and `milestone_id`. The deciding reason was the ingest path — the `review-logs` skill already reads `item_logs` incrementally via `processed_at`, and a Quick log is the same shape (timestamped, structured `values`, free text, dog-scoped). A second table would have meant a second ingest path for no gain. `JournalEntry` was the wrong home: it has no structured fields at all, only title/text/tags/mood.

**What shipped (2026-07-26):**
- **One spec-driven form.** `QUICK_LOG_SPECS` in [utils.ts](src/utils.ts) declares all five kinds as data; `QuickLogForm` in [components.tsx](src/components.tsx) renders any of them. Every kind follows the same four beats Andrew asked for — one predetermined selection, sub-fields revealed by that selection, a 1-5 score, a note — so the flow is muscle memory regardless of what's being recorded. Adding a sixth kind is a data edit, not a new form.
- **Conditional sub-fields.** `showWhen` hides a field until its trigger is picked — stool consistency only appears once you've said poo. Number fields (duration, amount) get tap-to-fill presets, since typing "30" on a phone is most of the friction the feature exists to remove.
- **Training feeds the milestone engine.** The training type is a live milestone picker (grouped by track, lock status shown inline, filtered to the selected dogs). Picking one lists its steps with current session counts; ticking a step advances that step's `completedSessions`. On save the form reports what moved: step counts, milestone %, "Milestone complete", and **what that unlocked**. Verified end-to-end — completing "Marker word" printed `Unlocked: Sit, Come, Speak` and Sit flipped from locked to Current on the Dashboard.
- **Dashboard "Log" section**, 4th in the jump nav (Today → Log → Milestone → Readiness), with per-kind tallies for the day that double as one-tap entry points into the right kind, and a chronological feed of the day's entries.
- **Alone time folded into Training.** Both old entry points (the Dashboard readiness panel's Log button and the Training view's Alone Time tab) now open the Quick log pre-set to Training → Alone time. It still writes an `alone_time_logs` row alongside the `item_logs` one, because that table is what `computeDogAloneTimeReadiness` reads — verified readiness moved 0m → 45m proven, closing the gap 4h → 3.3h. The standalone `AloneTimeLogForm` was deleted.
- **Analytics accident count kept whole.** An accident is now a potty log whose `Where` is `inside`/`crate`. Analytics counts those **plus** legacy journal entries tagged `accident`, so entries made before this change don't silently drop off the chart.
- `review-logs` skill updated: its Phase 1 pull was an inner join on `items`, which would have silently dropped every Quick log. Now a left join, with the new fields documented.

**Undo, built same day.** Deleting a Quick log now reverses everything it caused, which
matters most for training: a mis-ticked step would otherwise inflate a milestone
permanently. Each feed row has a delete whose confirm names the consequence ("takes one
session back off Charge marker, Use on eye contact in Marker word") rather than asking
a generic "are you sure". `advanced_step_titles` on the log is what makes the rollback
exact — it records which steps the entry advanced, and doubles as the thing the ingest
pass wants to know (which steps were practised, not just which milestone).

Deleting also **re-locks what the entry unlocked**, so the form announcing "Unlocked:
Sit, Come, Speak" isn't a one-way door. This is held to a deliberately narrow rule:
only milestones with *zero* logged sessions whose prerequisites are genuinely no longer
met. A milestone someone has already put work into is never yanked back — verified:
with Sit at 1 logged session and Speak at 0, deleting the completing entry re-locked
Speak and left Sit alone. (The status-sync effect in `store.tsx` deliberately never
writes "locked" back, which is why this is handled in `deleteQuickLog` rather than
there.) An alone-time entry's `alone_time_logs` row is deleted too, or the readiness
panel would keep counting a retracted session — verified 0m ⇄ 1.5h both directions.

No *edit* flow, deliberately: a Quick log takes seconds to re-enter, so delete-and-relog
covers the mistake case without a second form to keep in sync.

**Still open:**
- **The migration has not been run against production.** `supabase/migrate-quick-logs-2026-07-26.sql` is written, idempotent, and mirrored into `schema.sql`, but deliberately not executed — same caution as item 16. Run it before using Quick log against the real database, or the inserts will fail on the missing columns. Browser verification was done in offline mode (`dog-life-dev-offline-alt`, port 5174) specifically to avoid touching production.
- The alone-time row is matched on (date, duration, dogs) rather than a stored id, because `alone_time_logs` ids are DB-generated and the collection's `add` returns a boolean rather than the created row. Two identical alone-time entries on the same day would see the newer one deleted first. Fixable by having `add` return the row, but that changes a shared signature used by every collection — not worth it for this.
**"What's next", built same day.** `nextTrainingFocus` in [utils.ts](src/utils.ts) answers
the last part of Andrew's ask. No model involved — milestone state already says what's
unlocked and unfinished, so a formula answers it honestly and a generated sentence would
only add a way to be wrong. The rule is **momentum first, then curriculum order**: finish
a milestone that's already underway before opening a new one, otherwise take them in
authored order. Predictability beats cleverness — the answer shouldn't change unless
something was actually logged.

Surfaced in two places, both with a **Log it** button that opens the Quick log with that
milestone already selected, so the gap between "what should I do" and "done, recorded"
is one tap: a persistent card in the Dashboard's Log section, and in the post-save panel
computed against the state the entry just produced (log Charge marker to 2/2 and the
next card immediately reads "Use on eye contact · 0/3").

This is *not* item 12. That one is about weaving training into the day automatically —
around meals, potty breaks, time of day. This just answers "which step is next" from
milestone state, which is the piece Quick log needed to close its own loop.

**Migration run against production, 2026-07-25.** `schema.sql` then `migrate-items-2026-07-25.sql` then `tune-items-2026-07-25.sql` (blocks 0a/0b reconciliation, then block 3 twice — "Cooperative handling minis" and "Name + recall foundation" checklist steps assigned to Mara) all ran clean, in that order. "Parallel decompression walk" was checked and needs no per-dog split — its steps are shared/both-dogs by design, which is what an unset `dogId` already means. Two real bugs were found and fixed live against production data: a table-ordering bug in `schema.sql` (the unified-items block ran before `create table items`) and a column-type mismatch in the migration (`item_deletions.item_id` was `uuid`, needed to be `text` to match the audit-trail pattern of the tables it replaces). Both fixes are in the files now.

**Still open — dropping the old tables.** `tasks`, `calendar_events`, `health_events`, and `task_instances` are migration source tables — fully superseded by `items`/`item_occurrences`, but still physically present and unused since the migration copies rather than moves. Deliberately deferred: dropping is irreversible, and the plan was to wait until the new item-based flows had proven themselves in real day-to-day use first, not to rush it same-day. Do this only once Andrew confirms he's comfortable — do not do it unprompted.

Script (already written, sitting commented-out at the bottom of `supabase/migrate-items-2026-07-25.sql`, lines ~192-198):
```sql
-- drop table if exists inbox_requests cascade;  -- recreate from schema.sql afterwards
-- drop table if exists task_instances cascade;
-- drop table if exists task_deletions;
-- drop table if exists calendar_event_deletions;
-- drop table if exists tasks cascade;
-- drop table if exists calendar_events cascade;
-- drop table if exists health_events cascade;
```
Uncomment and run when ready — check the file directly in case it's been extended since this note was written.
- `grizParticipation` was dropped. Its `managed` vs. `not yet` distinction (both mean "this dog isn't in it", differing only in *why*) is not recoverable from `dogIds` + `formation` — but `not yet` was never used in the seed data, the field was never rendered anywhere, and the column survives untouched in the `tasks` table. Superseded by per-dog checklist steps above.
- The `review-logs` skill (`.claude/skills/review-logs/SKILL.md`) reads unprocessed logs and proposes updates. It has never been run against real data — there are only two test logs so far.

