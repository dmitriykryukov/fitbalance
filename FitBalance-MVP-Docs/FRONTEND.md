# FitBalance --- Frontend Specification

**Status:** MVP v1 --- confirmed 2026-11-07, based on the Figma Make
prototype "FitBalance Fitness Tracker" (Version 3)\
**Target:** iPhone-first responsive web app, installable as a PWA (iPhone
17 frame, 402 × 874 pt in the design). Desktop shows the same mobile
layout centred, max width 480 px.

## Stack

  Concern          Choice
  ---------------- ---------------------------------------------------------------
  Framework        SvelteKit 2 + Svelte 5 (runes), TypeScript strict
  Styling          Tailwind CSS v4, design tokens in `@theme` (see below)
  Auth / data      `@supabase/ssr` (cookie session, server-side client)
  Validation       Zod schemas shared by forms, API routes and AI output
  i18n             Paraglide JS 2 (inlang), `en` and `ru` message files
  Fonts            Self-hosted `@fontsource-variable/manrope` and `@fontsource-variable/dm-sans`
  Icons            `lucide-svelte` (matches the prototype's line icons)
  Charts           Small custom SVG components (ring, bars, line); no chart library
  Tests            Vitest (unit), Playwright (end-to-end, iPhone viewport)
  Hosting          Vercel (`@sveltejs/adapter-vercel`)

## Design tokens (from the prototype)

  Token              Value       Use
  ------------------ ----------- -------------------------------------------------
  `--green`          `#147A57`   primary buttons, active tab, protein bar
  `--green-dark`     `#0B5E43`   hero gradient, dark cards (activity week, insight)
  `--ink`            `#17241F`   main text
  `--muted`          `#748079`   secondary text
  `--line`           `#E4E9E5`   borders, dividers, empty progress tracks
  `--paper`          `#F5F7F4`   app background
  `--mint`           `#E8F4EE`   soft green chips, AI cards, selected tab pill
  `--orange`         `#E69235`   carbs bar, "Active" dot, highlighted bar
  `--fat`            `#7587C9`   fat bar
  `--amber-bg`       `#FFF0DD`   "Estimated" badge and warning notes on AI review
  `--amber-text`     `#C8781F`   text on amber
  `--blue-bg`        `#E9EEF9`   walking/steps icon tile
  `--white`          `#FFFFFF`   cards

-   **Radii:** cards 20 px, inner tiles 16 px, inputs/chips 10--13 px,
    pills and avatars full.
-   **Typography:** headings **Manrope** (page title 24 px, section
    title 19 px, tight letter-spacing ≈ −0.035em); body **DM Sans** 16 px;
    overlines DM Sans 10 px bold, uppercase, letter-spacing 1.3 px; big
    numbers Manrope bold.
-   **Russian text:** DM Sans has no Cyrillic glyphs. The font stack is
    `"DM Sans Variable", "Manrope Variable", system-ui, sans-serif`, and
    Manrope's Cyrillic subset is loaded, so Russian body text renders in
    Manrope automatically while English keeps DM Sans.
-   Light theme only in MVP (the design has no dark mode).
-   Elevation: white cards on `--paper`, 1 px `--line` border, very soft
    shadow; no heavy shadows.

## Navigation

Bottom tab bar (5 tabs, fixed, safe-area aware): **Today**, **Nutrition**,
**Activity**, **AI Coach**, **Profile**. Statistics is opened from
Profile ("Progress & statistics") and from "View all" links.

## Routes

  Route                                 Screen                                In Figma?
  ------------------------------------- ------------------------------------- -----------
  `/`                                   redirect to `/app` or `/login`        ---
  `/login`                              email + password, "Email me a link"   no
  `/signup`                             email, password, language             no
  `/auth/callback`                      magic-link / email-confirm handler    ---
  `/onboarding`                         profile → goals (2 steps)             no
  `/app`                                **Today**                             yes
  `/app/nutrition`                      **Nutrition** (diary, `?date=`)       yes
  `/app/nutrition/ai`                   **Log with AI** → **Review meal**     yes
  `/app/nutrition/search`               search My foods + manual entry        no
  `/app/nutrition/meals/[id]`           edit a saved meal                     no
  `/app/activity`                       **Activity** (week/month)             yes
  `/app/activity/add`                   **Add workout** (Strength/Run/Walk/Cycling/Other) yes
  `/app/activity/workouts/[id]`         view/edit strength workout            no
  `/app/activity/[id]`                  view/edit cardio activity             no
  `/app/coach`                          **AI Coach** (current conversation)   yes
  `/app/coach/history`                  past conversations                    no
  `/app/statistics`                     **Statistics** (7/30/90 days)         yes
  `/app/profile`                        **Profile & goals**                   yes
  `/app/profile/edit`                   personal details                      no
  `/app/profile/goals`                  fitness goal + daily targets          partly
  `/app/profile/measurements`           weight/waist history + add            no
  `/app/profile/foods`                  My foods list, edit, delete           no
  `/app/profile/account`                language, sign out, delete account    no

Screens marked "no" are built from the same components and tokens.

## Screens

### Today (`/app`)

-   Green hero: date, greeting with display name, calorie ring
    (consumed), "**N kcal left**" = active goal − food kcal, "Goal X kcal",
    legend Food / Active. **Active calories are shown but never change
    "kcal left".**
-   Macronutrients card: protein/carbs/fat consumed vs targets, status
    chip ("On track" / "Under" / "Over", calculated by the app).
-   Daily activity tiles: gym minutes, steps (from walking logs), active
    kcal.
-   Today's meals: one row per meal type with kcal, items preview and
    time; empty types show "Add food" / "Not logged" (never 0 kcal as if
    logged).
-   Daily insight card (AI, see AI_SPEC) --- hidden if not available.
-   Latest activity card + "Add activity".
-   No goals set → hero shows consumed only and a "Set your goals" link.

### Nutrition (`/app/nutrition`)

-   Date chip ("Today" / "Yesterday" / short date) opens the native
    date picker; `?date=YYYY-MM-DD`. Future, invalid or pre-2000 dates
    fall back to today.
-   Energy + macros summary card (same bars as Today). A day without
    meals shows "—", never 0.
-   "Log with FitBalance AI" card → `/app/nutrition/ai` (added in
    Phase 3).
-   Meals grouped by type, each with time, kcal, item names and
    "P · C · F" grams; edit icon → meal editor. "Estimated" marker on
    meals that contain AI-estimated items.
-   "+ Add food" → `/app/nutrition/search?type=&date=` (type defaults
    to the time of day); meal types not logged yet are offered as
    "+ Lunch" shortcuts. AI is offered here from Phase 3.

### Log with AI → Review meal (`/app/nutrition/ai`)

One route with two steps (state kept in the page, not the URL):

1.  **Describe:** meal type and day in the subtitle, a meal-type
    selector (defaults to `?type=` or the time of day), large textarea,
    "Analyze meal" button, "Try saying" example, "Search My foods
    instead" link and a one-line note that the text is sent to Claude
    (Anthropic) and nothing is saved until confirmed. Loading state on
    the button; on error the text stays and an error banner offers "Try
    again" / "Enter manually". `?date=` works as on the add-food page.
2.  **Review:** summary chip "N foods identified --- Nothing is saved
    yet", then one card per item:
    -   name, "Estimated" badge, preparation line;
    -   amber note for each uncertainty / assumption ("Cooking oil
        estimated --- adjust if needed"); assumed items have a "Remove
        if not used" hint;
    -   quantity stepper in the item's own unit (eggs, ml, g). Changing
        it scales grams proportionally (`grams_per_unit = grams /
        quantity`); a "g" toggle edits grams directly;
    -   kcal and P/C/F recalculated instantly with `src/lib/nutrition.ts`;
    -   delete button; tap the card to edit name and per-100 g values;
    -   "Use my saved values" when a My foods match exists;
    -   items without grams are highlighted and block saving.
    -   clarifying questions shown above the cards with an "Answer and
        re-analyze" field.
    -   "Add ingredient" (search My foods or describe it).
    -   Card totals sit on their own line under the amount controls.
        Saving with missing grams scrolls to and focuses the first
        highlighted field. The Russian save button reads "Сохранить" so
        the "N продуктов → завтрак" line fits on a phone.
    -   Entry points: "Log with FitBalance AI" card on the Nutrition
        diary, and "Describe it to AI instead" on the add-food page.
    -   Sticky footer: meal total and **Confirm & Save** ("Saves N items
        to breakfast").

### Search My foods + manual entry (`/app/nutrition/search`)

Builds a new meal: meal type, date and time, the foods added so far
(grams editable, live totals) and a sticky "Save meal" bar. Search box
(recent/frequent foods shown before typing), select → grams (serving or
100 g shortcuts) → preview → add to meal. "Create food" form: name,
brand, kcal and macros per 100 g, optional serving; macros over 100 g
are rejected and energy that does not match the macros asks for a
second confirmation. Uses `inputmode="decimal"` and accepts "3,6".
The meal editor (`/app/nutrition/meals/[id]`) is the same screen with
the saved meal loaded, plus "Delete meal".

### Activity (`/app/activity`)

Week/Month toggle; dark summary card with total active time and per-day
bars (days without activity shown as empty bars, not zero-height fake
data); tiles: workouts, km distance, active kcal; "Your activity"
categories (Strength, Cardio with average pace, Walking with steps);
workout history list (tap to open); "+" → Add workout.

### Add workout / activity (`/app/activity/add`)

Type tabs: Strength, Run, Walk, Cycling, Other.

-   **Strength:** editable title, exercise cards (name, muscle group ·
    equipment, from a built-in EN/RU list or custom), set rows with kg
    and reps and a "done" tick, add/remove sets and exercises; date,
    time, duration, notes; summary (type, duration, sets, ~kcal).
-   **Run:** distance + duration → pace (min/km) shown live.
-   **Walk:** duration, optional distance and steps.
-   **Cycling:** duration, optional distance → average speed.
-   **Other:** title (required), duration, notes.
-   Active kcal is pre-filled with the MET estimate when the user has a
    weight recorded (labelled "~ estimated"), and can be overwritten.

### AI Coach (`/app/coach`)

-   Header "FitBalance Coach", settings icon → conversation history and
    "New conversation".
-   Stat strip (kcal today, protein, training minutes) and insight cards
    --- calculated by the app; the "Practical recommendation" card is the
    daily AI insight.
-   Chat: assistant and user bubbles, suggested question chips, input
    "Ask about nutrition or training...", send button, typing indicator,
    retry on error (text is kept). Footer note: "AI guidance is
    informational and not medical advice."
-   Notes on incomplete data in answers are shown as written by the
    Coach.

### Statistics (`/app/statistics`)

Range tabs 7 / 30 / 90 days.

-   **Nutrition:** average kcal **over logged days only** with "N of M
    days logged", line chart with target line --- **unlogged days are
    gaps, not zero**; % of logged days within ±10 % of target; macro
    averages vs targets.
-   **Activity:** total workouts, active duration, run distance, total
    steps.
-   **Body:** weight trend (current, target, change, % to goal), waist
    with change. Points only where measurements exist.

### Profile & goals (`/app/profile`)

Initials avatar and name, "Progress & statistics" link, measurement
tiles (age, height, current weight, target weight, waist, weekly change)
with "Edit" and "Add measurement", fitness goal selector (Lose fat /
Maintain / Build muscle), daily nutrition targets card with edit, activity
preferences chips, links: My foods, Account & language, Help.
Suggested targets (from height/weight/age/sex/goal, Mifflin--St Jeor)
are offered as a starting point and labelled as estimates.

### Auth and onboarding (not in Figma)

-   Login: email + password, "Email me a sign-in link", link to sign-up.
-   Sign-up: email, password (min 8 chars), language (EN/RU, passed as
    user metadata `locale`).
-   Magic link sent / check your email screens.
-   Onboarding (2 steps, skippable after step 1): name, date of birth,
    sex (optional), height, current weight, timezone (detected) →
    fitness goal and targets (with suggestion). Sets
    `profiles.onboarded_at`.

## Design items adapted for MVP

  In the prototype                         MVP behaviour
  ---------------------------------------- ------------------------------------------------------
  Notification bell                        hidden (no notifications in MVP)
  Microphone button on "Log with AI"       hidden; iOS keyboard dictation works in the textarea
  Profile photo with camera badge          initials avatar only
  "Premium plan" badge                     hidden (no plans)
  "Search food database instead"           "Search My foods instead"
  "Units & preferences"                    "Account & language" (metric only)
  Notifications / Help & support rows      Help → static page; notifications hidden
  Oil folded into "Fried eggs" item        AI may either fold it in (with an amber note) or list it as a separate assumed item

## Source structure

``` text
src/
  app.html  app.css  hooks.server.ts
  lib/
    components/
      layout/      AppShell, BottomNav, PageHeader
      shared/      Card, Button, Chip, Stepper, NumberField, DateChip, ProgressBar,
                   Ring, BarChart, LineChart, EmptyState, ErrorBanner, Skeleton, ConfirmDialog
      dashboard/   EnergyHero, MacroCard, ActivityTiles, MealsPreview, InsightCard
      nutrition/   MealSection, MealItemRow, AIMealInput, AIReviewItem, FoodSearch, FoodForm
      activity/    TypeTabs, StrengthForm, ExerciseCard, SetRow, CardioForm, WeekSummary, HistoryList
      coach/       ChatThread, MessageBubble, SuggestedQuestions, InsightCards
      statistics/  RangeTabs, NutritionTrend, TrainingSummary, BodyTrend
      profile/     MeasurementTiles, GoalSelector, TargetsCard, PreferenceChips
    api/           typed fetch client for /api routes (client side)
    nutrition.ts   per-100 g maths (shared client/server)
    activity.ts    pace, speed, MET estimate
    dates.ts       local date from timezone, ranges
    format.ts      Intl number/date formatting by locale
    schemas/       Zod schemas (requests, AI output)
    types/         database types generated by `supabase gen types`
    server/
      supabase.ts  server client helpers
      services/    profile, goals, meals, foods, activities, workouts,
                   measurements, statistics, dashboard, coach (DB access)
      ai/          see AI_SPEC.md
  routes/
    (auth)/login, signup, auth/callback
    onboarding/
    app/ ...       pages listed above (+page.server.ts loads data)
    api/ ...       JSON endpoints (see API_SPEC.md)
messages/          en.json, ru.json (Paraglide)
static/            manifest.webmanifest, icons, apple-touch-icon.png
```

## Data flow

-   **Reads:** each page's `+page.server.ts` `load` calls server
    services directly (no extra HTTP hop) with the request's Supabase
    client, so RLS applies.
-   **Writes:** components call the typed client in `lib/api` → JSON
    routes under `/api` → the same services. After success the page calls
    `invalidate('app:data')` (or `invalidateAll()`) so totals refresh
    everywhere.
-   Daily totals come only from `daily_nutrition` / service
    calculations; components never keep their own copy of totals.
-   Forms keep unsaved input on errors (including AI failures).
-   Destructive actions (delete meal, workout, food, conversation,
    account) use `ConfirmDialog`.

## Auth handling

-   `hooks.server.ts` creates a Supabase server client per request and
    exposes `locals.supabase` and `locals.getUser()` (verifies the access
    token with `auth.getClaims()`; never trusts `getSession()`).
-   `hooks.server.ts` redirects signed-out requests for `/app/**` and
    `/onboarding` to `/login?next=…` (this also covers form actions,
    which layouts do not guard); the `/app` layout redirects to
    `/onboarding` while `profiles.onboarded_at` is null. `next` only
    accepts same-site `/app` and `/onboarding` paths.
-   After sign-in (password, magic link or email confirmation) the
    profile `locale` is written to the language cookie, so the app opens
    in the user's language on a new device.
-   Magic link and email confirmation return to `/auth/callback`, which
    exchanges the code for a session. On iOS the link may open in Safari
    rather than the installed PWA; password sign-in is the recommended
    method inside the PWA.

## Localisation

-   Paraglide messages in `messages/en.json` and `messages/ru.json`; no
    hard-coded UI strings in components.
-   Locale source: profile `locale` → cookie → `Accept-Language` → `en`.
    No locale prefix in URLs (the app is private).
-   Numbers, dates, weekdays and plurals via `Intl` (e.g. "1 тренировка /
    2 тренировки / 5 тренировок").
-   Built-in exercise list and meal-type names are translated; user data
    (food and exercise names) is shown as entered.

## PWA and mobile behaviour

-   `manifest.webmanifest` (name, short name "FitBalance", theme colour
    `#147A57`, background `#F5F7F4`, `display: standalone`), icons
    192/512 px and maskable, `apple-touch-icon`.
-   `viewport-fit=cover` and safe-area padding for the notch and home
    indicator; bottom nav sits above the home indicator.
-   No offline support is claimed; no service-worker caching of data in
    MVP.
-   Tap targets ≥ 44 px; `inputmode="decimal"` / `numeric` on number
    fields; font size ≥ 16 px in inputs (prevents iOS zoom).
-   No horizontal scrolling at 375 px width.

## Acceptance criteria

All routes above work at 375--430 px width and on desktop; every screen
has loading, empty and error states; AI estimates are editable and saved
only on confirm; unlogged days are never shown as zero; active calories
never change "kcal left"; English and Russian are complete; no secrets in
client bundles (checked in the build output); Add to Home Screen tested
on iPhone Safari.
