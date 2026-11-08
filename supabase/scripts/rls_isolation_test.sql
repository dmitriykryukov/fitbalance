-- FitBalance — RLS isolation test (two users)
--
-- Creates two throwaway users, writes data as user A, then proves that user B
-- and the anonymous role can neither read nor modify it. Everything runs inside
-- one transaction that is ROLLED BACK, so no data is left behind.
--
-- Run it either way:
--   * Supabase Dashboard -> SQL Editor -> paste this file -> Run
--   * psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/scripts/rls_isolation_test.sql
--
-- Pass: the last result is "ALL RLS TESTS PASSED".
-- Fail: the script stops with an error whose message starts with "FAIL:".

begin;

-- ---------------------------------------------------------------------------
-- Setup (as the database owner)
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'rls-user-a@fitbalance.test', '{"locale": "ru"}'),
  ('22222222-2222-2222-2222-222222222222', 'rls-user-b@fitbalance.test', '{}');

do $$
begin
  if (select locale from public.profiles where id = '11111111-1111-1111-1111-111111111111') is distinct from 'ru' then
    raise exception 'FAIL: sign-up trigger did not create profile A with locale ru';
  end if;
  if (select locale from public.profiles where id = '22222222-2222-2222-2222-222222222222') is distinct from 'en' then
    raise exception 'FAIL: sign-up trigger did not create profile B with default locale en';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- User A writes one row into every table
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims',
  '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}', true);
set local role authenticated;

update public.profiles
   set display_name = 'User A', height_cm = 180, timezone = 'America/Toronto'
 where id = '11111111-1111-1111-1111-111111111111';

insert into public.user_goals (user_id, effective_from, calories_kcal, protein_g)
values ('11111111-1111-1111-1111-111111111111', '2026-11-01', 2200, 140);

insert into public.food_items (id, user_id, name, kcal_per_100g, protein_per_100g,
                               carbs_per_100g, fat_per_100g, source)
values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
        'Egg', 143, 12.6, 0.7, 9.5, 'ai_estimate');

insert into public.meals (id, user_id, local_date, meal_type, input_method, ai_description)
values ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
        '2026-11-07', 'breakfast', 'ai', 'Two eggs and smoked salmon');

insert into public.meal_items (meal_id, user_id, food_item_id, name, quantity, unit, grams,
                               kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
                               estimate_source)
values
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'aaaaaaaa-0000-0000-0000-000000000001', 'Egg', 2, 'piece', 100, 143, 12.6, 0.7, 9.5, 'my_food'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   null, 'Smoked salmon', null, 'g', 50, 117, 18.3, 0, 4.3, 'ai_estimate');

insert into public.activities (user_id, activity_type, local_date, duration_seconds, distance_meters)
values ('11111111-1111-1111-1111-111111111111', 'walking', '2026-11-07', 2400, 3200);

insert into public.workouts (id, user_id, title, local_date, duration_seconds)
values ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
        'Back and chest', '2026-11-07', 3600);

insert into public.exercises (id, user_id, name, muscle_group)
values ('aaaaaaaa-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111',
        'Dumbbell bench press', 'chest');

insert into public.workout_sets (workout_id, user_id, exercise_id, exercise_name,
                                 exercise_order, set_number, reps, weight_kg)
values ('aaaaaaaa-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-0000-0000-0000-000000000004', 'Dumbbell bench press', 0, 1, 10, 20);

insert into public.body_measurements (user_id, local_date, weight_kg, waist_cm)
values ('11111111-1111-1111-1111-111111111111', '2026-11-07', 82.4, 88);

insert into public.ai_conversations (id, user_id, title)
values ('aaaaaaaa-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111', 'Week review');

insert into public.ai_messages (conversation_id, user_id, role, content)
values ('aaaaaaaa-0000-0000-0000-000000000005', '11111111-1111-1111-1111-111111111111',
        'user', 'How was my nutrition this week?');

