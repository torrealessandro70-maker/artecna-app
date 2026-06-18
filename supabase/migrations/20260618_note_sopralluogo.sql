create extension if not exists pgcrypto;

create table if not exists public.note_sopralluogo (
  id uuid primary key default gen_random_uuid(),
  sopralluogo_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  titolo text not null default '',
  testo text not null default '',
  checklist jsonb not null default '[]'::jsonb,
  disegni jsonb not null default '[]'::jsonb,
  analisi_ai jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, sopralluogo_id)
);

create table if not exists public.note_allegati (
  id uuid primary key default gen_random_uuid(),
  nota_id uuid not null references public.note_sopralluogo(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome_file text not null,
  tipo text not null check (tipo in ('foto', 'allegato', 'audio')),
  mime_type text,
  storage_path text not null,
  url text not null,
  created_at timestamptz not null default now()
);

alter table public.note_sopralluogo enable row level security;
alter table public.note_allegati enable row level security;

create policy "note proprie" on public.note_sopralluogo
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "allegati note propri" on public.note_allegati
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists note_sopralluogo_sopralluogo_idx
  on public.note_sopralluogo (sopralluogo_id);

create index if not exists note_allegati_nota_idx
  on public.note_allegati (nota_id);
