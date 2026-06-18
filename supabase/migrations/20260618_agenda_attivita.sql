create table public.agenda_attivita (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  titolo text not null,
  descrizione text not null default '',
  data date not null,
  ora_inizio time not null,
  ora_fine time not null,
  tipo text not null,
  stato text not null default 'da_fare',
  checklist jsonb not null default '[]'::jsonb,
  collegamento jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agenda_attivita_orario_valido check (ora_fine >= ora_inizio),
  constraint agenda_attivita_stato_valido
    check (stato in ('da_fare', 'completata'))
);

create index agenda_attivita_user_data_ora_idx
  on public.agenda_attivita (user_id, data, ora_inizio);

alter table public.agenda_attivita enable row level security;

create policy "agenda_attivita_select_proprie"
  on public.agenda_attivita
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "agenda_attivita_insert_proprie"
  on public.agenda_attivita
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "agenda_attivita_update_proprie"
  on public.agenda_attivita
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "agenda_attivita_delete_proprie"
  on public.agenda_attivita
  for delete
  to authenticated
  using (auth.uid() = user_id);
