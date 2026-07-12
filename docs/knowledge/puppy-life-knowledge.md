# Household & Puppy Knowledge Base

Consolidated from four source documents on 2026-07-11: `puppy-schedule-knowledge-doc.md`,
`Griz Care Sheet 5_8_2024.docx`, `Dog Rules.docx`, and `Dog.xlsx`. This file is the
source of truth the app's seed data (`src/data.ts`) is built from — update this doc
first when facts change, then regenerate seed data / re-run `supabase/schema.sql`
and `supabase/seed.sql` to sync the live app.

**Today's date for context: 2026-07-11.** Puppy pickup (Aug 1, 2026) has not happened yet.

---

## 1. New Puppy Profile (known facts)

| Field | Value |
|---|---|
| Breeder | Ruby Doodles Louisiana |
| Breed | Goldendoodle |
| Sex | Unknown — TBD at pickup |
| Name | TBD |
| Estimated adult weight | 30–40 lbs (max) |
| Pickup date | **Saturday, August 1, 2026** (mid-afternoon) |
| Health records | Breeder-provided, to be uploaded after pickup |
| Vet | Canyons Vet (same clinic as Griz) |
| First vet appointment | **August 3, 2026, 2:00 PM** |

Name, sex, birth date, color/coat, and microchip ID stay unset in the app until pickup.

## 2. Existing Dog — Griz (from Care Sheet, dated 2024-05-08)

- **Nicknames:** He/Him/Good Boy/Grizzy Bear
- **Medical contacts:** MedVet SLC (24/7) 385-341-4444 · MedVet Sandy 801-758-7633
- **Feeding:** ~1 cup dry food morning + evening (fill a Solo cup ~½–¾ full); not a big eater — pick up bowl after 1–2 hrs to encourage eating, shredded mozzarella on top helps
- **Medications (2x/day, one per meal):**
  - Gabapentin (white oblong) — whole pill
  - Carprofen (brown circle) — half pill
  - Meds stored in the cabinet right of the kitchen sink
