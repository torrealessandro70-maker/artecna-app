-- Nuova migrazione additiva. Non rieseguire le migrazioni 20261022/20261023.
begin;
alter table public.quaderno_progetti add column gestione_id uuid, add column gestione_copia boolean not null default false;
alter table public.note_sopralluogo add column gestione_id uuid;
alter table public.quaderno_richiami_sopralluogo add column gestione_id uuid;
create table public.quaderno_gestioni (
 id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
 tipo text not null check(tipo in ('duplica','elimina','rimuovi')),
 progetto_id uuid, destinazione_id uuid, richiamo_id uuid, sopralluogo_id text,
 annullata boolean not null default false,
 stato text not null default 'aperto' check(stato in ('aperto','pulizia','completato')),
 documento jsonb, assets jsonb not null default '[]', titolo text not null default '',
 created_at timestamptz not null default clock_timestamp(), concluso_at timestamptz,
 check(jsonb_typeof(assets)='array')
);
create unique index quaderno_gestione_attiva_idx on public.quaderno_gestioni(user_id,coalesce(progetto_id,richiamo_id)) where stato<>'completato';
alter table public.quaderno_gestioni enable row level security;
revoke all on public.quaderno_gestioni from public,anon,authenticated;
grant select on public.quaderno_gestioni to authenticated;
create policy gestione_leggi on public.quaderno_gestioni for select to authenticated using(user_id=(select auth.uid()));
create policy progetto_copia_nascosta on public.quaderno_progetti as restrictive for select to authenticated using(not gestione_copia);
-- Nessun DELETE diretto del progetto: la FK non sa cancellare i byte Storage.
revoke delete on public.quaderno_progetti from authenticated;

create function public.quaderno_gestione_blocco() returns trigger
language plpgsql security invoker set search_path=pg_catalog,pg_temp as $$
begin
 if tg_table_name='quaderno_progetti' then
  if tg_op='INSERT' and current_user in ('authenticated','anon') and exists(select 1 from public.quaderno_gestioni where user_id=new.user_id and stato='completato' and ((tipo='elimina' and progetto_id=new.id) or (tipo='duplica' and annullata and destinazione_id=new.id))) then raise exception 'Progetto eliminato: salvataggio tardivo impedito' using errcode='55000'; end if;
  if current_user in ('authenticated','anon') and
   ((tg_op<>'INSERT' and old.gestione_id is not null) or
    (tg_op<>'DELETE' and (new.gestione_id is not null or new.gestione_copia))) then
   raise exception 'Gestione progetto da risolvere prima di modificare' using errcode='55000';
  end if;
 elsif tg_table_name='note_sopralluogo' then
  if tg_op<>'DELETE' and current_user in ('authenticated','anon') and new.gestione_id is distinct from old.gestione_id then raise exception 'Lock gestione riservato al protocollo' using errcode='42501'; end if;
  if tg_op<>'DELETE' and exists(select 1 from public.quaderno_gestioni where user_id=new.user_id and sopralluogo_id=new.sopralluogo_id and tipo='rimuovi' and stato='completato' and (position(richiamo_id::text in new.disegni::text)>0 or position(richiamo_id::text in new.checklist::text)>0)) then raise exception 'Contenuti di un richiamo rimosso: riconciliare prima di salvare' using errcode='55000'; end if;
  if old.gestione_id is not null and not (tg_op='UPDATE' and current_user not in ('authenticated','anon') and new.gestione_id is null) then
   raise exception 'Rimozione richiamo da risolvere prima di salvare' using errcode='55000';
  end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end; $$;
create trigger quaderno_progetto_gestione before insert or update or delete on public.quaderno_progetti for each row execute function public.quaderno_gestione_blocco();
create trigger quaderno_nota_gestione before insert or update or delete on public.note_sopralluogo for each row execute function public.quaderno_gestione_blocco();

