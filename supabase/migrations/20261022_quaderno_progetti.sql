-- Additiva: nessuna modifica a note_sopralluogo, note_allegati o dati esistenti.
begin;

create table public.quaderno_progetti (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  titolo text not null default '',
  testo text not null default '',
  checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array'),
  disegni jsonb not null default '[]'::jsonb check (jsonb_typeof(disegni) = 'array'),
  analisi_ai jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create index quaderno_progetti_archivio_idx on public.quaderno_progetti (user_id, updated_at desc);

create table public.quaderno_allegati (
  id uuid primary key default gen_random_uuid(),
  nota_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome_file text not null,
  tipo text not null check (tipo in ('foto', 'allegato', 'audio')),
  mime_type text,
  storage_path text not null,
  storage_bucket text not null default 'quaderno-privato' check (storage_bucket = 'quaderno-privato'),
  url text check (url is null),
  created_at timestamptz not null default now(),
  foreign key (nota_id, user_id) references public.quaderno_progetti(id, user_id) on delete cascade
);
create index quaderno_allegati_progetto_idx on public.quaderno_allegati (nota_id);

alter table public.quaderno_progetti enable row level security;
alter table public.quaderno_allegati enable row level security;
revoke all on public.quaderno_progetti, public.quaderno_allegati from public, anon;
grant select, insert, update, delete on public.quaderno_progetti, public.quaderno_allegati to authenticated;
create policy quaderno_progetti_propri on public.quaderno_progetti to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy quaderno_allegati_propri on public.quaderno_allegati to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Bucket dedicato: nessuna modifica a preventivi o ai suoi URL.
insert into storage.buckets (id, name, public)
values ('quaderno-privato', 'quaderno-privato', false);

-- Funzione predicato: nessun dato esposto, evita di concedere SELECT anon
-- sulle tabelle dei progetti quando Storage valuta la policy restrittiva.
create function public.quaderno_file_autorizzato(object_name text)
returns boolean language sql stable security definer
set search_path = pg_catalog, pg_temp
as $$
  select auth.uid() is not null
    and (storage.foldername(object_name))[1] = 'utenti'
    and (storage.foldername(object_name))[2] = auth.uid()::text
    and (storage.foldername(object_name))[3] = 'quaderni'
    and exists (select 1 from public.quaderno_progetti p
      where p.id::text = (storage.foldername(object_name))[4]
        and p.user_id = auth.uid());
$$;
revoke all on function public.quaderno_file_autorizzato(text) from public;
grant execute on function public.quaderno_file_autorizzato(text) to anon, authenticated;

create policy quaderno_file_propri on storage.objects
  for all to authenticated
  using (bucket_id = 'quaderno-privato' and public.quaderno_file_autorizzato(name))
  with check (bucket_id = 'quaderno-privato' and public.quaderno_file_autorizzato(name));
-- AND con tutte le policy permissive: non altera gli altri bucket.
create policy quaderno_file_confine on storage.objects as restrictive
  for all to public
  using (bucket_id <> 'quaderno-privato' or public.quaderno_file_autorizzato(name))
  with check (bucket_id <> 'quaderno-privato' or public.quaderno_file_autorizzato(name));
commit;
