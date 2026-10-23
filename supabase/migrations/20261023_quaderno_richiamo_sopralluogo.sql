begin;
-- La nota legacy resta unica per (user_id,sopralluogo_id). Nessuna FK alla
-- sorgente: la sua cancellazione non cancella il richiamo o i file copiati.
create table public.quaderno_richiami_sopralluogo (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  sopralluogo_id text not null, nota_id uuid references public.note_sopralluogo(id) on delete cascade,
  sorgente_id uuid not null, sorgente_titolo text not null, sorgente_updated_at timestamptz not null,
  richiamato_at timestamptz not null default now(), nota_updated_at timestamptz,
  stato text not null default 'preparazione' check (stato in ('preparazione','completato')),
  check ((stato = 'preparazione' and nota_id is null) or (stato = 'completato' and nota_id is not null))
);
create table public.quaderno_copie_allegati (
  id uuid primary key, richiamo_id uuid not null references public.quaderno_richiami_sopralluogo(id) on delete cascade,
  nota_id uuid not null references public.note_sopralluogo(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, nome_file text not null,
  tipo text not null check (tipo in ('immagine','foto','allegato','audio')), mime_type text,
  storage_bucket text not null default 'quaderno-sopralluoghi' check (storage_bucket = 'quaderno-sopralluoghi'),
  storage_path text not null unique, created_at timestamptz not null default now()
);
create index quaderno_copie_nota_idx on public.quaderno_copie_allegati(nota_id);
alter table public.quaderno_richiami_sopralluogo enable row level security;
alter table public.quaderno_copie_allegati enable row level security;
revoke all on public.quaderno_richiami_sopralluogo, public.quaderno_copie_allegati from public, anon, authenticated;
grant select, insert, delete on public.quaderno_richiami_sopralluogo to authenticated;
grant select, delete on public.quaderno_copie_allegati to authenticated;
create policy richiamo_leggi on public.quaderno_richiami_sopralluogo for select to authenticated using (user_id = (select auth.uid()));
create policy richiamo_prepara on public.quaderno_richiami_sopralluogo for insert to authenticated
  with check (user_id = (select auth.uid()) and stato = 'preparazione' and nota_id is null
    and exists (select 1 from public.quaderno_progetti p where p.id = sorgente_id and p.user_id = auth.uid()));
create policy richiamo_annulla on public.quaderno_richiami_sopralluogo for delete to authenticated
  using (user_id = (select auth.uid()) and stato = 'preparazione');
create policy copie_leggi on public.quaderno_copie_allegati for select to authenticated using (user_id = (select auth.uid()));
create policy copie_elimina on public.quaderno_copie_allegati for delete to authenticated using (user_id = (select auth.uid()));
insert into storage.buckets(id,name,public) values ('quaderno-sopralluoghi','quaderno-sopralluoghi',false);
create function public.quaderno_copia_file_autorizzato(object_name text) returns boolean
language sql stable security definer set search_path = pg_catalog, pg_temp as $$
  select auth.uid() is not null and (storage.foldername(object_name))[1] = 'utenti'
    and (storage.foldername(object_name))[2] = auth.uid()::text and (storage.foldername(object_name))[3] = 'richiami'
    and exists (select 1 from public.quaderno_richiami_sopralluogo r
      where r.id::text = (storage.foldername(object_name))[4] and r.user_id = auth.uid()
      and (r.stato = 'preparazione' or exists (select 1 from public.note_sopralluogo n
        where n.id = r.nota_id and n.user_id = auth.uid() and n.sopralluogo_id = r.sopralluogo_id)));
$$;
revoke all on function public.quaderno_copia_file_autorizzato(text) from public;
grant execute on function public.quaderno_copia_file_autorizzato(text) to anon, authenticated;
create policy copie_file_propri on storage.objects for all to authenticated
  using (bucket_id = 'quaderno-sopralluoghi' and public.quaderno_copia_file_autorizzato(name))
  with check (bucket_id = 'quaderno-sopralluoghi' and public.quaderno_copia_file_autorizzato(name));
-- Barriera anche contro policy permissive generali. Altri bucket invariati.
create policy copie_file_confine on storage.objects as restrictive for all to public
  using (bucket_id <> 'quaderno-sopralluoghi' or public.quaderno_copia_file_autorizzato(name))
  with check (bucket_id <> 'quaderno-sopralluoghi' or public.quaderno_copia_file_autorizzato(name));
create function public.completa_richiamo_quaderno(p_richiamo uuid, p_documento jsonb, p_assets jsonb, p_versione_nota timestamptz)
returns jsonb language plpgsql security definer set search_path = pg_catalog, pg_temp as $$
declare u uuid := auth.uid(); r public.quaderno_richiami_sopralluogo; n public.note_sopralluogo;
  a jsonb; stamp timestamptz := clock_timestamp();
begin
  if u is null then raise exception 'Autenticazione richiesta' using errcode = '42501'; end if;
  select * into r from public.quaderno_richiami_sopralluogo where id = p_richiamo and user_id = u for update;
  if not found then raise exception 'Richiamo non accessibile' using errcode = '42501'; end if;
  if r.stato = 'completato' then return jsonb_build_object('nota_id',r.nota_id,'updated_at',r.nota_updated_at); end if;
  if jsonb_typeof(p_documento) is distinct from 'object' or jsonb_typeof(p_documento->'disegni') is distinct from 'array'
    or jsonb_typeof(p_documento->'checklist') is distinct from 'array' or jsonb_typeof(p_assets) is distinct from 'array' then
    raise exception 'Documento non valido' using errcode = '22023'; end if;
  if jsonb_array_length(p_documento->'disegni') > 100 or jsonb_array_length(p_assets) > 511
    or octet_length(p_documento::text) > 33554432 then raise exception 'Limiti documento superati' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text || ':' || r.sopralluogo_id,0));
  select * into n from public.note_sopralluogo where user_id = u and sopralluogo_id = r.sopralluogo_id for update;
  if (n.id is not null and n.updated_at is distinct from p_versione_nota)
    or (n.id is null and p_versione_nota is not null) then
    raise exception 'Nota aggiornata altrove: conservare la bozza e rileggere prima del richiamo' using errcode = '40001'; end if;
  for a in select value from jsonb_array_elements(p_assets) loop
    if a->>'storage_path' is null or a->>'storage_path' not like 'utenti/' || u::text || '/richiami/' || r.id::text || '/%'
      or not exists (select 1 from storage.objects o where o.bucket_id = 'quaderno-sopralluoghi' and o.name = a->>'storage_path') then
      raise exception 'File copiato mancante o non autorizzato' using errcode = '42501'; end if;
  end loop;
  insert into public.note_sopralluogo(user_id,sopralluogo_id,titolo,testo,checklist,disegni,analisi_ai,updated_at)
    values (u,r.sopralluogo_id,coalesce(p_documento->>'titolo',''),coalesce(p_documento->>'testo',''),
      p_documento->'checklist',p_documento->'disegni',p_documento->'analisi_ai',stamp)
    on conflict (user_id,sopralluogo_id) do update set titolo=excluded.titolo,testo=excluded.testo,
      checklist=excluded.checklist,disegni=excluded.disegni,analisi_ai=excluded.analisi_ai,updated_at=excluded.updated_at
    returning * into n;
  for a in select value from jsonb_array_elements(p_assets) loop
    insert into public.quaderno_copie_allegati(id,richiamo_id,nota_id,user_id,nome_file,tipo,mime_type,storage_path)
      values ((a->>'id')::uuid,r.id,n.id,u,a->>'nome_file',a->>'tipo',a->>'mime_type',a->>'storage_path');
  end loop;
  update public.quaderno_richiami_sopralluogo set stato='completato',nota_id=n.id,nota_updated_at=stamp where id=r.id;
  return jsonb_build_object('nota_id',n.id,'updated_at',stamp);
end;
$$;
revoke all on function public.completa_richiamo_quaderno(uuid,jsonb,jsonb,timestamptz) from public, anon;
grant execute on function public.completa_richiamo_quaderno(uuid,jsonb,jsonb,timestamptz) to authenticated;
commit;
