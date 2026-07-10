# Dog Life OS

Adaptive planning for puppy raising and lifelong multi-dog household management.

Dog Life OS combines daily routines, training progression, milestone dependencies, health scheduling, relationship tracking, and AI-coach-ready feedback loops. Version 1 is local-first and seeded for Andrew, Bree, a new puppy, and Griz, while the architecture is organized around multiple dogs and multiple household members.

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
- Multi-dog and multi-person data model.
- Profile page with rich pet records and lightweight human task assignment records.
- Daily agenda with assigned owner, duration, priority, supplies, dog participation rules, difficulty, and an interactive checklist.
- Local task feedback storage.
- Adaptive workload mode that reduces optional work after repeated difficult logs.
- Readiness scores that combine confidence, friendliness, fear, noise sensitivity, guarding, and mastered commands.
- Milestone dependency model with "why isn't this unlocked?" explanations.
- Source-backed training milestones with at least three clickable, verified sources per milestone.
- Health calendar events for vaccines, prevention, grooming, and weight tracking.
- Journal entries and global search with clickable results that jump to the matching task, milestone, or journal entry.
- JSON export and import for logged task feedback.
- Light/dark theme toggle, persisted per device.
- PWA manifest and service worker for basic offline caching.

## Profile model

Pets carry the detail-heavy records:

- Breed, birthday, adaptive age label, sex, weight, expected adult weight, and weight history.
- Microchip, veterinarian, insurance, breeder, health summary, medical history, medications, and allergies.
- Behavior traits, reward preferences, toys, exercise needs, and mastered commands.

Humans stay intentionally simple:

- Name.
- Color.
- Assigned task IDs.

Auth, permissions, availability, and notification preferences can be added later at the household/member layer without bloating the core profile view.

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

Supabase Auth can then add owner/collaborator roles, cloud sync, and automated backups without changing the core UI model.

## Deployment

This app can be deployed to GitHub Pages, Vercel, Netlify, a Docker container, or a local LAN server. Use `npm run build` and publish the generated `dist` folder for static hosting.
