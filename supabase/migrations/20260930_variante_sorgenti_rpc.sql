begin;

-- PostgreSQL 17: concessione temporanea distinta per grantor.
-- La membership concessa da supabase_admin non viene modificata.
do $preflight$
begin
  if current_user <> 'postgres' or session_user <> 'postgres'
    or current_setting('server_version_num')::integer / 10000 <> 17 then
    raise exception 'Installazione prevista come postgres su PostgreSQL 17';
  end if;
  if (select count(*) from pg_catalog.pg_auth_members
      where roleid = 'artecna_varianti_rpc'::regrole
        and member = 'postgres'::regrole) <> 1
    or not exists (
      select 1 from pg_catalog.pg_auth_members
      where roleid = 'artecna_varianti_rpc'::regrole
        and member = 'postgres'::regrole
        and grantor = 'supabase_admin'::regrole
        and admin_option and not inherit_option and not set_option
    ) then
    raise exception 'Membership iniziale diversa da quella certificata';
  end if;
  if pg_has_role('postgres', 'artecna_varianti_rpc', 'SET')
    or has_schema_privilege('artecna_varianti_rpc', 'public', 'CREATE') then
    raise exception 'Privilegi temporanei gia presenti: installazione interrotta';
  end if;
end;
$preflight$;

grant artecna_varianti_rpc to postgres
  with admin false, inherit false, set true
  granted by postgres;

do $check_set$
begin
  if not pg_has_role('postgres', 'artecna_varianti_rpc', 'SET')
    or not exists (
      select 1 from pg_catalog.pg_auth_members
      where roleid = 'artecna_varianti_rpc'::regrole
        and member = 'postgres'::regrole and grantor = 'postgres'::regrole
        and not admin_option and not inherit_option and set_option
    ) then
    raise exception 'Concessione temporanea SET non disponibile';
  end if;
end;
$check_set$;

grant create on schema public to artecna_varianti_rpc;
grant select, insert, delete on public.variante_sorgenti to artecna_varianti_rpc;
set local role artecna_varianti_rpc;

-- SQLSTATE standard: 42501 autorizzazione, 22023 input/stato,
-- P0002 record assente, 23505 duplicato; 40001/40P01 richiedono retry.
create function public.aggiungi_sorgente_variante(
  p_variante_id uuid,
  p_tipo text,
  p_preventivo_sorgente_id uuid,
  p_titolo text,
  p_nome_file text,
  p_formato text,
  p_file_sha256 text,
  p_snapshot_version integer,
  p_snapshot jsonb
) returns public.variante_sorgenti
language plpgsql
security definer
set search_path to 'pg_catalog', 'pg_temp'
as $$
declare
  v_utente uuid;
  v_variante public.varianti_cantiere%rowtype;
  v_sorgente public.variante_sorgenti%rowtype;
begin
  if current_user <> 'artecna_varianti_rpc' then
    raise exception using errcode = '42501', message = 'Ruolo RPC non autorizzato';
  end if;
  v_utente := artecna_guardie.utente_jwt_corrente();
  if v_utente is null then
    raise exception using errcode = '42501', message = 'Utente non autenticato';
  end if;
  if p_variante_id is null then
    raise exception using errcode = '22023', message = 'ID Variante obbligatorio';
  end if;
  select v.* into v_variante
  from public.varianti_cantiere v where v.id = p_variante_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Variante non trovata';
  end if;
  if artecna_guardie.utente_puo_modificare_cantiere(v_utente, v_variante.cantiere_id) is not true then
    raise exception using errcode = '42501', message = 'Cantiere non autorizzato';
  end if;
  if v_variante.stato is distinct from 'bozza' then
    raise exception using errcode = '22023', message = 'Sorgenti modificabili solo in bozza';
  end if;
  if p_titolo is null or btrim(p_titolo) = ''
    or p_snapshot_version is null or p_snapshot_version <= 0
    or p_snapshot is null or jsonb_typeof(p_snapshot) is distinct from 'object'
    or p_tipo is null or p_tipo not in ('preventivo_artecna', 'file') then
    raise exception using errcode = '22023', message = 'Dati sorgente non validi';
  end if;
  if p_tipo = 'preventivo_artecna' then
    if p_preventivo_sorgente_id is null or p_nome_file is not null
      or p_formato is not null or p_file_sha256 is not null then
      raise exception using errcode = '22023', message = 'Dati sorgente ARTECNA non coerenti';
    end if;
    perform 1 from public.preventivi_cantiere p
    where p.id = p_preventivo_sorgente_id and p.cantiere_id = v_variante.cantiere_id;
    if not found then
      raise exception using errcode = '22023', message = 'Preventivo sorgente non appartenente al cantiere della Variante';
    end if;
  else
    if p_preventivo_sorgente_id is not null
      or p_nome_file is null or btrim(p_nome_file) = ''
      or p_formato is null or p_formato not in ('pdf', 'excel', 'immagine')
      or (p_file_sha256 is not null and btrim(p_file_sha256) = '') then
      raise exception using errcode = '22023', message = 'Dati sorgente file non coerenti';
    end if;
  end if;
  insert into public.variante_sorgenti (
    variante_id, tipo, preventivo_sorgente_id, titolo, nome_file,
    formato, file_sha256, snapshot_version, snapshot
  ) values (
    p_variante_id, p_tipo, p_preventivo_sorgente_id, p_titolo, p_nome_file,
    p_formato, p_file_sha256, p_snapshot_version, p_snapshot
  ) returning * into v_sorgente;
  return v_sorgente;
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'Sorgente già presente nella Variante';
  when serialization_failure or deadlock_detected then
    raise exception using errcode = SQLSTATE, message = 'Operazione concorrente: riprovare la transazione';
