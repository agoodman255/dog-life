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

## Feedback backlog

In-app product feedback (`scripts/export-feedback.ts` / `FEEDBACK.md`), triaged. Each row already has the research done — don't re-investigate an item listed here unless its status changes. Only feedback that hasn't been triaged yet needs a fresh source-code check before it can be summarized.

**Status legend** — 🟡 Addressed (built + I've browser-verified it, but Andrew hasn't confirmed/closed it yet) · ✅ Closed (Andrew confirmed it works — only he can move a row to this) · ⏸️ Deferred (explicit decision not to build this round, still open) · 🚧 Blocked (waiting on something from Andrew) · ⬜ Not started. When asked to "return my backlog," lead with 🟡 rows (his action needed: verify + tell me to close) before listing ⬜/⏸️ items.

| Feedback (page / note) | Status | Assessment |
|---|---|---|
| Calendar — alone-time readiness shouldn't be on the calendar; filter by Day/Month, Upcoming events, Milestones | 🟡 **Addressed 2026-07-12** | Readiness panel moved to Dashboard. Calendar view switcher extended to Day / Week / Month / Upcoming / Milestones. Browser-verified working. |
| Calendar — daily view too small on mobile | 🟡 **Addressed 2026-07-12** | Day timeline now uses a taller hour row (96px vs 48px) + larger text under the 760px breakpoint. Browser-verified working (fresh mount at mobile width; a live in-browser resize of an already-open tab needs a reload to pick it up — not a real-device issue). |
| Dashboard/Profile — track everything given to a dog (daily meds, supplements, injections) for vet visits | 🟡 **Addressed 2026-07-12** | `Dog.medications: string[]` replaced with structured `medicationEntries` (name, kind: medication/supplement/injection/preventive, dosage, frequency, notes). Griz's real regimen (Gabapentin, Carprofen, monthly preventive, salmon oil, Dasuquin, FortiFlora) converted from prose into structured entries. Browser-verified rendering correctly on Profile. |
| Dashboard/Profile — log vet visits, store vaccine records & receipts | 🟡 **Partially addressed 2026-07-12** | `HealthEvent` already supported `kind: "vaccine"`; added a `documentUrl` link field plus a real editable History list in HealthView (previously health events had no list view at all, add-only into a void). Browser-verified. Storing an actual **uploaded file** (vs. pasting a link) is still ⏸️ deferred — see backlog item 9; the link field works today with any external URL. |
| Dashboard — one-tap "log what just happened" (accident, good potty break) | 🟡 **Addressed 2026-07-12** | New "Quick log" button on Dashboard opens a modal (Accident / Good potty break / Other + dog picker + note), saved as a tagged `JournalEntry` (`tags: ["quick-log", kind]`). Browser-verified end-to-end: submitted, reloaded, entry persisted correctly in Journal view. |
| Profile — can't upload a dog photo | ⏸️ **Deferred by Andrew 2026-07-12** | `photo` is a plain URL text field, no file picker. Andrew initially said backend-only (I upload, hand back a URL) was fine, then reconsidered mid-session and asked for real in-app upload for both photos and receipts together, privately stored — see backlog item 9. Nothing built for this one; the URL field still works as a manual fallback. |
| Calendar — visually overloaded; needs a countdown banner + auto care-guidance for big appointments | ⏸️ **Deferred by Andrew 2026-07-12** | Decluttering itself landed as a side effect of the Upcoming/Milestones split above (addressed row, this table). The banner ("5 days until neuter appointment") + auto-generated prep/booking/aftercare guidance was explicitly not selected for this round — still open, not started. |
| Dashboard / "Action needed" — "Unable to read action needed. Half the text is off the screen. The text color is white on a tan background." | 🚧 **Blocked — needs screenshot** | Could not reproduce from source alone (2026-07-12 review): no section literally labeled "Action needed" was found by search, and the priority/status badge CSS ([styles.css:382](src/styles.css:382)) uses fixed hex color pairs (dark text on light bg) that don't shift with dark mode but are internally readable either way. Likely either a spot not covered by that search, or a dark-mode-specific rendering issue that only shows up live behind Bree's login. **Next step when a screenshot arrives: locate the exact element/class from the screenshot, then fix directly — no need to re-derive the rest of this assessment.** |
| Dark mode toggle in top-right corner | ✅ **Closed — already existed, no action needed** | Confirmed present at [App.tsx:189](src/App.tsx:189) before this feedback was filed. Nothing for Andrew to verify. |


