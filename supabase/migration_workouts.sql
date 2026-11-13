-- Ejecutar en Supabase SQL Editor para activar la nueva vista de entrenamientos.
-- Conserva los ejercicios y datos existentes.

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.workouts add column if not exists notes text check (char_length(notes) <= 500);

alter table public.exercises
  add column if not exists real_rm numeric(7,2) check (real_rm >= 0),
  add column if not exists real_rm_date date;

create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  set_number integer not null check (set_number > 0),
  weight numeric(7,2) not null check (weight >= 0),
  reps integer not null check (reps > 0),
  created_at timestamptz not null default now(),
  unique (workout_id, exercise_id, set_number)
);

alter table public.workout_sets add column if not exists completed boolean not null default true;

create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);
create table if not exists public.routine_items (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  position integer not null,
  blocks jsonb not null default '[]'::jsonb
);

alter table public.workouts enable row level security;
alter table public.workout_sets enable row level security;
alter table public.routines enable row level security;
alter table public.routine_items enable row level security;

drop policy if exists "Usuarios gestionan sus entrenamientos" on public.workouts;
create policy "Usuarios gestionan sus entrenamientos"
  on public.workouts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Usuarios gestionan sus series de entrenamiento" on public.workout_sets;
create policy "Usuarios gestionan sus series de entrenamiento"
  on public.workout_sets for all
  using (exists (
    select 1 from public.workouts
    where workouts.id = workout_sets.workout_id
      and workouts.user_id = auth.uid()
  ))
  with check (
    exists (
      select 1 from public.workouts
      where workouts.id = workout_sets.workout_id
        and workouts.user_id = auth.uid()
    )
    and exists (
      select 1 from public.exercises
      where exercises.id = workout_sets.exercise_id
        and exercises.user_id = auth.uid()
    )
  );

drop policy if exists "Usuarios gestionan sus rutinas" on public.routines;
create policy "Usuarios gestionan sus rutinas" on public.routines for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Usuarios gestionan items de rutinas" on public.routine_items;
create policy "Usuarios gestionan items de rutinas" on public.routine_items for all
  using (exists (select 1 from public.routines where routines.id = routine_items.routine_id and routines.user_id = auth.uid()))
  with check (exists (select 1 from public.routines where routines.id = routine_items.routine_id and routines.user_id = auth.uid()));

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.workouts to authenticated;
grant select, insert, update, delete on public.workout_sets to authenticated;
grant select, insert, update, delete on public.routines to authenticated;
grant select, insert, update, delete on public.routine_items to authenticated;

-- Reemplaza todas las series de un entrenamiento en una única transacción.
-- Evita que una edición quede a medias si se corta la conexión.
create or replace function public.replace_workout_sets(
  p_workout_id uuid,
  p_sets jsonb,
  p_created_at timestamptz default null,
  p_notes text default null
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.workouts
    where id = p_workout_id and user_id = auth.uid()
  ) then
    raise exception 'No tenés permiso para modificar este entrenamiento';
  end if;

  if p_created_at is not null then
    update public.workouts set created_at = p_created_at, notes = p_notes where id = p_workout_id;
  end if;

  delete from public.workout_sets where workout_id = p_workout_id;

  insert into public.workout_sets (workout_id, exercise_id, set_number, weight, reps, completed)
  select p_workout_id, exercise_id, set_number, weight, reps, completed
  from jsonb_to_recordset(p_sets) as sets(
    exercise_id uuid,
    set_number integer,
    weight numeric,
    reps integer,
    completed boolean
  );
end;
$$;

grant execute on function public.replace_workout_sets(uuid, jsonb, timestamptz, text) to authenticated;

-- Actualiza una rutina y sus ejercicios en una única transacción.
create or replace function public.replace_routine_items(
  p_routine_id uuid,
  p_name text,
  p_items jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.routines
    where id = p_routine_id and user_id = auth.uid()
  ) then
    raise exception 'No tenés permiso para modificar esta rutina';
  end if;

  update public.routines set name = p_name where id = p_routine_id;
  delete from public.routine_items where routine_id = p_routine_id;

  insert into public.routine_items (routine_id, exercise_id, position, blocks)
  select p_routine_id, exercise_id, position, blocks
  from jsonb_to_recordset(p_items) as items(
    exercise_id uuid,
    position integer,
    blocks jsonb
  );
end;
$$;

grant execute on function public.replace_routine_items(uuid, text, jsonb) to authenticated;