end;
$$;

create function public.leggi_sorgenti_variante(p_variante_id uuid)
returns table (
  id uuid, variante_id uuid, tipo text, preventivo_sorgente_id uuid,
  titolo text, nome_file text, formato text, file_sha256 text,
  snapshot_version integer, created_at timestamptz
)
language plpgsql
security definer
set search_path to 'pg_catalog', 'pg_temp'
as $$
declare
  v_utente uuid;
  v_cantiere_id uuid;
begin
  if current_user <> 'artecna_varianti_rpc' then
    raise exception using errcode = '42501', message = 'Ruolo RPC non autorizzato';
  end if;
  v_utente := artecna_guardie.utente_jwt_corrente();
  if v_utente is null then
    raise exception using errcode = '42501', message = 'Utente non autenticato';
  end if;
  if p_variante_id is null then
    raise exception using errcode = '22023', message = 'ID Variante obbligatorio';
  end if;
  select v.cantiere_id into v_cantiere_id
  from public.varianti_cantiere v where v.id = p_variante_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Variante non trovata';
  end if;
  if artecna_guardie.utente_puo_modificare_cantiere(v_utente, v_cantiere_id) is not true then
    raise exception using errcode = '42501', message = 'Cantiere non autorizzato';
  end if;
  return query
    select s.id, s.variante_id, s.tipo, s.preventivo_sorgente_id,
      s.titolo, s.nome_file, s.formato, s.file_sha256,
      s.snapshot_version, s.created_at
    from public.variante_sorgenti s where s.variante_id = p_variante_id
    order by s.created_at asc, s.id asc;
end;
$$;

create function public.leggi_sorgente_variante(p_sorgente_id uuid)
returns public.variante_sorgenti
language plpgsql
security definer
set search_path to 'pg_catalog', 'pg_temp'
as $$
declare
  v_utente uuid;
  v_cantiere_id uuid;
  v_sorgente public.variante_sorgenti%rowtype;
begin
  if current_user <> 'artecna_varianti_rpc' then
    raise exception using errcode = '42501', message = 'Ruolo RPC non autorizzato';
  end if;
  v_utente := artecna_guardie.utente_jwt_corrente();
  if v_utente is null then
    raise exception using errcode = '42501', message = 'Utente non autenticato';
  end if;
  if p_sorgente_id is null then
    raise exception using errcode = '22023', message = 'ID sorgente obbligatorio';
  end if;
  select s.* into v_sorgente
  from public.variante_sorgenti s where s.id = p_sorgente_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Sorgente non trovata';
  end if;
  select v.cantiere_id into v_cantiere_id
  from public.varianti_cantiere v where v.id = v_sorgente.variante_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Variante non trovata';
  end if;
  if artecna_guardie.utente_puo_modificare_cantiere(v_utente, v_cantiere_id) is not true then
    raise exception using errcode = '42501', message = 'Cantiere non autorizzato';
  end if;
  return v_sorgente;
end;
$$;

create function public.rimuovi_sorgente_variante(p_sorgente_id uuid)
returns table (id uuid, variante_id uuid)
language plpgsql
security definer
set search_path to 'pg_catalog', 'pg_temp'
as $$
declare
  v_utente uuid;
  v_variante_id uuid;
  v_variante public.varianti_cantiere%rowtype;
  v_sorgente public.variante_sorgenti%rowtype;
begin
  if current_user <> 'artecna_varianti_rpc' then
    raise exception using errcode = '42501', message = 'Ruolo RPC non autorizzato';
  end if;
  v_utente := artecna_guardie.utente_jwt_corrente();
  if v_utente is null then
    raise exception using errcode = '42501', message = 'Utente non autenticato';
  end if;
  if p_sorgente_id is null then
    raise exception using errcode = '22023', message = 'ID sorgente obbligatorio';
  end if;
  select s.variante_id into v_variante_id
  from public.variante_sorgenti s where s.id = p_sorgente_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Sorgente non trovata';
  end if;
  select v.* into v_variante
  from public.varianti_cantiere v where v.id = v_variante_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Variante non trovata';
  end if;
  if artecna_guardie.utente_puo_modificare_cantiere(v_utente, v_variante.cantiere_id) is not true then
    raise exception using errcode = '42501', message = 'Cantiere non autorizzato';
  end if;
  if v_variante.stato is distinct from 'bozza' then
    raise exception using errcode = '22023', message = 'Sorgenti modificabili solo in bozza';
  end if;
  delete from public.variante_sorgenti s
  where s.id = p_sorgente_id and s.variante_id = v_variante_id
  returning s.* into v_sorgente;
  if not found then
    raise exception using errcode = 'P0002', message = 'Sorgente non più disponibile';
  end if;
  return query select v_sorgente.id, v_sorgente.variante_id;
