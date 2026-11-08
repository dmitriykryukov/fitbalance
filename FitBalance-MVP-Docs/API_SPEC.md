# FitBalance --- API Specification

**Status:** MVP v1 --- confirmed 2026-11-07\
**Backend:** SvelteKit server routes (`src/routes/api/**/+server.ts`) →
server services (`src/lib/server/services`) → Supabase (Postgres + RLS).

## How the app uses the API

-   **Page data** is loaded in `+page.server.ts` by calling the server
    services directly. The `GET` endpoints below return the same data
    for client-side refreshes and for a possible native app later.
-   **All writes** go through the JSON endpoints below.
-   **Auth** (sign-up, password sign-in, magic link, sign-out) uses
    SvelteKit form actions on `/login`, `/signup` and `/app/profile/account`
    with the Supabase server client; `/auth/callback` exchanges the
    email link code for a session. These are not JSON endpoints.

## Conventions

-   JSON only; requests must send `Content-Type: application/json`
    (cross-site JSON requests are blocked by CORS; cookies are
    `SameSite=Lax`).
-   Every endpoint requires a valid session (Supabase cookie) and uses
    the Supabase client bound to that session, so **RLS is always
    enforced**. `user_id` always comes from the session; any `user_id`
    in a request body is rejected by validation.
-   Request bodies and query parameters are validated with Zod; unknown
    fields are rejected.
-   Dates: `local_date` is `YYYY-MM-DD` in the user's profile timezone;
    timestamps are ISO 8601 with offset. Dates more than one day in the
    future or before 2000-01-01 are rejected.
-   Units are metric and in the field name (`_g`, `_kg`, `_cm`,
    `_meters`, `_seconds`, `_kcal`, `_per_100g`).
-   The service-role key is used by one endpoint only
    (`DELETE /api/account`).

### Response envelope

``` json
{ "data": { }, "error": null }
```

``` json
{ "data": null,
  "error": { "code": "VALIDATION_ERROR", "message": "Grams must be greater than 0.",
             "fields": { "items.1.grams": "must be greater than 0" } } }
```

Messages are short, safe and localised; no stack traces or SQL errors.

### Error codes

  Code                    HTTP   When
  ----------------------- ------ -----------------------------------------------------
  `UNAUTHENTICATED`       401    no or expired session
  `FORBIDDEN`             403    action not allowed (e.g. account delete without confirmation)
  `NOT_FOUND`             404    missing record **or a record owned by someone else** (RLS hides it)
  `VALIDATION_ERROR`      422    invalid body or query; `fields` lists problems
  `RATE_LIMITED`          429    provider rate limit or user's daily AI limit; `retry_after_seconds` when known
  `AI_REFUSED`            422    AI declined the request; UI offers manual entry
  `AI_PROVIDER_ERROR`     502    AI timeout, 5xx, connection error
  `AI_INVALID_RESPONSE`   502    AI output failed validation
  `INTERNAL_ERROR`        500    anything else (details logged server-side only)

## Endpoints

### Profile, goals, account

  Method   Endpoint                    Purpose
  -------- --------------------------- -----------------------------------------------------------
  GET      `/api/profile`              profile + active goal for today
  PATCH    `/api/profile`              update `display_name`, `date_of_birth`, `sex`, `height_cm`, `timezone`, `locale`, `activity_preferences`, `onboarded` (true sets `onboarded_at`)
  GET      `/api/goals?date=`          goal active on `date` (default today)
  PUT      `/api/goals`                save goals; creates/updates the version effective from the user's today
  GET      `/api/goals/suggestion`     `?fitness_goal=&weekly_activity_minutes=` (optional); suggested calories/macros from profile, latest weight and goal (Mifflin--St Jeor); marked as estimate; `missing` lists profile fields needed when no suggestion is possible
  DELETE   `/api/account`              body `{ "confirm": "DELETE" }`; deletes the auth user → all data cascades; signs out

### Dashboard and statistics

  Method   Endpoint                                       Purpose
  -------- ---------------------------------------------- ---------------------------------------
  GET      `/api/dashboard?date=`                         everything the Today screen needs
  GET      `/api/statistics?range=7d|30d|90d&end=`        Statistics screen; `end` defaults to today

Dashboard response (abbreviated):

