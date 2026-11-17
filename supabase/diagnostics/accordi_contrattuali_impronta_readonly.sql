SELECT md5(jsonb_build_array(
 (SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'')) FROM public.cantieri t),
 (SELECT md5(coalesce(jsonb_agg(to_jsonb(t)-'accordo_contrattuale' ORDER BY id)::text,'')) FROM public.preventivi_cantiere t),
 (SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'')) FROM public.preventivo_lavorazioni t),
 (SELECT md5(coalesce(jsonb_agg(to_jsonb(t)-'accordo_riga' ORDER BY id)::text,'')) FROM public.sal_lavorazioni t),
 (SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'')) FROM public.fatture_emesse t),
 (SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'')) FROM public.acconti_cantiere t),
 (SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'')) FROM artecna_contabilita.incassi_lordi_clienti t),
 (SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'')) FROM public.varianti_cantiere t),
 (SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY id)::text,'')) FROM public.variante_sorgenti t),
 (SELECT md5(pg_get_functiondef('public.elimina_cantiere_definitivamente(uuid,text)'::regprocedure))),
 (SELECT md5(coalesce(jsonb_agg(jsonb_build_array(oid::regprocedure::text,prosrc,proacl::text,proconfig) ORDER BY oid)::text,'')) FROM pg_proc WHERE pronamespace='artecna_notifiche'::regnamespace),
 (SELECT md5(coalesce(jsonb_agg(to_jsonb(t) ORDER BY jobid)::text,'')) FROM cron.job t)
)::text) AS impronta
\gset