exception
  when serialization_failure or deadlock_detected then
    raise exception using errcode = SQLSTATE, message = 'Operazione concorrente: riprovare la transazione';
end;
$$;


revoke all on function public.aggiungi_sorgente_variante(uuid, text, uuid, text, text, text, text, integer, jsonb) from public, anon;
revoke all on function public.leggi_sorgenti_variante(uuid) from public, anon;
revoke all on function public.leggi_sorgente_variante(uuid) from public, anon;
revoke all on function public.rimuovi_sorgente_variante(uuid) from public, anon;

grant execute on function public.aggiungi_sorgente_variante(uuid, text, uuid, text, text, text, text, integer, jsonb) to authenticated;
grant execute on function public.leggi_sorgenti_variante(uuid) to authenticated;
grant execute on function public.leggi_sorgente_variante(uuid) to authenticated;
grant execute on function public.rimuovi_sorgente_variante(uuid) to authenticated;

reset role;
revoke create on schema public from artecna_varianti_rpc;
-- Elimina solo la concessione creata da postgres, non quella originale.
revoke artecna_varianti_rpc from postgres granted by postgres restrict;

do $verify$
declare
  v_firma text;
  v_funzione pg_catalog.pg_proc%rowtype;
begin
  if current_user <> 'postgres'
    or (select count(*) from pg_catalog.pg_auth_members
        where roleid = 'artecna_varianti_rpc'::regrole
          and member = 'postgres'::regrole) <> 1
    or not exists (
      select 1 from pg_catalog.pg_auth_members
      where roleid = 'artecna_varianti_rpc'::regrole
        and member = 'postgres'::regrole
        and grantor = 'supabase_admin'::regrole
        and admin_option and not inherit_option and not set_option
    ) then
    raise exception 'Membership originale non ripristinata';
  end if;
  if pg_has_role('postgres', 'artecna_varianti_rpc', 'SET')
    or has_schema_privilege('artecna_varianti_rpc', 'public', 'CREATE')
    or not has_schema_privilege('artecna_varianti_rpc', 'public', 'USAGE') then
    raise exception 'Privilegi temporanei non ripristinati';
  end if;
  if not exists (
    select 1 from pg_catalog.pg_roles
    where rolname = 'artecna_varianti_rpc'
      and not rolcanlogin and not rolsuper and not rolinherit and rolbypassrls
  ) then
    raise exception 'Attributi ruolo tecnico inattesi';
  end if;
  if not has_table_privilege('artecna_varianti_rpc', 'public.variante_sorgenti', 'SELECT')
    or not has_table_privilege('artecna_varianti_rpc', 'public.variante_sorgenti', 'INSERT')
    or not has_table_privilege('artecna_varianti_rpc', 'public.variante_sorgenti', 'DELETE')
    or has_any_column_privilege('artecna_varianti_rpc', 'public.variante_sorgenti', 'UPDATE') then
    raise exception 'Privilegi tabella sorgenti inattesi';
  end if;
  foreach v_firma in array array[
    'public.aggiungi_sorgente_variante(uuid,text,uuid,text,text,text,text,integer,jsonb)',
    'public.leggi_sorgenti_variante(uuid)',
    'public.leggi_sorgente_variante(uuid)',
    'public.rimuovi_sorgente_variante(uuid)'
  ] loop
    select p.* into v_funzione from pg_catalog.pg_proc p
    where p.oid = to_regprocedure(v_firma);
    if not found then
      raise exception 'RPC assente: %', v_firma;
    end if;
    if v_funzione.proowner <> 'artecna_varianti_rpc'::regrole
      or not v_funzione.prosecdef
      or v_funzione.proconfig is distinct from array['search_path=pg_catalog, pg_temp']::text[]
      or not has_function_privilege('authenticated', v_funzione.oid, 'EXECUTE')
      or has_function_privilege('anon', v_funzione.oid, 'EXECUTE')
      or exists (
        select 1 from pg_catalog.aclexplode(
          coalesce(v_funzione.proacl, pg_catalog.acldefault('f', v_funzione.proowner))
        ) a
        where a.grantee not in ('artecna_varianti_rpc'::regrole, 'authenticated'::regrole)
          or (a.grantee = 'authenticated'::regrole and a.is_grantable)
      ) then
      raise exception 'Owner, sicurezza o ACL inattesi: %', v_firma;
    end if;
  end loop;
end;
$verify$;

commit;
