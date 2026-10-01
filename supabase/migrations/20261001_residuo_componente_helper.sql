begin;

-- Helper interno: snapshot di lettura, non autorizza un utente e non acquisisce lock.
-- Le future RPC chiamanti devono autorizzare il cantiere e coordinare i lock
-- prima di usare il risultato per una scrittura. SAL assente non significa zero.
do $preflight$
declare
  v_tabella text;
  v_colonne text;
  v_colonna text;
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
    or has_schema_privilege('artecna_sal_rpc', 'artecna_guardie', 'CREATE') then
    raise exception 'Membership o privilegi temporanei iniziali inattesi';
  end if;
  if not has_schema_privilege('artecna_sal_rpc', 'artecna_guardie', 'USAGE')
    or not has_schema_privilege('artecna_varianti_rpc', 'artecna_guardie', 'USAGE')
    or not has_schema_privilege('artecna_sal_rpc', 'public', 'USAGE')
    or not exists (select 1 from pg_catalog.pg_roles
      where rolname = 'artecna_sal_rpc' and not rolcanlogin and not rolsuper and rolbypassrls) then
    raise exception 'Schema o ruolo tecnico non conformi';
  end if;
  for v_tabella, v_colonne in
    select * from (values
      ('cantieri', 'id,preventivo_contrattuale_id'),
      ('preventivi_cantiere', 'id,cantiere_id'),
      ('preventivo_lavorazioni', 'id,cantiere_id,preventivo_id,unita_misura,quantita,prezzo_unitario,importo_previsto'),
      ('varianti_cantiere', 'id,cantiere_id,preventivo_contrattuale_id,stato'),
      ('variante_lavorazioni', 'id,variante_id,operazione,descrizione,unita_misura,quantita_delta,prezzo_unitario,delta_contratto,riferimento_preventivo_lavorazione_id,riferimento_variante_lavorazione_id'),
      ('sal_lavorazioni', 'id,cantiere_id,source_lavorazione_id,source_variante_lavorazione_id,importo_previsto,percentuale')
    ) as permessi(tabella, colonne)
  loop
    foreach v_colonna in array string_to_array(v_colonne, ',') loop
      if not has_column_privilege('artecna_sal_rpc', 'public.' || v_tabella, v_colonna, 'SELECT') then
        raise exception 'Privilegio SELECT mancante su %.%; nessuna ACL tabella modificata', v_tabella, v_colonna;
      end if;
    end loop;
  end loop;
  -- Descrizione separata: false e true sono entrambi stati iniziali ammessi.
  -- Il GRANT successivo assicura il privilegio anche se era gia presente.
  if has_column_privilege(
    'artecna_sal_rpc', 'public.preventivo_lavorazioni', 'descrizione', 'SELECT'
  ) is null then
    raise exception 'Impossibile verificare il SELECT iniziale sulla descrizione';
  end if;
end;
$preflight$;

-- Unico nuovo privilegio runtime: resta attivo dopo l'installazione.
-- Il preflight ha gia verificato tutti gli altri SELECT richiesti.
-- Eseguito come postgres, prima del cambio di ruolo tecnico.
grant select (descrizione) on public.preventivo_lavorazioni to artecna_sal_rpc;
do $verify_descrizione$
begin
  if not has_column_privilege(
    'artecna_sal_rpc', 'public.preventivo_lavorazioni', 'descrizione', 'SELECT'
  ) then
    raise exception 'SELECT sulla descrizione del preventivo non effettivo';
  end if;
end;
$verify_descrizione$;

grant artecna_sal_rpc to postgres
  with admin false, inherit false, set true granted by postgres;
grant create on schema artecna_guardie to artecna_sal_rpc;
set local role artecna_sal_rpc;

create function artecna_guardie.calcola_residuo_componente(
  p_tipo text,
  p_componente_id bigint,
  p_cantiere_id uuid,
  p_preventivo_contrattuale_id uuid
) returns table (
  tipo_componente text, componente_id bigint, cantiere_id uuid,
  preventivo_contrattuale_id uuid,
  descrizione text, unita_misura text, prezzo_unitario numeric,
  quantita_originaria numeric, importo_originario numeric,
  quantita_ridotta_approvata numeric, importo_ridotto_approvato numeric,
  quantita_contrattuale numeric, importo_contrattuale numeric,
  sal_presente boolean, sal_id bigint, percentuale numeric,
  maturato_verificabile boolean,
  quantita_maturata numeric, importo_maturato numeric,
  quantita_riducibile numeric, importo_riducibile numeric
)
language plpgsql
stable
security definer
set search_path = pg_catalog, pg_temp
as $function$
declare
  v_s record;
  v_sal record;
  v_rq numeric;
  v_ri numeric;
  v_valide boolean;
  v_num_sal integer := 0;
