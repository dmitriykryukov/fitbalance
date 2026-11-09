-- FitBalance — save_workout(payload jsonb)
--
-- Creates or replaces a strength workout and all of its sets in one
-- transaction, and adds new exercise names to the user's exercise list.
-- Runs as SECURITY INVOKER, so the caller's RLS policies and the composite
-- foreign keys still decide what may be written: a workout can only be
-- written for auth.uid(), and a set can only point at the caller's own
-- exercises row.
--
-- Payload (validated by the API first; table constraints are the last word):
-- {
--   "id": null | "<workout uuid>",        -- null creates, a uuid replaces
--   "title": "Upper body",
--   "local_date": "2026-11-09",
--   "started_at": "2026-11-09T18:15:00+01:00" | null,
--   "duration_seconds": 2700 | null,
--   "estimated_kcal_burned": 180 | null,  -- set together with kcal_source
--   "kcal_source": "estimated" | "user" | null,
--   "notes": null | "...",
--   "exercises": [ {                      -- 1..30 exercises, saved in this order
--     "name": "Bench press",
--     "exercise_id": null | "<exercise uuid>",
--     "muscle_group": "chest" | null,
--     "equipment": "Barbell" | null,
--     "sets": [ {                         -- 1..50 sets, numbered in this order
--       "reps": 10, "weight_kg": 50, "duration_seconds": null,
--       "distance_meters": null, "notes": null
--     } ]
--   } ]
-- }
--
-- Exercise list: an exercise without exercise_id is upserted by name
-- (case-insensitive). An existing entry keeps its muscle group and equipment
-- unless they were empty.
--
-- Returns the workout id. Errors: 22023 (bad exercise or set count), P0002
-- (workout to replace not found or not the caller's), plus any constraint
-- violation (e.g. 23503 for another user's exercise_id, 23514 for a set
-- without reps, duration or distance).

create or replace function public.save_workout(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user        uuid := auth.uid();
  v_workout_id  uuid := nullif(payload ->> 'id', '')::uuid;
  v_exercise    jsonb;
  v_order       integer;
  v_exercise_id uuid;
  v_set         jsonb;
  v_number      integer;
begin
  if v_user is null then
    raise exception 'save_workout requires a signed-in user' using errcode = '42501';
  end if;

  if jsonb_typeof(payload -> 'exercises') is distinct from 'array'
     or jsonb_array_length(payload -> 'exercises') not between 1 and 30 then
    raise exception 'a workout needs between 1 and 30 exercises' using errcode = '22023';
  end if;

  if exists (
    select 1 from jsonb_array_elements(payload -> 'exercises') e
     where jsonb_typeof(e -> 'sets') is distinct from 'array'
        or jsonb_array_length(e -> 'sets') not between 1 and 50
  ) then
    raise exception 'each exercise needs between 1 and 50 sets' using errcode = '22023';
  end if;

  if v_workout_id is null then
    insert into public.workouts
      (user_id, title, started_at, local_date, duration_seconds,
       estimated_kcal_burned, kcal_source, notes)
    values (
      v_user,
      btrim(payload ->> 'title'),
      (payload ->> 'started_at')::timestamptz,
      (payload ->> 'local_date')::date,
      (payload ->> 'duration_seconds')::integer,
      (payload ->> 'estimated_kcal_burned')::integer,
      payload ->> 'kcal_source',
      payload ->> 'notes'
    )
    returning id into v_workout_id;
  else
    update public.workouts set
      title                 = btrim(payload ->> 'title'),
      started_at            = (payload ->> 'started_at')::timestamptz,
      local_date            = (payload ->> 'local_date')::date,
      duration_seconds      = (payload ->> 'duration_seconds')::integer,
      estimated_kcal_burned = (payload ->> 'estimated_kcal_burned')::integer,
      kcal_source           = payload ->> 'kcal_source',
      notes                 = payload ->> 'notes'
    where id = v_workout_id and user_id = v_user;

    if not found then
      raise exception 'workout not found' using errcode = 'P0002';
    end if;

    delete from public.workout_sets where workout_id = v_workout_id and user_id = v_user;
  end if;

  for v_exercise, v_order in
    select value, ordinality - 1 from jsonb_array_elements(payload -> 'exercises') with ordinality
  loop
    v_exercise_id := nullif(v_exercise ->> 'exercise_id', '')::uuid;

    if v_exercise_id is null then
      insert into public.exercises as x (user_id, name, muscle_group, equipment)
      values (
        v_user,
        btrim(v_exercise ->> 'name'),
        v_exercise ->> 'muscle_group',
        nullif(btrim(v_exercise ->> 'equipment'), '')
      )
      on conflict (user_id, lower(btrim(name))) do update set
        muscle_group = coalesce(x.muscle_group, excluded.muscle_group),
        equipment    = coalesce(x.equipment, excluded.equipment)
      returning id into v_exercise_id;
    end if;

    for v_set, v_number in
      select value, ordinality from jsonb_array_elements(v_exercise -> 'sets') with ordinality
    loop
      insert into public.workout_sets
        (workout_id, user_id, exercise_id, exercise_name, exercise_order, set_number,
         reps, weight_kg, duration_seconds, distance_meters, notes)
      values (
        v_workout_id,
        v_user,
        v_exercise_id,
        btrim(v_exercise ->> 'name'),
        v_order,
        v_number,
        (v_set ->> 'reps')::smallint,
        (v_set ->> 'weight_kg')::numeric,
        (v_set ->> 'duration_seconds')::integer,
        (v_set ->> 'distance_meters')::integer,
        v_set ->> 'notes'
      );
    end loop;
  end loop;

  return v_workout_id;
end;
$$;

comment on function public.save_workout(jsonb) is
  'Create (id null) or replace a strength workout and its sets atomically; adds new exercises. SECURITY INVOKER: RLS applies.';

-- Functions are executable by PUBLIC by default; only signed-in users may call this.
revoke all on function public.save_workout(jsonb) from public, anon;
grant execute on function public.save_workout(jsonb) to authenticated, service_role;
