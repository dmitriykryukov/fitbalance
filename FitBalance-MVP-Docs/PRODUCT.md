# FitBalance --- Product Specification

**Status:** MVP scope v1 --- decisions confirmed 2026-11-07\
**Platform:** iPhone-first responsive web app / PWA\
**Stack:** SvelteKit + TypeScript + Tailwind CSS; Supabase (Postgres +
Auth); Claude API behind a server-side AI provider abstraction; hosted
on Vercel.\
**Design source:** Figma Make project "FitBalance Fitness Tracker"
(<https://www.figma.com/make/F0liGjtRUs3nVvpYxpD75h/FitBalance-Fitness-Tracker>).

## Vision

FitBalance helps users track nutrition and physical activity with fast
manual entry, AI-assisted food logging, useful summaries, and coaching
based on their own saved data.

## Product principles

1.  Fast, simple daily logging.
2.  AI suggestions are editable estimates, never silently saved.
3.  AI estimates nutrition per 100 g and the portion weight; the
    application calculates every item, meal and daily total from those
    structured values. The LLM never does the arithmetic.
4.  Targets and totals must be consistent across screens.
5.  User data is private and protected by authorization and RLS.
6.  AI providers can be changed without rewriting product logic.

## MVP scope

-   Authentication (email + password, and email magic link) and profile.
-   English and Russian user interface; the user picks a language in
    the profile.
-   Configurable nutrition and activity goals.
-   Natural-language food logging with AI: Claude identifies foods,
    estimates portion grams and nutrition per 100 g; the user reviews,
    edits and confirms. Meal descriptions may be written in English or
    Russian.
-   "My foods": the user's personal food list, built automatically from
    confirmed meals and from custom foods the user creates. Manual
    logging searches this list.
-   Manual food entry without AI (name, grams, nutrition values).
-   Daily calories and macros.
-   Strength workouts: exercises, sets, reps, weights, duration.
-   Walking, running, cycling, and other activity logging.
-   Weight and waist measurements.
-   Today dashboard.
-   Basic 7-day and 30-day statistics.
-   AI Coach grounded in the user's saved records, plus one short daily
    AI insight on Today and AI Coach (cached once per day).
-   Active calories for workouts and activities: estimated by the app
    from body weight and duration (MET), or entered by the user; shown
    separately from food calories.
-   Account deletion (removes all user data).
-   Responsive mobile UI and PWA-ready experience.

## Out of scope

Apple Health, GPS tracking, automatic activity detection, food photo
recognition, barcode scanning, external food nutrition databases,
wearables, social features, advanced meal plans, imperial units,
offline mode, native app packaging, and medical diagnosis/treatment.

## Main screens

  -----------------------------------------------------------------------
  Screen                              Purpose
  ----------------------------------- -----------------------------------
  Today Dashboard                     Daily calories, macros, activity
                                      and meal overview

  Food Diary                          Meals for a selected date

  Add Food / AI Review                Describe food or pick from My
                                      foods, review estimates, save

  Activity Dashboard                  Activity history and workout
                                      summaries

  Add Workout / Activity              Log strength or other activities

  AI Coach                            Ask questions based on saved data

  Statistics                          Nutrition, activity, weight and
                                      waist trends

  Profile & Goals                     Personal details, language,
                                      targets, My foods, account
  -----------------------------------------------------------------------

## Core journeys

### First-time setup

Sign up (password or magic link) → complete profile (name, height,
timezone, language) → configure goals → Today Dashboard.

### AI meal logging

Describe meal → AI parses items, estimates grams and nutrition per
100 g, and flags uncertainties → app calculates item and meal totals →
user reviews/edits (changing grams recalculates instantly) → user
confirms → meal is saved and items are added/updated in My foods →
dashboard updates.

### Manual meal logging

Search My foods → select food → enter grams → app calculates macros →
save to meal. If the food is not in My foods, the user either describes
it to AI or enters nutrition values manually.

### Activity logging

Choose activity type → enter relevant metrics → validate → save →
refresh activity history and summaries.

### AI Coach

Ask question → server retrieves minimum relevant records for the
authenticated user → AI responds with grounded insights in the user's
language → conversation is displayed and stored.

## Important calculation rules

-   Store explicit units; all stored quantities are metric (g, ml, kg,
    cm, m, seconds).
-   Every meal item stores a snapshot of nutrition per 100 g, the grams
    eaten, and the calculated totals, so history never changes when My
    foods is edited.
-   Mark the origin of every value: AI estimate, edited by user, or from
    My foods.
-   Do not silently save AI suggestions.
-   Show food calories and activity expenditure separately.
-   Do not automatically subtract estimated exercise calories from the
    food target.
-   Do not treat missing logs as zero or as a complete day.
-   Goals are configurable; never hard-code a personal target.
-   The diary date is the user's local date in their profile timezone.

## Success criteria

A user can register, configure goals, log food with AI or manually,
correct estimates, see daily totals, log strength and other activities,
track measurements, view history, ask AI Coach questions grounded in
their records, switch between English and Russian, and delete their
account.

## Decisions

  -----------------------------------------------------------------------
  Topic                       Decision
  --------------------------- -------------------------------------------
  Authentication              Supabase Auth: email + password, and email
                              magic link.

  Nutrition data source       Claude estimates nutrition per 100 g and
                              portion grams for every item. No external
                              food database in MVP.

  Food catalogue              User-owned only ("My foods"). No shared
                              catalogue in MVP.

  Meal types                  Fixed: breakfast, lunch, dinner, snack.

  Units                       Metric only.

  Languages                   English and Russian UI; AI accepts input
                              in either and answers in the UI language.

  AI conversation retention   Kept until the user deletes the
                              conversation or the account.

  Packaging                   PWA only; Capacitor may be considered after
                              MVP.

  AI providers                Claude in MVP; Ollama is not part of MVP,
                              but the provider abstraction is kept.

  Hosting                     Vercel (app) + Supabase cloud (database and
                              auth).
  -----------------------------------------------------------------------

## Safety

FitBalance is a tracking and educational product, not a medical device.
AI must not diagnose or prescribe treatment, and must distinguish
estimates from recorded facts. Nutrition values produced by AI are
always labelled as estimates.