insert into public.ai_usage (user_id, feature, provider, model, status)
values ('11111111-1111-1111-1111-111111111111', 'food_parse', 'anthropic', 'test-model', 'ok');

insert into public.ai_daily_insights (user_id, local_date, locale, title, body)
values ('11111111-1111-1111-1111-111111111111', '2026-11-07', 'ru', 'Белок в норме', 'Добавьте овощи к ужину.');

-- A sees own data, and the database calculated the nutrition correctly.
do $$
declare
  r record;
begin
  select * into r from public.daily_nutrition where local_date = '2026-11-07';
  -- egg: 143*100/100 = 143.0 ; salmon: 117*50/100 = 58.5  -> 201.5 kcal
  -- protein: 12.6 + round(9.15, 1) = 12.6 + 9.2 = 21.8 g
  if r.kcal is distinct from 201.5 or r.protein_g is distinct from 21.8
     or r.meal_count <> 1 or r.item_count <> 2 or r.has_ai_estimates is not true then
    raise exception 'FAIL: daily_nutrition for A is wrong: %', row_to_json(r);
  end if;

  if (select average_speed_kmh from public.activities) is distinct from 4.80 then
    raise exception 'FAIL: average_speed_kmh should be 4.80 (3200 m / 2400 s)';
  end if;

  if (select count(*) from public.profiles) <> 1 then
    raise exception 'FAIL: user A can see more than their own profile';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- User B: cannot read, change, delete, or attach to user A's data
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims',
  '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}', true);
set local role authenticated;

do $$
declare
  t text;
  n bigint;
begin
  -- 1. Reads return nothing
  foreach t in array array[
    'user_goals', 'food_items', 'meals', 'meal_items', 'activities', 'workouts', 'exercises',
    'workout_sets', 'body_measurements', 'ai_conversations', 'ai_messages', 'ai_usage',
    'ai_daily_insights', 'daily_nutrition'
  ] loop
    execute format('select count(*) from public.%I', t) into n;
    if n <> 0 then
      raise exception 'FAIL: user B can read % row(s) of user A in %', n, t;
    end if;
  end loop;

  select count(*) into n from public.profiles;
  if n <> 1 or not exists (select 1 from public.profiles where id = '22222222-2222-2222-2222-222222222222') then
    raise exception 'FAIL: user B should see exactly their own profile';
  end if;

  -- 2. Updates and deletes affect zero rows
  update public.profiles set display_name = 'hacked' where id = '11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: user B updated profile A'; end if;

  update public.meals set notes = 'hacked' where id = 'aaaaaaaa-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: user B updated a meal of user A'; end if;

  delete from public.meals where id = 'aaaaaaaa-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: user B deleted a meal of user A'; end if;

  delete from public.workouts where id = 'aaaaaaaa-0000-0000-0000-000000000003';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAIL: user B deleted a workout of user A'; end if;

  -- 3. Writing rows that claim to belong to A is rejected by RLS
  begin
    insert into public.meals (user_id, local_date, meal_type, input_method)
    values ('11111111-1111-1111-1111-111111111111', '2026-11-07', 'lunch', 'manual');
    raise exception 'FAIL: user B inserted a meal owned by user A';
  exception when insufficient_privilege then null;
  end;

  -- 4. Attaching own rows to A's parents is rejected by the composite FKs
  begin
    insert into public.meal_items (meal_id, user_id, name, grams, kcal_per_100g, protein_per_100g,
                                   carbs_per_100g, fat_per_100g, estimate_source)
    values ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222',
            'Injected', 100, 100, 1, 1, 1, 'user_entered');
    raise exception 'FAIL: user B attached an item to a meal of user A';
  exception when foreign_key_violation then null;
  end;

  begin
    insert into public.workout_sets (workout_id, user_id, exercise_name, exercise_order, set_number, reps)
    values ('aaaaaaaa-0000-0000-0000-000000000003', '22222222-2222-2222-2222-222222222222',
            'Injected', 0, 2, 5);
    raise exception 'FAIL: user B attached a set to a workout of user A';
  exception when foreign_key_violation then null;
  end;

  begin
    insert into public.ai_messages (conversation_id, user_id, role, content)
    values ('aaaaaaaa-0000-0000-0000-000000000005', '22222222-2222-2222-2222-222222222222',
            'user', 'Injected');
    raise exception 'FAIL: user B posted into a conversation of user A';
  exception when foreign_key_violation then null;
  end;

  -- 5. Users cannot create or delete profiles directly
  begin
    insert into public.profiles (id) values ('33333333-3333-3333-3333-333333333333');
    raise exception 'FAIL: user B inserted a profile directly';
  exception when insufficient_privilege then null;
  end;

  -- 6. ai_usage is append-only: own insert works, delete/update are denied
  insert into public.ai_usage (user_id, feature, provider, model, status)
  values ('22222222-2222-2222-2222-222222222222', 'coach', 'anthropic', 'test-model', 'ok');

  begin
    delete from public.ai_usage;
    raise exception 'FAIL: user B could delete ai_usage rows (quota reset)';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.ai_usage set status = 'ok';
    raise exception 'FAIL: user B could update ai_usage rows';
  exception when insufficient_privilege then null;
  end;

  -- 7. Active calories need a source, and vice versa
  begin
    insert into public.activities (user_id, activity_type, local_date, duration_seconds, estimated_kcal_burned)
    values ('22222222-2222-2222-2222-222222222222', 'running', '2026-11-07', 1800, 300);
    raise exception 'FAIL: activity kcal accepted without kcal_source';
  exception when check_violation then null;
  end;

  -- 8. Invalid timezone is rejected
  begin
    update public.profiles set timezone = 'Mars/Olympus_Mons'
     where id = '22222222-2222-2222-2222-222222222222';
    raise exception 'FAIL: invalid timezone was accepted';
  exception when invalid_parameter_value then null;
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Anonymous role: no access at all
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;

