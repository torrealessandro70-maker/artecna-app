begin;
-- La nota legacy resta unica per (user_id,sopralluogo_id). Nessuna FK alla
-- sorgente: la sua cancellazione non cancella il richiamo o i file copiati.
create table public.quaderno_richiami_sopralluogo (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  sopralluogo_id text not null, nota_id uuid references public.note_sopralluogo(id) on delete cascade,
  sorgente_id uuid not null, sorgente_titolo text not null, sorgente_updated_at timestamptz not null,
  richiamato_at timestamptz not null default clock_timestamp(), nota_updated_at timestamptz,
  versione_base timestamptz, documento jsonb not null, input_documento jsonb not null, assets jsonb not null,
  confermato_at timestamptz, pulito_at timestamptz,
  stato text not null default 'preparazione' check (stato in ('preparazione','completato','annullato')),
  check ((stato <> 'completato' and nota_id is null) or (stato = 'completato' and nota_id is not null))
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
grant select on public.quaderno_richiami_sopralluogo to authenticated;
grant select, delete on public.quaderno_copie_allegati to authenticated;
create policy richiamo_leggi on public.quaderno_richiami_sopralluogo for select to authenticated using (user_id = (select auth.uid()));
create policy copie_leggi on public.quaderno_copie_allegati for select to authenticated using (user_id = (select auth.uid()));
create policy copie_elimina on public.quaderno_copie_allegati for delete to authenticated using (user_id = (select auth.uid()));
insert into storage.buckets(id,name,public) values ('quaderno-sopralluoghi','quaderno-sopralluoghi',false);
create unique index quaderno_richiamo_aperto_idx on public.quaderno_richiami_sopralluogo(user_id,sopralluogo_id) where confermato_at is null;
-- Modello osservato: sopralluoghi condivisi, senza proprietario e senza RLS.
-- Fail closed se quel modello cambia: occorre rivederne le autorizzazioni.
create function public.quaderno_target_accessibile(p_sopralluogo text) returns boolean
language sql stable security invoker set search_path=pg_catalog,pg_temp as $$
 select auth.uid() is not null and has_table_privilege('authenticated','public.sopralluoghi','SELECT')
 and not (select relrowsecurity from pg_class where oid='public.sopralluoghi'::regclass)
 and exists(select 1 from public.sopralluoghi where id::text=p_sopralluogo);
$$;
create function public.salva_nota_quaderno(p_sopralluogo text,p_documento jsonb,p_versione timestamptz) returns jsonb
language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
declare n public.note_sopralluogo; u uuid:=auth.uid(); stamp timestamptz;
begin
 if not public.quaderno_target_accessibile(p_sopralluogo) then raise exception 'Sopralluogo non accessibile' using errcode='42501'; end if;
 if jsonb_typeof(p_documento) is distinct from 'object' or jsonb_typeof(p_documento->'disegni') is distinct from 'array' or jsonb_typeof(p_documento->'checklist') is distinct from 'array' or octet_length(p_documento::text)>33554432 then raise exception 'Documento non valido' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||':'||p_sopralluogo,0));
 select * into n from public.note_sopralluogo where user_id=u and sopralluogo_id=p_sopralluogo for update;
 if n.updated_at is distinct from p_versione then raise exception 'Nota aggiornata altrove: riconciliazione richiesta' using errcode='40001'; end if;
 stamp:=greatest(clock_timestamp(),coalesce(n.updated_at,clock_timestamp())+interval '1 microsecond');
 if n.id is null then
  begin
   insert into public.note_sopralluogo(user_id,sopralluogo_id,titolo,testo,checklist,disegni,analisi_ai,updated_at)
    values(u,p_sopralluogo,coalesce(p_documento->>'titolo',''),coalesce(p_documento->>'testo',''),p_documento->'checklist',p_documento->'disegni',p_documento->'analisi_ai',stamp) returning * into n;
  exception when unique_violation then raise exception 'Nota creata altrove: riconciliazione richiesta' using errcode='40001'; end;
 else
  update public.note_sopralluogo set titolo=coalesce(p_documento->>'titolo',''),testo=coalesce(p_documento->>'testo',''),checklist=p_documento->'checklist',disegni=p_documento->'disegni',analisi_ai=p_documento->'analisi_ai',updated_at=stamp
   where id=n.id and user_id=u and updated_at=p_versione returning * into n;
  if not found then raise exception 'Versione nota non piu corrente' using errcode='40001'; end if;
 end if;
 return to_jsonb(n);
