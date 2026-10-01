begin;

-- Patch della definizione installata: nessuna ricostruzione del corpo RPC.
-- PostgreSQL 17; stesso pattern di membership temporanea delle migration Varianti.
-- Se le precondizioni amministrative differiscono, interrompe senza modificarle.
do $preflight$
begin
  if current_user <> 'postgres' or session_user <> 'postgres'
    or current_setting('server_version_num')::integer / 10000 <> 17 then
    raise exception 'Installazione prevista come postgres su PostgreSQL 17';
  end if;
  if (select count(*) from pg_catalog.pg_auth_members
      where roleid = 'artecna_sal_rpc'::regrole and member = 'postgres'::regrole) <> 1
    or not exists (
      select 1 from pg_catalog.pg_auth_members
      where roleid = 'artecna_sal_rpc'::regrole and member = 'postgres'::regrole
        and grantor = 'supabase_admin'::regrole
        and admin_option and not inherit_option and not set_option
    )
    or pg_has_role('postgres', 'artecna_sal_rpc', 'SET')
    or has_schema_privilege('artecna_sal_rpc', 'public', 'CREATE') then
    raise exception 'Membership o privilegi iniziali inattesi: installazione interrotta';
  end if;
end;
$preflight$;

grant artecna_sal_rpc to postgres
  with admin false, inherit false, set true granted by postgres;
grant create on schema public to artecna_sal_rpc;
set local role artecna_sal_rpc;

do $patch$
declare
  v_prima pg_catalog.pg_proc%rowtype;
  v_dopo pg_catalog.pg_proc%rowtype;
  v_definizione text;
  v_vecchio constant text := $old$    ELSIF p_completata THEN
        v_percentuale := coalesce(v_sal.percentuale,0);
        v_completata := true;$old$;
  v_nuovo constant text := $new$    ELSIF p_completata THEN
        IF v_classe IN ('STRUTTURATA_BASE', 'STRUTTURATA_VARIANTE') THEN
            v_percentuale := 100;
        ELSE
            v_percentuale := coalesce(v_sal.percentuale,0);
        END IF;
        v_completata := true;$new$;
begin
  select p.* into v_prima from pg_catalog.pg_proc p
  where p.oid = to_regprocedure('public.aggiorna_avanzamento_sal(bigint,numeric,boolean)');
  if not found then
    raise exception 'RPC SAL installata non disponibile';
  end if;
  if current_user <> 'artecna_sal_rpc'
    or v_prima.proowner <> 'artecna_sal_rpc'::regrole
    or not v_prima.prosecdef
    or v_prima.proconfig is distinct from array['search_path=pg_catalog, pg_temp']::text[]
    or not has_function_privilege('authenticated', v_prima.oid, 'EXECUTE')
    or has_function_privilege('anon', v_prima.oid, 'EXECUTE')
    or exists (
      select 1 from pg_catalog.aclexplode(
        coalesce(v_prima.proacl, pg_catalog.acldefault('f', v_prima.proowner))
      ) a where a.grantee = 0 and a.privilege_type = 'EXECUTE'
    ) then
    raise exception 'Owner, sicurezza, search_path o EXECUTE RPC SAL inattesi';
  end if;

  v_definizione := pg_catalog.pg_get_functiondef(v_prima.oid);
  if (length(v_prima.prosrc) - length(replace(v_prima.prosrc, v_vecchio, '')))
      <> length(v_vecchio)
    or (length(v_definizione) - length(replace(v_definizione, v_vecchio, '')))
      <> length(v_vecchio) then
    raise exception 'Ramo checklist atteso non univoco o gia modificato: nessuna patch applicata';
  end if;

  -- pg_get_functiondef produce CREATE OR REPLACE con firma e RETURNS installati.
  -- Tutto il resto del corpo, inclusi JWT, legacy e P2037 prima dell'UPDATE,
  -- resta letteralmente invariato. Non esegue la RPC e non modifica dati SAL.
  execute replace(v_definizione, v_vecchio, v_nuovo);

  select p.* into strict v_dopo from pg_catalog.pg_proc p where p.oid = v_prima.oid;
  if v_dopo.prosrc is distinct from replace(v_prima.prosrc, v_vecchio, v_nuovo)
    or (to_jsonb(v_dopo) - 'prosrc') is distinct from (to_jsonb(v_prima) - 'prosrc') then
    raise exception 'La patch ha modificato attributi diversi dal ramo checklist';
  end if;
end;
$patch$;

reset role;
revoke create on schema public from artecna_sal_rpc;
revoke artecna_sal_rpc from postgres granted by postgres restrict;

do $verify$
begin
  if current_user <> 'postgres'
    or (select count(*) from pg_catalog.pg_auth_members
        where roleid = 'artecna_sal_rpc'::regrole and member = 'postgres'::regrole) <> 1
    or not exists (
      select 1 from pg_catalog.pg_auth_members
      where roleid = 'artecna_sal_rpc'::regrole and member = 'postgres'::regrole
        and grantor = 'supabase_admin'::regrole
        and admin_option and not inherit_option and not set_option
    )
    or pg_has_role('postgres', 'artecna_sal_rpc', 'SET')
    or has_schema_privilege('artecna_sal_rpc', 'public', 'CREATE') then
    raise exception 'Privilegi temporanei non ripristinati';
  end if;
end;
$verify$;

commit;