begin
  if current_user <> 'artecna_sal_rpc' then
    raise exception using errcode = '42501', message = 'Owner helper residuo non corretto';
  end if;
  if p_tipo is null or p_tipo not in ('preventivo', 'variante')
    or p_componente_id is null or p_componente_id <= 0
    or p_cantiere_id is null or p_preventivo_contrattuale_id is null then
    raise exception using errcode = 'P2031', message = 'Identita componente o contesto non validi';
  end if;
  if not exists (
    select 1 from public.cantieri c
    join public.preventivi_cantiere p on p.id = c.preventivo_contrattuale_id
    where c.id = p_cantiere_id and p.id = p_preventivo_contrattuale_id
      and p.cantiere_id = p_cantiere_id
  ) then
    raise exception using errcode = 'P2033', message = 'Contratto corrente o cantiere incoerente';
  end if;

  if p_tipo = 'preventivo' then
    select b.descrizione, b.unita_misura, b.prezzo_unitario,
           b.quantita as q, b.importo_previsto as i
    into v_s from public.preventivo_lavorazioni b
    where b.id = p_componente_id and b.cantiere_id = p_cantiere_id
      and b.preventivo_id = p_preventivo_contrattuale_id;
    if not found then
      raise exception using errcode = 'P2033', message = 'Componente preventivo non disponibile nel contratto';
    end if;
  else
    select l.descrizione, l.unita_misura, l.prezzo_unitario,
           l.quantita_delta as q, l.delta_contratto as i
    into v_s from public.variante_lavorazioni l
    join public.varianti_cantiere v on v.id = l.variante_id
    where l.id = p_componente_id and l.operazione in ('nuova', 'aumento')
      and v.stato = 'approvata' and v.cantiere_id = p_cantiere_id
      and v.preventivo_contrattuale_id = p_preventivo_contrattuale_id;
    if not found then
      raise exception using errcode = 'P2035', message = 'Componente Variante positiva approvata non disponibile';
    end if;
  end if;
  if v_s.descrizione is null or v_s.descrizione !~ '[^[:space:]]'
    or v_s.unita_misura is null or v_s.unita_misura !~ '[^[:space:]]'
    or v_s.q is null or v_s.q <= 0 or v_s.q::text in ('NaN', 'Infinity', '-Infinity')
    or v_s.i is null or v_s.i < 0 or v_s.i::text in ('NaN', 'Infinity', '-Infinity')
    or (p_tipo = 'variante' and v_s.i <= 0)
    or v_s.prezzo_unitario is null or v_s.prezzo_unitario < 0
    or v_s.prezzo_unitario::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception using errcode = 'P2033', message = 'Valori canonici componente non validi';
  end if;

  select coalesce(sum(l.quantita_delta), 0), coalesce(sum(l.delta_contratto), 0),
    coalesce(bool_and(coalesce(
      l.quantita_delta < 0 and l.delta_contratto < 0
      and l.quantita_delta::text not in ('NaN', 'Infinity', '-Infinity')
      and l.delta_contratto::text not in ('NaN', 'Infinity', '-Infinity')
      and case when p_tipo = 'preventivo'
        then l.riferimento_variante_lavorazione_id is null
        else l.riferimento_preventivo_lavorazione_id is null end, false)), true)
  into v_rq, v_ri, v_valide
  from public.variante_lavorazioni l
  join public.varianti_cantiere v on v.id = l.variante_id
  where v.stato = 'approvata' and v.cantiere_id = p_cantiere_id
    and v.preventivo_contrattuale_id = p_preventivo_contrattuale_id
    and l.operazione in ('riduzione_residua', 'eliminazione_residua')
    and ((p_tipo = 'preventivo' and l.riferimento_preventivo_lavorazione_id = p_componente_id)
      or (p_tipo = 'variante' and l.riferimento_variante_lavorazione_id = p_componente_id));
  if not v_valide then
    raise exception using errcode = 'P2037', message = 'Correzione approvata incoerente';
  end if;

  tipo_componente := p_tipo;
  componente_id := p_componente_id;
  cantiere_id := p_cantiere_id;
  preventivo_contrattuale_id := p_preventivo_contrattuale_id;
  descrizione := v_s.descrizione;
  unita_misura := v_s.unita_misura;
  prezzo_unitario := v_s.prezzo_unitario;
  quantita_originaria := v_s.q;
  importo_originario := v_s.i;
  -- Ridotto espresso come grandezza positiva; le somme sorgente sono negative.
  quantita_ridotta_approvata := -v_rq;
  importo_ridotto_approvato := -v_ri;
  quantita_contrattuale := v_s.q + v_rq;
  importo_contrattuale := v_s.i + v_ri;
  if quantita_contrattuale < 0 or importo_contrattuale < 0
    or quantita_contrattuale::text in ('NaN', 'Infinity', '-Infinity')
    or importo_contrattuale::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception using errcode = 'P2037', message = 'Contratto residuo negativo o non finito';
  end if;

  sal_presente := false;
  maturato_verificabile := false;
  -- Gli altri OUT SAL/maturato/riducibile restano NULL se manca il SAL.
  for v_sal in
    select s.id, s.cantiere_id, s.source_lavorazione_id,
      s.source_variante_lavorazione_id, s.importo_previsto, s.percentuale
    from public.sal_lavorazioni s
    where (p_tipo = 'preventivo' and s.source_lavorazione_id = p_componente_id)
      or (p_tipo = 'variante' and s.source_variante_lavorazione_id = p_componente_id)
  loop
    v_num_sal := v_num_sal + 1;
    if v_num_sal > 1 then
      raise exception using errcode = 'P2038', message = 'Piu righe SAL per lo stesso componente';
    end if;
    if v_sal.source_lavorazione_id is not null and v_sal.source_variante_lavorazione_id is not null then
      raise exception using errcode = 'P2038', message = 'Riga SAL con doppia sorgente';
    end if;
    if v_sal.cantiere_id is distinct from p_cantiere_id then
      raise exception using errcode = 'P2033', message = 'Cantiere SAL incoerente';
    end if;
    if v_sal.importo_previsto is distinct from importo_originario then
      raise exception using errcode = 'P2034', message = 'Importo SAL diverso dalla sorgente';
    end if;
    if v_sal.percentuale is null or v_sal.percentuale < 0 or v_sal.percentuale > 100
      or v_sal.percentuale::text in ('NaN', 'Infinity', '-Infinity') then
      raise exception using errcode = 'P2036', message = 'Percentuale SAL non valida';
    end if;
    sal_presente := true;
    sal_id := v_sal.id;
    percentuale := v_sal.percentuale;
    quantita_maturata := round(quantita_originaria * percentuale / 100, 6);
    importo_maturato := round(importo_originario * percentuale / 100, 2);
    quantita_riducibile := quantita_contrattuale - quantita_maturata;
    importo_riducibile := importo_contrattuale - importo_maturato;
    if quantita_maturata > quantita_contrattuale or importo_maturato > importo_contrattuale
      or quantita_riducibile < 0 or importo_riducibile < 0 then
      raise exception using errcode = 'P2037', message = 'Maturato superiore al contratto residuo';
    end if;
    maturato_verificabile := true;
  end loop;
  return next;