``` json
{
  "data": {
    "date": "2026-11-07",
    "goal": { "calories_kcal": 2000, "protein_g": 150, "carbs_g": 210, "fat_g": 65, "fitness_goal": "lose_fat" },
    "nutrition": { "logged": true, "kcal": 1250, "protein_g": 95, "carbs_g": 120, "fat_g": 42,
                   "kcal_left": 750, "has_ai_estimates": true },
    "meals": [ { "meal_type": "breakfast", "logged": true, "kcal": 385, "logged_at": "2026-11-07T08:10:00-05:00",
                 "item_names": ["Greek yogurt", "Blueberries", "Almonds"] },
               { "meal_type": "dinner", "logged": false } ],
    "activity": { "gym_minutes": 45, "steps": 6200, "active_kcal": 310, "latest": { "kind": "workout", "id": "…", "title": "Upper body strength", "sets": 18, "exercises": 6, "duration_seconds": 2700 } }
  },
  "error": null
}
```

`kcal_left` = goal − rounded food kcal (never adjusted for active
kcal), so it always adds up with the consumed number shown; `null` when
no calorie goal is set. `nutrition.logged` is false when the day has no
meals (totals are then 0 but must be shown as "not logged", not as
data). Unlogged meal types are `{ "meal_type": "dinner", "logged": false }`.
Activity values (`gym_minutes`, `steps`, `active_kcal`) are `null` when
nothing of that kind is logged that day; `latest` is the most recent
workout or activity on or before the date. Statistics returns one entry per day with
`null` for days without logs (never 0), plus averages over logged days
and `days_logged`.

### Meals and My foods

  Method   Endpoint                     Purpose
  -------- ---------------------------- ------------------------------------------------------
  GET      `/api/meals?date=`           meals with items for a date
  POST     `/api/meals`                 create a meal with items (one transaction)
  GET      `/api/meals/:id`             one meal with items
  PUT      `/api/meals/:id`             replace meal fields and its items (one transaction)
  DELETE   `/api/meals/:id`             delete meal (items cascade)
  GET      `/api/foods?query=&limit=`   search My foods; empty query → recent/frequent
  POST     `/api/foods`                 create a custom food
  PATCH    `/api/foods/:id`             edit a food (past meals keep their snapshots)
  DELETE   `/api/foods/:id`             delete a food (past meals keep their snapshots)

Create meal request:

``` json
{
  "local_date": "2026-11-07",
  "logged_at": "2026-11-07T08:15:00-05:00",
  "meal_type": "breakfast",
  "input_method": "ai",
  "ai_description": "Two fried eggs, 80g smoked salmon and coffee with milk",
  "items": [
    {
      "name": "Fried eggs",
      "quantity": 2, "unit": "piece", "grams": 100,
      "nutrition_per_100g": { "kcal": 196, "protein_g": 13.6, "carbs_g": 0.8, "fat_g": 15.3, "fibre_g": 0 },
      "estimate_source": "ai_edited",
      "confidence": 0.85,
      "food_item_id": null,
      "save_to_my_foods": true
    }
  ]
}
```

-   1--30 items; `grams` 0 < g ≤ 5000; per-100 g ranges as in
    DATABASE.md.
-   The client **never sends totals**; the database calculates them
    (generated columns). The response returns the saved meal with
    calculated item and meal totals.
-   `food_item_id`, if given, must be one of the user's foods (enforced
    by a composite foreign key).
-   `save_to_my_foods` (default true for AI items) upserts the food by
    name + brand and bumps `use_count`; values the user typed are never
    overwritten by AI estimates (see DATABASE.md, `save_meal`).
-   Meal responses include `items` (with database-calculated totals),
    `totals` and `has_ai_estimates`.
-   `POST /api/foods` and `PATCH /api/foods/:id` reject a second food
    with the same name + brand (`VALIDATION_ERROR`, `fields.name`).
-   Implemented with the `save_meal(payload jsonb)` database function
    (security invoker), so the meal, items and My foods update succeed
    or fail together.

### AI

  Method   Endpoint                          Purpose
  -------- --------------------------------- ------------------------------------------------------
  POST     `/api/ai/food-parse`              parse a meal description; **saves nothing**
  POST     `/api/ai/coach`                   send a Coach message, returns the reply
  GET      `/api/ai/conversations`           list conversations (newest activity first)
  GET      `/api/ai/conversations/:id`       messages of one conversation
  DELETE   `/api/ai/conversations/:id`       delete a conversation and its messages
  GET      `/api/ai/daily-insight?date=`     today's insight; generated on first request of the day, then cached

Food parse request: `{ "description": "…", "meal_type": "breakfast" }`
(description 1--1000 chars). Response:

