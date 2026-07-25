---
name: review-logs
description: Read the item logs Andrew has captured in Dog Life OS, make sense of them against the item and dog context, and propose updates to the dog record, milestones, and knowledge docs. Use when Andrew asks to "review my logs," "process the logs," "what do my logs say," or asks for a weekly/periodic catch-up on what he's been recording.
---

# Review logs

Turns the free-text and structured entries Andrew records against calendar items into
something actionable. Runs on demand — there is no scheduler behind this, and there
shouldn't be one until he asks for it.

**Propose, don't write.** Andrew's explicit call (2026-07-25) when this was designed:
the agent reads logs, summarizes what it found, and shows proposed changes. Nothing
touches the database until he says go. Skipping the review step is not a shortcut you
get to take because the changes look obvious — a wrong weight or a falsely-advanced
milestone is worse than a slow one.

## What a log actually is

`item_logs` rows (see `src/types.ts` → `ItemLog`, `supabase/schema.sql`). Each carries:

- `itemId` → the `items` row it belongs to (title, category, dogIds, notes give you the context)
- `occurrenceDate` → which day's occurrence, when the item recurs
- `text` → free-form, always available, usually the most informative field
- `values` → structured `{fieldName, dataType, unit, value}` pairs from the item's `logFields`
- `dogIds` → which dog(s) this is about
- `processedAt` → **null means not yet ingested**

Completion data lives separately on `item_occurrences`: per-checklist-row `rating` and
`notes`, plus an overall `rating` and `ratingNotes`. Read those too — a training session
where one specific step scored 2/5 three times running is exactly the signal worth
surfacing, and it will never appear in the free-text log.

## Phase 1 — Pull

Only unprocessed rows, so repeat runs stay incremental:

```sql
select l.*, i.title, i.category, i.notes as item_notes
from item_logs l join items i on i.id = l.item_id
where l.processed_at is null
order by l.logged_at;
```

Also pull occurrences completed since the last run for the same items, since ratings
and checklist notes are half the picture:

```sql
select o.*, i.title, i.category from item_occurrences o
join items i on i.id = o.item_id
where o.state = 'completed' and o.end_time > <last run>;
```

If Andrew is running the app in offline mode (no Supabase env vars), the same data is
in `localStorage` under `dog-life-os-item-logs` and `dog-life-os-item-occurrences`.

## Phase 2 — Make sense of it

Group by dog, then by category. For each group, work out what the entries actually say
as opposed to what they mention:

1. **Trends over points.** Three weight entries make a trajectory; one makes a number.
   Say which you have. Compare against `dogs.expectedAdultWeight` and the existing
   `weightHistory` before calling anything unusual.
2. **Read the free text against the structured values.** "Ate fine" alongside a dropped
   weight is a contradiction worth flagging, not averaging away.
3. **Per-row checklist scores.** Look for a step that consistently scores low while the
   overall session scores fine. That is the case per-row scoring was added for.
4. **Don't diagnose.** You can say "three loose-stool entries in five days, all logged
   after the new food" — you cannot say what's wrong with the dog. Vet questions go on
   a list for Andrew to ask a vet.
5. **Cite the log.** Every proposal names the entries it rests on (date + item title),
   so Andrew can check the claim without re-reading everything.

## Phase 3 — Propose

Present as a short written summary followed by a concrete change list, grouped by
target. Andrew approves per group, not all-or-nothing — expect him to take some and
reject others.

Proposal targets, in rough order of how often they'll come up:

- **Dog record** (`dogs`): `weightHistory` entries, `healthSummary` rewording,
  trait scores (`energy`/`confidence`/`fearfulness`/…), `masteredCommands` additions.
- **Milestones** (`milestones`): step `completedSessions` advances. Note that items
  linked via `checklistSourceMilestoneId` already self-advance on completion — do not
  double-count those. Only propose advances for sessions logged some other way.
- **Exposure items** (`exposure_items`): status moves (`not-started` → `introduced` →
  `comfortable`) and new log entries.
- **Journal** (`journal_entries`): a real narrative entry when the logs describe
  something worth remembering as a story rather than a data point.
- **Knowledge docs / `BACKLOG.md`**: only when a pattern implies a change to how the app
  or routine should work, not for routine observations.

Also surface, separately from proposals:

- **Questions for the vet** — anything health-adjacent you noticed but shouldn't act on.
- **Gaps** — items with `requiresLog` that haven't been logged in a while, or log fields
  that are always left blank (a sign the field should be removed from the item).

## Phase 4 — Apply, then stamp

Only after Andrew approves, and only what he approved. Then mark exactly those logs
processed so the next run skips them:

```sql
update item_logs set processed_at = now() where id in (…);
```

Stamp the logs you actually used, including ones you read and deliberately drew no
conclusion from — otherwise they resurface every run. If Andrew rejects a proposal,
still stamp the underlying logs (they've been reviewed) and note the rejection in your
summary so a later run doesn't re-propose the same thing.

## Notes

- Related: [[dog-life-backlog-workflow]] for how findings become backlog items, and the
  `triage-feedback` skill for the analogous propose-then-fold pattern on product feedback.
- The per-dog framing matters throughout: Griz is an adult with settled baselines, Mara
  is a puppy whose numbers should be moving. The same weight delta means different
  things for each. Never average them together.
