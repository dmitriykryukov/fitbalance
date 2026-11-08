-- FitBalance — initial schema (MVP v1)
-- Target: Supabase PostgreSQL 15+.
-- See FitBalance-MVP-Docs/DATABASE.md for the design rationale.
--
-- Key ideas:
--   * Every user-owned row carries user_id -> auth.users(id) ON DELETE CASCADE,
--     so deleting the auth user removes all of their data.
--   * Child rows (meal_items, workout_sets, ai_messages) reference their parent
--     with a composite FK (parent_id, user_id). The database itself guarantees a
--     child can never be attached to another user's parent.
--   * Nutrition totals on meal_items are GENERATED columns
--     (per_100g * grams / 100), so the database always does the arithmetic.
--   * RLS on every table: a user can only see and change rows where
--     user_id = auth.uid().

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users, created automatically on sign-up)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text check (char_length(display_name) <= 80),
  date_of_birth date check (date_of_birth > date '1900-01-01'),
  sex           text check (sex in ('female', 'male')),
  height_cm     numeric(4, 1) check (height_cm between 50 and 272),
  timezone      text not null default 'UTC',
  locale        text not null default 'en' check (locale in ('en', 'ru')),
  activity_preferences text[] not null default '{}'
                check (activity_preferences <@ array['gym', 'running', 'walking', 'cycling', 'other']),
  onboarded_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Rejects unknown IANA timezone names (e.g. 'Mars/Base').
create or replace function public.validate_profile_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform now() at time zone new.timezone;
  return new;
exception
  when invalid_parameter_value then
    raise exception 'Invalid timezone: %', new.timezone using errcode = '22023';
end;
$$;

create trigger profiles_validate_timezone
  before insert or update of timezone on public.profiles
  for each row execute function public.validate_profile_timezone();

-- Creates the profile row when a user signs up. The UI language chosen on the
-- sign-up screen can be passed as user metadata: { "locale": "ru" }.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locale text := new.raw_user_meta_data ->> 'locale';
begin
  insert into public.profiles (id, locale)
  values (new.id, case when v_locale in ('en', 'ru') then v_locale else 'en' end);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- user_goals (versioned by effective date; active goal for day D is the row
-- with the latest effective_from <= D)
-- ---------------------------------------------------------------------------

create table public.user_goals (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users (id) on delete cascade,
  effective_from          date not null,
  fitness_goal            text check (fitness_goal in ('lose_fat', 'maintain', 'build_muscle')),
  calories_kcal          integer check (calories_kcal between 500 and 10000),
  protein_g               numeric(5, 1) check (protein_g between 0 and 1000),
  carbs_g                 numeric(5, 1) check (carbs_g between 0 and 1000),
  fat_g                   numeric(5, 1) check (fat_g between 0 and 1000),
  target_weight_kg        numeric(5, 2) check (target_weight_kg between 20 and 400),
  target_waist_cm         numeric(4, 1) check (target_waist_cm between 30 and 300),
  weekly_activity_minutes integer check (weekly_activity_minutes between 0 and 10080),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (user_id, effective_from)
);

-- ---------------------------------------------------------------------------
-- food_items = "My foods" (user-owned; nutrition per 100 g)
-- ---------------------------------------------------------------------------

create table public.food_items (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  name                text not null check (char_length(btrim(name)) between 1 and 120),
  brand               text check (char_length(brand) <= 80),
  kcal_per_100g       numeric(5, 1) not null check (kcal_per_100g between 0 and 900),
  protein_per_100g    numeric(4, 1) not null check (protein_per_100g between 0 and 100),
  carbs_per_100g      numeric(4, 1) not null check (carbs_per_100g between 0 and 100),
  fat_per_100g        numeric(4, 1) not null check (fat_per_100g between 0 and 100),
  fibre_per_100g      numeric(4, 1) check (fibre_per_100g between 0 and 100),
  serving_description text check (char_length(serving_description) <= 60),
  serving_grams       numeric(6, 1) check (serving_grams > 0 and serving_grams <= 5000),
  source              text not null check (source in ('ai_estimate', 'user')),
  use_count           integer not null default 0 check (use_count >= 0),
  last_used_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (id, user_id)
);