end;
$$;
create function public.prepara_richiamo_quaderno(p_id uuid,p_sopralluogo text,p_sorgente uuid,p_sorgente_versione timestamptz,p_documento jsonb,p_assets jsonb,p_versione timestamptz) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare r public.quaderno_richiami_sopralluogo; s public.quaderno_progetti; a jsonb; u uuid:=auth.uid(); canonico jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('richiamo:'||p_id::text,0));
 if not public.quaderno_target_accessibile(p_sopralluogo) then raise exception 'Sopralluogo non accessibile' using errcode='42501'; end if;
 select * into r from public.quaderno_richiami_sopralluogo where id=p_id for update;
 if found then
  if r.user_id<>u or r.sopralluogo_id<>p_sopralluogo or r.sorgente_id<>p_sorgente or r.sorgente_updated_at<>p_sorgente_versione or r.versione_base is distinct from p_versione or r.input_documento is distinct from p_documento or r.assets is distinct from p_assets then raise exception 'Identita richiesta riusata con contenuto diverso' using errcode='22023'; end if;
  return to_jsonb(r);
 end if;
 select * into s from public.quaderno_progetti where id=p_sorgente and user_id=u for share;
 if not found then raise exception 'Sorgente non accessibile' using errcode='42501'; end if;
 if s.updated_at is distinct from p_sorgente_versione then raise exception 'Sorgente aggiornata: rileggere' using errcode='40001'; end if;
 if jsonb_typeof(p_documento) is distinct from 'object' or jsonb_typeof(p_documento->'disegni') is distinct from 'array' or jsonb_typeof(p_documento->'checklist') is distinct from 'array' or jsonb_typeof(p_assets) is distinct from 'array' then raise exception 'Documento non valido' using errcode='22023'; end if;
 if jsonb_array_length(p_documento->'disegni')>100 or jsonb_array_length(p_assets)>511 or octet_length(p_documento::text)>33554432 then raise exception 'Limiti superati' using errcode='22023'; end if;
 for a in select value from jsonb_array_elements(p_assets) loop
  if a->>'storage_path' is null or a->>'storage_path' !~ ('^utenti/'||u::text||'/richiami/'||p_id::text||'/[0-9a-f-]{36}$') or a->>'tipo' is null or a->>'tipo' not in ('immagine','foto','allegato','audio') or a->>'nome_file' is null or a->>'id' is null then raise exception 'Manifesto file non valido' using errcode='22023'; end if;
  perform (a->>'id')::uuid;
  if a->>'sha256' is null or a->>'sha256' !~ '^[0-9a-f]{64}$' then raise exception 'Hash file previsto non valido' using errcode='22023'; end if;
 end loop;
 if (select count(*) from jsonb_array_elements(p_assets))<>(select count(distinct v->>'storage_path') from jsonb_array_elements(p_assets) v) then raise exception 'Percorsi duplicati' using errcode='22023'; end if;
 canonico:=jsonb_set(p_documento,'{disegni}',(select coalesce(jsonb_agg(case when v->'provenienzaQuaderno'->>'richiamoId'=p_id::text then jsonb_set(v,'{provenienzaQuaderno}',jsonb_build_object('richiamoId',p_id,'progettoId',s.id,'titolo',s.titolo,'salvatoIl',s.updated_at,'richiamatoIl',clock_timestamp(),'analisiSorgente',s.analisi_ai)) else v end),'[]'::jsonb) from jsonb_array_elements(p_documento->'disegni') v));
 insert into public.quaderno_richiami_sopralluogo(id,user_id,sopralluogo_id,sorgente_id,sorgente_titolo,sorgente_updated_at,versione_base,documento,input_documento,assets)
  values(p_id,u,p_sopralluogo,s.id,s.titolo,s.updated_at,p_versione,canonico,p_documento,p_assets) returning * into r;
 return to_jsonb(r);
