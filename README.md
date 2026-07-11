# Dog Life OS

Adaptive planning for puppy raising and lifelong multi-dog household management.

Dog Life OS combines daily routines, training progression, milestone dependencies, health scheduling, relationship tracking, and AI-coach-ready feedback loops. Version 1 is local-first and seeded for Andrew, Bree, a new puppy, and Griz, while the architecture is organized around multiple dogs and multiple household members.

Dog training is the first chapter, not the whole book — see [BACKLOG.md](BACKLOG.md) for where this grows into a full household life app (human health, spending, chores, trip planning) and how those features are prioritized.

## Run locally

```bash
npm install
npm run dev
```

The dev server is configured with `--host 0.0.0.0`, so Vite will show both `localhost` and LAN URLs. Phones on the same Wi-Fi can use the LAN URL.

## Build

```bash
npm run build
```

## Current capabilities

- Responsive web app shell with Dashboard, Calendar, Profile, Training, Health, Journal, Milestones, Tasks, Analytics, and Settings.
- Multi-household, multi-dog, and multi-person data model (`Household` wraps a set of dogs and people; v1 seeds one household for Andrew, Bree, a new puppy, and Griz).
- Every collection (dogs, people, tasks, milestones, health events, journal entries, exposure logs, relationship logs, feedback) is a persisted, CRUD-able store backed by `localStorage`, with add/edit/delete forms built on React Hook Form + Zod.
- Daily agenda with assigned owner, duration, priority, supplies, dog participation rules, difficulty, and an interactive checklist.
- Adaptive workload mode that reduces optional work after repeated difficult logs, with explicit daily training/exercise minute targets.
- Readiness scores that combine confidence, friendliness, fear, noise sensitivity, guarding, and mastered commands.
- A real milestone dependency graph: 30 obedience/health/socialization milestones (the full PRD training-command list plus the foundational skills — name recognition, food lure mechanics, focus, impulse control — they quietly depend on), each with a computed, live "why isn't this unlocked?" checklist instead of hand-written prose.
- Every obedience milestone is sourced to 3 verified, clickable references (AKC, ASPCA, Humane Society, AAHA, VCA, Cornell, Whole Dog Journal, Preventive Vet, or a YouTube search-results link for named trainers), plus a "log a session" action per step.
- Socialization (39 items), confidence-building (12 items), and cooperative-handling (16 items) exposure libraries, each loggable with a reaction and status, browsed from Training sub-tabs.
- A relationship tracker for multi-dog households (comfort, shared toys/beds/walks, body language, resource guarding, play quality, corrections, recovery time) with logged check-ins and a trend sparkline.
- Longitudinal analytics: task-rating trend, journal-mood trend, and weight-growth sparklines computed from real logged data, not placeholders.
- An in-app notification center (bell icon) surfacing overdue essential tasks, upcoming/overdue health events, and newly-unlocked milestones.
- Global search with clickable results that jump to the matching task, milestone, or journal entry.
- Full JSON export/import covering every collection, not just feedback — a complete backup/restore.
- Light/dark theme toggle and a large-text accessibility mode, both persisted per device, plus visible keyboard focus states.
- PWA manifest and a network-first service worker (falls back to cache only when offline, so deploys aren't held hostage by a stale cache).

## Data model

Households wrap dogs and people so the same schema scales to future multi-household use without a rewrite.

Pets carry the detail-heavy records:

- Breed, birthday, adaptive age label, sex, weight, expected adult weight, and weight history.
- Microchip, veterinarian, insurance, breeder, health summary, medical history, medications, and allergies.
- Behavior traits, reward preferences, toys, exercise needs, and mastered commands.

Humans stay intentionally simple:

- Name.
- Color.
- Assigned task IDs.

Auth, permissions, availability, and notification preferences can be added later at the household/member layer without bloating the core profile view.

## What's deliberately out of scope for v1

Per a scoping decision made when expanding toward the full PRD:

- **No Supabase/cloud backend yet.** Everything is local-first (`localStorage`), matching the "planned backend path" below. Wiring up real Supabase requires a project URL/anon key and was left for whenever cloud sync is actually wanted.
- **No Tailwind/shadcn/React Router.** The hand-written CSS design system and tab-based navigation already work well in light/dark mode; migrating to the PRD's literal tech stack would be a large rewrite for cosmetic parity with no functional gain, so it was skipped.
- **No AI coach calls.** The dashboard's "AI coach preview" and the feedback-loop routing table describe the intended design (see below) but no model is actually called yet — there's no backend to hold API keys or spend limits safely.
- **No video analysis, growth-calorie prediction, or push notifications.** These are explicitly "Future AI Features" in the PRD; the notification center here is in-app only (no service worker push).

## Feedback loop design

The app should be rules-first and AI-assisted, not AI-dependent.

Algorithm updates should handle structured facts immediately:

- Task completion, ratings, accidents, barking, fear, guarding, and duration.
- Milestone session counts and prerequisite unlocks.
- Weight, vaccines, medication, allergies, age gates, and recurring health dates.
- Readiness scores, confidence scores, relationship trends, streaks, and tomorrow's workload.

GenAI should only run when language or ambiguity is valuable:

- Free-text task comments and journal notes.
- Long vet instructions that need summarizing.
- Weekly coaching summaries.
- Explanations for why the adaptive plan changed.
- Optional future video analysis, only when explicitly requested.

Human review should override everything for safety:

- Injury, medication reaction, severe fear, bites, repeated guarding, or concerning vet notes.
- The app should pause risky milestones and prompt a vet or qualified trainer rather than trying to diagnose.

Cheap-operation strategy:

- Keep all simple updates local and deterministic.
- Batch AI summaries nightly or weekly instead of calling a model after every task.
- Send compact rollups rather than raw history.
- Cache generated summaries and never regenerate unchanged periods.
- Put hard monthly spend limits in the backend.
- Prefer very small/cheap models for summaries, with larger models only for explicit on-demand review.
- Consider free-tier Gemini for prototyping, OpenAI nano/mini-class models for low-cost text, and Claude Haiku/batch processing where that provider is preferred. Recheck official pricing before enabling paid calls.

Pricing references:

- [OpenAI API pricing](https://developers.openai.com/api/docs/pricing)
- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Claude API pricing](https://platform.claude.com/docs/en/about-claude/pricing)

## Planned backend path

The app is local-first now. The next backend step is to map the current TypeScript entities to Supabase tables:

- `households`
- `household_members`
- `dogs`
- `tasks`
- `task_feedback`
- `milestones`
- `milestone_steps`
- `training_sources`
- `health_events`
- `journal_entries`
- `exposure_items` (socialization / confidence / handling logs)
- `relationship_logs` (multi-dog household bond tracking)

Supabase Auth can then add owner/collaborator roles, cloud sync, and automated backups without changing the core UI model.

## Deployment

This app can be deployed to GitHub Pages, Vercel, Netlify, a Docker container, or a local LAN server. Use `npm run build` and publish the generated `dist` folder for static hosting.
