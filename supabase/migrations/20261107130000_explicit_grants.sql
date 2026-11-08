-- FitBalance — explicit table privileges
--
-- Newer Supabase projects no longer grant SELECT/INSERT/UPDATE/DELETE on new
-- public tables to the API roles by default (they only get TRUNCATE,
-- REFERENCES, TRIGGER and MAINTAIN). This migration states every privilege
-- explicitly instead of relying on project defaults. RLS policies from the
-- init migration still decide which rows each user can touch.
--
-- Every future migration that adds a table or view must grant its privileges
-- the same way.

-- Start from nothing for the API roles.
revoke all on
  public.profiles, public.user_goals, public.food_items, public.meals, public.meal_items,
  public.activities, public.workouts, public.exercises, public.workout_sets,
  public.body_measurements, public.ai_conversations, public.ai_messages, public.ai_usage,
  public.ai_daily_insights, public.daily_nutrition
from anon, authenticated, service_role;

-- Signed-in users: full CRUD on their own rows (enforced by RLS).
grant select, insert, update, delete on
  public.user_goals, public.food_items, public.meals, public.meal_items,
  public.activities, public.workouts, public.exercises, public.workout_sets,
  public.body_measurements, public.ai_conversations, public.ai_messages,
  public.ai_daily_insights
to authenticated;

-- Profiles are created by the sign-up trigger and deleted by cascade only.
grant select, update on public.profiles to authenticated;

-- Usage log is append-only for users.
grant select, insert on public.ai_usage to authenticated;

-- Read-only view; security_invoker applies the caller's RLS.
grant select on public.daily_nutrition to authenticated;

-- Server-only secret key (bypasses RLS). Used for account deletion and admin
-- maintenance; never exposed to the browser.
grant select, insert, update, delete on
  public.profiles, public.user_goals, public.food_items, public.meals, public.meal_items,
  public.activities, public.workouts, public.exercises, public.workout_sets,
  public.body_measurements, public.ai_conversations, public.ai_messages, public.ai_usage,
  public.ai_daily_insights
to service_role;
grant select on public.daily_nutrition to service_role;

-- anon keeps no privileges on any app table or view.