``` json
{
  "data": {
    "schema_version": "1",
    "items": [
      {
        "name": "Fried eggs", "quantity": 2, "unit": "piece", "grams": 100,
        "preparation": "fried", "is_assumption": false,
        "nutrition_per_100g": { "kcal": 196, "protein_g": 13.6, "carbs_g": 0.8, "fat_g": 15.3, "fibre_g": 0 },
        "confidence": 0.85,
        "uncertainties": ["Cooking oil estimated — adjust if needed"],
        "warnings": [],
        "my_food_match": null,
        "preview": { "kcal": 196, "protein_g": 13.6, "carbs_g": 0.8, "fat_g": 15.3, "fibre_g": 0 }
      }
    ],
    "clarifying_questions": ["How much milk was in the coffee?"],
    "notes": [],
    "preview_total": { "kcal": 342, "protein_g": 31, "carbs_g": 4, "fat_g": 20 }
  },
  "error": null
}
```

Coach request: `{ "conversation_id": null, "message": "…" }` (1--2000
chars). Response: `{ "conversation_id": "…", "message": { "id": "…",
"role": "assistant", "content": "…", "created_at": "…" } }`. Details of
both pipelines are in AI_SPEC.md.

### Activities and strength workouts

  Method   Endpoint                          Purpose
  -------- --------------------------------- -------------------------------------------------
  GET      `/api/activities?from=&to=`       cardio/other activities in a date range (max 366 days)
  POST     `/api/activities`                 create
  GET      `/api/activities/:id`             one activity
  PATCH    `/api/activities/:id`             update
  DELETE   `/api/activities/:id`             delete
  GET      `/api/workouts?from=&to=`         strength workouts with set counts
  POST     `/api/workouts`                   create workout with exercises and sets (one transaction)
  GET      `/api/workouts/:id`               one workout with sets
  PUT      `/api/workouts/:id`               replace workout and its sets (one transaction)
  DELETE   `/api/workouts/:id`               delete (sets cascade)
  GET      `/api/exercises?query=`           user's exercises + built-in suggestions in the UI language

Activity request:

``` json
{
  "activity_type": "running",
  "title": null,
  "local_date": "2026-11-07",
  "started_at": "2026-11-07T07:00:00-05:00",
  "duration_seconds": 2640,
  "distance_meters": 7200,
  "steps": null,
  "active_kcal": null,
  "notes": ""
}
```

Strength workout request:

``` json
{
  "title": "Upper body strength",
  "local_date": "2026-11-07",
  "started_at": "2026-11-07T18:15:00-05:00",
  "duration_seconds": 2700,
  "active_kcal": null,
  "notes": "",
  "exercises": [
    { "name": "Bench press", "exercise_id": null, "muscle_group": "chest", "equipment": "Barbell",
      "sets": [ { "set_number": 1, "reps": 10, "weight_kg": 50 },
                { "set_number": 2, "reps": 10, "weight_kg": 50 } ] }
  ]
}
```

-   `active_kcal`: a number means "entered by the user"
    (`kcal_source = 'user'`); `null` means the server estimates it with
    MET × latest weight × hours (`kcal_source = 'estimated'`), or leaves
    it empty when no weight is recorded.
-   Pace and average speed are returned in responses (speed is a
    generated column; pace is calculated by the service).
-   Workouts are saved with the `save_workout(payload jsonb)` database
    function; new exercise names are added to the user's exercise list.

### Body measurements

  Method   Endpoint                          Purpose
  -------- --------------------------------- ----------------------------------------
  GET      `/api/measurements?from=&to=`     measurements in a range (newest first)
  POST     `/api/measurements`               add `{ local_date, measured_at, weight_kg?, waist_cm?, notes? }` (at least one value)
  PATCH    `/api/measurements/:id`           update
  DELETE   `/api/measurements/:id`           delete

## Acceptance criteria

-   Every endpoint returns `UNAUTHENTICATED` without a session and
    `NOT_FOUND` for another user's record (tested with two users).
-   All bodies validated server-side; unknown fields rejected.
-   AI parsing never saves; meals are saved only by `POST/PUT /api/meals`.
-   Nutrition totals are always calculated by the database; client totals
    are not accepted.
-   Multi-row saves (meal + items, workout + sets) are atomic.
-   Errors follow the envelope and never leak secrets, SQL or stack
    traces.
-   AI endpoints enforce daily limits and log `ai_usage`.