create function public.quaderno_gestione_allegati_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare p public.quaderno_progetti; rid uuid; path text;
begin
 if tg_table_name='quaderno_allegati' then
  select * into p from public.quaderno_progetti where id=coalesce(new.nota_id,old.nota_id) for update;
  if p.gestione_id is not null and current_setting('role')='authenticated' then
   raise exception 'Progetto occupato' using errcode='55000';
  end if;
  if tg_op='DELETE' and exists(select 1 from storage.objects where bucket_id='quaderno-privato' and name=old.storage_path) then
   raise exception 'Rimuovere prima il file tramite Storage' using errcode='55000';
  end if;
 else
  rid:=coalesce(new.richiamo_id,old.richiamo_id);
  perform 1 from public.quaderno_richiami_sopralluogo where id=rid for update;
  if tg_op='DELETE' and exists(select 1 from storage.objects where bucket_id='quaderno-sopralluoghi' and name=old.storage_path) then
   raise exception 'Rimuovere prima il file tramite Storage' using errcode='55000';
  end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end; $$;
create trigger quaderno_allegati_gestione before insert or update or delete on public.quaderno_allegati for each row execute function public.quaderno_gestione_allegati_guard();
create trigger quaderno_copie_gestione before delete on public.quaderno_copie_allegati for each row execute function public.quaderno_gestione_allegati_guard();

-- Anche i writer interni Storage devono serializzarsi col progetto, usando owner_id.
create function public.quaderno_gestione_storage_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare p public.quaderno_progetti; g public.quaderno_gestioni;
begin
 if new.bucket_id<>'quaderno-privato' then return new; end if;
 select * into p from public.quaderno_progetti where id::text=(storage.foldername(new.name))[4] and user_id::text=new.owner_id for update;
 if not found or new.name not like 'utenti/'||p.user_id::text||'/quaderni/'||p.id::text||'/%' then raise exception 'File non autorizzato' using errcode='42501'; end if;
 if p.gestione_id is not null then
  select * into g from public.quaderno_gestioni where id=p.gestione_id;
  if not (p.gestione_copia and g.tipo='duplica' and g.stato='aperto' and g.destinazione_id=p.id and exists(select 1 from jsonb_array_elements(g.assets) a where a->>'storage_path'=new.name)) then
   raise exception 'Scrittura sospesa durante gestione progetto' using errcode='55000';
  end if;
 end if;
 return new;
end; $$;
create trigger quaderno_gestione_storage before insert or update on storage.objects for each row execute function public.quaderno_gestione_storage_guard();

create function public.quaderno_gestione_richiamo_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare p public.quaderno_progetti;
begin
 if new.stato<>'preparazione' then return new; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.user_id::text||':'||new.sopralluogo_id,0));
 if exists(select 1 from public.note_sopralluogo where user_id=new.user_id and sopralluogo_id=new.sopralluogo_id and gestione_id is not null) then raise exception 'Rimozione richiamo in corso' using errcode='55000'; end if;
 select * into p from public.quaderno_progetti where id=new.sorgente_id for share;
 if p.id is null or p.gestione_id is not null or p.gestione_copia then raise exception 'Sorgente non disponibile' using errcode='55000'; end if;
 return new;
end; $$;
create trigger quaderno_gestione_richiamo before insert on public.quaderno_richiami_sopralluogo for each row execute function public.quaderno_gestione_richiamo_guard();

create function public.quaderno_rinomina(p_id uuid,p_titolo text,p_versione timestamptz) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare p public.quaderno_progetti;
begin
 select * into p from public.quaderno_progetti where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'Progetto non accessibile' using errcode='42501'; end if;
 if p.gestione_id is not null or p.gestione_copia then raise exception 'Progetto occupato' using errcode='55000'; end if;
 if p.updated_at is distinct from p_versione then raise exception 'Progetto aggiornato: ricaricare' using errcode='40001'; end if;
 if nullif(btrim(p_titolo),'') is null or length(p_titolo)>500 then raise exception 'Titolo non valido' using errcode='22023'; end if;
 update public.quaderno_progetti set titolo=btrim(p_titolo),updated_at=greatest(clock_timestamp(),updated_at+interval '1 microsecond') where id=p.id returning * into p;
 return to_jsonb(p);
end; $$;