create unique index food_items_user_name_key
  on public.food_items (user_id, lower(btrim(name)), lower(coalesce(brand, '')));
create index food_items_user_recent_idx
  on public.food_items (user_id, last_used_at desc nulls last);

-- ---------------------------------------------------------------------------
-- meals + meal_items
-- ---------------------------------------------------------------------------

create table public.meals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  local_date     date not null,
  logged_at      timestamptz not null default now(),
  meal_type      text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  input_method   text not null check (input_method in ('manual', 'ai')),
  ai_description text check (char_length(ai_description) <= 2000),
  notes          text check (char_length(notes) <= 1000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (id, user_id)
);

create index meals_user_date_idx on public.meals (user_id, local_date);

create table public.meal_items (
  id               uuid primary key default gen_random_uuid(),
  meal_id          uuid not null,
  user_id          uuid not null references auth.users (id) on delete cascade,
  food_item_id     uuid,
  position         smallint not null default 0,
  name             text not null check (char_length(btrim(name)) between 1 and 120),
  -- quantity/unit as the user expressed it ("2 piece", "1 cup"); grams is the truth.
  quantity         numeric(8, 2) check (quantity > 0),
  unit             text check (char_length(unit) between 1 and 20),
  grams            numeric(6, 1) not null check (grams > 0 and grams <= 5000),
  -- nutrition snapshot per 100 g (history never changes when My foods is edited)
  kcal_per_100g    numeric(5, 1) not null check (kcal_per_100g between 0 and 900),
  protein_per_100g numeric(4, 1) not null check (protein_per_100g between 0 and 100),
  carbs_per_100g   numeric(4, 1) not null check (carbs_per_100g between 0 and 100),
  fat_per_100g     numeric(4, 1) not null check (fat_per_100g between 0 and 100),
  fibre_per_100g   numeric(4, 1) check (fibre_per_100g between 0 and 100),
  -- calculated by the database, never supplied by the client
  kcal      numeric(7, 1) generated always as (round(kcal_per_100g    * grams / 100, 1)) stored,
  protein_g numeric(6, 1) generated always as (round(protein_per_100g * grams / 100, 1)) stored,
  carbs_g   numeric(6, 1) generated always as (round(carbs_per_100g   * grams / 100, 1)) stored,
  fat_g     numeric(6, 1) generated always as (round(fat_per_100g     * grams / 100, 1)) stored,
  fibre_g   numeric(6, 1) generated always as (round(fibre_per_100g   * grams / 100, 1)) stored,
  estimate_source  text not null
                   check (estimate_source in ('ai_estimate', 'ai_edited', 'my_food', 'user_entered')),
  confidence       numeric(3, 2) check (confidence between 0 and 1),
  notes            text check (char_length(notes) <= 500),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  foreign key (meal_id, user_id)
    references public.meals (id, user_id) on delete cascade,
  foreign key (food_item_id, user_id)
    references public.food_items (id, user_id) on delete set null (food_item_id)
);

create index meal_items_meal_idx on public.meal_items (meal_id, user_id);
create index meal_items_food_item_idx on public.meal_items (food_item_id) where food_item_id is not null;

-- Daily nutrition totals. Days without meals have no row (missing != zero).
-- security_invoker makes the view respect the caller's RLS.
create view public.daily_nutrition
with (security_invoker = true)
as
select
  m.user_id,
  m.local_date,
  count(distinct m.id)           as meal_count,
  count(mi.id)                   as item_count,
  coalesce(sum(mi.kcal), 0)      as kcal,
  coalesce(sum(mi.protein_g), 0) as protein_g,
  coalesce(sum(mi.carbs_g), 0)   as carbs_g,
  coalesce(sum(mi.fat_g), 0)     as fat_g,
  sum(mi.fibre_g)                as fibre_g,  -- null when no item has fibre data
  bool_or(mi.estimate_source in ('ai_estimate', 'ai_edited')) as has_ai_estimates
from public.meals m
left join public.meal_items mi on mi.meal_id = m.id
group by m.user_id, m.local_date;

-- ---------------------------------------------------------------------------
-- activities (walking / running / cycling / other)
-- ---------------------------------------------------------------------------