exception when unique_violation then raise exception 'Operazione gia pendente: recuperarla' using errcode='40001';
end;
$$;
create function public.esito_richiamo_quaderno(p_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare r public.quaderno_richiami_sopralluogo;
begin
 select * into r from public.quaderno_richiami_sopralluogo where id=p_id and user_id=auth.uid();
 if not found then raise exception 'Richiamo non accessibile' using errcode='42501'; end if;
 return jsonb_build_object('richiamo',to_jsonb(r),'nota',(select to_jsonb(n) from public.note_sopralluogo n where n.id=r.nota_id and n.user_id=auth.uid()),'allegati',coalesce((select jsonb_agg(to_jsonb(a)) from public.quaderno_copie_allegati a where a.nota_id=r.nota_id and a.user_id=auth.uid()),'[]'::jsonb));
end;
$$;
create function public.completa_richiamo_quaderno(p_richiamo uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare r public.quaderno_richiami_sopralluogo; a jsonb; n jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('richiamo:'||p_richiamo::text,0));
 select * into r from public.quaderno_richiami_sopralluogo where id=p_richiamo and user_id=auth.uid() for update;
 if not found then raise exception 'Richiamo non accessibile' using errcode='42501'; end if;
 if r.stato='completato' then return public.esito_richiamo_quaderno(r.id); end if;
 if r.stato='annullato' then raise exception 'Richiamo annullato: completamento impedito' using errcode='55000'; end if;
 for a in select value from jsonb_array_elements(r.assets) loop
  if not exists(select 1 from storage.objects where bucket_id='quaderno-sopralluoghi' and name=a->>'storage_path') then raise exception 'File previsto mancante: riprendere o annullare' using errcode='55000'; end if;
 end loop;
 n:=public.salva_nota_quaderno(r.sopralluogo_id,r.documento,r.versione_base);
 for a in select value from jsonb_array_elements(r.assets) loop
  insert into public.quaderno_copie_allegati(id,richiamo_id,nota_id,user_id,nome_file,tipo,mime_type,storage_path)
   values((a->>'id')::uuid,r.id,(n->>'id')::uuid,r.user_id,a->>'nome_file',a->>'tipo',a->>'mime_type',a->>'storage_path');
 end loop;
 update public.quaderno_richiami_sopralluogo set stato='completato',nota_id=(n->>'id')::uuid,nota_updated_at=(n->>'updated_at')::timestamptz where id=r.id;
 return public.esito_richiamo_quaderno(r.id);
end;
$$;
create function public.annulla_richiamo_quaderno(p_id uuid,p_sopralluogo text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare r public.quaderno_richiami_sopralluogo;
begin
 perform pg_advisory_xact_lock(hashtextextended('richiamo:'||p_id::text,0));
 select * into r from public.quaderno_richiami_sopralluogo where id=p_id and user_id=auth.uid() for update;
 if not found then
  if not public.quaderno_target_accessibile(p_sopralluogo) or exists(select 1 from public.quaderno_richiami_sopralluogo where id=p_id) then raise exception 'Richiamo non accessibile' using errcode='42501'; end if;
  -- Tombstone: una preparazione con risposta persa non potra comparire dopo l'annullamento.
  insert into public.quaderno_richiami_sopralluogo(id,user_id,sopralluogo_id,sorgente_id,sorgente_titolo,sorgente_updated_at,documento,input_documento,assets,stato)
   values(p_id,auth.uid(),p_sopralluogo,'00000000-0000-0000-0000-000000000000','Annullato prima della preparazione',clock_timestamp(),'{}','{}','[]','annullato') returning * into r;
 end if;
 if r.sopralluogo_id<>p_sopralluogo then raise exception 'Sopralluogo differente' using errcode='42501'; end if;
 if r.stato='preparazione' then update public.quaderno_richiami_sopralluogo set stato='annullato' where id=r.id; end if;
 return public.esito_richiamo_quaderno(r.id);
end;
$$;
create function public.conferma_richiamo_quaderno(p_id uuid,p_pulizia boolean default false) returns void
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare r public.quaderno_richiami_sopralluogo;
begin
 select * into r from public.quaderno_richiami_sopralluogo where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'Richiamo non accessibile' using errcode='42501'; end if;
 if p_pulizia then
  if r.stato<>'annullato' or exists(select 1 from storage.objects o join jsonb_array_elements(r.assets) a on o.name=a->>'storage_path' where o.bucket_id='quaderno-sopralluoghi') then raise exception 'Pulizia non conclusa' using errcode='55000'; end if;
  update public.quaderno_richiami_sopralluogo set pulito_at=clock_timestamp(),confermato_at=clock_timestamp() where id=r.id;
 else
  if r.stato<>'completato' then raise exception 'Richiamo non completato' using errcode='55000'; end if;
  update public.quaderno_richiami_sopralluogo set confermato_at=clock_timestamp() where id=r.id;
 end if;
end;
$$;
create function public.quaderno_copia_file_autorizzato(object_name text) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select auth.uid() is not null and exists(select 1 from public.quaderno_richiami_sopralluogo r
  join lateral jsonb_array_elements(r.assets) a on a->>'storage_path'=object_name
  where r.user_id=auth.uid() and r.pulito_at is null and (r.stato in ('preparazione','annullato') or exists(select 1 from public.note_sopralluogo n where n.id=r.nota_id and n.user_id=r.user_id and n.sopralluogo_id=r.sopralluogo_id)));
$$;
create function public.quaderno_copia_file_scrivibile(object_name text) returns boolean
language sql stable security definer set search_path=pg_catalog,pg_temp as $$
 select public.quaderno_copia_file_autorizzato(object_name) and exists(select 1 from public.quaderno_richiami_sopralluogo r where r.id::text=(storage.foldername(object_name))[4] and r.user_id=auth.uid() and r.stato='preparazione');
$$;
create policy copie_file_propri on storage.objects for all to authenticated using(bucket_id='quaderno-sopralluoghi' and public.quaderno_copia_file_autorizzato(name)) with check(bucket_id='quaderno-sopralluoghi' and public.quaderno_copia_file_scrivibile(name));
create policy copie_file_confine on storage.objects as restrictive for all to public using(bucket_id<>'quaderno-sopralluoghi' or public.quaderno_copia_file_autorizzato(name)) with check(bucket_id<>'quaderno-sopralluoghi' or public.quaderno_copia_file_scrivibile(name));
revoke all on function public.quaderno_target_accessibile(text),public.salva_nota_quaderno(text,jsonb,timestamptz),public.prepara_richiamo_quaderno(uuid,text,uuid,timestamptz,jsonb,jsonb,timestamptz),public.esito_richiamo_quaderno(uuid),public.completa_richiamo_quaderno(uuid),public.annulla_richiamo_quaderno(uuid,text),public.conferma_richiamo_quaderno(uuid,boolean) from public,anon;
grant execute on function public.quaderno_target_accessibile(text),public.salva_nota_quaderno(text,jsonb,timestamptz),public.prepara_richiamo_quaderno(uuid,text,uuid,timestamptz,jsonb,jsonb,timestamptz),public.esito_richiamo_quaderno(uuid),public.completa_richiamo_quaderno(uuid),public.annulla_richiamo_quaderno(uuid,text),public.conferma_richiamo_quaderno(uuid,boolean) to authenticated;
revoke all on function public.quaderno_copia_file_scrivibile(text),public.quaderno_copia_file_autorizzato(text) from public;
grant execute on function public.quaderno_copia_file_scrivibile(text),public.quaderno_copia_file_autorizzato(text) to anon,authenticated;
-- Un upload avviato prima dell'annullamento deve terminare PRIMA della pulizia.
-- La policy da sola non serializza le transazioni Storage gia in corso.
create function public.quaderno_copia_scrittura_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare r public.quaderno_richiami_sopralluogo;
begin
 if new.bucket_id <> 'quaderno-sopralluoghi' then return new; end if;
 select * into r from public.quaderno_richiami_sopralluogo where id::text=(storage.foldername(new.name))[4] and user_id=auth.uid() for update;
 if not found or r.user_id is distinct from auth.uid() or r.stato<>'preparazione' or not exists(select 1 from jsonb_array_elements(r.assets) a where a->>'storage_path'=new.name) then raise exception 'Upload non piu autorizzato' using errcode='42501'; end if;
 return new;
end;
$$;
revoke all on function public.quaderno_copia_scrittura_guard() from public,anon,authenticated;
create trigger quaderno_copia_scrittura_guard before insert or update on storage.objects for each row execute function public.quaderno_copia_scrittura_guard();
commit;
