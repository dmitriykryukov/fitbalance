# FitBalance --- MVP Implementation Plan

**Status:** v1 --- confirmed 2026-11-07. Specs: PRODUCT, DATABASE,
AI_SPEC, FRONTEND, API_SPEC (all v1).

## Delivery approach

-   Build vertical slices, not layers. **First slice:** sign in →
    profile → add a meal manually → correct totals on Today.
-   One phase at a time; each phase ends with a review checkpoint before
    the next starts.
-   Each task lands as one or more small commits; database changes are
    new migration files (never edits to an applied migration).
-   Secrets live only in `.env` (local) and Vercel environment
    variables; never in the repository or in chat.

## What you need to provide, and when

  Needed before   Item
  --------------- ------------------------------------------------------------------------------------------------
  Phase 0         Supabase dev project; Project URL, publishable/anon key and secret/service-role key in `.env`; project ref + DB password for `npx supabase link`; Site URL `http://localhost:5174` and redirect `http://localhost:5174/**`
  Phase 3         `ANTHROPIC_API_KEY` in `.env`; approval to spend about \$0.05 on the AI evaluation run
  Phase 7         Vercel account; production URL added to Supabase redirect URLs; email provider (e.g. Resend) for Supabase SMTP

## Environment variables

``` text
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=          # publishable key
SUPABASE_SERVICE_ROLE_KEY=         # server only; account deletion
ANTHROPIC_API_KEY=                 # server only
AI_FOOD_PARSER_MODEL=claude-haiku-5-5
AI_COACH_MODEL=claude-sonnet-5-5
AI_DAILY_INSIGHT_MODEL=claude-haiku-5-5
AI_DAILY_FOOD_PARSE_LIMIT=50
AI_DAILY_COACH_LIMIT=30
```

## Phase 0 --- Project setup

  ID       Task                                                                                       Depends on
  -------- ------------------------------------------------------------------------------------------ -----------------
  FB-001   `git init`; SvelteKit 2 + Svelte 5 + TypeScript strict; Tailwind v4; ESLint + Prettier; Vitest; Playwright (iPhone viewport); `adapter-vercel`; `.gitignore`, `.env.example`, README   ---
  FB-002   Design tokens in `app.css` `@theme`; self-hosted Manrope + DM Sans (Cyrillic fallback); base components: AppShell, BottomNav, PageHeader, Card, Button, Chip, ProgressBar, Ring, EmptyState, ErrorBanner, Skeleton   FB-001
  FB-003   Paraglide i18n with `en.json` / `ru.json`; locale resolution (profile → cookie → Accept-Language); `format.ts` (Intl)   FB-001
  FB-004   Link Supabase, apply `20261107120000_init.sql`, run `rls_isolation_test.sql` against the real project, generate DB types   FB-001, your Supabase project
  FB-005   `hooks.server.ts` with `@supabase/ssr`, `locals.supabase`, `safeGetSession()`; API helpers (response envelope, error codes, Zod body/query parsing)   FB-004

**Exit:** app runs locally with the bottom navigation in EN and RU,
connects to Supabase, RLS test passes on the real project, `npm run
check`, `lint` and `test` are green.

## Phase 1 --- Authentication, onboarding, profile

  ID       Task                                                                                        Depends on
  -------- ------------------------------------------------------------------------------------------- -----------
  FB-006   Sign-up (with locale), password sign-in, magic link, `/auth/callback`, sign-out             FB-005
  FB-007   Route guards: `/app/**` needs a session and `onboarded_at`; onboarding (profile → goals)    FB-006
  FB-008   Profile & goals screen, edit profile, goals editor, goal suggestion (Mifflin--St Jeor), add/list measurements (needed for weight in onboarding)   FB-007
  FB-009   Two-user API test harness (Vitest integration tests that sign in as two test users)        FB-008

**Exit:** a new user can sign up (password or magic link), finish
onboarding and edit profile/goals in both languages; the two-user tests
prove they cannot read or change each other's data through the API.

## Phase 2 --- Manual nutrition + Today (first vertical slice)

  ID       Task                                                                                      Depends on
  -------- ----------------------------------------------------------------------------------------- -----------
  FB-010   Migration: `save_meal(payload jsonb)` (meal + items + My foods upsert, atomic)              FB-004
  FB-011   `nutrition.ts` with unit tests (same rounding as the generated columns)                    FB-001
  FB-012   Meals and foods services + `/api/meals`, `/api/foods`                                      FB-010, FB-011
  FB-013   Nutrition diary (date picker), My foods search, manual food entry, meal editor, delete    FB-012
  FB-014   Today dashboard (hero ring, macros, activity tiles placeholder, meals, latest activity)    FB-013

**Exit:** create/edit/delete meals by hand; Today and Nutrition totals
match the `daily_nutrition` view; unlogged meal types never show as 0
kcal.

## Phase 3 --- AI Food Parser

  ID       Task                                                                                         Depends on
  -------- -------------------------------------------------------------------------------------------- -----------
  FB-015   AI provider interface, Claude provider (Anthropic SDK, structured outputs, typed errors), rate-limit + `ai_usage` logging   FB-005, API key
  FB-016   Food parser: schema v1, prompt, validation, macro-energy warnings, My foods match, `/api/ai/food-parse`   FB-015
  FB-017   Log with AI + Review meal UI (stepper, grams, assumptions, questions, confirm & save, manual fallback)   FB-016, FB-013
  FB-018   Mocked-provider tests; live evaluation script with ~20 EN/RU meals (run once, with your approval)       FB-016