create function public.quaderno_gestione_esito(p_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare g public.quaderno_gestioni;
begin
 select * into g from public.quaderno_gestioni where id=p_id and user_id=auth.uid();
 if not found then raise exception 'Operazione non accessibile' using errcode='42501'; end if;
 return to_jsonb(g);
end; $$;

create function public.quaderno_prepara_eliminazione(p_id uuid,p_progetto uuid,p_versione timestamptz) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare p public.quaderno_progetti; g public.quaderno_gestioni; prefix text; files jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('gestione:'||p_id::text,0));
 select * into g from public.quaderno_gestioni where id=p_id;
 if found then
  if g.user_id is distinct from auth.uid() or g.tipo<>'elimina' or g.progetto_id is distinct from p_progetto then raise exception 'Identita riusata' using errcode='22023'; end if;
  return to_jsonb(g);
 end if;
 select * into p from public.quaderno_progetti where id=p_progetto and user_id=auth.uid() for update;
 if not found then raise exception 'Progetto non accessibile' using errcode='42501'; end if;
 if p.gestione_id is not null or p.gestione_copia then raise exception 'Progetto occupato' using errcode='55000'; end if;
 if p.updated_at is distinct from p_versione then raise exception 'Progetto aggiornato: ricaricare' using errcode='40001'; end if;
 prefix:='utenti/'||p.user_id::text||'/quaderni/'||p.id::text||'/';
 if exists(select 1 from public.quaderno_allegati where nota_id=p.id and (user_id<>p.user_id or storage_bucket<>'quaderno-privato' or storage_path not like prefix||'%')) then raise exception 'Allegato fuori dal progetto: verifica manuale' using errcode='55000'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('storage_path',name)),'[]') into files from (select name from storage.objects where bucket_id='quaderno-privato' and name like prefix||'%' union select storage_path from public.quaderno_allegati where nota_id=p.id) f;
 insert into public.quaderno_gestioni(id,user_id,tipo,progetto_id,assets,titolo) values(p_id,p.user_id,'elimina',p.id,files,p.titolo) returning * into g;
 update public.quaderno_progetti set gestione_id=g.id where id=p.id;
 return to_jsonb(g);
end; $$;

