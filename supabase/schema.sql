-- Ejecutar una vez en Supabase: SQL Editor > New query.
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 70),
  muscle_group text not null,
  real_rm numeric(7,2) check (real_rm >= 0),
  real_rm_date date,
  created_at timestamptz not null default now()
);
create table public.sets (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  weight numeric(7,2) not null default 0 check (weight >= 0),
  reps integer not null default 1 check (reps > 0),
  created_at timestamptz not null default now()
);
create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.workouts add column notes text check (char_length(notes) <= 500);
create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  set_number integer not null check (set_number > 0),
  weight numeric(7,2) not null check (weight >= 0),
  reps integer not null check (reps > 0),
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  unique (workout_id, exercise_id, set_number)
);
create table public.routines (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, name text not null check (char_length(name) between 1 and 80), created_at timestamptz not null default now());
create table public.routine_items (id uuid primary key default gen_random_uuid(), routine_id uuid not null references public.routines(id) on delete cascade, exercise_id uuid not null references public.exercises(id) on delete restrict, position integer not null, blocks jsonb not null default '[]'::jsonb);
alter table public.exercises enable row level security;
alter table public.sets enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_sets enable row level security;
alter table public.routines enable row level security; alter table public.routine_items enable row level security;
create policy "Usuarios gestionan sus ejercicios" on public.exercises for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Usuarios gestionan sus series" on public.sets for all using (exists (select 1 from public.exercises where exercises.id = sets.exercise_id and exercises.user_id = auth.uid())) with check (exists (select 1 from public.exercises where exercises.id = sets.exercise_id and exercises.user_id = auth.uid()));
create policy "Usuarios gestionan sus entrenamientos" on public.workouts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Usuarios gestionan sus series de entrenamiento" on public.workout_sets for all using (exists (select 1 from public.workouts where workouts.id = workout_sets.workout_id and workouts.user_id = auth.uid())) with check (exists (select 1 from public.workouts where workouts.id = workout_sets.workout_id and workouts.user_id = auth.uid()) and exists (select 1 from public.exercises where exercises.id = workout_sets.exercise_id and exercises.user_id = auth.uid()));
create policy "Usuarios gestionan sus rutinas" on public.routines for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Usuarios gestionan items de rutinas" on public.routine_items for all using (exists (select 1 from public.routines where routines.id = routine_items.routine_id and routines.user_id = auth.uid())) with check (exists (select 1 from public.routines where routines.id = routine_items.routine_id and routines.user_id = auth.uid()));

-- Da acceso a la Data API únicamente a usuarios que hayan iniciado sesión.
-- RLS, activado arriba, sigue limitando cada fila a su dueño.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.exercises to authenticated;
grant select, insert, update, delete on public.sets to authenticated;
grant select, insert, update, delete on public.workouts to authenticated;
grant select, insert, update, delete on public.workout_sets to authenticated;
grant select, insert, update, delete on public.routines to authenticated; grant select, insert, update, delete on public.routine_items to authenticated;

create or replace function public.replace_workout_sets(
  p_workout_id uuid,
  p_sets jsonb,
  p_created_at timestamptz default null,
  p_notes text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.workouts where id = p_workout_id and user_id = auth.uid()) then
    raise exception 'No tenés permiso para modificar este entrenamiento';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_sets) as incoming(exercise_id uuid, set_number integer, weight numeric, reps integer, completed boolean)
    left join public.exercises on exercises.id = incoming.exercise_id
    where exercises.user_id is distinct from auth.uid()
  ) then
    raise exception 'Uno o más ejercicios no te pertenecen';
  end if;
  if p_created_at is not null then
    update public.workouts set created_at = p_created_at, notes = p_notes where id = p_workout_id;
  end if;
  delete from public.workout_sets where workout_id = p_workout_id;
  insert into public.workout_sets (workout_id, exercise_id, set_number, weight, reps, completed)
  select p_workout_id, exercise_id, set_number, weight, reps, completed
  from jsonb_to_recordset(p_sets) as sets(exercise_id uuid, set_number integer, weight numeric, reps integer, completed boolean);
end;
$$;
grant execute on function public.replace_workout_sets(uuid, jsonb, timestamptz, text) to authenticated;

create or replace function public.replace_routine_items(p_routine_id uuid, p_name text, p_items jsonb)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if not exists (select 1 from public.routines where id = p_routine_id and user_id = auth.uid()) then
    raise exception 'No tenés permiso para modificar esta rutina';
  end if;
  update public.routines set name = p_name where id = p_routine_id;
  delete from public.routine_items where routine_id = p_routine_id;
  insert into public.routine_items (routine_id, exercise_id, position, blocks)
  select p_routine_id, exercise_id, position, blocks
  from jsonb_to_recordset(p_items) as items(exercise_id uuid, position integer, blocks jsonb);
end;
$$;
grant execute on function public.replace_routine_items(uuid, text, jsonb) to authenticated;