**Exit:** representative EN and RU meals parse well enough on Haiku 5.5
(or we switch the parser model); malformed output, timeouts and
refusals are handled; nothing is saved without confirmation.

## Phase 4 --- Activity and strength workouts

  ID       Task                                                                                      Depends on
  -------- ----------------------------------------------------------------------------------------- -----------
  FB-019   Migration: `save_workout(payload jsonb)` (workout + sets + exercise upsert, atomic)          FB-004
  FB-020   `activity.ts`: pace, speed, MET calorie estimate, with unit tests                          FB-001
  FB-021   Activities, workouts, exercises services + API (incl. built-in EN/RU exercise list)        FB-019, FB-020
  FB-022   Activity screen (week/month), Add workout (all 5 types), view/edit/delete; Today activity tiles   FB-021

**Exit:** all five activity types can be logged, edited and deleted;
pace, speed and estimated active kcal are correct; active kcal never
changes "kcal left".

## Phase 5 --- Measurements and statistics

  ID       Task                                                                               Depends on
  -------- ---------------------------------------------------------------------------------- ---------------
  FB-023   Measurements screen (history, edit, delete) and Profile tiles                         FB-008
  FB-024   Statistics service: 7/30/90-day aggregates, averages over logged days, gaps          FB-012, FB-021, FB-023
  FB-025   Statistics screen with SVG charts (line with gaps, bars, body trend)                 FB-024

**Exit:** statistics match stored records; missing days are gaps, not
zeros.

## Phase 6 --- AI Coach and daily insight

  ID       Task                                                                                    Depends on
  -------- --------------------------------------------------------------------------------------- -------------
  FB-026   Coach context pack builder with tests (only the current user's data, completeness flags)   FB-024
  FB-027   Coach service, `/api/ai/coach`, conversations endpoints                                   FB-015, FB-026
  FB-028   AI Coach screen (stat strip, insight cards, chat, suggested questions, history)          FB-027
  FB-029   Daily insight generation + cache, card on Today and Coach                                FB-026
  FB-030   Coach scenario tests (empty data, partial week, medical question, extreme diet, RU)      FB-027

**Exit:** answers use only the signed-in user's data, mention missing
data, follow the safety rules, and come back in the user's language.

## Phase 7 --- Hardening, PWA and release

  ID       Task                                                                                Depends on
  -------- ----------------------------------------------------------------------------------- ------------
  FB-031   PWA manifest, icons, apple-touch-icon, safe areas                                     FB-002
  FB-032   Account deletion (`DELETE /api/account`, confirmation UI)                            FB-008
  FB-033   Playwright end-to-end suite for the core journeys (EN + RU)                          Phases 1--6
  FB-034   Privacy policy + help pages (mention AI processing by Anthropic)                     ---
  FB-035   Vercel deployment, production env vars, Supabase redirect URLs, custom SMTP          FB-033
  FB-036   iPhone Safari QA: Add to Home Screen, keyboard, safe areas, both languages           FB-035

**Exit:** core journeys work on iPhone (installed PWA) and desktop in
production.

## Testing

-   **Unit (Vitest):** nutrition maths and rounding, grams/quantity
    scaling, pace/speed/MET, local-date and range helpers, Zod schemas,
    goal suggestion, statistics aggregation with gaps.
-   **Database:** `supabase/scripts/rls_isolation_test.sql` after every
    migration; tests for `save_meal` / `save_workout`.
-   **Integration:** API endpoints with two real test users (isolation,
    validation, error envelope); AI services with a mocked provider
    (malformed output, timeout, refusal, rate limit).
-   **AI evaluation:** live script, run on request (costs money).
-   **End-to-end (Playwright, iPhone viewport):** sign-up + onboarding,
    manual meal, AI meal (provider mocked), strength workout, run,
    measurements + statistics, AI Coach (mocked), language switch,
    account deletion.

## Release checklist

-   [ ] All migrations committed and applied; RLS test passes in
    production.
-   [ ] Two-user API tests pass.
-   [ ] No secrets in client bundles (build output checked).
-   [ ] Nutrition totals reconcile across Today, Nutrition and
    Statistics.
-   [ ] AI estimates editable; nothing saved without confirmation.
-   [ ] Active kcal never changes "kcal left".
-   [ ] Missing days never shown as zero.
-   [ ] Activities and workouts editable/deletable.
-   [ ] EN and RU complete; Cyrillic renders correctly.
-   [ ] Empty/loading/error states on every screen.
-   [ ] AI daily limits enforced; `ai_usage` logged.
-   [ ] iPhone Safari + installed PWA tested.
-   [ ] Privacy policy published; account deletion works.
-   [ ] Supabase custom SMTP configured.

## Deferred backlog

Notifications, profile photos, voice input button, offline mode, dark
theme, imperial units, Apple Health / wearables, GPS tracking, barcode
scanning, food photo recognition, external food databases, meal
planning, advanced training plans, social features, gamification, paid
plans, Capacitor native packaging, streaming Coach responses, Ollama
provider, per-set "done" tick in strength workouts, managing (renaming,
deleting) the saved exercise list.