create function public.quaderno_prepara_duplicazione(p_id uuid,p_sorgente uuid,p_versione timestamptz,p_destinazione uuid,p_documento jsonb,p_assets jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare p public.quaderno_progetti; g public.quaderno_gestioni; a jsonb; prefix text;
begin
 perform pg_advisory_xact_lock(hashtextextended('gestione:'||p_id::text,0));
 select * into g from public.quaderno_gestioni where id=p_id;
 if found then
  if g.user_id is distinct from auth.uid() or g.tipo<>'duplica' or g.progetto_id is distinct from p_sorgente or g.destinazione_id is distinct from p_destinazione or g.documento is distinct from p_documento or g.assets is distinct from p_assets then raise exception 'Identita riusata' using errcode='22023'; end if;
  return to_jsonb(g);
 end if;
 select * into p from public.quaderno_progetti where id=p_sorgente and user_id=auth.uid() for update;
 if not found then raise exception 'Progetto non accessibile' using errcode='42501'; end if;
 if p.gestione_id is not null or p.gestione_copia then raise exception 'Progetto occupato' using errcode='55000'; end if;
 if p.updated_at is distinct from p_versione then raise exception 'Progetto aggiornato: ricaricare' using errcode='40001'; end if;
 if jsonb_typeof(p_documento) is distinct from 'object' or jsonb_typeof(p_documento->'disegni') is distinct from 'array' or jsonb_typeof(p_documento->'checklist') is distinct from 'array' or jsonb_typeof(p_assets) is distinct from 'array' or octet_length(p_documento::text)>33554432 then raise exception 'Copia non valida' using errcode='22023'; end if;
 if jsonb_array_length(p_assets)>511 then raise exception 'Troppi file' using errcode='22023'; end if;
 prefix:='utenti/'||p.user_id::text||'/quaderni/'||p_destinazione::text||'/';
 for a in select value from jsonb_array_elements(p_assets) loop
  if a->>'storage_path' is null or a->>'storage_path' !~ ('^'||prefix||'[0-9a-f-]{36}$') or a->>'tipo' is null or a->>'tipo' not in ('immagine','foto','allegato','audio') or a->>'nome_file' is null or a->>'sha256' is null or a->>'sha256' !~ '^[0-9a-f]{64}$' then raise exception 'Manifesto non valido' using errcode='22023'; end if;
  perform (a->>'id')::uuid;
 end loop;
 if (select count(*) from jsonb_array_elements(p_assets))<>(select count(distinct item->>'storage_path') from jsonb_array_elements(p_assets) as items(item)) then raise exception 'Percorsi duplicati' using errcode='22023'; end if;
 insert into public.quaderno_gestioni(id,user_id,tipo,progetto_id,destinazione_id,documento,assets,titolo) values(p_id,p.user_id,'duplica',p.id,p_destinazione,p_documento,p_assets,p.titolo||' - copia') returning * into g;
 update public.quaderno_progetti set gestione_id=g.id where id=p.id;
 insert into public.quaderno_progetti(id,user_id,titolo,gestione_id,gestione_copia) values(p_destinazione,p.user_id,g.titolo,g.id,true);
 return to_jsonb(g);
end; $$;

-- Filtro strutturale: elimina solo ID presenti nelle pagine importate dello snapshot
-- o provenienza esplicita. Elementi nuovi/manuali e testo/checklist legacy restano.
create function public.quaderno_filtra_richiamo(v jsonb,rid text,ids text[],pages text[],snapshot jsonb) returns jsonb
language plpgsql immutable set search_path=pg_catalog,pg_temp as $$
declare result jsonb; x jsonb; y jsonb; k text; initial jsonb;
begin
 if jsonb_typeof(v)='array' then
  result:='[]';
  for x in select value from jsonb_array_elements(v) loop
   if jsonb_typeof(x)='object' and x->>'id'=any(pages) then
    y:=public.quaderno_filtra_richiamo(x,rid,ids,pages,snapshot)-'provenienzaQuaderno';
    select value into initial from jsonb_array_elements(snapshot) where value->>'id'=x->>'id';
    if y->'sfondoDisegno' is not distinct from initial->'sfondoDisegno' then y:=jsonb_set(y,'{sfondoDisegno}','null'); end if;
    if not exists(select 1 from jsonb_each(y) z where jsonb_typeof(z.value)='array' and z.key<>'layers' and jsonb_array_length(case when jsonb_typeof(z.value)='array' then z.value else '[]'::jsonb end)>0) and coalesce(y->>'sfondoDisegno','')='' then continue; end if;
   elsif jsonb_typeof(x)='object' and (x->>'id'=any(ids) or x->'provenienzaQuaderno'->>'richiamoId'=rid or x->'metadata'->>'richiamoId'=rid) then continue;
   else y:=public.quaderno_filtra_richiamo(x,rid,ids,pages,snapshot); end if;
   result:=result||jsonb_build_array(y);
  end loop; return result;
 elsif jsonb_typeof(v)='object' then
  result:='{}'; for k,x in select * from jsonb_each(v) loop
   if k in ('provenienzaQuaderno','layers') then result:=result||jsonb_build_object(k,x);
   else result:=result||jsonb_build_object(k,public.quaderno_filtra_richiamo(x,rid,ids,pages,snapshot)); end if;
  end loop; return result;
 end if; return v;
end; $$;

create function public.quaderno_prepara_rimozione(p_id uuid,p_richiamo uuid,p_versione timestamptz) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare r public.quaderno_richiami_sopralluogo; n public.note_sopralluogo; g public.quaderno_gestioni; pages jsonb; pageids text[]; ids text[]; doc jsonb; files jsonb; prefix text;
begin
 perform pg_advisory_xact_lock(hashtextextended('gestione:'||p_id::text,0));
 select * into g from public.quaderno_gestioni where id=p_id;
 if found then
  if g.user_id is distinct from auth.uid() or g.tipo<>'rimuovi' or g.richiamo_id is distinct from p_richiamo then raise exception 'Identita riusata' using errcode='22023'; end if; return to_jsonb(g);
 end if;
 perform pg_advisory_xact_lock(hashtextextended('richiamo:'||p_richiamo::text,0));
 select * into r from public.quaderno_richiami_sopralluogo where id=p_richiamo and user_id=auth.uid() for update;
 if not found then raise exception 'Richiamo non accessibile' using errcode='42501'; end if;
 if r.stato<>'completato' or r.confermato_at is null or r.gestione_id is not null then raise exception 'Richiamo da riconciliare' using errcode='55000'; end if;
 perform pg_advisory_xact_lock(hashtextextended(r.user_id::text||':'||r.sopralluogo_id,0));
 select * into n from public.note_sopralluogo where id=r.nota_id and user_id=r.user_id for update;
 if not found or n.gestione_id is not null or exists(select 1 from public.quaderno_richiami_sopralluogo where user_id=r.user_id and sopralluogo_id=r.sopralluogo_id and confermato_at is null) then raise exception 'Nota occupata' using errcode='55000'; end if;
 if n.updated_at is distinct from p_versione then raise exception 'Nota aggiornata: ricaricare' using errcode='40001'; end if;
 select coalesce(jsonb_agg(value),'[]') into pages from jsonb_array_elements(r.documento->'disegni') where value->'provenienzaQuaderno'->>'richiamoId'=r.id::text;
 select coalesce(array_agg(value->>'id'),array[]::text[]) into pageids from jsonb_array_elements(pages);
 select coalesce(array_agg(distinct value #>> '{}'),array[]::text[]) into ids from jsonb_path_query(pages,'$.**.id') as extracted(value) where not (value #>> '{}'=any(pageids));
 -- Workspace legacy: riconosci solo ID gia presenti nello snapshot del richiamo,
 -- non oggetti manuali aggiunti successivamente sulla stessa pagina.
 select ids||coalesce(array_agg(item->>'id'),array[]::text[]) into ids
 from jsonb_array_elements(r.documento->'disegni') as pp(page)
 cross join lateral jsonb_array_elements(coalesce(page->'workspaceCadEntities','[]')||coalesce(page->'workspacePosterImages','[]')) as ee(item)
 where item->'metadata'->>'workspacePageId'=any(pageids) or item->>'workspacePageId'=any(pageids);
 doc:=jsonb_build_object('titolo',n.titolo,'testo',n.testo,'checklist',n.checklist,'disegni',n.disegni,'analisi_ai',n.analisi_ai);
 doc:=public.quaderno_filtra_richiamo(doc,r.id::text,ids,pageids,pages);
 -- Conserva almeno una pagina vuota, senza riusare la provenienza eliminata.
 if jsonb_array_length(doc->'disegni')=0 then doc:=jsonb_set(doc,'{disegni}',jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'titolo','Pagina','disegni','[]'::jsonb,'sfondoDisegno',null))); end if;
 prefix:='utenti/'||r.user_id::text||'/richiami/'||r.id::text||'/';
 if exists(select 1 from jsonb_array_elements(r.assets) a where a->>'storage_path' is null or a->>'storage_path' not like prefix||'%') then raise exception 'Manifesto fuori richiamo' using errcode='55000'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('storage_path',name)),'[]') into files from (select a->>'storage_path' name from jsonb_array_elements(r.assets) a union select storage_path from public.quaderno_copie_allegati where richiamo_id=r.id union select name from storage.objects where bucket_id='quaderno-sopralluoghi' and name like prefix||'%') f;
 if exists(select 1 from jsonb_array_elements(files) a where a->>'storage_path' not like prefix||'%') then raise exception 'File fuori richiamo' using errcode='55000'; end if;
 if exists(select 1 from jsonb_array_elements(files) a where position(a->>'storage_path' in doc::text)>0 or position(replace(a->>'storage_path','/','%2F') in doc::text)>0) then raise exception 'Un contenuto conservato usa ancora un file del richiamo: separarlo prima della rimozione' using errcode='55000'; end if;
 insert into public.quaderno_gestioni(id,user_id,tipo,richiamo_id,sopralluogo_id,documento,assets,titolo) values(p_id,r.user_id,'rimuovi',r.id,r.sopralluogo_id,doc,files,r.sorgente_titolo) returning * into g;
 update public.note_sopralluogo set gestione_id=g.id where id=n.id;
 update public.quaderno_richiami_sopralluogo set gestione_id=g.id where id=r.id;
 return to_jsonb(g);