create table public.activities (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users (id) on delete cascade,
  activity_type         text not null check (activity_type in ('walking', 'running', 'cycling', 'other')),
  title                 text check (char_length(title) <= 80),
  started_at            timestamptz,
  local_date            date not null,
  duration_seconds      integer not null check (duration_seconds between 1 and 86400),
  distance_meters       integer check (distance_meters between 0 and 1000000),
  steps                 integer check (steps between 0 and 200000),
  average_speed_kmh     numeric generated always as (
                          case when distance_meters > 0
                            then round(distance_meters::numeric / duration_seconds * 3.6, 2)
                          end) stored,
  -- Active calories: estimated by the app (MET x body weight x hours) or
  -- entered by the user (e.g. from a watch). Shown separately, never
  -- subtracted from the food target.
  estimated_kcal_burned integer check (estimated_kcal_burned between 0 and 20000),
  kcal_source           text check (kcal_source in ('estimated', 'user')),
  notes                 text check (char_length(notes) <= 1000),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (activity_type <> 'other' or title is not null),
  check ((estimated_kcal_burned is null) = (kcal_source is null))
);

create index activities_user_date_idx on public.activities (user_id, local_date);

-- ---------------------------------------------------------------------------
-- strength workouts: workouts -> workout_sets, exercises = user's exercise list
-- ---------------------------------------------------------------------------

create table public.workouts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  title            text not null check (char_length(btrim(title)) between 1 and 80),
  started_at       timestamptz,
  local_date       date not null,
  duration_seconds integer check (duration_seconds between 1 and 86400),
  estimated_kcal_burned integer check (estimated_kcal_burned between 0 and 20000),
  kcal_source      text check (kcal_source in ('estimated', 'user')),
  notes            text check (char_length(notes) <= 1000),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (id, user_id),
  check ((estimated_kcal_burned is null) = (kcal_source is null))
);

create index workouts_user_date_idx on public.workouts (user_id, local_date);

create table public.exercises (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 80),
  muscle_group text check (muscle_group in
                 ('chest', 'back', 'shoulders', 'arms', 'legs', 'glutes', 'core', 'full_body', 'other')),
  equipment    text check (char_length(equipment) <= 40),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (id, user_id)
);

create unique index exercises_user_name_key on public.exercises (user_id, lower(btrim(name)));

create table public.workout_sets (
  id               uuid primary key default gen_random_uuid(),
  workout_id       uuid not null,
  user_id          uuid not null references auth.users (id) on delete cascade,
  exercise_id      uuid,
  exercise_name    text not null check (char_length(btrim(exercise_name)) between 1 and 80),
  exercise_order   smallint not null check (exercise_order >= 0),
  set_number       smallint not null check (set_number between 1 and 100),
  reps             smallint check (reps between 0 and 1000),
  weight_kg        numeric(6, 2) check (weight_kg between 0 and 1000),
  duration_seconds integer check (duration_seconds between 1 and 86400),
  distance_meters  integer check (distance_meters between 0 and 1000000),
  notes            text check (char_length(notes) <= 500),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (reps is not null or duration_seconds is not null or distance_meters is not null),
  unique (workout_id, exercise_order, set_number) deferrable initially deferred,
  foreign key (workout_id, user_id)
    references public.workouts (id, user_id) on delete cascade,
  foreign key (exercise_id, user_id)
    references public.exercises (id, user_id) on delete set null (exercise_id)
);

create index workout_sets_workout_idx on public.workout_sets (workout_id, user_id);
create index workout_sets_exercise_idx on public.workout_sets (exercise_id) where exercise_id is not null;

-- ---------------------------------------------------------------------------
-- body_measurements (weight and/or waist)
-- ---------------------------------------------------------------------------

create table public.body_measurements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  measured_at timestamptz not null default now(),
  local_date  date not null,
  weight_kg   numeric(5, 2) check (weight_kg between 20 and 400),
  waist_cm    numeric(4, 1) check (waist_cm between 30 and 300),
  notes       text check (char_length(notes) <= 500),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (weight_kg is not null or waist_cm is not null)
);

create index body_measurements_user_date_idx on public.body_measurements (user_id, local_date);

-- ---------------------------------------------------------------------------
-- AI Coach conversations
-- ---------------------------------------------------------------------------

