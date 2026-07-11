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