end; $$;

create function public.quaderno_annulla_duplicazione(p_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare g public.quaderno_gestioni;
begin
 perform pg_advisory_xact_lock(hashtextextended('gestione:'||p_id::text,0));
 select * into g from public.quaderno_gestioni where id=p_id and user_id=auth.uid() for update;
 if not found then
  if auth.uid() is null or exists(select 1 from public.quaderno_gestioni where id=p_id) then raise exception 'Operazione non accessibile' using errcode='42501'; end if;
  insert into public.quaderno_gestioni(id,user_id,tipo,stato,concluso_at) values(p_id,auth.uid(),'duplica','completato',clock_timestamp()) returning * into g;
 end if;
 if g.tipo<>'duplica' then raise exception 'Copia non accessibile' using errcode='42501'; end if;
 if g.stato='aperto' then update public.quaderno_gestioni set stato='pulizia',annullata=true where id=g.id returning * into g; end if;
 return to_jsonb(g);
end; $$;

create function public.quaderno_concludi_gestione(p_id uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare g public.quaderno_gestioni; p public.quaderno_progetti; r public.quaderno_richiami_sopralluogo; a jsonb; bucket text; prefix text;
begin
 select * into g from public.quaderno_gestioni where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'Operazione non accessibile' using errcode='42501'; end if;
 if g.stato='completato' then return to_jsonb(g); end if;
 if g.tipo in ('elimina','duplica') then
  perform 1 from public.quaderno_progetti where id=g.progetto_id for update;
  if g.tipo='duplica' then perform 1 from public.quaderno_progetti where id=g.destinazione_id for update; end if;
 end if;
 if g.tipo='duplica' and g.stato='aperto' then
  for a in select value from jsonb_array_elements(g.assets) loop
   if not exists(select 1 from storage.objects where bucket_id='quaderno-privato' and name=a->>'storage_path' and owner_id=g.user_id::text) then raise exception 'File copia mancante: riprendere o annullare' using errcode='55000'; end if;
  end loop;
  update public.quaderno_progetti set titolo=g.titolo,testo=coalesce(g.documento->>'testo',''),checklist=g.documento->'checklist',disegni=g.documento->'disegni',analisi_ai=g.documento->'analisi_ai',gestione_id=null,gestione_copia=false,updated_at=clock_timestamp() where id=g.destinazione_id;
  for a in select value from jsonb_array_elements(g.assets) loop
   if a->>'tipo'<>'immagine' then insert into public.quaderno_allegati(id,nota_id,user_id,nome_file,tipo,mime_type,storage_path) values((a->>'id')::uuid,g.destinazione_id,g.user_id,a->>'nome_file',a->>'tipo',a->>'mime_type',a->>'storage_path'); end if;
  end loop;
 else
  bucket:=case when g.tipo='rimuovi' then 'quaderno-sopralluoghi' else 'quaderno-privato' end;
  prefix:='utenti/'||g.user_id::text||case when g.tipo='rimuovi' then '/richiami/'||g.richiamo_id::text else '/quaderni/'||coalesce(g.destinazione_id,g.progetto_id)::text end||'/';
  if exists(select 1 from storage.objects where bucket_id=bucket and name like prefix||'%') then raise exception 'Pulizia Storage non confermata' using errcode='55000'; end if;
  if g.tipo='rimuovi' then
   perform pg_advisory_xact_lock(hashtextextended('richiamo:'||g.richiamo_id::text,0));
   select * into r from public.quaderno_richiami_sopralluogo where id=g.richiamo_id for update;
   perform pg_advisory_xact_lock(hashtextextended(g.user_id::text||':'||g.sopralluogo_id,0));
   update public.note_sopralluogo set titolo=g.documento->>'titolo',testo=g.documento->>'testo',checklist=g.documento->'checklist',disegni=g.documento->'disegni',analisi_ai=g.documento->'analisi_ai',gestione_id=null,updated_at=greatest(clock_timestamp(),updated_at+interval '1 microsecond') where id=r.nota_id and user_id=g.user_id and gestione_id=g.id;
   if not found then raise exception 'Nota non riconciliata' using errcode='55000'; end if;
   delete from public.quaderno_copie_allegati where richiamo_id=r.id and user_id=g.user_id;
   -- Tombstone: eliminare la riga consentirebbe a vecchie richieste di riusare UUID.
   update public.quaderno_richiami_sopralluogo set stato='annullato',nota_id=null,documento='{}',input_documento='{}',assets='[]',pulito_at=clock_timestamp(),confermato_at=clock_timestamp(),gestione_id=null where id=r.id;
  else
   update public.quaderno_progetti set gestione_id=null where id=coalesce(g.destinazione_id,g.progetto_id);
   delete from public.quaderno_allegati where nota_id=coalesce(g.destinazione_id,g.progetto_id) and user_id=g.user_id;
   delete from public.quaderno_progetti where id=coalesce(g.destinazione_id,g.progetto_id) and user_id=g.user_id;
  end if;
 end if;
 if g.tipo='duplica' then update public.quaderno_progetti set gestione_id=null where id=g.progetto_id and gestione_id=g.id; end if;
 update public.quaderno_gestioni set stato='completato',concluso_at=clock_timestamp() where id=g.id returning * into g;
 return to_jsonb(g);
end; $$;

-- Chiude solo un UUID mai arrivato al server; lo stesso lock impedisce una
-- preparazione tardiva. Non puo abbandonare una pulizia gia iniziata.
create function public.quaderno_archivia_non_avviata(p_id uuid,p_tipo text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,pg_temp as $$
declare g public.quaderno_gestioni;
begin
 perform pg_advisory_xact_lock(hashtextextended('gestione:'||p_id::text,0));
 select * into g from public.quaderno_gestioni where id=p_id for update;
 if found then
  if g.user_id is distinct from auth.uid() then raise exception 'Operazione non accessibile' using errcode='42501'; end if;
  if g.stato<>'completato' then raise exception 'Operazione gia avviata: riprenderla' using errcode='55000'; end if;
 else
  if auth.uid() is null or p_tipo not in ('duplica','elimina','rimuovi') then raise exception 'Richiesta non valida' using errcode='42501'; end if;
  insert into public.quaderno_gestioni(id,user_id,tipo,stato,annullata,concluso_at) values(p_id,auth.uid(),p_tipo,'completato',true,clock_timestamp()) returning * into g;
 end if;
 return to_jsonb(g);
end; $$;
revoke all on function public.quaderno_archivia_non_avviata(uuid,text) from public,anon;
grant execute on function public.quaderno_archivia_non_avviata(uuid,text) to authenticated;
revoke all on function public.quaderno_gestione_blocco(),public.quaderno_gestione_allegati_guard(),public.quaderno_gestione_storage_guard(),public.quaderno_gestione_richiamo_guard(),public.quaderno_filtra_richiamo(jsonb,text,text[],text[],jsonb) from public,anon,authenticated;
revoke all on function public.quaderno_rinomina(uuid,text,timestamptz),public.quaderno_gestione_esito(uuid),public.quaderno_prepara_eliminazione(uuid,uuid,timestamptz),public.quaderno_prepara_duplicazione(uuid,uuid,timestamptz,uuid,jsonb,jsonb),public.quaderno_prepara_rimozione(uuid,uuid,timestamptz),public.quaderno_annulla_duplicazione(uuid),public.quaderno_concludi_gestione(uuid) from public,anon;
grant execute on function public.quaderno_rinomina(uuid,text,timestamptz),public.quaderno_gestione_esito(uuid),public.quaderno_prepara_eliminazione(uuid,uuid,timestamptz),public.quaderno_prepara_duplicazione(uuid,uuid,timestamptz,uuid,jsonb,jsonb),public.quaderno_prepara_rimozione(uuid,uuid,timestamptz),public.quaderno_annulla_duplicazione(uuid),public.quaderno_concludi_gestione(uuid) to authenticated;
commit;