create table public.ai_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text check (char_length(title) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index ai_conversations_user_updated_idx on public.ai_conversations (user_id, updated_at desc);

create table public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null check (char_length(content) between 1 and 20000),
  provider        text,
  model           text,
  created_at      timestamptz not null default now(),
  foreign key (conversation_id, user_id)
    references public.ai_conversations (id, user_id) on delete cascade
);

create index ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);

-- Keeps ai_conversations.updated_at in sync so the list sorts by last activity.
create or replace function public.touch_ai_conversation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.ai_conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

create trigger ai_messages_touch_conversation
  after insert on public.ai_messages
  for each row execute function public.touch_ai_conversation();

-- ---------------------------------------------------------------------------
-- ai_daily_insights: at most one short AI insight per user, day and language,
-- generated on first view and reused for the rest of the day.
-- ---------------------------------------------------------------------------

create table public.ai_daily_insights (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  locale     text not null check (locale in ('en', 'ru')),
  title      text not null check (char_length(title) between 1 and 120),
  body       text not null check (char_length(body) between 1 and 600),
  provider   text,
  model      text,
  created_at timestamptz not null default now(),
  unique (user_id, local_date, locale)
);

-- ---------------------------------------------------------------------------
-- ai_usage (rate limits, cost tracking). Users may insert and read their own
-- rows but never update or delete them, so quotas cannot be reset.
-- ---------------------------------------------------------------------------

create table public.ai_usage (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  feature       text not null check (feature in ('food_parse', 'coach', 'daily_insight')),
  provider      text not null,
  model         text not null,
  input_tokens  integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  latency_ms    integer check (latency_ms >= 0),
  status        text not null
                check (status in ('ok', 'provider_error', 'invalid_response', 'timeout', 'rate_limited')),
  created_at    timestamptz not null default now()
);

create index ai_usage_user_feature_idx on public.ai_usage (user_id, feature, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'user_goals', 'food_items', 'meals', 'meal_items', 'activities',
    'workouts', 'exercises', 'workout_sets', 'body_measurements', 'ai_conversations'
  ] loop
    execute format(
      'create trigger %I before update on public.%I
         for each row execute function public.set_updated_at()',
      t || '_set_updated_at', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles          enable row level security;
alter table public.user_goals        enable row level security;
alter table public.food_items        enable row level security;
alter table public.meals             enable row level security;
alter table public.meal_items        enable row level security;
alter table public.activities        enable row level security;
alter table public.workouts          enable row level security;
alter table public.exercises         enable row level security;
alter table public.workout_sets      enable row level security;
alter table public.body_measurements enable row level security;
alter table public.ai_conversations  enable row level security;
alter table public.ai_messages       enable row level security;
alter table public.ai_daily_insights enable row level security;
alter table public.ai_usage          enable row level security;

-- profiles: read/update own row only. Insert happens via the sign-up trigger;
-- delete happens by cascading from auth.users.
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Standard owner policy: full access to rows where user_id = auth.uid().
do $$
declare
  t text;
begin
  foreach t in array array[
    'user_goals', 'food_items', 'meals', 'meal_items', 'activities', 'workouts',
    'exercises', 'workout_sets', 'body_measurements', 'ai_conversations', 'ai_messages',
    'ai_daily_insights'
  ] loop
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t || '_owner_all', t);
  end loop;
end;
$$;

-- ai_usage: insert + read own rows only (no update/delete policy).
create policy ai_usage_select_own on public.ai_usage
  for select to authenticated using (user_id = (select auth.uid()));
create policy ai_usage_insert_own on public.ai_usage
  for insert to authenticated with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Privileges (defence in depth on top of RLS)
-- ---------------------------------------------------------------------------

-- The anonymous role never touches app data.
revoke all on
  public.profiles, public.user_goals, public.food_items, public.meals, public.meal_items,
  public.activities, public.workouts, public.exercises, public.workout_sets,
  public.body_measurements, public.ai_conversations, public.ai_messages, public.ai_usage,
  public.ai_daily_insights, public.daily_nutrition
from anon;

-- Profiles are created by trigger and deleted by cascade only.
revoke insert, delete on public.profiles from authenticated;

-- Usage log is append-only for users.
revoke update, delete, truncate on public.ai_usage from authenticated;
