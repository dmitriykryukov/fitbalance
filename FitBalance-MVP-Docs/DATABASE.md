# FitBalance --- Database Specification

**Status:** MVP schema v1 --- implemented in
`supabase/migrations/20261107120000_init.sql`, verified by
`supabase/scripts/rls_isolation_test.sql` (2026-11-07).\
**Database:** Supabase PostgreSQL 15+ (uses `ON DELETE SET NULL (column)`
and `security_invoker` views).

## Conventions

-   UUID primary keys (`gen_random_uuid()`); `ai_usage` uses a bigint
    identity.
-   `timestamptz` for event timestamps; `local_date date` for the
    user's diary day, computed by the app from the profile timezone.
-   Every user-owned row has `user_id → auth.users(id) ON DELETE
    CASCADE`, including child rows. Deleting the auth user deletes all
    of the user's data (account deletion).
-   Metric units only, written in the column name: `_g`, `_kg`, `_cm`,
    `_meters`, `_seconds`, `_kcal`, `_per_100g`.
-   Allowed values are enforced with `CHECK` constraints (easier to
    change than Postgres enums).
-   `created_at` / `updated_at` on every mutable table; `updated_at`
    maintained by trigger.
-   Sanity limits on numeric values (for example `grams ≤ 5000`,
    `kcal_per_100g ≤ 900`) reject obviously wrong input, not personal
    targets.

## Key design decisions

1.  **Database does the nutrition arithmetic.** `meal_items` stores the
    nutrition per 100 g snapshot and grams eaten; `kcal`, `protein_g`,
    `carbs_g`, `fat_g`, `fibre_g` are `GENERATED ALWAYS` columns
    (`round(per_100g × grams / 100, 1)`). Clients cannot submit totals.
2.  **Composite foreign keys protect ownership.** Child tables reference
    `(parent_id, user_id)`, so a child row can never be attached to
    another user's meal, workout or conversation, even by a bug in
    application code.
3.  **No shared catalogue in MVP.** `food_items` ("My foods") and
    `exercises` are user-owned.
4.  **Missing days are not zero.** The `daily_nutrition` view only
    returns days that have at least one meal.
5.  **Atomic multi-row saves use Postgres functions** (see below) so a
    meal and its items, or a workout and its sets, are saved in one
    transaction.

## Tables

### `profiles` (1:1 with `auth.users`)

  Column                          Notes
  ------------------------------- --------------------------------------------------
  `id`                            PK, FK `auth.users`
  `display_name`                  ≤ 80 chars
  `date_of_birth`                 optional
  `sex`                           optional: `female`, `male` (for suggested targets)
  `height_cm`                     50--272
  `timezone`                      IANA name, default `UTC`, validated by trigger
  `locale`                        `en` \| `ru`, default `en`
  `activity_preferences`          subset of `gym`, `running`, `walking`, `cycling`, `other`
  `onboarded_at`                  set when first-time setup is finished

Created automatically by trigger `on_auth_user_created` when a user
signs up. The sign-up screen may pass `{ "locale": "ru" }` as user
metadata.

### `user_goals` (versioned)

`effective_from`, `fitness_goal` (`lose_fat`, `maintain`,
`build_muscle`), `calories_kcal`, `protein_g`, `carbs_g`, `fat_g`,
`target_weight_kg`, `target_waist_cm`, `weekly_activity_minutes`. All
targets optional. Unique `(user_id, effective_from)`: saving goals twice
on the same day updates that version. **Active goal for day D** = row
with the latest `effective_from ≤ D`.

### `food_items` --- "My foods"

  Column                                                Notes
  ----------------------------------------------------- -------------------------------------------
  `name`, `brand`                                       unique per user (case-insensitive)
  `kcal_per_100g`                                       0--900, required
  `protein_per_100g`, `carbs_per_100g`, `fat_per_100g`  0--100, required
  `fibre_per_100g`                                      optional
  `serving_description`, `serving_grams`                e.g. "1 egg" = 50 g, optional
  `source`                                              `ai_estimate` \| `user`
  `use_count`, `last_used_at`                           to sort search results by recent/frequent

Added automatically when a meal is confirmed (de-duplicated by name +
brand), or created manually by the user.

### `meals`

