-- FitBalance — save_meal(payload jsonb)
--
-- Creates or replaces a meal and all of its items in one transaction, and
-- keeps "My foods" up to date. Runs as SECURITY INVOKER, so the caller's RLS
-- policies and the composite foreign keys still decide what may be written:
-- a meal can only be written for auth.uid(), and an item can only point at
-- the caller's own food_items row.
--
-- Payload (validated by the API first; table constraints are the last word):
-- {
--   "id": null | "<meal uuid>",          -- null creates, a uuid replaces
--   "local_date": "2026-11-08",
--   "logged_at": "2026-11-08T08:15:00+01:00" | null,   -- null: now() / unchanged
--   "meal_type": "breakfast" | "lunch" | "dinner" | "snack",
--   "input_method": "manual" | "ai",
--   "ai_description": null | "...",
--   "notes": null | "...",
--   "items": [ {                           -- 1..30 items, saved in this order
--     "name": "Oatmeal", "quantity": 1, "unit": "bowl", "grams": 250,
--     "kcal_per_100g": 71, "protein_per_100g": 2.5, "carbs_per_100g": 12,
--     "fat_per_100g": 1.5, "fibre_per_100g": 1.7,
--     "estimate_source": "my_food", "confidence": null, "notes": null,
--     "food_item_id": null | "<food uuid>",
--     "save_to_my_foods": false
--   } ]
-- }
--
-- My foods:
--   * save_to_my_foods = true upserts the food by name + brand (case-insensitive),
--     links the item to it, and counts the use. Values the user typed
--     (source 'user') are never overwritten by AI estimates.
--   * otherwise a given food_item_id only has its use count bumped.
--
-- Returns the meal id. Errors: 22023 (bad item count), P0002 (meal to replace
-- not found or not the caller's), plus any constraint violation.

create or replace function public.save_meal(payload jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user     uuid := auth.uid();
  v_meal_id  uuid := nullif(payload ->> 'id', '')::uuid;
  v_item     jsonb;
  v_position integer;
  v_food_id  uuid;
  v_source   text;
begin
  if v_user is null then
    raise exception 'save_meal requires a signed-in user' using errcode = '42501';
  end if;

  if jsonb_typeof(payload -> 'items') is distinct from 'array'
     or jsonb_array_length(payload -> 'items') not between 1 and 30 then
    raise exception 'a meal needs between 1 and 30 items' using errcode = '22023';
  end if;

  if v_meal_id is null then
    insert into public.meals
      (user_id, local_date, logged_at, meal_type, input_method, ai_description, notes)
    values (
      v_user,
      (payload ->> 'local_date')::date,
      coalesce((payload ->> 'logged_at')::timestamptz, now()),
      payload ->> 'meal_type',
      payload ->> 'input_method',
      payload ->> 'ai_description',
      payload ->> 'notes'
    )
    returning id into v_meal_id;
  else
    update public.meals set
      local_date     = (payload ->> 'local_date')::date,
      logged_at      = coalesce((payload ->> 'logged_at')::timestamptz, logged_at),
      meal_type      = payload ->> 'meal_type',
      input_method   = payload ->> 'input_method',
      ai_description = payload ->> 'ai_description',
      notes          = payload ->> 'notes'
    where id = v_meal_id and user_id = v_user;

    if not found then
      raise exception 'meal not found' using errcode = 'P0002';
    end if;

    delete from public.meal_items where meal_id = v_meal_id and user_id = v_user;
  end if;

  for v_item, v_position in
    select value, ordinality - 1 from jsonb_array_elements(payload -> 'items') with ordinality
  loop
    v_food_id := nullif(v_item ->> 'food_item_id', '')::uuid;

    if coalesce((v_item ->> 'save_to_my_foods')::boolean, false) then
      v_source := case
        when v_item ->> 'estimate_source' in ('ai_estimate', 'ai_edited') then 'ai_estimate'
        else 'user'
      end;

      insert into public.food_items as f
        (user_id, name, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
         fibre_per_100g, source, use_count, last_used_at)
      values (
        v_user,
        btrim(v_item ->> 'name'),
        (v_item ->> 'kcal_per_100g')::numeric,
        (v_item ->> 'protein_per_100g')::numeric,
        (v_item ->> 'carbs_per_100g')::numeric,
        (v_item ->> 'fat_per_100g')::numeric,
        (v_item ->> 'fibre_per_100g')::numeric,
        v_source,
        1,
        now()
      )
      on conflict (user_id, lower(btrim(name)), lower(coalesce(brand, ''))) do update set
        kcal_per_100g    = case when f.source = 'ai_estimate' or excluded.source = 'user'
                                then excluded.kcal_per_100g    else f.kcal_per_100g end,
        protein_per_100g = case when f.source = 'ai_estimate' or excluded.source = 'user'
                                then excluded.protein_per_100g else f.protein_per_100g end,
        carbs_per_100g   = case when f.source = 'ai_estimate' or excluded.source = 'user'
                                then excluded.carbs_per_100g   else f.carbs_per_100g end,
        fat_per_100g     = case when f.source = 'ai_estimate' or excluded.source = 'user'
                                then excluded.fat_per_100g     else f.fat_per_100g end,
        fibre_per_100g   = case when f.source = 'ai_estimate' or excluded.source = 'user'
                                then excluded.fibre_per_100g   else f.fibre_per_100g end,
        source           = case when excluded.source = 'user' then 'user' else f.source end,
        use_count        = f.use_count + 1,
        last_used_at     = now()
      returning id into v_food_id;
    elsif v_food_id is not null then
      update public.food_items
         set use_count = use_count + 1, last_used_at = now()
       where id = v_food_id and user_id = v_user;
    end if;

    insert into public.meal_items
      (meal_id, user_id, food_item_id, position, name, quantity, unit, grams,
       kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fibre_per_100g,
       estimate_source, confidence, notes)
    values (
      v_meal_id,
      v_user,
      v_food_id,
      v_position,
      btrim(v_item ->> 'name'),
      (v_item ->> 'quantity')::numeric,
      v_item ->> 'unit',
      (v_item ->> 'grams')::numeric,
      (v_item ->> 'kcal_per_100g')::numeric,
      (v_item ->> 'protein_per_100g')::numeric,
      (v_item ->> 'carbs_per_100g')::numeric,
      (v_item ->> 'fat_per_100g')::numeric,
      (v_item ->> 'fibre_per_100g')::numeric,
      v_item ->> 'estimate_source',
      (v_item ->> 'confidence')::numeric,
      v_item ->> 'notes'
    );
  end loop;

  return v_meal_id;
end;
$$;

comment on function public.save_meal(jsonb) is
  'Create (id null) or replace a meal and its items atomically; upserts My foods. SECURITY INVOKER: RLS applies.';

-- Functions are executable by PUBLIC by default; only signed-in users may call this.
revoke all on function public.save_meal(jsonb) from public, anon;
grant execute on function public.save_meal(jsonb) to authenticated, service_role;