do $$
declare
  t text;
begin
  foreach t in array array['profiles', 'meals', 'meal_items', 'ai_messages', 'daily_nutrition'] loop
    begin
      execute format('select count(*) from public.%I', t);
      raise exception 'FAIL: anon can query %', t;
    exception when insufficient_privilege then null;
    end;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Deleting the auth user removes all of their data (account deletion)
-- ---------------------------------------------------------------------------

reset role;

delete from auth.users where id = '11111111-1111-1111-1111-111111111111';

do $$
declare
  t text;
  n bigint;
begin
  foreach t in array array[
    'profiles', 'user_goals', 'food_items', 'meals', 'meal_items', 'activities', 'workouts',
    'exercises', 'workout_sets', 'body_measurements', 'ai_conversations', 'ai_messages', 'ai_usage',
    'ai_daily_insights'
  ] loop
    execute format('select count(*) from public.%I where %I = %L', t,
                   case when t = 'profiles' then 'id' else 'user_id' end,
                   '11111111-1111-1111-1111-111111111111') into n;
    if n <> 0 then
      raise exception 'FAIL: % row(s) of deleted user remain in %', n, t;
    end if;
  end loop;
end;
$$;

-- TRUNCATE skips RLS, so no API role may hold it (or other non-DML privileges).
do $$
declare
  r record;
begin
  for r in
    select grantee, table_name, privilege_type
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee in ('anon', 'authenticated', 'service_role')
      and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES')
  loop
    raise exception 'FAIL: % has % on %', r.grantee, r.privilege_type, r.table_name;
  end loop;
  if has_table_privilege('anon', 'public.meals', 'SELECT') then
    raise exception 'FAIL: anon can select meals';
  end if;
end;
$$;

rollback;

select 'ALL RLS TESTS PASSED' as result;