`local_date`, `logged_at`, `meal_type` (`breakfast`, `lunch`, `dinner`,
`snack`), `input_method` (`manual` \| `ai`), `ai_description` (the
user's original text), `notes`. Several meals of the same type per day
are allowed; the UI groups them by type.

### `meal_items`

  Column                                                Notes
  ----------------------------------------------------- ---------------------------------------------------------
  `meal_id` + `user_id`                                 composite FK → `meals`, cascade delete
  `food_item_id` + `user_id`                            composite FK → `food_items`; on delete sets only `food_item_id` null
  `position`                                            display order
  `name`                                                snapshot
  `quantity`, `unit`                                    as the user said it ("2 piece", "1 cup"), optional
  `grams`                                               required, 0--5000; weight equivalent (liquids: AI estimates grams)
  `*_per_100g`                                          nutrition snapshot
  `kcal`, `protein_g`, `carbs_g`, `fat_g`, `fibre_g`    **generated** totals
  `estimate_source`                                     `ai_estimate` \| `ai_edited` \| `my_food` \| `user_entered`
  `confidence`                                          0--1, AI only

### `activities`

`activity_type` (`walking`, `running`, `cycling`, `other`), `title`
(required for `other`, e.g. "Swimming"), `started_at`, `local_date`,
`duration_seconds` (required), `distance_meters`, `steps`,
`estimated_kcal_burned` + `kcal_source`, `notes`.
`average_speed_kmh` is a generated column; running pace (min/km) is
calculated in the app.

**Active calories** (`estimated_kcal_burned` on activities and
workouts): estimated by the app as MET × latest body weight × hours
(`kcal_source = 'estimated'`), or entered by the user, e.g. from a watch
(`kcal_source = 'user'`). Both columns are set together or both null;
no estimate is made when the user has no weight recorded. Active
calories are shown separately and never subtracted from the food
target.

### `workouts`, `exercises`, `workout_sets`

-   `workouts`: `title`, `started_at`, `local_date`,
    `duration_seconds`, `estimated_kcal_burned` + `kcal_source`,
    `notes`.
-   `exercises`: the user's exercise list for autocomplete --- `name`
    (unique per user), `muscle_group` (`chest`, `back`, `shoulders`,
    `arms`, `legs`, `glutes`, `core`, `full_body`, `other`),
    `equipment`. The app ships a built-in suggestion list (EN/RU); an
    exercise is added to this table the first time the user uses it.
-   `workout_sets`: composite FK → `workouts`; optional composite FK →
    `exercises`; `exercise_name` snapshot, `exercise_order`,
    `set_number`, `reps`, `weight_kg`, `duration_seconds`,
    `distance_meters`, `notes`. At least one of reps / duration /
    distance is required. Unique `(workout_id, exercise_order,
    set_number)`, deferred so sets can be reordered in one transaction.

### `body_measurements`

`measured_at`, `local_date`, `weight_kg` (20--400), `waist_cm`
(30--300), `notes`. At least one of weight or waist is required.

### `ai_conversations`, `ai_messages`

-   `ai_conversations`: `title`; `updated_at` is bumped by trigger
    whenever a message is added.
-   `ai_messages`: composite FK → `ai_conversations`, `role` (`user` \|
    `assistant`), `content` (≤ 20 000 chars), `provider`, `model`.
-   Retention: kept until the user deletes the conversation or the
    account.

### `ai_daily_insights`

One short AI insight (`title`, `body`) per user, `local_date` and
`locale`, generated the first time the user opens Today or AI Coach that
day and reused afterwards. Stores `provider` and `model`.

### `ai_usage` (rate limits and cost tracking)

`feature` (`food_parse` \| `coach` \| `daily_insight`), `provider`, `model`,
`input_tokens`, `output_tokens`, `latency_ms`, `status` (`ok`,
`provider_error`, `invalid_response`, `timeout`, `rate_limited`). No
prompt or response content is stored here. **Append-only for users**:
they can insert and read their own rows but cannot update or delete
them, so quotas cannot be reset.

## View

### `daily_nutrition` (`security_invoker = true`, respects RLS)

One row per `(user_id, local_date)` that has at least one meal:
`meal_count`, `item_count`, `kcal`, `protein_g`, `carbs_g`, `fat_g`,
`fibre_g` (null when no item has fibre data), `has_ai_estimates`. Used by
the Today Dashboard and Statistics. No cached daily totals are stored.

## Relationships and delete behaviour

  Parent → child                      On parent delete
  ----------------------------------- ------------------------------------
  `auth.users` → every table          cascade (account deletion)
  `meals` → `meal_items`              cascade
  `workouts` → `workout_sets`         cascade
  `ai_conversations` → `ai_messages`  cascade
  `food_items` → `meal_items`         `food_item_id` set null; snapshot kept
  `exercises` → `workout_sets`        `exercise_id` set null; snapshot kept

## Row Level Security

-   RLS is enabled on all 14 tables.
-   Standard policy on every user-owned table: `for all to authenticated
    using (user_id = auth.uid()) with check (user_id = auth.uid())`.
-   `profiles`: select/update own row only; insert only via the sign-up
    trigger; delete only by cascade.
-   `ai_usage`: select and insert own rows; `UPDATE`/`DELETE` privileges
    revoked.
-   The `anon` role has no privileges on any app table or view.
-   Table privileges are granted explicitly in migrations (newer Supabase
    projects do not grant them to API roles by default):
    `authenticated` gets select/insert/update/delete on user-owned tables,
    select/update on `profiles`, select/insert on `ai_usage`, select on
    `daily_nutrition`; no API role gets `TRUNCATE`, `TRIGGER` or
    `REFERENCES`. Every new table or view needs its own grants.
-   The service-role key is used only server-side, for account deletion.
    It is never sent to the browser.

## Indexes

`meals(user_id, local_date)`, `activities(user_id, local_date)`,
`workouts(user_id, local_date)`, `body_measurements(user_id,
local_date)`, `ai_conversations(user_id, updated_at desc)`,
`ai_messages(conversation_id, created_at)`, `meal_items(meal_id,
user_id)`, `workout_sets(workout_id, user_id)`,
`food_items(user_id, last_used_at desc)`, `ai_usage(user_id, feature,
created_at desc)`, plus unique name indexes on `food_items` and
`exercises` and partial indexes on nullable foreign keys.

## Database functions

  Phase   Function                      Status
  ------- ----------------------------- ---------------------------------------------------------------
  2       `save_meal(payload jsonb)`    done --- `20261107150000_save_meal.sql`
  4       `save_workout(payload jsonb)` planned --- create/replace a workout and its sets; upsert exercises

Both run as `security invoker`, so RLS and the composite foreign keys
still apply; `execute` is granted to `authenticated` only (not `anon`).

**`save_meal`** creates the meal (`id` null) or replaces it (`id` given:
updates the meal row, deletes and re-inserts its items), then for each
item:

-   `save_to_my_foods = true` upserts the food on the unique name + brand
    index, links the item to it, adds 1 to `use_count` and sets
    `last_used_at`. Values the user typed (`source = 'user'`) are never
    overwritten by AI estimates; AI-sourced foods take the newest
    confirmed values.
-   otherwise a given `food_item_id` only has its use count bumped.

Errors: `22023` for fewer than 1 or more than 30 items, `P0002` when the
meal to replace does not exist or belongs to someone else, plus any
constraint violation (e.g. `23503` for another user's `food_item_id`).
Any error rolls back the meal, its items and the My foods changes.
Tested through the API in `tests/integration/nutrition.test.ts`.

## Testing

`supabase/scripts/rls_isolation_test.sql` runs in a single transaction
and rolls back. It checks that:

-   the sign-up trigger creates profiles with the right locale;
-   generated nutrition totals and average speed are correct;
-   user B cannot read any of user A's rows in any table or view;
-   user B's updates and deletes of A's rows affect zero rows;
-   inserting rows owned by A, or attaching B's rows to A's meal,
    workout or conversation, is rejected;
-   users cannot insert profiles or modify/delete `ai_usage`;
-   invalid timezones are rejected;
-   `anon` cannot read anything;
-   deleting an auth user removes all of their data.

Run it in the Supabase SQL Editor or with
`psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/scripts/rls_isolation_test.sql`.
Expected last result: `ALL RLS TESTS PASSED`. It has been verified on
PostgreSQL 17 with a minimal stand-in for Supabase's `auth` schema, and
will be re-run against the real Supabase project in Phase 0.