exception when numeric_value_out_of_range then
  raise exception using errcode = 'P2037', message = 'Valori quantitativi o economici non rappresentabili';
end;
$function$;

revoke all on function artecna_guardie.calcola_residuo_componente(text,bigint,uuid,uuid)
  from public, anon, authenticated;
grant execute on function artecna_guardie.calcola_residuo_componente(text,bigint,uuid,uuid)
  to artecna_varianti_rpc;

reset role;
revoke create on schema artecna_guardie from artecna_sal_rpc;
revoke artecna_sal_rpc from postgres granted by postgres restrict;

do $verify$
declare
  v_f pg_catalog.pg_proc%rowtype;
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
    or has_schema_privilege('artecna_sal_rpc', 'artecna_guardie', 'CREATE') then
    raise exception 'Privilegi temporanei non ripristinati';
  end if;
  if not has_column_privilege(
    'artecna_sal_rpc', 'public.preventivo_lavorazioni', 'descrizione', 'SELECT'
  ) then
    raise exception 'Privilegio runtime SELECT(descrizione) non preservato';
  end if;
  select p.* into strict v_f from pg_catalog.pg_proc p
  where p.oid = 'artecna_guardie.calcola_residuo_componente(text,bigint,uuid,uuid)'::regprocedure;
  if v_f.proowner <> 'artecna_sal_rpc'::regrole or not v_f.prosecdef or v_f.provolatile <> 's'
    or v_f.proconfig is distinct from array['search_path=pg_catalog, pg_temp']::text[]
    or has_function_privilege('authenticated', v_f.oid, 'EXECUTE')
    or has_function_privilege('anon', v_f.oid, 'EXECUTE')
    or not has_function_privilege('artecna_sal_rpc', v_f.oid, 'EXECUTE')
    or not has_function_privilege('artecna_varianti_rpc', v_f.oid, 'EXECUTE')
    or exists (
      select 1 from pg_catalog.aclexplode(coalesce(v_f.proacl, pg_catalog.acldefault('f', v_f.proowner))) a
      where a.grantee not in ('artecna_sal_rpc'::regrole, 'artecna_varianti_rpc'::regrole)
        or (a.grantee = 'artecna_varianti_rpc'::regrole and a.is_grantable)
    ) then
    raise exception 'Owner, sicurezza o ACL helper inattesi';
  end if;
end;
$verify$;

commit;