- **Supplements:** 1 pump salmon oil per meal · 1 soft Dasuquin chew at breakfast · 1 packet FortiFlora probiotic at dinner
- **Night snack:** 1 spoonful cottage cheese OR 1 Dingo dental treat (or hide it for a sniff session)
- **Water:** available all day; prefers the bowl in the main bedroom
- **Walks:** reward check-ins; say "get back" and stop if he pulls (metal loop collar helps); good off-leash recall varies by person; off-leash at home only with driveway gate in place (will run into the street otherwise)
- **Enrichment:** loves sniff-work (hide treats in blankets), fetch, tug, frisbee, chase — great rainy-day activity
- **Treats:** beef lung tips, Bill Jack soft bits (break into pieces); use sparingly given his limited appetite
- **Aversions:** humping from other dogs; unfamiliar noises/outside disturbances (mild barking)
- **General:** sleeps in bed with them (also crate trained); ~2 walks/day + 1 big play session + potty before bed; poops on morning walk + once evening; pawing/whining = wants play or couch time; whining/lingering at door = rare, means he needs out
- **Hygiene:** paws prone to injury — use "mud-buster" tool + towel dry; rinse muddy body in shower; ear cleanser after baths/swimming; supplies in bathroom cabinet
- **Known commands (Care Sheet, 2024):** Sit, Lay down, Wait, Paw, Come, Go pee pee/Go potty, Give (closed fist, patient — he takes victory laps), Gentle, Get Back (on walks), Leash/Easy (slow down), Free (release word)
- **Known commands (Dog.xlsx "Command List" — fuller/more current list, mirror these for the new puppy's training targets too):** Look at Me, Sit, Lay Down, Up, Roll Over, Dead, Speak, Bump, Paw, Go to place, Heel, Go get it/Fetch, Settle, Come, Spin, Give, Leave it, Left/Right, Around, Snag, Off

## 3. Household Recurring Weekly Commitments

| Activity | Day | Time (Mountain) | Active Period |
|---|---|---|---|
| Gym — concert series | Wednesday | ~6:00 PM | Through Labor Day (9/7/26) |
| Gym — "Hot Dogs" | Monday | ~5:30 PM | Through Labor Day (9/7/26) |
| Andrew's volleyball | Tuesday | ~2–3 hr blocks (exact TBD) | Ongoing |
| Curling | Thursday | 8:30–11:00 PM | Starts fall (exact start TBD) |

**Work hours baseline:** starts no earlier than 9:00 AM ET (7:00 AM MT); some days run past 5–6 PM ET (3–4 PM MT); general goal is to get off early MT when possible.

## 4. Alone-Time Training Progression (critical thread)

| Target Window | Required Alone-Time Capability |
|---|---|
| September (concerts) | Several hours; Rover visit for 1–2 potty/walk breaks |
| Mid–late September (comedy shows) | Several hours; Rover optional |
| **Oct 17 — BYU vs. Notre Dame tailgate** | **~4 hours home alone** (confirmed date, Provo) |
| Late Oct–early Nov | Full evening (Mammoth hockey games) |
| Late December | Full day (~6–8 hrs, ski days) — longest target of the year |

**Cross-reference found:** `Dog.xlsx` → "Key Item Schedule" sheet has an independent **age-based** crating tolerance table that lines up with this date-based list:

| Duration | Example | Risk | Age Milestone |
|---|---|---|---|
| 1–2 hrs | Orange Theory class | Low | 2 months |
| 3–4 hrs | Dinner + show | Low | 5 months |
| 5–6 hrs | Sporting event | Medium | 7 months |
| 8+ hrs | Day trip | High | 12 months |

A puppy picked up 8/1/26 turns 5 months old right around late Dec/early Jan and 7 months around Feb/March — meaning the **date-driven targets (BYU/ND at ~4hrs in October, ski days at ~6–8hrs in December) are more aggressive than the age-based guidance suggests is typical.** Worth watching closely and building in a Rover safety net for October/November rather than assuming the puppy will be ready purely because the calendar says so.

**App feature:** a readiness tracker compares the latest logged alone-time achievement against the next upcoming commitment that requires it, flagging gaps early.

## 5. Events & Activities

- **Utah Mammoth hockey** — partial season ticket holder; games attended late Oct/early Nov onward (exact dates TBD)
- **College football** — University of Georgia and Clemson University; full 2026 schedule below
- **BYU vs. Notre Dame tailgate** — Saturday, **October 17, 2026**, LaVell Edwards Stadium, Provo (~4 hrs away from home; kickoff time TBA)
- **September concerts** — several hours away, possible Rover visit; exact dates TBD
- **Mid–late September comedy shows** — similar coverage needs; exact dates TBD
- **Mom visiting Sept 23–26** — stay local to Salt Lake City / day trips only, no overnight travel; Clemson @ Cal on Fri 9/25 is a late TV game (8:30 PM MT) with no conflict
- **Ski days, late December** — full-day alone-time required

## 6. 2026 College Football Schedule

All times Mountain. **Heavy weeks** (default to home/patio, avoid camping) are marked — these directly drive the "stay home vs. camp" decision, and multiple marquee games can stack in the same week.

### Georgia Bulldogs

| Date | Opponent | Kickoff (MT) | Notes |
|---|---|---|---|
| Sat 9/5 | vs. Tennessee State | 1:00 PM | Home opener |
| Sat 9/12 | vs. Western Kentucky | 10:45 AM | Home |
| Sat 9/19 | @ Arkansas | 10:00 AM | Away |
| Sat 9/26 | vs. Oklahoma | Flex 1:30–2:30 or 4–6 PM | Home, SEC |
| Sat 10/3 | vs. Vanderbilt | ~10–11 AM | Home |
| **Sat 10/10** | **@ Alabama** | Night 4–6 PM | **Marquee/heavy week** |
| **Sat 10/17** | **vs. Auburn** | ~1:30–2:30 PM | **Heavy week** (same date as BYU/ND) |
| Sat 10/24 | — Bye — | — | Good camping candidate |
| Sat 10/31 | vs. Florida (Atlanta) | 1:30 PM | Rivalry, Mercedes-Benz Stadium |
| **Sat 11/7** | **@ Ole Miss** | Flex | **Marquee/heavy week** |
| **Sat 11/14** | vs. Missouri | TBA | Home |
| **Sat 11/21** | **@ South Carolina** | TBA | **Heavy week** |
| **Sat 11/28** | **vs. Georgia Tech** | TBA | **Heavy week**, rivalry |

### Clemson Tigers

| Date | Opponent | Kickoff (MT) | Notes |
|---|---|---|---|
| **Sat 9/5** | **@ LSU** | 5:30 PM | **Marquee** — College GameDay, Lane Kiffin's LSU debut |
| Sat 9/12 | vs. Georgia Southern | 5:30 PM | Home opener |
| Sat 9/19 | vs. North Carolina | 10:00 AM | Home |
| Fri 9/25 | @ Cal | 8:30 PM | During mom's visit — late TV game, no conflict |
| Sat 10/3 | vs. Miami | TBA | Home |
| — | Bye (no game 10/10) | — | Good camping candidate on Clemson's side only — Georgia plays Alabama that week |
| **Sat 10/17** | vs. Charleston Southern | TBA | **Heavy week** (stacked with Georgia/Auburn + BYU/ND) |
| Sat 10/24 | vs. Virginia Tech | TBA | Home |
| Sat 10/31 | @ Florida State | TBA | Away |
| Sat 11/7 | @ Syracuse | TBA | Away |
| Sat 11/14 | vs. Georgia Tech | TBA | Home |
| **Fri 11/20** | **@ Duke** | 5:30 PM | **Heavy week**, ACC title implications |
| **Sat 11/28** | **vs. South Carolina** | TBA | **Heavy week**, Palmetto Bowl rivalry |

Several games remain TBA for exact kickoff time — the app should prompt for a refresh as the season approaches rather than blocking on incomplete data.

## 7. Placeholder / TBA Handling Rules

Every recurring commitment, one-off event, and milestone should exist as a calendar entry from day one, even with incomplete fields — never omit for lack of an exact date.

| Situation | Placeholder behavior |
|---|---|
| Known day-of-week + approx time, no exact date | Recurring weekly placeholder, labeled "estimated — confirm exact time" |
| Known month/window, no exact date | Placeholder in that window, labeled "date TBD" |
| Known date, no exact time | Confirmed date, "time TBA" label |
| Fully known date + time | Standard confirmed entry |

As a placeholder's date approaches (~7–14 days out), the app should prompt to confirm/update details. Placeholders should be visually distinct from confirmed events (dashed border, "TBD" tag).

## 8. Training Rules (from Dog Rules.docx)

### Reward tiers
- Stopping bad behavior → 1 kibble
- Slightly good behavior → 2 kibble
- Medium good behavior → 1 treat
- Very good behavior ("Jackpot") → 2–3 treats
- Treats are **never** used to distract from or entice bad behavior — reward only
- Ignore bad behavior entirely (no "bad" marker); reward the moment it turns into good behavior
- Train in varied scenarios — both Bree and Andrew, indoors/outdoors/different homes/different people

### Potty training
- **In the moment:** catch the accident immediately, no startling/loud noises, carry outside right away; reward only if the finish happens outside; if not, no reward, just show the right spot
- **After the fact:** do nothing, just clean up
- **Major rule — specific potty time is a "job":** ignore the dog until potty happens, reward the instant they squat (closed hand with 2 treats at the nose), then unleash a short puppy play-time party after
- **Other occasions (up to ~4 months):** reward all outdoor potty, but as a side activity — treat + verbal only, no play party, then continue whatever activity was happening

### Command-by-command notes (with real linked resources — see Section 14)
- **Name / Look at Me:** beginner = lure to force eye contact; medium = add distance/new places/unexpected timing; hard = different people/places/distractions
- **Leash:** beginner = circles indoors, reward attention; medium = change location/distance; hard = add other skills while leashed in new places; if the dog pulls, stop — don't yell — wait for redirect then reward
- **Leave It:** beginner = closed hand; medium = food on ground, hand covering (**major rule: never let the dog "win" by stealing — start slow, never reward speed over patience**); hard = real-life distractions (walks, trash, bones)
- **Sit:** beginner = lure to plop into sit; medium = lure with one hand, feed from the other (to fade the lure); hard = verbal cue only, no hand signal
- **Lay:** start from sit position, lure down
- **Stay:** beginner = catch/reward a 3-second stay; medium = increase distance/duration; hard = surprise stay + uncontrolled environment (rolling toy, other people)
- **Come:** beginner = hand at dog's face; medium = hand off to the side; hard = standing a few feet away, verbal-only at expert level; reward tiers: 1 kibble for alerting, 1 treat for nose-bump, 2 treats for early advanced-level attempts
- **Mat Training:** based on Dr. Karen Overall's Protocol for Relaxation; kibble reward once dog settles into a relaxed one-hip position on the mat; if the dog leaves the mat, pick it up and restart from the last spot
- **Bark Training:** covers not barking at toys, when bored, waiting for a treat, at the door/doorbell, or in the crate
- **Crate Training:** crate is **never** punishment; always exercise first; keep sessions 15 min–1 hr early on (shorter = more frequent is fine); intro = let the dog explore + treats/toys inside to build positive association; then slowly close (don't lock) the door, feeding treats through it, supervising heavily
- **No Jumping:** dog gets no attention/petting unless all four paws are on the ground — this is how they unlearn jumping to greet
- **Advanced tricks (marked "pending update" in the source — not yet finalized):** Speak, Roll Over, Spin, Shake, Jump Over, Crawl

## 9. Week-by-Week Training Schedule (from Dog.xlsx)

Weeks are counted from **pickup (8/1/26)**, not from birth — since birthdate is unknown at pickup time.

| Week | New commands introduced |
|---|---|
| 1 | Name (Look at Me), Leash, Leave It, Sit |
| 2 | + Lay |
| 3 | + Up |
| 4 | + Stay, Come |
| 6–8 | + Mat Training, Paw (Shake), Roll Over, Give (Fetch), Frisbee, Greeting Others |

**8–16 week modifications** (harder-mode versions of the above, in new places/with new people, plus additional targets marked "TBD" for exact week): Sit before exiting, Wait before meals, Not jumping on strangers, Heel/walking next to leash, Holding bladder longer, Eating less frequently, Give/Drop It, Fetch, Frisbee, Walk without leash, **Settle (separation anxiety)** — directly ties to the alone-time progression in Section 4 — Jogging with leash, Biking with leash.

### Daily care cadence (Key Item Schedule sheet)

| Activity | Frequency | Notes |
|---|---|---|
| Water | Every 2 hours | ~0.5 cup/serving; ~1oz per lb body weight/day total |
| Potty breaks | Every 2 hours | Rule of thumb: hourly frequency ≈ age in months; always right after eating/waking |
| Feed | 4x/day | ~0.25 cup/serving |
| Exercise | 2x/day | — |
| Brush hair | Daily | Evenings |
| Dental treats | 2x/week | Mon, Thu |
| Ear cleaning | Weekly | Sunday |
| Brush teeth | Weekly | Sunday |
| Bath | Bi-weekly | Shampoo/conditioner, ear powder after |
| Flea/tick + heartworm | Monthly | 1st Sunday |
| Trim nails | Monthly | 1st Sunday |
| Grooming | Bi-monthly | Week 1 |
| Vet wellness checkup | Annual | April |

## 10. Merged Daily Schedule — Griz + Puppy

Griz is a flexible, chill adult who can adapt to whatever timing the puppy needs, so instead of running two
separate care schedules, his meals and morning potty are folded onto the puppy's cadence. This is now
reflected directly in the app's daily task list (`src/data.ts`).

| Time | Activity | Dogs | Notes |
|---|---|---|---|
| 7:15 AM | Morning potty | Both (joint trip) | Griz's morning-walk poop happens naturally in this window — one outing, not two |
| 7:45 AM | Breakfast + settle reset | Both (separate bowls) | Griz's ~1 cup meal + Gabapentin, Carprofen, salmon oil, Dasuquin chew moves into this slot |
| Every ~2 hrs, daytime | Puppy potty + 2 of the 4 daily feeds | Puppy only | Doesn't require adjusting Griz's routine at all |
| 6:00 PM | Evening meal | Both (separate bowls) | Griz's second meal + Gabapentin, Carprofen, FortiFlora probiotic moves here, right before the walk |
| 6:15 PM | Parallel decompression walk | Both | Existing task, unchanged |
| 8:30 PM | Cooperative handling / grooming | Puppy (Griz managed nearby) | Existing task, unchanged |

Net effect: Griz keeps his ~2 meals/day and ~2 walks/day rhythm, just re-timed to overlap with the puppy's
schedule rather than needing separate windows — which is what actually makes the day workable around both
of our work hours.

## 11. Gym & Shared-Commitment Overlap Policy

Both the Wednesday concert-series class and the Monday "Hot Dogs" class run ~1-1.25 hrs — inside the
no-Rover short-alone-time tier (see Section 13), so the default is **both of us go together**.

When that's not possible on a given week:
- **Stagger, don't both leave.** Offset start times by ~30-45 min so one person is always home. This avoids
  a from-scratch "both away" window entirely rather than needing coverage for it.
- **Max simultaneous-away-time policy** while the puppy is young: cap it at ~1 hour for the first few weeks
  home, expanding to the class's full ~1.25 hrs once the puppy is reliably settling in the crate, and up to
  ~2.5 hrs (curling) once alone-time readiness (Section 13) clears that duration solo.
- **Andrew's morning fallback is a last resort, not a default.** Andrew owns the morning routine (joint potty
  + breakfast, Section 10) plus one weekday chore, so shifting his gym time to mornings only happens if the
  evening options are fully blocked — and if it's used, the morning handoff shifts to Bree that day.

## 12. Personal Downtime Blocks

Rough weekday shape as described by the household: Andrew runs the morning routine and one workday chore;
Bree covers the other workday chore and leaves work a bit early for it; we do something together after work;
Bree runs the last nighttime routine. That leaves two natural gaps worth protecting as individual time
(Spanish practice, vibe-coding, art, house projects, etc.):

- **Tuesday evenings** — Andrew is already out at volleyball, so this is Bree's default solo-time window
  (`bree-personal-time` on the calendar).
- **A second slot (day/time TBD)** — once the daily routine settles post-pickup, add a matching block for
  Andrew (`andrew-personal-time`) and consider a second one for Bree — a weekend afternoon/morning is the
  likely candidate, but real timing should wait until the together-time and nighttime routine have a fixed
  pattern to build around.

Both exist in the app now as `downtime`-category recurring calendar placeholders, flagged "estimated — confirm
day/time" per the Section 7 placeholder rules.

## 13. Away-From-Home Coverage Tiers & Rover Plan

Generalizing the age-based crating table (Section 4) and the household's real commitments into a reusable
tiered plan — every calendar event that needs coverage now carries its own prep/Rover/post checklist directly
(`prepSteps` / `roverInstructions` / `postSteps` / `roverVisits` fields), built from this pattern:

| Tier | Duration | Rover visits | Examples |
|---|---|---|---|
| Short | 1-1.5 hrs | 0 | Gym classes |
| Medium | 3-4 hrs | 1 | September concerts, comedy shows, BYU/ND tailgate |
| Long (evening) | ~4.5 hrs | 2 | Mammoth hockey games |
| Full day | ~7 hrs | 3 | Ski days (December) |

**Standard prep (before leaving), medium tier and up:**
1. Potty walk ~30 min before departure
2. Pick up the water bowl ~1 hr before departure (cuts down on mid-outing accidents)
3. Stuff and freeze a Kong; crate the puppy in the hardwood-floor room (easiest cleanup)
4. Keep Griz in a separate room/gated area from the crate rather than free-roaming with a stressed puppy

**Standard Rover visit:** leash out to the usual potty spot for a full elimination, refresh water, 15-20 min
of low-key play or sniffing, fresh chew before re-crating, and a quick note on accidents/barking/anxiety.
Full-day visits add a labeled meal per visit and rotate toys to keep it novel.

**Standard post (on return):** full decompression walk with both dogs, refresh water/food, log the outing in
the Alone-Time Readiness tracker so the next gap calculation stays accurate.

The BYU/ND tailgate (Section 4/5) is the one worth calling out specifically: it's a confirmed date-driven
target (~4 hrs) that lands before the age-based guidance suggests a puppy that age is typically ready for it
— so it gets a Rover visit booked as a safety net rather than assuming readiness from the calendar alone.

## 14. Real Training Reference Links (from Dog Rules.docx hyperlinks)

- Online training videos — K9 of Mine: https://www.k9ofmine.com/free-dog-training-videos/
- 13 Training Games — Journey Dog Training: https://journeydogtraining.com/13-dog-training-games/
- Howcast — general dog training: https://www.howcast.com/videos/499143-train-your-dog-with-joanne-basinger-dog-training
- Howcast — Sit: https://www.howcast.com/videos/499142-how-to-teach-your-dog-to-sit-dog-training
- Grooming intro: https://www.youtube.com/watch?v=0c-IjjzmS0E&list=PLMssKIjsDxXl_ZXQgcHlEY_fC-yL5P76N&index=3
- First grooming session: https://www.youtube.com/watch?v=koOCGuRFF0I
- Look at Me / Name: https://www.youtube.com/watch?v=FG9xSgN86BM · https://www.youtube.com/watch?v=dL2e2MXPqOs · https://www.youtube.com/watch?v=TsVz8LbjwEA · https://www.youtube.com/watch?v=g6eB8IeX_cs · https://www.youtube.com/watch?v=-Z45gvql74Y · https://www.youtube.com/watch?v=d6PogCb_mLc · https://www.youtube.com/watch?v=hQkJ2RHSsGw
- "Give me your attention you booger" article: https://kaufmannspuppytraining.com/en/get-dogs-attention/
- Leash: https://www.youtube.com/watch?v=FG9xSgN86BM
- Intermediate walking: https://www.youtube.com/watch?v=3gHPXpsPzxo
- Mistakes of leash walking: https://www.youtube.com/watch?v=hX1DMZIMLPk
- Leave It (impulse training): https://www.youtube.com/watch?v=QIuxm5r17nE · https://www.youtube.com/watch?v=FG9xSgN86BM · https://www.youtube.com/watch?v=S_6_tHkSeiY
- Leave It advanced (Zak George): https://www.youtube.com/watch?v=dGncNgiHEjM
- Lay: https://www.youtube.com/watch?v=hHKtUp9-xbc · https://www.youtube.com/watch?v=ENcl04S6tio&t=26s
- Stay: https://www.youtube.com/watch?v=GAziMECDxD0&t=313s · https://www.youtube.com/watch?v=2-_rxxKxseU
- Come / Target training: https://www.youtube.com/watch?v=QIuxm5r17nE
- Come — back and forth exercise: https://www.youtube.com/watch?v=rwldfBjFsdE
- Mat Training — Dr. Karen Overall Protocol for Relaxation (PDF): https://journeydogtraining.com/wp-content/uploads/2017/07/ProtocolforRelaxation.pdf
- Mat Training — Day 0/1/2/3 examples: https://www.youtube.com/watch?v=wJGHOhbmjac&t=259s · https://www.youtube.com/watch?v=SGQjWKVY_hs · https://www.youtube.com/watch?v=LMl0vq8m7pc · https://www.youtube.com/watch?v=k3WEaDf8VAk
- Bark training — Humane Society: https://www.humanesociety.org/resources/how-get-your-dog-stop-barking
- Bark training — Zak George scenarios: https://www.youtube.com/watch?v=s0A9SpCdRZg
- Crate training — Zak George: https://www.youtube.com/watch?v=hesi8WxLWVE · https://www.youtube.com/watch?v=R0vTyXCP5vY
- No jumping — Zak George: https://www.youtube.com/watch?v=49A12LPsE8M · https://www.youtube.com/watch?v=7P1DgDED23o
- Advanced tricks (Zak George): https://www.youtube.com/watch?v=PS8sTLqKfA8
- Complete Guide to Raising a Puppy (playlist): https://www.youtube.com/watch?v=f_X-0VJJUL8&list=PLMssKIjsDxXmMGypWsr8u-yGOUSoPoozb
- 30 Day Perfect Pup — Zak George (day-by-day videos): https://pupford.com/30-day-perfect-pup-with-zak-george-training/
- 30 Day Perfect Pup — PDF booklet: https://s3.us-east-2.amazonaws.com/30-day-perfect-pup-manual/30-Day-Perfect-Pup-With-Zak-George.pdf
- The Dog Training Experience (Inertia, day-by-day): https://www.youtube.com/watch?v=mIot0mHLemQ&list=PLMssKIjsDxXl_ZXQgcHlEY_fC-yL5P76N

## 15. Open Items / Follow-Ups

Still needed from the household before these can move from placeholder to confirmed:

1. Puppy's name and confirmed gender (at pickup)
2. Andrew's exact volleyball schedule
3. Full Utah Mammoth schedule — which specific games are being attended
4. Exact September concert dates + whether Rover coverage is needed for each
5. Exact comedy show dates (mid–late September)
6. Curling league start date + schedule (fall)
7. Rover-sitter logistics (existing sitter vs. new search, default visit duration)
8. TBA kickoff times to fill in as the season approaches: Georgia 11/14, 11/21, 11/28; Clemson 10/3, 10/17, 10/24, 10/31, 11/7, 11/14, 11/28
9. BYU vs. Notre Dame kickoff time (date is confirmed: 10/17/26)

## 16. Conflicts / Notable Cross-References Found During Consolidation

- **Timeline conflict (fixed in app data):** the app's previous seed data assumed the puppy had already been home since late June 2026 (fake weight logs, a journal entry, a vet visit, relationship logs with Griz) — this contradicted the real 8/1/26 pickup date and has been cleared out.
- **Griz's command list has two versions:** the 2024 Care Sheet lists ~11 basic commands; `Dog.xlsx`'s "Known Commands" sheet lists ~22, clearly a more complete/current list. Treated the xlsx list as authoritative and merged both into Griz's profile — no real conflict, just an update over time. Per the original knowledge doc's own instruction, this same command list is mirrored as the new puppy's training target list too.
- **Alone-time targets are more aggressive than typical age-based guidance** (see Section 4 cross-reference) — flagging as a real risk to plan around (Rover backup), not a data error.
- **Griz's daily schedule (Care Sheet) vs. the puppy's daily schedule (Dog.xlsx "Daily Schedule" sheet) look very different** — this is expected, not a conflict: Griz is a trained adult on a simple routine, the puppy sheet is an intensive newborn-puppy hour-by-hour potty/crate/play rotation meant for the first weeks home only.
- **Not a conflict, an added layer:** Sections 10-13 (merged daily schedule, gym overlap policy, downtime blocks, coverage tiers) don't come from a source document — they're household-logistics guidance built on top of the source data, added because the household asked for realistic Rover/coverage planning and a workable shared schedule rather than two independent dog routines. Several specifics (exact downtime days, which weeks need staggered gym trips) are intentionally left as placeholders to tune once the real post-pickup routine settles.
