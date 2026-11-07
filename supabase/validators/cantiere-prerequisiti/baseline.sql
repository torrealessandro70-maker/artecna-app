-- Schema-only synthetic test fixture derived from the supplied export.
-- No Production rows, credentials or connection configuration.
SET check_function_bodies=off;
CREATE SCHEMA auth;
CREATE SCHEMA extensions;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
CREATE FUNCTION public.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;
CREATE FUNCTION extensions.uuid_generate_v4() RETURNS uuid LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;
CREATE ROLE "anon" NOLOGIN NOBYPASSRLS;
CREATE ROLE "authenticated" NOLOGIN NOBYPASSRLS;
CREATE ROLE "service_role" NOLOGIN NOBYPASSRLS;
CREATE ROLE "artecna_cantieri_delete_rpc" NOLOGIN BYPASSRLS;
CREATE ROLE "artecna_cantieri_rpc" NOLOGIN BYPASSRLS;
CREATE ROLE "artecna_economia_rpc" NOLOGIN BYPASSRLS;
CREATE ROLE "artecna_foto_v1_writer" NOLOGIN BYPASSRLS;
CREATE ROLE "artecna_materiali_fattura_rpc" NOLOGIN BYPASSRLS;
CREATE ROLE "artecna_ponte_economia_rpc" NOLOGIN BYPASSRLS;
CREATE ROLE "artecna_preventivi_rpc" NOLOGIN BYPASSRLS;
CREATE ROLE "artecna_rapportini_rpc" NOLOGIN BYPASSRLS;
CREATE ROLE "artecna_sal_rpc" NOLOGIN BYPASSRLS;
CREATE ROLE "artecna_varianti_rpc" NOLOGIN BYPASSRLS;
CREATE ROLE "artecna_rapportini_backend" NOLOGIN BYPASSRLS;
CREATE SCHEMA "artecna_rapportini";
CREATE SCHEMA "artecna_distruzione";
CREATE SCHEMA "artecna_guardie";
CREATE SCHEMA "artecna_contabilita";
CREATE SCHEMA "artecna_foto_desktop";
CREATE SCHEMA "artecna_clienti_sicurezza";
CREATE TABLE "public"."materiali_cantiere"("id" uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
"cantiere" text NOT NULL,
"descrizione" text,
"quantita" numeric DEFAULT 0,
"prezzo_unitario" numeric DEFAULT 0,
"totale" numeric DEFAULT 0,
"fornitore" text,
"data_documento" date,
"nome_file" text,
"created_at" timestamp with time zone DEFAULT now(),
"file_url" text,
"file_tipo" text,
"anteprima_testo" text,
"nota" text,
"file_path" text,
"cantiere_id" uuid,
"fattura_riga_id" uuid,
"unita_misura" text);
CREATE TABLE "public"."fatture_fornitori_righe"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"fattura_id" uuid,
"numero_riga" integer,
"descrizione" text,
"quantita" numeric DEFAULT 0,
"prezzo_unitario" numeric DEFAULT 0,
"totale_riga" numeric DEFAULT 0,
"cantiere" text,
"stato" text DEFAULT 'da_assegnare'::text,
"created_at" timestamp with time zone DEFAULT now(),
"aliquota_iva" numeric DEFAULT 0,
"unita_misura" text,
"categoria_economica" text,
"cantiere_id" uuid);
CREATE TABLE "public"."variante_documenti"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"variante_id" uuid NOT NULL,
"nome_file" text NOT NULL,
"storage_path" text NOT NULL,
"mime_type" text,
"tipo" text DEFAULT 'documento'::text NOT NULL,
"note" text DEFAULT ''::text NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE "public"."rapportini"("id" uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
"cantiere" text,
"data" date,
"ore" text,
"note" text,
"created_at" timestamp without time zone DEFAULT now(),
"operai" text,
"numero_presenti" text,
"ore_per_operaio" text,
"materiali" text,
"quantita_materiali" text,
"costo_materiali" text,
"costo_manodopera" double precision DEFAULT 0,
"cantiere_id" uuid,
"compilato_da_operaio_id" uuid,
"compilato_da_nome" text,
"versione_prestazioni" smallint DEFAULT 0 NOT NULL,
"revisione_prestazioni" bigint DEFAULT 0 NOT NULL,
"versione_materiali" smallint DEFAULT 0 NOT NULL);
CREATE TABLE "public"."foto_cantiere"("id" uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
"cantiere" text,
"nota" text,
"immagine_base64" text,
"created_at" timestamp without time zone DEFAULT now(),
"data_foto" text,
"geolocalizzazione" text,
"categoria" text,
"file_url" text,
"file_path" text,
"thumbnail_url" text,
"storage_provider" text DEFAULT 'cloud'::text,
"sync_status" text DEFAULT 'not_required'::text,
"rapportino_id" text,
"sopralluogo_id" text,
"cantiere_id" uuid,
"allegato_v1_id" uuid);
CREATE TABLE "public"."timbrature"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"operaio_nome" text NOT NULL,
"cantiere" text NOT NULL,
"data" text NOT NULL,
"ora_entrata" text,
"ora_uscita" text,
"stato" text DEFAULT 'aperto'::text,
"created_at" timestamp with time zone DEFAULT now(),
"cantiere_id" uuid,
"rapportino_id" uuid,
"operaio_id" uuid,
"pausa_minuti" integer DEFAULT 0 NOT NULL,
"prestazione_rapportino_id" uuid);
CREATE TABLE "public"."attrezzi_cantiere"("id" uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
"cantiere" text NOT NULL,
"descrizione" text,
"categoria" text,
"quantita" numeric DEFAULT 0,
"prezzo_unitario" numeric DEFAULT 0,
"totale" numeric DEFAULT 0,
"fornitore" text,
"data_documento" date,
"nome_file" text,
"nota" text,
"created_at" timestamp with time zone DEFAULT now(),
"file_url" text,
"file_tipo" text,
"anteprima_testo" text,
"file_path" text,
"cantiere_id" uuid);
CREATE TABLE "public"."pagamenti_fornitori"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"fornitore_nome" text,
"cantiere" text,
"descrizione" text,
"importo_totale" numeric DEFAULT 0,
"importo_pagato" numeric DEFAULT 0,
"data_documento" date,
"data_scadenza" date,
"metodo" text,
"nota" text,
"created_at" timestamp with time zone DEFAULT now(),
"cantiere_id" uuid);
CREATE TABLE "public"."incassi_non_fatturati"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"data_incasso" date,
"cliente" text,
"cantiere" text,
"descrizione" text,
"importo" numeric DEFAULT 0,
"metodo" text,
"stato" text DEFAULT 'non_fatturato'::text,
"note" text,
"created_at" timestamp with time zone DEFAULT now(),
"cantiere_id" uuid);
CREATE TABLE "public"."fatture_fornitori"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"fornitore" text,
"partita_iva" text,
"numero_fattura" text,
"data_fattura" date,
"data_ricezione" date,
"tipo_documento" text DEFAULT 'fattura'::text,
"importo_totale" numeric DEFAULT 0,
"nome_file" text,
"tipo_file" text,
"xml_testo" text,
"pdf_testo" text,
"stato" text DEFAULT 'da_assegnare'::text,
"note" text,
"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE "public"."variante_lavorazioni"("id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
"variante_id" uuid NOT NULL,
"numero_riga" integer NOT NULL,
"operazione" text NOT NULL,
"descrizione" text NOT NULL,
"unita_misura" text,
"quantita_delta" numeric(18,6) NOT NULL,
"prezzo_unitario" numeric(18,6) NOT NULL,
"delta_contratto" numeric(18,2) NOT NULL,
"riferimento_preventivo_lavorazione_id" bigint,
"riferimento_variante_lavorazione_id" bigint,
"note" text DEFAULT ''::text NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"variante_sorgente_id" uuid,
"indice_voce_sorgente" integer);
CREATE TABLE "public"."variante_sorgenti"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"variante_id" uuid NOT NULL,
"tipo" text NOT NULL,
"preventivo_sorgente_id" uuid,
"titolo" text NOT NULL,
"nome_file" text,
"formato" text,
"file_sha256" text,
"snapshot_version" integer DEFAULT 1 NOT NULL,
"snapshot" jsonb NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"economia_raccolta_id" uuid,
"economia_revisione_sorgente" bigint,
"economia_revisione_congelata" bigint);
CREATE TABLE "public"."preventivi_cantiere"("id" uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
"cantiere" text NOT NULL,
"importo_totale" numeric DEFAULT 0,
"nome_file" text,
"note" text,
"created_at" timestamp with time zone DEFAULT now(),
"file_url" text,
"file_tipo" text,
"anteprima_testo" text,
"file_path" text,
"sopralluogo_id" uuid,
"origine_ai" boolean DEFAULT false,
"stato_preventivo" text DEFAULT 'bozza'::text,
"descrizione_ai" text,
"json_voci_ai" jsonb,
"approvato" boolean DEFAULT false,
"data_approvazione" date,
"cliente_ai" text,
"telefono_ai" text,
"indirizzo_ai" text,
"data_preventivo" date,
"cantiere_id" uuid,
"archiviazione_key" uuid,
"archiviazione_payload_hash" text,
"natura" text,
"variante_id" uuid,
"preventivo_contrattuale_id" uuid,
"provenienza_generazione" jsonb);
CREATE TABLE "public"."preventivo_lavorazioni"("id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
"cantiere" text NOT NULL,
"descrizione" text NOT NULL,
"importo_previsto" numeric DEFAULT 0,
"quantita" numeric DEFAULT 0,
"prezzo_unitario" numeric DEFAULT 0,
"unita_misura" text,
"fonte" text DEFAULT 'manuale'::text,
"created_at" timestamp with time zone DEFAULT now(),
"cantiere_id" uuid,
"preventivo_id" uuid);
CREATE TABLE "public"."varianti_cantiere"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"cantiere_id" uuid NOT NULL,
"preventivo_contrattuale_id" uuid NOT NULL,
"numero" integer,
"titolo" text NOT NULL,
"descrizione" text DEFAULT ''::text NOT NULL,
"stato" text DEFAULT 'bozza'::text NOT NULL,
"data_variante" date DEFAULT CURRENT_DATE NOT NULL,
"importo_delta_approvato" numeric(18,2),
"approvata_at" timestamp with time zone,
"riferimento_approvazione" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE "public"."cantieri"("id" uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
"nome" text,
"created_at" timestamp without time zone DEFAULT now(),
"preventivo" double precision DEFAULT '0'::double precision,
"data_inizio_lavori" date,
"data_fine_lavori" date,
"lavori_conclusi" boolean DEFAULT false,
"origine_preventivo_id" uuid,
"preventivo_contrattuale_id" uuid);
CREATE TABLE "public"."sal_lavorazioni"("id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
"cantiere" text NOT NULL,
"descrizione" text NOT NULL,
"importo_previsto" numeric DEFAULT 0,
"percentuale" numeric DEFAULT 0,
"importo_maturato" numeric DEFAULT 0,
"note" text,
"data_aggiornamento" date DEFAULT CURRENT_DATE,
"created_at" timestamp with time zone DEFAULT now(),
"completata" boolean DEFAULT false,
"cantiere_id" uuid,
"source_lavorazione_id" bigint,
"source_variante_lavorazione_id" bigint);
CREATE TABLE "public"."operai"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"nome" text NOT NULL,
"telefono" text,
"qualifica" text,
"created_at" timestamp with time zone DEFAULT now(),
"pin" text,
"nota" text,
"stato" text DEFAULT 'attivo'::text,
"costo_orario" numeric(10,2) DEFAULT 0,
"accesso_portale" boolean DEFAULT false NOT NULL);
CREATE TABLE "public"."pagamenti_operai"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"operaio_nome" text,
"importo" numeric DEFAULT 0,
"data_pagamento" date,
"metodo" text,
"nota" text,
"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE "public"."impostazioni_app"("id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
"chiave" text NOT NULL,
"valore" text);
CREATE TABLE "public"."spese_impresa"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"categoria" text,
"descrizione" text,
"importo" numeric DEFAULT 0,
"fornitore" text,
"data_documento" date,
"nome_file" text,
"fattura_id" uuid,
"riga_fattura_id" uuid,
"nota" text,
"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE "public"."sopralluoghi"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"cliente" text,
"telefono" text,
"indirizzo" text,
"data_sopralluogo" date,
"tipo_lavoro" text,
"note" text,
"stato" text DEFAULT 'da_preventivare'::text,
"preventivo_accettato" boolean DEFAULT false,
"data_inizio_lavori" date,
"created_at" timestamp with time zone DEFAULT now(),
"geolocalizzazione" text,
"firma_cliente" text,
"ora_appuntamento" text,
"promemoria" text);
CREATE TABLE "public"."foto_sopralluogo"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"sopralluogo_id" uuid,
"nota" text,
"immagine_base64" text,
"tag" text,
"includi_preventivo" boolean DEFAULT false,
"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE "public"."prezzi_lavorazioni"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"descrizione" text,
"unita_misura" text,
"prezzo_unitario" numeric,
"fonte" text,
"zona" text DEFAULT 'Catania'::text,
"categoria" text,
"note" text,
"created_at" timestamp without time zone DEFAULT now(),
"codice" text,
"regione" text,
"anno" integer,
"versione" text,
"tipo_prezzo" text,
"updated_at" timestamp without time zone DEFAULT now(),
"incidenza_manodopera" numeric,
"prezzo_manodopera" numeric,
"origine_prezzario_id" uuid);
CREATE TABLE "public"."memoria_prezzi"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"descrizione" text NOT NULL,
"categoria" text,
"unita_misura" text,
"prezzo_unitario" numeric,
"prezzo_totale" numeric,
"quantita" numeric,
"cantiere" text,
"fonte" text,
"provincia" text DEFAULT 'Catania'::text,
"note" text,
"creato_il" timestamp with time zone DEFAULT now());
CREATE TABLE "public"."prezziario_sicilia"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"codice" text,
"descrizione" text NOT NULL,
"unita_misura" text,
"prezzo_unitario" numeric,
"categoria" text,
"fonte" text DEFAULT 'Prezzario Regione Siciliana'::text,
"anno" integer DEFAULT 2024,
"provincia" text DEFAULT 'Sicilia'::text,
"created_at" timestamp with time zone DEFAULT now(),
"vigente" boolean DEFAULT true,
"data_validita_fino" date);
CREATE TABLE "public"."utilizzo_ai"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"tipo" text,
"modello" text,
"token_input" integer,
"token_output" integer,
"costo_stimato" numeric,
"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE "public"."note_sopralluogo"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"sopralluogo_id" text NOT NULL,
"user_id" uuid NOT NULL,
"titolo" text DEFAULT ''::text NOT NULL,
"testo" text DEFAULT ''::text NOT NULL,
"checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
"disegni" jsonb DEFAULT '[]'::jsonb NOT NULL,
"analisi_ai" jsonb,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"gestione_id" uuid);
CREATE TABLE "public"."note_allegati"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"nota_id" uuid NOT NULL,
"user_id" uuid NOT NULL,
"nome_file" text NOT NULL,
"tipo" text NOT NULL,
"mime_type" text,
"storage_path" text NOT NULL,
"url" text NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE "public"."agenda_attivita"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"user_id" uuid NOT NULL,
"titolo" text NOT NULL,
"descrizione" text DEFAULT ''::text NOT NULL,
"data" date NOT NULL,
"ora_inizio" time without time zone NOT NULL,
"ora_fine" time without time zone NOT NULL,
"tipo" text NOT NULL,
"stato" text DEFAULT 'da_fare'::text NOT NULL,
"checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
"collegamento" jsonb,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE "public"."utenti_cantiere"("cantiere_id" uuid NOT NULL,
"user_id" uuid NOT NULL,
"ruolo" text NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE "public"."variante_fonti_visive"("variante_id" uuid NOT NULL,
"source_type" text NOT NULL,
"source_id" uuid NOT NULL,
"source_version" timestamp with time zone,
"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
"foto_cantiere_id" uuid GENERATED ALWAYS AS (
CASE
    WHEN (source_type = 'foto_cantiere'::text) THEN source_id
    ELSE NULL::uuid
END) STORED,
"foto_sopralluogo_id" uuid GENERATED ALWAYS AS (
CASE
    WHEN (source_type = 'foto_sopralluogo'::text) THEN source_id
    ELSE NULL::uuid
END) STORED);
CREATE TABLE "public"."variante_osservatore_analisi"("id" uuid NOT NULL,
"variante_id" uuid NOT NULL,
"user_id" uuid NOT NULL,
"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
"modello" text NOT NULL,
"fonti" jsonb NOT NULL,
"risultato" jsonb NOT NULL);
CREATE TABLE "public"."economia_raccolte"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"cantiere_id" uuid NOT NULL,
"numero" integer NOT NULL,
"titolo" text NOT NULL,
"data" date NOT NULL,
"stato" text DEFAULT 'bozza'::text NOT NULL,
"note" text,
"revisione" bigint DEFAULT 0 NOT NULL,
"created_by" uuid NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"chiusa_at" timestamp with time zone);
CREATE TABLE "public"."economia_sorgenti"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"raccolta_id" uuid NOT NULL,
"tipo" text DEFAULT 'file'::text NOT NULL,
"nome_file" text NOT NULL,
"formato" text NOT NULL,
"file_sha256" text NOT NULL,
"snapshot_version" integer DEFAULT 1 NOT NULL,
"snapshot" jsonb NOT NULL,
"created_by" uuid NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE "public"."economia_righe"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"raccolta_id" uuid NOT NULL,
"ordine" integer NOT NULL,
"descrizione" text NOT NULL,
"unita_misura" text NOT NULL,
"quantita" numeric(18,6) NOT NULL,
"prezzo_unitario" numeric(18,6),
"note" text,
"origine" text NOT NULL,
"sorgente_id" uuid,
"indice_voce_sorgente" integer,
"created_by" uuid NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"tipo_riga" text DEFAULT 'generica'::text NOT NULL,
"dettagli_analitici" jsonb,
"rapportino_prestazione_id" uuid,
"prestazione_revisione_acquisita" bigint,
"prestazione_snapshot" jsonb,
"fattura_riga_id" uuid,
"prezzo_cliente_confermato_at" timestamp with time zone);
CREATE TABLE "artecna_rapportini"."richieste"("utente_id" uuid NOT NULL,
"richiesta_id" uuid NOT NULL,
"rapportino_id" uuid NOT NULL,
"payload_sha256" bytea NOT NULL,
"risultato" jsonb NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"canale" text DEFAULT 'desktop'::text NOT NULL);
CREATE TABLE "public"."rapportino_prestazioni"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"rapportino_id" uuid NOT NULL,
"operaio_id" uuid NOT NULL,
"chiave_client" text NOT NULL,
"ora_inizio" time without time zone NOT NULL,
"ora_fine" time without time zone NOT NULL,
"pausa_minuti" integer DEFAULT 0 NOT NULL,
"lavoro_in_economia" boolean DEFAULT false NOT NULL,
"variante_id" uuid,
"revisione" bigint DEFAULT 0 NOT NULL,
"rimossa_at" timestamp with time zone,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"ore" numeric GENERATED ALWAYS AS ((((EXTRACT(epoch FROM (ora_fine - ora_inizio)) / (60)::numeric) - (pausa_minuti)::numeric) / (60)::numeric)) STORED,
"costo_orario_interno_storico" numeric(10,2) NOT NULL);
CREATE TABLE "public"."rapportino_materiali"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"rapportino_id" uuid NOT NULL,
"chiave_client" text NOT NULL,
"descrizione" text NOT NULL,
"unita_misura" text NOT NULL,
"quantita" numeric(18,6) NOT NULL,
"costo_unitario" numeric(18,6),
"costo_totale" numeric(30,2) GENERATED ALWAYS AS (
CASE
    WHEN (costo_unitario IS NULL) THEN NULL::numeric
    ELSE round((quantita * costo_unitario), 2)
END) STORED,
"note" text DEFAULT ''::text NOT NULL,
"revisione" bigint DEFAULT 0 NOT NULL,
"rimossa_at" timestamp with time zone,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE "public"."quaderno_allegati"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"nota_id" uuid NOT NULL,
"user_id" uuid NOT NULL,
"nome_file" text NOT NULL,
"tipo" text NOT NULL,
"mime_type" text,
"storage_path" text NOT NULL,
"storage_bucket" text DEFAULT 'quaderno-privato'::text NOT NULL,
"url" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE "public"."quaderno_progetti"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"user_id" uuid NOT NULL,
"titolo" text DEFAULT ''::text NOT NULL,
"testo" text DEFAULT ''::text NOT NULL,
"checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
"disegni" jsonb DEFAULT '[]'::jsonb NOT NULL,
"analisi_ai" jsonb,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
"gestione_id" uuid,
"gestione_copia" boolean DEFAULT false NOT NULL);
CREATE TABLE "public"."acconti_cantiere"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"cantiere" text,
"descrizione" text,
"importo" numeric,
"data_incasso" date,
"metodo" text,
"nota" text,
"cantiere_id" uuid);
CREATE TABLE "public"."fatture_emesse"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"numero_fattura" text,
"data_fattura" date,
"cliente" text,
"cantiere" text,
"imponibile" numeric DEFAULT 0,
"iva" numeric DEFAULT 0,
"totale" numeric DEFAULT 0,
"importo_incassato" numeric DEFAULT 0,
"stato" text DEFAULT 'emessa'::text,
"note" text,
"created_at" timestamp with time zone DEFAULT now(),
"xml_url" text,
"pdf_url" text,
"cantiere_id" uuid);
CREATE TABLE "public"."variante_fonti_memory"("variante_id" uuid NOT NULL,
"source_type" text DEFAULT 'quaderno'::text NOT NULL,
"source_id" uuid NOT NULL,
"source_version" timestamp with time zone NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE "public"."quaderno_richiami_sopralluogo"("id" uuid NOT NULL,
"user_id" uuid NOT NULL,
"sopralluogo_id" text NOT NULL,
"nota_id" uuid,
"sorgente_id" uuid NOT NULL,
"sorgente_titolo" text NOT NULL,
"sorgente_updated_at" timestamp with time zone NOT NULL,
"richiamato_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
"nota_updated_at" timestamp with time zone,
"versione_base" timestamp with time zone,
"documento" jsonb NOT NULL,
"input_documento" jsonb NOT NULL,
"assets" jsonb NOT NULL,
"confermato_at" timestamp with time zone,
"pulito_at" timestamp with time zone,
"stato" text DEFAULT 'preparazione'::text NOT NULL,
"gestione_id" uuid);
CREATE TABLE "public"."quaderno_gestioni"("id" uuid NOT NULL,
"user_id" uuid NOT NULL,
"tipo" text NOT NULL,
"progetto_id" uuid,
"destinazione_id" uuid,
"richiamo_id" uuid,
"sopralluogo_id" text,
"annullata" boolean DEFAULT false NOT NULL,
"stato" text DEFAULT 'aperto'::text NOT NULL,
"documento" jsonb,
"assets" jsonb DEFAULT '[]'::jsonb NOT NULL,
"titolo" text DEFAULT ''::text NOT NULL,
"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
"concluso_at" timestamp with time zone);
CREATE TABLE "public"."quaderno_copie_allegati"("id" uuid NOT NULL,
"richiamo_id" uuid NOT NULL,
"nota_id" uuid NOT NULL,
"user_id" uuid NOT NULL,
"nome_file" text NOT NULL,
"tipo" text NOT NULL,
"mime_type" text,
"storage_bucket" text DEFAULT 'quaderno-sopralluoghi'::text NOT NULL,
"storage_path" text NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE "artecna_distruzione"."contesto"("transazione" xid8 NOT NULL,
"backend" integer NOT NULL,
"cantiere_id" uuid NOT NULL,
"user_id" uuid NOT NULL,
"ruolo" name NOT NULL,
"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL);
CREATE TABLE "artecna_distruzione"."cleanup_storage"("id" bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
"cantiere_id" uuid NOT NULL,
"bucket" text NOT NULL,
"path" text NOT NULL,
"stato" text DEFAULT 'pending'::text NOT NULL,
"tentativi" integer DEFAULT 0 NOT NULL,
"ultimo_errore" text DEFAULT ''::text NOT NULL,
"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
"completed_at" timestamp with time zone);
CREATE TABLE "artecna_rapportini"."sessioni_portale"("token_sha256" bytea NOT NULL,
"operaio_id" uuid NOT NULL,
"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
"scade_at" timestamp with time zone NOT NULL,
"revocata_at" timestamp with time zone);
CREATE TABLE "artecna_rapportini"."allegati"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"rapportino_id" uuid NOT NULL,
"cantiere_id" uuid NOT NULL,
"chiave_client_allegato" uuid NOT NULL,
"sha256" bytea NOT NULL,
"bucket" text NOT NULL,
"file_path" text NOT NULL,
"mime_type" text NOT NULL,
"byte_size" bigint NOT NULL,
"stato" text NOT NULL,
"foto_cantiere_id" uuid,
"created_at" timestamp with time zone DEFAULT statement_timestamp() NOT NULL,
"finalized_at" timestamp with time zone,
"expires_at" timestamp with time zone NOT NULL,
"removed_at" timestamp with time zone,
"lease_id" uuid,
"lease_until" timestamp with time zone);
CREATE TABLE "artecna_rapportini"."f3c3_capability"("foto_id" uuid NOT NULL,
"allegato_id" uuid NOT NULL,
"tx" xid8 NOT NULL,
"backend_pid" integer NOT NULL);
CREATE TABLE "public"."utenti_impresa"("user_id" uuid NOT NULL,
"ruolo" text NOT NULL,
"attivo" boolean DEFAULT true NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE "public"."materiali_impresa"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"fattura_riga_id" uuid NOT NULL,
"categoria" text NOT NULL,
"quantita" numeric NOT NULL,
"unita_misura" text NOT NULL,
"prezzo_unitario" numeric NOT NULL,
"totale" numeric NOT NULL,
"created_by" uuid NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"richiesta_id" uuid NOT NULL);
CREATE TABLE "artecna_guardie"."fatture_classificazione_richieste"("user_id" uuid NOT NULL,
"richiesta_id" uuid NOT NULL,
"fattura_id" uuid NOT NULL,
"payload" jsonb NOT NULL,
"risultato" jsonb NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE "artecna_contabilita"."attribuzioni_clienti"("id" uuid NOT NULL,
"fattura_id" uuid NOT NULL,
"acconto_id" uuid NOT NULL,
"cantiere_id" uuid NOT NULL,
"cliente_confermato" text NOT NULL,
"importo" numeric(14,2) NOT NULL,
"verificato" boolean NOT NULL,
"creato_da" uuid NOT NULL,
"creato_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
"scollegato_at" timestamp with time zone,
"scollegato_da" uuid,
"richiesta_scollega" uuid);
CREATE TABLE "public"."fornitori_rettifiche"("id" uuid DEFAULT gen_random_uuid() NOT NULL,
"nota_id" uuid NOT NULL,
"nota_riga_id" uuid NOT NULL,
"origine_id" uuid NOT NULL,
"origine_riga_id" uuid NOT NULL,
"economia_riga_id" uuid,
"materiale_cantiere_id" uuid,
"materiale_impresa_id" uuid,
"spesa_impresa_id" uuid,
"cantiere_id" uuid,
"categoria" text NOT NULL,
"quantita" numeric(18,6) NOT NULL,
"importo_netto" numeric(18,2) NOT NULL,
"importo_costo" numeric(18,2) NOT NULL,
"data_nota" date NOT NULL,
"richiesta_id" uuid NOT NULL,
"richiesta" jsonb NOT NULL,
"fotografia" jsonb NOT NULL,
"created_by" uuid NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;
ALTER FUNCTION public.rls_auto_enable() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.elimina_cantiere_definitivamente(p_cantiere_id uuid, p_conferma text)
 RETURNS TABLE(cantiere_id uuid, eliminato boolean, storage_nuovi bigint, conteggi jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  v_user uuid;
  v_id uuid;
  v_varianti uuid[];
  v_raccolte uuid[];
  v_economia_sorgenti uuid[];
  v_economia_righe uuid[];
  v_economia_figli constant text[]:=ARRAY['economia_sorgenti','economia_righe']::text[];
  v_preventivi text[];
  v_base_lavorazioni bigint[];
  v_var_lavorazioni bigint[];
  v_tabelle constant text[] := ARRAY['cantieri','rapportini','foto_cantiere','timbrature','materiali_cantiere','attrezzi_cantiere','pagamenti_fornitori','acconti_cantiere','fatture_emesse','fatture_fornitori_righe','incassi_non_fatturati','sal_lavorazioni','preventivo_lavorazioni','preventivi_cantiere','varianti_cantiere','utenti_cantiere','variante_lavorazioni','variante_documenti','variante_sorgenti','variante_fonti_memory','variante_fonti_visive','variante_osservatore_analisi','economia_raccolte','economia_sorgenti','economia_righe']::text[];
  v_figli constant text[] := ARRAY['variante_lavorazioni','variante_documenti','variante_sorgenti','variante_fonti_memory','variante_fonti_visive','variante_osservatore_analisi']::text[];
  v_dirette constant text[] := ARRAY['rapportini','foto_cantiere','timbrature','materiali_cantiere','attrezzi_cantiere','pagamenti_fornitori','acconti_cantiere','fatture_emesse','fatture_fornitori_righe','incassi_non_fatturati','sal_lavorazioni','preventivo_lavorazioni','preventivi_cantiere','varianti_cantiere','utenti_cantiere','economia_raccolte']::text[];
  v_eliminate jsonb := '{}'::jsonb;
  v_n bigint;
  v_integrativi bigint := 0; -- STEP5
  v_totale_lavorazioni bigint;
  v_residuo boolean;
  v_esterna boolean;
  v_on text;
  v_padre text;
  v_figlio text;
  v_sql text;
  v_jobs_prima record;
  v_jobs_vecchi record;
  v_jobs_preparati record;
  v_jobs_dopo record;
  t text;
  fk record;
  m record;
BEGIN
  IF current_user <> 'artecna_cantieri_delete_rpc' THEN
    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Ruolo RPC non autorizzato';
  END IF;
  IF p_cantiere_id IS NULL OR p_conferma IS DISTINCT FROM 'ELIMINA' THEN
    RAISE EXCEPTION USING ERRCODE='P2111',MESSAGE='UUID e conferma esatta ELIMINA obbligatori';
  END IF;
  v_user := artecna_guardie.utente_jwt_corrente();
  IF v_user IS NULL THEN RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Utente non autorizzato'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cantieri c WHERE c.id=p_cantiere_id) THEN
    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Cantiere assente o non autorizzato';
  END IF;
  SELECT c.id INTO v_id FROM public.cantieri c WHERE c.id=p_cantiere_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Cantiere assente o non autorizzato'; END IF;
  IF artecna_guardie.utente_puo_modificare_cantiere(v_user,p_cantiere_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Owner non autorizzato';
  END IF;
  PERFORM 1 FROM public.utenti_cantiere u WHERE u.cantiere_id=p_cantiere_id AND u.user_id=v_user AND u.ruolo='owner' FOR SHARE;
  IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,p_cantiere_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Owner non autorizzato dopo lock';
  END IF;
  PERFORM artecna_rapportini.compat_foto_verifica_cantiere(p_cantiere_id);
  PERFORM artecna_distruzione.inizia_contesto(p_cantiere_id);
  IF artecna_distruzione.contesto_valido(p_cantiere_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE='P2112',MESSAGE='Contesto non autorizzato';
  END IF;
  -- Blocca testate prima dei figli: impedisce nuovi riferimenti FK mentre opera.
  PERFORM v.id FROM public.varianti_cantiere v WHERE v.cantiere_id=p_cantiere_id ORDER BY v.id FOR UPDATE;
  SELECT coalesce(array_agg(v.id ORDER BY v.id),ARRAY[]::uuid[]) INTO v_varianti FROM public.varianti_cantiere v WHERE v.cantiere_id=p_cantiere_id;
  PERFORM e.id FROM public.economia_raccolte e WHERE e.cantiere_id=p_cantiere_id ORDER BY e.id FOR UPDATE;
  SELECT coalesce(array_agg(e.id ORDER BY e.id),ARRAY[]::uuid[]) INTO v_raccolte FROM public.economia_raccolte e WHERE e.cantiere_id=p_cantiere_id;
  FOREACH t IN ARRAY v_tabelle LOOP
    IF t='cantieri' THEN CONTINUE; END IF;
    IF t=ANY(v_economia_figli) THEN v_sql:=format('SELECT 1 FROM public.%I f WHERE f.raccolta_id=ANY($3) ORDER BY f.tableoid,f.ctid FOR UPDATE',t);
    ELSIF t=ANY(v_figli) THEN v_sql:=format('SELECT 1 FROM public.%I f WHERE f.variante_id=ANY($2) ORDER BY f.tableoid,f.ctid FOR UPDATE',t);
    ELSE v_sql:=format('SELECT 1 FROM public.%I f WHERE f.cantiere_id=$1 ORDER BY f.tableoid,f.ctid FOR UPDATE',t); END IF;
    FOR m IN EXECUTE v_sql USING p_cantiere_id,v_varianti,v_raccolte LOOP NULL; END LOOP;
  END LOOP;
  SELECT coalesce(array_agg(e.id ORDER BY e.id),ARRAY[]::uuid[]) INTO v_economia_sorgenti FROM public.economia_sorgenti e WHERE e.raccolta_id=ANY(v_raccolte);
  SELECT coalesce(array_agg(e.id ORDER BY e.id),ARRAY[]::uuid[]) INTO v_economia_righe FROM public.economia_righe e WHERE e.raccolta_id=ANY(v_raccolte);
  SELECT coalesce(array_agg(p.id::text ORDER BY p.id::text),ARRAY[]::text[]) INTO v_preventivi FROM public.preventivi_cantiere p WHERE p.cantiere_id=p_cantiere_id;
  SELECT coalesce(array_agg(p.id ORDER BY p.id),ARRAY[]::bigint[]) INTO v_base_lavorazioni FROM public.preventivo_lavorazioni p WHERE p.cantiere_id=p_cantiere_id;
  SELECT coalesce(array_agg(p.id ORDER BY p.id),ARRAY[]::bigint[]) INTO v_var_lavorazioni FROM public.variante_lavorazioni p WHERE p.variante_id=ANY(v_varianti);
  IF (SELECT count(*) FROM pg_catalog.pg_constraint k WHERE k.contype='f' AND k.conrelid IN ('public.economia_raccolte'::regclass,'public.economia_sorgenti'::regclass,'public.economia_righe'::regclass))<>5+artecna_distruzione.numero_fk_economia_rapportino() THEN
    RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='Inventario FK Economia divergente'; END IF;
  -- Ogni FK entrante: proprieta parent/child tramite UUID, mai per nome legacy.
  -- Una relazione esterna al manifest e' rifiutata anche se vuota: schema non certificato.
  FOR fk IN SELECT k.*, pn.nspname AS ns_padre,pc.relname AS padre,cn.nspname AS ns_figlio,cc.relname AS figlio
    FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_class pc ON pc.oid=k.confrelid
      JOIN pg_catalog.pg_namespace pn ON pn.oid=pc.relnamespace
      JOIN pg_catalog.pg_class cc ON cc.oid=k.conrelid JOIN pg_catalog.pg_namespace cn ON cn.oid=cc.relnamespace
    WHERE k.contype='f' AND pn.nspname='public' AND pc.relname=ANY(v_tabelle)
    ORDER BY k.oid
  LOOP
    -- Inventario intero già verificato prima del contesto; nessuna DELETE dei figli protetti.
    IF (fk.conrelid='artecna_rapportini.allegati'::regclass AND fk.conname='allegati_cantiere_id_fkey') OR (fk.conrelid='artecna_rapportini.allegati'::regclass AND fk.conname='allegati_foto_cantiere_id_fkey') OR (fk.conrelid='artecna_rapportini.allegati'::regclass AND fk.conname='allegati_rapportino_id_fkey') OR (fk.conrelid='artecna_rapportini.richieste'::regclass AND fk.conname='richieste_rapportino_id_fkey') OR (fk.conrelid='public.rapportino_materiali'::regclass AND fk.conname='rapportino_materiali_rapportino_fk') OR (fk.conrelid='public.rapportino_prestazioni'::regclass AND fk.conname='rapportino_prestazioni_rapportino_id_fkey') OR (fk.conrelid='public.rapportino_prestazioni'::regclass AND fk.conname='rapportino_prestazioni_variante_id_fkey') OR (fk.conrelid='public.variante_sorgenti'::regclass AND fk.conname='variante_sorgenti_economia_raccolta_fk') THEN CONTINUE; END IF;
    IF artecna_rapportini.compat_foto_fk_allegati(fk.oid) THEN CONTINUE; END IF;
    -- CATALOG ALIGNMENT: global stock is not Cantiere-owned. Never delete it.
    -- The complete FK structure was certified by inizia_contesto before any DML.
    -- Invoice target rows are now FOR UPDATE locked: no new FK reference can commit.
    IF fk.ns_figlio='public' AND fk.figlio='materiali_impresa' AND fk.conname='materiali_impresa_fattura_riga_id_fkey' THEN
      IF EXISTS(SELECT 1 FROM public.materiali_impresa s JOIN public.fatture_fornitori_righe f ON f.id=s.fattura_riga_id WHERE f.cantiere_id=p_cantiere_id) THEN
        RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='Riferimento a materiali impresa: eliminazione annullata';
      END IF;
      CONTINUE;
    END IF;
    IF fk.ns_figlio<>'public' OR NOT (fk.figlio=ANY(v_tabelle)) OR NOT fk.convalidated THEN
      RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE=format('Dipendenza non certificata: %s',fk.conname);
    END IF;
    SELECT string_agg(format('f.%I=t.%I',a.attname,b.attname),' AND ' ORDER BY x.ord) INTO v_on
      FROM unnest(fk.conkey,fk.confkey) WITH ORDINALITY x(attnum,refnum,ord)
      JOIN pg_catalog.pg_attribute a ON a.attrelid=fk.conrelid AND a.attnum=x.attnum
      JOIN pg_catalog.pg_attribute b ON b.attrelid=fk.confrelid AND b.attnum=x.refnum;
    -- Le FK che coinvolgono Economia devono appartenere all'esatto grafo V1.
    IF fk.padre IN ('economia_raccolte','economia_sorgenti','economia_righe') OR fk.figlio IN ('economia_raccolte','economia_sorgenti','economia_righe') THEN
      IF fk.ns_padre<>'public' OR fk.ns_figlio<>'public' OR fk.confdeltype<>'r' OR fk.condeferrable OR fk.condeferred
        OR NOT (
          (fk.conname='economia_raccolte_cantiere_fk' AND fk.figlio='economia_raccolte' AND fk.padre='cantieri'
            AND fk.conkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.conrelid AND attname='cantiere_id')]::smallint[]
            AND fk.confkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.confrelid AND attname='id')]::smallint[])
          OR (((fk.figlio='economia_sorgenti' AND fk.conname='economia_sorgenti_raccolta_fk') OR (fk.figlio='economia_righe' AND fk.conname='economia_righe_raccolta_fk'))
            AND fk.figlio=ANY(v_economia_figli) AND fk.padre='economia_raccolte'
            AND fk.conkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.conrelid AND attname='raccolta_id')]::smallint[]
            AND fk.confkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.confrelid AND attname='id')]::smallint[])
          OR (fk.conname='economia_righe_sorgente_fk' AND fk.figlio='economia_righe' AND fk.padre='economia_sorgenti'
            AND fk.conkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.conrelid AND attname='sorgente_id'),(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.conrelid AND attname='raccolta_id')]::smallint[]
            AND fk.confkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.confrelid AND attname='id'),(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.confrelid AND attname='raccolta_id')]::smallint[])
          -- CATALOG ALIGNMENT: certify the existing invoice FK; no domain writer changes.
          OR (fk.conname='economia_righe_fattura_riga_fk' AND fk.figlio='economia_righe' AND fk.padre='fatture_fornitori_righe'
            AND fk.conkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.conrelid AND attname='fattura_riga_id')]::smallint[]
            AND fk.confkey=ARRAY[(SELECT attnum FROM pg_catalog.pg_attribute WHERE attrelid=fk.confrelid AND attname='id')]::smallint[])
        ) THEN RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='FK Economia non certificata'; END IF;
    END IF;
    IF fk.padre='cantieri' THEN v_padre:='t.id=$1';
    ELSIF fk.padre=ANY(v_economia_figli) THEN v_padre:='t.raccolta_id=ANY($3)';
    ELSIF fk.padre=ANY(v_figli) THEN v_padre:='t.variante_id=ANY($2)';
    ELSE v_padre:='t.cantiere_id=$1'; END IF;
    IF fk.figlio='cantieri' THEN v_figlio:='f.id=$1';
    ELSIF fk.figlio=ANY(v_economia_figli) THEN v_figlio:='f.raccolta_id=ANY($3)';
    ELSIF fk.figlio=ANY(v_figli) THEN v_figlio:='f.variante_id=ANY($2)';
    ELSE v_figlio:='f.cantiere_id=$1'; END IF;
    v_sql:=format('SELECT EXISTS (SELECT 1 FROM %I.%I f JOIN %I.%I t ON %s WHERE (%s) AND (%s) IS NOT TRUE)',fk.ns_figlio,fk.figlio,fk.ns_padre,fk.padre,v_on,v_padre,v_figlio);
    EXECUTE v_sql INTO v_esterna USING p_cantiere_id,v_varianti,v_raccolte;
    IF v_esterna THEN RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE=format('Riferimento esterno: %s',fk.conname); END IF;
  END LOOP;
  -- CATALOG ALIGNMENT: preserve the existing immutable invoice-assignment policy.
  -- Fail before outbox/DML rather than hitting RESTRICT after a trigger skips DELETE.
  IF EXISTS(SELECT 1 FROM public.materiali_cantiere t WHERE t.cantiere_id=p_cantiere_id AND t.fattura_riga_id IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='Assegnazioni materiali fattura immutabili: eliminazione annullata';
  END IF;
  SELECT jsonb_object_agg(q.entita,q.quantita ORDER BY q.entita) INTO conteggi FROM artecna_distruzione.manifest_cantiere(p_cantiere_id) q;
  IF conteggi->>'cantieri' IS DISTINCT FROM '1' THEN RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Manifest iniziale incoerente'; END IF;
  SELECT * INTO v_jobs_prima FROM artecna_distruzione.impronta_cleanup_storage(p_cantiere_id,NULL);
  storage_nuovi := artecna_distruzione.prepara_cleanup_storage(p_cantiere_id);
  SELECT * INTO v_jobs_vecchi FROM artecna_distruzione.impronta_cleanup_storage(p_cantiere_id,v_jobs_prima.max_id);
  SELECT * INTO v_jobs_preparati FROM artecna_distruzione.impronta_cleanup_storage(p_cantiere_id,NULL);
  IF v_jobs_vecchi.totale IS DISTINCT FROM v_jobs_prima.totale OR v_jobs_vecchi.impronta IS DISTINCT FROM v_jobs_prima.impronta
     OR v_jobs_preparati.totale IS DISTINCT FROM (v_jobs_prima.totale+storage_nuovi) THEN
    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Outbox preesistente modificata o conteggio incoerente';
  END IF;
  DELETE FROM public.economia_righe e WHERE e.raccolta_id=ANY(v_raccolte);
  GET DIAGNOSTICS v_n=ROW_COUNT;
  v_eliminate:=v_eliminate||jsonb_build_object('economia_righe',v_n);
  DELETE FROM public.economia_sorgenti e WHERE e.raccolta_id=ANY(v_raccolte);
  GET DIAGNOSTICS v_n=ROW_COUNT;
  v_eliminate:=v_eliminate||jsonb_build_object('economia_sorgenti',v_n);
  DELETE FROM public.economia_raccolte e WHERE e.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n=ROW_COUNT;
  v_eliminate:=v_eliminate||jsonb_build_object('economia_raccolte',v_n);
  DELETE FROM public.sal_lavorazioni t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('sal_lavorazioni',v_n);
  DELETE FROM public.variante_documenti t WHERE t.variante_id=ANY(v_varianti);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('variante_documenti',v_n);
  v_totale_lavorazioni := 0;
  LOOP
    DELETE FROM public.variante_lavorazioni t WHERE t.variante_id=ANY(v_varianti)
      AND NOT EXISTS (SELECT 1 FROM public.variante_lavorazioni ref WHERE ref.riferimento_variante_lavorazione_id=t.id);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_totale_lavorazioni := v_totale_lavorazioni + v_n;
    IF v_n=0 THEN
      IF EXISTS (SELECT 1 FROM public.variante_lavorazioni t WHERE t.variante_id=ANY(v_varianti)) THEN
        RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='Self-FK Variante: ciclo o dipendenza incompatibile';
      END IF;
      EXIT;
    END IF;
  END LOOP;
  v_eliminate := v_eliminate || jsonb_build_object('variante_lavorazioni',v_totale_lavorazioni);
  DELETE FROM public.variante_sorgenti t WHERE t.variante_id=ANY(v_varianti);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('variante_sorgenti',v_n);
  -- STEP5: only the relation/analysis belongs to the Variante.
  DELETE FROM public.variante_fonti_memory t WHERE t.variante_id=ANY(v_varianti);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('variante_fonti_memory',v_n);
  -- STEP5: only the relation/analysis belongs to the Variante.
  DELETE FROM public.variante_fonti_visive t WHERE t.variante_id=ANY(v_varianti);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('variante_fonti_visive',v_n);
  -- STEP5: only the relation/analysis belongs to the Variante.
  DELETE FROM public.variante_osservatore_analisi t WHERE t.variante_id=ANY(v_varianti);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('variante_osservatore_analisi',v_n);
  -- STEP5: documents precede Variante and base contract; RESTRICT unchanged.
  DELETE FROM public.preventivi_cantiere t WHERE t.cantiere_id=p_cantiere_id AND t.natura='integrativo';
  GET DIAGNOSTICS v_integrativi = ROW_COUNT;
  DELETE FROM public.varianti_cantiere t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('varianti_cantiere',v_n);
  UPDATE public.cantieri t SET preventivo_contrattuale_id=NULL
    WHERE t.id=p_cantiere_id AND t.preventivo_contrattuale_id IS NOT NULL;
  DELETE FROM public.preventivo_lavorazioni t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('preventivo_lavorazioni',v_n);
  DELETE FROM public.preventivi_cantiere t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('preventivi_cantiere',v_n+v_integrativi); -- STEP5: include early document deletes;
  DELETE FROM public.foto_cantiere t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('foto_cantiere',v_n);
  DELETE FROM public.materiali_cantiere t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('materiali_cantiere',v_n);
  DELETE FROM public.attrezzi_cantiere t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('attrezzi_cantiere',v_n);
  DELETE FROM public.timbrature t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('timbrature',v_n);
  DELETE FROM public.pagamenti_fornitori t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('pagamenti_fornitori',v_n);
  DELETE FROM public.acconti_cantiere t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('acconti_cantiere',v_n);
  DELETE FROM public.fatture_emesse t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('fatture_emesse',v_n);
  DELETE FROM public.fatture_fornitori_righe t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('fatture_fornitori_righe',v_n);
  DELETE FROM public.incassi_non_fatturati t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('incassi_non_fatturati',v_n);
  DELETE FROM public.rapportini t WHERE t.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_eliminate := v_eliminate || jsonb_build_object('rapportini',v_n);
  -- Post-check dei dati protetti PRIMA di terminare il contesto.
  FOREACH t IN ARRAY v_tabelle LOOP
    IF t IN ('cantieri','utenti_cantiere') THEN CONTINUE; END IF;
    IF t=ANY(v_economia_figli) THEN v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.raccolta_id=ANY($3))',t);
    ELSIF t=ANY(v_figli) THEN v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.variante_id=ANY($2))',t);
    ELSE v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.cantiere_id=$1)',t); END IF;
    EXECUTE v_sql INTO v_residuo USING p_cantiere_id,v_varianti,v_raccolte;
    IF v_residuo OR (v_eliminate->>t)::bigint IS DISTINCT FROM (conteggi->>t)::bigint THEN
      RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE=format('Residui/conteggi incoerenti: %s',t);
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.preventivi_cantiere f WHERE f.id::text=ANY(v_preventivi))
     OR EXISTS (SELECT 1 FROM public.preventivo_lavorazioni f WHERE f.id=ANY(v_base_lavorazioni))
     OR EXISTS (SELECT 1 FROM public.variante_lavorazioni f WHERE f.id=ANY(v_var_lavorazioni)) THEN
    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Identita target residue';
  END IF;
  SELECT * INTO v_jobs_dopo FROM artecna_distruzione.impronta_cleanup_storage(p_cantiere_id,NULL);
  IF to_jsonb(v_jobs_dopo) IS DISTINCT FROM to_jsonb(v_jobs_preparati) THEN
    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Outbox persa o modificata dopo DELETE';
  END IF;
  PERFORM artecna_distruzione.termina_contesto();
  IF artecna_distruzione.contesto_valido(p_cantiere_id) THEN RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Contesto non terminato'; END IF;
  DELETE FROM public.utenti_cantiere u WHERE u.cantiere_id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n IS DISTINCT FROM (conteggi->>'utenti_cantiere')::bigint OR EXISTS (SELECT 1 FROM public.utenti_cantiere u WHERE u.cantiere_id=p_cantiere_id) THEN
    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Membership residue/conteggi incoerenti';
  END IF;
  -- Ultima cancellazione applicativa.
  DELETE FROM public.cantieri c WHERE c.id=p_cantiere_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n<>1 OR EXISTS (SELECT 1 FROM public.cantieri c WHERE c.id=p_cantiere_id) THEN
    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Cantiere residuo';
  END IF;
  -- Ripete l'intero perimetro con UUID Varianti salvati, senza dipendere da join spariti.
  FOREACH t IN ARRAY v_tabelle LOOP
    IF t='cantieri' THEN v_sql:='SELECT EXISTS (SELECT 1 FROM public.cantieri f WHERE f.id=$1)';
    ELSIF t=ANY(v_economia_figli) THEN v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.raccolta_id=ANY($3))',t);
    ELSIF t=ANY(v_figli) THEN v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.variante_id=ANY($2))',t);
    ELSE v_sql:=format('SELECT EXISTS (SELECT 1 FROM public.%I f WHERE f.cantiere_id=$1)',t); END IF;
    EXECUTE v_sql INTO v_residuo USING p_cantiere_id,v_varianti,v_raccolte;
    IF v_residuo THEN RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE=format('Verifica finale fallita: %s',t); END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM public.economia_raccolte e WHERE e.id=ANY(v_raccolte))
    OR EXISTS(SELECT 1 FROM public.economia_sorgenti e WHERE e.id=ANY(v_economia_sorgenti))
    OR EXISTS(SELECT 1 FROM public.economia_righe e WHERE e.id=ANY(v_economia_righe)) THEN
    RAISE EXCEPTION USING ERRCODE='P2114',MESSAGE='Identita Economia residue'; END IF;
  cantiere_id := p_cantiere_id;
  eliminato := true;
  RETURN NEXT;
EXCEPTION WHEN foreign_key_violation THEN
  -- Il blocco EXCEPTION annulla TUTTE le scritture precedenti, poi propaga l'errore.
  RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='Dipendenza FK incompatibile: eliminazione annullata',DETAIL=SQLERRM;
END;

  $function$
;
ALTER FUNCTION public.elimina_cantiere_definitivamente(uuid,text) OWNER TO "artecna_cantieri_delete_rpc";
CREATE OR REPLACE FUNCTION public.verifica_bozza_vuota(p_tipo text, p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
 SET lock_timeout TO '3s'
AS $function$
BEGIN
 RETURN artecna_guardie.controlla_bozza_vuota(p_tipo,p_id,false);
END;
$function$
;
ALTER FUNCTION public.verifica_bozza_vuota(text,uuid) OWNER TO "artecna_cantieri_delete_rpc";
CREATE OR REPLACE FUNCTION public.elimina_bozza_vuota(p_tipo text, p_id uuid, p_impronta_attesa text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
 SET lock_timeout TO '3s'
AS $function$
DECLARE v jsonb; n bigint;
BEGIN
 IF p_impronta_attesa IS NULL OR p_impronta_attesa !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Conferma bozza non valida'; END IF;
 v:=artecna_guardie.controlla_bozza_vuota(p_tipo,p_id,true);
 IF (v->>'eliminabile')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='BD412',MESSAGE='Bozza con dati da preservare'; END IF;
 IF v->>'impronta' IS DISTINCT FROM p_impronta_attesa THEN RAISE EXCEPTION USING ERRCODE='BD409',MESSAGE='Bozza cambiata: eliminazione arrestata'; END IF;
 IF p_tipo='raccolta' THEN DELETE FROM public.economia_raccolte WHERE id=p_id;
 ELSIF p_tipo='variante' THEN DELETE FROM public.varianti_cantiere WHERE id=p_id;
 ELSE RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Tipo bozza non valido'; END IF;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>1 THEN RAISE EXCEPTION USING ERRCODE='BD409',MESSAGE='Eliminazione non confermata'; END IF;
 RETURN jsonb_build_object('versione_contratto',1,'tipo',p_tipo,'id',p_id,'eliminata',true);
EXCEPTION
 WHEN foreign_key_violation OR serialization_failure OR deadlock_detected OR lock_not_available THEN
   RAISE EXCEPTION USING ERRCODE='BD409',MESSAGE='Dipendenza o conflitto: eliminazione arrestata';
 WHEN SQLSTATE '42501' OR SQLSTATE '22023' OR SQLSTATE 'BD412' OR SQLSTATE 'BD409' THEN RAISE;
 WHEN OTHERS THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='Eliminazione arrestata; verificare prima di nuove azioni';
END;
$function$
;
ALTER FUNCTION public.elimina_bozza_vuota(text,uuid,text) OWNER TO "artecna_cantieri_delete_rpc";
CREATE OR REPLACE FUNCTION public.rinomina_variante_bozza(p_variante_id uuid, p_titolo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
 SET lock_timeout TO '3s'
AS $function$
DECLARE v public.varianti_cantiere%ROWTYPE; dopo public.varianti_cantiere%ROWTYPE; u uuid; nuovo text := btrim(p_titolo);
BEGIN
 IF current_user<>'artecna_cantieri_delete_rpc' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Contesto RPC non valido'; END IF;
 u := artecna_guardie.utente_jwt_corrente();
 IF u IS NULL OR p_variante_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='RV401',MESSAGE='Identita obbligatoria'; END IF;
 IF nuovo IS NULL OR nuovo='' THEN RAISE EXCEPTION USING ERRCODE='RV422',MESSAGE='Titolo obbligatorio'; END IF;
 LOCK TABLE public.utenti_cantiere IN SHARE MODE;
 SELECT * INTO v FROM public.varianti_cantiere WHERE id=p_variante_id FOR UPDATE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='RV404',MESSAGE='Variante non disponibile'; END IF;
 IF artecna_guardie.utente_puo_modificare_cantiere(u,v.cantiere_id) IS DISTINCT FROM TRUE THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non autorizzato'; END IF;
 PERFORM 1 FROM public.utenti_cantiere WHERE user_id=u AND cantiere_id=v.cantiere_id AND ruolo='owner';
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non disponibile'; END IF;
 IF v.stato IS DISTINCT FROM 'bozza' THEN RAISE EXCEPTION USING ERRCODE='RV409',MESSAGE='Solo varianti in bozza'; END IF;
 UPDATE public.varianti_cantiere SET titolo=nuovo WHERE id=v.id AND stato='bozza' RETURNING * INTO dopo;
 IF NOT FOUND OR (to_jsonb(dopo)-'titolo') IS DISTINCT FROM (to_jsonb(v)-'titolo') THEN RAISE EXCEPTION USING ERRCODE='RV412',MESSAGE='Modifica inattesa'; END IF;
 RETURN jsonb_build_object('id',dopo.id,'titolo',dopo.titolo,'stato',dopo.stato);
END;
$function$
;
ALTER FUNCTION public.rinomina_variante_bozza(uuid,text) OWNER TO "artecna_cantieri_delete_rpc";
CREATE OR REPLACE FUNCTION artecna_guardie.controlla_bozza_vuota(p_tipo text, p_id uuid, p_blocca boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
 SET lock_timeout TO '3s'
AS $function$
DECLARE u uuid; cid uuid; row_data jsonb; empty_draft boolean;
BEGIN
 IF current_user<>'artecna_cantieri_delete_rpc' OR p_tipo NOT IN ('raccolta','variante') OR p_tipo IS NULL OR p_id IS NULL THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Operazione non autorizzata'; END IF;
 u:=artecna_guardie.utente_jwt_corrente();
 IF u IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Operazione non autorizzata'; END IF;
 IF p_tipo='raccolta' THEN SELECT cantiere_id INTO cid FROM public.economia_raccolte WHERE id=p_id;
 ELSE SELECT cantiere_id INTO cid FROM public.varianti_cantiere WHERE id=p_id; END IF;
 IF cid IS NULL OR artecna_guardie.utente_puo_modificare_cantiere(u,cid) IS DISTINCT FROM true THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Bozza assente o non autorizzata'; END IF;
 IF p_blocca THEN
   -- Ordine unico, lock brevi e senza nuovi privilegi UPDATE. SHARE congela
   -- appartenenza/cantiere; SHARE ROW EXCLUSIVE serializza scritture testate.
   -- Le FK RESTRICT restano attive anche per inserimenti concorrenti dei figli.
   LOCK TABLE public.cantieri,public.utenti_cantiere IN SHARE MODE;
   LOCK TABLE public.economia_raccolte,public.varianti_cantiere IN SHARE ROW EXCLUSIVE MODE;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.cantieri WHERE id=cid) OR NOT EXISTS(SELECT 1 FROM public.utenti_cantiere WHERE cantiere_id=cid AND user_id=u AND ruolo='owner')
   OR artecna_guardie.utente_puo_modificare_cantiere(u,cid) IS DISTINCT FROM true THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Bozza assente o non autorizzata'; END IF;
 
 IF (SELECT jsonb_agg(jsonb_build_object('figlia',nf.nspname||'.'||f.relname,'nome',k.conname,'colonne',(SELECT jsonb_agg(a.attname ORDER BY ord) FROM unnest(k.conkey) WITH ORDINALITY x(num,ord) JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=x.num),'padre',np.nspname||'.'||p.relname,'colonne_padre',(SELECT jsonb_agg(a.attname ORDER BY ord) FROM unnest(k.confkey) WITH ORDINALITY x(num,ord) JOIN pg_attribute a ON a.attrelid=k.confrelid AND a.attnum=x.num),'delete',k.confdeltype::text,'validated',k.convalidated,'deferrable',k.condeferrable) ORDER BY nf.nspname,f.relname,k.conname) FROM pg_constraint k JOIN pg_class f ON f.oid=k.conrelid JOIN pg_namespace nf ON nf.oid=f.relnamespace JOIN pg_class p ON p.oid=k.confrelid JOIN pg_namespace np ON np.oid=p.relnamespace WHERE k.contype='f' AND k.confrelid IN ('public.economia_raccolte'::regclass,'public.varianti_cantiere'::regclass)) IS DISTINCT FROM '[{"nome":"economia_righe_raccolta_fk","padre":"public.economia_raccolte","delete":"r","figlia":"public.economia_righe","colonne":["raccolta_id"],"validated":true,"deferrable":false,"colonne_padre":["id"]},{"nome":"economia_sorgenti_raccolta_fk","padre":"public.economia_raccolte","delete":"r","figlia":"public.economia_sorgenti","colonne":["raccolta_id"],"validated":true,"deferrable":false,"colonne_padre":["id"]},{"nome":"preventivi_cantiere_variante_id_fkey","padre":"public.varianti_cantiere","delete":"r","figlia":"public.preventivi_cantiere","colonne":["variante_id"],"validated":true,"deferrable":false,"colonne_padre":["id"]},{"nome":"rapportino_prestazioni_variante_id_fkey","padre":"public.varianti_cantiere","delete":"r","figlia":"public.rapportino_prestazioni","colonne":["variante_id"],"validated":true,"deferrable":false,"colonne_padre":["id"]},{"nome":"variante_documenti_variante_fk","padre":"public.varianti_cantiere","delete":"r","figlia":"public.variante_documenti","colonne":["variante_id"],"validated":true,"deferrable":false,"colonne_padre":["id"]},{"nome":"variante_fonti_memory_variante_id_fkey","padre":"public.varianti_cantiere","delete":"c","figlia":"public.variante_fonti_memory","colonne":["variante_id"],"validated":true,"deferrable":false,"colonne_padre":["id"]},{"nome":"variante_fonti_visive_variante_id_fkey","padre":"public.varianti_cantiere","delete":"c","figlia":"public.variante_fonti_visive","colonne":["variante_id"],"validated":true,"deferrable":false,"colonne_padre":["id"]},{"nome":"variante_lavorazioni_variante_fk","padre":"public.varianti_cantiere","delete":"r","figlia":"public.variante_lavorazioni","colonne":["variante_id"],"validated":true,"deferrable":false,"colonne_padre":["id"]},{"nome":"variante_osservatore_analisi_variante_id_fkey","padre":"public.varianti_cantiere","delete":"c","figlia":"public.variante_osservatore_analisi","colonne":["variante_id"],"validated":true,"deferrable":false,"colonne_padre":["id"]},{"nome":"variante_sorgenti_economia_raccolta_fk","padre":"public.economia_raccolte","delete":"r","figlia":"public.variante_sorgenti","colonne":["economia_raccolta_id"],"validated":true,"deferrable":false,"colonne_padre":["id"]},{"nome":"variante_sorgenti_variante_fk","padre":"public.varianti_cantiere","delete":"r","figlia":"public.variante_sorgenti","colonne":["variante_id"],"validated":true,"deferrable":false,"colonne_padre":["id"]}]'::jsonb OR (SELECT jsonb_agg(jsonb_build_object('table',n.nspname||'.'||c.relname,'name',t.tgname,'enabled',t.tgenabled::text,'type',t.tgtype,'function',np.nspname||'.'||p.proname) ORDER BY n.nspname,c.relname,t.tgname) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace np ON np.oid=p.pronamespace WHERE NOT t.tgisinternal AND t.tgrelid IN ('public.economia_raccolte'::regclass,'public.varianti_cantiere'::regclass)) IS DISTINCT FROM '[{"table":"public.varianti_cantiere","name":"guardia_variante_testata","enabled":"O","type":31,"function":"artecna_guardie.proteggi_variante_testata"},{"table":"public.varianti_cantiere","name":"rapportino_prestazioni_variante","enabled":"O","type":19,"function":"artecna_rapportini.proteggi_cantiere_variante"}]'::jsonb THEN
   RAISE EXCEPTION USING ERRCODE='BD412',MESSAGE='Schema dipendenze non certificato'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('artecna_guardie.proteggi_variante_testata()') AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='d100183e3525fbb969200e5819e131ac1d775b5e6c072cbd7f0eed8d3ddd21f9') THEN RAISE EXCEPTION USING ERRCODE='BD412',MESSAGE='Guardia esistente divergente'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('artecna_guardie.utente_jwt_corrente()') AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='9ab5ea099e74ec09e83b1505c51a3647791195aed7c742dcc3f257dfc7d2f300') THEN RAISE EXCEPTION USING ERRCODE='BD412',MESSAGE='Guardia esistente divergente'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid)') AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='88f6e447743d8b5dab99143f39269d513d4a8f859e7ebcb42d781faeecd8d21a') THEN RAISE EXCEPTION USING ERRCODE='BD412',MESSAGE='Guardia esistente divergente'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=to_regprocedure('artecna_rapportini.proteggi_cantiere_variante()') AND encode(sha256(convert_to(prosrc,'UTF8')),'hex')='fac302c2b723d006e181d2ff151914ff2612aa13ff8623206e11bcb1d2f8407c') THEN RAISE EXCEPTION USING ERRCODE='BD412',MESSAGE='Guardia esistente divergente'; END IF;
 IF (SELECT jsonb_agg(jsonb_build_object('name',attname,'type',format_type(atttypid,atttypmod)) ORDER BY attnum) FROM pg_attribute WHERE attrelid='public.economia_raccolte'::regclass AND attnum>0 AND NOT attisdropped) IS DISTINCT FROM '[{"name":"id","type":"uuid"},{"name":"cantiere_id","type":"uuid"},{"name":"numero","type":"integer"},{"name":"titolo","type":"text"},{"name":"data","type":"date"},{"name":"stato","type":"text"},{"name":"note","type":"text"},{"name":"revisione","type":"bigint"},{"name":"created_by","type":"uuid"},{"name":"created_at","type":"timestamp with time zone"},{"name":"updated_at","type":"timestamp with time zone"},{"name":"chiusa_at","type":"timestamp with time zone"}]'::jsonb THEN RAISE EXCEPTION USING ERRCODE='BD412',MESSAGE='Struttura bozza divergente'; END IF;
 IF (SELECT jsonb_agg(jsonb_build_object('name',attname,'type',format_type(atttypid,atttypmod)) ORDER BY attnum) FROM pg_attribute WHERE attrelid='public.varianti_cantiere'::regclass AND attnum>0 AND NOT attisdropped) IS DISTINCT FROM '[{"name":"id","type":"uuid"},{"name":"cantiere_id","type":"uuid"},{"name":"preventivo_contrattuale_id","type":"uuid"},{"name":"numero","type":"integer"},{"name":"titolo","type":"text"},{"name":"descrizione","type":"text"},{"name":"stato","type":"text"},{"name":"data_variante","type":"date"},{"name":"importo_delta_approvato","type":"numeric(18,2)"},{"name":"approvata_at","type":"timestamp with time zone"},{"name":"riferimento_approvazione","type":"text"},{"name":"created_at","type":"timestamp with time zone"},{"name":"updated_at","type":"timestamp with time zone"}]'::jsonb THEN RAISE EXCEPTION USING ERRCODE='BD412',MESSAGE='Struttura bozza divergente'; END IF;

 IF p_tipo='raccolta' THEN
   SELECT to_jsonb(r), r.stato='bozza' AND r.revisione=0 AND coalesce(btrim(r.note),'')=''
     AND NOT EXISTS(SELECT 1 FROM public.economia_righe WHERE raccolta_id=p_id)
     AND NOT EXISTS(SELECT 1 FROM public.economia_sorgenti WHERE raccolta_id=p_id)
     AND NOT EXISTS(SELECT 1 FROM public.variante_sorgenti WHERE economia_raccolta_id=p_id)
   INTO row_data,empty_draft FROM public.economia_raccolte r WHERE r.id=p_id AND r.cantiere_id=cid;
 ELSE
   SELECT to_jsonb(v), v.stato='bozza' AND v.numero IS NULL AND v.importo_delta_approvato IS NULL
     AND v.approvata_at IS NULL AND v.riferimento_approvazione IS NULL AND coalesce(btrim(v.descrizione),'')=''
     AND NOT EXISTS(SELECT 1 FROM public.variante_lavorazioni WHERE variante_id=p_id)
     AND NOT EXISTS(SELECT 1 FROM public.variante_sorgenti WHERE variante_id=p_id)
     AND NOT EXISTS(SELECT 1 FROM public.variante_documenti WHERE variante_id=p_id)
     AND NOT EXISTS(SELECT 1 FROM public.rapportino_prestazioni WHERE variante_id=p_id)
   INTO row_data,empty_draft FROM public.varianti_cantiere v WHERE v.id=p_id AND v.cantiere_id=cid;
 END IF;
 IF row_data IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Bozza assente o non autorizzata'; END IF;
 RETURN jsonb_build_object('versione_contratto',1,'tipo',p_tipo,'id',p_id,'eliminabile',coalesce(empty_draft,false),
   'motivo',CASE WHEN empty_draft THEN 'bozza_vuota' ELSE 'dati_da_preservare' END,
   'impronta',CASE WHEN empty_draft THEN encode(sha256(convert_to(row_data::text,'UTF8')),'hex') ELSE NULL END);
END;
$function$
;
ALTER FUNCTION artecna_guardie.controlla_bozza_vuota(text,uuid,boolean) OWNER TO "artecna_cantieri_delete_rpc";
CREATE OR REPLACE FUNCTION public.crea_cantiere_con_owner(p_nome text, p_preventivo double precision DEFAULT 0)
 RETURNS TABLE(id uuid, nome text, preventivo double precision, created_at timestamp without time zone, lavori_conclusi boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  v_user uuid;
  v_id uuid;
  v_nome text;
  v_count bigint;
  v_owner_count bigint;
  v_owner_exact boolean;
BEGIN
  BEGIN
    v_user := artecna_guardie.utente_jwt_corrente();
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P2061',
        MESSAGE = 'Identità JWT non valida';
  END;

  IF v_user IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P2061',
      MESSAGE = 'Identità JWT obbligatoria';
  END IF;

  v_nome := pg_catalog.btrim(p_nome);

  IF v_nome IS NULL OR v_nome = '' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P2062',
      MESSAGE = 'Nome cantiere obbligatorio';
  END IF;

  -- NaN in PostgreSQL è maggiore dei valori numerici ordinari.
  -- Il confronto esclude NaN e entrambe le infinità.
  IF p_preventivo IS NULL
     OR p_preventivo < 0
     OR NOT (p_preventivo < 'Infinity'::double precision) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P2062',
      MESSAGE = 'Preventivo non valido: richiesto valore finito >= 0';
  END IF;

  v_id := pg_catalog.gen_random_uuid();

  INSERT INTO public.cantieri AS c (
    id, nome, preventivo
  )
  VALUES (
    v_id, v_nome, p_preventivo
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P2063',
      MESSAGE = 'Inserimento cantiere non confermato';
  END IF;

  INSERT INTO public.utenti_cantiere AS uc (
    cantiere_id, user_id, ruolo
  )
  VALUES (
    v_id, v_user, 'owner'
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count <> 1 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P2064',
      MESSAGE = 'Inserimento owner non confermato';
  END IF;

  -- Verifica che per il nuovo UUID esista una sola membership,
  -- esattamente quella richiesta.
  SELECT
    count(*),
    bool_and(uc.user_id = v_user AND uc.ruolo = 'owner')
  INTO v_owner_count, v_owner_exact
  FROM public.utenti_cantiere AS uc
  WHERE uc.cantiere_id = v_id;

  IF v_owner_count <> 1 OR v_owner_exact IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P2064',
      MESSAGE = 'Membership owner risultante non conforme';
  END IF;

  -- Rilettura dopo entrambe le scritture e dopo i trigger immediati.
  SELECT
    c.id, c.nome, c.preventivo, c.created_at, c.lavori_conclusi
  INTO
    id, nome, preventivo, created_at, lavori_conclusi
  FROM public.cantieri AS c
  WHERE c.id = v_id;

  IF NOT FOUND
     OR id IS DISTINCT FROM v_id
     OR nome IS DISTINCT FROM v_nome
     OR preventivo IS DISTINCT FROM p_preventivo
     OR created_at IS NULL
     OR lavori_conclusi IS DISTINCT FROM false THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P2065',
      MESSAGE = 'Cantiere risultante non conforme';
  END IF;

  RETURN NEXT;
  RETURN;

  -- Nessun handler esterno che trasformi un errore in successo.
  -- FK, UNIQUE, CHECK e altri errori inattesi vengono propagati.
END;
$function$
;
ALTER FUNCTION public.crea_cantiere_con_owner(text,double precision) OWNER TO "artecna_cantieri_rpc";
CREATE OR REPLACE FUNCTION public.chiudi_raccolta_economia(p_raccolta_id uuid, p_revisione_attesa bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE v_user uuid; v_cantiere uuid; v_r public.economia_raccolte%rowtype; row_analitica public.economia_righe%rowtype; s public.economia_sorgenti%rowtype; BEGIN SELECT e.cantiere_id INTO v_cantiere FROM public.economia_raccolte e WHERE e.id=p_raccolta_id;
 v_user := artecna_guardie.utente_jwt_corrente();
 IF v_user IS NULL OR v_cantiere IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato'; END IF;
 PERFORM c.id FROM public.cantieri c WHERE c.id=v_cantiere FOR UPDATE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,v_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere assente o non autorizzato'; END IF;
 PERFORM u.user_id FROM public.utenti_cantiere u WHERE u.cantiere_id=v_cantiere AND u.user_id=v_user AND u.ruolo='owner' FOR SHARE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,v_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato dopo lock'; END IF;
 SELECT e.* INTO v_r FROM public.economia_raccolte e WHERE e.id=p_raccolta_id AND e.cantiere_id=v_cantiere FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Raccolta assente'; END IF;
 IF v_r.stato<>'bozza' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Raccolta chiusa immutabile'; END IF;
 IF v_r.revisione IS DISTINCT FROM p_revisione_attesa THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Revisione Economia divergente'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.economia_righe l WHERE l.raccolta_id=v_r.id) OR EXISTS(SELECT 1 FROM public.economia_righe l WHERE l.raccolta_id=v_r.id AND l.prezzo_unitario IS NULL) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Richieste righe valorizzate'; END IF;
 FOR row_analitica IN SELECT r.* FROM public.economia_righe r WHERE r.raccolta_id=v_r.id LOOP
   IF row_analitica.origine='fattura_fornitore' THEN
     PERFORM artecna_guardie.verifica_materiale_fattura_economia(row_analitica);
   ELSIF row_analitica.origine='rapportino' THEN
     PERFORM artecna_guardie.verifica_riga_economia_rapportino(row_analitica,true);
   ELSE
   s:=NULL;
   IF row_analitica.tipo_riga<>'generica' THEN
     SELECT es.* INTO s FROM public.economia_sorgenti es WHERE es.id=row_analitica.sorgente_id AND es.raccolta_id=v_r.id;
     IF NOT FOUND OR s.formato<>'excel' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Sorgente analitica assente'; END IF;
   END IF;
   PERFORM public.economia_valida_dettagli(row_analitica.tipo_riga,row_analitica.dettagli_analitici,s.snapshot,s.snapshot_version,row_analitica.indice_voce_sorgente,row_analitica.quantita,row_analitica.prezzo_unitario,row_analitica.unita_misura,row_analitica.descrizione,true);
   END IF;
 END LOOP;
 UPDATE public.economia_raccolte e SET stato='chiusa',chiusa_at=current_timestamp,revisione=e.revisione+1,updated_at=now() WHERE e.id=v_r.id RETURNING * INTO v_r;
 RETURN jsonb_build_object('raccolta',to_jsonb(v_r),'totale',(SELECT sum(round(l.quantita*l.prezzo_unitario,2)) FROM public.economia_righe l WHERE l.raccolta_id=v_r.id),
 'righe_non_valorizzate',(SELECT count(*) FROM public.economia_righe l WHERE l.raccolta_id=v_r.id AND l.prezzo_unitario IS NULL)); END;
$function$
;
ALTER FUNCTION public.chiudi_raccolta_economia(uuid,bigint) OWNER TO "artecna_economia_rpc";
CREATE OR REPLACE FUNCTION public.crea_raccolta_economia(p_cantiere_id uuid, p_titolo text, p_data date, p_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE v_user uuid; v_cantiere uuid:=p_cantiere_id; v_num bigint; v_r public.economia_raccolte%rowtype;
BEGIN v_user := artecna_guardie.utente_jwt_corrente();
 IF v_user IS NULL OR v_cantiere IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato'; END IF;
 PERFORM c.id FROM public.cantieri c WHERE c.id=v_cantiere FOR UPDATE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,v_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere assente o non autorizzato'; END IF;
 PERFORM u.user_id FROM public.utenti_cantiere u WHERE u.cantiere_id=v_cantiere AND u.user_id=v_user AND u.ruolo='owner' FOR SHARE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,v_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato dopo lock'; END IF;
 IF p_titolo IS NULL OR btrim(p_titolo)='' OR p_data IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Titolo e data obbligatori'; END IF;
 SELECT coalesce(max(e.numero)::bigint,0)+1 INTO v_num FROM public.economia_raccolte e WHERE e.cantiere_id=v_cantiere;
 IF v_num>2147483647 THEN RAISE EXCEPTION USING ERRCODE='22003',MESSAGE='Numerazione esaurita'; END IF;
 INSERT INTO public.economia_raccolte(cantiere_id,numero,titolo,data,note,created_by) VALUES(v_cantiere,v_num,p_titolo,p_data,p_note,v_user) RETURNING * INTO v_r;
 RETURN to_jsonb(v_r); END;
$function$
;
ALTER FUNCTION public.crea_raccolta_economia(uuid,text,date,text) OWNER TO "artecna_economia_rpc";
CREATE OR REPLACE FUNCTION public.leggi_raccolte_economia(p_cantiere_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE v_user uuid; BEGIN
 v_user:=artecna_guardie.utente_jwt_corrente();
 IF v_user IS NULL OR artecna_guardie.utente_puo_modificare_cantiere(v_user,p_cantiere_id) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato'; END IF;
 RETURN coalesce((SELECT jsonb_agg(to_jsonb(e)||jsonb_build_object('totale', (SELECT sum(round(l.quantita*l.prezzo_unitario,2)) FROM public.economia_righe l WHERE l.raccolta_id=e.id),
 'righe_non_valorizzate',(SELECT count(*) FROM public.economia_righe l WHERE l.raccolta_id=e.id AND l.prezzo_unitario IS NULL)) ORDER BY e.numero)
 FROM public.economia_raccolte e WHERE e.cantiere_id=p_cantiere_id),'[]'::jsonb); END;
$function$
;
ALTER FUNCTION public.leggi_raccolte_economia(uuid) OWNER TO "artecna_economia_rpc";
CREATE OR REPLACE FUNCTION public.leggi_raccolta_economia(p_raccolta_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE v_user uuid; v_r public.economia_raccolte%rowtype; BEGIN
 v_user:=artecna_guardie.utente_jwt_corrente(); SELECT e.* INTO v_r FROM public.economia_raccolte e WHERE e.id=p_raccolta_id;
 IF NOT FOUND OR v_user IS NULL OR artecna_guardie.utente_puo_modificare_cantiere(v_user,v_r.cantiere_id) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Raccolta assente o non autorizzata'; END IF;
 RETURN jsonb_build_object('raccolta',to_jsonb(v_r),'totale',(SELECT sum(round(l.quantita*l.prezzo_unitario,2)) FROM public.economia_righe l WHERE l.raccolta_id=v_r.id),
 'righe_non_valorizzate',(SELECT count(*) FROM public.economia_righe l WHERE l.raccolta_id=v_r.id AND l.prezzo_unitario IS NULL)) || jsonb_build_object('righe',coalesce((SELECT jsonb_agg(to_jsonb(l)||jsonb_build_object('totale',round(l.quantita*l.prezzo_unitario,2)) ORDER BY l.ordine) FROM public.economia_righe l WHERE l.raccolta_id=v_r.id),'[]'::jsonb),
 'sorgenti',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.created_at,s.id) FROM public.economia_sorgenti s WHERE s.raccolta_id=v_r.id),'[]'::jsonb)); END;
$function$
;
ALTER FUNCTION public.leggi_raccolta_economia(uuid) OWNER TO "artecna_economia_rpc";
CREATE OR REPLACE FUNCTION public.salva_bozza_economia(p_raccolta_id uuid, p_revisione_attesa bigint, p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE v_user uuid; v_cantiere uuid; v_r public.economia_raccolte%rowtype; a jsonb; k text; x jsonb; rid uuid; n integer; q numeric; pr numeric; seen uuid[]:=ARRAY[]::uuid[]; changed uuid[]:=ARRAY[]::uuid[]; oldrow public.economia_righe%rowtype; srcrow public.economia_sorgenti%rowtype; typ text; det jsonb; snap_fattura jsonb; id_fattura_riga uuid; hash_fattura text; id_sorgente_fattura uuid; ordine_fattura integer; q_invio numeric; q_assegnata numeric; q_residua numeric; lock_id uuid; um_originale text; um_economia text; esiti_fattura jsonb:='[]'::jsonb;
BEGIN SELECT e.cantiere_id INTO v_cantiere FROM public.economia_raccolte e WHERE e.id=p_raccolta_id;
 v_user := artecna_guardie.utente_jwt_corrente();
 IF v_user IS NULL OR v_cantiere IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato'; END IF;
 PERFORM c.id FROM public.cantieri c WHERE c.id=v_cantiere FOR UPDATE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,v_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere assente o non autorizzato'; END IF;
 PERFORM u.user_id FROM public.utenti_cantiere u WHERE u.cantiere_id=v_cantiere AND u.user_id=v_user AND u.ruolo='owner' FOR SHARE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,v_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato dopo lock'; END IF;
 SELECT e.* INTO v_r FROM public.economia_raccolte e WHERE e.id=p_raccolta_id AND e.cantiere_id=v_cantiere FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Raccolta assente'; END IF;
 IF v_r.stato NOT IN ('bozza','chiusa') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Stato raccolta non valido'; END IF;
 IF v_r.stato='chiusa' THEN
  IF p_payload->'integrazione_post_chiusura' IS DISTINCT FROM 'true'::jsonb
   OR jsonb_typeof(p_payload->'righe_da_creare') IS DISTINCT FROM 'array'
   OR jsonb_array_length(p_payload->'righe_da_creare')=0
   OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) z(field) WHERE z.field NOT IN ('righe_da_creare','integrazione_post_chiusura'))
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'righe_da_creare') z(v) WHERE v->>'origine' IS DISTINCT FROM 'fattura_fornitore') THEN
   RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Raccolta chiusa: consentite solo nuove righe fattura con conferma integrazione'; END IF;
 END IF;
 IF v_r.revisione IS DISTINCT FROM p_revisione_attesa THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Revisione Economia divergente'; END IF;
 IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) z(key) WHERE z.key NOT IN ('righe_da_creare','righe_da_modificare','righe_da_eliminare','sorgenti_da_aggiungere','riordino','integrazione_post_chiusura')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Payload Economia non valido'; END IF;
 FOREACH k IN ARRAY ARRAY['righe_da_creare','righe_da_modificare','righe_da_eliminare','sorgenti_da_aggiungere','riordino'] LOOP
  IF p_payload ? k AND jsonb_typeof(p_payload->k)<>'array' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Operazioni richiedono array'; END IF;
 END LOOP;
 IF p_payload ? 'integrazione_post_chiusura' AND jsonb_typeof(p_payload->'integrazione_post_chiusura') IS DISTINCT FROM 'boolean' THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Conferma integrazione non valida'; END IF;
 -- Under repeatable-read a wait on a row lock alone does not refresh SUM's snapshot.
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(p_payload->'righe_da_creare','[]'::jsonb)) z(v) WHERE v->>'origine'='fattura_fornitore')
 AND current_setting('transaction_isolation')<>'read committed' THEN
  RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Assegnazione fattura richiede READ COMMITTED; nessun retry automatico'; END IF;
 FOR lock_id IN SELECT id FROM artecna_guardie.materiali_fattura_ordine_lock(p_payload) LOOP
  PERFORM artecna_guardie.blocca_riga_fattura_economia(lock_id,v_cantiere);
 END LOOP;
 SET CONSTRAINTS public.economia_righe_ordine_unique DEFERRED;
 -- Sorgenti nuove: ID esplicito consente riferimenti nel medesimo payload.
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'sorgenti_da_aggiungere','[]'::jsonb)) LOOP
  IF jsonb_typeof(x)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(x) z(key) WHERE z.key NOT IN ('id','nome_file','formato','file_sha256','snapshot_version','snapshot')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Sorgente non valida'; END IF;
  rid:=(x->>'id')::uuid; IF rid IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='UUID sorgente obbligatorio'; END IF;
  INSERT INTO public.economia_sorgenti(id,raccolta_id,nome_file,formato,file_sha256,snapshot_version,snapshot,created_by)
    VALUES(rid,v_r.id,x->>'nome_file',x->>'formato',x->>'file_sha256',coalesce((x->>'snapshot_version')::integer,1),x->'snapshot',v_user);
 END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'righe_da_eliminare','[]'::jsonb)) LOOP
  IF jsonb_typeof(x)<>'string' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='UUID riga richiesto'; END IF;
  rid:=(x #>> '{}')::uuid;
  IF rid=ANY(changed) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Operazione riga ripetuta'; END IF;
  DELETE FROM public.economia_righe l WHERE l.id=rid AND l.raccolta_id=v_r.id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riga non appartenente alla raccolta'; END IF;
  changed:=array_append(changed,rid);
 END LOOP;
 -- Modifiche esplicite: contenuto completo della sola riga indicata, provenienza immutabile.
 FOREACH k IN ARRAY ARRAY['righe_da_modificare','righe_da_creare'] LOOP
  FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->k,'[]'::jsonb)) LOOP
   IF jsonb_typeof(x)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(x) z(key) WHERE z.key NOT IN ('id','ordine','descrizione','unita_misura','quantita','prezzo_unitario','note','origine','sorgente_id','indice_voce_sorgente','tipo_riga','dettagli_analitici','fattura_riga_id','unita_misura_economia','quantita_da_inviare')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riga non valida'; END IF;
   -- Ramo fattura esplicito: gli importi client non sono autorevoli.
   IF k='righe_da_creare' AND x->>'origine'='fattura_fornitore' THEN
    BEGIN
     IF EXISTS(SELECT 1 FROM jsonb_object_keys(x) j(key) WHERE j.key NOT IN ('origine','fattura_riga_id','unita_misura_economia','quantita_da_inviare')) THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Per fattura inviare solo origine, fattura_riga_id e unita_misura_economia'; END IF;
     id_fattura_riga:=(x->>'fattura_riga_id')::uuid;
     IF id_fattura_riga IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ID riga fattura obbligatorio'; END IF;
     IF EXISTS(SELECT 1 FROM public.economia_righe WHERE raccolta_id=v_r.id AND fattura_riga_id=id_fattura_riga) THEN
      esiti_fattura:=esiti_fattura||jsonb_build_array(jsonb_build_object('fattura_riga_id',id_fattura_riga,'stato','gia_assegnata','motivo','Questa riga fattura è già assegnata a questa raccolta'));
      CONTINUE;
     END IF;
     snap_fattura:=artecna_guardie.economia_snapshot_fattura(id_fattura_riga,v_cantiere);
     IF jsonb_typeof(x->'quantita_da_inviare') IS DISTINCT FROM 'number' AND jsonb_typeof(x->'quantita_da_inviare') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Quantita da inviare esplicita obbligatoria'; END IF;
     q_invio:=(x->>'quantita_da_inviare')::numeric;
     IF q_invio IS NULL OR q_invio<=0 OR q_invio::text IN ('NaN','Infinity','-Infinity') OR q_invio<>round(q_invio,6) OR q_invio>=1000000000000 THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Quantita da inviare non valida'; END IF;
     q_assegnata:=artecna_guardie.materiali_fattura_totale(id_fattura_riga);
     q_residua:=(snap_fattura->>'quantita')::numeric-q_assegnata;
     IF q_residua<=0 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Quantità disponibile esaurita'; END IF;
     IF q_invio>q_residua THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Disponibile: '||q_residua::text; END IF;
     snap_fattura:=snap_fattura||jsonb_build_object('quantita_originale',snap_fattura->'quantita',
      'quantita_da_inviare',q_invio,'quantita',q_invio,'quantita_assegnata_prima',q_assegnata,'quantita_residua',q_residua-q_invio,
      'quantita_assegnata_pre',q_assegnata,'quantita_residua_post',q_residua-q_invio,
      'totale',round(q_invio*(snap_fattura->>'prezzo_unitario_economia')::numeric,2),
      'totale_economia',round(q_invio*(snap_fattura->>'prezzo_unitario_economia')::numeric,2),
      'integrazione_post_chiusura',v_r.stato='chiusa',
      'integrata_at',CASE WHEN v_r.stato='chiusa' THEN current_timestamp ELSE NULL END,
      'revisione_precedente',v_r.revisione,'revisione_successiva',v_r.revisione+1,'chiusa_at',v_r.chiusa_at);
     um_originale:=snap_fattura->>'unita_misura';
     IF x ? 'unita_misura_economia' AND jsonb_typeof(x->'unita_misura_economia') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='U.M. Economia non valida'; END IF;
     IF x ? 'unita_misura_economia' THEN
      um_economia:=nullif(btrim(x->>'unita_misura_economia'),'');
     ELSE
      um_economia:=CASE WHEN nullif(btrim(um_originale),'') IS NOT NULL THEN um_originale ELSE NULL END;
     END IF;
     IF um_economia IS NULL THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Completa U.M.'; END IF;
     IF length(um_economia)>64 OR um_economia ~ '[[:cntrl:]]' THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='U.M. Economia non valida'; END IF;
     snap_fattura:=snap_fattura||jsonb_build_object('unita_misura_originale',snap_fattura->'unita_misura',
      'unita_misura_economia',um_economia);
     hash_fattura:=encode(sha256(convert_to('fattura_snapshot_v1:'||snap_fattura::text,'UTF8')),'hex');
     INSERT INTO public.economia_sorgenti(raccolta_id,tipo,nome_file,formato,file_sha256,snapshot_version,snapshot,created_by)
     VALUES(v_r.id,'fattura_fornitore',coalesce(nullif(snap_fattura->>'nome_file_originale',''),'Fattura '||(snap_fattura->>'fattura_id')),
      'fattura',hash_fattura,1,snap_fattura,v_user)
     ON CONFLICT (raccolta_id,file_sha256) DO NOTHING;
     SELECT id INTO id_sorgente_fattura FROM public.economia_sorgenti
      WHERE raccolta_id=v_r.id AND file_sha256=hash_fattura AND tipo='fattura_fornitore' AND formato='fattura' AND snapshot=snap_fattura;
     IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Sorgente fattura incoerente'; END IF;
     SELECT coalesce(max(ordine),0)+1 INTO ordine_fattura FROM public.economia_righe WHERE raccolta_id=v_r.id;
     det:=jsonb_build_object('version',1,'fattura',snap_fattura,'operativo',jsonb_build_object(
      'data',snap_fattura->'data_fattura','fornitore',snap_fattura->'fornitore',
      'documento',snap_fattura->'numero_fattura','riferimento_rapportino',NULL));
     INSERT INTO public.economia_righe(raccolta_id,ordine,descrizione,unita_misura,quantita,prezzo_unitario,
      origine,sorgente_id,indice_voce_sorgente,tipo_riga,dettagli_analitici,fattura_riga_id,created_by)
     VALUES(v_r.id,ordine_fattura,snap_fattura->>'descrizione',snap_fattura->>'unita_misura_economia',
      (snap_fattura->>'quantita')::numeric,(snap_fattura->>'prezzo_unitario_economia')::numeric,
      'fattura_fornitore',id_sorgente_fattura,NULL,'materiale',det,id_fattura_riga,v_user);
     esiti_fattura:=esiti_fattura||jsonb_build_array(jsonb_build_object('fattura_riga_id',id_fattura_riga,'stato','inserita'));
    EXCEPTION WHEN unique_violation THEN
     esiti_fattura:=esiti_fattura||jsonb_build_array(jsonb_build_object('fattura_riga_id',x->>'fattura_riga_id','stato','errore','motivo','Conflitto di unicita: rileggere la raccolta, nessun retry automatico'));
    WHEN SQLSTATE '22023' OR SQLSTATE '22P02' THEN
     esiti_fattura:=esiti_fattura||jsonb_build_array(jsonb_build_object('fattura_riga_id',x->>'fattura_riga_id','stato','errore','motivo',SQLERRM));
    END;
    CONTINUE;
   END IF;
   IF x ? 'fattura_riga_id' OR x ? 'unita_misura_economia' OR x ? 'quantita_da_inviare' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Provenienza fattura immutabile o incoerente'; END IF;
   q:=(x->>'quantita')::numeric; pr:=(x->>'prezzo_unitario')::numeric;
   IF q IS NULL OR q<=0 OR q::text IN ('NaN','Infinity','-Infinity') OR q<>round(q,6)
     OR (pr IS NOT NULL AND (pr<0 OR pr::text IN ('NaN','Infinity','-Infinity') OR pr<>round(pr,6))) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Precisione o valore numerico non valido'; END IF;
   rid:=(x->>'id')::uuid;
   IF k='righe_da_modificare' THEN
    IF rid IS NULL OR rid=ANY(changed) OR x ? 'origine' OR x ? 'sorgente_id' OR x ? 'indice_voce_sorgente' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Modifica riga/provenienza non valida'; END IF;
    SELECT l.* INTO oldrow FROM public.economia_righe l WHERE l.id=rid AND l.raccolta_id=v_r.id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riga non appartenente alla raccolta'; END IF;
    IF oldrow.prezzo_cliente_confermato_at IS NOT NULL AND pr IS DISTINCT FROM oldrow.prezzo_unitario THEN
      RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Prezzo cliente gia confermato: usa la funzione Valorizza per modificarlo'; END IF;
    typ:=CASE WHEN x ? 'tipo_riga' THEN x->>'tipo_riga' ELSE oldrow.tipo_riga END;
    IF typ IS DISTINCT FROM oldrow.tipo_riga THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Tipo riga immutabile'; END IF;
    det:=CASE WHEN x ? 'dettagli_analitici' THEN nullif(x->'dettagli_analitici','null'::jsonb) ELSE oldrow.dettagli_analitici END;
    IF oldrow.origine='fattura_fornitore' THEN
      IF q IS DISTINCT FROM oldrow.quantita OR pr IS DISTINCT FROM oldrow.prezzo_unitario
       OR x->>'descrizione' IS DISTINCT FROM oldrow.descrizione OR x->>'unita_misura' IS DISTINCT FROM oldrow.unita_misura
       OR typ IS DISTINCT FROM oldrow.tipo_riga OR det IS DISTINCT FROM oldrow.dettagli_analitici THEN
       RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Dati fattura acquisiti immutabili'; END IF;
    ELSIF oldrow.origine='rapportino' THEN
      IF q IS DISTINCT FROM oldrow.quantita OR x->>'unita_misura' IS DISTINCT FROM oldrow.unita_misura
        OR typ IS DISTINCT FROM oldrow.tipo_riga OR det IS DISTINCT FROM oldrow.dettagli_analitici THEN
        RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Provenienza Rapportino immutabile'; END IF;
      PERFORM artecna_guardie.verifica_riga_economia_rapportino(oldrow,true);
    ELSE
    IF typ<>'generica' AND det->'sorgente' IS DISTINCT FROM oldrow.dettagli_analitici->'sorgente' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Provenienza analitica immutabile'; END IF;
    IF typ<>'generica' AND NOT (x ? 'dettagli_analitici') AND (q IS DISTINCT FROM oldrow.quantita OR pr IS DISTINCT FROM oldrow.prezzo_unitario) THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Modifica economica analitica richiede dettagli aggiornati'; END IF;
    srcrow:=NULL;
    IF typ<>'generica' THEN
      SELECT s.* INTO srcrow FROM public.economia_sorgenti s WHERE s.id=oldrow.sorgente_id AND s.raccolta_id=v_r.id;
      IF NOT FOUND OR srcrow.formato<>'excel' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Sorgente analitica assente'; END IF;
    END IF;
    det:=public.economia_valida_dettagli(typ,det,srcrow.snapshot,srcrow.snapshot_version,oldrow.indice_voce_sorgente,q,pr,x->>'unita_misura',x->>'descrizione',false);
    END IF;
    UPDATE public.economia_righe l SET tipo_riga=typ,dettagli_analitici=det,ordine=(x->>'ordine')::integer,descrizione=x->>'descrizione',unita_misura=x->>'unita_misura',quantita=q,prezzo_unitario=pr,note=x->>'note',updated_at=now() WHERE l.id=rid AND l.raccolta_id=v_r.id;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riga non appartenente alla raccolta'; END IF;
   ELSE
    IF rid IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='ID nuova riga assegnato dal server'; END IF;
    typ:=CASE WHEN x ? 'tipo_riga' THEN x->>'tipo_riga' ELSE 'generica' END;
    det:=nullif(x->'dettagli_analitici','null'::jsonb);
    srcrow:=NULL;
    IF typ<>'generica' THEN
      IF x->>'origine' IS DISTINCT FROM 'file' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Origine analitica deve essere file'; END IF;
      SELECT s.* INTO srcrow FROM public.economia_sorgenti s WHERE s.id=(x->>'sorgente_id')::uuid AND s.raccolta_id=v_r.id;
      IF NOT FOUND OR srcrow.formato<>'excel' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Sorgente analitica assente'; END IF;
    END IF;
    det:=public.economia_valida_dettagli(typ,det,srcrow.snapshot,srcrow.snapshot_version,(x->>'indice_voce_sorgente')::integer,q,pr,x->>'unita_misura',x->>'descrizione',false);
    INSERT INTO public.economia_righe(tipo_riga,dettagli_analitici,raccolta_id,ordine,descrizione,unita_misura,quantita,prezzo_unitario,note,origine,sorgente_id,indice_voce_sorgente,created_by)
      VALUES(typ,det,v_r.id,(x->>'ordine')::integer,x->>'descrizione',x->>'unita_misura',q,pr,x->>'note',x->>'origine',(x->>'sorgente_id')::uuid,(x->>'indice_voce_sorgente')::integer,v_user) RETURNING id INTO rid;
   END IF;
   changed:=array_append(changed,rid);
  END LOOP;
 END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'riordino','[]'::jsonb)) LOOP
  IF jsonb_typeof(x)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(x) z(key) WHERE z.key NOT IN ('id','ordine')) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riordino non valido'; END IF;
  rid:=(x->>'id')::uuid; IF rid IS NULL OR rid=ANY(seen) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riordino ripetuto'; END IF;
  UPDATE public.economia_righe l SET ordine=(x->>'ordine')::integer,updated_at=now() WHERE l.id=rid AND l.raccolta_id=v_r.id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riga non appartenente alla raccolta'; END IF; seen:=array_append(seen,rid);
 END LOOP;
 SET CONSTRAINTS public.economia_righe_ordine_unique IMMEDIATE;
 UPDATE public.economia_raccolte e SET revisione=e.revisione+1,updated_at=now() WHERE e.id=v_r.id RETURNING * INTO v_r;
 RETURN jsonb_build_object('raccolta',to_jsonb(v_r),'totale',(SELECT sum(round(l.quantita*l.prezzo_unitario,2)) FROM public.economia_righe l WHERE l.raccolta_id=v_r.id),
 'righe_non_valorizzate',(SELECT count(*) FROM public.economia_righe l WHERE l.raccolta_id=v_r.id AND l.prezzo_unitario IS NULL)) || CASE WHEN jsonb_array_length(esiti_fattura)>0 THEN jsonb_build_object('esiti_fattura',esiti_fattura) ELSE '{}'::jsonb END; END;
$function$
;
ALTER FUNCTION public.salva_bozza_economia(uuid,bigint,jsonb) OWNER TO "artecna_economia_rpc";
CREATE OR REPLACE FUNCTION artecna_rapportini.crea_proiezione_foto_v1(p_id uuid, p_lease uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
 IF session_user<>'artecna_rapportini_backend' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='F3C3: writer riservato'; END IF;
 RETURN artecna_rapportini.f3c3_inserisci_proiezione(p_id,p_lease);
END;
$function$
;
ALTER FUNCTION artecna_rapportini.crea_proiezione_foto_v1(uuid,uuid) OWNER TO "artecna_foto_v1_writer";
CREATE OR REPLACE FUNCTION public.assegna_materiale_fattura_cantiere(p_fattura_riga_id uuid, p_cantiere_id uuid, p_quantita_da_assegnare numeric, p_unita_misura text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE r public.fatture_fornitori_righe%rowtype; f public.fatture_fornitori%rowtype;
 nome text; a numeric; prezzo numeric; nuovo uuid; s text;
BEGIN
 PERFORM artecna_guardie.materiali_fattura_blocca(p_fattura_riga_id,p_cantiere_id);
 SELECT * INTO STRICT r FROM public.fatture_fornitori_righe WHERE id=p_fattura_riga_id;
 SELECT * INTO STRICT f FROM public.fatture_fornitori WHERE id=r.fattura_id;
 SELECT c.nome INTO STRICT nome FROM public.cantieri c WHERE c.id=p_cantiere_id;
 IF nome IS NULL OR btrim(nome)='' OR r.descrizione IS NULL OR btrim(r.descrizione)=''
 OR r.quantita IS NULL OR r.quantita<=0 OR r.quantita<>round(r.quantita,6)
 OR r.quantita>=1000000000000 OR r.quantita::text IN ('NaN','Infinity','-Infinity')
 OR r.prezzo_unitario IS NULL OR r.prezzo_unitario<0 OR r.prezzo_unitario::text IN ('NaN','Infinity','-Infinity')
 OR p_quantita_da_assegnare IS NULL OR p_quantita_da_assegnare<=0 OR p_quantita_da_assegnare>=1000000000000
 OR p_quantita_da_assegnare<>round(p_quantita_da_assegnare,6) OR p_quantita_da_assegnare::text IN ('NaN','Infinity','-Infinity')
 OR p_unita_misura IS NULL OR btrim(p_unita_misura)='' OR length(p_unita_misura)>64 OR p_unita_misura ~ '[[:cntrl:]]'
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Materiale fattura non valido'; END IF;
 -- Il lock helper ha gia escluso documenti con costi legacy ambigui, senza backfill.
 a:=artecna_guardie.materiali_fattura_totale(r.id);
 IF a<0 OR a>=r.quantita OR p_quantita_da_assegnare>r.quantita-a THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Quantita oltre disponibilita: '||(r.quantita-a)::text; END IF;
 prezzo:=round(r.prezzo_unitario,6);
 IF prezzo>=1000000000000 THEN RAISE EXCEPTION 'Prezzo non rappresentabile'; END IF;
 INSERT INTO public.materiali_cantiere(cantiere_id,cantiere,descrizione,quantita,unita_misura,prezzo_unitario,totale,
  fattura_riga_id,fornitore,data_documento,nome_file,file_tipo,anteprima_testo,created_at)
 VALUES(p_cantiere_id,nome,r.descrizione,p_quantita_da_assegnare,btrim(p_unita_misura),prezzo,
  round(p_quantita_da_assegnare*prezzo,2),r.id,f.fornitore,f.data_fattura,f.nome_file,f.tipo_file,
  'Fattura '||coalesce(f.numero_fattura,''),statement_timestamp()) RETURNING id INTO nuovo;
 s:=artecna_guardie.materiali_fattura_stato(f.id);
 RETURN jsonb_build_object('id',nuovo,'fattura_riga_id',r.id,'quantita_assegnata',a+p_quantita_da_assegnare,
  'quantita_residua',r.quantita-a-p_quantita_da_assegnare,'stato_fattura',s);
END $function$
;
ALTER FUNCTION public.assegna_materiale_fattura_cantiere(uuid,uuid,numeric,text) OWNER TO "artecna_materiali_fattura_rpc";
CREATE OR REPLACE FUNCTION public.usa_raccolta_economia_in_variante(p_raccolta_id uuid, p_revisione_attesa bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE utente uuid; cid uuid; c public.cantieri%rowtype; r public.economia_raccolte%rowtype;
 v public.varianti_cantiere%rowtype; s public.variante_sorgenti%rowtype; es public.economia_sorgenti%rowtype;
 er public.economia_righe%rowtype; revision_s bigint; revision_f bigint; registrazioni jsonb:='[]'; snap jsonb;
 importo numeric(18,2); totale numeric(18,2):=0; n integer:=0; collegata uuid; riuso boolean:=false; voce jsonb;
BEGIN
 IF current_user<>'artecna_ponte_economia_rpc' THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Contesto RPC non consentito'; END IF;
 IF p_raccolta_id IS NULL OR p_revisione_attesa IS NULL OR p_revisione_attesa<0 THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Input acquisizione non valido'; END IF;
 utente:=artecna_guardie.utente_jwt_corrente();
 SELECT cantiere_id INTO cid FROM public.economia_raccolte WHERE id=p_raccolta_id;
 IF utente IS NULL OR cid IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Acquisizione non autorizzata'; END IF;
 SELECT * INTO c FROM public.cantieri WHERE id=cid FOR UPDATE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(utente,cid) IS DISTINCT FROM true THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non autorizzato'; END IF;
 PERFORM user_id FROM public.utenti_cantiere WHERE cantiere_id=cid AND user_id=utente AND ruolo='owner' FOR SHARE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(utente,cid) IS DISTINCT FROM true THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato'; END IF;
 -- Nessun lock Preventivo prima della Variante; il cantiere ne serializza il riferimento.
 IF c.preventivo_contrattuale_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.preventivi_cantiere
   WHERE id=c.preventivo_contrattuale_id AND cantiere_id=cid) THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Contesto contrattuale non valido'; END IF;
 SELECT variante_id INTO collegata FROM public.variante_sorgenti
   WHERE economia_raccolta_id=p_raccolta_id AND tipo='raccolta_economia';
 IF collegata IS NOT NULL THEN
   SELECT * INTO v FROM public.varianti_cantiere WHERE id=collegata FOR UPDATE;
   IF NOT FOUND OR v.cantiere_id<>cid OR v.preventivo_contrattuale_id<>c.preventivo_contrattuale_id THEN
     RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Variante collegata incoerente'; END IF;
   riuso:=true;
 END IF;
 SELECT * INTO r FROM public.economia_raccolte WHERE id=p_raccolta_id AND cantiere_id=cid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Raccolta non autorizzata'; END IF;
 IF riuso THEN
   SELECT * INTO s FROM public.variante_sorgenti WHERE economia_raccolta_id=r.id AND tipo='raccolta_economia';
   IF NOT FOUND OR s.variante_id<>v.id OR r.stato<>'chiusa' OR r.revisione<>s.economia_revisione_congelata THEN
     RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Collegamento Economia incoerente'; END IF;
   revision_s:=s.economia_revisione_sorgente; revision_f:=s.economia_revisione_congelata;
 ELSE
   IF r.revisione<>p_revisione_attesa THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Revisione Economia divergente'; END IF;
   IF r.stato NOT IN ('bozza','chiusa') THEN RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato Economia incoerente'; END IF;
   revision_s:=r.revisione;
   IF r.stato='bozza' AND r.revisione=9223372036854775807 THEN
     RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Revisione non rappresentabile'; END IF;
   revision_f:=r.revisione+CASE WHEN r.stato='bozza' THEN 1 ELSE 0 END;
 END IF;
 -- Le sorgenti precedono le righe, entrambe ordinate, dopo la testata Raccolta.
 PERFORM id FROM public.economia_sorgenti WHERE raccolta_id=r.id ORDER BY id FOR SHARE;
 FOR er IN SELECT * FROM public.economia_righe WHERE raccolta_id=r.id ORDER BY ordine,id FOR SHARE LOOP
   IF er.quantita<=0 OR er.prezzo_unitario IS NULL OR er.prezzo_unitario<=0
     OR er.quantita::text IN ('NaN','Infinity','-Infinity') OR er.prezzo_unitario::text IN ('NaN','Infinity','-Infinity')
     OR er.descrizione !~ '[^[:space:]]' THEN
     RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Registrazione Economia non rappresentabile'; END IF;
   importo:=round(er.quantita*er.prezzo_unitario,2);
   IF importo<=0 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Importo Economia non rappresentabile'; END IF;
   IF er.origine='fattura_fornitore' THEN
     PERFORM artecna_guardie.verifica_materiale_fattura_economia(er);
   ELSIF er.origine='rapportino' THEN
     PERFORM artecna_guardie.verifica_riga_economia_rapportino(er,NOT riuso);
   ELSE
   es:=NULL;
   IF er.tipo_riga<>'generica' THEN
     SELECT * INTO es FROM public.economia_sorgenti WHERE id=er.sorgente_id AND raccolta_id=r.id;
     IF NOT FOUND OR es.formato<>'excel' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Sorgente analitica non valida'; END IF;
   END IF;
   PERFORM public.economia_valida_dettagli(er.tipo_riga,er.dettagli_analitici,es.snapshot,es.snapshot_version,
     er.indice_voce_sorgente,er.quantita,er.prezzo_unitario,er.unita_misura,er.descrizione,true);
   END IF;
   n:=n+1; totale:=totale+importo;
   registrazioni:=registrazioni||jsonb_build_array(jsonb_build_object('id',er.id,'ordine',er.ordine,
     'descrizione',er.descrizione,'unita_misura',er.unita_misura,'quantita',er.quantita,'prezzo_unitario',er.prezzo_unitario,
     'importo',importo,'note',er.note,'origine',er.origine,'sorgente_id',er.sorgente_id,
     'indice_voce_sorgente',er.indice_voce_sorgente,'tipo_riga',er.tipo_riga,'dettagli_analitici',er.dettagli_analitici));
 END LOOP;
 IF n=0 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Raccolta Economia vuota'; END IF;
 snap:=jsonb_build_object('raccolta_id',r.id,'cantiere_id',cid,'numero',r.numero,'titolo',r.titolo,'data',r.data,'note',r.note,
   'revisione_sorgente',revision_s,'revisione_congelata',revision_f,'totale',totale,'numero_registrazioni',n,'registrazioni',registrazioni);
 IF NOT riuso THEN
   IF r.stato='bozza' THEN
     PERFORM public.chiudi_raccolta_economia(r.id,p_revisione_attesa);
     SELECT * INTO r FROM public.economia_raccolte WHERE id=p_raccolta_id;
     IF r.stato<>'chiusa' OR r.revisione<>revision_f THEN
       RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Chiusura Economia incoerente'; END IF;
   END IF;
   INSERT INTO public.varianti_cantiere(cantiere_id,preventivo_contrattuale_id,numero,titolo,descrizione,stato,data_variante)
     VALUES(cid,c.preventivo_contrattuale_id,NULL,r.titolo,coalesce(r.note,''),'bozza',r.data) RETURNING * INTO v;
   INSERT INTO public.variante_sorgenti(variante_id,tipo,titolo,snapshot_version,snapshot,economia_raccolta_id,
     economia_revisione_sorgente,economia_revisione_congelata)
     VALUES(v.id,'raccolta_economia',r.titolo,1,snap,r.id,revision_s,revision_f) RETURNING * INTO s;
   n:=0;
   FOR voce IN SELECT value FROM jsonb_array_elements(registrazioni) LOOP
     INSERT INTO public.variante_lavorazioni(variante_id,numero_riga,operazione,descrizione,unita_misura,
       quantita_delta,prezzo_unitario,delta_contratto,note,variante_sorgente_id,indice_voce_sorgente,
       riferimento_preventivo_lavorazione_id,riferimento_variante_lavorazione_id)
     VALUES(v.id,n+1,'nuova',voce->>'descrizione',voce->>'unita_misura',(voce->>'quantita')::numeric,
       (voce->>'prezzo_unitario')::numeric,(voce->>'importo')::numeric,coalesce(voce->>'note',''),s.id,n,NULL,NULL);
     n:=n+1;
   END LOOP;
 END IF;
 PERFORM artecna_guardie.verifica_acquisizione_economia(s.id,snap);
 RETURN jsonb_build_object('versione_contratto',1,'riutilizzata',riuso,'raccolta_id',r.id,
   'revisione_sorgente',revision_s,'revisione_congelata',revision_f,'variante_id',v.id,'numero_variante',v.numero,
   'stato_variante',v.stato,'variante_sorgente_id',s.id,'numero_lavorazioni',n,'totale',totale);
EXCEPTION
 WHEN numeric_value_out_of_range OR invalid_text_representation THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Registrazione Economia non rappresentabile';
 WHEN serialization_failure OR deadlock_detected THEN
   RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Conflitto concorrente Economia';
 WHEN SQLSTATE '22023' OR SQLSTATE '42501' OR SQLSTATE 'PT409' OR SQLSTATE 'XX001' THEN RAISE;
 WHEN OTHERS THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='Acquisizione Economia non completata';
END;
$function$
;
ALTER FUNCTION public.usa_raccolta_economia_in_variante(uuid,bigint) OWNER TO "artecna_ponte_economia_rpc";
CREATE OR REPLACE FUNCTION artecna_guardie.verifica_acquisizione_economia(p_sorgente uuid, p_snapshot jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE s public.variante_sorgenti%rowtype; n bigint; totale numeric; voce jsonb; l public.variante_lavorazioni%rowtype; i integer:=0;
 er public.economia_righe%rowtype; n_economia bigint; totale_economia numeric;
BEGIN
 SELECT * INTO s FROM public.variante_sorgenti WHERE id=p_sorgente;
 IF NOT FOUND OR s.tipo<>'raccolta_economia' OR s.snapshot_version<>1 OR s.snapshot IS DISTINCT FROM p_snapshot THEN
   RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Collegamento Economia incoerente'; END IF;
 IF s.titolo IS DISTINCT FROM p_snapshot->>'titolo'
   OR s.economia_raccolta_id::text IS DISTINCT FROM p_snapshot->>'raccolta_id'
   OR s.economia_revisione_sorgente IS DISTINCT FROM (p_snapshot->>'revisione_sorgente')::bigint
   OR s.economia_revisione_congelata IS DISTINCT FROM (p_snapshot->>'revisione_congelata')::bigint THEN
   RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Metadata sorgente Economia incoerenti'; END IF;
 SELECT count(*),sum(delta_contratto) INTO n,totale FROM public.variante_lavorazioni WHERE variante_id=s.variante_id;
 SELECT count(*),sum(round(quantita*prezzo_unitario,2)) INTO n_economia,totale_economia
   FROM public.economia_righe WHERE raccolta_id=s.economia_raccolta_id;
 IF n IS DISTINCT FROM (p_snapshot->>'numero_registrazioni')::bigint
   OR n=0 OR n<>n_economia OR totale IS DISTINCT FROM totale_economia
   OR totale IS DISTINCT FROM (p_snapshot->>'totale')::numeric
   OR (SELECT count(*) FROM public.variante_sorgenti WHERE variante_id=s.variante_id)<>1 THEN
   RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Riconciliazione Economia incoerente'; END IF;
 FOR voce IN SELECT value FROM jsonb_array_elements(p_snapshot->'registrazioni') LOOP
   SELECT * INTO er FROM public.economia_righe WHERE id=(voce->>'id')::uuid AND raccolta_id=s.economia_raccolta_id;
   IF NOT FOUND OR voce IS DISTINCT FROM jsonb_build_object('id',er.id,'ordine',er.ordine,
     'descrizione',er.descrizione,'unita_misura',er.unita_misura,'quantita',er.quantita,'prezzo_unitario',er.prezzo_unitario,
     'importo',round(er.quantita*er.prezzo_unitario,2),'note',er.note,'origine',er.origine,
     'sorgente_id',er.sorgente_id,'indice_voce_sorgente',er.indice_voce_sorgente,
     'tipo_riga',er.tipo_riga,'dettagli_analitici',er.dettagli_analitici) THEN
     RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Snapshot registrazione Economia incoerente'; END IF;
   SELECT * INTO l FROM public.variante_lavorazioni WHERE variante_id=s.variante_id
     AND variante_sorgente_id=s.id AND indice_voce_sorgente=i;
   IF NOT FOUND OR l.numero_riga<>i+1 OR l.operazione<>'nuova'
     OR l.descrizione IS DISTINCT FROM voce->>'descrizione' OR l.unita_misura IS DISTINCT FROM voce->>'unita_misura'
     OR l.quantita_delta IS DISTINCT FROM (voce->>'quantita')::numeric
     OR l.prezzo_unitario IS DISTINCT FROM (voce->>'prezzo_unitario')::numeric
     OR l.delta_contratto IS DISTINCT FROM (voce->>'importo')::numeric
     OR l.note IS DISTINCT FROM coalesce(voce->>'note','')
     OR l.riferimento_preventivo_lavorazione_id IS NOT NULL OR l.riferimento_variante_lavorazione_id IS NOT NULL THEN
     RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Riconciliazione riga Economia incoerente'; END IF;
   i:=i+1;
 END LOOP;
 IF i<>n THEN RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Numero registrazioni incoerente'; END IF;
END;
$function$
;
ALTER FUNCTION artecna_guardie.verifica_acquisizione_economia(uuid,jsonb) OWNER TO "artecna_ponte_economia_rpc";
CREATE OR REPLACE FUNCTION public.archivia_preventivo_strutturato(p_cantiere_id uuid, p_archiviazione_key uuid, p_nome_file text, p_file_path text, p_file_url text, p_file_tipo text, p_anteprima_testo text, p_importo_totale numeric, p_lavorazioni jsonb)
 RETURNS TABLE(preventivo_id uuid, cantiere_id uuid, archiviazione_key uuid, importo_totale numeric, numero_lavorazioni bigint, riutilizzato boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid;
  v_nome_cantiere text;
  v_nome_file text;
  v_file_path text;
  v_file_url text;
  v_file_tipo text;

  v_item jsonb;
  v_rows jsonb := '[]'::jsonb;
  v_canonical_rows jsonb := '[]'::jsonb;
  v_canonical_payload jsonb;
  v_expected_bag jsonb;
  v_actual_bag jsonb;

  v_descrizione text;
  v_um text;
  v_quantita numeric;
  v_prezzo numeric;
  v_importo numeric;
  v_atteso numeric;

  v_hash text;
  v_preventivo_id uuid;
  v_head record;
  v_created boolean := false;
  v_expected_count bigint;
  v_count bigint;
  v_inserted bigint := 0;
  v_affected bigint;
  v_links_ok boolean;
  v_constraint text;
BEGIN
  IF current_user <> 'artecna_preventivi_rpc' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P2041',
      MESSAGE = 'Contesto interno RPC non valido';
  END IF;

  BEGIN
    v_user_id := artecna_guardie.utente_jwt_corrente();
  EXCEPTION
    WHEN invalid_text_representation THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P2041',
        MESSAGE = 'Identità JWT non valida';
  END;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P2041',
      MESSAGE = 'Identità autenticata assente';
  END IF;

  IF p_cantiere_id IS NULL OR p_archiviazione_key IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P2043',
      MESSAGE = 'Cantiere e chiave di archiviazione obbligatori';
  END IF;

  IF artecna_guardie.utente_puo_modificare_cantiere(
      v_user_id, p_cantiere_id
    ) IS DISTINCT FROM TRUE
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P2042',
      MESSAGE = 'Utente non autorizzato sul cantiere';
  END IF;

  SELECT c.nome
  INTO v_nome_cantiere
  FROM public.cantieri AS c
  WHERE c.id = p_cantiere_id
  FOR UPDATE;

  IF NOT FOUND OR v_nome_cantiere IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P2042',
      MESSAGE = 'Cantiere non disponibile';
  END IF;

  IF artecna_guardie.utente_puo_modificare_cantiere(
      v_user_id, p_cantiere_id
    ) IS DISTINCT FROM TRUE
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P2042',
      MESSAGE = 'Autorizzazione non confermata dopo il lock';
  END IF;

  v_nome_file := btrim(p_nome_file);
  v_file_path := btrim(p_file_path);
  v_file_url := nullif(btrim(p_file_url), '');
  v_file_tipo := btrim(p_file_tipo);

  IF v_nome_file IS NULL OR v_nome_file = ''
     OR v_file_path IS NULL OR v_file_path = ''
     OR v_file_tipo IS NULL
     OR v_file_tipo NOT IN ('pdf', 'excel', 'img')
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P2043',
      MESSAGE = 'Metadati documento mancanti o non validi';
  END IF;

  IF v_file_path !~ '^cantieri/[^/]+/documenti/[^/]+$'
     OR position('..' IN v_file_path) > 0
     OR position(chr(92) IN v_file_path) > 0
     OR v_file_path ~ '[[:cntrl:]]'
     OR btrim(split_part(v_file_path, '/', 2)) IN ('', '.')
     OR btrim(split_part(v_file_path, '/', 4)) IN ('', '.')
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P2043',
      MESSAGE = 'Percorso documento non valido';
  END IF;

  IF p_importo_totale IS NULL
     OR p_importo_totale::text IN ('NaN', 'Infinity', '-Infinity')
     OR p_importo_totale <= 0
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P2043',
      MESSAGE = 'Importo totale non valido';
  END IF;

  IF jsonb_typeof(p_lavorazioni) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P2044',
      MESSAGE = 'Le lavorazioni devono essere un array JSON';
  END IF;

  v_expected_count := jsonb_array_length(p_lavorazioni);

  IF v_expected_count = 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P2044',
      MESSAGE = 'Occorre almeno una lavorazione';
  END IF;

  FOR v_item IN
    SELECT e.value
    FROM jsonb_array_elements(p_lavorazioni)
         WITH ORDINALITY AS e(value, ord)
    ORDER BY e.ord
  LOOP
    IF jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P2044',
        MESSAGE = 'Ogni lavorazione deve essere un oggetto JSON';
    END IF;

    IF NOT (
      v_item ?& ARRAY[
        'descrizione', 'unita_misura', 'quantita',
        'prezzo_unitario', 'importo_previsto'
      ]
    ) OR (
      v_item - ARRAY[
        'descrizione', 'unita_misura', 'quantita',
        'prezzo_unitario', 'importo_previsto'
      ]::text[]
    ) <> '{}'::jsonb THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P2044',
        MESSAGE = 'Proprietà della lavorazione mancanti o aggiuntive';
    END IF;

    IF jsonb_typeof(v_item -> 'descrizione')
          IS DISTINCT FROM 'string'
       OR jsonb_typeof(v_item -> 'unita_misura')
          IS DISTINCT FROM 'string'
       OR jsonb_typeof(v_item -> 'quantita')
          IS DISTINCT FROM 'number'
       OR jsonb_typeof(v_item -> 'prezzo_unitario')
          IS DISTINCT FROM 'number'
       OR jsonb_typeof(v_item -> 'importo_previsto')
          IS DISTINCT FROM 'number'
    THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P2044',
        MESSAGE = 'Tipi delle proprietà della lavorazione non validi';
    END IF;

    v_descrizione := btrim(v_item ->> 'descrizione');
    v_um := btrim(v_item ->> 'unita_misura');
    v_quantita := (v_item ->> 'quantita')::numeric;
    v_prezzo := (v_item ->> 'prezzo_unitario')::numeric;
    v_importo := (v_item ->> 'importo_previsto')::numeric;

    IF v_descrizione = '' OR v_um = ''
       OR v_quantita::text IN ('NaN', 'Infinity', '-Infinity')
       OR v_prezzo::text IN ('NaN', 'Infinity', '-Infinity')
       OR v_importo::text IN ('NaN', 'Infinity', '-Infinity')
       OR v_quantita <= 0
       OR v_prezzo < 0
       OR v_importo < 0
    THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P2044',
        MESSAGE = 'Valori della lavorazione non validi';
    END IF;

    BEGIN
      v_atteso := round(v_quantita * v_prezzo, 2);

      IF v_atteso::text IN ('NaN', 'Infinity', '-Infinity')
         OR abs(v_importo - v_atteso) > 0.02
      THEN
        RAISE EXCEPTION USING
          ERRCODE = 'P2045',
          MESSAGE = 'Importo lavorazione incoerente con quantità e prezzo';
      END IF;
    EXCEPTION
      WHEN numeric_value_out_of_range THEN
        RAISE EXCEPTION USING
          ERRCODE = 'P2045',
          MESSAGE = 'Calcolo economico fuori dal dominio numeric';
    END;

    -- Valori da persistere: nessun rounding dei numerici.
    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'descrizione', v_descrizione,
      'unita_misura', v_um,
      'quantita', v_quantita,
      'prezzo_unitario', v_prezzo,
      'importo_previsto', v_importo
    ));

    -- Canonizzazione separata per il fingerprint.
    v_canonical_rows :=
      v_canonical_rows || jsonb_build_array(jsonb_build_object(
        'descrizione', v_descrizione,
        'unita_misura', v_um,
        'quantita', trim_scale(v_quantita),
        'prezzo_unitario', trim_scale(v_prezzo),
        'importo_previsto', trim_scale(v_importo)
      ));
  END LOOP;

  v_canonical_payload := jsonb_build_object(
    'fingerprint_version', 'artecna-preventivo-v1',
    'user_id', v_user_id,
    'cantiere_id', p_cantiere_id,
    'nome_file', v_nome_file,
    'file_path', v_file_path,
    'file_url', v_file_url,
    'file_tipo', v_file_tipo,
    'anteprima_testo', p_anteprima_testo,
    'importo_totale', trim_scale(p_importo_totale),
    'lavorazioni', v_canonical_rows
  );

  v_hash := encode(
    pg_catalog.sha256(
      pg_catalog.convert_to(v_canonical_payload::text, 'UTF8')
    ),
    'hex'
  );

  -- Percorso ordinario di idempotenza, dopo il lock del cantiere.
  SELECT p.id
  INTO v_preventivo_id
  FROM public.preventivi_cantiere AS p
  WHERE p.archiviazione_key = p_archiviazione_key;

  IF NOT FOUND THEN
    v_preventivo_id := pg_catalog.gen_random_uuid();

    -- L'handler copre esclusivamente l'INSERT della testata.
    BEGIN
      INSERT INTO public.preventivi_cantiere (
        id, cantiere, cantiere_id, importo_totale,
        nome_file, note, file_url, file_tipo,
        anteprima_testo, file_path, stato_preventivo, approvato,
        archiviazione_key, archiviazione_payload_hash
      )
      VALUES (
        v_preventivo_id,
        v_nome_cantiere,
        p_cantiere_id,
        p_importo_totale,
        v_nome_file,
        'Archiviato da analisi documento.',
        v_file_url,
        v_file_tipo,
        p_anteprima_testo,
        v_file_path,
        'bozza',
        false,
        p_archiviazione_key,
        v_hash
      );

      GET DIAGNOSTICS v_affected = ROW_COUNT;

      IF v_affected <> 1 THEN
        RAISE EXCEPTION USING
          ERRCODE = 'P2048',
          MESSAGE = 'Inserimento testata non confermato';
      END IF;

      v_created := true;

    EXCEPTION
      WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS
          v_constraint = CONSTRAINT_NAME;

        IF v_constraint IS DISTINCT FROM
          'preventivi_cantiere_archiviazione_key_uidx'
        THEN
          RAISE;
        END IF;

        -- Fail closed:
        -- nessuna rilettura del concorrente e nessun successo.
        RAISE EXCEPTION USING
          ERRCODE = 'P2048',
          MESSAGE = 'Conflitto concorrente: ripetere la richiesta';
    END;
  END IF;

  -- Raggiungibile soltanto dopo INSERT riuscito
  -- oppure tramite la SELECT ordinaria della key.
  SELECT
    p.id,
    p.cantiere,
    p.cantiere_id,
    p.importo_totale,
    p.nome_file,
    p.note,
    p.file_url,
    p.file_tipo,
    p.anteprima_testo,
    p.file_path,
    p.stato_preventivo,
    p.approvato,
    p.archiviazione_key,
    p.archiviazione_payload_hash
  INTO v_head
  FROM public.preventivi_cantiere AS p
  WHERE p.id = v_preventivo_id
    AND p.archiviazione_key = p_archiviazione_key;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P2047',
      MESSAGE = 'Risultato di archiviazione non più disponibile';
  END IF;

  IF v_head.cantiere_id IS DISTINCT FROM p_cantiere_id
     OR v_head.archiviazione_payload_hash IS DISTINCT FROM v_hash
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P2046',
      MESSAGE = 'Chiave già utilizzata per un diverso payload o cantiere';
  END IF;

  IF v_head.nome_file IS DISTINCT FROM v_nome_file
     OR v_head.file_path IS DISTINCT FROM v_file_path
     OR v_head.file_url IS DISTINCT FROM v_file_url
     OR v_head.file_tipo IS DISTINCT FROM v_file_tipo
     OR v_head.anteprima_testo IS DISTINCT FROM p_anteprima_testo
     OR v_head.importo_totale IS DISTINCT FROM p_importo_totale
     OR v_head.note IS DISTINCT FROM 'Archiviato da analisi documento.'
     OR v_head.stato_preventivo IS DISTINCT FROM 'bozza'
     OR v_head.approvato IS DISTINCT FROM false
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P2047',
      MESSAGE = 'Testata archiviata successivamente alterata';
  END IF;

  IF v_created THEN
    FOR v_item IN
      SELECT e.value
      FROM jsonb_array_elements(v_rows)
           WITH ORDINALITY AS e(value, ord)
      ORDER BY e.ord
    LOOP
      INSERT INTO public.preventivo_lavorazioni (
        cantiere,
        cantiere_id,
        preventivo_id,
        descrizione,
        unita_misura,
        quantita,
        prezzo_unitario,
        importo_previsto,
        fonte
      )
      VALUES (
        v_nome_cantiere,
        p_cantiere_id,
        v_preventivo_id,
        v_item ->> 'descrizione',
        v_item ->> 'unita_misura',
        (v_item ->> 'quantita')::numeric,
        (v_item ->> 'prezzo_unitario')::numeric,
        (v_item ->> 'importo_previsto')::numeric,
        'documento'
      );

      GET DIAGNOSTICS v_affected = ROW_COUNT;
      v_inserted := v_inserted + v_affected;
    END LOOP;

    IF v_inserted <> v_expected_count THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P2048',
        MESSAGE = 'Numero INSERT lavorazioni non corrispondente';
    END IF;
  END IF;

  -- L'ordine è significativo nel fingerprint.
  -- La verifica persistita confronta il multinsieme dei contenuti,
  -- conservando i duplicati: la tabella non ha una colonna ordinale.
  SELECT jsonb_agg(
    e.value ORDER BY e.value::text COLLATE "C"
  )
  INTO v_expected_bag
  FROM jsonb_array_elements(v_canonical_rows) AS e(value);

  SELECT
    count(*),
    coalesce(
      bool_and(
        l.cantiere_id IS NOT DISTINCT FROM p_cantiere_id
        AND l.cantiere IS NOT DISTINCT FROM v_head.cantiere
        AND l.fonte IS NOT DISTINCT FROM 'documento'
      ),
      false
    ),
    jsonb_agg(
      jsonb_build_object(
        'descrizione', l.descrizione,
        'unita_misura', l.unita_misura,
        'quantita', trim_scale(l.quantita),
        'prezzo_unitario', trim_scale(l.prezzo_unitario),
        'importo_previsto', trim_scale(l.importo_previsto)
      )
      ORDER BY
        jsonb_build_object(
          'descrizione', l.descrizione,
          'unita_misura', l.unita_misura,
          'quantita', trim_scale(l.quantita),
          'prezzo_unitario', trim_scale(l.prezzo_unitario),
          'importo_previsto', trim_scale(l.importo_previsto)
        )::text COLLATE "C"
    )
  INTO v_count, v_links_ok, v_actual_bag
  FROM public.preventivo_lavorazioni AS l
  WHERE l.preventivo_id = v_preventivo_id;

  IF v_count <> v_expected_count
     OR v_links_ok IS DISTINCT FROM TRUE
     OR v_actual_bag IS DISTINCT FROM v_expected_bag
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P2047',
      MESSAGE = 'Lavorazioni archiviate incomplete o alterate';
  END IF;

  RETURN QUERY
  SELECT
    v_preventivo_id,
    p_cantiere_id,
    p_archiviazione_key,
    v_head.importo_totale::numeric,
    v_count,
    NOT v_created;
END;
$function$
;
ALTER FUNCTION public.archivia_preventivo_strutturato(uuid,uuid,text,text,text,text,text,numeric,jsonb) OWNER TO "artecna_preventivi_rpc";
CREATE OR REPLACE FUNCTION public.struttura_preventivo_esistente(p_preventivo_id uuid, p_lavorazioni jsonb)
 RETURNS TABLE(preventivo_id uuid, cantiere_id uuid, numero_lavorazioni bigint, importo_preventivo numeric, totale_lavorazioni numeric, riutilizzato boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
    v_user_id uuid;
    v_cantiere_id uuid;
    v_cantiere_nome text;
    v_importo_preventivo numeric;
    v_numero_input integer;
    v_numero_esistente bigint;
    v_totale_esistente numeric;
    v_numero_finale bigint;
    v_totale_finale numeric;
    v_totale_input numeric;
BEGIN
    IF current_user <> 'artecna_preventivi_rpc' THEN
        RAISE EXCEPTION USING
            ERRCODE = '42501',
            MESSAGE = 'Contesto interno RPC Preventivi non valido';
    END IF;

    BEGIN
        v_user_id := artecna_guardie.utente_jwt_corrente();
    EXCEPTION
        WHEN invalid_text_representation THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P2050',
                MESSAGE = 'Identità utente non valida';
    END;

    IF v_user_id IS NULL OR p_preventivo_id IS NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2050',
            MESSAGE = 'Utente e preventivo sono obbligatori';
    END IF;

    IF p_lavorazioni IS NULL
       OR jsonb_typeof(p_lavorazioni) <> 'array'
       OR jsonb_array_length(p_lavorazioni) = 0 THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2053',
            MESSAGE = 'Le lavorazioni sono obbligatorie';
    END IF;

    SELECT
        p.cantiere_id,
        p.importo_totale
    INTO
        v_cantiere_id,
        v_importo_preventivo
    FROM public.preventivi_cantiere AS p
    WHERE p.id = p_preventivo_id;

    IF NOT FOUND
       OR v_cantiere_id IS NULL
       OR v_importo_preventivo IS NULL
       OR v_importo_preventivo <= 0 THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2051',
            MESSAGE = 'Preventivo non disponibile';
    END IF;

    IF artecna_guardie.utente_puo_modificare_cantiere(
        v_user_id,
        v_cantiere_id
    ) IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2052',
            MESSAGE = 'Utente non autorizzato sul cantiere';
    END IF;

    IF artecna_guardie.base_congelata(
        p_preventivo_id,
        v_cantiere_id
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2054',
            MESSAGE = 'La base contrattuale è congelata';
    END IF;

    SELECT c.nome
    INTO v_cantiere_nome
    FROM public.cantieri AS c
    WHERE c.id = v_cantiere_id;

    IF NOT FOUND OR btrim(COALESCE(v_cantiere_nome, '')) = '' THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2051',
            MESSAGE = 'Cantiere non disponibile';
    END IF;

    /*
      Serializza le strutturazioni dello stesso preventivo senza
      modificare la testata.
    */
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(
            p_preventivo_id::text,
            0
        )
    );

    SELECT
        count(*),
        COALESCE(round(sum(pl.importo_previsto), 2), 0)
    INTO
        v_numero_esistente,
        v_totale_esistente
    FROM public.preventivo_lavorazioni AS pl
    WHERE pl.preventivo_id = p_preventivo_id;

    /*
      Idempotenza:
      se il preventivo è già strutturato, restituiamo successo
      soltanto quando conteggio e totale coincidono con la testata.
    */
    IF v_numero_esistente > 0 THEN
        IF round(v_totale_esistente, 2)
           IS DISTINCT FROM round(v_importo_preventivo, 2) THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P2055',
                MESSAGE =
                    'Il preventivo contiene lavorazioni strutturate incoerenti';
        END IF;

        preventivo_id := p_preventivo_id;
        cantiere_id := v_cantiere_id;
        numero_lavorazioni := v_numero_esistente;
        importo_preventivo := round(v_importo_preventivo, 2);
        totale_lavorazioni := round(v_totale_esistente, 2);
        riutilizzato := true;
        RETURN NEXT;
        RETURN;
    END IF;

    /*
      Valida ogni elemento JSON prima di qualsiasi INSERT.
    */
    IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_lavorazioni) AS e(riga)
        WHERE jsonb_typeof(e.riga) <> 'object'
           OR btrim(COALESCE(e.riga->>'descrizione', '')) = ''
           OR btrim(COALESCE(e.riga->>'unita_misura', '')) = ''
           OR NOT (e.riga ? 'quantita')
           OR NOT (e.riga ? 'prezzo_unitario')
           OR NOT (e.riga ? 'importo_previsto')
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2053',
            MESSAGE = 'Lavorazioni incomplete';
    END IF;

    BEGIN
        IF EXISTS (
            SELECT 1
            FROM jsonb_array_elements(p_lavorazioni) AS e(riga)
            CROSS JOIN LATERAL (
                SELECT
                    (e.riga->>'quantita')::numeric AS quantita,
                    (e.riga->>'prezzo_unitario')::numeric AS prezzo,
                    (e.riga->>'importo_previsto')::numeric AS importo
            ) AS n
            WHERE n.quantita <= 0
               OR n.prezzo < 0
               OR n.importo < 0
               OR n.quantita = 'NaN'::numeric
               OR n.prezzo = 'NaN'::numeric
               OR n.importo = 'NaN'::numeric
               OR round(n.quantita * n.prezzo, 2)
                  IS DISTINCT FROM round(n.importo, 2)
        ) THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P2053',
                MESSAGE =
                    'Quantità, prezzo o importo di una lavorazione non validi';
        END IF;

        SELECT
            jsonb_array_length(p_lavorazioni),
            round(sum((e.riga->>'importo_previsto')::numeric), 2)
        INTO
            v_numero_input,
            v_totale_input
        FROM jsonb_array_elements(p_lavorazioni) AS e(riga);

    EXCEPTION
        WHEN invalid_text_representation
          OR numeric_value_out_of_range THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P2053',
                MESSAGE = 'Valori numerici delle lavorazioni non validi';
    END;

    IF v_numero_input < 1
       OR v_totale_input
          IS DISTINCT FROM round(v_importo_preventivo, 2) THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2056',
            MESSAGE =
                'Il totale delle lavorazioni non coincide con il preventivo';
    END IF;

    INSERT INTO public.preventivo_lavorazioni (
        cantiere,
        descrizione,
        importo_previsto,
        quantita,
        prezzo_unitario,
        unita_misura,
        fonte,
        cantiere_id,
        preventivo_id
    )
    SELECT
        v_cantiere_nome,
        btrim(e.riga->>'descrizione'),
        round((e.riga->>'importo_previsto')::numeric, 2),
        (e.riga->>'quantita')::numeric,
        (e.riga->>'prezzo_unitario')::numeric,
        btrim(e.riga->>'unita_misura'),
        'documento',
        v_cantiere_id,
        p_preventivo_id
    FROM jsonb_array_elements(p_lavorazioni) AS e(riga);

    SELECT
        count(*),
        COALESCE(round(sum(pl.importo_previsto), 2), 0)
    INTO
        v_numero_finale,
        v_totale_finale
    FROM public.preventivo_lavorazioni AS pl
    WHERE pl.preventivo_id = p_preventivo_id;

    IF v_numero_finale <> v_numero_input
       OR v_totale_finale
          IS DISTINCT FROM round(v_importo_preventivo, 2) THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2057',
            MESSAGE = 'Strutturazione del preventivo non completa';
    END IF;

    preventivo_id := p_preventivo_id;
    cantiere_id := v_cantiere_id;
    numero_lavorazioni := v_numero_finale;
    importo_preventivo := round(v_importo_preventivo, 2);
    totale_lavorazioni := v_totale_finale;
    riutilizzato := false;

    RETURN NEXT;
END;
$function$
;
ALTER FUNCTION public.struttura_preventivo_esistente(uuid,jsonb) OWNER TO "artecna_preventivi_rpc";
CREATE OR REPLACE FUNCTION artecna_rapportini.applica_materiali_contratto_due(p_rapportino uuid, p_ops jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE x jsonb; k text; mid uuid; key text; q numeric; cost numeric;
 old public.rapportino_materiali%rowtype; seen uuid[]:='{}'; keys text[]:='{}'; changed boolean:=false;
BEGIN
 IF jsonb_typeof(p_ops) IS DISTINCT FROM 'object' OR NOT(p_ops ?& ARRAY['nuove','aggiornate','rimosse'])
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_ops) z WHERE z NOT IN ('nuove','aggiornate','rimosse')) THEN
 RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Operazioni materiali non valide'; END IF;
 FOREACH k IN ARRAY ARRAY['nuove','aggiornate','rimosse'] LOOP
 IF jsonb_typeof(p_ops->k) IS DISTINCT FROM 'array' OR jsonb_array_length(p_ops->k)>100 THEN
 RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Array materiali non valido'; END IF; END LOOP;
 UPDATE public.rapportini SET versione_materiali=1 WHERE id=p_rapportino AND versione_prestazioni=1 AND versione_materiali=0;
 changed:=FOUND;
 IF NOT EXISTS(SELECT 1 FROM public.rapportini WHERE id=p_rapportino AND versione_prestazioni=1 AND versione_materiali=1) THEN
 RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Padre materiali non valido'; END IF;
 FOREACH k IN ARRAY ARRAY['nuove','aggiornate'] LOOP
 FOR x IN SELECT value FROM jsonb_array_elements(p_ops->k) LOOP
 IF jsonb_typeof(x) IS DISTINCT FROM 'object' OR NOT(x ?& ARRAY['materiale_id','chiave_client','descrizione','unita_misura','quantita','costo_unitario','note'])
 OR EXISTS(SELECT 1 FROM jsonb_object_keys(x) z WHERE z NOT IN ('materiale_id','chiave_client','descrizione','unita_misura','quantita','costo_unitario','note'))
 OR jsonb_typeof(x->'chiave_client') IS DISTINCT FROM 'string'
 OR jsonb_typeof(x->'descrizione') IS DISTINCT FROM 'string' OR x->>'descrizione'<>btrim(x->>'descrizione') OR length(x->>'descrizione') NOT BETWEEN 1 AND 2000
 OR jsonb_typeof(x->'unita_misura') IS DISTINCT FROM 'string' OR x->>'unita_misura'<>btrim(x->>'unita_misura') OR length(x->>'unita_misura') NOT BETWEEN 1 AND 50
 OR jsonb_typeof(x->'note') IS DISTINCT FROM 'string' OR length(x->>'note')>20000
 OR jsonb_typeof(x->'quantita') IS DISTINCT FROM 'string' OR coalesce(x->>'quantita','') !~ '^(0|[1-9][0-9]{0,11})[.][0-9]{6}$'
 OR (x->'costo_unitario' IS DISTINCT FROM 'null'::jsonb AND (jsonb_typeof(x->'costo_unitario') IS DISTINCT FROM 'string'
 OR coalesce(x->>'costo_unitario','') !~ '^(0|[1-9][0-9]{0,11})[.][0-9]{6}$')) THEN
 RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Materiale o decimale non valido'; END IF;
 key:=x->>'chiave_client';
 BEGIN
 IF key COLLATE "C" IS DISTINCT FROM (key::uuid)::text COLLATE "C" THEN
 RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Chiave materiale non canonica'; END IF;
 EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Chiave materiale non valida'; END;
 IF key=ANY(keys) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Chiave materiale ripetuta'; END IF;
 keys:=array_append(keys,key);
 -- Solo dopo formato/range, nessun cast typmod usato per arrotondare input.
 q:=(x->>'quantita')::numeric; cost:=(x->>'costo_unitario')::numeric;
 IF q<=0 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Quantità materiale non positiva'; END IF;
 IF k='nuove' THEN
 IF x->'materiale_id' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Identità nuova assegnata dal server'; END IF;
 SELECT * INTO old FROM public.rapportino_materiali WHERE rapportino_id=p_rapportino AND chiave_client=key FOR UPDATE;
 IF FOUND THEN
 IF old.rimossa_at IS NOT NULL OR old.descrizione IS DISTINCT FROM x->>'descrizione' OR old.unita_misura IS DISTINCT FROM x->>'unita_misura'
 OR old.quantita IS DISTINCT FROM q OR old.costo_unitario IS DISTINCT FROM cost OR old.note IS DISTINCT FROM x->>'note' THEN
 RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Chiave materiale già utilizzata'; END IF;
 ELSE
 INSERT INTO public.rapportino_materiali(rapportino_id,chiave_client,descrizione,unita_misura,quantita,costo_unitario,note)
 VALUES(p_rapportino,key,x->>'descrizione',x->>'unita_misura',q,cost,x->>'note'); changed:=true;
 END IF;
 ELSE
 IF jsonb_typeof(x->'materiale_id') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Identità materiale obbligatoria'; END IF;
 BEGIN mid:=(x->>'materiale_id')::uuid; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Identità materiale non valida'; END;
 IF mid IS NULL OR mid=ANY(seen) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Identità materiale ripetuta'; END IF;
 seen:=array_append(seen,mid);
 SELECT * INTO old FROM public.rapportino_materiali WHERE id=mid AND rapportino_id=p_rapportino FOR UPDATE;
 IF NOT FOUND OR old.rimossa_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Materiale assente/rimosso/fuori Rapportino'; END IF;
 IF old.chiave_client IS DISTINCT FROM key THEN RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Identità materiale immutabile'; END IF;
 IF old.descrizione IS DISTINCT FROM x->>'descrizione' OR old.unita_misura IS DISTINCT FROM x->>'unita_misura'
 OR old.quantita IS DISTINCT FROM q OR old.costo_unitario IS DISTINCT FROM cost OR old.note IS DISTINCT FROM x->>'note' THEN
 UPDATE public.rapportino_materiali SET descrizione=x->>'descrizione',unita_misura=x->>'unita_misura',quantita=q,costo_unitario=cost,note=x->>'note' WHERE id=mid;
 changed:=true; END IF;
 END IF;
 END LOOP; END LOOP;
 FOR x IN SELECT value FROM jsonb_array_elements(p_ops->'rimosse') LOOP
 IF jsonb_typeof(x) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Rimozione materiale per UUID'; END IF;
 BEGIN mid:=(x#>>'{}')::uuid; EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Identità materiale non valida'; END;
 IF mid=ANY(seen) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Operazione materiale ripetuta'; END IF;
 seen:=array_append(seen,mid);
 UPDATE public.rapportino_materiali SET rimossa_at=statement_timestamp() WHERE id=mid AND rapportino_id=p_rapportino AND rimossa_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Materiale da rimuovere assente'; END IF;
 changed:=true;
 END LOOP;
 RETURN changed;
END;
$function$
;
ALTER FUNCTION artecna_rapportini.applica_materiali_contratto_due(uuid,jsonb) OWNER TO "artecna_rapportini_rpc";
CREATE OR REPLACE FUNCTION artecna_guardie.calcola_residuo_componente(p_tipo text, p_componente_id bigint, p_cantiere_id uuid, p_preventivo_contrattuale_id uuid)
 RETURNS TABLE(tipo_componente text, componente_id bigint, cantiere_id uuid, preventivo_contrattuale_id uuid, descrizione text, unita_misura text, prezzo_unitario numeric, quantita_originaria numeric, importo_originario numeric, quantita_ridotta_approvata numeric, importo_ridotto_approvato numeric, quantita_contrattuale numeric, importo_contrattuale numeric, sal_presente boolean, sal_id bigint, percentuale numeric, maturato_verificabile boolean, quantita_maturata numeric, importo_maturato numeric, quantita_riducibile numeric, importo_riducibile numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
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
$function$
;
ALTER FUNCTION artecna_guardie.calcola_residuo_componente(text,bigint,uuid,uuid) OWNER TO "artecna_sal_rpc";
CREATE OR REPLACE FUNCTION public.importa_variante_approvata_nel_sal(p_variante_id uuid)
 RETURNS TABLE(variante_id uuid, cantiere_id uuid, righe_variante bigint, importate bigint, gia_presenti bigint, totale_importato numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
 v_user uuid; v_var public.varianti_cantiere%ROWTYPE; v_can public.cantieri%ROWTYPE;
 v_tot bigint; v_imp bigint; v_totimp numeric(18,2);
BEGIN
 IF current_user <> 'artecna_sal_rpc' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Contesto interno RPC SAL non valido'; END IF;
 BEGIN v_user:=artecna_guardie.utente_jwt_corrente();
 EXCEPTION WHEN invalid_text_representation THEN RAISE EXCEPTION USING ERRCODE='P2070',MESSAGE='Identità utente non valida'; END;
 IF v_user IS NULL OR p_variante_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P2070',MESSAGE='Identità utente e variante obbligatorie'; END IF;

 SELECT v.* INTO v_var FROM public.varianti_cantiere v WHERE v.id=p_variante_id;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2071',MESSAGE='Variante non disponibile'; END IF;
 SELECT c.* INTO v_can FROM public.cantieri c WHERE c.id=v_var.cantiere_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P2071',MESSAGE='Cantiere non disponibile'; END IF;
 IF artecna_guardie.utente_puo_modificare_cantiere(v_user,v_can.id) IS DISTINCT FROM TRUE THEN
  RAISE EXCEPTION USING ERRCODE='P2071',MESSAGE='Utente non autorizzato'; END IF;
 SELECT v.* INTO v_var FROM public.varianti_cantiere v WHERE v.id=p_variante_id;
 IF NOT FOUND OR v_var.cantiere_id IS DISTINCT FROM v_can.id THEN RAISE EXCEPTION USING ERRCODE='P2071',MESSAGE='Variante incoerente'; END IF;
 IF v_var.stato IS DISTINCT FROM 'approvata' OR v_var.numero IS NULL OR v_var.importo_delta_approvato IS NULL
 OR v_var.approvata_at IS NULL OR v_var.riferimento_approvazione IS NULL OR btrim(v_var.riferimento_approvazione)='' THEN
  RAISE EXCEPTION USING ERRCODE='P2072',MESSAGE='È importabile solo una variante approvata'; END IF;
 IF v_can.preventivo_contrattuale_id IS NULL OR v_var.preventivo_contrattuale_id IS DISTINCT FROM v_can.preventivo_contrattuale_id THEN
  RAISE EXCEPTION USING ERRCODE='P2073',MESSAGE='Contratto di riferimento non valido'; END IF;

 SELECT count(*) INTO v_tot FROM public.variante_lavorazioni l WHERE l.variante_id=v_var.id AND l.operazione IN ('nuova','aumento');
 IF NOT EXISTS (SELECT 1 FROM public.variante_lavorazioni l WHERE l.variante_id=v_var.id) THEN RAISE EXCEPTION USING ERRCODE='P2074',MESSAGE='Variante senza lavorazioni'; END IF;
 IF v_tot=0 THEN
  variante_id:=v_var.id; cantiere_id:=v_can.id; righe_variante:=0; importate:=0; gia_presenti:=0; totale_importato:=0; RETURN NEXT; RETURN;
 END IF;

 BEGIN
  WITH nuove AS (
   SELECT l.* FROM public.variante_lavorazioni l WHERE l.variante_id=v_var.id AND l.operazione IN ('nuova','aumento')
   AND NOT EXISTS (SELECT 1 FROM public.sal_lavorazioni s WHERE s.source_variante_lavorazione_id=l.id)
  ), ins AS (
   INSERT INTO public.sal_lavorazioni(cantiere_id,cantiere,source_variante_lavorazione_id,descrizione,importo_previsto,percentuale,importo_maturato,completata,note,data_aggiornamento)
   SELECT v_can.id,v_can.nome,n.id,n.descrizione,n.delta_contratto,0,0,false,format('Importata da Variante n. %s',v_var.numero),CURRENT_DATE
   FROM nuove n RETURNING importo_previsto
  )
  SELECT count(*),COALESCE(round(sum(importo_previsto),2),0) INTO v_imp,v_totimp FROM ins;
 EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION USING ERRCODE='P2076',MESSAGE='Conflitto concorrente durante importazione SAL: riprovare';
 END;

 IF (SELECT count(*) FROM public.variante_lavorazioni l JOIN public.sal_lavorazioni s ON s.source_variante_lavorazione_id=l.id
     WHERE l.variante_id=v_var.id AND l.operazione IN ('nuova','aumento') AND s.cantiere_id=v_can.id) <> v_tot THEN
  RAISE EXCEPTION USING ERRCODE='P2075',MESSAGE='Importazione SAL Variante non completa'; END IF;

 variante_id:=v_var.id; cantiere_id:=v_can.id; righe_variante:=v_tot; importate:=v_imp;
 gia_presenti:=v_tot-v_imp; totale_importato:=v_totimp; RETURN NEXT;
EXCEPTION WHEN serialization_failure OR deadlock_detected THEN
 RAISE EXCEPTION USING ERRCODE='P2076',MESSAGE='Conflitto concorrente durante importazione SAL: riprovare';
END;$function$
;
ALTER FUNCTION public.importa_variante_approvata_nel_sal(uuid) OWNER TO "artecna_sal_rpc";
CREATE OR REPLACE FUNCTION public.aggiorna_avanzamento_sal(p_sal_id bigint, p_percentuale numeric, p_completata boolean)
 RETURNS TABLE(id bigint, classificazione text, cantiere_id uuid, contratto_id uuid, percentuale numeric, completata boolean, importo_maturato numeric, data_aggiornamento date, quantita_maturata numeric, quantita_contrattuale numeric, importo_contrattuale numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
    v_user_id uuid;
    v_pre record;
    v_sal record;
    v_c record;
    v_p record;
    v_s record;
    v_classe text;
    v_contratto uuid;
    v_percentuale numeric;
    v_completata boolean;
    v_q_orig numeric;
    v_i_orig numeric;
    v_prezzo numeric;
    v_um text;
    v_rq numeric;
    v_ri numeric;
    v_riduzioni_valide boolean;
    v_q_contr numeric;
    v_i_contr numeric;
    v_q_mat numeric;
    v_i_mat numeric;
BEGIN
    v_user_id := artecna_guardie.utente_jwt_corrente();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE='P2040',
            MESSAGE='Identità utente assente: aggiornamento SAL non autorizzato';
    END IF;

    IF current_user <> 'artecna_sal_rpc' THEN
        RAISE EXCEPTION USING ERRCODE='42501',
            MESSAGE='Owner RPC SAL non corretto';
    END IF;

    IF current_setting('transaction_isolation') <> 'read committed' THEN
        RAISE EXCEPTION USING ERRCODE='P2039',
            MESSAGE='La RPC SAL richiede una transazione READ COMMITTED';
    END IF;

    IF p_sal_id IS NULL
       OR ((p_percentuale IS NULL) = (p_completata IS NULL)) THEN
        RAISE EXCEPTION USING ERRCODE='P2031',
            MESSAGE='Specificare ID SAL e una sola modalità';
    END IF;

    SELECT s.id,s.cantiere_id,
           s.source_lavorazione_id,s.source_variante_lavorazione_id
    INTO v_pre
    FROM public.sal_lavorazioni s
    WHERE s.id=p_sal_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE='P2030',
            MESSAGE='Riga SAL inesistente';
    END IF;

    IF v_pre.source_lavorazione_id IS NOT NULL
       AND v_pre.source_variante_lavorazione_id IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE='P2038',
            MESSAGE='Riga SAL con doppia sorgente';
    END IF;

    IF v_pre.source_lavorazione_id IS NOT NULL THEN
        v_classe := 'STRUTTURATA_BASE';
    ELSIF v_pre.source_variante_lavorazione_id IS NOT NULL THEN
        v_classe := 'STRUTTURATA_VARIANTE';
    ELSIF v_pre.cantiere_id IS NULL THEN
        v_classe := 'LEGACY_SENZA_UUID';
    ELSE
        v_classe := 'LEGACY';
    END IF;

    IF v_classe IN ('STRUTTURATA_BASE','STRUTTURATA_VARIANTE')
       AND v_pre.cantiere_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE='P2033',
            MESSAGE='Riga strutturata senza UUID cantiere';
    END IF;

    IF v_classe='LEGACY_SENZA_UUID' THEN
        RAISE EXCEPTION USING ERRCODE='P2040',
            MESSAGE='Riga SAL senza UUID cantiere: aggiornamento non autorizzato';
    END IF;

    IF v_pre.cantiere_id IS NOT NULL
       AND artecna_guardie.utente_puo_modificare_cantiere(
           v_user_id, v_pre.cantiere_id
       ) IS DISTINCT FROM true THEN
        RAISE EXCEPTION USING ERRCODE='P2040',
            MESSAGE='Utente non autorizzato a modificare il cantiere';
    END IF;

    IF v_pre.cantiere_id IS NOT NULL THEN
        SELECT c.id,c.preventivo_contrattuale_id
        INTO v_c
        FROM public.cantieri c
        WHERE c.id=v_pre.cantiere_id
        FOR NO KEY UPDATE OF c;

        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE='P2033',
                MESSAGE='Cantiere non disponibile';
        END IF;
    END IF;

    IF v_classe IN ('STRUTTURATA_BASE','STRUTTURATA_VARIANTE') THEN
        v_contratto := v_c.preventivo_contrattuale_id;
        IF v_contratto IS NULL THEN
            RAISE EXCEPTION USING ERRCODE='P2033',
                MESSAGE='Preventivo contrattuale non impostato';
        END IF;
    END IF;

    IF v_classe='STRUTTURATA_BASE' THEN
        SELECT p.id,p.cantiere_id
        INTO v_p
        FROM public.preventivi_cantiere p
        WHERE p.id=v_contratto
        FOR SHARE OF p;

        IF NOT FOUND OR v_p.cantiere_id IS DISTINCT FROM v_pre.cantiere_id THEN
            RAISE EXCEPTION USING ERRCODE='P2033',
                MESSAGE='Preventivo contrattuale incoerente';
        END IF;

        SELECT b.id,b.cantiere_id,b.preventivo_id,
               b.quantita,b.prezzo_unitario,b.importo_previsto,b.unita_misura
        INTO v_s
        FROM public.preventivo_lavorazioni b
        WHERE b.id=v_pre.source_lavorazione_id
        FOR SHARE OF b;

        IF NOT FOUND
           OR v_s.cantiere_id IS DISTINCT FROM v_pre.cantiere_id
           OR v_s.preventivo_id IS DISTINCT FROM v_contratto THEN
            RAISE EXCEPTION USING ERRCODE='P2033',
                MESSAGE='Sorgente base estranea al contratto corrente';
        END IF;

        v_q_orig := v_s.quantita;
        v_i_orig := v_s.importo_previsto;
        v_prezzo := v_s.prezzo_unitario;
        v_um := v_s.unita_misura;

    ELSIF v_classe='STRUTTURATA_VARIANTE' THEN
        -- Testata e riga approvate sono immutabili tramite 2A.
        SELECT l.id,l.variante_id,l.operazione,
               l.quantita_delta,l.prezzo_unitario,l.delta_contratto,
               l.unita_misura,
               v.cantiere_id,v.preventivo_contrattuale_id,v.stato
        INTO v_s
        FROM public.variante_lavorazioni l
        JOIN public.varianti_cantiere v ON v.id=l.variante_id
        WHERE l.id=v_pre.source_variante_lavorazione_id;

        IF NOT FOUND
           OR v_s.stato IS DISTINCT FROM 'approvata'
           OR v_s.operazione NOT IN ('nuova','aumento')
           OR v_s.cantiere_id IS DISTINCT FROM v_pre.cantiere_id
           OR v_s.preventivo_contrattuale_id IS DISTINCT FROM v_contratto THEN
            RAISE EXCEPTION USING ERRCODE='P2035',
                MESSAGE='Sorgente Variante non valida';
        END IF;

        v_q_orig := v_s.quantita_delta;
        v_i_orig := v_s.delta_contratto;
        v_prezzo := v_s.prezzo_unitario;
        v_um := v_s.unita_misura;
    END IF;

    SELECT s.id,s.cantiere_id,
           s.source_lavorazione_id,s.source_variante_lavorazione_id,
           s.importo_previsto,s.percentuale,s.importo_maturato,
           s.completata,s.data_aggiornamento
    INTO v_sal
    FROM public.sal_lavorazioni s
    WHERE s.id=p_sal_id
    FOR NO KEY UPDATE OF s;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE='P2030',
            MESSAGE='Riga SAL non più disponibile';
    END IF;

    IF v_sal.cantiere_id IS DISTINCT FROM v_pre.cantiere_id
       OR v_sal.source_lavorazione_id
          IS DISTINCT FROM v_pre.source_lavorazione_id
       OR v_sal.source_variante_lavorazione_id
          IS DISTINCT FROM v_pre.source_variante_lavorazione_id THEN
        RAISE EXCEPTION USING ERRCODE='P2032',
            MESSAGE='Contesto SAL cambiato: ripetere la richiesta';
    END IF;

    IF artecna_guardie.utente_puo_modificare_cantiere(
        v_user_id, v_sal.cantiere_id
    ) IS DISTINCT FROM true THEN
        RAISE EXCEPTION USING ERRCODE='P2040',
            MESSAGE='Autorizzazione cantiere non più valida';
    END IF;

    IF p_percentuale IS NOT NULL THEN
        v_percentuale := p_percentuale;
        v_completata := v_sal.completata;
    ELSIF p_completata THEN
        IF v_classe IN ('STRUTTURATA_BASE', 'STRUTTURATA_VARIANTE') THEN
            v_percentuale := 100;
        ELSE
            v_percentuale := coalesce(v_sal.percentuale,0);
        END IF;
        v_completata := true;
    ELSE
        v_percentuale := 0;
        v_completata := false;
    END IF;

    IF v_percentuale::text IN ('NaN','Infinity','-Infinity')
       OR v_percentuale < 0 OR v_percentuale > 100 THEN
        RAISE EXCEPTION USING ERRCODE='P2036',
            MESSAGE='Percentuale non finita o fuori intervallo 0–100';
    END IF;

    IF v_classe IN ('STRUTTURATA_BASE','STRUTTURATA_VARIANTE') THEN
        IF v_q_orig IS NULL OR v_q_orig <= 0
           OR v_q_orig::text IN ('NaN','Infinity','-Infinity')
           OR v_i_orig IS NULL OR v_i_orig < 0
           OR v_i_orig::text IN ('NaN','Infinity','-Infinity')
           OR v_prezzo IS NULL OR v_prezzo < 0
           OR v_prezzo::text IN ('NaN','Infinity','-Infinity')
           OR v_um IS NULL OR v_um !~ '[^[:space:]]'
           OR (
               v_classe='STRUTTURATA_VARIANTE'
               AND v_i_orig <= 0
           ) THEN
            RAISE EXCEPTION USING
                ERRCODE=CASE
                    WHEN v_classe='STRUTTURATA_VARIANTE'
                    THEN 'P2035' ELSE 'P2033'
                END,
                MESSAGE='Valori canonici della sorgente non validi';
        END IF;

        IF v_sal.importo_previsto IS DISTINCT FROM v_i_orig THEN
            RAISE EXCEPTION USING ERRCODE='P2034',
                MESSAGE='Importo SAL diverso dall’importo originario della sorgente';
        END IF;

        SELECT
            coalesce(sum(l.quantita_delta),0),
            coalesce(sum(l.delta_contratto),0),
            coalesce(bool_and(
                l.quantita_delta IS NOT NULL
                AND l.delta_contratto IS NOT NULL
                AND l.quantita_delta < 0
                AND l.delta_contratto < 0
                AND l.quantita_delta::text
                    NOT IN ('NaN','Infinity','-Infinity')
                AND l.delta_contratto::text
                    NOT IN ('NaN','Infinity','-Infinity')
            ),true)
        INTO v_rq,v_ri,v_riduzioni_valide
        FROM public.variante_lavorazioni l
        JOIN public.varianti_cantiere v ON v.id=l.variante_id
        WHERE v.stato='approvata'
          AND v.cantiere_id=v_pre.cantiere_id
          AND v.preventivo_contrattuale_id=v_contratto
          AND l.operazione IN ('riduzione_residua','eliminazione_residua')
          AND (
              (
                  v_classe='STRUTTURATA_BASE'
                  AND l.riferimento_preventivo_lavorazione_id=
                      v_pre.source_lavorazione_id
              )
              OR
              (
                  v_classe='STRUTTURATA_VARIANTE'
                  AND l.riferimento_variante_lavorazione_id=
                      v_pre.source_variante_lavorazione_id
              )
          );

        v_q_contr := v_q_orig + v_rq;
        v_i_contr := v_i_orig + v_ri;
        v_q_mat := round(v_q_orig*v_percentuale/100,6);
        v_i_mat := round(v_i_orig*v_percentuale/100,2);

        IF NOT v_riduzioni_valide
           OR v_q_contr::text IN ('NaN','Infinity','-Infinity')
           OR v_i_contr::text IN ('NaN','Infinity','-Infinity')
           OR v_q_contr < 0 OR v_i_contr < 0
           OR v_q_mat > v_q_contr OR v_i_mat > v_i_contr THEN
            RAISE EXCEPTION USING ERRCODE='P2037',
                MESSAGE='Residuo contrattuale insufficiente o incoerente';
        END IF;
    ELSE
        IF v_sal.importo_previsto IS NULL
           OR v_sal.importo_previsto::text
              IN ('NaN','Infinity','-Infinity') THEN
            RAISE EXCEPTION USING ERRCODE='P2034',
                MESSAGE='Riferimento economico legacy non valido';
        END IF;

        v_i_mat := v_sal.importo_previsto*v_percentuale/100;
        -- Contratto e quantità restano NULL nel ramo legacy.
    END IF;

    RETURN QUERY
    UPDATE public.sal_lavorazioni AS s
    SET percentuale=v_percentuale,
        importo_maturato=v_i_mat,
        completata=v_completata,
        data_aggiornamento=CURRENT_DATE
    WHERE s.id=p_sal_id
    RETURNING
        s.id,v_classe,s.cantiere_id,v_contratto,
        s.percentuale,s.completata,s.importo_maturato,
        s.data_aggiornamento,v_q_mat,v_q_contr,v_i_contr;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE='P2039',
            MESSAGE='Aggiornamento SAL non eseguito';
    END IF;

EXCEPTION
    WHEN serialization_failure OR deadlock_detected THEN
        RAISE EXCEPTION USING ERRCODE='P2039',
            MESSAGE='Conflitto concorrente: ripetere la transazione';
    WHEN numeric_value_out_of_range THEN
        RAISE EXCEPTION USING ERRCODE='P2037',
            MESSAGE='Valori economici o quantitativi non rappresentabili';
END;
$function$
;
ALTER FUNCTION public.aggiorna_avanzamento_sal(bigint,numeric,boolean) OWNER TO "artecna_sal_rpc";
CREATE OR REPLACE FUNCTION public.proponi_variante(p_variante_id uuid)
 RETURNS TABLE(id uuid, cantiere_id uuid, preventivo_contrattuale_id uuid, numero integer, stato text, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
    v_cantiere_id uuid;
    v_cantiere public.cantieri%ROWTYPE;
    v_variante public.varianti_cantiere%ROWTYPE;
    v_riga public.variante_lavorazioni%ROWTYPE;
    v_numero_righe bigint;
    v_numeri_distinti bigint;
    v_prossimo_numero bigint;
BEGIN
    IF current_user <> 'artecna_varianti_rpc' THEN
        RAISE EXCEPTION USING
            ERRCODE = '42501',
            MESSAGE = 'Owner della RPC Variante non corretto';
    END IF;

    SELECT v.cantiere_id
    INTO v_cantiere_id
    FROM public.varianti_cantiere v
    WHERE v.id = p_variante_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2010',
            MESSAGE = 'Variante inesistente';
    END IF;

    SELECT c.*
    INTO v_cantiere
    FROM public.cantieri c
    WHERE c.id = v_cantiere_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2012',
            MESSAGE = 'Cantiere della variante non disponibile';
    END IF;

    SELECT v.*
    INTO v_variante
    FROM public.varianti_cantiere v
    WHERE v.id = p_variante_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2010',
            MESSAGE = 'Variante non più disponibile';
    END IF;

    IF v_variante.cantiere_id IS DISTINCT FROM v_cantiere.id THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2012',
            MESSAGE = 'Cantiere della variante incoerente';
    END IF;

    IF v_variante.stato IS DISTINCT FROM 'bozza' THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2011',
            MESSAGE = 'È proponibile soltanto una variante in bozza';
    END IF;

    IF v_cantiere.preventivo_contrattuale_id IS NULL
       OR v_variante.preventivo_contrattuale_id
          IS DISTINCT FROM v_cantiere.preventivo_contrattuale_id THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2012',
            MESSAGE =
                'Il preventivo contrattuale è cambiato o non è impostato';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.preventivi_cantiere p
        WHERE p.id = v_variante.preventivo_contrattuale_id
          AND p.cantiere_id = v_cantiere.id
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2012',
            MESSAGE =
                'Il preventivo contrattuale non appartiene al cantiere';
    END IF;

    SELECT count(*), count(DISTINCT l.numero_riga)
    INTO v_numero_righe, v_numeri_distinti
    FROM public.variante_lavorazioni l
    WHERE l.variante_id = v_variante.id;

    IF v_numero_righe = 0 THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2013',
            MESSAGE = 'La variante non contiene lavorazioni';
    END IF;

    IF v_numero_righe <> v_numeri_distinti THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2014',
            MESSAGE = 'Numeri riga mancanti o duplicati';
    END IF;

    FOR v_riga IN
        SELECT l.*
        FROM public.variante_lavorazioni l
        WHERE l.variante_id = v_variante.id
        ORDER BY l.numero_riga, l.id
    LOOP
        IF v_riga.numero_riga IS NULL
           OR v_riga.numero_riga <= 0
           OR v_riga.descrizione IS NULL
           OR v_riga.descrizione !~ '[^[:space:]]'
           OR v_riga.operazione IS NULL
           OR v_riga.operazione NOT IN (
               'nuova', 'aumento',
               'riduzione_residua', 'eliminazione_residua'
           )
           OR v_riga.quantita_delta IS NULL
           OR v_riga.prezzo_unitario IS NULL
           OR v_riga.delta_contratto IS NULL
           OR v_riga.quantita_delta::text IN (
               'NaN', 'Infinity', '-Infinity'
           )
           OR v_riga.prezzo_unitario::text IN (
               'NaN', 'Infinity', '-Infinity'
           )
           OR v_riga.delta_contratto::text IN (
               'NaN', 'Infinity', '-Infinity'
           )
           OR v_riga.prezzo_unitario < 0 THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P2014',
                MESSAGE = format(
                    'Dati non validi nella lavorazione %s', v_riga.id
                );
        END IF;

        IF (
            v_riga.operazione IN ('nuova', 'aumento')
            AND (
                v_riga.quantita_delta <= 0
                OR v_riga.delta_contratto <= 0
            )
        ) OR (
            v_riga.operazione IN (
                'riduzione_residua', 'eliminazione_residua'
            )
            AND (
                v_riga.quantita_delta >= 0
                OR v_riga.delta_contratto >= 0
            )
        ) THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P2014',
                MESSAGE = format(
                    'Segno quantità/delta non valido nella lavorazione %s',
                    v_riga.id
                );
        END IF;

        IF (
            v_riga.operazione = 'nuova'
            AND num_nonnulls(
                v_riga.riferimento_preventivo_lavorazione_id,
                v_riga.riferimento_variante_lavorazione_id
            ) <> 0
        ) OR (
            v_riga.operazione <> 'nuova'
            AND num_nonnulls(
                v_riga.riferimento_preventivo_lavorazione_id,
                v_riga.riferimento_variante_lavorazione_id
            ) <> 1
        ) THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P2014',
                MESSAGE = format(
                    'Riferimenti incompatibili con l’operazione della riga %s',
                    v_riga.id
                );
        END IF;

        IF v_riga.operazione IN (
            'riduzione_residua', 'eliminazione_residua'
        ) AND (
            v_riga.note IS NULL
            OR v_riga.note !~ '[^[:space:]]'
        ) THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P2014',
                MESSAGE = format(
                    'Motivazione obbligatoria nella lavorazione %s',
                    v_riga.id
                );
        END IF;

        IF v_riga.riferimento_preventivo_lavorazione_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1
                FROM public.preventivo_lavorazioni b
                WHERE b.id =
                      v_riga.riferimento_preventivo_lavorazione_id
                  AND b.preventivo_id =
                      v_variante.preventivo_contrattuale_id
                  AND b.cantiere_id = v_cantiere.id
            ) THEN
                RAISE EXCEPTION USING
                    ERRCODE = 'P2015',
                    MESSAGE = format(
                        'Riferimento alla base non valido nella riga %s',
                        v_riga.id
                    );
            END IF;
        END IF;

        IF v_riga.riferimento_variante_lavorazione_id IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1
                FROM public.variante_lavorazioni s
                JOIN public.varianti_cantiere sv
                  ON sv.id = s.variante_id
                WHERE s.id =
                      v_riga.riferimento_variante_lavorazione_id
                  AND sv.id <> v_variante.id
                  AND sv.cantiere_id = v_cantiere.id
                  AND sv.preventivo_contrattuale_id =
                      v_variante.preventivo_contrattuale_id
                  AND sv.stato = 'approvata'
                  AND s.operazione IN ('nuova', 'aumento')
                  AND s.quantita_delta > 0
                  AND s.delta_contratto > 0
                  AND s.quantita_delta::text NOT IN (
                      'NaN', 'Infinity', '-Infinity'
                  )
                  AND s.delta_contratto::text NOT IN (
                      'NaN', 'Infinity', '-Infinity'
                  )
            ) THEN
                RAISE EXCEPTION USING
                    ERRCODE = 'P2016',
                    MESSAGE = format(
                        'Sorgente Variante non valida nella riga %s',
                        v_riga.id
                    );
            END IF;
        END IF;
    END LOOP;

    SELECT coalesce(max(v.numero)::bigint, 0) + 1
    INTO v_prossimo_numero
    FROM public.varianti_cantiere v
    WHERE v.cantiere_id = v_cantiere.id
      AND v.numero IS NOT NULL;

    IF v_prossimo_numero < 1
       OR v_prossimo_numero > 2147483647 THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2017',
            MESSAGE = 'Numerazione Variante esaurita o non valida';
    END IF;

    BEGIN
        RETURN QUERY
        UPDATE public.varianti_cantiere AS v
        SET stato = 'proposta',
            numero = v_prossimo_numero::integer,
            updated_at = now()
        WHERE v.id = v_variante.id
          AND v.stato = 'bozza'
        RETURNING
            v.id,
            v.cantiere_id,
            v.preventivo_contrattuale_id,
            v.numero,
            v.stato,
            v.updated_at;

        IF NOT FOUND THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P2017',
                MESSAGE = 'La variante non è stata aggiornata';
        END IF;
    EXCEPTION
        WHEN unique_violation THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P2017',
                MESSAGE =
                    'Conflitto di numerazione Variante: ripetere la transazione';
    END;

EXCEPTION
    WHEN serialization_failure OR deadlock_detected THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2017',
            MESSAGE =
                'Conflitto concorrente: ripetere l’intera transazione';
END;
$function$
;
ALTER FUNCTION public.proponi_variante(uuid) OWNER TO "artecna_varianti_rpc";
CREATE OR REPLACE FUNCTION public.crea_bozza_variante(p_cantiere_id uuid, p_titolo text, p_descrizione text DEFAULT NULL::text, p_data_variante date DEFAULT NULL::date)
 RETURNS TABLE(id uuid, cantiere_id uuid, preventivo_contrattuale_id uuid, numero integer, titolo text, descrizione text, stato text, data_variante date, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
    v_user_id uuid;
    v_contratto_id uuid;
    v_new public.varianti_cantiere%ROWTYPE;
    v_count bigint;
BEGIN
    IF current_user <> 'artecna_varianti_rpc' THEN
        RAISE EXCEPTION USING ERRCODE = 'P2021',
            MESSAGE = 'Contesto di esecuzione non autorizzato';
    END IF;
    v_user_id := artecna_guardie.utente_jwt_corrente();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P2020',
            MESSAGE = 'Identità utente assente';
    END IF;
    IF p_cantiere_id IS NULL OR p_titolo IS NULL
       OR pg_catalog.btrim(p_titolo) = '' THEN
        RAISE EXCEPTION USING ERRCODE = 'P2020',
            MESSAGE = 'Cantiere e titolo non vuoto sono obbligatori';
    END IF;
    IF artecna_guardie.utente_puo_modificare_cantiere(
        v_user_id, p_cantiere_id
    ) IS NOT TRUE THEN
        RAISE EXCEPTION USING ERRCODE = 'P2021',
            MESSAGE = 'Utente non autorizzato a modificare il cantiere';
    END IF;
    SELECT c.preventivo_contrattuale_id INTO v_contratto_id
    FROM public.cantieri c WHERE c.id = p_cantiere_id FOR UPDATE OF c;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P2022',
            MESSAGE = 'Cantiere non disponibile';
    END IF;
    IF artecna_guardie.utente_puo_modificare_cantiere(
        v_user_id, p_cantiere_id
    ) IS NOT TRUE THEN
        RAISE EXCEPTION USING ERRCODE = 'P2021',
            MESSAGE = 'Autorizzazione sul cantiere non più valida';
    END IF;
    IF v_contratto_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P2022',
            MESSAGE = 'Preventivo contrattuale non impostato';
    END IF;
    PERFORM 1 FROM public.preventivi_cantiere p
    WHERE p.id = v_contratto_id AND p.cantiere_id = p_cantiere_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P2022',
            MESSAGE = 'Preventivo contrattuale assente o incoerente';
    END IF;

    IF p_descrizione IS NULL AND p_data_variante IS NULL THEN
        INSERT INTO public.varianti_cantiere AS v
            (cantiere_id, preventivo_contrattuale_id, titolo)
        VALUES (p_cantiere_id, v_contratto_id, pg_catalog.btrim(p_titolo))
        RETURNING v.* INTO v_new;
    ELSIF p_data_variante IS NULL THEN
        INSERT INTO public.varianti_cantiere AS v
            (cantiere_id, preventivo_contrattuale_id, titolo, descrizione)
        VALUES (p_cantiere_id, v_contratto_id, pg_catalog.btrim(p_titolo),
                p_descrizione)
        RETURNING v.* INTO v_new;
    ELSIF p_descrizione IS NULL THEN
        INSERT INTO public.varianti_cantiere AS v
            (cantiere_id, preventivo_contrattuale_id, titolo, data_variante)
        VALUES (p_cantiere_id, v_contratto_id, pg_catalog.btrim(p_titolo),
                p_data_variante)
        RETURNING v.* INTO v_new;
    ELSE
        INSERT INTO public.varianti_cantiere AS v
            (cantiere_id, preventivo_contrattuale_id, titolo, descrizione, data_variante)
        VALUES (p_cantiere_id, v_contratto_id, pg_catalog.btrim(p_titolo),
                p_descrizione, p_data_variante)
        RETURNING v.* INTO v_new;
    END IF;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 OR v_new.id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P2023',
            MESSAGE = 'Creazione della bozza non eseguita';
    END IF;
    IF v_new.cantiere_id IS DISTINCT FROM p_cantiere_id
       OR v_new.preventivo_contrattuale_id IS DISTINCT FROM v_contratto_id
       OR v_new.stato IS DISTINCT FROM 'bozza'
       OR v_new.numero IS NOT NULL
       OR v_new.importo_delta_approvato IS NOT NULL
       OR v_new.approvata_at IS NOT NULL
       OR v_new.riferimento_approvazione IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P2023',
            MESSAGE = 'La testata creata non rispetta gli invarianti della bozza';
    END IF;
    RETURN QUERY SELECT
        v_new.id, v_new.cantiere_id, v_new.preventivo_contrattuale_id,
        v_new.numero, v_new.titolo, v_new.descrizione, v_new.stato,
        v_new.data_variante, v_new.created_at, v_new.updated_at;
END;
$function$
;
ALTER FUNCTION public.crea_bozza_variante(uuid,text,text,date) OWNER TO "artecna_varianti_rpc";
CREATE OR REPLACE FUNCTION public.leggi_varianti_cantiere(p_cantiere_id uuid)
 RETURNS TABLE(id uuid, cantiere_id uuid, preventivo_contrattuale_id uuid, numero integer, titolo text, descrizione text, stato text, data_variante date, importo_delta_approvato numeric, approvata_at timestamp with time zone, riferimento_approvazione text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  IF current_user <> 'artecna_varianti_rpc' THEN
    RAISE EXCEPTION USING ERRCODE='42501',
      MESSAGE='Contesto interno RPC Varianti non valido';
  END IF;

  BEGIN
    v_user_id := artecna_guardie.utente_jwt_corrente();
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='P2020',
      MESSAGE='Identità utente non valida';
  END;

  IF v_user_id IS NULL OR p_cantiere_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P2020',
      MESSAGE='Identità utente e cantiere sono obbligatori';
  END IF;

  IF artecna_guardie.utente_puo_modificare_cantiere(v_user_id,p_cantiere_id)
       IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION USING ERRCODE='P2021',
      MESSAGE='Utente non autorizzato a leggere le varianti del cantiere';
  END IF;

  RETURN QUERY
  SELECT v.id,v.cantiere_id,v.preventivo_contrattuale_id,v.numero,
         v.titolo,v.descrizione,v.stato,v.data_variante,
         v.importo_delta_approvato,v.approvata_at,
         v.riferimento_approvazione,v.created_at,v.updated_at
  FROM public.varianti_cantiere v
  WHERE v.cantiere_id=p_cantiere_id
  ORDER BY v.numero ASC NULLS LAST,v.created_at ASC,v.id ASC;
END;
$function$
;
ALTER FUNCTION public.leggi_varianti_cantiere(uuid) OWNER TO "artecna_varianti_rpc";
CREATE OR REPLACE FUNCTION public.aggiungi_lavorazione_variante(p_variante_id uuid, p_descrizione text, p_unita_misura text, p_quantita numeric, p_prezzo_unitario numeric)
 RETURNS TABLE(id bigint, variante_id uuid, numero_riga integer, operazione text, descrizione text, unita_misura text, quantita_delta numeric, prezzo_unitario numeric, delta_contratto numeric, note text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid;
  v_cantiere_id uuid;
  v_stato text;
  v_descrizione text;
  v_um text;
  v_numero bigint;
  v_delta numeric(18,2);
BEGIN
  IF current_user <> 'artecna_varianti_rpc' THEN
    RAISE EXCEPTION USING ERRCODE='42501',
      MESSAGE='Contesto interno RPC Varianti non valido';
  END IF;

  BEGIN
    v_user_id := artecna_guardie.utente_jwt_corrente();
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='P2022',
      MESSAGE='Identità utente non valida';
  END;

  IF v_user_id IS NULL OR p_variante_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P2022',
      MESSAGE='Identità utente e variante sono obbligatorie';
  END IF;

  v_descrizione := pg_catalog.btrim(p_descrizione);
  v_um := NULLIF(pg_catalog.btrim(p_unita_misura), '');

  IF v_descrizione IS NULL OR v_descrizione='' THEN
    RAISE EXCEPTION USING ERRCODE='P2023',
      MESSAGE='Descrizione lavorazione obbligatoria';
  END IF;

  IF p_quantita IS NULL OR p_prezzo_unitario IS NULL
     OR p_quantita::text IN ('NaN','Infinity','-Infinity')
     OR p_prezzo_unitario::text IN ('NaN','Infinity','-Infinity')
     OR p_quantita <= 0 OR p_prezzo_unitario < 0 THEN
    RAISE EXCEPTION USING ERRCODE='P2023',
      MESSAGE='Quantità o prezzo unitario non validi';
  END IF;

  SELECT v.cantiere_id, v.stato
  INTO v_cantiere_id, v_stato
  FROM public.varianti_cantiere v
  WHERE v.id=p_variante_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='P2024',
      MESSAGE='Variante non disponibile';
  END IF;

  IF artecna_guardie.utente_puo_modificare_cantiere(
       v_user_id,v_cantiere_id
     ) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION USING ERRCODE='P2024',
      MESSAGE='Utente non autorizzato sulla variante';
  END IF;

  IF v_stato IS DISTINCT FROM 'bozza' THEN
    RAISE EXCEPTION USING ERRCODE='P2025',
      MESSAGE='Le lavorazioni sono modificabili soltanto in bozza';
  END IF;

  SELECT COALESCE(max(l.numero_riga)::bigint,0)+1
  INTO v_numero
  FROM public.variante_lavorazioni l
  WHERE l.variante_id=p_variante_id;

  IF v_numero < 1 OR v_numero > 2147483647 THEN
    RAISE EXCEPTION USING ERRCODE='P2026',
      MESSAGE='Numerazione righe Variante non valida';
  END IF;

  v_delta := pg_catalog.round(p_quantita * p_prezzo_unitario,2);

  IF v_delta <= 0 THEN
    RAISE EXCEPTION USING ERRCODE='P2023',
      MESSAGE='Delta contratto deve essere positivo';
  END IF;

  BEGIN
    RETURN QUERY
    INSERT INTO public.variante_lavorazioni AS l (
      variante_id,
      numero_riga,
      operazione,
      descrizione,
      unita_misura,
      quantita_delta,
      prezzo_unitario,
      delta_contratto
    )
    VALUES (
      p_variante_id,
      v_numero::integer,
      'nuova',
      v_descrizione,
      v_um,
      p_quantita,
      p_prezzo_unitario,
      v_delta
    )
    RETURNING
      l.id,l.variante_id,l.numero_riga,l.operazione,l.descrizione,
      l.unita_misura,l.quantita_delta,l.prezzo_unitario,
      l.delta_contratto,l.note,l.created_at;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION USING ERRCODE='P2026',
      MESSAGE='Conflitto di numerazione riga Variante: riprovare';
  END;
END;
$function$
;
ALTER FUNCTION public.aggiungi_lavorazione_variante(uuid,text,text,numeric,numeric) OWNER TO "artecna_varianti_rpc";
CREATE OR REPLACE FUNCTION public.leggi_lavorazioni_variante(p_variante_id uuid)
 RETURNS TABLE(id bigint, variante_id uuid, numero_riga integer, operazione text, descrizione text, unita_misura text, quantita_delta numeric, prezzo_unitario numeric, delta_contratto numeric, riferimento_preventivo_lavorazione_id bigint, riferimento_variante_lavorazione_id bigint, note text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid;
  v_cantiere_id uuid;
BEGIN
  IF current_user <> 'artecna_varianti_rpc' THEN
    RAISE EXCEPTION USING ERRCODE='42501',
      MESSAGE='Contesto interno RPC Varianti non valido';
  END IF;

  BEGIN
    v_user_id := artecna_guardie.utente_jwt_corrente();
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='P2022',
      MESSAGE='Identità utente non valida';
  END;

  IF v_user_id IS NULL OR p_variante_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P2022',
      MESSAGE='Identità utente e variante sono obbligatorie';
  END IF;

  SELECT v.cantiere_id
  INTO v_cantiere_id
  FROM public.varianti_cantiere v
  WHERE v.id=p_variante_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='P2024',
      MESSAGE='Variante non disponibile';
  END IF;

  IF artecna_guardie.utente_puo_modificare_cantiere(
       v_user_id,v_cantiere_id
     ) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION USING ERRCODE='P2024',
      MESSAGE='Utente non autorizzato sulla variante';
  END IF;

  RETURN QUERY
  SELECT
    l.id,l.variante_id,l.numero_riga,l.operazione,l.descrizione,
    l.unita_misura,l.quantita_delta,l.prezzo_unitario,l.delta_contratto,
    l.riferimento_preventivo_lavorazione_id,
    l.riferimento_variante_lavorazione_id,l.note,l.created_at
  FROM public.variante_lavorazioni l
  WHERE l.variante_id=p_variante_id
  ORDER BY l.numero_riga,l.id;
END;
$function$
;
ALTER FUNCTION public.leggi_lavorazioni_variante(uuid) OWNER TO "artecna_varianti_rpc";
CREATE OR REPLACE FUNCTION public.approva_variante(p_variante_id uuid, p_riferimento_approvazione text)
 RETURNS TABLE(id uuid, cantiere_id uuid, preventivo_contrattuale_id uuid, numero integer, stato text, importo_delta_approvato numeric, approvata_at timestamp with time zone, riferimento_approvazione text, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid;
  v_variante public.varianti_cantiere%ROWTYPE;
  v_cantiere public.cantieri%ROWTYPE;
  v_riferimento text;
  v_numero_righe bigint;
  v_delta numeric(18,2);
BEGIN
  IF current_user <> 'artecna_varianti_rpc' THEN
    RAISE EXCEPTION USING ERRCODE='42501',
      MESSAGE='Contesto interno RPC Varianti non valido';
  END IF;

  BEGIN
    v_user_id := artecna_guardie.utente_jwt_corrente();
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION USING ERRCODE='P2027',
      MESSAGE='Identità utente non valida';
  END;

  IF v_user_id IS NULL OR p_variante_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='P2027',
      MESSAGE='Identità utente e variante sono obbligatorie';
  END IF;

  v_riferimento := pg_catalog.btrim(p_riferimento_approvazione);
  IF v_riferimento IS NULL OR v_riferimento='' THEN
    RAISE EXCEPTION USING ERRCODE='P2028',
      MESSAGE='Riferimento approvazione obbligatorio';
  END IF;

  SELECT v.*
  INTO v_variante
  FROM public.varianti_cantiere v
  WHERE v.id=p_variante_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='P2029',
      MESSAGE='Variante non disponibile';
  END IF;

  SELECT c.*
  INTO v_cantiere
  FROM public.cantieri c
  WHERE c.id=v_variante.cantiere_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='P2029',
      MESSAGE='Cantiere della variante non disponibile';
  END IF;

  IF artecna_guardie.utente_puo_modificare_cantiere(
       v_user_id,v_cantiere.id
     ) IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION USING ERRCODE='P2029',
      MESSAGE='Utente non autorizzato sulla variante';
  END IF;

  SELECT v.*
  INTO v_variante
  FROM public.varianti_cantiere v
  WHERE v.id=p_variante_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='P2029',
      MESSAGE='Variante non più disponibile';
  END IF;

  IF v_variante.cantiere_id IS DISTINCT FROM v_cantiere.id THEN
    RAISE EXCEPTION USING ERRCODE='P2030',
      MESSAGE='Cantiere della variante incoerente';
  END IF;

  IF v_variante.stato IS DISTINCT FROM 'proposta'
     OR v_variante.numero IS NULL
     OR v_variante.numero <= 0 THEN
    RAISE EXCEPTION USING ERRCODE='P2030',
      MESSAGE='È approvabile soltanto una variante proposta e numerata';
  END IF;

  IF v_cantiere.preventivo_contrattuale_id IS NULL
     OR v_variante.preventivo_contrattuale_id
        IS DISTINCT FROM v_cantiere.preventivo_contrattuale_id THEN
    RAISE EXCEPTION USING ERRCODE='P2031',
      MESSAGE='Il preventivo contrattuale è cambiato o non è impostato';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.preventivi_cantiere p
    WHERE p.id=v_variante.preventivo_contrattuale_id
      AND p.cantiere_id=v_cantiere.id
  ) THEN
    RAISE EXCEPTION USING ERRCODE='P2031',
      MESSAGE='Il preventivo contrattuale non appartiene al cantiere';
  END IF;

  SELECT count(*), pg_catalog.round(COALESCE(sum(l.delta_contratto),0),2)
  INTO v_numero_righe, v_delta
  FROM public.variante_lavorazioni l
  WHERE l.variante_id=v_variante.id;

  IF v_numero_righe < 1 THEN
    RAISE EXCEPTION USING ERRCODE='P2032',
      MESSAGE='La variante non contiene lavorazioni';
  END IF;

  IF v_delta::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION USING ERRCODE='P2032',
      MESSAGE='Importo della variante non valido';
  END IF;

  -- In V1 è ammesso anche un totale netto negativo futuro;
  -- è vietato solo un totale nullo, che non modifica il contratto.
  IF v_delta = 0 THEN
    RAISE EXCEPTION USING ERRCODE='P2032',
      MESSAGE='La variante ha delta contrattuale nullo';
  END IF;

  PERFORM artecna_guardie.valida_correzioni_variante(
    v_variante.id,
    v_cantiere.id,
    v_variante.preventivo_contrattuale_id
  );

  RETURN QUERY
  UPDATE public.varianti_cantiere AS v
  SET stato='approvata',
      importo_delta_approvato=v_delta,
      approvata_at=pg_catalog.now(),
      riferimento_approvazione=v_riferimento,
      updated_at=pg_catalog.now()
  WHERE v.id=v_variante.id
    AND v.stato='proposta'
  RETURNING
    v.id,v.cantiere_id,v.preventivo_contrattuale_id,v.numero,v.stato,
    v.importo_delta_approvato,v.approvata_at,
    v.riferimento_approvazione,v.updated_at;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='P2033',
      MESSAGE='La variante non è stata approvata';
  END IF;

  PERFORM public.importa_variante_approvata_nel_sal(v_variante.id);

EXCEPTION
  WHEN serialization_failure OR deadlock_detected THEN
    RAISE EXCEPTION USING ERRCODE='P2033',
      MESSAGE='Conflitto concorrente: ripetere l’intera transazione';
END;
$function$
;
ALTER FUNCTION public.approva_variante(uuid,text) OWNER TO "artecna_varianti_rpc";
CREATE OR REPLACE FUNCTION public.aggiungi_sorgente_variante(p_variante_id uuid, p_tipo text, p_preventivo_sorgente_id uuid, p_titolo text, p_nome_file text, p_formato text, p_file_sha256 text, p_snapshot_version integer, p_snapshot jsonb)
 RETURNS public.variante_sorgenti
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
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
$function$
;
ALTER FUNCTION public.aggiungi_sorgente_variante(uuid,text,uuid,text,text,text,text,integer,jsonb) OWNER TO "artecna_varianti_rpc";
CREATE OR REPLACE FUNCTION public.leggi_sorgenti_variante(p_variante_id uuid)
 RETURNS TABLE(id uuid, variante_id uuid, tipo text, preventivo_sorgente_id uuid, titolo text, nome_file text, formato text, file_sha256 text, snapshot_version integer, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
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
$function$
;
ALTER FUNCTION public.leggi_sorgenti_variante(uuid) OWNER TO "artecna_varianti_rpc";
CREATE OR REPLACE FUNCTION public.leggi_sorgente_variante(p_sorgente_id uuid)
 RETURNS public.variante_sorgenti
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
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
$function$
;
ALTER FUNCTION public.leggi_sorgente_variante(uuid) OWNER TO "artecna_varianti_rpc";
CREATE OR REPLACE FUNCTION public.rimuovi_sorgente_variante(p_sorgente_id uuid)
 RETURNS TABLE(id uuid, variante_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
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
$function$
;
ALTER FUNCTION public.rimuovi_sorgente_variante(uuid) OWNER TO "artecna_varianti_rpc";
CREATE OR REPLACE FUNCTION public.conferma_preventivo_integrativo(p_variante_id uuid, p_lavorazioni jsonb)
 RETURNS TABLE(variante_id uuid, numero_lavorazioni integer, delta_totale numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
declare
  v_utente uuid;
  v_variante public.varianti_cantiere%rowtype;
  v_cantiere_id uuid;
  v_cantiere public.cantieri%rowtype;
  v_sorgente_reale public.variante_sorgenti%rowtype;
  v_elemento record;
  v_riga jsonb;
  v_validate jsonb := '[]'::jsonb;
  v_viste text[] := array[]::text[];
  v_chiave text;
  v_sorgente uuid;
  v_indice integer;
  v_indice_num numeric;
  v_descrizione text;
  v_um text;
  v_quantita numeric;
  v_prezzo numeric;
  v_delta numeric;
  v_totale numeric := 0;
  v_numero bigint;
  v_conteggio integer;
  v_vincolo text;
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
  -- Lettura senza lock: serve soltanto a individuare il cantiere da bloccare.
  select v.cantiere_id into v_cantiere_id
  from public.varianti_cantiere v where v.id = p_variante_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Variante non disponibile';
  end if;
  select c.* into v_cantiere
  from public.cantieri c where c.id = v_cantiere_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Cantiere non disponibile';
  end if;
  if artecna_guardie.utente_puo_modificare_cantiere(v_utente, v_cantiere.id) is not true then
    raise exception using errcode = '42501', message = 'Cantiere non autorizzato';
  end if;
  -- Ordine condiviso con le RPC Varianti: cantiere -> Variante.
  select v.* into v_variante
  from public.varianti_cantiere v where v.id = p_variante_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Variante non disponibile';
  end if;
  if v_variante.cantiere_id is distinct from v_cantiere.id then
    raise exception using errcode = '22023', message = 'Cantiere della Variante cambiato';
  end if;
  if v_variante.stato is distinct from 'bozza' then
    raise exception using errcode = '22023', message = 'Variante non in bozza';
  end if;
  if v_cantiere.preventivo_contrattuale_id is null
    or v_variante.preventivo_contrattuale_id is null
    or v_variante.preventivo_contrattuale_id is distinct from v_cantiere.preventivo_contrattuale_id
    or not exists (
      select 1 from public.preventivi_cantiere p
      where p.id = v_cantiere.preventivo_contrattuale_id and p.cantiere_id = v_cantiere.id
    ) then
    raise exception using errcode = '22023', message = 'Contratto corrente non disponibile o cambiato';
  end if;
  if p_lavorazioni is null or jsonb_typeof(p_lavorazioni) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Payload non valido: atteso array JSON';
  end if;
  v_conteggio := jsonb_array_length(p_lavorazioni);
  if v_conteggio < 1 or v_conteggio > 1000 then
    raise exception using errcode = '22023', message = 'Payload non valido: richieste da 1 a 1000 lavorazioni';
  end if;

  -- Fase 1: nessun INSERT finche tutte le righe non sono state validate.
  for v_elemento in
    select e.value, e.ordinality
    from jsonb_array_elements(p_lavorazioni) with ordinality as e(value, ordinality)
    order by e.ordinality
  loop
    v_riga := v_elemento.value;
    if jsonb_typeof(v_riga) is distinct from 'object' then
      raise exception using errcode = '22023', message = format('Riga %s: atteso oggetto JSON', v_elemento.ordinality);
    end if;
    if not (v_riga ?& array['sorgenteId', 'indiceVoce', 'descrizione', 'unitaMisura', 'quantita', 'prezzoUnitario'])
      or (select count(*) from jsonb_object_keys(v_riga)) <> 6 then
      raise exception using errcode = '22023', message = format('Riga %s: campi mancanti o non ammessi', v_elemento.ordinality);
    end if;
    if jsonb_typeof(v_riga->'sorgenteId') is distinct from 'string'
      or jsonb_typeof(v_riga->'indiceVoce') is distinct from 'number'
      or jsonb_typeof(v_riga->'descrizione') is distinct from 'string'
      or jsonb_typeof(v_riga->'unitaMisura') is distinct from 'string'
      or jsonb_typeof(v_riga->'quantita') is distinct from 'number'
      or jsonb_typeof(v_riga->'prezzoUnitario') is distinct from 'number' then
      raise exception using errcode = '22023', message = format('Riga %s: tipi JSON non validi', v_elemento.ordinality);
    end if;
    begin
      v_sorgente := (v_riga->>'sorgenteId')::uuid;
      v_indice_num := (v_riga->>'indiceVoce')::numeric;
      v_quantita := (v_riga->>'quantita')::numeric;
      v_prezzo := (v_riga->>'prezzoUnitario')::numeric;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception using errcode = '22023', message = format('Riga %s: UUID o numero non valido', v_elemento.ordinality);
    end;
    if v_indice_num::text in ('NaN', 'Infinity', '-Infinity')
      or v_indice_num < 0 or v_indice_num > 2147483647 or trunc(v_indice_num) <> v_indice_num then
      raise exception using errcode = '22023', message = format('Riga %s: indice voce non valido', v_elemento.ordinality);
    end if;
    v_indice := v_indice_num::integer;
    select s.* into v_sorgente_reale from public.variante_sorgenti s
    where s.id = v_sorgente and s.variante_id = p_variante_id;
    if not found then
      raise exception using errcode = '22023', message = 'Sorgente non appartenente alla Variante';
    end if;
    if v_sorgente_reale.tipo = 'preventivo_artecna' then
      if v_sorgente_reale.preventivo_sorgente_id is null
        or not exists (
          select 1 from public.preventivi_cantiere p
          where p.id = v_sorgente_reale.preventivo_sorgente_id and p.cantiere_id = v_cantiere.id
        ) then
        raise exception using errcode = '22023', message = 'Preventivo sorgente non coerente con il cantiere';
      end if;
      if v_sorgente_reale.preventivo_sorgente_id = v_variante.preventivo_contrattuale_id then
        raise exception using errcode = 'P2101',
          message = 'La base contrattuale non puo essere confermata come nuova lavorazione';
      end if;
    elsif v_sorgente_reale.tipo = 'file' then
      if v_sorgente_reale.preventivo_sorgente_id is not null then
        raise exception using errcode = '22023', message = 'Sorgente file non coerente';
      end if;
    else
      raise exception using errcode = '22023', message = 'Tipo sorgente non valido';
    end if;
    v_chiave := v_sorgente::text || ':' || v_indice::text;
    if v_chiave = any(v_viste) then
      raise exception using errcode = '22023', message = 'Voce duplicata nel payload';
    end if;
    v_viste := array_append(v_viste, v_chiave);
    perform 1 from public.variante_lavorazioni l
    where l.variante_sorgente_id = v_sorgente and l.indice_voce_sorgente = v_indice;
    if found then
      raise exception using errcode = '23505', message = 'Voce sorgente gia confermata';
    end if;
    v_descrizione := btrim(v_riga->>'descrizione');
    v_um := btrim(v_riga->>'unitaMisura');
    if v_descrizione = '' then
      raise exception using errcode = '22023', message = format('Riga %s: descrizione obbligatoria', v_elemento.ordinality);
    end if;
    if v_um = '' then
      raise exception using errcode = '22023', message = format('Riga %s: unita di misura obbligatoria', v_elemento.ordinality);
    end if;
    if v_quantita::text in ('NaN', 'Infinity', '-Infinity') or v_quantita <= 0 then
      raise exception using errcode = '22023', message = format('Riga %s: quantita non valida', v_elemento.ordinality);
    end if;
    if v_prezzo::text in ('NaN', 'Infinity', '-Infinity') or v_prezzo < 0 then
      raise exception using errcode = '22023', message = format('Riga %s: prezzo non valido', v_elemento.ordinality);
    end if;
    begin
      v_delta := round(v_quantita * v_prezzo, 2);
      v_totale := v_totale + v_delta;
    exception when numeric_value_out_of_range then
      raise exception using errcode = '22023', message = 'Delta o totale fuori intervallo';
    end;
    if v_delta::text in ('NaN', 'Infinity', '-Infinity') or v_delta <= 0
      or v_totale::text in ('NaN', 'Infinity', '-Infinity') then
      raise exception using errcode = '22023', message = format('Riga %s: delta non valido', v_elemento.ordinality);
    end if;
    v_validate := v_validate || jsonb_build_array(jsonb_build_object(
      'sorgenteId', v_sorgente, 'indiceVoce', v_indice,
      'descrizione', v_descrizione, 'unitaMisura', v_um,
      'quantita', v_quantita, 'prezzoUnitario', v_prezzo, 'delta', v_delta
    ));
  end loop;

  select coalesce(max(l.numero_riga), 0)::bigint into v_numero
  from public.variante_lavorazioni l where l.variante_id = p_variante_id;
  if v_numero + v_conteggio > 2147483647 then
    raise exception using errcode = '22023', message = 'Numerazione lavorazioni esaurita';
  end if;
  -- Fase 2: solo dati validati, nello stesso lock e nella stessa transazione.
  for v_elemento in
    select e.value, e.ordinality
    from jsonb_array_elements(v_validate) with ordinality as e(value, ordinality)
    order by e.ordinality
  loop
    v_riga := v_elemento.value;
    insert into public.variante_lavorazioni (
      variante_id, numero_riga, operazione, descrizione, unita_misura,
      quantita_delta, prezzo_unitario, delta_contratto,
      riferimento_preventivo_lavorazione_id, riferimento_variante_lavorazione_id,
      variante_sorgente_id, indice_voce_sorgente
    ) values (
      p_variante_id, (v_numero + v_elemento.ordinality)::integer, 'nuova',
      v_riga->>'descrizione', v_riga->>'unitaMisura',
      (v_riga->>'quantita')::numeric, (v_riga->>'prezzoUnitario')::numeric,
      (v_riga->>'delta')::numeric, null, null,
      (v_riga->>'sorgenteId')::uuid, (v_riga->>'indiceVoce')::integer
    );
  end loop;
  return query select p_variante_id, v_conteggio, round(v_totale, 2);
exception
  when unique_violation then
    get stacked diagnostics v_vincolo = constraint_name;
    if v_vincolo = 'variante_lavorazioni_sorgente_voce_unique' then
      raise exception using errcode = '23505', message = 'Voce sorgente gia confermata';
    end if;
    -- Conserva anche l'errore applicativo 23505 emesso durante la validazione.
    if v_vincolo is null or v_vincolo = '' then raise; end if;
    raise exception using errcode = '23505', message = 'Conflitto concorrente sulle lavorazioni: ricaricare e riprovare';
  when serialization_failure or deadlock_detected then
    raise exception using errcode = SQLSTATE, message = 'Operazione concorrente: riprovare la transazione';
end;
$function$
;
ALTER FUNCTION public.conferma_preventivo_integrativo(uuid,jsonb) OWNER TO "artecna_varianti_rpc";
CREATE OR REPLACE FUNCTION public.aggiungi_correzione_variante(p_variante_id uuid, p_tipo_componente text, p_componente_id bigint, p_operazione text, p_quantita numeric, p_motivo text)
 RETURNS TABLE(id bigint, variante_id uuid, numero_riga integer, operazione text, descrizione text, unita_misura text, quantita_delta numeric, prezzo_unitario numeric, delta_contratto numeric, note text, riferimento_preventivo_lavorazione_id bigint, riferimento_variante_lavorazione_id bigint, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
declare
  v_utente uuid;
  v_cantiere_id uuid;
  v_cantiere record;
  v_variante record;
  v_h record;
  v_quantita numeric;
  v_quantita_delta numeric;
  v_delta numeric;
  v_numero bigint;
begin
  if current_user <> 'artecna_varianti_rpc' then
    raise exception using errcode = 'P2091', message = 'Ruolo RPC non valido';
  end if;
  v_utente := artecna_guardie.utente_jwt_corrente();
  if v_utente is null then
    raise exception using errcode = 'P2091', message = 'Sessione non valida';
  end if;
  if p_variante_id is null or p_tipo_componente is null
    or p_tipo_componente not in ('preventivo', 'variante')
    or p_componente_id is null or p_componente_id <= 0
    or p_operazione is null or p_operazione not in ('riduzione_residua', 'eliminazione_residua')
    or p_motivo is null or btrim(p_motivo) = '' then
    raise exception using errcode = 'P2091', message = 'Richiesta di correzione non valida';
  end if;
  if p_operazione = 'riduzione_residua' then
    if p_quantita is null or p_quantita <= 0
      or p_quantita::text in ('NaN', 'Infinity', '-Infinity') then
      raise exception using errcode = 'P2091', message = 'Quantita di riduzione non valida';
    end if;
  elsif p_quantita is not null then
    raise exception using errcode = 'P2091', message = 'Eliminazione: quantita client non ammessa';
  end if;

  select v.cantiere_id into v_cantiere_id
  from public.varianti_cantiere v where v.id = p_variante_id;
  if not found or v_cantiere_id is null then
    raise exception using errcode = 'P2093', message = 'Variante non disponibile';
  end if;
  select c.id, c.preventivo_contrattuale_id into v_cantiere
  from public.cantieri c where c.id = v_cantiere_id for update;
  if not found then
    raise exception using errcode = 'P2093', message = 'Cantiere non disponibile';
  end if;
  if artecna_guardie.utente_puo_modificare_cantiere(v_utente, v_cantiere.id) is not true then
    raise exception using errcode = 'P2092', message = 'Utente non autorizzato sul cantiere';
  end if;
  select v.id, v.cantiere_id, v.preventivo_contrattuale_id, v.stato into v_variante
  from public.varianti_cantiere v where v.id = p_variante_id for update;
  if not found then
    raise exception using errcode = 'P2093', message = 'Variante non disponibile dopo il lock';
  end if;
  if v_variante.cantiere_id is distinct from v_cantiere.id
    or v_variante.stato is distinct from 'bozza'
    or v_cantiere.preventivo_contrattuale_id is null
    or v_variante.preventivo_contrattuale_id is distinct from v_cantiere.preventivo_contrattuale_id
    or not exists (
      select 1 from public.preventivi_cantiere p
      where p.id = v_cantiere.preventivo_contrattuale_id and p.cantiere_id = v_cantiere.id
    ) then
    raise exception using errcode = 'P2093', message = 'Variante non modificabile o contratto cambiato';
  end if;

  -- Comando separato DOPO entrambi i lock; una sola invocazione dell'helper STABLE.
  begin
    select h.* into strict v_h
    from artecna_guardie.calcola_residuo_componente(
      p_tipo_componente, p_componente_id, v_cantiere.id, v_variante.preventivo_contrattuale_id
    ) h;
  exception
    -- P2033 include anche valori canonici/contesto incoerenti: non si analizza il messaggio.
    when sqlstate 'P2031' or sqlstate 'P2033' or sqlstate 'P2035' then
      raise exception using errcode = 'P2094', message = 'Componente non disponibile o non coerente';
    when sqlstate 'P2034' or sqlstate 'P2036' or sqlstate 'P2037' or sqlstate 'P2038' then
      raise exception using errcode = 'P2095', message = 'Stato SAL o residuo non verificabile';
    when no_data_found or too_many_rows then
      raise exception using errcode = 'P2094', message = 'Cardinalita del componente non valida';
  end;
  if v_h.tipo_componente is distinct from p_tipo_componente
    or v_h.componente_id is distinct from p_componente_id
    or v_h.cantiere_id is distinct from v_cantiere.id
    or v_h.preventivo_contrattuale_id is distinct from v_variante.preventivo_contrattuale_id then
    raise exception using errcode = 'P2094', message = 'Identita del componente non coerente';
  end if;
  if v_h.sal_presente is not true or v_h.maturato_verificabile is not true
    or v_h.quantita_riducibile is null or v_h.importo_riducibile is null then
    raise exception using errcode = 'P2095', message = 'SAL o maturato non verificabile';
  end if;
  if v_h.quantita_contrattuale is null or v_h.importo_contrattuale is null
    or v_h.quantita_contrattuale::text in ('NaN', 'Infinity', '-Infinity')
    or v_h.importo_contrattuale::text in ('NaN', 'Infinity', '-Infinity')
    or v_h.quantita_riducibile::text in ('NaN', 'Infinity', '-Infinity')
    or v_h.importo_riducibile::text in ('NaN', 'Infinity', '-Infinity')
    or v_h.quantita_contrattuale < 0 or v_h.importo_contrattuale < 0
    or v_h.quantita_riducibile < 0 or v_h.importo_riducibile < 0
    or v_h.quantita_riducibile > v_h.quantita_contrattuale
    or v_h.importo_riducibile > v_h.importo_contrattuale then
    raise exception using errcode = 'P2095', message = 'Residui quantitativi o economici incoerenti';
  end if;
  if v_h.quantita_contrattuale = 0 or v_h.quantita_riducibile = 0 then
    raise exception using errcode = 'P2096', message = 'Nessuna quantita riducibile disponibile';
  end if;
  if v_h.descrizione is null or btrim(v_h.descrizione) = ''
    or v_h.unita_misura is null or btrim(v_h.unita_misura) = ''
    or v_h.prezzo_unitario is null or v_h.prezzo_unitario < 0
    or v_h.prezzo_unitario::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception using errcode = 'P2094', message = 'Valori canonici del componente non validi';
  end if;

  v_quantita := case when p_operazione = 'riduzione_residua'
    then p_quantita else v_h.quantita_riducibile end;
  if v_quantita > v_h.quantita_riducibile then
    raise exception using errcode = 'P2096', message = 'Quantita superiore al residuo';
  end if;
  v_quantita_delta := -v_quantita;
  v_delta := round(v_quantita_delta * v_h.prezzo_unitario, 2);
  if v_quantita_delta >= 0 or v_delta >= 0
    or v_quantita_delta::text in ('NaN', 'Infinity', '-Infinity')
    or v_delta::text in ('NaN', 'Infinity', '-Infinity') then
    raise exception using errcode = 'P2091', message = 'Quantita o delta della correzione non validi';
  end if;
  if p_operazione = 'eliminazione_residua' then
    if -v_delta <> v_h.importo_riducibile then
      raise exception using errcode = 'P2097', message = 'Eliminazione economicamente diversa dal residuo';
    end if;
  elsif -v_delta > v_h.importo_riducibile then
    raise exception using errcode = 'P2096', message = 'Importo della riduzione superiore al residuo';
  end if;

  -- Non lasciare che i typmod delle colonne arrotondino implicitamente i valori validati.
  begin
    if v_quantita_delta::numeric(18,6) <> v_quantita_delta then
      raise exception using errcode = 'P2091', message = 'Quantita non rappresentabile senza arrotondamento';
    end if;
    if v_h.prezzo_unitario::numeric(18,6) <> v_h.prezzo_unitario then
      raise exception using errcode = 'P2094', message = 'Prezzo canonico non rappresentabile senza arrotondamento';
    end if;
    if v_delta::numeric(18,2) <> v_delta then
      raise exception using errcode = 'P2091', message = 'Delta non rappresentabile';
    end if;
  exception when numeric_value_out_of_range then
    raise exception using errcode = 'P2091', message = 'Valori oltre la capacita numerica delle colonne';
  end;

  -- Stessa strategia legacy, con testata gia lockata; nessun ID/nextval client.
  select coalesce(max(l.numero_riga)::bigint, 0) + 1 into v_numero
  from public.variante_lavorazioni l where l.variante_id = p_variante_id;
  if v_numero < 1 or v_numero > 2147483647 then
    raise exception using errcode = 'P2098', message = 'Numerazione lavorazioni esaurita';
  end if;
  return query
  insert into public.variante_lavorazioni as l (
    variante_id, numero_riga, operazione, descrizione, unita_misura,
    quantita_delta, prezzo_unitario, delta_contratto,
    riferimento_preventivo_lavorazione_id, riferimento_variante_lavorazione_id,
    note, variante_sorgente_id, indice_voce_sorgente
  ) values (
    p_variante_id, v_numero::integer, p_operazione, v_h.descrizione, v_h.unita_misura,
    v_quantita_delta, v_h.prezzo_unitario, v_delta,
    case when p_tipo_componente = 'preventivo' then p_componente_id else null end,
    case when p_tipo_componente = 'variante' then p_componente_id else null end,
    btrim(p_motivo), null, null
  ) returning l.id, l.variante_id, l.numero_riga, l.operazione, l.descrizione,
    l.unita_misura, l.quantita_delta, l.prezzo_unitario, l.delta_contratto,
    l.note, l.riferimento_preventivo_lavorazione_id,
    l.riferimento_variante_lavorazione_id, l.created_at;
exception
  when unique_violation or serialization_failure or deadlock_detected then
    raise exception using errcode = 'P2098', message = 'Conflitto durante inserimento: ricaricare e riprovare';
end;
$function$
;
ALTER FUNCTION public.aggiungi_correzione_variante(uuid,text,bigint,text,numeric,text) OWNER TO "artecna_varianti_rpc";
CREATE OR REPLACE FUNCTION public.leggi_contesto_preventivo_integrativo(p_variante_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE v record; p record; u uuid; lettura jsonb; contratto jsonb; righe jsonb:='[]'; r record; h record; residuo numeric; firma text;
BEGIN
 u:=artecna_guardie.utente_jwt_corrente();
 SELECT id,cantiere_id,preventivo_contrattuale_id,stato INTO v FROM public.varianti_cantiere WHERE id=p_variante_id;
 IF u IS NULL OR NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(u,v.cantiere_id) IS NOT TRUE THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Variante non accessibile'; END IF;
 IF v.stato<>'bozza' OR NOT EXISTS(SELECT 1 FROM public.cantieri c WHERE c.id=v.cantiere_id AND c.preventivo_contrattuale_id=v.preventivo_contrattuale_id) THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Bozza o contratto corrente non coerente'; END IF;
 SELECT id,sopralluogo_id INTO p FROM public.preventivi_cantiere WHERE id=v.preventivo_contrattuale_id AND cantiere_id=v.cantiere_id AND natura IS DISTINCT FROM 'integrativo';
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Contratto non disponibile'; END IF;
 lettura:=public.leggi_osservatore_variante(v.id);
 FOR r IN SELECT id,descrizione,unita_misura,quantita,prezzo_unitario FROM public.preventivo_lavorazioni
  WHERE preventivo_id=p.id AND cantiere_id=v.cantiere_id ORDER BY id LOOP
  residuo:=NULL;
  BEGIN
   SELECT * INTO STRICT h FROM artecna_guardie.calcola_residuo_componente('preventivo',r.id,v.cantiere_id,p.id);
   IF h.sal_presente AND h.maturato_verificabile THEN residuo:=h.quantita_riducibile; END IF;
  EXCEPTION WHEN SQLSTATE 'P2031' OR SQLSTATE 'P2033' OR SQLSTATE 'P2034' OR SQLSTATE 'P2035' OR SQLSTATE 'P2036' OR SQLSTATE 'P2037' OR SQLSTATE 'P2038' OR no_data_found OR too_many_rows THEN residuo:=NULL;
  END;
  righe:=righe||jsonb_build_array(jsonb_build_object('id',r.id::text,'descrizione',r.descrizione,'unita_misura',r.unita_misura,
   'quantita',r.quantita,'prezzo_unitario',r.prezzo_unitario,'quantita_riducibile',residuo));
 END LOOP;
 IF jsonb_array_length(righe)>1000 THEN RAISE EXCEPTION 'Contratto troppo grande'; END IF;
 contratto:=jsonb_build_object('id',p.id,'voci',righe);
 firma:=encode(sha256(convert_to(jsonb_build_object('manifesto',lettura#>'{fonti,manifesto}','analisi_id',lettura#>'{analisi,id}','contratto',contratto)::text,'UTF8')),'hex');
 RETURN jsonb_build_object('lettura',lettura,'contratto',contratto,'firma',firma,
  'documento_confermato',(SELECT id FROM public.preventivi_cantiere WHERE variante_id=v.id AND natura='integrativo'),
  'lavorazioni_presenti',(SELECT count(*) FROM public.variante_lavorazioni WHERE variante_id=v.id),
  'genealogia',jsonb_build_object(
  'cantiere_id',v.cantiere_id,'variante_id',v.id,'preventivo_contrattuale_id',p.id,'sopralluogo_origine_id',p.sopralluogo_id));
END $function$
;
ALTER FUNCTION public.leggi_contesto_preventivo_integrativo(uuid) OWNER TO "artecna_varianti_rpc";
CREATE OR REPLACE FUNCTION public.salva_preventivo_integrativo_generato(p_variante_id uuid, p_richiesta_id uuid, p_firma text, p_descrizione text, p_voci jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE u uuid; v record; c uuid; ctx jsonb; h text; old_doc record; x jsonb; ref_id bigint; ref record;
 q numeric; prezzo numeric; delta numeric; totale numeric:=0; numero integer; op text; refs bigint[]:='{}'; salvata record; ids jsonb:='[]';
BEGIN
 u:=artecna_guardie.utente_jwt_corrente();
 SELECT cantiere_id INTO c FROM public.varianti_cantiere WHERE id=p_variante_id;
 IF u IS NULL OR c IS NULL OR artecna_guardie.utente_puo_modificare_cantiere(u,c) IS NOT TRUE THEN
 RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Variante non accessibile'; END IF;
 PERFORM 1 FROM public.cantieri WHERE id=c FOR UPDATE;
 SELECT id,cantiere_id,preventivo_contrattuale_id,stato INTO STRICT v FROM public.varianti_cantiere WHERE id=p_variante_id FOR UPDATE;
 h:=encode(sha256(convert_to(jsonb_build_array(p_variante_id,p_firma,p_descrizione,p_voci)::text,'UTF8')),'hex');
 SELECT natura,variante_id,provenienza_generazione,importo_totale INTO old_doc FROM public.preventivi_cantiere WHERE id=p_richiesta_id;
 IF FOUND THEN
  IF old_doc.natura IS DISTINCT FROM 'integrativo' OR old_doc.variante_id IS DISTINCT FROM p_variante_id OR old_doc.provenienza_generazione->>'richiesta_hash' IS DISTINCT FROM h THEN
   RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='Identita richiesta gia usata per dati differenti'; END IF;
  RETURN jsonb_build_object('preventivo_id',p_richiesta_id,'variante_id',p_variante_id,'delta_totale',old_doc.importo_totale,'gia_salvato',true);
 END IF;
 IF p_richiesta_id IS NULL OR p_descrizione IS NULL OR btrim(p_descrizione)='' OR length(p_descrizione)>100000 OR
 jsonb_typeof(p_voci) IS DISTINCT FROM 'array' OR jsonb_array_length(p_voci) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'Documento non valido'; END IF;
 ctx:=public.leggi_contesto_preventivo_integrativo(v.id);
 IF ctx->>'firma' IS DISTINCT FROM p_firma OR (ctx#>'{lettura,analisi}'<>'null'::jsonb AND ctx#>>'{lettura,analisi,allineata}' IS DISTINCT FROM 'true') THEN
  RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Fonti, analisi o contratto cambiati: rivedere la generazione'; END IF;
 IF EXISTS(SELECT 1 FROM public.preventivi_cantiere WHERE variante_id=v.id AND natura='integrativo') THEN
  RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='Preventivo Integrativo gia confermato nella Variante'; END IF;
 IF EXISTS(SELECT 1 FROM public.variante_lavorazioni WHERE variante_id=v.id) THEN
  RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='La bozza contiene gia lavorazioni: nessuna duplicazione automatica consentita'; END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(p_voci) LOOP
  IF jsonb_typeof(x)<>'object' OR jsonb_typeof(x->'quantita') IS DISTINCT FROM 'number' OR jsonb_typeof(x->'prezzo_unitario') IS DISTINCT FROM 'number'
   OR x->'revisione_confermata' IS DISTINCT FROM 'true'::jsonb OR x->'da_verificare' IS DISTINCT FROM 'false'::jsonb
   OR coalesce(btrim(x->>'descrizione'),'')='' OR coalesce(btrim(x->>'unita_misura'),'')='' THEN RAISE EXCEPTION 'Revisione umana incompleta'; END IF;
  op:=x->>'operazione'; q:=(x->>'quantita')::numeric; prezzo:=(x->>'prezzo_unitario')::numeric;
  ref_id:=(x->>'riferimento_preventivo_lavorazione_id')::bigint;
  IF op IS NULL OR op NOT IN('nuova','aumento','riduzione','eliminazione') OR q=0 OR prezzo<=0 OR
   q::text IN('NaN','Infinity','-Infinity') OR prezzo::text IN('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Operazione o numeri non validi'; END IF;
  IF q::numeric(18,6)<>q OR prezzo::numeric(18,6)<>prezzo THEN RAISE EXCEPTION 'Valori non rappresentabili senza arrotondamento'; END IF;
  IF op='nuova' THEN
   IF ref_id IS NOT NULL OR q<0 THEN RAISE EXCEPTION 'Nuova lavorazione non coerente'; END IF;
   SELECT * INTO STRICT salvata FROM public.aggiungi_lavorazione_variante(v.id,x->>'descrizione',x->>'unita_misura',q,prezzo);
  ELSE
   IF ref_id IS NULL OR ref_id=ANY(refs) THEN RAISE EXCEPTION 'Riferimento contrattuale mancante o duplicato'; END IF;
   refs:=array_append(refs,ref_id);
   SELECT id,descrizione,unita_misura,prezzo_unitario INTO ref FROM public.preventivo_lavorazioni WHERE id=ref_id AND preventivo_id=v.preventivo_contrattuale_id AND cantiere_id=c;
   IF NOT FOUND OR ref.prezzo_unitario IS DISTINCT FROM prezzo OR ref.unita_misura IS DISTINCT FROM x->>'unita_misura' THEN RAISE EXCEPTION 'Riferimento o prezzo non coerente'; END IF;
   IF op IN('riduzione','eliminazione') THEN
    IF q>=0 THEN RAISE EXCEPTION 'Detrazione deve essere negativa'; END IF;
    SELECT * INTO STRICT salvata FROM public.aggiungi_correzione_variante(v.id,'preventivo',ref_id,
     CASE WHEN op='riduzione' THEN 'riduzione_residua' ELSE 'eliminazione_residua' END,
     CASE WHEN op='riduzione' THEN -q ELSE NULL END,x->>'descrizione');
    IF salvata.quantita_delta IS DISTINCT FROM q OR salvata.prezzo_unitario IS DISTINCT FROM prezzo THEN RAISE EXCEPTION 'Residuo cambiato: rivedere la voce'; END IF;
   ELSE
    IF q<=0 THEN RAISE EXCEPTION 'Aumento deve essere positivo'; END IF;
    SELECT coalesce(max(numero_riga),0)+1 INTO numero FROM public.variante_lavorazioni WHERE variante_id=v.id;
    INSERT INTO public.variante_lavorazioni(variante_id,numero_riga,operazione,descrizione,unita_misura,quantita_delta,prezzo_unitario,delta_contratto,riferimento_preventivo_lavorazione_id)
     VALUES(v.id,numero,'aumento',x->>'descrizione',ref.unita_misura,q,prezzo,round(q*prezzo,2),ref_id) RETURNING * INTO salvata;
   END IF;
  END IF;
  delta:=salvata.delta_contratto; totale:=totale+delta;
  ids:=ids||jsonb_build_array(salvata.id::text);
 END LOOP;
 INSERT INTO public.preventivi_cantiere(id,cantiere,cantiere_id,sopralluogo_id,natura,variante_id,preventivo_contrattuale_id,provenienza_generazione,
  nome_file,descrizione_ai,note,json_voci_ai,importo_totale,origine_ai,stato_preventivo,approvato,data_preventivo)
 VALUES(p_richiesta_id,(SELECT nome FROM public.cantieri WHERE id=c),c,(ctx#>>'{genealogia,sopralluogo_origine_id}')::uuid,'integrativo',v.id,v.preventivo_contrattuale_id,
  jsonb_build_object('firma',p_firma,'richiesta_hash',h,'manifesto',ctx#>'{lettura,fonti,manifesto}','analisi_id',ctx#>'{lettura,analisi,id}','lavorazioni_variante_id',ids),
  'Preventivo_Integrativo_'||v.id::text,p_descrizione,'Documento della Variante; non e un nuovo contratto',p_voci,round(totale,2),true,'integrativo_confermato',false,current_date);
 RETURN jsonb_build_object('preventivo_id',p_richiesta_id,'variante_id',v.id,'delta_totale',round(totale,2),'gia_salvato',false);
END $function$
;
ALTER FUNCTION public.salva_preventivo_integrativo_generato(uuid,uuid,text,text,jsonb) OWNER TO "artecna_varianti_rpc";
CREATE OR REPLACE FUNCTION public.salva_preventivo_integrativo_manuale(p_variante_id uuid, p_richiesta_id uuid, p_firma text, p_descrizione text, p_voci jsonb, p_metadati jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE esito jsonb;
BEGIN
 IF jsonb_typeof(p_metadati) IS DISTINCT FROM 'object' OR EXISTS(
  SELECT 1 FROM jsonb_object_keys(p_metadati) k WHERE k NOT IN('cliente','titolo','data')
 ) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Metadati manuali non validi'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each(p_metadati) m WHERE jsonb_typeof(m.value)<>'string' OR length(btrim(m.value#>>'{}'))=0)
 OR (p_metadati ? 'data' AND (p_metadati->>'data') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Completa i metadati manuali'; END IF;
 IF jsonb_typeof(p_voci) IS DISTINCT FROM 'array' THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Voci manuali non valide';
 END IF;
 IF jsonb_array_length(p_voci)=0 OR EXISTS(
  SELECT 1 FROM jsonb_array_elements(p_voci) v WHERE v->>'origine_documento' IS DISTINCT FROM 'manuale'
 ) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Origine manuale richiesta per ogni voce'; END IF;
 esito:=public.salva_preventivo_integrativo_generato(p_variante_id,p_richiesta_id,p_firma,p_descrizione,p_voci);
 IF (esito->>'gia_salvato')::boolean THEN
  IF NOT EXISTS(SELECT 1 FROM public.preventivi_cantiere WHERE id=p_richiesta_id
   AND provenienza_generazione->'metadati_manuali'=p_metadati AND provenienza_generazione->>'origine'='manuale')
  THEN RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='Richiesta manuale già utilizzata con metadati diversi'; END IF;
  RETURN esito;
 END IF;
 UPDATE public.preventivi_cantiere SET origine_ai=false,
  cliente_ai=coalesce(p_metadati->>'cliente',cliente_ai),nome_file=coalesce(p_metadati->>'titolo',nome_file),
  data_preventivo=coalesce((p_metadati->>'data')::date,data_preventivo),
  provenienza_generazione=provenienza_generazione||jsonb_build_object('origine','manuale','metadati_manuali',p_metadati)
 WHERE id=p_richiesta_id AND variante_id=p_variante_id AND natura='integrativo';
 IF NOT FOUND THEN RAISE EXCEPTION 'Documento manuale non confermato'; END IF;
 RETURN esito;
END $function$
;
ALTER FUNCTION public.salva_preventivo_integrativo_manuale(uuid,uuid,text,text,jsonb,jsonb) OWNER TO "artecna_varianti_rpc";
CREATE OR REPLACE FUNCTION artecna_guardie.valida_correzioni_variante(p_variante_id uuid, p_cantiere_id uuid, p_preventivo_contrattuale_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
declare
  v_variante record;
  v_l record;
  v_g record;
  v_h record;
begin
  if current_user <> 'artecna_varianti_rpc' then
    raise exception using errcode = '42501', message = 'Owner validatore non corretto';
  end if;
  if p_variante_id is null or p_cantiere_id is null or p_preventivo_contrattuale_id is null then
    raise exception using errcode = 'P2081', message = 'Identita Variante o contesto mancanti';
  end if;
  select v.cantiere_id, v.preventivo_contrattuale_id, v.stato
  into v_variante from public.varianti_cantiere v where v.id = p_variante_id;
  if not found then
    raise exception using errcode = 'P2081', message = 'Variante non disponibile';
  end if;
  if v_variante.stato is distinct from 'proposta'
    or v_variante.cantiere_id is distinct from p_cantiere_id
    or v_variante.preventivo_contrattuale_id is distinct from p_preventivo_contrattuale_id then
    raise exception using errcode = 'P2088', message = 'Stato o contesto Variante incoerenti';
  end if;

  -- Tutte le righe sono validate prima delle somme; nessun NULL viene ignorato.
  for v_l in
    select l.id, l.operazione, l.descrizione, l.unita_misura, l.note,
      l.quantita_delta, l.prezzo_unitario, l.delta_contratto,
      l.riferimento_preventivo_lavorazione_id, l.riferimento_variante_lavorazione_id
    from public.variante_lavorazioni l where l.variante_id = p_variante_id
    order by l.id
  loop
    if v_l.operazione is null or v_l.operazione not in
      ('nuova', 'aumento', 'riduzione_residua', 'eliminazione_residua') then
      raise exception using errcode = 'P2081', message = 'Operazione non ammessa';
    end if;
    if v_l.operazione in ('nuova', 'aumento') then
      continue;
    end if;
    if v_l.id is null or v_l.id <= 0
      or (v_l.riferimento_preventivo_lavorazione_id is null) =
         (v_l.riferimento_variante_lavorazione_id is null)
      or coalesce(v_l.riferimento_preventivo_lavorazione_id,
                  v_l.riferimento_variante_lavorazione_id) <= 0 then
      raise exception using errcode = 'P2081', message = 'Riferimento correttivo non valido';
    end if;
    if v_l.descrizione is null or btrim(v_l.descrizione) = ''
      or v_l.unita_misura is null or btrim(v_l.unita_misura) = '' then
      raise exception using errcode = 'P2086', message = 'Descrizione o UM mancanti';
    end if;
    if v_l.note is null or btrim(v_l.note) = '' then
      raise exception using errcode = 'P2081', message = 'Motivazione della correttiva mancante';
    end if;
    if v_l.quantita_delta is null or v_l.quantita_delta >= 0
      or v_l.quantita_delta::text in ('NaN', 'Infinity', '-Infinity')
      or v_l.prezzo_unitario is null or v_l.prezzo_unitario < 0
      or v_l.prezzo_unitario::text in ('NaN', 'Infinity', '-Infinity')
      or v_l.delta_contratto is null or v_l.delta_contratto >= 0
      or v_l.delta_contratto::text in ('NaN', 'Infinity', '-Infinity') then
      raise exception using errcode = 'P2085', message = 'Quantita, prezzo o delta non validi';
    end if;
  end loop;

  for v_g in
    select case when l.riferimento_preventivo_lavorazione_id is not null
        then 'preventivo' else 'variante' end as tipo,
      coalesce(l.riferimento_preventivo_lavorazione_id,
               l.riferimento_variante_lavorazione_id) as componente_id,
      count(*) filter (where l.operazione = 'riduzione_residua') as riduzioni,
      count(*) filter (where l.operazione = 'eliminazione_residua') as eliminazioni,
      -sum(l.quantita_delta) as quantita, -sum(l.delta_contratto) as importo
    from public.variante_lavorazioni l
    where l.variante_id = p_variante_id
      and l.operazione in ('riduzione_residua', 'eliminazione_residua')
    group by 1, 2
    order by 1, 2
  loop
    if v_g.eliminazioni > 1 or (v_g.eliminazioni = 1 and v_g.riduzioni > 0) then
      raise exception using errcode = 'P2087', message = 'Combinazione correttive vietata';
    end if;
    if v_g.quantita is null or v_g.quantita <= 0
      or v_g.quantita::text in ('NaN', 'Infinity', '-Infinity')
      or v_g.importo is null or v_g.importo <= 0
      or v_g.importo::text in ('NaN', 'Infinity', '-Infinity') then
      raise exception using errcode = 'P2085', message = 'Aggregati correttivi non validi';
    end if;
    -- Una sola invocazione per componente; STRICT impone esattamente una riga.
    -- Traduzione limitata a questo blocco: gli errori inattesi propagano.
    begin
      select h.* into strict v_h
      from artecna_guardie.calcola_residuo_componente(
        v_g.tipo, v_g.componente_id, p_cantiere_id, p_preventivo_contrattuale_id
      ) h;
    exception
      when sqlstate 'P2031' or sqlstate 'P2035' then
        raise exception using errcode = 'P2081', message = 'Componente correttivo non disponibile';
      -- P2033 copre sia sorgenti sia contesto/SAL: non si interpreta il messaggio.
      when sqlstate 'P2033' or sqlstate 'P2034' or sqlstate 'P2036'
        or sqlstate 'P2037' or sqlstate 'P2038' then
        raise exception using errcode = 'P2088', message = 'Stato contrattuale o SAL incoerente';
      when no_data_found or too_many_rows then
        raise exception using errcode = 'P2088', message = 'Cardinalita helper residuo incoerente';
    end;
    if v_h.tipo_componente is distinct from v_g.tipo
      or v_h.componente_id is distinct from v_g.componente_id
      or v_h.cantiere_id is distinct from p_cantiere_id
      or v_h.preventivo_contrattuale_id is distinct from p_preventivo_contrattuale_id then
      raise exception using errcode = 'P2088', message = 'Identita restituita dall helper incoerente';
    end if;
    if v_h.sal_presente is not true or v_h.maturato_verificabile is not true
      or v_h.quantita_riducibile is null or v_h.importo_riducibile is null then
      raise exception using errcode = 'P2082', message = 'SAL o maturato non verificabile';
    end if;
    if v_h.quantita_contrattuale is null or v_h.importo_contrattuale is null
      or v_h.quantita_contrattuale < 0 or v_h.importo_contrattuale < 0
      or v_h.quantita_riducibile < 0 or v_h.importo_riducibile < 0
      or v_h.quantita_contrattuale::text in ('NaN', 'Infinity', '-Infinity')
      or v_h.importo_contrattuale::text in ('NaN', 'Infinity', '-Infinity')
      or v_h.quantita_riducibile::text in ('NaN', 'Infinity', '-Infinity')
      or v_h.importo_riducibile::text in ('NaN', 'Infinity', '-Infinity')
      or v_h.quantita_riducibile > v_h.quantita_contrattuale
      or v_h.importo_riducibile > v_h.importo_contrattuale then
      raise exception using errcode = 'P2088', message = 'Residui contrattuali incoerenti';
    end if;
    if v_h.quantita_contrattuale = 0 or v_h.quantita_riducibile = 0 then
      raise exception using errcode = 'P2089', message = 'Nessun residuo disponibile';
    end if;
    for v_l in
      select l.descrizione, l.unita_misura, l.quantita_delta,
        l.prezzo_unitario, l.delta_contratto
      from public.variante_lavorazioni l
      where l.variante_id = p_variante_id
        and l.operazione in ('riduzione_residua', 'eliminazione_residua')
        and ((v_g.tipo = 'preventivo' and l.riferimento_preventivo_lavorazione_id = v_g.componente_id)
          or (v_g.tipo = 'variante' and l.riferimento_variante_lavorazione_id = v_g.componente_id))
      order by l.id
    loop
      if btrim(v_l.descrizione) is distinct from btrim(v_h.descrizione)
        or btrim(v_l.unita_misura) is distinct from btrim(v_h.unita_misura) then
        raise exception using errcode = 'P2086', message = 'Descrizione o UM non canoniche';
      end if;
      if v_l.prezzo_unitario is distinct from v_h.prezzo_unitario
        or round(v_l.quantita_delta * v_h.prezzo_unitario, 2) is distinct from v_l.delta_contratto then
        raise exception using errcode = 'P2085', message = 'Prezzo o delta non coerenti con la sorgente';
      end if;
    end loop;
    if v_g.eliminazioni = 1 then
      if v_g.quantita <> v_h.quantita_riducibile or v_g.importo <> v_h.importo_riducibile then
        raise exception using errcode = 'P2084', message = 'Eliminazione diversa dal residuo';
      end if;
    elsif v_g.quantita > v_h.quantita_riducibile or v_g.importo > v_h.importo_riducibile then
      raise exception using errcode = 'P2083', message = 'Riduzione superiore al residuo';
    end if;
  end loop;
end;
$function$
;
ALTER FUNCTION artecna_guardie.valida_correzioni_variante(uuid,uuid,uuid) OWNER TO "artecna_varianti_rpc";
CREATE OR REPLACE FUNCTION public.valorizza_manodopera_economia(p_riga_id uuid, p_prezzo_cliente numeric, p_revisione_attesa bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE uid uuid; cid uuid; rid uuid; r public.economia_raccolte%rowtype; l public.economia_righe%rowtype;
BEGIN
 uid:=artecna_guardie.utente_jwt_corrente();
 SELECT e.raccolta_id,c.cantiere_id INTO rid,cid FROM public.economia_righe e JOIN public.economia_raccolte c ON c.id=e.raccolta_id WHERE e.id=p_riga_id;
 IF uid IS NULL OR cid IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Riga assente o non autorizzata'; END IF;
 PERFORM c.id FROM public.cantieri c WHERE c.id=cid FOR UPDATE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(uid,cid) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non autorizzato'; END IF;
 PERFORM u.user_id FROM public.utenti_cantiere u WHERE u.cantiere_id=cid AND u.user_id=uid AND u.ruolo='owner' FOR SHARE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(uid,cid) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato dopo lock'; END IF;
 SELECT * INTO r FROM public.economia_raccolte WHERE id=rid AND cantiere_id=cid FOR UPDATE;
 IF NOT FOUND OR r.stato IS DISTINCT FROM 'bozza' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Valorizzazione consentita solo in bozza'; END IF;
 IF r.revisione IS DISTINCT FROM p_revisione_attesa THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Revisione Economia divergente'; END IF;
 SELECT * INTO l FROM public.economia_righe WHERE id=p_riga_id AND raccolta_id=r.id FOR UPDATE;
 IF NOT FOUND OR l.origine IS DISTINCT FROM 'rapportino' OR l.tipo_riga IS DISTINCT FROM 'manodopera' OR l.unita_misura IS DISTINCT FROM 'h' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riga manodopera rapportino non valida'; END IF;
 IF p_prezzo_cliente IS NULL OR p_prezzo_cliente::text IN ('NaN','Infinity','-Infinity') OR p_prezzo_cliente<=0 OR p_prezzo_cliente>=1000000000000 OR p_prezzo_cliente<>round(p_prezzo_cliente,6) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Prezzo cliente non valido: positivo, massimo 6 decimali'; END IF;
 PERFORM artecna_guardie.verifica_riga_economia_rapportino(l,true);
 UPDATE public.economia_righe SET prezzo_unitario=p_prezzo_cliente,prezzo_cliente_confermato_at=clock_timestamp(),updated_at=now() WHERE id=l.id AND raccolta_id=r.id RETURNING * INTO l;
 UPDATE public.economia_raccolte SET revisione=revisione+1,updated_at=now() WHERE id=r.id RETURNING * INTO r;
 RETURN jsonb_build_object('raccolta',to_jsonb(r),'riga',to_jsonb(l),'totale_riga',round(l.quantita*l.prezzo_unitario,2));
END $function$
;
ALTER FUNCTION public.valorizza_manodopera_economia(uuid,numeric,bigint) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.leggi_tariffe_manodopera_economia()
 RETURNS TABLE(prezzo numeric, ultima_conferma timestamp with time zone, numero_utilizzi bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE uid uuid;
BEGIN
 uid:=artecna_guardie.utente_jwt_corrente();
 IF uid IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Utente non autenticato'; END IF;
 RETURN QUERY SELECT l.prezzo_unitario,max(l.prezzo_cliente_confermato_at),count(*)
 FROM public.economia_righe l JOIN public.economia_raccolte r ON r.id=l.raccolta_id
 WHERE l.prezzo_cliente_confermato_at IS NOT NULL AND l.prezzo_unitario IS NOT NULL
 AND l.origine='rapportino' AND l.tipo_riga='manodopera' AND l.unita_misura='h'
 AND artecna_guardie.utente_puo_modificare_cantiere(uid,r.cantiere_id) IS TRUE
 GROUP BY l.prezzo_unitario ORDER BY max(l.prezzo_cliente_confermato_at) DESC,l.prezzo_unitario;
END $function$
;
ALTER FUNCTION public.leggi_tariffe_manodopera_economia() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.quaderno_file_autorizzato(object_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
  select auth.uid() is not null
    and (storage.foldername(object_name))[1] = 'utenti'
    and (storage.foldername(object_name))[2] = auth.uid()::text
    and (storage.foldername(object_name))[3] = 'quaderni'
    and exists (select 1 from public.quaderno_progetti p
      where p.id::text = (storage.foldername(object_name))[4]
        and p.user_id = auth.uid());
$function$
;
ALTER FUNCTION public.quaderno_file_autorizzato(text) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.quaderno_copia_file_autorizzato(object_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
 select auth.uid() is not null and exists(select 1 from public.quaderno_richiami_sopralluogo r
  join lateral jsonb_array_elements(r.assets) a on a->>'storage_path'=object_name
  where r.user_id=auth.uid() and r.pulito_at is null and (r.stato in ('preparazione','annullato') or exists(select 1 from public.note_sopralluogo n where n.id=r.nota_id and n.user_id=r.user_id and n.sopralluogo_id=r.sopralluogo_id)));
$function$
;
ALTER FUNCTION public.quaderno_copia_file_autorizzato(text) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.quaderno_copia_file_scrivibile(object_name text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
 select public.quaderno_copia_file_autorizzato(object_name) and exists(select 1 from public.quaderno_richiami_sopralluogo r where r.id::text=(storage.foldername(object_name))[4] and r.user_id=auth.uid() and r.stato='preparazione');
$function$
;
ALTER FUNCTION public.quaderno_copia_file_scrivibile(text) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_distruzione.inizia_contesto(p_cantiere uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
 SET row_security TO 'off'
AS $function$
  DECLARE u uuid := artecna_guardie.utente_jwt_corrente();
  BEGIN
    IF u IS NULL OR p_cantiere IS NULL THEN RAISE EXCEPTION 'Identita owner obbligatoria'; END IF;
    PERFORM 1 FROM public.cantieri WHERE id=p_cantiere FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Cantiere assente'; END IF;
    PERFORM 1 FROM public.utenti_cantiere WHERE cantiere_id=p_cantiere AND user_id=u AND ruolo='owner' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Owner non autorizzato'; END IF;
    -- Solo lock e SELECT prima della prima mutazione del contesto.
    LOCK TABLE public.variante_fonti_memory,public.variante_fonti_visive,public.variante_osservatore_analisi,artecna_rapportini.allegati,artecna_rapportini.richieste,public.acconti_cantiere,public.attrezzi_cantiere,public.cantieri,public.economia_raccolte,public.economia_righe,public.economia_sorgenti,public.fatture_emesse,public.fatture_fornitori_righe,public.foto_cantiere,public.incassi_non_fatturati,public.materiali_cantiere,public.pagamenti_fornitori,public.preventivi_cantiere,public.preventivo_lavorazioni,public.rapportini,public.rapportino_materiali,public.rapportino_prestazioni,public.sal_lavorazioni,public.timbrature,public.utenti_cantiere,public.variante_documenti,public.variante_lavorazioni,public.variante_sorgenti,public.varianti_cantiere IN ROW EXCLUSIVE MODE;
    PERFORM id FROM public.rapportini WHERE cantiere_id=p_cantiere ORDER BY id FOR UPDATE;
    PERFORM id FROM public.varianti_cantiere WHERE cantiere_id=p_cantiere ORDER BY id FOR UPDATE;
    PERFORM id FROM public.economia_raccolte WHERE cantiere_id=p_cantiere ORDER BY id FOR UPDATE;
    IF (SELECT coalesce(jsonb_agg(jsonb_build_object('child',cn.nspname||'.'||c.relname,'name',k.conname,
'columns',(SELECT jsonb_agg(a.attname ORDER BY x.ord) FROM unnest(k.conkey) WITH ORDINALITY x(num,ord) JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=x.num),
'parent',pn.nspname||'.'||p.relname,'keys',(SELECT jsonb_agg(a.attname ORDER BY x.ord) FROM unnest(k.confkey) WITH ORDINALITY x(num,ord) JOIN pg_attribute a ON a.attrelid=k.confrelid AND a.attnum=x.num),
'del',CASE k.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END,
'upd',CASE k.confupdtype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE' WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END,
'match',k.confmatchtype,'valid',k.convalidated,'defer',k.condeferrable,'deferred',k.condeferred)
ORDER BY (cn.nspname||'.'||c.relname||'.'||k.conname) COLLATE "C"),'[]'::jsonb)
FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace cn ON cn.oid=c.relnamespace JOIN pg_class p ON p.oid=k.confrelid JOIN pg_namespace pn ON pn.oid=p.relnamespace
WHERE k.contype='f' AND pn.nspname='public' AND p.relname=ANY(ARRAY['cantieri','rapportini','foto_cantiere','timbrature','materiali_cantiere','attrezzi_cantiere','pagamenti_fornitori','acconti_cantiere','fatture_emesse','fatture_fornitori_righe','incassi_non_fatturati','sal_lavorazioni','preventivo_lavorazioni','preventivi_cantiere','varianti_cantiere','utenti_cantiere','variante_lavorazioni','variante_documenti','variante_sorgenti','economia_raccolte','economia_sorgenti','economia_righe'])) IS DISTINCT FROM $inventory$[{"child":"artecna_rapportini.allegati","name":"allegati_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"artecna_rapportini.allegati","name":"allegati_foto_cantiere_id_fkey","columns":["foto_cantiere_id"],"parent":"public.foto_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"artecna_rapportini.allegati","name":"allegati_rapportino_id_fkey","columns":["rapportino_id"],"parent":"public.rapportini","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"artecna_rapportini.richieste","name":"richieste_rapportino_id_fkey","columns":["rapportino_id"],"parent":"public.rapportini","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.acconti_cantiere","name":"acconti_cantiere_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.attrezzi_cantiere","name":"attrezzi_cantiere_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.cantieri","name":"cantieri_preventivo_contrattuale_id_fkey","columns":["preventivo_contrattuale_id"],"parent":"public.preventivi_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.economia_raccolte","name":"economia_raccolte_cantiere_fk","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.economia_righe","name":"economia_righe_fattura_riga_fk","columns":["fattura_riga_id"],"parent":"public.fatture_fornitori_righe","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.economia_righe","name":"economia_righe_raccolta_fk","columns":["raccolta_id"],"parent":"public.economia_raccolte","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.economia_righe","name":"economia_righe_sorgente_fk","columns":["sorgente_id","raccolta_id"],"parent":"public.economia_sorgenti","keys":["id","raccolta_id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.economia_sorgenti","name":"economia_sorgenti_raccolta_fk","columns":["raccolta_id"],"parent":"public.economia_raccolte","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.fatture_emesse","name":"fatture_emesse_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.fatture_fornitori_righe","name":"fatture_fornitori_righe_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.fornitori_rettifiche","name":"fornitori_rettifiche_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.fornitori_rettifiche","name":"fornitori_rettifiche_economia_riga_id_fkey","columns":["economia_riga_id"],"parent":"public.economia_righe","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.fornitori_rettifiche","name":"fornitori_rettifiche_materiale_cantiere_id_fkey","columns":["materiale_cantiere_id"],"parent":"public.materiali_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.fornitori_rettifiche","name":"fornitori_rettifiche_nota_riga_id_fkey","columns":["nota_riga_id"],"parent":"public.fatture_fornitori_righe","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.fornitori_rettifiche","name":"fornitori_rettifiche_origine_riga_id_fkey","columns":["origine_riga_id"],"parent":"public.fatture_fornitori_righe","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.foto_cantiere","name":"foto_cantiere_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.incassi_non_fatturati","name":"incassi_non_fatturati_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.materiali_cantiere","name":"materiali_cantiere_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.materiali_cantiere","name":"materiali_cantiere_fattura_riga_fk","columns":["fattura_riga_id"],"parent":"public.fatture_fornitori_righe","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.materiali_impresa","name":"materiali_impresa_fattura_riga_id_fkey","columns":["fattura_riga_id"],"parent":"public.fatture_fornitori_righe","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.pagamenti_fornitori","name":"pagamenti_fornitori_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.preventivi_cantiere","name":"preventivi_cantiere_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.preventivi_cantiere","name":"preventivi_cantiere_preventivo_contrattuale_id_fkey","columns":["preventivo_contrattuale_id"],"parent":"public.preventivi_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.preventivi_cantiere","name":"preventivi_cantiere_variante_id_fkey","columns":["variante_id"],"parent":"public.varianti_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.preventivo_lavorazioni","name":"preventivo_lavorazioni_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.preventivo_lavorazioni","name":"preventivo_lavorazioni_preventivo_id_fkey","columns":["preventivo_id"],"parent":"public.preventivi_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.rapportini","name":"rapportini_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.rapportino_materiali","name":"rapportino_materiali_rapportino_fk","columns":["rapportino_id"],"parent":"public.rapportini","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.rapportino_prestazioni","name":"rapportino_prestazioni_rapportino_id_fkey","columns":["rapportino_id"],"parent":"public.rapportini","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.rapportino_prestazioni","name":"rapportino_prestazioni_variante_id_fkey","columns":["variante_id"],"parent":"public.varianti_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.sal_lavorazioni","name":"sal_lavorazioni_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.sal_lavorazioni","name":"sal_lavorazioni_source_lavorazione_id_fkey","columns":["source_lavorazione_id"],"parent":"public.preventivo_lavorazioni","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.sal_lavorazioni","name":"sal_lavorazioni_variante_source_fk","columns":["source_variante_lavorazione_id"],"parent":"public.variante_lavorazioni","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.timbrature","name":"timbrature_cantiere_id_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"NO ACTION","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.utenti_cantiere","name":"utenti_cantiere_cantiere_fkey","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"CASCADE","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_documenti","name":"variante_documenti_variante_fk","columns":["variante_id"],"parent":"public.varianti_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_fonti_memory","name":"variante_fonti_memory_variante_id_fkey","columns":["variante_id"],"parent":"public.varianti_cantiere","keys":["id"],"del":"CASCADE","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_fonti_visive","name":"variante_fonti_visive_foto_cantiere_id_fkey","columns":["foto_cantiere_id"],"parent":"public.foto_cantiere","keys":["id"],"del":"CASCADE","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_fonti_visive","name":"variante_fonti_visive_variante_id_fkey","columns":["variante_id"],"parent":"public.varianti_cantiere","keys":["id"],"del":"CASCADE","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_lavorazioni","name":"variante_lavorazioni_precedente_fk","columns":["riferimento_variante_lavorazione_id"],"parent":"public.variante_lavorazioni","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_lavorazioni","name":"variante_lavorazioni_preventivo_fk","columns":["riferimento_preventivo_lavorazione_id"],"parent":"public.preventivo_lavorazioni","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_lavorazioni","name":"variante_lavorazioni_sorgente_fk","columns":["variante_sorgente_id"],"parent":"public.variante_sorgenti","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_lavorazioni","name":"variante_lavorazioni_variante_fk","columns":["variante_id"],"parent":"public.varianti_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_osservatore_analisi","name":"variante_osservatore_analisi_variante_id_fkey","columns":["variante_id"],"parent":"public.varianti_cantiere","keys":["id"],"del":"CASCADE","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_sorgenti","name":"variante_sorgenti_economia_raccolta_fk","columns":["economia_raccolta_id"],"parent":"public.economia_raccolte","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_sorgenti","name":"variante_sorgenti_preventivo_fk","columns":["preventivo_sorgente_id"],"parent":"public.preventivi_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.variante_sorgenti","name":"variante_sorgenti_variante_fk","columns":["variante_id"],"parent":"public.varianti_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.varianti_cantiere","name":"varianti_cantiere_cantiere_fk","columns":["cantiere_id"],"parent":"public.cantieri","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false},{"child":"public.varianti_cantiere","name":"varianti_cantiere_contratto_fk","columns":["preventivo_contrattuale_id"],"parent":"public.preventivi_cantiere","keys":["id"],"del":"RESTRICT","upd":"NO ACTION","match":"s","valid":true,"defer":false,"deferred":false}]$inventory$::jsonb THEN
      RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='Inventario FK distruzione F3C3.3 divergente'; END IF;
    -- TD04: rettifiche immutabili, mai appartenenti al manifest distruttivo.
    -- Tutti i riferimenti sono UUID: nessun confronto su nomi legacy.
    -- Anche la fonte di una quota Impresa può essere associata a questo Cantiere.
    IF EXISTS (
      SELECT 1 FROM public.fornitori_rettifiche x
      LEFT JOIN public.economia_righe e ON e.id=x.economia_riga_id
      LEFT JOIN public.economia_raccolte r ON r.id=e.raccolta_id
      LEFT JOIN public.materiali_cantiere m ON m.id=x.materiale_cantiere_id
      LEFT JOIN public.fatture_fornitori_righe n ON n.id=x.nota_riga_id
      LEFT JOIN public.fatture_fornitori_righe o ON o.id=x.origine_riga_id
      WHERE x.cantiere_id=p_cantiere OR r.cantiere_id=p_cantiere
         OR m.cantiere_id=p_cantiere OR n.cantiere_id=p_cantiere OR o.cantiere_id=p_cantiere
    ) THEN
      RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='Storico rettifiche TD04 presente: eliminazione Cantiere non consentita';
    END IF;
    IF EXISTS(SELECT 1 FROM artecna_rapportini.allegati a LEFT JOIN public.rapportini r ON r.id=a.rapportino_id LEFT JOIN public.foto_cantiere f ON f.id=a.foto_cantiere_id WHERE a.cantiere_id=p_cantiere OR r.cantiere_id=p_cantiere OR f.cantiere_id=p_cantiere)
      OR EXISTS(SELECT 1 FROM public.foto_cantiere f LEFT JOIN public.rapportini r ON r.id::text=f.rapportino_id WHERE f.allegato_v1_id IS NOT NULL AND (f.cantiere_id=p_cantiere OR r.cantiere_id=p_cantiere))
      OR EXISTS(SELECT 1 FROM public.rapportini WHERE cantiere_id=p_cantiere AND (versione_prestazioni<>0 OR versione_materiali<>0))
      OR EXISTS(SELECT 1 FROM public.rapportino_prestazioni p JOIN public.rapportini r ON r.id=p.rapportino_id LEFT JOIN public.varianti_cantiere v ON v.id=p.variante_id WHERE r.cantiere_id=p_cantiere OR v.cantiere_id=p_cantiere)
      OR EXISTS(SELECT 1 FROM public.rapportino_materiali m JOIN public.rapportini r ON r.id=m.rapportino_id WHERE r.cantiere_id=p_cantiere)
      OR EXISTS(SELECT 1 FROM artecna_rapportini.richieste q JOIN public.rapportini r ON r.id=q.rapportino_id WHERE r.cantiere_id=p_cantiere)
      OR EXISTS(SELECT 1 FROM public.variante_sorgenti s LEFT JOIN public.varianti_cantiere v ON v.id=s.variante_id LEFT JOIN public.economia_raccolte e ON e.id=s.economia_raccolta_id WHERE s.economia_raccolta_id IS NOT NULL AND (v.cantiere_id=p_cantiere OR e.cantiere_id=p_cantiere)) THEN
      RAISE EXCEPTION USING ERRCODE='P2131',MESSAGE='Cantiere con dipendenze strutturate protette: eliminazione non disponibile'; END IF;
    -- Cleanup di residui ormai inutilizzabili dello stesso backend. Nessun dato applicativo.
    DELETE FROM artecna_distruzione.contesto WHERE backend=pg_backend_pid() AND transazione<>pg_current_xact_id();
    INSERT INTO artecna_distruzione.contesto(transazione,backend,cantiere_id,user_id,ruolo)
      VALUES(pg_current_xact_id(),pg_backend_pid(),p_cantiere,u,'artecna_cantieri_delete_rpc');
    -- La PK vieta un secondo target nella stessa transazione/backend.
  END;
  $function$
;
ALTER FUNCTION artecna_distruzione.inizia_contesto(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_distruzione.contesto_valido(p_cantiere uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
 SET row_security TO 'off'
AS $function$
    SELECT EXISTS (SELECT 1 FROM artecna_distruzione.contesto c
      WHERE c.transazione=pg_current_xact_id_if_assigned() AND c.backend=pg_backend_pid()
        AND c.cantiere_id=p_cantiere AND c.ruolo='artecna_cantieri_delete_rpc'
        AND c.user_id=artecna_guardie.utente_jwt_corrente()
        AND EXISTS (SELECT 1 FROM public.utenti_cantiere u
          WHERE u.cantiere_id=c.cantiere_id AND u.user_id=c.user_id AND u.ruolo='owner'));
  $function$
;
ALTER FUNCTION artecna_distruzione.contesto_valido(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_distruzione.contesto_variante_valido(p_variante uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
 SET row_security TO 'off'
AS $function$
  DECLARE c uuid;
  BEGIN
    SELECT cantiere_id INTO c FROM public.varianti_cantiere WHERE id=p_variante FOR UPDATE;
    IF NOT FOUND THEN RETURN false; END IF;
    RETURN artecna_distruzione.contesto_valido(c);
  END;
  $function$
;
ALTER FUNCTION artecna_distruzione.contesto_variante_valido(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_distruzione.termina_contesto()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
 SET row_security TO 'off'
AS $function$
    DELETE FROM artecna_distruzione.contesto
      WHERE transazione=pg_current_xact_id_if_assigned() AND backend=pg_backend_pid()
        AND user_id=artecna_guardie.utente_jwt_corrente();
  $function$
;
ALTER FUNCTION artecna_distruzione.termina_contesto() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_distruzione.manifest_cantiere(p_cantiere uuid)
 RETURNS TABLE(entita text, quantita bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
 SET row_security TO 'off'
AS $function$
  BEGIN
    IF NOT artecna_distruzione.contesto_valido(p_cantiere) THEN RAISE EXCEPTION 'Contesto cantiere non valido'; END IF;
    RETURN QUERY
    SELECT q.entita,q.quantita FROM (
SELECT 'rapportini'::text, count(*)::bigint FROM public.rapportini WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'foto_cantiere'::text, count(*)::bigint FROM public.foto_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'timbrature'::text, count(*)::bigint FROM public.timbrature WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'materiali_cantiere'::text, count(*)::bigint FROM public.materiali_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'attrezzi_cantiere'::text, count(*)::bigint FROM public.attrezzi_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'pagamenti_fornitori'::text, count(*)::bigint FROM public.pagamenti_fornitori WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'acconti_cantiere'::text, count(*)::bigint FROM public.acconti_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'fatture_emesse'::text, count(*)::bigint FROM public.fatture_emesse WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'fatture_fornitori_righe'::text, count(*)::bigint FROM public.fatture_fornitori_righe WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'incassi_non_fatturati'::text, count(*)::bigint FROM public.incassi_non_fatturati WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'sal_lavorazioni'::text, count(*)::bigint FROM public.sal_lavorazioni WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'preventivo_lavorazioni'::text, count(*)::bigint FROM public.preventivo_lavorazioni WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'preventivi_cantiere'::text, count(*)::bigint FROM public.preventivi_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'varianti_cantiere'::text, count(*)::bigint FROM public.varianti_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'utenti_cantiere'::text, count(*)::bigint FROM public.utenti_cantiere WHERE cantiere_id=p_cantiere
UNION ALL
SELECT 'cantieri'::text, count(*)::bigint FROM public.cantieri WHERE id=p_cantiere
UNION ALL
SELECT 'variante_lavorazioni'::text, count(*)::bigint FROM public.variante_lavorazioni f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere
UNION ALL
SELECT 'variante_documenti'::text, count(*)::bigint FROM public.variante_documenti f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere
UNION ALL
SELECT 'variante_sorgenti'::text, count(*)::bigint FROM public.variante_sorgenti f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere
UNION ALL
SELECT 'economia_raccolte'::text,count(*)::bigint FROM public.economia_raccolte e WHERE e.cantiere_id=p_cantiere
UNION ALL
SELECT 'economia_sorgenti'::text,count(*)::bigint FROM public.economia_sorgenti e JOIN public.economia_raccolte r ON r.id=e.raccolta_id WHERE r.cantiere_id=p_cantiere
UNION ALL
SELECT 'economia_righe'::text,count(*)::bigint FROM public.economia_righe e JOIN public.economia_raccolte r ON r.id=e.raccolta_id WHERE r.cantiere_id=p_cantiere
UNION ALL
SELECT 'variante_lavorazioni_con_riferimento_variante'::text, count(*)::bigint FROM public.variante_lavorazioni f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere AND f.riferimento_variante_lavorazione_id IS NOT NULL
UNION ALL
SELECT 'sal_lavorazioni_con_source_lavorazione_id'::text, count(*)::bigint FROM public.sal_lavorazioni WHERE cantiere_id=p_cantiere AND source_lavorazione_id IS NOT NULL
UNION ALL
SELECT 'sal_lavorazioni_con_source_variante_lavorazione_id'::text, count(*)::bigint FROM public.sal_lavorazioni WHERE cantiere_id=p_cantiere AND source_variante_lavorazione_id IS NOT NULL
UNION ALL
SELECT 'variante_fonti_memory'::text,count(*)::bigint FROM public.variante_fonti_memory f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere
UNION ALL
SELECT 'variante_fonti_visive'::text,count(*)::bigint FROM public.variante_fonti_visive f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere
UNION ALL
SELECT 'variante_osservatore_analisi'::text,count(*)::bigint FROM public.variante_osservatore_analisi f JOIN public.varianti_cantiere v ON v.id=f.variante_id WHERE v.cantiere_id=p_cantiere
    ) AS q(entita,quantita) ORDER BY q.entita;
  END;
  $function$
;
ALTER FUNCTION artecna_distruzione.manifest_cantiere(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_distruzione.prepara_cleanup_storage(p_cantiere uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
 SET row_security TO 'off'
AS $function$
  DECLARE v_inserite bigint;
  BEGIN
    IF NOT artecna_distruzione.contesto_valido(p_cantiere) THEN RAISE EXCEPTION 'Contesto cantiere non valido'; END IF;
    WITH riferimenti(path) AS (
      SELECT file_path::text FROM public.preventivi_cantiere WHERE cantiere_id=p_cantiere
      UNION ALL SELECT file_path::text FROM public.foto_cantiere WHERE cantiere_id=p_cantiere
      UNION ALL SELECT file_path::text FROM public.materiali_cantiere WHERE cantiere_id=p_cantiere
      UNION ALL SELECT file_path::text FROM public.attrezzi_cantiere WHERE cantiere_id=p_cantiere
      UNION ALL SELECT d.storage_path::text FROM public.variante_documenti d
        JOIN public.varianti_cantiere v ON v.id=d.variante_id WHERE v.cantiere_id=p_cantiere
    ), inserite AS (
      INSERT INTO artecna_distruzione.cleanup_storage(cantiere_id,bucket,path)
      SELECT DISTINCT p_cantiere,'preventivi',r.path FROM riferimenti r
        WHERE r.path IS NOT NULL AND btrim(r.path)<>''
      ON CONFLICT ON CONSTRAINT cleanup_storage_identita DO NOTHING
      RETURNING id
    ) SELECT count(*) INTO v_inserite FROM inserite;
    RETURN v_inserite;
  END;
  $function$
;
ALTER FUNCTION artecna_distruzione.prepara_cleanup_storage(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_distruzione.impronta_cleanup_storage(p_cantiere uuid, p_limite bigint)
 RETURNS TABLE(totale bigint, max_id bigint, impronta text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
 SET row_security TO 'off'
AS $function$
  BEGIN
    IF artecna_distruzione.contesto_valido(p_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Contesto non valido per outbox'; END IF;
    PERFORM j.id FROM artecna_distruzione.cleanup_storage j
      WHERE j.cantiere_id=p_cantiere AND (p_limite IS NULL OR j.id<=p_limite) ORDER BY j.id FOR SHARE;
    RETURN QUERY SELECT count(*)::bigint,coalesce(max(j.id),0)::bigint,
      encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(j) ORDER BY j.id)::text,'[]'),'UTF8')),'hex')
      FROM artecna_distruzione.cleanup_storage j WHERE j.cantiere_id=p_cantiere AND (p_limite IS NULL OR j.id<=p_limite);
  END;
  $function$
;
ALTER FUNCTION artecna_distruzione.impronta_cleanup_storage(uuid,bigint) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_rapportini.compat_foto_fk_allegati(p_oid oid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE k record; v_col text; v_target regclass;
BEGIN
 -- TD04: punto di compatibilità FK esterne usato dal cleanup, non dal portale.
 -- Solo il nuovo helper privato certifica struttura esatta e contesto attivo.
 IF EXISTS(SELECT 1 FROM pg_constraint WHERE oid=p_oid
   AND conrelid=to_regclass('public.fornitori_rettifiche')) THEN
   RETURN artecna_distruzione.fk_rettifiche_td04_certificata(p_oid);
 END IF;
 SELECT * INTO k FROM pg_constraint WHERE oid=p_oid;
 IF NOT FOUND OR k.conrelid<>'artecna_rapportini.allegati'::regclass THEN RETURN false; END IF;
 CASE k.conname
 WHEN 'allegati_cantiere_id_fkey' THEN v_col:='cantiere_id';v_target:='public.cantieri'::regclass;
 WHEN 'allegati_rapportino_id_fkey' THEN v_col:='rapportino_id';v_target:='public.rapportini'::regclass;
 WHEN 'allegati_foto_cantiere_id_fkey' THEN v_col:='foto_cantiere_id';v_target:='public.foto_cantiere'::regclass;
 ELSE RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='FK Allegati non certificata';
 END CASE;
 IF k.contype<>'f' OR NOT k.convalidated OR k.condeferrable OR k.condeferred OR k.confrelid<>v_target
  OR k.confdeltype<>'r' OR k.confupdtype<>'a' OR k.confmatchtype<>'s'
  OR k.conkey IS DISTINCT FROM ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=k.conrelid AND attname=v_col)]::smallint[]
  OR k.confkey IS DISTINCT FROM ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=v_target AND attname='id')]::smallint[] THEN
  RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='FK Allegati divergente'; END IF;
 RETURN true;
END;
$function$
;
ALTER FUNCTION artecna_rapportini.compat_foto_fk_allegati(oid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_rapportini.compat_foto_verifica_cantiere(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE v_count integer; k record;
BEGIN
 v_count:=0;
 FOR k IN SELECT oid FROM pg_constraint WHERE conrelid='artecna_rapportini.allegati'::regclass AND contype='f' LOOP
  PERFORM artecna_rapportini.compat_foto_fk_allegati(k.oid);v_count:=v_count+1;
 END LOOP;
 IF v_count<>3 THEN RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='Inventario FK Allegati divergente'; END IF;
 IF EXISTS(SELECT 1 FROM artecna_rapportini.allegati a LEFT JOIN public.rapportini r ON r.id=a.rapportino_id
    LEFT JOIN public.foto_cantiere f ON f.id=a.foto_cantiere_id
    WHERE a.cantiere_id=p_id OR r.cantiere_id=p_id OR f.cantiere_id=p_id)
  OR EXISTS(SELECT 1 FROM public.foto_cantiere WHERE cantiere_id=p_id AND allegato_v1_id IS NOT NULL) THEN
  RAISE EXCEPTION USING ERRCODE='P2131',MESSAGE='Il cantiere contiene foto Rapportino V1 o Allegati. Eliminazione non disponibile.';
 END IF;
END;
$function$
;
ALTER FUNCTION artecna_rapportini.compat_foto_verifica_cantiere(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_distruzione.numero_fk_economia_rapportino()
 RETURNS integer
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE k pg_constraint%rowtype; n integer;
BEGIN
 SELECT count(*) INTO n FROM pg_attribute WHERE attrelid='public.economia_righe'::regclass AND NOT attisdropped AND attname IN ('rapportino_prestazione_id','prestazione_revisione_acquisita','prestazione_snapshot');
 SELECT * INTO k FROM pg_constraint WHERE conrelid='public.economia_righe'::regclass AND conname='economia_righe_prestazione_fk';
 IF NOT FOUND THEN
  IF n<>0 THEN RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='E4.1 FK Economia mancante'; END IF;
  RETURN 0;
 END IF;
 IF n<>3 OR k.contype<>'f' OR k.confrelid<>'public.rapportino_prestazioni'::regclass
 OR k.conkey IS DISTINCT FROM ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=k.conrelid AND attname='rapportino_prestazione_id' AND atttypid='uuid'::regtype AND NOT attisdropped)]::smallint[]
 OR k.confkey IS DISTINCT FROM ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=k.confrelid AND attname='id' AND atttypid='uuid'::regtype AND attnotnull AND NOT attisdropped)]::smallint[]
 OR k.confdeltype<>'r' OR k.confupdtype<>'a' OR k.confmatchtype<>'s' OR NOT k.convalidated OR k.condeferrable OR k.condeferred
 OR NOT EXISTS(SELECT 1 FROM pg_constraint u WHERE u.conrelid=k.conrelid AND u.conname='economia_righe_prestazione_unique' AND u.contype='u' AND u.conkey=k.conkey AND NOT u.condeferrable)
 OR EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=k.conrelid AND NOT a.attisdropped AND
  ((a.attname='prestazione_revisione_acquisita' AND a.atttypid<>'bigint'::regtype) OR (a.attname='prestazione_snapshot' AND a.atttypid<>'jsonb'::regtype)))
 THEN RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='E4.1 FK Economia divergente'; END IF;
 RETURN 1;
END;$function$
;
ALTER FUNCTION artecna_distruzione.numero_fk_economia_rapportino() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.materiali_fattura_totale(p_riga uuid)
 RETURNS numeric
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
 SELECT coalesce((SELECT sum(e.quantita) FROM public.economia_righe e WHERE e.fattura_riga_id=p_riga),0)
      + coalesce((SELECT sum(m.quantita) FROM public.materiali_cantiere m WHERE m.fattura_riga_id=p_riga),0)
      + coalesce((SELECT sum(i.quantita) FROM public.materiali_impresa i WHERE i.fattura_riga_id=p_riga),0)
$function$
;
ALTER FUNCTION artecna_guardie.materiali_fattura_totale(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.economia_oggetto_analitico(p_v jsonb, p_keys text[])
 RETURNS void
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
  IF p_v IS NULL OR jsonb_typeof(p_v)<>'object'
    OR NOT (p_v ?& p_keys)
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_v) k WHERE NOT (k=ANY(p_keys))) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Struttura dettagli Economia non valida';
  END IF;
END;
$function$
;
ALTER FUNCTION public.economia_oggetto_analitico(jsonb,text[]) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.economia_numero_sorgente(p_cella jsonb)
 RETURNS numeric
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE v text;
BEGIN
  v:=p_cella->>'valore';
  IF v IS NULL OR v='' THEN RETURN NULL; END IF;
  IF p_cella->>'tipo'<>'n' OR v !~ '^[+-]?[0-9]+([.][0-9]+)?([eE][+-]?[0-9]+)?$' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Numero Excel originale non valido';
  END IF;
  RETURN v::numeric;
EXCEPTION WHEN numeric_value_out_of_range OR invalid_text_representation THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Numero Excel fuori intervallo';
END;
$function$
;
ALTER FUNCTION public.economia_numero_sorgente(jsonb) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.economia_valida_dettagli(p_tipo text, p_d jsonb, p_snapshot jsonb, p_snapshot_version integer, p_indice integer, p_q numeric, p_p numeric, p_um text, p_descrizione text, p_chiusura boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  src jsonb; op jsonb; norm jsonb; celle jsonb; cella jsonb; voce jsonb;
  campi text[]; colonne text[]; opkeys text[]; foglio text; riga integer;
  k text; c text; i integer; grezzo numeric; valore numeric; q0 numeric; p0 numeric; t0 numeric;
  ws jsonb:='[]'::jsonb; wo jsonb:='[]'::jsonb; warning jsonb;
  data_src date; ref_src text; parts text[]; inizio numeric; fine numeric; pausa numeric; ore numeric;
BEGIN
  IF p_tipo='generica' THEN
    IF p_d IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riga generica con dettagli analitici'; END IF;
    RETURN NULL;
  END IF;
  IF p_tipo IS NULL OR p_tipo NOT IN ('manodopera','materiale') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Tipo riga Economia non valido';
  END IF;
  PERFORM public.economia_oggetto_analitico(p_d,ARRAY['version','sorgente','operativo','normalizzazione','warnings']);
  IF p_d->'version' IS DISTINCT FROM '1'::jsonb THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Versione dettagli non supportata'; END IF;
  src:=p_d->'sorgente'; op:=p_d->'operativo'; norm:=p_d->'normalizzazione';
  PERFORM public.economia_oggetto_analitico(p_d->'warnings',ARRAY['sorgente','operativo']);
  IF jsonb_typeof(p_d->'warnings'->'sorgente')<>'array' OR jsonb_typeof(p_d->'warnings'->'operativo')<>'array' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Struttura warnings non valida';
  END IF;
  IF p_tipo='manodopera' THEN
    foglio:='Manodopera economia';
    campi:=ARRAY['cantiere','codice_variante','data','operaio','qualifica','ora_inizio','ora_fine','pausa_min','ore_dichiarate','tariffa_dichiarata','totale_dichiarato','riferimento','note'];
    colonne:=ARRAY['A','B','C','D','E','F','G','H','I','J','K','L','M'];
    opkeys:=ARRAY['cantiere_dichiarato','codice_variante','data','operaio','qualifica','ora_inizio','ora_fine','pausa_min','riferimento'];
  ELSE
    foglio:='Materiali economia';
    campi:=ARRAY['cantiere','codice_variante','data','materiale','um','quantita_dichiarata','prezzo_dichiarato','totale_dichiarato','fornitore','documento','riferimento_rapportino','note'];
    colonne:=ARRAY['A','B','C','D','E','F','G','H','I','J','K','L'];
    opkeys:=ARRAY['cantiere_dichiarato','codice_variante','data','fornitore','documento','riferimento_rapportino'];
  END IF;
  PERFORM public.economia_oggetto_analitico(src,ARRAY['foglio_sorgente','riga_sorgente']||campi);
  IF src->>'foglio_sorgente' IS DISTINCT FROM foglio OR jsonb_typeof(src->'riga_sorgente')<>'number'
     OR src->>'riga_sorgente' !~ '^[0-9]+$' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Foglio/riga sorgente non validi'; END IF;
  riga:=(src->>'riga_sorgente')::integer;
  IF riga<(CASE WHEN p_tipo='manodopera' THEN 6 ELSE 5 END) OR riga>1048576
    OR p_indice IS DISTINCT FROM 2*(riga-1)+(CASE WHEN p_tipo='materiale' THEN 1 ELSE 0 END) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Indice sorgente analitico incoerente';
  END IF;
  IF p_snapshot_version IS DISTINCT FROM 2 OR p_snapshot->'version' IS DISTINCT FROM '2'::jsonb
    OR p_snapshot->>'template' IS DISTINCT FROM 'ARTECNA_Template_Import_Varianti_Extra_v2'
    OR jsonb_typeof(p_snapshot->'date1904') IS DISTINCT FROM 'boolean'
    OR jsonb_typeof(p_snapshot->'fogli'->'Manodopera economia') IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_snapshot->'fogli'->'Materiali economia') IS DISTINCT FROM 'object'
    OR (p_snapshot->'fogli'->'Manodopera economia'->>'riga_intestazioni') IS DISTINCT FROM '5'
    OR (p_snapshot->'fogli'->'Materiali economia'->>'riga_intestazioni') IS DISTINCT FROM '4' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Snapshot analitico v2 non valido';
  END IF;
  voce:=p_snapshot->'fogli'->foglio->'righe'->riga::text;
  PERFORM public.economia_oggetto_analitico(voce,ARRAY['celle','warnings']);
  IF jsonb_typeof(voce->'warnings')<>'array' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Warnings sorgente non validi'; END IF;
  celle:=voce->'celle';
  IF jsonb_typeof(celle) IS DISTINCT FROM 'object' OR (SELECT count(*) FROM jsonb_object_keys(celle))<>array_length(campi,1) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Celle sorgente incomplete';
  END IF;
  FOR i IN 1..array_length(campi,1) LOOP
    c:=colonne[i]||riga::text;
    IF src->>campi[i] IS DISTINCT FROM c THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Coordinate sorgente alterate'; END IF;
    cella:=celle->c;
    PERFORM public.economia_oggetto_analitico(cella,ARRAY['tipo','valore','formula','formato','visualizzato']);
    IF cella->>'tipo' NOT IN ('n','s','b','e','z') OR cella->>'tipo' IS NULL THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Tipo cella originale non valido';
    END IF;
    FOREACH k IN ARRAY ARRAY['valore','formula','formato','visualizzato'] LOOP
      IF jsonb_typeof(cella->k) NOT IN ('string','null') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Contenuto cella originale non valido'; END IF;
    END LOOP;
    IF cella->>'tipo'='e' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Errore Excel nella riga'; END IF;
  END LOOP;
  PERFORM public.economia_oggetto_analitico(op,opkeys);
  FOREACH k IN ARRAY opkeys LOOP
    IF k='pausa_min' THEN
      IF op->k<>'null'::jsonb AND (jsonb_typeof(op->k)<>'number' OR op->>k !~ '^[0-9]+$') THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Pausa operativa non valida';
      END IF;
    ELSIF jsonb_typeof(op->k) NOT IN ('string','null') OR (jsonb_typeof(op->k)='string' AND btrim(op->>k)='') THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Campo analitico operativo non valido';
    END IF;
  END LOOP;
  IF op->>'data' IS NOT NULL AND ((op->>'data') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     OR to_char((op->>'data')::date,'YYYY-MM-DD')<>op->>'data') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Data operativa non valida';
  END IF;
  IF p_tipo='manodopera' THEN
    FOREACH k IN ARRAY ARRAY['ora_inizio','ora_fine'] LOOP
      IF op->>k IS NOT NULL AND op->>k !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Orario operativo non valido';
      END IF;
    END LOOP;
    IF p_um IS DISTINCT FROM 'h' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='UM manodopera deve essere h'; END IF;
  END IF;
  IF p_q IS NULL OR p_q<=0 OR p_q::text IN ('NaN','Infinity','-Infinity') OR p_q<>round(p_q,2)
     OR (p_p IS NOT NULL AND (p_p<0 OR p_p::text IN ('NaN','Infinity','-Infinity') OR p_p<>round(p_p,2))) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Precisione analitica: richiesti due decimali';
  END IF;
  PERFORM public.economia_oggetto_analitico(norm,ARRAY['regola','quantita','prezzo_unitario']);
  IF norm->>'regola' IS DISTINCT FROM 'artecna_template_extra_v2_precisione_v1' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Regola normalizzazione non valida'; END IF;
  q0:=public.economia_numero_sorgente(celle->((CASE WHEN p_tipo='manodopera' THEN 'I' ELSE 'F' END)||riga));
  p0:=public.economia_numero_sorgente(celle->((CASE WHEN p_tipo='manodopera' THEN 'J' ELSE 'G' END)||riga));
  t0:=public.economia_numero_sorgente(celle->((CASE WHEN p_tipo='manodopera' THEN 'K' ELSE 'H' END)||riga));
  FOREACH k IN ARRAY ARRAY['quantita','prezzo_unitario'] LOOP
    PERFORM public.economia_oggetto_analitico(norm->k,ARRAY['decimali','origine','motivazione']);
    IF norm->k->'decimali' IS DISTINCT FROM '2'::jsonb OR norm->k->>'origine' IS NULL
       OR norm->k->>'origine' NOT IN ('sorgente','rettifica') OR jsonb_typeof(norm->k->'motivazione') NOT IN ('string','null') THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Traccia normalizzazione non valida';
    END IF;
    grezzo:=CASE WHEN k='quantita' THEN q0 ELSE p0 END;
    valore:=CASE WHEN k='quantita' THEN p_q ELSE p_p END;
    IF norm->k->>'origine'='sorgente' THEN
      IF valore IS DISTINCT FROM round(grezzo,2) OR norm->k->>'motivazione' IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Normalizzazione divergente dalla sorgente';
      END IF;
    ELSIF coalesce(btrim(norm->k->>'motivazione'),'')='' THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Rettifica richiede motivazione';
    END IF;
  END LOOP;
  -- Warnings autorevoli ricalcolati: il client non puÃ² cancellare le anomalie originali.
  IF p_tipo='manodopera' THEN
    IF coalesce(btrim(celle->('E'||riga)->>'valore'),'')='' THEN ws:=ws||jsonb_build_array(jsonb_build_object('codice','qualifica_mancante','campi',jsonb_build_array('qualifica'))); END IF;
    IF op->>'qualifica' IS NULL THEN wo:=wo||jsonb_build_array(jsonb_build_object('codice','qualifica_mancante','campi',jsonb_build_array('qualifica'))); END IF;
    inizio:=public.economia_numero_sorgente(celle->('F'||riga)); fine:=public.economia_numero_sorgente(celle->('G'||riga)); pausa:=public.economia_numero_sorgente(celle->('H'||riga));
    IF inizio IS NOT NULL AND fine IS NOT NULL AND pausa IS NOT NULL THEN
      inizio:=mod(round(mod(inizio,1)*1440,0),1440); fine:=mod(round(mod(fine,1)*1440,0),1440); pausa:=round(pausa,0);
      ore:=greatest(0,(mod(fine-inizio+1440,1440)-pausa)/60);
      IF round(q0,2) IS DISTINCT FROM round(ore,2) THEN ws:=ws||jsonb_build_array(jsonb_build_object('codice','ore_discordanti','campi',jsonb_build_array('ore_dichiarate'))); END IF;
      IF fine<inizio THEN ws:=ws||jsonb_build_array(jsonb_build_object('codice','passaggio_mezzanotte','campi',jsonb_build_array('ora_fine'))); END IF;
      IF pausa>mod(fine-inizio+1440,1440) OR ore<=0 THEN ws:=ws||jsonb_build_array(jsonb_build_object('codice','durata_non_valida','campi',jsonb_build_array('pausa_min'))); END IF;
    END IF;
    ref_src:=celle->('L'||riga)->>'valore';
  ELSE
    IF coalesce(btrim(celle->('D'||riga)->>'valore'),'')='' THEN ws:=ws||jsonb_build_array(jsonb_build_object('codice','materiale_mancante','campi',jsonb_build_array('materiale'))); END IF;
    ref_src:=celle->('K'||riga)->>'valore';
  END IF;
  IF q0 IS NOT NULL AND p0 IS NOT NULL AND t0 IS NOT NULL AND round(round(q0,2)*round(p0,2),2)<>round(t0,2) THEN
    ws:=ws||jsonb_build_array(jsonb_build_object('codice','totale_discordante','campi',jsonb_build_array('totale_dichiarato')));
  END IF;
  IF t0 IS NULL AND celle->((CASE WHEN p_tipo='manodopera' THEN 'K' ELSE 'H' END)||riga)->>'formula' IS NOT NULL THEN
    ws:=ws||jsonb_build_array(jsonb_build_object('codice','risultato_formula_mancante','campi',jsonb_build_array('totale_dichiarato')));
  END IF;
  grezzo:=public.economia_numero_sorgente(celle->('C'||riga));
  IF grezzo IS NOT NULL THEN
    data_src:=(CASE WHEN (p_snapshot->>'date1904')::boolean THEN date '1904-01-01'
      WHEN trunc(grezzo)<60 THEN date '1899-12-31' ELSE date '1899-12-30' END)+trunc(grezzo)::integer;
    parts:=regexp_match(ref_src,'([0-9]{2})/([0-9]{2})/([0-9]{4})');
    IF parts IS NOT NULL AND parts[3]||'-'||parts[2]||'-'||parts[1]<>to_char(data_src,'YYYY-MM-DD') THEN
      ws:=ws||jsonb_build_array(jsonb_build_object('codice','riferimento_data_discordante','campi',jsonb_build_array('data','riferimento')));
    END IF;
  END IF;
  -- Conserva anche warning originali non economici (parser/formati), con schema chiuso.
  FOR warning IN SELECT value FROM jsonb_array_elements(voce->'warnings') LOOP
    PERFORM public.economia_oggetto_analitico(warning,ARRAY['codice','campi']);
    IF jsonb_typeof(warning->'codice')<>'string' OR btrim(warning->>'codice')='' OR jsonb_typeof(warning->'campi')<>'array'
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(warning->'campi') a WHERE jsonb_typeof(a)<>'string') THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Warning originale non valido';
    END IF;
    IF NOT ws @> jsonb_build_array(warning) THEN ws:=ws||jsonb_build_array(warning); END IF;
  END LOOP;
  IF p_p IS NULL THEN wo:=wo||jsonb_build_array(jsonb_build_object('codice','prezzo_non_valorizzato','campi',jsonb_build_array('prezzo_unitario'))); END IF;
  FOREACH k IN ARRAY ARRAY['quantita','prezzo_unitario'] LOOP
    IF norm->k->>'origine'='rettifica' THEN wo:=wo||jsonb_build_array(jsonb_build_object('codice','rettifica_operativa','campi',jsonb_build_array(k))); END IF;
  END LOOP;
  IF p_tipo='manodopera' AND op->>'ora_inizio' IS NOT NULL AND op->>'ora_fine' IS NOT NULL AND op->>'pausa_min' IS NOT NULL THEN
    inizio:=split_part(op->>'ora_inizio',':',1)::integer*60+split_part(op->>'ora_inizio',':',2)::integer;
    fine:=split_part(op->>'ora_fine',':',1)::integer*60+split_part(op->>'ora_fine',':',2)::integer;
    pausa:=(op->>'pausa_min')::numeric;
    ore:=greatest(0,(mod(fine-inizio+1440,1440)-pausa)/60);
    IF p_q<>round(ore,2) THEN wo:=wo||jsonb_build_array(jsonb_build_object('codice','ore_discordanti','campi',jsonb_build_array('quantita'))); END IF;
    IF pausa>mod(fine-inizio+1440,1440) OR ore<=0 THEN wo:=wo||jsonb_build_array(jsonb_build_object('codice','durata_non_valida','campi',jsonb_build_array('pausa_min'))); END IF;
  END IF;
  IF p_chiusura AND (op->>'data' IS NULL OR (p_tipo='manodopera' AND
       (op->>'operaio' IS NULL OR op->>'ora_inizio' IS NULL OR op->>'ora_fine' IS NULL OR op->>'pausa_min' IS NULL))) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riga analitica incompleta per chiusura';
  END IF;
  IF coalesce(btrim(p_descrizione),'')='' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Descrizione operativa obbligatoria'; END IF;
  RETURN jsonb_set(p_d,'{warnings}',jsonb_build_object('sorgente',ws,'operativo',wo));
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow OR numeric_value_out_of_range OR invalid_text_representation THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Valore analitico non valido';
END;
$function$
;
ALTER FUNCTION public.economia_valida_dettagli(text,jsonb,jsonb,integer,integer,numeric,numeric,text,text,boolean) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.verifica_riga_economia_rapportino(er public.economia_righe, live boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE p public.rapportino_prestazioni%rowtype; r public.rapportini%rowtype; v public.varianti_cantiere%rowtype;
 cid uuid; snap jsonb;
BEGIN
 SELECT cantiere_id INTO cid FROM public.economia_raccolte WHERE id=er.raccolta_id;
 IF er.origine IS DISTINCT FROM 'rapportino' OR er.tipo_riga IS DISTINCT FROM 'manodopera'
  OR er.unita_misura IS DISTINCT FROM 'h' OR er.prestazione_snapshot->'version' IS DISTINCT FROM '1'::jsonb
  OR er.prestazione_snapshot->>'prestazione_id' IS DISTINCT FROM er.rapportino_prestazione_id::text
  OR er.prestazione_snapshot->>'cantiere_id' IS DISTINCT FROM cid::text
  OR er.prestazione_snapshot->>'revisione' IS DISTINCT FROM er.prestazione_revisione_acquisita::text
  OR (er.prestazione_snapshot->>'ore')::numeric IS DISTINCT FROM er.quantita
  OR er.dettagli_analitici IS DISTINCT FROM jsonb_build_object('version',1,'rapportino',er.prestazione_snapshot) THEN
  RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Provenienza Rapportino incoerente'; END IF;
 IF NOT live THEN RETURN; END IF;
 -- Il writer chiamante mantiene cantiere/membership/raccolta; il writer Mobile blocca testata prima della prestazione.
 SELECT rr.* INTO r FROM public.rapportini rr WHERE rr.id=(er.prestazione_snapshot->>'rapportino_id')::uuid FOR SHARE;
 SELECT pp.* INTO p FROM public.rapportino_prestazioni pp WHERE pp.id=er.rapportino_prestazione_id FOR SHARE;
 IF NOT FOUND OR p.rimossa_at IS NOT NULL OR NOT p.lavoro_in_economia OR r.id IS NULL
  OR r.versione_prestazioni IS DISTINCT FROM 1 OR r.cantiere_id IS DISTINCT FROM cid OR p.rapportino_id IS DISTINCT FROM r.id THEN
  RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Prestazione rimossa o fuori contesto'; END IF;
 IF p.variante_id IS NOT NULL THEN
 SELECT * INTO v FROM public.varianti_cantiere WHERE id=p.variante_id FOR SHARE;
 IF NOT FOUND OR v.cantiere_id IS DISTINCT FROM cid OR v.stato NOT IN ('bozza','proposta')
  OR NOT EXISTS(SELECT 1 FROM public.cantieri c JOIN public.preventivi_cantiere pc ON pc.id=c.preventivo_contrattuale_id
    WHERE c.id=cid AND pc.cantiere_id=cid AND c.preventivo_contrattuale_id=v.preventivo_contrattuale_id) THEN
  RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Variante della prestazione divergente'; END IF;
 END IF;
 snap:=jsonb_build_object('version',1,'prestazione_id',p.id,'rapportino_id',r.id,'cantiere_id',r.cantiere_id,
  'operaio_id',p.operaio_id,'data',r.data,'ora_inizio',p.ora_inizio,'ora_fine',p.ora_fine,'pausa_minuti',p.pausa_minuti,
  'ore',p.ore,'lavoro_in_economia',p.lavoro_in_economia,'variante_id',p.variante_id,'revisione',p.revisione);
 IF er.prestazione_revisione_acquisita IS DISTINCT FROM p.revisione OR er.prestazione_snapshot IS DISTINCT FROM snap THEN
  RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Prestazione divergente: riconciliazione esplicita necessaria'; END IF;
END;
$function$
;
ALTER FUNCTION artecna_guardie.verifica_riga_economia_rapportino(public.economia_righe,boolean) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.verifica_materiale_fattura_economia(er public.economia_righe)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE s public.economia_sorgenti%rowtype; f jsonb;
BEGIN
 SELECT * INTO s FROM public.economia_sorgenti WHERE id=er.sorgente_id AND raccolta_id=er.raccolta_id;
 IF NOT FOUND OR s.tipo IS DISTINCT FROM 'fattura_fornitore' OR s.formato IS DISTINCT FROM 'fattura' OR s.snapshot_version<>1 THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Sorgente fattura non valida'; END IF;
 f:=er.dettagli_analitici->'fattura';
 IF er.origine IS DISTINCT FROM 'fattura_fornitore' OR er.tipo_riga IS DISTINCT FROM 'materiale'
 OR er.indice_voce_sorgente IS NOT NULL OR f IS DISTINCT FROM s.snapshot OR jsonb_typeof(f) IS DISTINCT FROM 'object'
 OR f->'version' IS DISTINCT FROM '1'::jsonb OR (f->>'fattura_riga_id')::uuid IS DISTINCT FROM er.fattura_riga_id
 OR er.fattura_riga_id IS NULL OR (f->>'quantita')::numeric IS DISTINCT FROM er.quantita
 OR coalesce((f->>'prezzo_unitario_economia')::numeric,(f->>'prezzo_unitario')::numeric) IS DISTINCT FROM er.prezzo_unitario
 OR f->>'descrizione' IS DISTINCT FROM er.descrizione
 OR coalesce(f->>'unita_misura_economia',f->>'unita_misura') IS DISTINCT FROM er.unita_misura
 OR (f->>'totale')::numeric IS DISTINCT FROM round(er.quantita*er.prezzo_unitario,2)
 OR er.prezzo_unitario IS NULL OR er.quantita<=0
 OR s.file_sha256 IS DISTINCT FROM encode(sha256(convert_to('fattura_snapshot_v1:'||f::text,'UTF8')),'hex') THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Snapshot fattura non coerente con riga Economia'; END IF;
END; $function$
;
ALTER FUNCTION artecna_guardie.verifica_materiale_fattura_economia(public.economia_righe) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.economia_snapshot_fattura(p_riga uuid, p_cantiere uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE r public.fatture_fornitori_righe%rowtype; f public.fatture_fornitori%rowtype;
 u uuid; originale text; estensione text; totale numeric; prezzo_economia numeric(18,6);
BEGIN
 u:=artecna_guardie.utente_jwt_corrente();
 IF u IS NULL OR artecna_guardie.utente_puo_modificare_cantiere(u,p_cantiere) IS DISTINCT FROM true
 THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato'; END IF;
 SELECT * INTO r FROM public.fatture_fornitori_righe WHERE id=p_riga FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riga fattura non disponibile'; END IF;
 SELECT * INTO f FROM public.fatture_fornitori WHERE id=r.fattura_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Fattura non disponibile'; END IF;
 IF r.descrizione IS NULL OR btrim(r.descrizione)=''
 OR r.quantita IS NULL OR r.quantita<=0 OR r.quantita::text IN ('NaN','Infinity','-Infinity') OR r.quantita<>round(r.quantita,6)
 OR r.prezzo_unitario IS NULL OR r.prezzo_unitario<0 OR r.prezzo_unitario::text IN ('NaN','Infinity','-Infinity') THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Riga non trasferibile: descrizione, quantita o prezzo mancanti/non validi'; END IF;
 prezzo_economia:=round(r.prezzo_unitario,6);
 totale:=round(r.quantita*prezzo_economia,2);
 IF r.totale_riga IS NOT NULL AND r.totale_riga::text IN ('NaN','Infinity','-Infinity') THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Totale fattura non coerente con quantita e prezzo'; END IF;
 estensione:=lower(substring(f.nome_file from '\.([a-zA-Z0-9]+)$'));
 originale:=CASE WHEN estensione IN ('pdf','xml','csv','xls','xlsx','zip','png','jpg','jpeg') THEN estensione
  ELSE nullif(lower(btrim(f.tipo_file)),'') END;
 RETURN jsonb_build_object('version',1,'fattura_id',f.id,'fattura_riga_id',r.id,
  'fornitore',f.fornitore,'numero_fattura',f.numero_fattura,'data_fattura',f.data_fattura,
  'descrizione',r.descrizione,'quantita',r.quantita,'unita_misura',r.unita_misura,
  'prezzo_unitario',r.prezzo_unitario,'totale',totale,'totale_originale',r.totale_riga,
  'prezzo_unitario_originale',r.prezzo_unitario,'prezzo_unitario_economia',prezzo_economia,
  'totale_documento_originale',r.totale_riga,'totale_imponibile_originale',NULL,'totale_economia',totale,
  'formato_originale',originale,'nome_file_originale',f.nome_file);
END;
$function$
;
ALTER FUNCTION artecna_guardie.economia_snapshot_fattura(uuid,uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.blocca_riga_fattura_economia(p_riga uuid, p_cantiere uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE fid uuid; BEGIN
 IF artecna_guardie.utente_puo_modificare_cantiere(artecna_guardie.utente_jwt_corrente(),p_cantiere) IS DISTINCT FROM true THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato'; END IF;
 IF current_setting('transaction_isolation')<>'read committed' THEN
  RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Richiesto READ COMMITTED; nessun retry automatico'; END IF;
 SELECT fattura_id INTO fid FROM public.fatture_fornitori_righe WHERE id=p_riga;
 IF fid IS NULL THEN RAISE EXCEPTION 'Riga fattura assente'; END IF;
 -- Ordine comune: testata prima delle righe. Evita upgrade FOR SHARE -> UPDATE tardivi.
 PERFORM id FROM public.fatture_fornitori WHERE id=fid FOR UPDATE;
 PERFORM id FROM public.fatture_fornitori_righe WHERE id=p_riga AND fattura_id=fid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Riga fattura cambiata'; END IF;
 IF EXISTS(SELECT 1 FROM public.materiali_cantiere m JOIN public.fatture_fornitori f ON f.id=fid
  WHERE m.fattura_riga_id IS NULL AND nullif(btrim(f.nome_file),'') IS NOT NULL AND m.nome_file=f.nome_file) THEN
  RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Documento con costi legacy: verifica manuale necessaria'; END IF;
END $function$
;
ALTER FUNCTION artecna_guardie.blocca_riga_fattura_economia(uuid,uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.materiali_fattura_ordine_lock(p_payload jsonb)
 RETURNS TABLE(id uuid)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
 SELECT z.rid FROM (SELECT DISTINCT r.fattura_id,(v->>'fattura_riga_id')::uuid rid
 FROM jsonb_array_elements(coalesce(p_payload->'righe_da_creare','[]'::jsonb)) t(v)
 LEFT JOIN public.fatture_fornitori_righe r ON r.id=(v->>'fattura_riga_id')::uuid
 WHERE v->>'origine'='fattura_fornitore') z ORDER BY z.fattura_id,z.rid
$function$
;
ALTER FUNCTION artecna_guardie.materiali_fattura_ordine_lock(jsonb) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_rapportini.f3c3_inserisci_proiezione(p_id uuid, p_lease uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE a artecna_rapportini.allegati%ROWTYPE; r record; v_nome text; v_foto uuid;
BEGIN
 IF session_user<>'artecna_rapportini_backend' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='F3C3: writer riservato'; END IF;
 SELECT * INTO a FROM artecna_rapportini.allegati WHERE id=p_id;
 IF NOT FOUND OR a.stato<>'prenotato' OR a.foto_cantiere_id IS NOT NULL
  OR p_lease IS NULL OR a.lease_id IS DISTINCT FROM p_lease
  OR a.lease_until IS NULL OR a.lease_until<=statement_timestamp() OR a.expires_at<=statement_timestamp() THEN
  RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Tentativo allegato non valido'; END IF;
 SELECT id,cantiere_id,data,versione_prestazioni INTO r FROM public.rapportini WHERE id=a.rapportino_id;
 IF NOT FOUND OR r.cantiere_id IS DISTINCT FROM a.cantiere_id OR r.data IS NULL OR r.versione_prestazioni IS DISTINCT FROM 1 THEN
  RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='F3C3: contesto writer incoerente'; END IF;
 SELECT nome INTO v_nome FROM public.cantieri WHERE id=a.cantiere_id AND lavori_conclusi IS DISTINCT FROM true;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non consentito'; END IF;
 v_foto:=gen_random_uuid();
 INSERT INTO artecna_rapportini.f3c3_capability(foto_id,allegato_id,tx,backend_pid)
 VALUES(v_foto,a.id,pg_current_xact_id(),pg_backend_pid());
 INSERT INTO public.foto_cantiere(id,cantiere_id,cantiere,rapportino_id,categoria,data_foto,nota,
  file_url,file_path,immagine_base64,thumbnail_url,storage_provider,sync_status,allegato_v1_id)
 VALUES(v_foto,r.cantiere_id,v_nome,r.id::text,'rapportino',r.data,'',NULL,NULL,'',NULL,'cloud','not_required',a.id);
 IF EXISTS(SELECT 1 FROM artecna_rapportini.f3c3_capability WHERE foto_id=v_foto) THEN
  RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='F3C3: capability non consumata'; END IF;
 RETURN v_foto;
END;
$function$
;
ALTER FUNCTION artecna_rapportini.f3c3_inserisci_proiezione(uuid,uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.materiali_fattura_stato(p_fattura uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE s text; BEGIN
 PERFORM id FROM public.fatture_fornitori WHERE id=p_fattura FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Fattura assente'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.fatture_fornitori_righe WHERE fattura_id=p_fattura)
 OR EXISTS(SELECT 1 FROM public.fatture_fornitori_righe r WHERE r.fattura_id=p_fattura AND
  (r.quantita IS NULL OR r.quantita<=0 OR r.quantita::text IN ('NaN','Infinity','-Infinity')
   OR artecna_guardie.materiali_fattura_totale(r.id)>r.quantita)) THEN RAISE EXCEPTION 'Quantita fattura incoerenti'; END IF;
 SELECT CASE WHEN bool_and(a.q>=r.quantita) THEN 'assegnata'
   WHEN bool_or(a.q>0) THEN 'parzialmente_assegnata' ELSE 'da_assegnare' END INTO s
 FROM public.fatture_fornitori_righe r CROSS JOIN LATERAL
  (SELECT artecna_guardie.materiali_fattura_totale(r.id) q) a WHERE r.fattura_id=p_fattura;
 UPDATE public.fatture_fornitori SET stato=s WHERE id=p_fattura;
 -- Stato riga derivato dal reader: non riscrive i 221 stati legacy.
 RETURN s;
END $function$
;
ALTER FUNCTION artecna_guardie.materiali_fattura_stato(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.materiali_fattura_blocca(p_riga uuid, p_cantiere uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
 IF artecna_guardie.utente_puo_modificare_cantiere(artecna_guardie.utente_jwt_corrente(),p_cantiere) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato'; END IF;
 -- Same order as Economia: cantiere, invoice header, invoice row; avoids FK/project lock inversion.
 PERFORM id FROM public.cantieri WHERE id=p_cantiere FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cantiere assente'; END IF;
 PERFORM artecna_guardie.blocca_riga_fattura_economia(p_riga,p_cantiere);
END
$function$
;
ALTER FUNCTION artecna_guardie.materiali_fattura_blocca(uuid,uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.base_congelata(p_preventivo_id uuid, p_cantiere_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
 SET row_security TO 'off'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.cantieri AS c
    JOIN public.varianti_cantiere AS v
      ON v.cantiere_id = c.id
     AND v.preventivo_contrattuale_id =
         c.preventivo_contrattuale_id
    WHERE c.preventivo_contrattuale_id = p_preventivo_id
      AND (
        p_cantiere_id IS NULL
        OR c.id = p_cantiere_id
      )
      AND v.stato = 'approvata'
  );
$function$
;
ALTER FUNCTION artecna_guardie.base_congelata(uuid,uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.leggi_rapportino_portale(p_sessione text, p_cantiere_id uuid, p_data date, p_rapportino_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE n bigint; v1 boolean; non_supportata boolean; r record; dettaglio jsonb;
BEGIN
  IF session_user <> 'artecna_rapportini_backend' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Lettura riservata al backend portale';
  END IF;
  IF p_cantiere_id IS NULL OR p_data IS NULL OR NOT pg_catalog.isfinite(p_data)
    OR p_data < DATE '0001-01-01' OR p_data > DATE '9999-12-31' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Cantiere e data validi obbligatori';
  END IF;
  PERFORM artecna_rapportini.autorizza_lettura_portale(p_sessione,p_cantiere_id);
  IF p_rapportino_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.rapportini r0
    WHERE r0.id=p_rapportino_id AND r0.cantiere_id=p_cantiere_id AND r0.data=p_data) THEN
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='UUID e contesto Rapportino incoerenti';
  END IF;
  SELECT pg_catalog.count(*),pg_catalog.bool_or(r0.versione_prestazioni=1),
    pg_catalog.bool_or(r0.versione_prestazioni IS NULL OR r0.versione_prestazioni NOT IN (0,1))
    INTO n,v1,non_supportata FROM public.rapportini r0
    WHERE r0.cantiere_id=p_cantiere_id AND r0.data=p_data;
  IF non_supportata THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Versione Rapportino non supportata';
  END IF;
  IF n>1 AND v1 THEN
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Contesto Rapportino strutturato ambiguo';
  END IF;
  IF n=0 THEN
    RETURN pg_catalog.jsonb_build_object('versione_lettura',1,'cantiere_id',p_cantiere_id,
      'data',pg_catalog.to_char(p_data,'YYYY-MM-DD'),'presente',false,
      'versione_prestazioni',NULL,'rapportino_id',NULL,'dettaglio',NULL);
  END IF;
  -- V0 storico: ORDER BY created_at DESC (NULLS FIRST implicito) come /stato.
  -- Timestamp uguali: id DESC è lo spareggio deterministico prima non definito.
  -- L'UUID opzionale verifica la scelta; non forza la selezione di un V0 più vecchio.
  SELECT r0.id,r0.versione_prestazioni,r0.revisione_prestazioni,
    r0.note,r0.materiali,r0.quantita_materiali INTO r FROM public.rapportini r0
    WHERE r0.cantiere_id=p_cantiere_id AND r0.data=p_data
    ORDER BY r0.created_at DESC,r0.id DESC LIMIT 1;
  IF p_rapportino_id IS NOT NULL AND p_rapportino_id<>r.id THEN
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='UUID e contesto Rapportino incoerenti';
  END IF;
  dettaglio:=NULL;
  IF r.versione_prestazioni=1 THEN
    dettaglio:=pg_catalog.jsonb_build_object('versione_contratto',1,'rapportino_id',r.id,
      'revisione',r.revisione_prestazioni,'cantiere_id',p_cantiere_id,
      'data',pg_catalog.to_char(p_data,'YYYY-MM-DD'),'documento',pg_catalog.jsonb_build_object(
        'note',coalesce(r.note,''),'materiali',coalesce(r.materiali,''),
        'quantita_materiali',coalesce(r.quantita_materiali,'')),
      'prestazioni',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'prestazione_id',p.id,'chiave_client',p.chiave_client,'operaio_id',p.operaio_id,
        'operaio_nome',o.nome,'ora_inizio',pg_catalog.to_char(p.ora_inizio,'HH24:MI'),
        'ora_fine',pg_catalog.to_char(p.ora_fine,'HH24:MI'),'pausa_minuti',p.pausa_minuti,
        'lavoro_in_economia',p.lavoro_in_economia,'variante_id',p.variante_id,
        'ore',p.ore,'revisione',p.revisione,'rimossa_at',p.rimossa_at)
        ORDER BY p.created_at,p.id),'[]'::jsonb)
        FROM public.rapportino_prestazioni p JOIN public.operai o ON o.id=p.operaio_id
        WHERE p.rapportino_id=r.id));
  END IF;
  RETURN pg_catalog.jsonb_build_object('versione_lettura',1,'cantiere_id',p_cantiere_id,
    'data',pg_catalog.to_char(p_data,'YYYY-MM-DD'),'presente',true,
    'versione_prestazioni',r.versione_prestazioni,'rapportino_id',r.id,'dettaglio',dettaglio);
END;
$function$
;
ALTER FUNCTION public.leggi_rapportino_portale(text,uuid,date,uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.prenota_allegato_rapportino_portale(p_sessione text, p_rapportino_id uuid, p_cantiere_id uuid, p_data date, p_chiave_client_allegato uuid, p_sha256 text, p_mime_type text, p_byte_size bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_accesso boolean; v_stato text; v_rapportino record;
  v_hash bytea; v_path text; v_ext text; v_count bigint;
  a artecna_rapportini.allegati%ROWTYPE;
  v_esito text := 'successo';
  v_upload_necessario boolean;
BEGIN
  IF session_user<>'artecna_rapportini_backend' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Accesso Rapportini non consentito';
  END IF;
  IF p_sessione IS NULL OR p_sessione !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE='PR401',MESSAGE='Sessione portale non valida';
  END IF;
  SELECT o.accesso_portale,o.stato INTO v_accesso,v_stato
    FROM artecna_rapportini.sessioni_portale s JOIN public.operai o ON o.id=s.operaio_id
    WHERE s.token_sha256=pg_catalog.sha256(pg_catalog.convert_to(p_sessione,'UTF8'))
      AND s.revocata_at IS NULL AND s.scade_at>v_now FOR SHARE OF s,o;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='PR401',MESSAGE='Sessione portale assente, scaduta o revocata';
  END IF;
  IF v_accesso IS DISTINCT FROM true OR v_stato='sospeso' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Accesso Rapportini non consentito';
  END IF;
  RETURN artecna_rapportini.prenota_allegato_core(p_sessione,p_rapportino_id,p_cantiere_id,p_data,p_chiave_client_allegato,p_sha256,p_mime_type,p_byte_size);
END;
$function$
;
ALTER FUNCTION public.prenota_allegato_rapportino_portale(text,uuid,uuid,date,uuid,text,text,bigint) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.finalizza_allegato_rapportino_portale(p_sessione text, p_allegato_id uuid, p_lease_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_accesso boolean; v_stato text; target record; r record; v_nome text;
  a artecna_rapportini.allegati%ROWTYPE; f public.foto_cantiere%ROWTYPE;
  v_foto uuid; v_esito text := 'successo';
BEGIN
  IF session_user<>'artecna_rapportini_backend' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Accesso Rapportini non consentito';
  END IF;
  IF p_sessione IS NULL OR p_sessione !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE='PR401',MESSAGE='Sessione portale non valida';
  END IF;
  SELECT o.accesso_portale,o.stato INTO v_accesso,v_stato FROM artecna_rapportini.sessioni_portale s
    JOIN public.operai o ON o.id=s.operaio_id WHERE s.token_sha256=pg_catalog.sha256(pg_catalog.convert_to(p_sessione,'UTF8'))
    AND s.revocata_at IS NULL AND s.scade_at>v_now FOR SHARE OF s,o;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PR401',MESSAGE='Sessione portale assente, scaduta o revocata'; END IF;
  IF v_accesso IS DISTINCT FROM true OR v_stato='sospeso' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Accesso Rapportini non consentito';
  END IF;
  RETURN artecna_rapportini.finalizza_allegato_core(p_sessione,p_allegato_id,p_lease_id);
END;
$function$
;
ALTER FUNCTION public.finalizza_allegato_rapportino_portale(text,uuid,uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.elenca_allegati_rapportino_portale(p_sessione text, p_rapportino_id uuid, p_cantiere_id uuid, p_data date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE r record; a record; v_allegati jsonb := '[]'::jsonb;
BEGIN
  IF session_user<>'artecna_rapportini_backend' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Accesso Rapportini non consentito'; END IF;
  IF p_rapportino_id IS NULL OR p_cantiere_id IS NULL OR p_data IS NULL OR NOT pg_catalog.isfinite(p_data)
    OR p_data<DATE '0001-01-01' OR p_data>DATE '9999-12-31' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Contesto Rapportino non valido';
  END IF;
  PERFORM artecna_rapportini.autorizza_lettura_portale(p_sessione,p_cantiere_id);
  SELECT cantiere_id,data,versione_prestazioni INTO r FROM public.rapportini WHERE id=p_rapportino_id;
  IF NOT FOUND OR r.cantiere_id IS DISTINCT FROM p_cantiere_id OR r.data IS DISTINCT FROM p_data THEN
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Contesto Rapportino incoerente';
  END IF;
  IF r.versione_prestazioni IS DISTINCT FROM 1 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Versione Rapportino non supportata'; END IF;
  -- Contratto pubblico ElencoAllegati: solo finalizzati, nessuno stato UI aggiuntivo.
  FOR a IN SELECT id,chiave_client_allegato,mime_type,byte_size FROM artecna_rapportini.allegati
    WHERE rapportino_id=p_rapportino_id AND stato='finalizzato' ORDER BY created_at,id LOOP
    PERFORM artecna_rapportini.accesso_allegato_finalizzato(a.id,p_rapportino_id,p_cantiere_id,p_data);
    v_allegati:=v_allegati||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('allegato_id',a.id,
      'chiave_client_allegato',a.chiave_client_allegato,'stato','finalizzato','mime_type',a.mime_type,'byte_size',a.byte_size));
  END LOOP;
  RETURN pg_catalog.jsonb_build_object('versione_contratto',1,'rapportino_id',p_rapportino_id,'allegati',v_allegati);
END;
$function$
;
ALTER FUNCTION public.elenca_allegati_rapportino_portale(text,uuid,uuid,date) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.autorizza_accesso_allegato_portale(p_sessione text, p_allegato_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE a record; r record; abilitato boolean; stato_operaio text;
BEGIN
  IF session_user<>'artecna_rapportini_backend' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Accesso Rapportini non consentito'; END IF;
  IF p_sessione IS NULL OR p_sessione !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION USING ERRCODE='PR401',MESSAGE='Sessione portale non valida'; END IF;
  -- Stessa semantica PIN di 3A/3B, verificata prima di cercare un allegato.
  SELECT o.accesso_portale,o.stato INTO abilitato,stato_operaio FROM artecna_rapportini.sessioni_portale s
    JOIN public.operai o ON o.id=s.operaio_id WHERE s.token_sha256=pg_catalog.sha256(pg_catalog.convert_to(p_sessione,'UTF8'))
    AND s.revocata_at IS NULL AND s.scade_at>pg_catalog.statement_timestamp();
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PR401',MESSAGE='Sessione portale assente, scaduta o revocata'; END IF;
  IF abilitato IS DISTINCT FROM true OR stato_operaio='sospeso' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Accesso Rapportini non consentito'; END IF;
  IF p_allegato_id IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Allegato non valido'; END IF;
  SELECT rapportino_id,cantiere_id INTO a FROM artecna_rapportini.allegati WHERE id=p_allegato_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Allegato non disponibile'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cantieri WHERE id=a.cantiere_id AND lavori_conclusi IS DISTINCT FROM true) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non consentito';
  END IF;
  SELECT cantiere_id,data,versione_prestazioni INTO r FROM public.rapportini WHERE id=a.rapportino_id;
  IF NOT FOUND OR r.cantiere_id IS DISTINCT FROM a.cantiere_id OR r.data IS NULL OR NOT pg_catalog.isfinite(r.data) THEN
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Contesto Rapportino incoerente';
  END IF;
  IF r.versione_prestazioni IS DISTINCT FROM 1 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Versione Rapportino non supportata'; END IF;
  RETURN artecna_rapportini.accesso_allegato_finalizzato(p_allegato_id,a.rapportino_id,a.cantiere_id,r.data);
END;
$function$
;
ALTER FUNCTION public.autorizza_accesso_allegato_portale(text,uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.cancella_allegato_rapportino_portale(p_sessione text, p_allegato_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_accesso boolean; v_stato text; target record; r record; v_nome text;
  a artecna_rapportini.allegati%ROWTYPE; f public.foto_cantiere%ROWTYPE;
  v_ext text; v_path text;
BEGIN
  IF session_user<>'artecna_rapportini_backend' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Accesso Rapportini non consentito';
  END IF;
  IF p_sessione IS NULL OR p_sessione !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE='PR401',MESSAGE='Sessione portale non valida';
  END IF;
  SELECT o.accesso_portale,o.stato INTO v_accesso,v_stato FROM artecna_rapportini.sessioni_portale s
    JOIN public.operai o ON o.id=s.operaio_id WHERE s.token_sha256=pg_catalog.sha256(pg_catalog.convert_to(p_sessione,'UTF8'))
    AND s.revocata_at IS NULL AND s.scade_at>v_now FOR SHARE OF s,o;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PR401',MESSAGE='Sessione portale assente, scaduta o revocata'; END IF;
  IF v_accesso IS DISTINCT FROM true OR v_stato='sospeso' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Accesso Rapportini non consentito';
  END IF;
  IF p_allegato_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Richiesta allegato non valida';
  END IF;
  -- Prima lettura solo per localizzare il contesto, nessuna decisione sullo stato.
  SELECT rapportino_id,cantiere_id INTO target FROM artecna_rapportini.allegati WHERE id=p_allegato_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Contesto allegato incoerente'; END IF;
  SELECT nome INTO v_nome FROM public.cantieri WHERE id=target.cantiere_id
    AND lavori_conclusi IS DISTINCT FROM true FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non consentito'; END IF;
  -- Ordine globale RPC allegati: Rapportino -> Allegato -> foto_cantiere.
  SELECT id,cantiere_id,data,versione_prestazioni INTO r FROM public.rapportini WHERE id=target.rapportino_id FOR UPDATE;
  IF NOT FOUND OR r.cantiere_id IS DISTINCT FROM target.cantiere_id OR r.data IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Contesto allegato incoerente';
  END IF;
  IF r.versione_prestazioni IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Versione Rapportino non supportata';
  END IF;
  SELECT * INTO a FROM artecna_rapportini.allegati WHERE id=p_allegato_id FOR UPDATE;
  IF NOT FOUND OR a.rapportino_id IS DISTINCT FROM r.id OR a.cantiere_id IS DISTINCT FROM r.cantiere_id THEN
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Contesto allegato incoerente';
  END IF;
  IF (a.lease_id IS NULL) <> (a.lease_until IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
  END IF;
  IF a.stato='prenotato' THEN
    IF a.finalized_at IS NOT NULL OR a.foto_cantiere_id IS NOT NULL OR a.removed_at IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
    END IF;
  ELSIF a.stato='scaduto' THEN
    IF a.finalized_at IS NOT NULL OR a.foto_cantiere_id IS NOT NULL OR a.removed_at IS NOT NULL
      OR a.lease_id IS NOT NULL OR a.lease_until IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
    END IF;
  ELSIF a.stato='finalizzato' THEN
    IF a.finalized_at IS NULL OR a.foto_cantiere_id IS NULL OR a.removed_at IS NOT NULL
      OR a.lease_id IS NOT NULL OR a.lease_until IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
    END IF;
  ELSIF a.stato='cancellazione_pending' THEN
    -- Provenienza 3D: coppia NULL oppure coppia presente; nessuna lease cleanup in 3D.
    IF a.removed_at IS NULL OR a.lease_id IS NOT NULL OR a.lease_until IS NOT NULL
      OR (a.finalized_at IS NULL) <> (a.foto_cantiere_id IS NULL) THEN
      RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
    END IF;
  ELSIF a.stato='cancellato' THEN
    -- Tombstone post-cleanup: finalized_at è storia; nessuna proiezione residua.
    IF a.removed_at IS NULL OR a.lease_id IS NOT NULL OR a.lease_until IS NOT NULL
      OR a.foto_cantiere_id IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
    END IF;
  ELSE
    RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
  END IF;
  v_ext:=CASE a.mime_type WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/png' THEN 'png' WHEN 'image/webp' THEN 'webp' END;
  v_path:='rapportini/'||r.cantiere_id::text||'/'||r.id::text||'/'||a.chiave_client_allegato::text||'.'||v_ext;
  IF v_ext IS NULL OR a.bucket IS DISTINCT FROM 'rapportini-v1' OR a.file_path IS DISTINCT FROM v_path THEN
    RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Oggetto allegato non valido';
  END IF;
  IF a.foto_cantiere_id IS NOT NULL THEN
    -- Ultimo lock nell'ordine globale, solo lettura della proiezione conservata.
    SELECT * INTO f FROM public.foto_cantiere WHERE id=a.foto_cantiere_id FOR SHARE;
    IF NOT FOUND OR f.cantiere_id IS DISTINCT FROM r.cantiere_id OR f.rapportino_id IS DISTINCT FROM r.id::text
      OR f.cantiere IS DISTINCT FROM v_nome OR f.categoria IS DISTINCT FROM 'rapportino'
      OR f.data_foto::text IS DISTINCT FROM r.data::text OR f.nota IS DISTINCT FROM ''
      OR f.file_url IS NOT NULL OR f.file_path IS NOT NULL OR f.immagine_base64 IS DISTINCT FROM ''
      OR f.thumbnail_url IS NOT NULL OR f.storage_provider IS DISTINCT FROM 'cloud'
      OR f.sync_status IS DISTINCT FROM 'not_required' THEN
      RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Proiezione allegato non valida';
    END IF;
  END IF;
  IF a.stato IN ('prenotato','scaduto','finalizzato') THEN
    UPDATE artecna_rapportini.allegati SET stato='cancellazione_pending',removed_at=v_now,
      lease_id=NULL,lease_until=NULL WHERE id=a.id RETURNING * INTO a;
  END IF;
  RETURN pg_catalog.jsonb_build_object('versione_contratto',1,'esito','successo','allegato_id',a.id,
    'stato',a.stato,'foto_cantiere_id',a.foto_cantiere_id,'removed_at',a.removed_at);
END;
$function$
;
ALTER FUNCTION public.cancella_allegato_rapportino_portale(text,uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.leggi_rapportino_portale(p_sessione text, p_cantiere_id uuid, p_data date, p_rapportino_id uuid, p_versione_lettura smallint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE base jsonb; dettaglio jsonb; materiali jsonb; riepilogo jsonb; rid uuid; vm smallint;
BEGIN
 IF p_versione_lettura IS DISTINCT FROM 2 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Versione lettura non supportata'; END IF;
 -- La firma storica mantiene identica autorizzazione, snapshot, selezione e coerenza UUID.
 base:=public.leggi_rapportino_portale(p_sessione,p_cantiere_id,p_data,p_rapportino_id);
 IF base->'versione_prestazioni' IS DISTINCT FROM '1'::jsonb THEN RETURN base||jsonb_build_object('versione_lettura',2); END IF;
 rid:=(base->>'rapportino_id')::uuid;
 SELECT versione_materiali INTO vm FROM public.rapportini WHERE id=rid;
 IF vm IS NULL OR vm NOT IN(0,1) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Versione materiali non supportata'; END IF;
 IF vm=0 AND EXISTS(SELECT 1 FROM public.rapportino_materiali WHERE rapportino_id=rid) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Contesto materiali incoerente'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('materiale_id',m.id,'chiave_client',m.chiave_client,'descrizione',m.descrizione,'unita_misura',m.unita_misura,
 'quantita',m.quantita::text,'costo_unitario',m.costo_unitario::text,'costo_totale',m.costo_totale::text,'note',m.note,'revisione',m.revisione,'rimossa_at',m.rimossa_at)
 ORDER BY m.created_at,m.id),'[]'::jsonb) INTO materiali FROM public.rapportino_materiali m WHERE m.rapportino_id=rid;
 SELECT jsonb_build_object('totale_materiali_valorizzati',coalesce(sum(m.costo_totale),0.00)::text,
 'numero_materiali_da_valorizzare',count(*) FILTER(WHERE m.costo_unitario IS NULL),'valorizzazione_completa',count(*) FILTER(WHERE m.costo_unitario IS NULL)=0)
 INTO riepilogo FROM public.rapportino_materiali m WHERE m.rapportino_id=rid AND m.rimossa_at IS NULL;
 dettaglio:=((base->'dettaglio')-'documento')||jsonb_build_object('versione_contratto',2,
 'documento',jsonb_build_object('note',base#>>'{dettaglio,documento,note}'),
 'documento_legacy_materiali',jsonb_build_object('materiali',base#>>'{dettaglio,documento,materiali}','quantita_materiali',base#>>'{dettaglio,documento,quantita_materiali}'),
 'versione_materiali',vm,'materiali',materiali,'riepilogo_materiali',riepilogo);
 RETURN base||jsonb_build_object('versione_lettura',2,'dettaglio',dettaglio);
END;
$function$
;
ALTER FUNCTION public.leggi_rapportino_portale(text,uuid,date,uuid,smallint) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_foto_desktop.risolvi(p_allegato uuid, p_utente uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
 IF session_user<>'artecna_rapportini_backend' THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Backend Foto obbligatorio'; END IF;
 -- p_utente e attestazione del backend fidato dopo verifica JWT, non un parametro HTTP.
 RETURN artecna_foto_desktop.verifica(p_allegato,p_utente);
END;
$function$
;
ALTER FUNCTION artecna_foto_desktop.risolvi(uuid,uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.salva_osservatore_variante(p_user uuid, p_variante uuid, p_id uuid, p_fonti jsonb, p_risultato jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE v public.varianti_cantiere%ROWTYPE;
BEGIN
  IF session_user <> 'artecna_rapportini_backend' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Backend richiesto'; END IF;
  SELECT * INTO v FROM public.varianti_cantiere WHERE id=p_variante FOR UPDATE;
  IF p_user IS NULL OR NOT FOUND OR v.stato IS DISTINCT FROM 'bozza'
    OR artecna_guardie.utente_puo_modificare_cantiere(p_user,v.cantiere_id) IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Variante non accessibile';
  END IF;
  IF p_id IS NULL OR jsonb_typeof(p_fonti) IS DISTINCT FROM 'object' OR jsonb_typeof(p_risultato) IS DISTINCT FROM 'object'
    OR p_fonti->'manifesto'->'variante'->>'source_id' IS DISTINCT FROM p_variante::text
    OR coalesce(p_fonti->'manifesto'->>'firma','') !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Risultato Osservatore non valido';
  END IF;
  IF jsonb_typeof(p_fonti->'foto_bytes') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_fonti->'manifesto'->'foto') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Provenienza immagini incompleta';
  END IF;
  IF jsonb_array_length(p_fonti->'foto_bytes')<>jsonb_array_length(p_fonti->'manifesto'->'foto')
    OR jsonb_array_length(p_fonti->'foto_bytes')>8 OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_fonti->'manifesto'->'foto') f
      WHERE (SELECT count(*) FROM jsonb_array_elements(p_fonti->'foto_bytes') b
        WHERE b->>'source_id'=f->>'source_id' AND b->>'source_type'=f->>'source_type'
          AND coalesce(b->>'sha256','') ~ '^[0-9a-f]{64}$')<>1
    ) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Provenienza immagini incoerente'; END IF;
  INSERT INTO public.variante_osservatore_analisi(id,variante_id,user_id,modello,fonti,risultato)
    VALUES(p_id,p_variante,p_user,'gpt-4.1-mini',p_fonti,p_risultato);
  RETURN p_id;
END $function$
;
ALTER FUNCTION artecna_guardie.salva_osservatore_variante(uuid,uuid,uuid,jsonb,jsonb) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.prenota_allegato_rapportino_desktop(p_user_id uuid, p_rapportino_id uuid, p_cantiere_id uuid, p_data date, p_chiave_client_allegato uuid, p_sha256 text, p_mime_type text, p_byte_size bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
 IF session_user<>'artecna_rapportini_backend' OR p_user_id IS NULL THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Backend e identita attestata obbligatori'; END IF;
 IF artecna_guardie.utente_puo_modificare_cantiere(p_user_id,p_cantiere_id) IS DISTINCT FROM true THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non consentito'; END IF;
 RETURN artecna_rapportini.prenota_allegato_core(NULL,p_rapportino_id,p_cantiere_id,p_data,
  p_chiave_client_allegato,p_sha256,p_mime_type,p_byte_size);
END;
$function$
;
ALTER FUNCTION public.prenota_allegato_rapportino_desktop(uuid,uuid,uuid,date,uuid,text,text,bigint) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.finalizza_allegato_rapportino_desktop(p_user_id uuid, p_allegato_id uuid, p_lease_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE c uuid;
BEGIN
 IF session_user<>'artecna_rapportini_backend' OR p_user_id IS NULL THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Backend e identita attestata obbligatori'; END IF;
 SELECT cantiere_id INTO c FROM artecna_rapportini.allegati WHERE id=p_allegato_id;
 IF c IS NULL OR artecna_guardie.utente_puo_modificare_cantiere(p_user_id,c) IS DISTINCT FROM true THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non consentito'; END IF;
 RETURN artecna_rapportini.finalizza_allegato_core(NULL,p_allegato_id,p_lease_id);
END;
$function$
;
ALTER FUNCTION public.finalizza_allegato_rapportino_desktop(uuid,uuid,uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_rapportini.variante_del_cantiere(p_variante_id uuid, p_cantiere_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
  SELECT p_variante_id IS NOT NULL AND p_cantiere_id IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.varianti_cantiere
    WHERE id=p_variante_id AND cantiere_id=p_cantiere_id
  );
$function$
;
ALTER FUNCTION artecna_rapportini.variante_del_cantiere(uuid,uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_rapportini.applica_prestazioni_rapportino(p_payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  u uuid; channel text; actor record; rid uuid; req uuid; c uuid; rev bigint; ver smallint; h bytea;
  prev artecna_rapportini.richieste%rowtype; old public.rapportino_prestazioni%rowtype;
  ops jsonb; x jsonb; k text; pid uuid; seen uuid[]:='{}'; keys text[]:='{}';
  oi uuid; vi uuid; econ boolean; start_time time; end_time time; pause integer;
  out_result jsonb; current_row record; changed boolean:=false; exists_key boolean;
BEGIN
  SELECT * INTO actor FROM artecna_rapportini.autorizza(nullif(current_setting('artecna.rapportino_sessione',true),''),(p_payload->>'cantiere_id')::uuid);
  u:=actor.identita; channel:=actor.canale;
  IF u IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Identità obbligatoria'; END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR octet_length(p_payload::text)>1048576
    OR NOT (p_payload ?& ARRAY['versione_contratto','richiesta_id','rapportino_id','revisione_attesa','cantiere_id','data','prestazioni'])
    OR p_payload->'versione_contratto' IS DISTINCT FROM '1'::jsonb
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) z WHERE z NOT IN
      ('versione_contratto','richiesta_id','rapportino_id','revisione_attesa','cantiere_id','data','prestazioni')) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Envelope Rapportino V1 non valido';
  END IF;
  -- STEP 2 opera su una testata esistente. La creazione null è riservata STEP 3.
  rid:=(p_payload->>'rapportino_id')::uuid; req:=(p_payload->>'richiesta_id')::uuid;
  c:=(p_payload->>'cantiere_id')::uuid;
  IF rid IS NULL OR req IS NULL OR c IS NULL OR
    actor.identita IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Rapportino/owner non autorizzato';
  END IF;
  -- Serializza retry dello stesso utente/richiesta anche su Rapportini diversi.
  PERFORM pg_advisory_xact_lock(hashtextextended(channel||u::text||req::text,0));
  h:=sha256(convert_to(p_payload::text,'UTF8'));
  SELECT * INTO prev FROM artecna_rapportini.richieste WHERE canale=channel AND utente_id=u AND richiesta_id=req;
  IF FOUND THEN
    IF prev.payload_sha256 IS DISTINCT FROM h THEN RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Richiesta idempotente con payload differente'; END IF;
    RETURN prev.risultato;
  END IF;
  SELECT cantiere_id,versione_prestazioni,revisione_prestazioni,data INTO current_row
    FROM public.rapportini WHERE id=rid FOR UPDATE;
  IF NOT FOUND OR current_row.cantiere_id IS DISTINCT FROM c OR current_row.data IS NULL
    OR to_char(current_row.data,'YYYY-MM-DD') IS DISTINCT FROM p_payload->>'data' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Rapportino/contesto non valido';
  END IF;
  rev:=current_row.revisione_prestazioni; ver:=current_row.versione_prestazioni;
  IF jsonb_typeof(p_payload->'revisione_attesa') IS DISTINCT FROM 'number'
    OR p_payload->>'revisione_attesa' !~ '^[0-9]+$' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Revisione attesa obbligatoria';
  END IF;
  IF (p_payload->>'revisione_attesa')::bigint<>rev THEN
    RAISE EXCEPTION USING ERRCODE='PR412',MESSAGE='Revisione Rapportino obsoleta';
  END IF;
  ops:=p_payload->'prestazioni';
  IF jsonb_typeof(ops) IS DISTINCT FROM 'object' OR NOT (ops ?& ARRAY['nuove','aggiornate','rimosse'])
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(ops) z WHERE z NOT IN ('nuove','aggiornate','rimosse')) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Operazioni prestazioni non valide';
  END IF;
  FOREACH k IN ARRAY ARRAY['nuove','aggiornate','rimosse'] LOOP
    IF jsonb_typeof(ops->k) IS DISTINCT FROM 'array' OR jsonb_array_length(ops->k)>100 THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Array operazioni non valido';
    END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['nuove','aggiornate'] LOOP
    FOR x IN SELECT value FROM jsonb_array_elements(ops->k) LOOP
      IF jsonb_typeof(x) IS DISTINCT FROM 'object' OR NOT (x ?& ARRAY
        ['prestazione_id','chiave_client','operaio_id','ora_inizio','ora_fine','pausa_minuti','lavoro_in_economia','variante_id'])
        OR EXISTS(SELECT 1 FROM jsonb_object_keys(x) z WHERE z NOT IN
        ('prestazione_id','chiave_client','operaio_id','ora_inizio','ora_fine','pausa_minuti','lavoro_in_economia','variante_id'))
        OR jsonb_typeof(x->'chiave_client') IS DISTINCT FROM 'string'
        OR length(btrim(x->>'chiave_client')) NOT BETWEEN 1 AND 200
        OR x->>'chiave_client'<>btrim(x->>'chiave_client')
        OR jsonb_typeof(x->'lavoro_in_economia') IS DISTINCT FROM 'boolean'
        OR jsonb_typeof(x->'pausa_minuti') IS DISTINCT FROM 'number'
        OR x->>'pausa_minuti' !~ '^[0-9]+$'
        OR coalesce(x->>'ora_inizio','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        OR coalesce(x->>'ora_fine','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Prestazione non valida o campo autorevole client';
      END IF;
      IF x->>'chiave_client'=ANY(keys) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Chiave client ripetuta nel payload'; END IF;
      keys:=array_append(keys,x->>'chiave_client');
      oi:=(x->>'operaio_id')::uuid; vi:=(x->>'variante_id')::uuid;
      econ:=(x->>'lavoro_in_economia')::boolean;
      start_time:=(x->>'ora_inizio')::time; end_time:=(x->>'ora_fine')::time; pause:=(x->>'pausa_minuti')::integer;
      IF oi IS NULL OR (NOT econ AND vi IS NOT NULL) OR end_time<=start_time
        OR extract(epoch FROM (end_time-start_time))/60<=pause THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Intervallo o destinazione non validi';
      END IF;
      IF k='nuove' THEN
        IF x->'prestazione_id' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='UUID nuovo assegnato dal server'; END IF;
        SELECT * INTO old FROM public.rapportino_prestazioni WHERE rapportino_id=rid AND chiave_client=x->>'chiave_client' FOR UPDATE;
        exists_key:=FOUND;
        IF exists_key THEN
          IF old.rimossa_at IS NOT NULL OR old.operaio_id IS DISTINCT FROM oi OR old.ora_inizio IS DISTINCT FROM start_time
            OR old.ora_fine IS DISTINCT FROM end_time OR old.pausa_minuti IS DISTINCT FROM pause
            OR old.lavoro_in_economia IS DISTINCT FROM econ OR old.variante_id IS DISTINCT FROM vi THEN
            RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Chiave client già usata per dati differenti';
          END IF;
        ELSE
          IF vi IS NOT NULL THEN PERFORM artecna_rapportini.verifica_nuovo_collegamento_variante(vi,c); END IF;
          INSERT INTO public.rapportino_prestazioni(rapportino_id,operaio_id,chiave_client,ora_inizio,ora_fine,pausa_minuti,lavoro_in_economia,variante_id)
          VALUES(rid,oi,x->>'chiave_client',start_time,end_time,pause,econ,vi);
          changed:=true;
        END IF;
      ELSE
        pid:=(x->>'prestazione_id')::uuid;
        IF pid IS NULL OR pid=ANY(seen) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='UUID aggiornamento non valido/ripetuto'; END IF;
        seen:=array_append(seen,pid);
        SELECT * INTO old FROM public.rapportino_prestazioni WHERE id=pid AND rapportino_id=rid FOR UPDATE;
        IF NOT FOUND OR old.rimossa_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Prestazione assente/rimossa/fuori Rapportino'; END IF;
        -- Revisione aggregata già verificata: nessun client può aggiornare una
        -- prestazione letta da una revisione obsoleta, senza cambiare DTO STEP 1.
        IF old.operaio_id IS DISTINCT FROM oi OR old.chiave_client IS DISTINCT FROM x->>'chiave_client' THEN
          RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Identità prestazione immutabile';
        END IF;
        IF vi IS NOT NULL AND vi IS DISTINCT FROM old.variante_id THEN
          PERFORM artecna_rapportini.verifica_nuovo_collegamento_variante(vi,c);
        END IF;
        UPDATE public.rapportino_prestazioni SET ora_inizio=start_time,ora_fine=end_time,
          pausa_minuti=pause,lavoro_in_economia=econ,variante_id=vi WHERE id=pid;
        changed:=true;
      END IF;
    END LOOP;
  END LOOP;
  FOR x IN SELECT value FROM jsonb_array_elements(ops->'rimosse') LOOP
    IF jsonb_typeof(x) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Rimozione per UUID richiesta'; END IF;
    pid:=(x#>>'{}')::uuid;
    IF pid=ANY(seen) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Operazioni ripetute su UUID'; END IF;
    seen:=array_append(seen,pid);
    UPDATE public.rapportino_prestazioni SET rimossa_at=clock_timestamp() WHERE id=pid AND rapportino_id=rid AND rimossa_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Prestazione da rimuovere assente'; END IF;
    changed:=true;
  END LOOP;
  IF changed OR ver=0 THEN
    UPDATE public.rapportini SET versione_prestazioni=1,revisione_prestazioni=rev+1 WHERE id=rid;
    rev:=rev+1;
  END IF;
  SELECT jsonb_build_object('versione_contratto',1,'rapportino_id',rid,'revisione',rev,
    'prestazioni',coalesce(jsonb_agg(jsonb_build_object(
      'prestazione_id',id,'chiave_client',chiave_client,'operaio_id',operaio_id,
      'ora_inizio',to_char(ora_inizio,'HH24:MI'),'ora_fine',to_char(ora_fine,'HH24:MI'),
      'pausa_minuti',pausa_minuti,'ore',ore,'lavoro_in_economia',lavoro_in_economia,
      'variante_id',variante_id,'revisione',revisione,'rimossa_at',rimossa_at) ORDER BY created_at,id),'[]'::jsonb))
    INTO out_result FROM public.rapportino_prestazioni WHERE rapportino_id=rid;
  INSERT INTO artecna_rapportini.richieste(canale,utente_id,richiesta_id,rapportino_id,payload_sha256,risultato)
    VALUES(channel,u,req,rid,h,out_result);
  RETURN out_result;
END;
$function$
;
ALTER FUNCTION artecna_rapportini.applica_prestazioni_rapportino(jsonb) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_rapportini.autorizza(p_sessione text, p_cantiere uuid DEFAULT NULL::uuid)
 RETURNS TABLE(identita uuid, canale text, compilatore_nome text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
  IF p_sessione IS NOT NULL THEN
    IF p_sessione !~ '^[0-9a-f]{64}$' THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Sessione portale non valida';
    END IF;
    SELECT o.id,'portale',o.nome INTO identita,canale,compilatore_nome
      FROM artecna_rapportini.sessioni_portale s JOIN public.operai o ON o.id=s.operaio_id
      WHERE s.token_sha256=sha256(convert_to(p_sessione,'UTF8'))
        AND s.revocata_at IS NULL AND s.scade_at>clock_timestamp()
        AND o.accesso_portale IS TRUE AND o.stato IS DISTINCT FROM 'sospeso'
      FOR SHARE OF s,o;
    IF identita IS NULL THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Sessione portale assente, scaduta o operaio non abilitato';
    END IF;
  ELSE
    identita:=artecna_guardie.utente_jwt_corrente(); canale:='desktop'; compilatore_nome:=NULL;
    IF identita IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Identità obbligatoria'; END IF;
  END IF;
  IF p_cantiere IS NOT NULL THEN
    PERFORM 1 FROM public.cantieri WHERE id=p_cantiere
      AND (canale='desktop' OR lavori_conclusi IS DISTINCT FROM true) FOR SHARE;
    IF NOT FOUND OR (canale='desktop' AND
      artecna_guardie.utente_puo_modificare_cantiere(identita,p_cantiere) IS DISTINCT FROM true) THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non consentito';
    END IF;
  END IF;
  RETURN NEXT;
END;
$function$
;
ALTER FUNCTION artecna_rapportini.autorizza(text,uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_rapportini.verifica_nuovo_collegamento_variante(p_variante uuid, p_cantiere uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE v record;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('rapportino-variante:'||p_variante::text,0));
  SELECT cantiere_id,stato INTO v FROM public.varianti_cantiere WHERE id=p_variante FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Variante inesistente';
  END IF;
  IF v.cantiere_id IS DISTINCT FROM p_cantiere OR v.stato NOT IN ('bozza','proposta') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Nuovo collegamento consentito solo a Variante dello stesso cantiere in bozza o proposta';
  END IF;
END;
$function$
;
ALTER FUNCTION artecna_rapportini.verifica_nuovo_collegamento_variante(uuid,uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.utente_puo_modificare_cantiere(p_user_id uuid, p_cantiere_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
            SELECT EXISTS (
                SELECT 1
                FROM public.utenti_cantiere AS u
                WHERE p_user_id IS NOT NULL
                  AND p_cantiere_id IS NOT NULL
                  AND u.user_id = p_user_id
                  AND u.cantiere_id = p_cantiere_id
                  AND u.ruolo = 'owner'
            )
        $function$
;
ALTER FUNCTION artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.utente_jwt_corrente()
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$function$
;
ALTER FUNCTION artecna_guardie.utente_jwt_corrente() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.leggi_osservatore_variante(p_variante_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE u uuid; pacchetto jsonb; a public.variante_osservatore_analisi%ROWTYPE;
BEGIN
  u:=artecna_guardie.utente_jwt_corrente();
  pacchetto:=artecna_guardie.pacchetto_osservatore_variante(u,p_variante_id);
  SELECT * INTO a FROM public.variante_osservatore_analisi WHERE variante_id=p_variante_id ORDER BY created_at DESC,id DESC LIMIT 1;
  RETURN jsonb_build_object('fonti',pacchetto,'analisi',CASE WHEN a.id IS NULL THEN NULL ELSE jsonb_build_object(
    'id',a.id,'data',a.created_at,'modello',a.modello,'fonti',a.fonti,'risultato',a.risultato,
    'allineata',a.fonti->'manifesto'->>'firma'=pacchetto->'manifesto'->>'firma') END);
END $function$
;
ALTER FUNCTION public.leggi_osservatore_variante(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.salva_rapportino_con_prestazioni(p_payload jsonb, p_sessione text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
 IF p_payload->'versione_contratto'='2'::jsonb THEN RETURN artecna_rapportini.salva_contratto_due(p_payload,p_sessione); END IF;
 RETURN artecna_rapportini.salva_contratto_uno(p_payload,p_sessione);
END;
$function$
;
ALTER FUNCTION public.salva_rapportino_con_prestazioni(jsonb,text) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.quaderno_target_accessibile(p_sopralluogo text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
 select auth.uid() is not null and has_table_privilege('authenticated','public.sopralluoghi','SELECT')
 and not (select relrowsecurity from pg_class where oid='public.sopralluoghi'::regclass)
 and exists(select 1 from public.sopralluoghi where id::text=p_sopralluogo);
$function$
;
ALTER FUNCTION public.quaderno_target_accessibile(text) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.salva_nota_quaderno(p_sopralluogo text, p_documento jsonb, p_versione timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
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
$function$
;
ALTER FUNCTION public.salva_nota_quaderno(text,jsonb,timestamp with time zone) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.prepara_richiamo_quaderno(p_id uuid, p_sopralluogo text, p_sorgente uuid, p_sorgente_versione timestamp with time zone, p_documento jsonb, p_assets jsonb, p_versione timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
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
$function$
;
ALTER FUNCTION public.prepara_richiamo_quaderno(uuid,text,uuid,timestamp with time zone,jsonb,jsonb,timestamp with time zone) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.esito_richiamo_quaderno(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
declare r public.quaderno_richiami_sopralluogo;
begin
 select * into r from public.quaderno_richiami_sopralluogo where id=p_id and user_id=auth.uid();
 if not found then raise exception 'Richiamo non accessibile' using errcode='42501'; end if;
 return jsonb_build_object('richiamo',to_jsonb(r),'nota',(select to_jsonb(n) from public.note_sopralluogo n where n.id=r.nota_id and n.user_id=auth.uid()),'allegati',coalesce((select jsonb_agg(to_jsonb(a)) from public.quaderno_copie_allegati a where a.nota_id=r.nota_id and a.user_id=auth.uid()),'[]'::jsonb));
end;
$function$
;
ALTER FUNCTION public.esito_richiamo_quaderno(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.completa_richiamo_quaderno(p_richiamo uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
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
$function$
;
ALTER FUNCTION public.completa_richiamo_quaderno(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.annulla_richiamo_quaderno(p_id uuid, p_sopralluogo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
declare r public.quaderno_richiami_sopralluogo;
begin
 perform pg_advisory_xact_lock(hashtextextended('richiamo:'||p_id::text,0));
 select * into r from public.quaderno_richiami_sopralluogo where id=p_id and user_id=auth.uid() for update;
 if not found then
  if not public.quaderno_target_accessibile(p_sopralluogo) or exists(select 1 from public.quaderno_richiami_sopralluogo where id=p_id) then raise exception 'Richiamo non accessibile' using errcode='42501'; end if;
  -- Tombstone senza asset: gia pulita e confermata, non occupa il posto di un altro richiamo aperto.
  -- Il record e il lock per UUID continuano a impedire le richieste tardive.
  insert into public.quaderno_richiami_sopralluogo(id,user_id,sopralluogo_id,sorgente_id,sorgente_titolo,sorgente_updated_at,documento,input_documento,assets,stato,confermato_at,pulito_at)
   values(p_id,auth.uid(),p_sopralluogo,'00000000-0000-0000-0000-000000000000','Annullato prima della preparazione',clock_timestamp(),'{}','{}','[]','annullato',clock_timestamp(),clock_timestamp()) returning * into r;
 end if;
 if r.sopralluogo_id<>p_sopralluogo then raise exception 'Sopralluogo differente' using errcode='42501'; end if;
 if r.stato='preparazione' then update public.quaderno_richiami_sopralluogo set stato='annullato' where id=r.id; end if;
 return public.esito_richiamo_quaderno(r.id);
end;
$function$
;
ALTER FUNCTION public.annulla_richiamo_quaderno(uuid,text) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.conferma_richiamo_quaderno(p_id uuid, p_pulizia boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
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
$function$
;
ALTER FUNCTION public.conferma_richiamo_quaderno(uuid,boolean) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.quaderno_rinomina(p_id uuid, p_titolo text, p_versione timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
declare p public.quaderno_progetti;
begin
 select * into p from public.quaderno_progetti where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'Progetto non accessibile' using errcode='42501'; end if;
 if p.gestione_id is not null or p.gestione_copia then raise exception 'Progetto occupato' using errcode='55000'; end if;
 if p.updated_at is distinct from p_versione then raise exception 'Progetto aggiornato: ricaricare' using errcode='40001'; end if;
 if nullif(btrim(p_titolo),'') is null or length(p_titolo)>500 then raise exception 'Titolo non valido' using errcode='22023'; end if;
 update public.quaderno_progetti set titolo=btrim(p_titolo),updated_at=greatest(clock_timestamp(),updated_at+interval '1 microsecond') where id=p.id returning * into p;
 return to_jsonb(p);
end; $function$
;
ALTER FUNCTION public.quaderno_rinomina(uuid,text,timestamp with time zone) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.quaderno_gestione_esito(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
declare g public.quaderno_gestioni;
begin
 select * into g from public.quaderno_gestioni where id=p_id and user_id=auth.uid();
 if not found then raise exception 'Operazione non accessibile' using errcode='42501'; end if;
 return to_jsonb(g);
end; $function$
;
ALTER FUNCTION public.quaderno_gestione_esito(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.quaderno_prepara_eliminazione(p_id uuid, p_progetto uuid, p_versione timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
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
end; $function$
;
ALTER FUNCTION public.quaderno_prepara_eliminazione(uuid,uuid,timestamp with time zone) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.quaderno_prepara_duplicazione(p_id uuid, p_sorgente uuid, p_versione timestamp with time zone, p_destinazione uuid, p_documento jsonb, p_assets jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
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
end; $function$
;
ALTER FUNCTION public.quaderno_prepara_duplicazione(uuid,uuid,timestamp with time zone,uuid,jsonb,jsonb) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.quaderno_prepara_rimozione(p_id uuid, p_richiamo uuid, p_versione timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
declare r public.quaderno_richiami_sopralluogo; n public.note_sopralluogo; g public.quaderno_gestioni; pages jsonb; pageids text[]; ids text[]; doc jsonb; files jsonb; prefix text; anchor jsonb;
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
 -- Una geometria manuale successiva puo ancorarsi a una pagina importata.
 -- Mantieni la pagina vuota (stesso ID/geometria), senza provenienza o file,
 -- se quel riferimento sopravvive alla rimozione dei contenuti importati.
 for anchor in select value from jsonb_array_elements(n.disegni) where value->>'id'=any(pageids) loop
  if not exists(select 1 from jsonb_array_elements(doc->'disegni') p where p->>'id'=anchor->>'id') and position(anchor->>'id' in doc::text)>0 then
   anchor:=jsonb_set(public.quaderno_filtra_richiamo(anchor,r.id::text,ids,pageids,pages)-'provenienzaQuaderno','{sfondoDisegno}','null');
   doc:=jsonb_set(doc,'{disegni}',(doc->'disegni')||jsonb_build_array(anchor));
  end if;
 end loop;
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
end; $function$
;
ALTER FUNCTION public.quaderno_prepara_rimozione(uuid,uuid,timestamp with time zone) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.quaderno_annulla_duplicazione(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
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
end; $function$
;
ALTER FUNCTION public.quaderno_annulla_duplicazione(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.quaderno_concludi_gestione(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
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
end; $function$
;
ALTER FUNCTION public.quaderno_concludi_gestione(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.quaderno_archivia_non_avviata(p_id uuid, p_tipo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
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
end; $function$
;
ALTER FUNCTION public.quaderno_archivia_non_avviata(uuid,text) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.leggi_fonti_memory_variante(p_variante_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE u uuid; v public.varianti_cantiere%ROWTYPE; risultato jsonb;
BEGIN
  u := artecna_guardie.utente_jwt_corrente();
  SELECT * INTO v FROM public.varianti_cantiere WHERE id=p_variante_id;
  IF u IS NULL OR NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(u,v.cantiere_id) IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Variante non accessibile';
  END IF;
  IF v.stato IS DISTINCT FROM 'bozza' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Fonti disponibili solo in bozza';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',q.id,'titolo',q.titolo,'testo',q.testo,'updated_at',q.updated_at,
    'source_version',f.source_version,'aggiornato',q.updated_at=f.source_version,
    'disponibile',q.gestione_id IS NULL) ORDER BY q.id),'[]'::jsonb)
  INTO risultato FROM public.variante_fonti_memory f
  JOIN public.quaderno_progetti q ON q.id=f.source_id
  WHERE f.variante_id=v.id AND q.user_id=u AND NOT q.gestione_copia;
  RETURN risultato;
END $function$
;
ALTER FUNCTION public.leggi_fonti_memory_variante(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.modifica_fonte_memory_variante(p_variante_id uuid, p_source_id uuid, p_azione text, p_versione timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE u uuid; v public.varianti_cantiere%ROWTYPE; q public.quaderno_progetti%ROWTYPE;
BEGIN
  u := artecna_guardie.utente_jwt_corrente();
  SELECT * INTO v FROM public.varianti_cantiere WHERE id=p_variante_id FOR UPDATE;
  IF u IS NULL OR NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(u,v.cantiere_id) IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Variante non accessibile';
  END IF;
  IF v.stato IS DISTINCT FROM 'bozza' OR p_azione IS NULL OR p_azione NOT IN ('collega','scollega','aggiorna') THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Azione non consentita';
  END IF;
  SELECT * INTO q FROM public.quaderno_progetti
    WHERE id=p_source_id AND user_id=u AND NOT gestione_copia FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Quaderno non accessibile';
  END IF;
  IF p_azione='scollega' THEN
    DELETE FROM public.variante_fonti_memory WHERE variante_id=v.id AND source_id=q.id;
    RETURN;
  END IF;
  IF q.gestione_id IS NOT NULL OR p_versione IS NULL OR NOT isfinite(p_versione)
    OR q.updated_at IS DISTINCT FROM p_versione THEN
    RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='Rileggere la versione corrente del Quaderno';
  END IF;
  IF p_azione='collega' THEN
    BEGIN
      INSERT INTO public.variante_fonti_memory(variante_id,source_id,source_version)
      VALUES(v.id,q.id,q.updated_at);
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION USING ERRCODE='23505',
        MESSAGE='Questo Quaderno è già collegato alla Variante';
    END;
  ELSE
    UPDATE public.variante_fonti_memory SET source_version=q.updated_at
    WHERE variante_id=v.id AND source_id=q.id;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002', MESSAGE='Collegamento assente'; END IF;
  END IF;
END $function$
;
ALTER FUNCTION public.modifica_fonte_memory_variante(uuid,uuid,text,timestamp with time zone) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.elimina_rapportino_legacy_senza_allegati(p_rapportino_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE r record; v_user uuid;
BEGIN
 v_user:=artecna_guardie.utente_jwt_corrente();
 SELECT id,cantiere_id INTO r FROM public.rapportini WHERE id=p_rapportino_id;
 IF v_user IS NULL OR NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,r.cantiere_id) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Rapportino non autorizzato'; END IF;
 SELECT id,cantiere_id INTO r FROM public.rapportini WHERE id=p_rapportino_id FOR UPDATE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user,r.cantiere_id) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Rapportino non autorizzato'; END IF;
 IF EXISTS(SELECT 1 FROM artecna_rapportini.allegati WHERE rapportino_id=r.id)
  OR EXISTS(SELECT 1 FROM public.foto_cantiere WHERE rapportino_id=r.id::text AND allegato_v1_id IS NOT NULL) THEN
  RAISE EXCEPTION USING ERRCODE='P2132',MESSAGE='Il Rapportino contiene Allegati. Nessuna foto scollegata e nessun Rapportino eliminato.'; END IF;
 UPDATE public.foto_cantiere SET rapportino_id=NULL WHERE rapportino_id=r.id::text;
 DELETE FROM public.rapportini WHERE id=r.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'F3C3.2: eliminazione Rapportino non confermata'; END IF;
 RETURN jsonb_build_object('rapportino_id',r.id,'eliminato',true);
END;
$function$
;
ALTER FUNCTION public.elimina_rapportino_legacy_senza_allegati(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.rinomina_cantiere_legacy_senza_allegati(p_cantiere_id uuid, p_nome_atteso text, p_nuovo_nome text, p_modalita text, p_dati jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE c record; v_user uuid; t text; v_nome text;
BEGIN
 v_user:=artecna_guardie.utente_jwt_corrente();v_nome:=btrim(p_nuovo_nome);
 IF v_user IS NULL OR artecna_guardie.utente_puo_modificare_cantiere(v_user,p_cantiere_id) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non autorizzato'; END IF;
 IF v_nome IS NULL OR v_nome='' OR p_modalita IS NULL OR p_modalita NOT IN ('legacy','scheda','registro') OR p_dati IS NULL OR jsonb_typeof(p_dati)<>'object'
  OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_dati) k WHERE k NOT IN ('preventivo','data_inizio_lavori','data_fine_lavori','lavori_conclusi'))
  OR p_modalita<>'registro' AND p_dati<>'{}'::jsonb THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Dati modifica cantiere non validi'; END IF;
 -- Stesso ordine del registro: Rapportino prima di Allegato. FK verso cantiere
 -- impedisce nuovi INSERT Allegati mentre è detenuto il successivo FOR UPDATE.
 PERFORM id FROM public.rapportini WHERE cantiere_id=p_cantiere_id ORDER BY id FOR UPDATE;
 SELECT id,nome INTO c FROM public.cantieri WHERE id=p_cantiere_id FOR UPDATE;
 IF NOT FOUND OR c.nome IS DISTINCT FROM p_nome_atteso OR artecna_guardie.utente_puo_modificare_cantiere(v_user,p_cantiere_id) IS DISTINCT FROM true THEN RAISE EXCEPTION USING ERRCODE='P2133',MESSAGE='Cantiere modificato: ricarica prima di rinominare'; END IF;
 IF c.nome IS DISTINCT FROM v_nome THEN
  BEGIN PERFORM artecna_rapportini.compat_foto_verifica_cantiere(c.id);
  EXCEPTION WHEN SQLSTATE 'P2131' THEN RAISE EXCEPTION USING ERRCODE='P2131',MESSAGE='Il cantiere contiene foto Rapportino V1. La rinomina non è ancora disponibile.'; END;
 END IF;
 IF p_modalita='legacy' AND (SELECT count(*) FROM public.cantieri WHERE nome=c.nome)<>1 THEN RAISE EXCEPTION USING ERRCODE='P2133',MESSAGE='Nome cantiere ambiguo: usa la scheda identificata da UUID'; END IF;
 IF p_modalita='registro' THEN
  IF NOT p_dati ?& ARRAY['preventivo','data_inizio_lavori','data_fine_lavori','lavori_conclusi'] THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Dati registro incompleti'; END IF;
  -- popola solo i campi della whitelist usando i tipi reali della tabella.
  UPDATE public.cantieri dst SET nome=v_nome,preventivo=src.preventivo,data_inizio_lavori=src.data_inizio_lavori,data_fine_lavori=src.data_fine_lavori,lavori_conclusi=src.lavori_conclusi
   FROM jsonb_populate_record(NULL::public.cantieri,p_dati) src WHERE dst.id=c.id;
 ELSE UPDATE public.cantieri SET nome=v_nome WHERE id=c.id; END IF;
 IF p_modalita='legacy' AND c.nome IS DISTINCT FROM v_nome THEN
  FOREACH t IN ARRAY ARRAY['rapportini','foto_cantiere','timbrature','preventivi_cantiere','materiali_cantiere','attrezzi_cantiere'] LOOP
   EXECUTE format('UPDATE public.%I SET cantiere=$1 WHERE cantiere=$2',t) USING v_nome,c.nome;
  END LOOP;
 END IF;
 RETURN jsonb_build_object('cantiere_id',c.id,'nome',v_nome);
END;
$function$
;
ALTER FUNCTION public.rinomina_cantiere_legacy_senza_allegati(uuid,text,text,text,jsonb) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.elenca_foto_rapportino_desktop(p_rapportino uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE u uuid; r record; a record; resolved jsonb; items jsonb:='[]'::jsonb;
BEGIN
 IF current_setting('role',true)<>'authenticated' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Canale Desktop obbligatorio'; END IF;
 u:=artecna_guardie.utente_jwt_corrente();
 IF u IS NULL THEN RAISE EXCEPTION USING ERRCODE='PR401',MESSAGE='Identita Desktop obbligatoria'; END IF;
 SELECT cantiere_id,data,versione_prestazioni INTO r FROM public.rapportini WHERE id=p_rapportino;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Rapportino non disponibile'; END IF;
 IF artecna_guardie.utente_puo_modificare_cantiere(u,r.cantiere_id) IS DISTINCT FROM true
  THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non consentito'; END IF;
 IF r.versione_prestazioni IS DISTINCT FROM 1 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Rapportino non strutturato'; END IF;
 FOR a IN SELECT id FROM artecna_rapportini.allegati WHERE rapportino_id=p_rapportino AND stato='finalizzato' ORDER BY created_at,id LOOP
  resolved:=artecna_foto_desktop.verifica(a.id,u);
  items:=items||jsonb_build_array(jsonb_build_object('allegato_id',a.id,'foto_cantiere_id',resolved->'foto_cantiere_id',
   'rapportino_id',p_rapportino,'mime_type',resolved->'mime_type','byte_size',resolved->'byte_size'));
 END LOOP;
 RETURN jsonb_build_object('versione_contratto',1,'rapportino_id',p_rapportino,'allegati',items);
END;
$function$
;
ALTER FUNCTION public.elenca_foto_rapportino_desktop(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.elenca_prestazioni_economia_rapportini(p_cantiere_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE u uuid; candidates jsonb; destinations jsonb;
BEGIN
 IF current_setting('role',true) IS DISTINCT FROM 'authenticated' THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Canale Desktop obbligatorio'; END IF;
 u:=artecna_guardie.utente_jwt_corrente();
 IF u IS NULL OR p_cantiere_id IS NULL
  OR artecna_guardie.utente_puo_modificare_cantiere(u,p_cantiere_id) IS DISTINCT FROM true
  OR NOT EXISTS(SELECT 1 FROM public.cantieri WHERE id=p_cantiere_id) THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non autorizzato'; END IF;
 -- Un solo snapshot di statement; nessun lock/DML durante la lettura.
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'prestazione_id',p.id,'rapportino_id',r.id,'operaio_id',p.operaio_id,'operaio_nome',o.nome,
  'data',r.data,'ore',p.ore,'variante_id',p.variante_id,'revisione',p.revisione,
  'rimossa',p.rimossa_at IS NOT NULL,'lavoro_in_economia',p.lavoro_in_economia,
  'stato',CASE WHEN er.id IS NULL THEN 'da_acquisire'
    WHEN p.rimossa_at IS NOT NULL OR NOT p.lavoro_in_economia OR NOT (p.variante_id IS NULL OR v.valida)
     OR er.origine<>'rapportino' OR er.prestazione_revisione_acquisita IS DISTINCT FROM p.revisione
     OR er.prestazione_snapshot IS DISTINCT FROM s.snapshot OR dest.cantiere_id IS DISTINCT FROM r.cantiere_id
     THEN 'divergente' ELSE 'gia_acquisita' END,
  'candidabile',er.id IS NULL AND p.rimossa_at IS NULL AND p.lavoro_in_economia AND (p.variante_id IS NULL OR v.valida) AND p.ore>0,
  'variante_valida',v.valida,'snapshot_corrente',s.snapshot,
  'riga_economia_id',CASE WHEN dest.cantiere_id=r.cantiere_id THEN er.id END,
  'raccolta_acquisizione_id',CASE WHEN dest.cantiere_id=r.cantiere_id THEN dest.id END
 ) ORDER BY r.data,r.id,p.id),'[]'::jsonb) INTO candidates
 FROM public.rapportino_prestazioni p JOIN public.rapportini r ON r.id=p.rapportino_id
 JOIN public.operai o ON o.id=p.operaio_id
 LEFT JOIN public.economia_righe er ON er.rapportino_prestazione_id=p.id
 LEFT JOIN public.economia_raccolte dest ON dest.id=er.raccolta_id
 CROSS JOIN LATERAL (SELECT EXISTS(SELECT 1 FROM public.varianti_cantiere vc
  WHERE vc.id=p.variante_id AND vc.cantiere_id=r.cantiere_id AND vc.stato IN ('bozza','proposta')) valida) v
 CROSS JOIN LATERAL (SELECT jsonb_build_object('version',1,'prestazione_id',p.id,'rapportino_id',r.id,
  'cantiere_id',r.cantiere_id,'operaio_id',p.operaio_id,'data',r.data,'ora_inizio',p.ora_inizio,
  'ora_fine',p.ora_fine,'pausa_minuti',p.pausa_minuti,'ore',p.ore,
  'lavoro_in_economia',p.lavoro_in_economia,'variante_id',p.variante_id,'revisione',p.revisione) snapshot) s
 WHERE r.cantiere_id=p_cantiere_id AND r.versione_prestazioni=1
  AND ((p.lavoro_in_economia AND p.rimossa_at IS NULL) OR er.id IS NOT NULL);
 SELECT coalesce(jsonb_agg(jsonb_build_object('raccolta_id',id,'titolo',titolo,'numero',numero,
  'data',data,'revisione',revisione) ORDER BY numero,id),'[]'::jsonb) INTO destinations
 FROM public.economia_raccolte WHERE cantiere_id=p_cantiere_id AND stato='bozza';
 RETURN jsonb_build_object('versione_contratto',1,'cantiere_id',p_cantiere_id,
  'prestazioni',candidates,'raccolte_in_bozza',destinations);
END;
$function$
;
ALTER FUNCTION public.elenca_prestazioni_economia_rapportini(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.acquisisci_prestazioni_economia_rapportini(p_raccolta_id uuid, p_revisione_attesa bigint, p_prestazioni jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE u uuid; cid uuid; c public.cantieri%rowtype; col public.economia_raccolte%rowtype;
 p public.rapportino_prestazioni%rowtype; r public.rapportini%rowtype; v public.varianti_cantiere%rowtype;
 existing public.economia_righe%rowtype; item jsonb; snap jsonb; ids uuid[]; results jsonb:='[]';
 n integer:=0; next_order bigint; changed boolean:=false; rid uuid; expected bigint;
BEGIN
 IF current_setting('role',true) IS DISTINCT FROM 'authenticated' THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Canale Desktop obbligatorio'; END IF;
 u:=artecna_guardie.utente_jwt_corrente();
 SELECT cantiere_id INTO cid FROM public.economia_raccolte WHERE id=p_raccolta_id;
 IF u IS NULL OR cid IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Raccolta non autorizzata'; END IF;
 SELECT * INTO c FROM public.cantieri WHERE id=cid FOR UPDATE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(u,cid) IS DISTINCT FROM true THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non autorizzato'; END IF;
 PERFORM user_id FROM public.utenti_cantiere WHERE cantiere_id=cid AND user_id=u AND ruolo='owner' FOR SHARE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(u,cid) IS DISTINCT FROM true THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Membership non autorizzata'; END IF;
 IF p_revisione_attesa IS NULL OR p_revisione_attesa<0 OR jsonb_typeof(p_prestazioni) IS DISTINCT FROM 'array'
  OR jsonb_array_length(p_prestazioni) NOT BETWEEN 1 AND 100 THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Batch non valido'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_prestazioni) LOOP
  IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR NOT(item ?& ARRAY['prestazione_id','revisione_attesa'])
   OR EXISTS(SELECT 1 FROM jsonb_object_keys(item) k WHERE k NOT IN ('prestazione_id','revisione_attesa'))
   OR jsonb_typeof(item->'prestazione_id') IS DISTINCT FROM 'string'
   OR jsonb_typeof(item->'revisione_attesa') IS DISTINCT FROM 'number'
   OR item->>'revisione_attesa' !~ '^[0-9]+$' THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Prestazione richiesta non valida'; END IF;
  rid:=(item->>'prestazione_id')::uuid; expected:=(item->>'revisione_attesa')::bigint;
 END LOOP;
 SELECT array_agg((x->>'prestazione_id')::uuid ORDER BY (x->>'prestazione_id')::uuid) INTO ids
 FROM jsonb_array_elements(p_prestazioni) x;
 IF cardinality(ids)<>(SELECT count(DISTINCT id) FROM unnest(ids) id) THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='UUID prestazione ripetuto'; END IF;
 -- Ordine: cantiere, membership, testate Rapportino, Varianti, Raccolta, prestazioni, righe.
 -- Testate bloccate prima delle prestazioni come il writer Mobile; tutte in ordine UUID.
 PERFORM rr.id FROM public.rapportini rr WHERE rr.id IN
  (SELECT pp.rapportino_id FROM public.rapportino_prestazioni pp WHERE pp.id=ANY(ids)) ORDER BY rr.id FOR UPDATE;
 PERFORM vc.id FROM public.varianti_cantiere vc WHERE vc.id IN
  (SELECT pp.variante_id FROM public.rapportino_prestazioni pp WHERE pp.id=ANY(ids)) ORDER BY vc.id FOR SHARE;
 SELECT * INTO col FROM public.economia_raccolte WHERE id=p_raccolta_id AND cantiere_id=cid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Raccolta non autorizzata dopo lock'; END IF;
 IF col.stato<>'bozza' THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Raccolta chiusa'; END IF;
 SELECT coalesce(max(ordine),0)::bigint INTO next_order FROM public.economia_righe WHERE raccolta_id=col.id;
 FOR item IN SELECT value FROM jsonb_array_elements(p_prestazioni) ORDER BY (value->>'prestazione_id')::uuid LOOP
  SELECT * INTO p FROM public.rapportino_prestazioni WHERE id=(item->>'prestazione_id')::uuid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Prestazione assente'; END IF;
  SELECT * INTO r FROM public.rapportini WHERE id=p.rapportino_id;
  IF NOT FOUND OR r.cantiere_id IS DISTINCT FROM cid OR r.versione_prestazioni IS DISTINCT FROM 1 THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Prestazione fuori contesto'; END IF;
  IF p.revisione IS DISTINCT FROM (item->>'revisione_attesa')::bigint OR p.rimossa_at IS NOT NULL
   OR NOT p.lavoro_in_economia OR p.ore IS NULL OR p.ore<=0 THEN
   RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Prestazione obsoleta o inattiva'; END IF;
  IF p.variante_id IS NOT NULL THEN
 SELECT * INTO v FROM public.varianti_cantiere WHERE id=p.variante_id;
  IF NOT FOUND OR v.cantiere_id IS DISTINCT FROM cid OR v.stato NOT IN ('bozza','proposta')
   OR v.preventivo_contrattuale_id IS DISTINCT FROM c.preventivo_contrattuale_id
   OR NOT EXISTS(SELECT 1 FROM public.preventivi_cantiere pc WHERE pc.id=v.preventivo_contrattuale_id AND pc.cantiere_id=cid) THEN
   RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Variante incompatibile'; END IF;
 END IF;
  snap:=jsonb_build_object('version',1,'prestazione_id',p.id,'rapportino_id',r.id,
   'cantiere_id',r.cantiere_id,'operaio_id',p.operaio_id,'data',r.data,'ora_inizio',p.ora_inizio,
   'ora_fine',p.ora_fine,'pausa_minuti',p.pausa_minuti,'ore',p.ore,
   'lavoro_in_economia',p.lavoro_in_economia,'variante_id',p.variante_id,'revisione',p.revisione);
  SELECT * INTO existing FROM public.economia_righe WHERE rapportino_prestazione_id=p.id FOR UPDATE;
  IF FOUND THEN
   IF existing.raccolta_id IS DISTINCT FROM col.id OR existing.origine<>'rapportino'
    OR existing.prestazione_revisione_acquisita IS DISTINCT FROM p.revisione
    OR existing.prestazione_snapshot IS DISTINCT FROM snap OR existing.quantita IS DISTINCT FROM p.ore
    OR existing.tipo_riga<>'manodopera' OR existing.unita_misura<>'h' THEN
    RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Acquisizione esistente divergente'; END IF;
   rid:=existing.id;
  ELSE
   IF col.revisione IS DISTINCT FROM p_revisione_attesa THEN
    RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Revisione raccolta obsoleta'; END IF;
   IF col.revisione=9223372036854775807 OR next_order>=2147483647 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Contatore non rappresentabile'; END IF;
   next_order:=next_order+1;
   INSERT INTO public.economia_righe(raccolta_id,ordine,descrizione,unita_misura,quantita,prezzo_unitario,
    origine,tipo_riga,dettagli_analitici,created_by,rapportino_prestazione_id,prestazione_revisione_acquisita,prestazione_snapshot)
   VALUES(col.id,next_order::integer,'Prestazione Rapportino '||r.data::text,'h',p.ore,NULL,
    'rapportino','manodopera',jsonb_build_object('version',1,'rapportino',snap),u,p.id,p.revisione,snap)
   RETURNING id INTO rid;
   changed:=true;n:=n+1;
  END IF;
  results:=results||jsonb_build_array(jsonb_build_object('prestazione_id',p.id,'riga_id',rid));
 END LOOP;
 IF changed THEN UPDATE public.economia_raccolte SET revisione=revisione+1,updated_at=now() WHERE id=col.id RETURNING * INTO col; END IF;
 RETURN jsonb_build_object('versione_contratto',1,'raccolta_id',col.id,'revisione',col.revisione,'acquisite',n,'righe',results);
END;
$function$
;
ALTER FUNCTION public.acquisisci_prestazioni_economia_rapportini(uuid,bigint,jsonb) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.leggi_disponibilita_materiali_fattura(p_fattura_id uuid, p_raccolta_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE u uuid; cid uuid; result jsonb;
BEGIN
 IF p_raccolta_id IS NULL THEN
  RETURN artecna_guardie.leggi_materiali_impresa_fattura(p_fattura_id);
 END IF;
 u:=artecna_guardie.utente_jwt_corrente();
 SELECT cantiere_id INTO cid FROM public.economia_raccolte WHERE id=p_raccolta_id;
 IF u IS NULL OR cid IS NULL OR artecna_guardie.utente_puo_modificare_cantiere(u,cid) IS DISTINCT FROM true THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.fatture_fornitori WHERE id=p_fattura_id) THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Fattura non disponibile'; END IF;
 IF EXISTS(SELECT 1 FROM public.fatture_fornitori_righe r WHERE r.fattura_id=p_fattura_id AND
  (r.quantita IS NULL OR r.quantita<=0 OR r.quantita::text IN ('NaN','Infinity','-Infinity'))) THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Quantita fattura non valida'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('fattura_riga_id',r.id,'quantita_originale',r.quantita,
  'quantita_assegnata',a.q,'quantita_residua',r.quantita-a.q,
  'gia_presente_nella_raccolta',EXISTS(SELECT 1 FROM public.economia_righe e WHERE e.fattura_riga_id=r.id AND e.raccolta_id=p_raccolta_id)) ORDER BY r.id),'[]'::jsonb)
 INTO result FROM public.fatture_fornitori_righe r CROSS JOIN LATERAL
  (SELECT artecna_guardie.materiali_fattura_totale(r.id) q) a
 WHERE r.fattura_id=p_fattura_id;
 RETURN result;
END; $function$
;
ALTER FUNCTION public.leggi_disponibilita_materiali_fattura(uuid,uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.fattura_con_assegnazioni_quantitative(p_fattura_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
 IF artecna_guardie.utente_jwt_corrente() IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Autenticazione richiesta'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.fatture_fornitori WHERE id=p_fattura_id) THEN RAISE EXCEPTION 'Fattura assente'; END IF;
 RETURN EXISTS(SELECT 1 FROM public.fatture_fornitori_righe r WHERE r.fattura_id=p_fattura_id
  AND (EXISTS(SELECT 1 FROM public.economia_righe e WHERE e.fattura_riga_id=r.id)
   OR EXISTS(SELECT 1 FROM public.materiali_cantiere m WHERE m.fattura_riga_id=r.id)));
END $function$
;
ALTER FUNCTION public.fattura_con_assegnazioni_quantitative(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.leggi_assegnazioni_materiali_fattura(p_fattura_id uuid, p_cantiere_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE u uuid; result jsonb; BEGIN
 IF p_cantiere_id IS NULL THEN
  RETURN artecna_guardie.leggi_materiali_impresa_fattura(p_fattura_id);
 END IF;
 u:=artecna_guardie.utente_jwt_corrente();
 IF artecna_guardie.utente_puo_modificare_cantiere(u,p_cantiere_id) IS DISTINCT FROM true THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.fatture_fornitori WHERE id=p_fattura_id) THEN RAISE EXCEPTION 'Fattura assente'; END IF;
 IF EXISTS(SELECT 1 FROM public.fatture_fornitori_righe r WHERE r.fattura_id=p_fattura_id AND
  (r.quantita IS NULL OR r.quantita<=0 OR r.quantita::text IN ('NaN','Infinity','-Infinity')
  OR artecna_guardie.materiali_fattura_totale(r.id)>r.quantita)) THEN RAISE EXCEPTION 'Quantita incoerenti'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('fattura_riga_id',r.id,'quantita_originale',r.quantita,
  'quantita_assegnata',a.q,'quantita_residua',r.quantita-a.q,'stato',
  CASE WHEN a.q=0 THEN 'da_assegnare' WHEN a.q<r.quantita THEN 'parzialmente_assegnata' ELSE 'assegnata' END,
  'assegnazioni',coalesce((SELECT jsonb_agg(to_jsonb(h) ORDER BY h.data,h.id) FROM (
   SELECT e.id,'economia'::text destinazione,c.id cantiere_id,c.nome cantiere,er.id raccolta_id,er.titolo raccolta,
    e.quantita,e.unita_misura,e.prezzo_unitario,round(e.quantita*e.prezzo_unitario,2) totale,e.created_at data
   FROM public.economia_righe e JOIN public.economia_raccolte er ON er.id=e.raccolta_id
    JOIN public.cantieri c ON c.id=er.cantiere_id WHERE e.fattura_riga_id=r.id
    AND artecna_guardie.utente_puo_modificare_cantiere(u,c.id)
   UNION ALL
   SELECT m.id,'cantiere',c.id,c.nome,NULL::uuid,NULL::text,m.quantita,m.unita_misura,m.prezzo_unitario,m.totale,m.created_at
   FROM public.materiali_cantiere m JOIN public.cantieri c ON c.id=m.cantiere_id WHERE m.fattura_riga_id=r.id
    AND artecna_guardie.utente_puo_modificare_cantiere(u,c.id)
  ) h),'[]'::jsonb)) ORDER BY r.id),'[]'::jsonb) INTO result
 FROM public.fatture_fornitori_righe r CROSS JOIN LATERAL
  (SELECT artecna_guardie.materiali_fattura_totale(r.id) q) a WHERE r.fattura_id=p_fattura_id;
 RETURN result;
END $function$
;
ALTER FUNCTION public.leggi_assegnazioni_materiali_fattura(uuid,uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.assegna_materiale_fattura_impresa(p_fattura_riga_id uuid, p_quantita numeric, p_unita_misura text, p_categoria text, p_richiesta_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE u uuid; fid uuid; r public.fatture_fornitori_righe%rowtype; old public.materiali_impresa%rowtype;
  a numeric; pr numeric; nuovo uuid; s text;
BEGIN
  u:=artecna_guardie.utente_jwt_corrente();
  IF u IS NULL OR artecna_guardie.utente_puo_operare_impresa(u) IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Titolare impresa non autorizzato';
  END IF;
  IF p_richiesta_id IS NULL OR (p_categoria IS NULL OR p_categoria NOT IN ('attrezzo_ditta','magazzino'))
    OR p_quantita IS NULL OR NOT (p_quantita>0 AND p_quantita<1000000000000 AND p_quantita=round(p_quantita,6))
    OR p_unita_misura IS NULL OR btrim(p_unita_misura)='' OR length(p_unita_misura)>64 OR p_unita_misura ~ '[[:cntrl:]]' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Parametri assegnazione impresa non validi';
  END IF;
  fid:=artecna_guardie.materiali_impresa_blocca(p_fattura_riga_id);
  SELECT * INTO old FROM public.materiali_impresa WHERE richiesta_id=p_richiesta_id;
  IF FOUND THEN
    IF old.fattura_riga_id IS DISTINCT FROM p_fattura_riga_id OR old.quantita IS DISTINCT FROM p_quantita
      OR old.unita_misura IS DISTINCT FROM btrim(p_unita_misura) OR old.categoria IS DISTINCT FROM p_categoria
      OR old.created_by IS DISTINCT FROM u THEN
      RAISE EXCEPTION USING ERRCODE='23505', MESSAGE='Richiesta idempotente con parametri diversi';
    END IF;
    nuovo:=old.id;
  ELSE
    SELECT * INTO STRICT r FROM public.fatture_fornitori_righe WHERE id=p_fattura_riga_id;
    IF r.quantita IS NULL OR NOT (r.quantita>0 AND r.quantita<1000000000000 AND r.quantita=round(r.quantita,6))
      OR r.prezzo_unitario IS NULL OR NOT (r.prezzo_unitario>=0 AND r.prezzo_unitario<1000000000000) THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Valori originali fattura non validi';
    END IF;
    a:=artecna_guardie.materiali_fattura_totale(r.id);
    IF a<0 OR p_quantita>r.quantita-a THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Quantita oltre residuo globale';
    END IF;
    pr:=round(r.prezzo_unitario,6);
    INSERT INTO public.materiali_impresa(fattura_riga_id,categoria,quantita,unita_misura,prezzo_unitario,totale,created_by,richiesta_id)
    VALUES(r.id,p_categoria,p_quantita,btrim(p_unita_misura),pr,round(p_quantita*pr,2),u,p_richiesta_id)
    RETURNING id INTO nuovo;
  END IF;
  s:=artecna_guardie.materiali_fattura_stato(fid);
  SELECT quantita INTO STRICT a FROM public.fatture_fornitori_righe WHERE id=p_fattura_riga_id;
  RETURN jsonb_build_object('id',nuovo,'fattura_riga_id',p_fattura_riga_id,
    'quantita_assegnata',artecna_guardie.materiali_fattura_totale(p_fattura_riga_id),
    'quantita_residua',a-artecna_guardie.materiali_fattura_totale(p_fattura_riga_id),'stato_fattura',s);
END $function$
;
ALTER FUNCTION public.assegna_materiale_fattura_impresa(uuid,numeric,text,text,uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.salva_classificazione_fattura(p_fattura_id uuid, p_righe jsonb, p_richiesta_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  u uuid;
  f public.fatture_fornitori%ROWTYPE;
  r public.fatture_fornitori_righe%ROWTYPE;
  s public.spese_impresa%ROWTYPE;
  richiesta artecna_guardie.fatture_classificazione_richieste%ROWTYPE;
  item jsonb;
  categoria text;
  riferimento text;
  numero integer;
  esiti jsonb := '[]'::jsonb;
  risultato jsonb;
  costo_id uuid;
  creati integer := 0;
BEGIN
  u := artecna_guardie.utente_jwt_corrente();
  -- Fatture globali d'impresa: si riusa il titolare attivo, non un owner cantiere.
  IF u IS NULL OR artecna_guardie.utente_puo_operare_impresa(u) IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Gestione documenti fattura non autorizzata';
  END IF;
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='Richiesto READ COMMITTED; nessun retry automatico';
  END IF;
  IF p_fattura_id IS NULL OR p_richiesta_id IS NULL OR p_righe IS NULL
    OR jsonb_typeof(p_righe) <> 'array' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Richiesta documentale non valida';
  END IF;
  IF jsonb_array_length(p_righe) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Numero righe documentali non valido';
  END IF;
  -- Validazione completa prima di qualsiasi scrittura; nessun dato economico client.
  FOR item IN SELECT value FROM jsonb_array_elements(p_righe) LOOP
    IF jsonb_typeof(item) <> 'object' THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Riga documentale non valida';
    END IF;
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(item) k WHERE k NOT IN ('id','categoria_economica','cantiere'))
      OR jsonb_typeof(item->'id') IS DISTINCT FROM 'string'
      OR NOT (item ? 'categoria_economica')
      OR jsonb_typeof(item->'categoria_economica') NOT IN ('string','null')
      OR (item ? 'cantiere' AND jsonb_typeof(item->'cantiere') NOT IN ('string','null')) THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Campi documentali non ammessi';
    END IF;
    PERFORM (item->>'id')::uuid;
    categoria := nullif(item->>'categoria_economica','');
    IF categoria IS NOT NULL AND categoria NOT IN
      ('materiale_cantiere','attrezzo_ditta','magazzino','spesa_generale','storno_escluso') THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Categoria documento non valida';
    END IF;
    riferimento := item->>'cantiere';
    IF riferimento IS NOT NULL AND (length(riferimento)>500 OR riferimento ~ '[[:cntrl:]]') THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Riferimento documentale non valido';
    END IF;
  END LOOP;
  IF (SELECT count(DISTINCT (value->>'id')::uuid) FROM jsonb_array_elements(p_righe))
    <> jsonb_array_length(p_righe) THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Righe documento duplicate';
  END IF;

  -- Stesso ordine dei writer fattura: testata, righe UUID ordinate. Nessun lock cantiere.
  SELECT * INTO STRICT f FROM public.fatture_fornitori WHERE id=p_fattura_id FOR UPDATE NOWAIT;
  SELECT * INTO richiesta FROM artecna_guardie.fatture_classificazione_richieste
    WHERE user_id=u AND richiesta_id=p_richiesta_id;
  IF FOUND THEN
    IF richiesta.fattura_id IS DISTINCT FROM p_fattura_id OR richiesta.payload IS DISTINCT FROM p_righe THEN
      RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Richiesta UUID riutilizzata con dati differenti';
    END IF;
    RETURN richiesta.risultato;
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_righe) ORDER BY (value->>'id')::uuid LOOP
    PERFORM id FROM public.fatture_fornitori_righe
      WHERE id=(item->>'id')::uuid AND fattura_id=p_fattura_id FOR UPDATE NOWAIT;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE='23503', MESSAGE='Riga non appartenente alla fattura';
    END IF;
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(p_righe) ORDER BY (value->>'id')::uuid LOOP
    SELECT * INTO STRICT r FROM public.fatture_fornitori_righe WHERE id=(item->>'id')::uuid;
    categoria := nullif(item->>'categoria_economica','');
    -- Campo assente = preservato; NULL/vuoto esplicito = nessun riferimento.
    riferimento := CASE WHEN item ? 'cantiere' THEN nullif(item->>'cantiere','') ELSE r.cantiere END;
    costo_id := NULL;
    PERFORM id FROM public.spese_impresa WHERE riga_fattura_id=r.id ORDER BY id FOR UPDATE NOWAIT;
    SELECT count(*) INTO numero FROM public.spese_impresa WHERE riga_fattura_id=r.id;
    IF numero>1 THEN
      RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Costi storici multipli: riconciliazione necessaria', DETAIL='riga_fattura_id='||r.id;
    END IF;
    IF numero=1 THEN
      SELECT * INTO STRICT s FROM public.spese_impresa WHERE riga_fattura_id=r.id;
      IF s.fattura_id IS DISTINCT FROM f.id OR s.categoria IS DISTINCT FROM categoria
        OR s.importo IS DISTINCT FROM r.totale_riga OR s.descrizione IS DISTINCT FROM r.descrizione THEN
        RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Costo storico incompatibile: riconciliazione necessaria', DETAIL='riga_fattura_id='||r.id;
      END IF;
      costo_id := s.id; -- Lo storico coerente resta byte-identico, senza UPDATE/DELETE.
    END IF;
    IF categoria = 'spesa_generale' THEN
      IF artecna_guardie.materiali_fattura_totale(r.id) IS DISTINCT FROM 0::numeric THEN
        RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Costo legacy incompatibile con assegnazioni quantitative', DETAIL='riga_fattura_id='||r.id;
      END IF;
      IF EXISTS(SELECT 1 FROM public.spese_impresa WHERE fattura_id=f.id AND riga_fattura_id IS NULL) THEN
        RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Costo storico privo di riferimento riga: riconciliazione necessaria';
      END IF;
      IF r.totale_riga IS NULL OR r.totale_riga::text IN ('NaN','Infinity','-Infinity') THEN
        RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Importo documentale non valido';
      END IF;
      IF numero=0 THEN
        INSERT INTO public.spese_impresa(categoria,descrizione,importo,fornitore,data_documento,nome_file,fattura_id,riga_fattura_id,nota)
        VALUES(categoria,r.descrizione,r.totale_riga,f.fornitore,f.data_fattura,f.nome_file,f.id,r.id,'Fattura '||coalesce(f.numero_fattura,''))
        RETURNING id INTO costo_id;
        creati := creati+1;
      END IF;
    END IF;
    UPDATE public.fatture_fornitori_righe SET categoria_economica=categoria, cantiere=riferimento WHERE id=r.id AND fattura_id=f.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'STOP riga documento scomparsa'; END IF;
    esiti := esiti || jsonb_build_array(jsonb_build_object('id',r.id,'categoria_economica',categoria,'cantiere',riferimento,'spesa_legacy_id',costo_id));
  END LOOP;
  risultato := jsonb_build_object('fattura_id',f.id,'richiesta_id',p_richiesta_id,'righe',esiti,'costi_legacy_creati',creati);
  INSERT INTO artecna_guardie.fatture_classificazione_richieste(user_id,richiesta_id,fattura_id,payload,risultato)
    VALUES(u,p_richiesta_id,f.id,p_righe,risultato);
  -- Nessun EXCEPTION che assorba errori: qualunque errore annulla l'intera chiamata.
  RETURN risultato;
END
$function$
;
ALTER FUNCTION public.salva_classificazione_fattura(uuid,jsonb,uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.leggi_rapportino_desktop(p_cantiere_id uuid, p_data date, p_rapportino_id uuid, p_versione_lettura smallint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE identita uuid; base jsonb;
BEGIN
  identita:=artecna_guardie.utente_jwt_corrente();
  IF identita IS NULL THEN RAISE EXCEPTION USING ERRCODE='PR401',MESSAGE='Identità Desktop obbligatoria'; END IF;
  IF p_cantiere_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.cantieri WHERE id=p_cantiere_id)
    OR artecna_guardie.utente_puo_modificare_cantiere(identita,p_cantiere_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non consentito';
  END IF;
  IF p_versione_lettura IS NULL OR p_versione_lettura NOT IN(1,2) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Versione lettura non supportata';
  END IF;
  base:=artecna_rapportini.costruisci_lettura_rapportino_v1(p_cantiere_id,p_data,p_rapportino_id);
  IF p_versione_lettura=2 THEN RETURN artecna_rapportini.arricchisci_lettura_rapportino_v2(base); END IF;
  RETURN base;
END;
$function$
;
ALTER FUNCTION public.leggi_rapportino_desktop(uuid,date,uuid,smallint) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.leggi_foto_fonti_variante(p_variante_id uuid, p_collegate boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
  SELECT artecna_guardie.foto_fonti_variante(artecna_guardie.utente_jwt_corrente(),p_variante_id,p_collegate)
$function$
;
ALTER FUNCTION public.leggi_foto_fonti_variante(uuid,boolean) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.modifica_foto_fonti_variante(p_variante_id uuid, p_fonti jsonb, p_azione text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE u uuid; v public.varianti_cantiere%ROWTYPE; f jsonb; fonte uuid; tipo text;
BEGIN
  u:=artecna_guardie.utente_jwt_corrente();
  SELECT * INTO v FROM public.varianti_cantiere WHERE id=p_variante_id FOR UPDATE;
  IF u IS NULL OR NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(u,v.cantiere_id) IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Variante non accessibile';
  END IF;
  IF v.stato IS DISTINCT FROM 'bozza' OR p_azione IS NULL OR p_azione NOT IN ('collega','scollega')
    OR jsonb_typeof(p_fonti) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Richiesta foto non valida';
  END IF;
  IF jsonb_array_length(p_fonti) NOT BETWEEN 1 AND 8 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Selezionare da una a otto foto'; END IF;
  FOR f IN SELECT value FROM jsonb_array_elements(p_fonti) ORDER BY value->>'source_type',value->>'source_id' LOOP
    tipo:=f->>'source_type'; fonte:=(f->>'source_id')::uuid;
    IF tipo IS NULL OR tipo NOT IN ('foto_cantiere','foto_sopralluogo') OR fonte IS NULL THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Identita foto non valida';
    END IF;
    IF p_azione='scollega' THEN
      -- Only the reference is deleted; never touches a parent photo or Storage.
      DELETE FROM public.variante_fonti_visive WHERE variante_id=v.id AND source_type=tipo AND source_id=fonte;
      CONTINUE;
    END IF;
    IF tipo='foto_cantiere' THEN PERFORM 1 FROM public.foto_cantiere WHERE id=fonte FOR SHARE;
    ELSE PERFORM 1 FROM public.foto_sopralluogo WHERE id=fonte FOR SHARE; END IF;
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(artecna_guardie.foto_fonti_variante(u,v.id,false)) x
      WHERE x->>'source_type'=tipo AND x->>'source_id'=fonte::text) THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Foto non accessibile nel contesto della Variante';
    END IF;
    BEGIN
      INSERT INTO public.variante_fonti_visive(variante_id,source_type,source_id) VALUES(v.id,tipo,fonte);
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION USING ERRCODE='23505',MESSAGE='Questa foto è già collegata alla Variante';
    END;
  END LOOP;
  IF (SELECT count(*) FROM public.variante_fonti_visive WHERE variante_id=v.id)>8 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Massimo otto foto per analisi Osservatore';
  END IF;
END $function$
;
ALTER FUNCTION public.modifica_foto_fonti_variante(uuid,jsonb,text) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.leggi_memoria_prezzi_preventivo(p_da integer DEFAULT 0, p_limite integer DEFAULT 500)
 RETURNS TABLE(id uuid, descrizione text, unita_misura text, prezzo_unitario numeric, fonte text, creato_il timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
 IF NOT coalesce(artecna_guardie.utente_puo_operare_impresa(artecna_guardie.utente_jwt_corrente()),false)
 THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Memoria prezzi riservata al titolare autorizzato'; END IF;
 IF p_da IS NULL OR p_limite IS NULL OR p_da<0 OR p_limite<1 OR p_limite>500
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Paginazione Memoria prezzi non valida'; END IF;
 RETURN QUERY SELECT m.id,m.descrizione,m.unita_misura,m.prezzo_unitario,m.fonte,m.creato_il
 FROM public.memoria_prezzi m WHERE m.prezzo_unitario>0
 ORDER BY m.creato_il ASC NULLS LAST,m.id ASC OFFSET p_da LIMIT p_limite;
END $function$
;
ALTER FUNCTION public.leggi_memoria_prezzi_preventivo(integer,integer) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.leggi_attribuzioni_cliente(p_fattura_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE f public.fatture_emesse%ROWTYPE; result jsonb;
BEGIN
 PERFORM artecna_contabilita.autorizza(p_fattura_id);
 SELECT * INTO f FROM public.fatture_emesse WHERE id=p_fattura_id;
 SELECT jsonb_build_object('fattura',jsonb_build_object('id',f.id,'numero_fattura',f.numero_fattura,
  'data_fattura',f.data_fattura,'cliente',f.cliente,'totale',f.totale,'cantiere_id',f.cantiere_id,
  'importo_incassato',f.importo_incassato,'stato',f.stato),
  'attribuito',coalesce((SELECT sum(importo) FROM artecna_contabilita.attribuzioni_clienti WHERE fattura_id=f.id AND scollegato_at IS NULL),0),
  'collegamenti',coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l.creato_at,l.id) FROM artecna_contabilita.attribuzioni_clienti l WHERE l.fattura_id=f.id),'[]'),
  'acconti',coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'data_incasso',a.data_incasso,
   'descrizione',a.descrizione,'importo',a.importo,'provenienza','acconti_cantiere',
   'attribuito',coalesce((SELECT sum(l.importo) FROM artecna_contabilita.attribuzioni_clienti l WHERE l.acconto_id=a.id AND l.scollegato_at IS NULL),0)) ORDER BY a.data_incasso,a.id)
   FROM public.acconti_cantiere a WHERE a.cantiere_id=f.cantiere_id),'[]'),
  'incassi_non_fatturati_ambigui', (SELECT count(*) FROM public.incassi_non_fatturati WHERE cantiere_id=f.cantiere_id),
  'situazione','Da riconciliare','residuo_verificato',NULL)
 INTO result;
 RETURN result;
END $function$
;
ALTER FUNCTION public.leggi_attribuzioni_cliente(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.collega_incasso_cliente(p_richiesta_id uuid, p_fattura_id uuid, p_acconto_id uuid, p_importo numeric, p_verificato boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE u uuid; f public.fatture_emesse%ROWTYPE; a public.acconti_cantiere%ROWTYPE;
 l artecna_contabilita.attribuzioni_clienti%ROWTYPE; sf numeric; sa numeric; tipo text;
BEGIN
 -- Lo stesso lock è acquisito dai guard dei writer legacy: tutte le quote sono
 -- ricontrollate dopo attese reali, mai sulla disponibilità inviata dal client.
 PERFORM pg_advisory_xact_lock(714028,1);
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Usare una transazione READ COMMITTED per le attribuzioni'; END IF;
 u:=artecna_contabilita.autorizza(p_fattura_id);
 IF p_richiesta_id IS NULL OR p_acconto_id IS NULL OR p_verificato IS DISTINCT FROM true
 OR p_importo IS NULL OR p_importo::text IN ('NaN','Infinity','-Infinity')
 OR p_importo<=0 OR p_importo>999999999999.99 OR p_importo<>round(p_importo,2)
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Conferma e importo monetario non validi'; END IF;
 SELECT * INTO l FROM artecna_contabilita.attribuzioni_clienti WHERE id=p_richiesta_id;
 IF FOUND THEN
  IF l.creato_da<>u OR l.fattura_id<>p_fattura_id OR l.acconto_id<>p_acconto_id OR l.importo<>p_importo
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Identità richiesta già usata per un’altra operazione'; END IF;
  -- Anche una richiesta già scollegata resta tale: un retry non la riapre.
  RETURN to_jsonb(l);
 END IF;
 SELECT * INTO f FROM public.fatture_emesse WHERE id=p_fattura_id;
 SELECT * INTO a FROM public.acconti_cantiere WHERE id=p_acconto_id;
 IF NOT FOUND OR a.cantiere_id IS DISTINCT FROM f.cantiere_id OR a.cantiere_id IS NULL
 OR a.data_incasso IS NULL OR a.importo IS NULL OR a.importo::text IN ('NaN','Infinity','-Infinity')
 OR a.importo<=0 OR a.importo<>round(a.importo,2)
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Acconto non disponibile nel contesto verificato'; END IF;
 tipo:=to_jsonb(f)->>'tipo_documento';
 IF f.totale IS NULL OR f.totale::text IN ('NaN','Infinity','-Infinity') OR f.totale<=0 OR f.totale<>round(f.totale,2)
 OR f.data_fattura IS NULL OR coalesce(btrim(f.cliente),'')=''
 OR coalesce(f.stato,'') NOT IN ('emessa','parziale','incassata')
 OR (tipo IS NOT NULL AND tipo NOT IN ('fattura','TD01'))
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Documento non supportato: verificare totale, tipo e stato'; END IF;
 IF EXISTS(SELECT 1 FROM artecna_contabilita.attribuzioni_clienti WHERE acconto_id=a.id AND scollegato_at IS NULL
   AND (cantiere_id<>f.cantiere_id OR cliente_confermato<>btrim(f.cliente)))
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Acconto già attribuito a un cliente diverso'; END IF;
 SELECT coalesce(sum(importo),0) INTO sf FROM artecna_contabilita.attribuzioni_clienti WHERE fattura_id=f.id AND scollegato_at IS NULL;
 SELECT coalesce(sum(importo),0) INTO sa FROM artecna_contabilita.attribuzioni_clienti WHERE acconto_id=a.id AND scollegato_at IS NULL;
 IF sf+p_importo>f.totale OR sa+p_importo>a.importo
 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Quota superiore alla disponibilità del movimento o del documento'; END IF;
 INSERT INTO artecna_contabilita.attribuzioni_clienti(id,fattura_id,acconto_id,cantiere_id,cliente_confermato,importo,verificato,creato_da)
 VALUES(p_richiesta_id,f.id,a.id,f.cantiere_id,btrim(f.cliente),p_importo,true,u) RETURNING * INTO l;
 RETURN to_jsonb(l);
END $function$
;
ALTER FUNCTION public.collega_incasso_cliente(uuid,uuid,uuid,numeric,boolean) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.scollega_incasso_cliente(p_richiesta_id uuid, p_collegamento_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE l artecna_contabilita.attribuzioni_clienti%ROWTYPE; u uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(714028,1);
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Usare una transazione READ COMMITTED per lo scollegamento'; END IF;
 SELECT * INTO l FROM artecna_contabilita.attribuzioni_clienti WHERE id=p_collegamento_id;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Collegamento non accessibile'; END IF;
 u:=artecna_contabilita.autorizza(l.fattura_id);
 IF p_richiesta_id IS NULL OR EXISTS(SELECT 1 FROM artecna_contabilita.attribuzioni_clienti WHERE richiesta_scollega=p_richiesta_id AND id<>l.id)
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Identità scollegamento non valida'; END IF;
 IF l.scollegato_at IS NULL THEN
  UPDATE artecna_contabilita.attribuzioni_clienti SET scollegato_at=clock_timestamp(),scollegato_da=u,richiesta_scollega=p_richiesta_id WHERE id=l.id RETURNING * INTO l;
 END IF;
 RETURN to_jsonb(l);
END $function$
;
ALTER FUNCTION public.scollega_incasso_cliente(uuid,uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_clienti_sicurezza.puo_scrivere_sorgente(p_cantiere_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
 SELECT u.id IS NOT NULL
  AND artecna_guardie.utente_puo_operare_impresa(u.id) IS TRUE
  AND (p_cantiere_id IS NULL
       OR artecna_guardie.utente_puo_modificare_cantiere(u.id,p_cantiere_id) IS TRUE)
 FROM (SELECT artecna_guardie.utente_jwt_corrente() AS id) u
$function$
;
ALTER FUNCTION artecna_clienti_sicurezza.puo_scrivere_sorgente(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.leggi_link_rapportini_mobile()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE u uuid; v text; presente boolean;
BEGIN
 u := artecna_guardie.utente_jwt_corrente();
 IF u IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Accesso gestionale richiesto'; END IF;
 SELECT valore INTO v FROM public.impostazioni_app WHERE chiave='rapportini_mobile_url';
 presente := FOUND;
 RETURN jsonb_build_object('url',CASE WHEN presente THEN v ELSE '/rapportino' END,
  'configurato',presente,'modificabile',coalesce(artecna_guardie.utente_puo_operare_impresa(u),false));
END $function$
;
ALTER FUNCTION public.leggi_link_rapportini_mobile() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.salva_link_rapportini_mobile(p_url text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE u uuid; v text := btrim(p_url); prossimo bigint;
BEGIN
 u := artecna_guardie.utente_jwt_corrente();
 IF u IS NULL OR artecna_guardie.utente_puo_operare_impresa(u) IS NOT TRUE
 THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Modifica link riservata al titolare attivo'; END IF;
 IF public.link_rapportini_mobile_url_valido(v) IS NOT TRUE
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Link portale non valido'; END IF;
 -- L'archivio esistente non ha un default su id: nessuna nuova sequenza o tabella.
 -- Il lock serializza anche i writer legacy durante il primo inserimento della chiave.
 LOCK TABLE public.impostazioni_app IN SHARE ROW EXCLUSIVE MODE;
 UPDATE public.impostazioni_app SET valore=v WHERE chiave='rapportini_mobile_url' RETURNING valore INTO v;
 IF NOT FOUND THEN
  SELECT coalesce(max(id),0)+1 INTO prossimo FROM public.impostazioni_app;
  v := btrim(p_url);
  INSERT INTO public.impostazioni_app(id,chiave,valore) VALUES(prossimo,'rapportini_mobile_url',v) RETURNING valore INTO v;
 END IF;
 RETURN jsonb_build_object('url',v,'configurato',true,'modificabile',true);
END $function$
;
ALTER FUNCTION public.salva_link_rapportini_mobile(text) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.leggi_nota_credito_fornitore(p_nota_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE n jsonb; o jsonb; candidati jsonb; candidato uuid; q record; motivo text; righe jsonb; rettifiche jsonb;
BEGIN
  PERFORM artecna_guardie.nc_accesso();
  BEGIN n := artecna_guardie.nc_xml(p_nota_id);
  EXCEPTION WHEN SQLSTATE '22023' THEN
    RETURN jsonb_build_object('stato','da riconciliare','motivo',SQLERRM,'righe','[]'::jsonb,'quote','[]'::jsonb,'rettifiche','[]'::jsonb);
  END;
  IF n->>'tipo' IS DISTINCT FROM 'TD04' THEN RAISE EXCEPTION 'Documento non TD04' USING ERRCODE='22023'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',f.id,'numero',f.numero_fattura,'data',f.data_fattura) ORDER BY f.id),'[]') INTO candidati
    FROM public.fatture_fornitori f WHERE f.id<>p_nota_id AND nullif(btrim(f.partita_iva),'')=nullif(n->>'partita_iva','')
    AND EXISTS(SELECT 1 FROM jsonb_array_elements(n->'riferimenti') r
      WHERE r->>'numero'=f.numero_fattura AND r->>'data'=f.data_fattura::text);
  IF (SELECT count(DISTINCT (r->>'numero',r->>'data')) FROM jsonb_array_elements(n->'riferimenti') r)>1 THEN
    motivo := 'Più riferimenti originali: riconciliazione separata necessaria';
  ELSIF jsonb_array_length(candidati)<>1 THEN
    motivo := CASE WHEN jsonb_array_length(candidati)=0 THEN 'Origine non disponibile: nessuna rettifica automatica.' ELSE 'Origine ambigua: più documenti corrispondenti.' END;
  ELSE
    candidato := (candidati->0->>'id')::uuid;
    BEGIN o := artecna_guardie.nc_xml(candidato);
    EXCEPTION WHEN SQLSTATE '22023' THEN motivo := 'Origine senza XML verificabile'; END;
    IF o IS NOT NULL AND (o->>'tipo' IN ('TD04','TD08') OR o->>'partita_iva' IS DISTINCT FROM n->>'partita_iva' OR o->>'paese' IS DISTINCT FROM n->>'paese'
      OR o->>'numero' IS DISTINCT FROM candidati->0->>'numero' OR o->>'data' IS DISTINCT FROM candidati->0->>'data') THEN
      motivo := 'Identità fiscale dell’origine non coerente'; o := NULL;
    END IF;
    FOR q IN SELECT * FROM artecna_guardie.nc_quote(candidato) LOOP
      IF nullif(btrim(q.categoria),'') IS NULL THEN motivo := 'Categoria della destinazione non verificata'; END IF;
      IF q.tipo IN ('economia','cantiere') AND q.cantiere_id IS NULL THEN motivo := 'Quota priva di UUID Cantiere'; END IF;
      PERFORM artecna_guardie.nc_accesso(q.cantiere_id);
    END LOOP;
    IF o IS NOT NULL AND NOT artecna_guardie.nc_righe_coerenti(candidato,o) THEN motivo := 'Righe origine non coerenti/univoche rispetto a XML'; o := NULL; END IF;
    IF NOT EXISTS(SELECT 1 FROM artecna_guardie.nc_quote(candidato)) THEN motivo := 'Documento originario non assegnato'; END IF;
  END IF;
  IF NOT artecna_guardie.nc_righe_coerenti(p_nota_id,n) THEN motivo := 'Righe della nota non coerenti/univoche rispetto a XML'; END IF;
  IF EXISTS(SELECT 1 FROM artecna_guardie.nc_quote(p_nota_id)) THEN motivo := 'Nota con assegnazioni ordinarie storiche: riconciliazione specifica necessaria'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.numero_riga,r.id),'[]') INTO righe FROM public.fatture_fornitori_righe r WHERE r.fattura_id=p_nota_id;
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.created_at,r.id),'[]') INTO rettifiche FROM public.fornitori_rettifiche r WHERE r.nota_id=p_nota_id;
  FOR q IN SELECT cantiere_id FROM public.fornitori_rettifiche WHERE nota_id=p_nota_id LOOP PERFORM artecna_guardie.nc_accesso(q.cantiere_id); END LOOP;
  RETURN jsonb_build_object('documento',n,'origine',o,'candidati',candidati,'motivo',motivo,'righe',righe,
    'quote',CASE WHEN motivo IS NULL THEN (SELECT coalesce(jsonb_agg(to_jsonb(quota)||jsonb_build_object('quantita_disponibile',quota.quantita-(SELECT coalesce(sum(rr.quantita),0) FROM public.fornitori_rettifiche rr WHERE CASE quota.tipo WHEN 'economia' THEN rr.economia_riga_id WHEN 'cantiere' THEN rr.materiale_cantiere_id WHEN 'impresa' THEN rr.materiale_impresa_id WHEN 'spesa' THEN rr.spesa_impresa_id END=quota.id),'costo_disponibile',quota.costo+(SELECT coalesce(sum(rr.importo_costo),0) FROM public.fornitori_rettifiche rr WHERE CASE quota.tipo WHEN 'economia' THEN rr.economia_riga_id WHEN 'cantiere' THEN rr.materiale_cantiere_id WHEN 'impresa' THEN rr.materiale_impresa_id WHEN 'spesa' THEN rr.spesa_impresa_id END=quota.id)) ORDER BY quota.origine_riga_id,quota.tipo,quota.id),'[]') FROM artecna_guardie.nc_quote(candidato) quota) ELSE '[]'::jsonb END,
    'rettifiche',rettifiche,'stato',CASE
      WHEN jsonb_array_length(righe)>0 AND (SELECT count(DISTINCT r.nota_riga_id) FROM public.fornitori_rettifiche r WHERE r.nota_id=p_nota_id)=jsonb_array_length(righe) THEN 'rettifica applicata'
      ELSE 'da riconciliare' END);
END $function$
;
ALTER FUNCTION public.leggi_nota_credito_fornitore(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.applica_nota_credito_fornitore(p_nota_id uuid, p_origine_id uuid, p_righe jsonb, p_richiesta_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE v jsonb; n jsonb; o jsonb; e jsonb; x jsonb; ox jsonb; payload jsonb; esistente record;
  nr public.fatture_fornitori_righe%ROWTYPE; orr public.fatture_fornitori_righe%ROWTYPE; q record; g record;
  quant numeric; intera numeric; importo numeric; costo numeric; coeff numeric; somma numeric; somma_costi numeric;
  usata_q numeric; usata_netto numeric; usata_costo numeric; nota_riga uuid; categoria text;
BEGIN
  PERFORM artecna_guardie.nc_accesso();
  IF p_richiesta_id IS NULL OR p_nota_id IS NULL OR p_origine_id IS NULL OR jsonb_typeof(p_righe) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_righe)=0 THEN RAISE EXCEPTION 'Richiesta incompleta' USING ERRCODE='22023'; END IF;
  IF current_setting('transaction_isolation')<>'read committed' THEN
    RAISE EXCEPTION 'Rettifiche: richiesta una transazione READ COMMITTED' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_richiesta_id::text, 3104));
  SELECT jsonb_agg(value ORDER BY value->>'nota_riga_id',value->>'tipo',value->>'quota_id') INTO payload FROM jsonb_array_elements(p_righe);
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(payload) elemento
    WHERE elemento->'conferma_corrispondenza' IS DISTINCT FROM 'true'::jsonb OR
      (elemento-ARRAY['nota_riga_id','tipo','quota_id','quantita','conferma_corrispondenza'])<>'{}'::jsonb) THEN
    RAISE EXCEPTION 'Confermare esplicitamente la corrispondenza delle righe, senza importi imposti dal client' USING ERRCODE='22023';
  END IF;
  -- Tutte le note della stessa origine si serializzano sul documento originario.
  PERFORM 1 FROM public.fatture_fornitori WHERE id=p_nota_id FOR UPDATE;
  PERFORM 1 FROM public.fatture_fornitori WHERE id=p_origine_id FOR UPDATE;
  v := public.leggi_nota_credito_fornitore(p_nota_id);
  IF v->>'motivo' IS NOT NULL OR v->'origine'->>'id' IS DISTINCT FROM p_origine_id::text THEN
    RAISE EXCEPTION 'Origine/assegnazione non verificata: %',coalesce(v->>'motivo','identità diversa') USING ERRCODE='22023';
  END IF;
  n := v->'documento'; o := v->'origine';
  SELECT * INTO esistente FROM public.fornitori_rettifiche WHERE richiesta_id=p_richiesta_id LIMIT 1;
  IF FOUND THEN
    IF esistente.nota_id<>p_nota_id OR esistente.richiesta IS DISTINCT FROM payload OR esistente.created_by<>artecna_guardie.utente_jwt_corrente() THEN
      RAISE EXCEPTION 'Identificativo richiesta già usato con dati diversi' USING ERRCODE='23505';
    END IF;
    RETURN v;
  END IF;
  IF (n->>'imponibile_originale')::numeric=0 THEN RAISE EXCEPTION 'Imponibile nullo: riconciliazione non automatizzabile' USING ERRCODE='22023'; END IF;
  coeff := CASE WHEN (n->>'imponibile_originale')::numeric>0 THEN -1 ELSE 1 END;
  SELECT sum(round((value->>'totale')::numeric,2)) INTO somma FROM jsonb_array_elements(n->'righe');
  IF somma IS DISTINCT FROM round((n->>'imponibile_originale')::numeric,2)
    OR round((n->>'totale_originale')::numeric,2) IS DISTINCT FROM round((n->>'imponibile_originale')::numeric+(n->>'iva_originale')::numeric,2) THEN
    RAISE EXCEPTION 'Riepilogo/arrotondamenti XML da riconciliare' USING ERRCODE='22023';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(n->'righe') r WHERE (r->>'totale')::numeric*coeff>=0) THEN
    RAISE EXCEPTION 'Nota con componenti di segno misto: riconciliazione specifica necessaria' USING ERRCODE='22023';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(payload) elemento GROUP BY elemento->>'nota_riga_id',elemento->>'tipo',elemento->>'quota_id' HAVING count(*)>1) THEN
    RAISE EXCEPTION 'Quota ripetuta nella richiesta' USING ERRCODE='23505';
  END IF;
  -- Ogni riga di nota viene applicata integralmente in una sola transazione,
  -- eventualmente ripartita su più quote. Altre righe possono restare pendenti.
  FOR g IN SELECT value->>'nota_riga_id' id,sum((value->>'quantita')::numeric) quantita FROM jsonb_array_elements(payload) GROUP BY value->>'nota_riga_id' LOOP
    SELECT * INTO STRICT nr FROM public.fatture_fornitori_righe WHERE id=g.id::uuid AND fattura_id=p_nota_id FOR UPDATE;
    SELECT value INTO STRICT x FROM jsonb_array_elements(n->'righe') WHERE (value->>'numero')::integer=nr.numero_riga;
    IF nr.quantita IS DISTINCT FROM (x->>'quantita')::numeric OR nr.prezzo_unitario IS DISTINCT FROM (x->>'prezzo')::numeric
      OR nr.descrizione IS DISTINCT FROM x->>'descrizione' OR g.quantita IS DISTINCT FROM abs(nr.quantita) OR nr.quantita=0 THEN
      RAISE EXCEPTION 'Riga/quantità della nota non coerente con XML originale' USING ERRCODE='22023';
    END IF;
    IF EXISTS(SELECT 1 FROM public.fornitori_rettifiche WHERE nota_riga_id=nr.id) THEN RAISE EXCEPTION 'Riga della nota già rettificata' USING ERRCODE='23505'; END IF;
  END LOOP;
  FOR e IN SELECT value FROM jsonb_array_elements(payload) LOOP
    SELECT * INTO STRICT nr FROM public.fatture_fornitori_righe WHERE id=(e->>'nota_riga_id')::uuid AND fattura_id=p_nota_id;
    SELECT value INTO STRICT x FROM jsonb_array_elements(n->'righe') WHERE (value->>'numero')::integer=nr.numero_riga;
    CASE e->>'tipo'
      WHEN 'economia' THEN PERFORM 1 FROM public.economia_righe WHERE id=(e->>'quota_id')::uuid FOR UPDATE;
      WHEN 'cantiere' THEN PERFORM 1 FROM public.materiali_cantiere WHERE id=(e->>'quota_id')::uuid FOR UPDATE;
      WHEN 'impresa' THEN PERFORM 1 FROM public.materiali_impresa WHERE id=(e->>'quota_id')::uuid FOR UPDATE;
      WHEN 'spesa' THEN PERFORM 1 FROM public.spese_impresa WHERE id=(e->>'quota_id')::uuid FOR UPDATE;
      ELSE RAISE EXCEPTION 'Destinazione non supportata' USING ERRCODE='22023';
    END CASE;
    SELECT * INTO STRICT q FROM artecna_guardie.nc_quote(p_origine_id) WHERE id=(e->>'quota_id')::uuid AND tipo=e->>'tipo';
    SELECT * INTO STRICT orr FROM public.fatture_fornitori_righe WHERE id=q.origine_riga_id AND fattura_id=p_origine_id FOR UPDATE;
    SELECT value INTO STRICT ox FROM jsonb_array_elements(o->'righe') WHERE (value->>'numero')::integer=orr.numero_riga;
    IF orr.quantita IS DISTINCT FROM (ox->>'quantita')::numeric OR orr.prezzo_unitario IS DISTINCT FROM (ox->>'prezzo')::numeric
      OR orr.descrizione IS DISTINCT FROM ox->>'descrizione' OR orr.quantita<=0 OR orr.prezzo_unitario<=0
      OR x->>'iva' IS NULL OR ox->>'iva' IS NULL OR (x->>'iva')::numeric IS DISTINCT FROM (ox->>'iva')::numeric
      OR nullif(x->>'natura','') IS DISTINCT FROM nullif(ox->>'natura','') THEN
      RAISE EXCEPTION 'Riga origine/IVA non verificabile' USING ERRCODE='22023';
    END IF;
    PERFORM artecna_guardie.nc_accesso(q.cantiere_id);
    quant := (e->>'quantita')::numeric;
    IF quant<=0 OR quant<>round(quant,6) OR q.quantita<=0 OR q.netto<=0 OR q.costo<=0 OR nullif(btrim(q.categoria),'') IS NULL
      OR (q.tipo IN ('economia','cantiere') AND q.cantiere_id IS NULL) THEN RAISE EXCEPTION 'Quota/destinazione non verificabile' USING ERRCODE='22023'; END IF;
    -- Una spesa ha un importo, non un prezzo unitario proprio: il suo netto
    -- verificabile è quello della riga XML, inclusi gli sconti già documentati.
    IF q.tipo='spesa' THEN q.netto := (ox->>'totale')::numeric; END IF;
    IF q.netto<=0 OR round(q.netto,2) IS DISTINCT FROM round((ox->>'totale')::numeric*q.quantita/orr.quantita,2)
      OR (round(q.costo,2) IS DISTINCT FROM round(q.netto,2)
        AND round(q.costo,2) IS DISTINCT FROM round(q.netto*(1+(ox->>'iva')::numeric/100),2)) THEN
      RAISE EXCEPTION 'Valorizzazione originaria non coerente con XML: riconciliazione specifica necessaria' USING ERRCODE='22023';
    END IF;
    SELECT sum(quantita) INTO somma FROM artecna_guardie.nc_quote(p_origine_id) WHERE origine_riga_id=orr.id;
    IF somma>orr.quantita THEN RAISE EXCEPTION 'Origine con quote sovrapposte: riconciliazione necessaria' USING ERRCODE='22023'; END IF;
    -- Riparto al centesimo cumulativo: conserva esattamente il totale XML della riga.
    SELECT coalesce(sum((value->>'quantita')::numeric),0) INTO intera FROM jsonb_array_elements(payload) z
      WHERE z.value->>'nota_riga_id'=e->>'nota_riga_id'
      AND (z.value->>'tipo',z.value->>'quota_id') < (e->>'tipo',e->>'quota_id');
    importo := round((x->>'totale')::numeric*coeff*(intera+quant)/abs(nr.quantita),2)-round((x->>'totale')::numeric*coeff*intera/abs(nr.quantita),2);
    -- La base costo deriva dai decimali XML, NON dal netto già arrotondato:
    -- evita il centesimo spurio, ad esempio -1.97540984 con costo IVA inclusa.
    costo := round((x->>'totale')::numeric*coeff*(intera+quant)/abs(nr.quantita)*q.costo/q.netto,2)
      - round((x->>'totale')::numeric*coeff*intera/abs(nr.quantita)*q.costo/q.netto,2);
    SELECT coalesce(sum(r.quantita),0),coalesce(sum(-r.importo_netto),0),coalesce(sum(-r.importo_costo),0)
      INTO usata_q,usata_netto,usata_costo FROM public.fornitori_rettifiche r
      WHERE CASE q.tipo WHEN 'economia' THEN r.economia_riga_id WHEN 'cantiere' THEN r.materiale_cantiere_id WHEN 'impresa' THEN r.materiale_impresa_id WHEN 'spesa' THEN r.spesa_impresa_id END=q.id;
    IF importo>=0 OR costo>=0 OR -importo>round(q.netto*quant/q.quantita,2) OR -costo>round(q.costo*quant/q.quantita,2) OR quant+usata_q>q.quantita OR -importo+usata_netto>round(q.netto,2) OR -costo+usata_costo>round(q.costo,2) THEN
      RAISE EXCEPTION 'Rettifica eccedente la quota originaria disponibile' USING ERRCODE='22023';
    END IF;
    INSERT INTO public.fornitori_rettifiche(nota_id,nota_riga_id,origine_id,origine_riga_id,economia_riga_id,materiale_cantiere_id,
      materiale_impresa_id,spesa_impresa_id,cantiere_id,categoria,quantita,importo_netto,importo_costo,data_nota,richiesta_id,richiesta,fotografia,created_by)
      VALUES(p_nota_id,nr.id,p_origine_id,orr.id,CASE WHEN q.tipo='economia' THEN q.id END,CASE WHEN q.tipo='cantiere' THEN q.id END,
      CASE WHEN q.tipo='impresa' THEN q.id END,CASE WHEN q.tipo='spesa' THEN q.id END,q.cantiere_id,q.categoria,quant,importo,costo,(n->>'data')::date,
      p_richiesta_id,payload,jsonb_build_object('nota_xml',n,'origine_xml',o,'quota',to_jsonb(q),'riga_nota_originale',to_jsonb(nr),'riga_origine_originale',to_jsonb(orr)),artecna_guardie.utente_jwt_corrente());
  END LOOP;
  RETURN public.leggi_nota_credito_fornitore(p_nota_id);
END $function$
;
ALTER FUNCTION public.applica_nota_credito_fornitore(uuid,uuid,jsonb,uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.leggi_costi_fornitori_rettificati(p_cantiere_id uuid DEFAULT NULL::uuid, p_da date DEFAULT NULL::date, p_a date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE u uuid := artecna_guardie.utente_jwt_corrente(); quote jsonb; rettifiche jsonb;
BEGIN
  PERFORM artecna_guardie.nc_accesso(p_cantiere_id);
  IF p_da>p_a THEN RAISE EXCEPTION 'Intervallo non valido' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.fatture_fornitori f CROSS JOIN LATERAL artecna_guardie.nc_quote(f.id) q
    WHERE artecna_guardie.nc_tipo(f.id)='TD04' AND (p_cantiere_id IS NULL OR q.cantiere_id=p_cantiere_id)
      AND (q.cantiere_id IS NULL OR artecna_guardie.utente_puo_modificare_cantiere(u,q.cantiere_id))
      AND (p_da IS NULL OR f.data_fattura>=p_da) AND (p_a IS NULL OR f.data_fattura<=p_a)) THEN
    RAISE EXCEPTION 'Costi non certificabili: assegnazioni ordinarie TD04 storiche da riconciliare' USING ERRCODE='22023';
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(q)||jsonb_build_object('documento_id',f.id,'data',f.data_fattura) ORDER BY f.id,q.tipo,q.id),'[]') INTO quote
    FROM public.fatture_fornitori f CROSS JOIN LATERAL artecna_guardie.nc_quote(f.id) q
    WHERE artecna_guardie.nc_tipo(f.id) IS DISTINCT FROM 'TD04'
      AND (p_cantiere_id IS NULL OR q.cantiere_id=p_cantiere_id)
      AND (q.cantiere_id IS NULL OR artecna_guardie.utente_puo_modificare_cantiere(u,q.cantiere_id))
      AND (p_da IS NULL OR f.data_fattura>=p_da) AND (p_a IS NULL OR f.data_fattura<=p_a);
  SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.data_nota,r.id),'[]') INTO rettifiche FROM public.fornitori_rettifiche r
    WHERE (p_cantiere_id IS NULL OR r.cantiere_id=p_cantiere_id)
      AND (r.cantiere_id IS NULL OR artecna_guardie.utente_puo_modificare_cantiere(u,r.cantiere_id))
      AND (p_da IS NULL OR r.data_nota>=p_da) AND (p_a IS NULL OR r.data_nota<=p_a);
  RETURN jsonb_build_object('quote',quote,'rettifiche',rettifiche,'perimetro','Impresa e Cantieri autorizzati; date dei rispettivi documenti');
END $function$
;
ALTER FUNCTION public.leggi_costi_fornitori_rettificati(uuid,date,date) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.valorizza_materiale_economia(p_raccolta_id uuid, p_riga_id uuid, p_prezzo_cliente numeric, p_revisione_attesa bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE uid uuid; cid uuid; r public.economia_raccolte%rowtype; e public.economia_righe%rowtype; j jsonb;
BEGIN
 uid:=artecna_guardie.utente_jwt_corrente();
 SELECT cantiere_id INTO cid FROM public.economia_raccolte WHERE id=p_raccolta_id;
 IF uid IS NULL OR cid IS NULL THEN RAISE EXCEPTION 'Raccolta non autorizzata' USING ERRCODE='42501'; END IF;
 PERFORM id FROM public.cantieri WHERE id=cid FOR UPDATE;
 IF artecna_guardie.utente_puo_modificare_cantiere(uid,cid) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Cantiere non autorizzato' USING ERRCODE='42501'; END IF;
 PERFORM user_id FROM public.utenti_cantiere WHERE cantiere_id=cid AND user_id=uid AND ruolo='owner' FOR SHARE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(uid,cid) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Owner non autorizzato' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.economia_raccolte WHERE id=p_raccolta_id FOR UPDATE;
 IF r.stato IS DISTINCT FROM 'bozza' OR EXISTS(SELECT 1 FROM public.variante_sorgenti WHERE economia_raccolta_id=r.id AND tipo='raccolta_economia') THEN RAISE EXCEPTION 'Raccolta congelata' USING ERRCODE='55000'; END IF;
 IF p_revisione_attesa IS NULL OR r.revisione IS DISTINCT FROM p_revisione_attesa THEN RAISE EXCEPTION 'Revisione Economia divergente' USING ERRCODE='PT409'; END IF;
 SELECT * INTO e FROM public.economia_righe WHERE id=p_riga_id AND raccolta_id=r.id FOR UPDATE;
 IF NOT FOUND OR e.tipo_riga<>'materiale' THEN RAISE EXCEPTION 'Registrazione materiale non valida' USING ERRCODE='22023'; END IF;
 IF artecna_guardie.riga_esclusa_proposta(e) THEN RAISE EXCEPTION 'Ripristinare inclusione prima di valorizzare' USING ERRCODE='22023'; END IF;
 IF e.quantita IS NULL OR e.quantita<=0 OR e.quantita::text IN ('NaN','Infinity','-Infinity') OR p_prezzo_cliente IS NULL OR p_prezzo_cliente::text IN ('NaN','Infinity','-Infinity') OR p_prezzo_cliente<=0 OR p_prezzo_cliente>=1000000000000 OR p_prezzo_cliente<>round(p_prezzo_cliente,6)
 OR round(e.quantita*p_prezzo_cliente,2)<=0 OR round(e.quantita*p_prezzo_cliente,2)>=10000000000000000 THEN RAISE EXCEPTION 'Prezzo cliente non valido' USING ERRCODE='22023'; END IF;
 IF e.fattura_riga_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.fatture_fornitori_righe f WHERE f.id=e.fattura_riga_id AND artecna_guardie.nc_tipo(f.fattura_id)='TD04') THEN RAISE EXCEPTION 'TD04 escluso dal prezzo cliente materiali ordinario' USING ERRCODE='22023'; END IF;
 IF e.origine='fattura_fornitore' THEN PERFORM artecna_guardie.verifica_materiale_fattura_economia(e); END IF;
 j:=jsonb_build_object('versione',1,'prezzo',p_prezzo_cliente,'storico',coalesce(e.dettagli_analitici->'cliente_materiale'->'storico','[]'::jsonb)||jsonb_build_array(jsonb_build_object('prezzo',p_prezzo_cliente,'precedente',artecna_guardie.prezzo_materiale_cliente(e),'utente',uid,'at',clock_timestamp(),'revisione_precedente',r.revisione)));
 UPDATE public.economia_righe SET dettagli_analitici=coalesce(dettagli_analitici,'{}'::jsonb)||jsonb_build_object('cliente_materiale',j),updated_at=now() WHERE id=e.id RETURNING * INTO e;
 UPDATE public.economia_raccolte SET revisione=revisione+1,updated_at=now() WHERE id=r.id RETURNING * INTO r;
 RETURN jsonb_build_object('raccolta',to_jsonb(r),'riga',to_jsonb(e),'prezzo_cliente',p_prezzo_cliente,'totale_riga',round(e.quantita*p_prezzo_cliente,2));
END $function$
;
ALTER FUNCTION public.valorizza_materiale_economia(uuid,uuid,numeric,bigint) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.leggi_raccolta_economia_cliente(p_raccolta_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE d jsonb; c public.economia_raccolte%rowtype; uid uuid; BEGIN
 uid:=artecna_guardie.utente_jwt_corrente(); SELECT * INTO c FROM public.economia_raccolte WHERE id=p_raccolta_id;
 IF NOT FOUND OR uid IS NULL OR artecna_guardie.utente_puo_modificare_cantiere(uid,c.cantiere_id) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Raccolta non autorizzata' USING ERRCODE='42501'; END IF;
 d:=jsonb_build_object('raccolta',to_jsonb(c),'sorgenti',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY created_at,id) FROM public.economia_sorgenti s WHERE raccolta_id=c.id),'[]'::jsonb));
 RETURN d||jsonb_build_object('numero_registrazioni',(SELECT count(*) FROM public.economia_righe WHERE raccolta_id=c.id),'numero_escluse',(SELECT count(*) FROM public.economia_righe e WHERE raccolta_id=c.id AND artecna_guardie.riga_esclusa_proposta(e)), 'totale',(SELECT sum(round(e.quantita*artecna_guardie.prezzo_materiale_cliente(e),2)) FILTER(WHERE NOT artecna_guardie.riga_esclusa_proposta(e)) FROM public.economia_righe e WHERE raccolta_id=p_raccolta_id),
 'righe_non_valorizzate',(SELECT count(*) FROM public.economia_righe e WHERE raccolta_id=p_raccolta_id AND NOT artecna_guardie.riga_esclusa_proposta(e) AND artecna_guardie.prezzo_materiale_cliente(e) IS NULL),
 'righe',coalesce((SELECT jsonb_agg(to_jsonb(e)||jsonb_build_object('prezzo_unitario_origine',e.prezzo_unitario,'prezzo_unitario',artecna_guardie.prezzo_materiale_cliente(e),'totale',round(e.quantita*artecna_guardie.prezzo_materiale_cliente(e),2),'esclusa_proposta',artecna_guardie.riga_esclusa_proposta(e),'motivo_esclusione',e.dettagli_analitici->'proposta_non_economica'->>'motivo') ORDER BY ordine,id) FROM public.economia_righe e WHERE raccolta_id=p_raccolta_id),'[]'::jsonb));
END $function$
;
ALTER FUNCTION public.leggi_raccolta_economia_cliente(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.leggi_raccolte_economia_cliente(p_cantiere_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE originali jsonb; v jsonb; d jsonb; risultato jsonb:='[]'; BEGIN
 IF artecna_guardie.utente_jwt_corrente() IS NULL OR artecna_guardie.utente_puo_modificare_cantiere(artecna_guardie.utente_jwt_corrente(),p_cantiere_id) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Cantiere non autorizzato' USING ERRCODE='42501'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY numero),'[]'::jsonb) INTO originali FROM public.economia_raccolte r WHERE cantiere_id=p_cantiere_id;
 FOR v IN SELECT value FROM jsonb_array_elements(originali) LOOP
 d:=public.leggi_raccolta_economia_cliente((v->>'id')::uuid);
 risultato:=risultato||jsonb_build_array(v||jsonb_build_object('totale',d->'totale','righe_non_valorizzate',d->'righe_non_valorizzate','numero_registrazioni',d->'numero_registrazioni','numero_escluse',d->'numero_escluse'));
 END LOOP; RETURN risultato; END $function$
;
ALTER FUNCTION public.leggi_raccolte_economia_cliente(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.usa_raccolta_economia_cliente_in_variante(p_raccolta_id uuid, p_revisione_attesa bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE utente uuid; cid uuid; c public.cantieri%rowtype; r public.economia_raccolte%rowtype;
 v public.varianti_cantiere%rowtype; s public.variante_sorgenti%rowtype; es public.economia_sorgenti%rowtype;
 er public.economia_righe%rowtype; revision_s bigint; revision_f bigint; registrazioni jsonb:='[]'; snap jsonb;
 prezzo_cliente numeric; importo numeric(18,2); totale numeric(18,2):=0; n integer:=0; collegata uuid; riuso boolean:=false; voce jsonb; esclusa boolean; indice integer:=0; con_esclusioni boolean:=true;
BEGIN
 IF current_user<>'postgres' THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Contesto RPC non consentito'; END IF;
 IF p_raccolta_id IS NULL OR p_revisione_attesa IS NULL OR p_revisione_attesa<0 THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Input acquisizione non valido'; END IF;
 utente:=artecna_guardie.utente_jwt_corrente();
 SELECT cantiere_id INTO cid FROM public.economia_raccolte WHERE id=p_raccolta_id;
 IF utente IS NULL OR cid IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Acquisizione non autorizzata'; END IF;
 SELECT * INTO c FROM public.cantieri WHERE id=cid FOR UPDATE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(utente,cid) IS DISTINCT FROM true THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non autorizzato'; END IF;
 PERFORM user_id FROM public.utenti_cantiere WHERE cantiere_id=cid AND user_id=utente AND ruolo='owner' FOR SHARE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(utente,cid) IS DISTINCT FROM true THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner non autorizzato'; END IF;
 -- Nessun lock Preventivo prima della Variante; il cantiere ne serializza il riferimento.
 IF c.preventivo_contrattuale_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.preventivi_cantiere
   WHERE id=c.preventivo_contrattuale_id AND cantiere_id=cid) THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Contesto contrattuale non valido'; END IF;
 SELECT variante_id INTO collegata FROM public.variante_sorgenti
   WHERE economia_raccolta_id=p_raccolta_id AND tipo='raccolta_economia';
 IF collegata IS NOT NULL THEN
   SELECT * INTO v FROM public.varianti_cantiere WHERE id=collegata FOR UPDATE;
   IF NOT FOUND OR v.cantiere_id<>cid OR v.preventivo_contrattuale_id<>c.preventivo_contrattuale_id THEN
     RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Variante collegata incoerente'; END IF;
   riuso:=true;
 END IF;
 SELECT * INTO r FROM public.economia_raccolte WHERE id=p_raccolta_id AND cantiere_id=cid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Raccolta non autorizzata'; END IF;
 IF riuso THEN
   SELECT * INTO s FROM public.variante_sorgenti WHERE economia_raccolta_id=r.id AND tipo='raccolta_economia';
   IF NOT FOUND OR s.variante_id<>v.id OR r.stato<>'chiusa' OR r.revisione<>s.economia_revisione_congelata THEN
     RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Collegamento Economia incoerente'; END IF;
   revision_s:=s.economia_revisione_sorgente; revision_f:=s.economia_revisione_congelata;
 ELSE
   IF r.revisione<>p_revisione_attesa THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Revisione Economia divergente'; END IF;
   IF r.stato NOT IN ('bozza','chiusa') THEN RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato Economia incoerente'; END IF;
   revision_s:=r.revisione;
   IF r.stato='bozza' AND r.revisione=9223372036854775807 THEN
     RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Revisione non rappresentabile'; END IF;
   revision_f:=r.revisione+CASE WHEN r.stato='bozza' THEN 1 ELSE 0 END;
 END IF;
 IF riuso THEN con_esclusioni:=s.snapshot->>'versione_esclusioni'='1'; END IF;
 -- Le sorgenti precedono le righe, entrambe ordinate, dopo la testata Raccolta.
 PERFORM id FROM public.economia_sorgenti WHERE raccolta_id=r.id ORDER BY id FOR SHARE;
 FOR er IN SELECT * FROM public.economia_righe WHERE raccolta_id=r.id ORDER BY ordine,id FOR SHARE LOOP
   prezzo_cliente:=artecna_guardie.prezzo_materiale_cliente(er);
   esclusa:=artecna_guardie.riga_esclusa_proposta(er);
   IF NOT esclusa AND (er.quantita<=0 OR prezzo_cliente IS NULL OR prezzo_cliente<=0
     OR er.quantita::text IN ('NaN','Infinity','-Infinity') OR prezzo_cliente::text IN ('NaN','Infinity','-Infinity')
     OR er.descrizione !~ '[^[:space:]]') THEN
     RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Registrazione Economia non rappresentabile'; END IF;
   importo:=round(er.quantita*prezzo_cliente,2);
   IF NOT esclusa AND importo<=0 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Importo Economia non rappresentabile'; END IF;
   IF er.origine='fattura_fornitore' THEN
     PERFORM artecna_guardie.verifica_materiale_fattura_economia(er);
   ELSIF er.origine='rapportino' THEN
     PERFORM artecna_guardie.verifica_riga_economia_rapportino(er,NOT riuso);
   ELSE
   es:=NULL;
   IF er.tipo_riga<>'generica' THEN
     SELECT * INTO es FROM public.economia_sorgenti WHERE id=er.sorgente_id AND raccolta_id=r.id;
     IF NOT FOUND OR es.formato<>'excel' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Sorgente analitica non valida'; END IF;
   END IF;
   PERFORM public.economia_valida_dettagli(er.tipo_riga,er.dettagli_analitici-ARRAY['cliente_materiale','proposta_non_economica'],es.snapshot,es.snapshot_version,
     er.indice_voce_sorgente,er.quantita,er.prezzo_unitario,er.unita_misura,er.descrizione,true);
   END IF;
   IF NOT esclusa THEN n:=n+1; totale:=totale+importo; END IF;
   registrazioni:=registrazioni||jsonb_build_array(jsonb_build_object('id',er.id,'ordine',er.ordine,
     'descrizione',er.descrizione,'unita_misura',er.unita_misura,'quantita',er.quantita,'prezzo_unitario',prezzo_cliente,
     'importo',importo,'note',er.note,'origine',er.origine,'sorgente_id',er.sorgente_id,
     'indice_voce_sorgente',er.indice_voce_sorgente,'tipo_riga',er.tipo_riga,'dettagli_analitici',er.dettagli_analitici)||CASE WHEN con_esclusioni THEN jsonb_build_object('esclusa_proposta',esclusa) ELSE '{}'::jsonb END);
 END LOOP;
 IF n=0 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Raccolta Economia vuota'; END IF;
 snap:=jsonb_build_object('raccolta_id',r.id,'cantiere_id',cid,'numero',r.numero,'titolo',r.titolo,'data',r.data,'note',r.note,
   'revisione_sorgente',revision_s,'revisione_congelata',revision_f,'totale',totale,'numero_registrazioni',jsonb_array_length(registrazioni),'registrazioni',registrazioni,'versione_prezzi_cliente',1);
 IF con_esclusioni THEN snap:=snap||jsonb_build_object('versione_esclusioni',1,'numero_incluse',n,'numero_escluse',jsonb_array_length(registrazioni)-n); END IF;
 IF NOT riuso THEN
   IF r.stato='bozza' THEN
     UPDATE public.economia_raccolte SET stato='chiusa',chiusa_at=current_timestamp,revisione=revisione+1,updated_at=now() WHERE id=r.id;
     SELECT * INTO r FROM public.economia_raccolte WHERE id=p_raccolta_id;
     IF r.stato<>'chiusa' OR r.revisione<>revision_f THEN
       RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Chiusura Economia incoerente'; END IF;
   END IF;
   INSERT INTO public.varianti_cantiere(cantiere_id,preventivo_contrattuale_id,numero,titolo,descrizione,stato,data_variante)
     VALUES(cid,c.preventivo_contrattuale_id,NULL,r.titolo,coalesce(r.note,''),'bozza',r.data) RETURNING * INTO v;
   INSERT INTO public.variante_sorgenti(variante_id,tipo,titolo,snapshot_version,snapshot,economia_raccolta_id,
     economia_revisione_sorgente,economia_revisione_congelata)
     VALUES(v.id,'raccolta_economia',r.titolo,1,snap,r.id,revision_s,revision_f) RETURNING * INTO s;
   n:=0;
   FOR voce IN SELECT value FROM jsonb_array_elements(registrazioni) LOOP
     IF voce->>'esclusa_proposta'='true' THEN indice:=indice+1; CONTINUE; END IF;
     INSERT INTO public.variante_lavorazioni(variante_id,numero_riga,operazione,descrizione,unita_misura,
       quantita_delta,prezzo_unitario,delta_contratto,note,variante_sorgente_id,indice_voce_sorgente,
       riferimento_preventivo_lavorazione_id,riferimento_variante_lavorazione_id)
     VALUES(v.id,n+1,'nuova',voce->>'descrizione',voce->>'unita_misura',(voce->>'quantita')::numeric,
       (voce->>'prezzo_unitario')::numeric,(voce->>'importo')::numeric,coalesce(voce->>'note',''),s.id,indice,NULL,NULL);
     n:=n+1; indice:=indice+1;
   END LOOP;
 END IF;
 IF s.snapshot IS DISTINCT FROM (CASE WHEN s.snapshot ? 'versione_prezzi_cliente' THEN snap ELSE snap-'versione_prezzi_cliente' END) THEN RAISE EXCEPTION 'Snapshot acquisito divergente' USING ERRCODE='XX001'; END IF;
 PERFORM artecna_guardie.certifica_snapshot_cliente(snap);
 IF EXISTS(SELECT 1 FROM (SELECT z.voce,z.idx,row_number() OVER(ORDER BY z.idx) nr FROM jsonb_array_elements(registrazioni) WITH ORDINALITY z(voce,idx) WHERE coalesce(z.voce->>'esclusa_proposta','false')='false') x
 LEFT JOIN public.variante_lavorazioni l ON l.variante_id=v.id AND l.variante_sorgente_id=s.id AND l.indice_voce_sorgente=x.idx-1
 WHERE l.id IS NULL OR ROW(l.numero_riga,l.operazione,l.descrizione,l.unita_misura,l.quantita_delta,l.prezzo_unitario,l.delta_contratto,l.note)
 IS DISTINCT FROM ROW(x.nr::integer,'nuova'::text,x.voce->>'descrizione',x.voce->>'unita_misura',(x.voce->>'quantita')::numeric,(x.voce->>'prezzo_unitario')::numeric,(x.voce->>'importo')::numeric,coalesce(x.voce->>'note',''))
 OR l.riferimento_preventivo_lavorazione_id IS NOT NULL OR l.riferimento_variante_lavorazione_id IS NOT NULL) THEN RAISE EXCEPTION 'Lavorazioni cliente divergenti dallo snapshot' USING ERRCODE='XX001'; END IF;
 IF (SELECT count(*) FROM public.variante_lavorazioni WHERE variante_id=v.id)<>n OR (SELECT sum(delta_contratto) FROM public.variante_lavorazioni WHERE variante_id=v.id) IS DISTINCT FROM totale THEN RAISE EXCEPTION 'Riconciliazione cliente incoerente' USING ERRCODE='XX001'; END IF;
 RETURN jsonb_build_object('versione_contratto',1,'riutilizzata',riuso,'raccolta_id',r.id,
   'revisione_sorgente',revision_s,'revisione_congelata',revision_f,'variante_id',v.id,'numero_variante',v.numero,
   'stato_variante',v.stato,'variante_sorgente_id',s.id,'numero_lavorazioni',n,'totale',totale)||CASE WHEN con_esclusioni THEN jsonb_build_object('versione_esclusioni',1,'numero_registrazioni',jsonb_array_length(registrazioni),'numero_incluse',n,'numero_escluse',jsonb_array_length(registrazioni)-n) ELSE '{}'::jsonb END;
EXCEPTION
 WHEN numeric_value_out_of_range OR invalid_text_representation THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Registrazione Economia non rappresentabile';
 WHEN serialization_failure OR deadlock_detected THEN
   RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Conflitto concorrente Economia';
 WHEN SQLSTATE '22023' OR SQLSTATE '42501' OR SQLSTATE 'PT409' OR SQLSTATE 'XX001' THEN RAISE;
 WHEN OTHERS THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='Acquisizione Economia non completata';
END;
$function$
;
ALTER FUNCTION public.usa_raccolta_economia_cliente_in_variante(uuid,bigint) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.classifica_riga_non_economica(p_raccolta_id uuid, p_riga_id uuid, p_esclusa boolean, p_motivo text, p_revisione_attesa bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$

DECLARE uid uuid; cid uuid; r public.economia_raccolte%rowtype; e public.economia_righe%rowtype; j jsonb;
BEGIN
 uid:=artecna_guardie.utente_jwt_corrente();
 SELECT cantiere_id INTO cid FROM public.economia_raccolte WHERE id=p_raccolta_id;
 IF uid IS NULL OR cid IS NULL THEN RAISE EXCEPTION 'Raccolta non autorizzata' USING ERRCODE='42501'; END IF;
 PERFORM id FROM public.cantieri WHERE id=cid FOR UPDATE;
 IF artecna_guardie.utente_puo_modificare_cantiere(uid,cid) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Cantiere non autorizzato' USING ERRCODE='42501'; END IF;
 PERFORM user_id FROM public.utenti_cantiere WHERE cantiere_id=cid AND user_id=uid AND ruolo='owner' FOR SHARE;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(uid,cid) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Owner non autorizzato' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.economia_raccolte WHERE id=p_raccolta_id FOR UPDATE;
 IF r.stato IS DISTINCT FROM 'bozza' OR EXISTS(SELECT 1 FROM public.variante_sorgenti WHERE economia_raccolta_id=r.id AND tipo='raccolta_economia') THEN RAISE EXCEPTION 'Raccolta congelata' USING ERRCODE='55000'; END IF;
 IF p_revisione_attesa IS NULL OR r.revisione IS DISTINCT FROM p_revisione_attesa THEN RAISE EXCEPTION 'Revisione Economia divergente' USING ERRCODE='PT409'; END IF;
 SELECT * INTO e FROM public.economia_righe WHERE id=p_riga_id AND raccolta_id=r.id FOR UPDATE;
 IF NOT FOUND OR e.tipo_riga<>'materiale' THEN RAISE EXCEPTION 'Registrazione materiale non valida' USING ERRCODE='22023'; END IF;

 IF p_esclusa IS NULL OR p_motivo IS NULL OR length(trim(p_motivo)) NOT BETWEEN 10 AND 1000 THEN RAISE EXCEPTION 'Motivo esplicito richiesto (10-1000 caratteri)' USING ERRCODE='22023'; END IF;
 IF p_esclusa=artecna_guardie.riga_esclusa_proposta(e) THEN RAISE EXCEPTION 'Classificazione già presente' USING ERRCODE='22023'; END IF;
 IF p_esclusa AND artecna_guardie.prezzo_materiale_cliente(e) IS DISTINCT FROM 0::numeric THEN RAISE EXCEPTION 'Solo riga a valore zero escludibile' USING ERRCODE='22023'; END IF;
 IF e.fattura_riga_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.fatture_fornitori_righe f WHERE f.id=e.fattura_riga_id AND artecna_guardie.nc_tipo(f.fattura_id)='TD04') THEN RAISE EXCEPTION 'TD04 esclusa dal percorso' USING ERRCODE='22023'; END IF;
 IF e.origine='fattura_fornitore' THEN PERFORM artecna_guardie.verifica_materiale_fattura_economia(e); END IF;
 j:=jsonb_build_object('versione',1,'esclusa',p_esclusa,'motivo',trim(p_motivo),'storico',coalesce(e.dettagli_analitici->'proposta_non_economica'->'storico','[]'::jsonb)||jsonb_build_array(jsonb_build_object('esclusa',p_esclusa,'motivo',trim(p_motivo),'utente',uid,'at',clock_timestamp(),'revisione_precedente',r.revisione)));
 UPDATE public.economia_righe SET dettagli_analitici=coalesce(dettagli_analitici,'{}'::jsonb)||jsonb_build_object('proposta_non_economica',j),updated_at=now() WHERE id=e.id RETURNING * INTO e;
 UPDATE public.economia_raccolte SET revisione=revisione+1,updated_at=now() WHERE id=r.id RETURNING * INTO r;
 RETURN jsonb_build_object('raccolta',to_jsonb(r),'riga',to_jsonb(e),'esclusa',p_esclusa);
END $function$
;
ALTER FUNCTION public.classifica_riga_non_economica(uuid,uuid,boolean,text,bigint) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.leggi_identita_lavorazioni_variante(p_variante_id uuid)
 RETURNS TABLE(id bigint, variante_id uuid, variante_sorgente_id uuid, indice_voce_sorgente integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE v_user_id uuid; v_cantiere_id uuid; v_claim_sub uuid;
BEGIN
 IF current_user <> 'postgres' THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Contesto interno RPC Varianti non valido';
 END IF;
 BEGIN
  v_user_id := artecna_guardie.utente_jwt_corrente();
  -- Il guard resta autorevole; due rappresentazioni JWT presenti devono concordare.
  v_claim_sub := nullif(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub','')::uuid;
  IF v_claim_sub IS NOT NULL AND v_claim_sub IS DISTINCT FROM v_user_id THEN
   RAISE EXCEPTION USING ERRCODE='P2022',MESSAGE='Identità JWT incoerente';
  END IF;
 EXCEPTION WHEN invalid_text_representation THEN
  RAISE EXCEPTION USING ERRCODE='P2022',MESSAGE='Identità utente non valida';
 END;
 IF v_user_id IS NULL OR p_variante_id IS NULL THEN
  RAISE EXCEPTION USING ERRCODE='P2022',MESSAGE='Identità utente e variante sono obbligatorie';
 END IF;
 SELECT v.cantiere_id INTO v_cantiere_id FROM public.varianti_cantiere v WHERE v.id=p_variante_id;
 IF NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(v_user_id,v_cantiere_id) IS DISTINCT FROM TRUE THEN
  RAISE EXCEPTION USING ERRCODE='P2024',MESSAGE='Variante non disponibile o non autorizzata';
 END IF;
 RETURN QUERY SELECT l.id,l.variante_id,l.variante_sorgente_id,l.indice_voce_sorgente
 FROM public.variante_lavorazioni l WHERE l.variante_id=p_variante_id ORDER BY l.id;
END $function$
;
ALTER FUNCTION public.leggi_identita_lavorazioni_variante(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.preflight_eliminazione_sopralluogo(p_sopralluogo_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
 SET row_security TO 'off'
AS $function$
DECLARE allowed boolean := false;
BEGIN
  BEGIN
    allowed := auth.uid() IS NOT NULL AND public.quaderno_target_accessibile(p_sopralluogo_id) IS TRUE;
  EXCEPTION WHEN OTHERS THEN allowed := false;
  END;
  IF NOT allowed THEN RAISE EXCEPTION 'Accesso negato' USING ERRCODE='42501'; END IF;
  RETURN artecna_guardie.preflight_dipendenze('sopralluogo',p_sopralluogo_id);
END $function$
;
ALTER FUNCTION public.preflight_eliminazione_sopralluogo(text) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.preflight_eliminazione_cantiere(p_cantiere_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
 SET row_security TO 'off'
AS $function$
DECLARE allowed boolean := false;
BEGIN
  BEGIN
    allowed := auth.uid() IS NOT NULL AND
      artecna_guardie.utente_puo_modificare_cantiere(auth.uid(),p_cantiere_id) IS TRUE;
  EXCEPTION WHEN OTHERS THEN allowed := false;
  END;
  IF NOT allowed THEN RAISE EXCEPTION 'Accesso negato' USING ERRCODE='42501'; END IF;
  RETURN artecna_guardie.preflight_dipendenze('cantiere',p_cantiere_id::text);
END $function$
;
ALTER FUNCTION public.preflight_eliminazione_cantiere(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.crea_sessione_rapportino(p_pin text, p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE o record; n integer;
BEGIN
  IF p_pin IS NULL OR length(p_pin) NOT BETWEEN 1 AND 100 OR p_token IS NULL
    OR p_token !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Richiesta accesso non valida';
  END IF;
  SELECT count(*) INTO n FROM public.operai WHERE pin=p_pin;
  IF n<>1 THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='PIN non valido'; END IF;
  SELECT id,nome,accesso_portale,stato INTO o FROM public.operai WHERE pin=p_pin FOR SHARE;
  IF o.accesso_portale IS DISTINCT FROM true OR o.stato='sospeso' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Operaio non abilitato';
  END IF;
  INSERT INTO artecna_rapportini.sessioni_portale(token_sha256,operaio_id,scade_at)
    VALUES(sha256(convert_to(p_token,'UTF8')),o.id,clock_timestamp()+interval '8 hours');
  RETURN jsonb_build_object('operaio',jsonb_build_object('id',o.id,'nome',o.nome),
    'operai',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'nome',nome) ORDER BY nome,id),'[]')
      FROM public.operai WHERE stato IS DISTINCT FROM 'sospeso'),
    'cantieri',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'nome',nome) ORDER BY nome,id),'[]')
      FROM public.cantieri WHERE lavori_conclusi IS DISTINCT FROM true));
END;
$function$
;
ALTER FUNCTION public.crea_sessione_rapportino(text,text) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.verifica_sessione_rapportino(p_sessione text, p_cantiere_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE a record;
BEGIN
  IF p_sessione IS NULL OR p_cantiere_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Sessione e cantiere obbligatori';
  END IF;
  SELECT * INTO a FROM artecna_rapportini.autorizza(p_sessione,p_cantiere_id);
  RETURN jsonb_build_object('id',a.identita,'nome',a.compilatore_nome);
END;
$function$
;
ALTER FUNCTION public.verifica_sessione_rapportino(text,uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.varianti_rapportino_portale(p_sessione text, p_cantiere_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.verifica_sessione_rapportino(p_sessione,p_cantiere_id);
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'numero',numero,
    'etichetta',titolo,'selezionabile',stato='bozza') ORDER BY numero NULLS LAST,id),'[]')
    FROM public.varianti_cantiere WHERE cantiere_id=p_cantiere_id);
END;
$function$
;
ALTER FUNCTION public.varianti_rapportino_portale(text,uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.quaderno_copia_scrittura_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
declare r public.quaderno_richiami_sopralluogo;
begin
 if new.bucket_id <> 'quaderno-sopralluoghi' then return new; end if;
 -- Storage finalizza i metadati con un ruolo interno: owner_id conserva il proprietario della richiesta.
 -- Le policy RLS restano legate ad auth.uid(); il trigger serializza proprietario, stato e manifesto.
 select * into r from public.quaderno_richiami_sopralluogo where id::text=(storage.foldername(new.name))[4] and user_id::text=new.owner_id for update;
 if not found or r.user_id::text is distinct from new.owner_id or r.stato<>'preparazione' or not exists(select 1 from jsonb_array_elements(r.assets) a where a->>'storage_path'=new.name) then raise exception 'Upload non piu autorizzato' using errcode='42501'; end if;
 return new;
end;
$function$
;
ALTER FUNCTION public.quaderno_copia_scrittura_guard() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.quaderno_gestione_blocco()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
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
end; $function$
;
ALTER FUNCTION public.quaderno_gestione_blocco() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.quaderno_gestione_allegati_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
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
end; $function$
;
ALTER FUNCTION public.quaderno_gestione_allegati_guard() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.quaderno_gestione_storage_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
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
end; $function$
;
ALTER FUNCTION public.quaderno_gestione_storage_guard() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.quaderno_gestione_richiamo_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
declare p public.quaderno_progetti;
begin
 if new.stato<>'preparazione' then return new; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.user_id::text||':'||new.sopralluogo_id,0));
 if exists(select 1 from public.note_sopralluogo where user_id=new.user_id and sopralluogo_id=new.sopralluogo_id and gestione_id is not null) then raise exception 'Rimozione richiamo in corso' using errcode='55000'; end if;
 select * into p from public.quaderno_progetti where id=new.sorgente_id for share;
 if p.id is null or p.gestione_id is not null or p.gestione_copia then raise exception 'Sorgente non disponibile' using errcode='55000'; end if;
 return new;
end; $function$
;
ALTER FUNCTION public.quaderno_gestione_richiamo_guard() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.quaderno_filtra_richiamo(v jsonb, rid text, ids text[], pages text[], snapshot jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
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
end; $function$
;
ALTER FUNCTION public.quaderno_filtra_richiamo(jsonb,text,text[],text[],jsonb) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.proteggi_contrattuale_cantiere()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
 SET row_security TO 'off'
AS $function$
BEGIN

  IF OLD.preventivo_contrattuale_id IS NOT NULL
     AND NEW.preventivo_contrattuale_id IS NULL
     AND (to_jsonb(NEW) - 'preventivo_contrattuale_id')
         IS NOT DISTINCT FROM (to_jsonb(OLD) - 'preventivo_contrattuale_id')
     AND artecna_distruzione.contesto_valido(OLD.id) THEN
    RETURN NEW;
  END IF;
  IF OLD.preventivo_contrattuale_id
       IS DISTINCT FROM NEW.preventivo_contrattuale_id
  THEN
    IF artecna_guardie.base_congelata(
      OLD.preventivo_contrattuale_id,
      OLD.id
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P2001',
        MESSAGE =
          'Il preventivo contrattuale è congelato: esistono varianti approvate. Non è possibile sostituirlo o rimuoverlo.';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;
ALTER FUNCTION artecna_guardie.proteggi_contrattuale_cantiere() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.proteggi_preventivo_base()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
 SET row_security TO 'off'
AS $function$
BEGIN

  IF TG_OP = 'DELETE' THEN
    IF artecna_distruzione.contesto_valido(OLD.cantiere_id) THEN
      RETURN OLD;
    END IF;
  END IF;
  IF artecna_guardie.base_congelata(OLD.id) THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P2001',
      MESSAGE =
        'Questo preventivo costituisce una base contrattuale congelata da varianti approvate. Modifica ed eliminazione non consentite.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$function$
;
ALTER FUNCTION artecna_guardie.proteggi_preventivo_base() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.proteggi_lavorazione_base()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
 SET row_security TO 'off'
AS $function$
BEGIN

  IF TG_OP = 'DELETE' THEN
    IF artecna_distruzione.contesto_valido(OLD.cantiere_id) THEN
      RETURN OLD;
    END IF;
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    IF artecna_guardie.base_congelata(OLD.preventivo_id) THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P2001',
        MESSAGE =
          'La lavorazione appartiene a una base contrattuale congelata. Modifica, spostamento ed eliminazione non consentiti.';
    END IF;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    IF artecna_guardie.base_congelata(NEW.preventivo_id) THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P2001',
        MESSAGE =
          'Non è possibile aggiungere o spostare lavorazioni in una base contrattuale congelata.';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$function$
;
ALTER FUNCTION artecna_guardie.proteggi_lavorazione_base() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.proteggi_variante_testata()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
    percorso_interno boolean :=
        current_user = 'artecna_varianti_rpc';
BEGIN

  IF TG_OP = 'DELETE' AND current_user = 'artecna_cantieri_delete_rpc' THEN
    IF artecna_distruzione.contesto_valido(OLD.cantiere_id) THEN
      RETURN OLD;
    END IF;
  END IF;
    IF TG_OP = 'INSERT' THEN
        IF NEW.stato IS DISTINCT FROM 'bozza'
           OR NEW.numero IS NOT NULL
           OR NEW.importo_delta_approvato IS NOT NULL
           OR NEW.approvata_at IS NOT NULL
           OR NEW.riferimento_approvazione IS NOT NULL THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P2002',
                MESSAGE =
                    'Una variante deve nascere in bozza, senza numero o metadati di approvazione';
        END IF;

        RETURN NEW;
    END IF;

    IF OLD.stato IN ('approvata', 'rifiutata', 'annullata') THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2002',
            MESSAGE =
                'La variante storica non può essere modificata o eliminata';
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF OLD.stato IS DISTINCT FROM 'bozza' THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P2002',
                MESSAGE = 'È eliminabile soltanto una variante in bozza';
        END IF;

        -- Le FK RESTRICT restano responsabili dei riferimenti presenti.
        RETURN OLD;
    END IF;

    IF percorso_interno THEN
        IF NOT (
            (OLD.stato = 'bozza'
             AND NEW.stato IN ('proposta', 'annullata'))
            OR
            (OLD.stato = 'proposta'
             AND NEW.stato IN ('approvata', 'rifiutata', 'annullata'))
        ) THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P2002',
                MESSAGE = 'Transizione interna Variante non consentita';
        END IF;

        IF (
            to_jsonb(NEW) - ARRAY[
                'stato', 'numero', 'importo_delta_approvato',
                'approvata_at', 'riferimento_approvazione', 'updated_at'
            ]::text[]
        ) IS DISTINCT FROM (
            to_jsonb(OLD) - ARRAY[
                'stato', 'numero', 'importo_delta_approvato',
                'approvata_at', 'riferimento_approvazione', 'updated_at'
            ]::text[]
        ) THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P2002',
                MESSAGE =
                    'La transizione interna non può modificare il contenuto della variante';
        END IF;

        -- Il numero può essere assegnato solo durante la proposta.
        IF NOT (OLD.stato = 'bozza' AND NEW.stato = 'proposta')
           AND NEW.numero IS DISTINCT FROM OLD.numero THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P2002',
                MESSAGE =
                    'Il numero Variante è assegnabile soltanto durante la proposta';
        END IF;

        -- I CHECK strutturali esistenti validano numero e metadati.
        RETURN NEW;
    END IF;

    IF OLD.stato IS DISTINCT FROM 'bozza' THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2002',
            MESSAGE =
                'La variante proposta non è modificabile tramite CRUD ordinario';
    END IF;

    IF (
        to_jsonb(NEW) - ARRAY[
            'titolo', 'descrizione', 'data_variante', 'updated_at'
        ]::text[]
    ) IS DISTINCT FROM (
        to_jsonb(OLD) - ARRAY[
            'titolo', 'descrizione', 'data_variante', 'updated_at'
        ]::text[]
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2002',
            MESSAGE =
                'In bozza sono modificabili soltanto titolo, descrizione e data';
    END IF;

    RETURN NEW;
END;
$function$
;
ALTER FUNCTION artecna_guardie.proteggi_variante_testata() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.proteggi_variante_figlio()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
    proprietari uuid[];
    proprietario uuid;
    stato_proprietario text;
BEGIN

  IF TG_OP = 'DELETE' AND current_user = 'artecna_cantieri_delete_rpc'
     AND TG_TABLE_SCHEMA = 'public'
     AND TG_TABLE_NAME IN ('variante_lavorazioni', 'variante_documenti') THEN
    IF artecna_distruzione.contesto_variante_valido(OLD.variante_id) THEN
      RETURN OLD;
    END IF;
  END IF;
    IF TG_OP = 'INSERT' THEN
        proprietari := ARRAY[NEW.variante_id];
    ELSIF TG_OP = 'DELETE' THEN
        proprietari := ARRAY[OLD.variante_id];
    ELSE
        proprietari := ARRAY[OLD.variante_id, NEW.variante_id];
    END IF;

    IF array_position(proprietari, NULL::uuid) IS NOT NULL THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P2002',
            MESSAGE = 'La variante proprietaria è obbligatoria';
    END IF;

    -- Ordine deterministico quando vengono coinvolte due testate.
    FOR proprietario IN
        SELECT DISTINCT x.id
        FROM unnest(proprietari) AS x(id)
        ORDER BY x.id
    LOOP
        SELECT v.stato
        INTO stato_proprietario
        FROM public.varianti_cantiere v
        WHERE v.id = proprietario
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P2002',
                MESSAGE =
                    'Variante proprietaria assente o non accessibile';
        END IF;

        IF stato_proprietario IS DISTINCT FROM 'bozza' THEN
            RAISE EXCEPTION USING
                ERRCODE = 'P2002',
                MESSAGE =
                    'Righe e documenti sono modificabili soltanto in bozza';
        END IF;
    END LOOP;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$function$
;
ALTER FUNCTION artecna_guardie.proteggi_variante_figlio() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.proteggi_archiviazione_preventivo()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.archiviazione_key IS NULL
       AND NEW.archiviazione_payload_hash IS NULL THEN
      RETURN NEW;
    END IF;

    IF NEW.archiviazione_key IS NULL
       OR NEW.archiviazione_payload_hash IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P2049',
        MESSAGE = 'Key e fingerprint devono essere valorizzati insieme';
    END IF;

    IF current_user <> 'artecna_preventivi_rpc' THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P2049',
        MESSAGE = 'Metadati di archiviazione riservati alla RPC dedicata';
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.archiviazione_key IS DISTINCT FROM OLD.archiviazione_key
       OR NEW.archiviazione_payload_hash
          IS DISTINCT FROM OLD.archiviazione_payload_hash THEN
      RAISE EXCEPTION USING
        ERRCODE = 'P2049',
        MESSAGE = 'Key e fingerprint di archiviazione sono immutabili';
    END IF;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION USING
    ERRCODE = 'P2049',
    MESSAGE = 'Operazione inattesa nella guardia di archiviazione';
END;
$function$
;
ALTER FUNCTION artecna_guardie.proteggi_archiviazione_preventivo() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_rapportini.proteggi_proiezione()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE p public.rapportino_prestazioni%rowtype; c uuid; d date;
BEGIN
  IF NEW.prestazione_rapportino_id IS NULL AND
    (TG_OP='INSERT' OR OLD.prestazione_rapportino_id IS NULL) THEN RETURN NEW; END IF;
  IF current_user NOT IN ('postgres','artecna_rapportini_rpc') THEN
    RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Proiezione prestazione riservata al dominio Rapportini';
  END IF;
  IF NEW.prestazione_rapportino_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO p FROM public.rapportino_prestazioni WHERE id=NEW.prestazione_rapportino_id;
  IF NOT FOUND OR p.rimossa_at IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Prestazione proiettata assente/rimossa';
  END IF;
  SELECT cantiere_id,data INTO c,d FROM public.rapportini WHERE id=p.rapportino_id;
  IF NEW.rapportino_id IS DISTINCT FROM p.rapportino_id OR NEW.operaio_id IS DISTINCT FROM p.operaio_id
    OR NEW.cantiere_id IS DISTINCT FROM c OR NEW.data IS DISTINCT FROM to_char(d,'YYYY-MM-DD')
    OR NEW.ora_entrata IS DISTINCT FROM to_char(p.ora_inizio,'HH24:MI')
    OR NEW.ora_uscita IS DISTINCT FROM to_char(p.ora_fine,'HH24:MI')
    OR NEW.pausa_minuti IS DISTINCT FROM p.pausa_minuti THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Proiezione timbratura incoerente';
  END IF;
  RETURN NEW;
END;
$function$
;
ALTER FUNCTION artecna_rapportini.proteggi_proiezione() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_rapportini.proteggi_prestazione()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE c uuid;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Richiesta rimozione logica'; END IF;
  IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.rapportino_id IS DISTINCT FROM OLD.rapportino_id
    OR NEW.operaio_id IS DISTINCT FROM OLD.operaio_id OR NEW.chiave_client IS DISTINCT FROM OLD.chiave_client
    OR NEW.created_at IS DISTINCT FROM OLD.created_at OR OLD.rimossa_at IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Identità immutabile o prestazione rimossa';
  END IF;
  SELECT cantiere_id INTO c FROM public.rapportini WHERE id=NEW.rapportino_id FOR SHARE;
  IF c IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Rapportino senza cantiere valido'; END IF;
  IF NEW.variante_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('rapportino-variante:'||NEW.variante_id::text,0));
    IF NOT artecna_rapportini.variante_del_cantiere(NEW.variante_id,c) THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Variante fuori cantiere o inesistente';
    END IF;
  END IF;
  IF TG_OP='UPDATE' THEN NEW.revisione:=OLD.revisione+1; NEW.updated_at:=clock_timestamp(); END IF;
  RETURN NEW;
END;
$function$
;
ALTER FUNCTION artecna_rapportini.proteggi_prestazione() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_rapportini.proteggi_testata()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP='INSERT' THEN
    IF (NEW.versione_prestazioni<>0 OR NEW.revisione_prestazioni<>0)
      AND current_user NOT IN ('postgres','artecna_rapportini_rpc') THEN
      RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Versione iniziale riservata al dominio Rapportini';
    END IF;
    RETURN NEW;
  END IF;
    IF (NEW.versione_prestazioni IS DISTINCT FROM OLD.versione_prestazioni OR
        NEW.revisione_prestazioni IS DISTINCT FROM OLD.revisione_prestazioni)
        AND current_user NOT IN ('postgres','artecna_rapportini_rpc') THEN
      RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Revisioni riservate al dominio Rapportini';
    END IF;
    IF OLD.versione_prestazioni=1 AND
      (NEW.cantiere_id IS DISTINCT FROM OLD.cantiere_id OR NEW.data IS DISTINCT FROM OLD.data) THEN
      RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Cambio contesto strutturato riservato al servizio futuro';
    END IF;
  RETURN NEW;
END;
$function$
;
ALTER FUNCTION artecna_rapportini.proteggi_testata() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_rapportini.proteggi_cantiere_variante()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('rapportino-variante:'||OLD.id::text,0));
  IF NEW.cantiere_id IS DISTINCT FROM OLD.cantiere_id AND EXISTS
    (SELECT 1 FROM public.rapportino_prestazioni WHERE variante_id=OLD.id) THEN
    RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Variante collegata: cantiere immutabile';
  END IF;
  RETURN NEW;
END;
$function$
;
ALTER FUNCTION artecna_rapportini.proteggi_cantiere_variante() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_rapportini.fotografa_costo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF NEW.costo_orario_interno_storico IS DISTINCT FROM OLD.costo_orario_interno_storico THEN
      RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Costo storico prestazione immutabile';
    END IF;
  ELSE
    IF NEW.costo_orario_interno_storico IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Costo prestazione assegnato esclusivamente dal server';
    END IF;
    -- FOR SHARE serializza la fotografia con modifiche concurrenti in Anagrafica.
    SELECT costo_orario INTO NEW.costo_orario_interno_storico FROM public.operai
      WHERE id=NEW.operaio_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Operaio inesistente'; END IF;
    IF NEW.costo_orario_interno_storico IS NULL THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Costo orario operaio non valorizzato';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;
ALTER FUNCTION artecna_rapportini.fotografa_costo() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_rapportini.proteggi_strutturato()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE protetto boolean;
BEGIN
  IF current_user IN ('postgres','artecna_rapportini_rpc') THEN
    IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_TABLE_NAME='rapportini' THEN
    protetto:=OLD.versione_prestazioni=1;
  ELSE
    SELECT EXISTS(SELECT 1 FROM public.rapportini WHERE versione_prestazioni=1 AND
      ((TG_OP<>'INSERT' AND id=OLD.rapportino_id) OR (TG_OP<>'DELETE' AND id=NEW.rapportino_id))) INTO protetto;
  END IF;
  IF protetto THEN RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Rapportino strutturato: usare il servizio unico'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$function$
;
ALTER FUNCTION artecna_rapportini.proteggi_strutturato() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_rapportini.autorizza_lettura_portale(p_sessione text, p_cantiere_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE abilitato boolean; stato_operaio text;
BEGIN
  IF p_sessione IS NULL OR p_sessione !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION USING ERRCODE='PR401',MESSAGE='Sessione portale assente o non valida';
  END IF;
  SELECT o.accesso_portale,o.stato INTO abilitato,stato_operaio
    FROM artecna_rapportini.sessioni_portale s JOIN public.operai o ON o.id=s.operaio_id
    WHERE s.token_sha256=pg_catalog.sha256(pg_catalog.convert_to(p_sessione,'UTF8'))
      AND s.revocata_at IS NULL AND s.scade_at>pg_catalog.statement_timestamp();
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='PR401',MESSAGE='Sessione portale assente, scaduta o revocata';
  END IF;
  IF abilitato IS DISTINCT FROM true OR stato_operaio='sospeso' THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Accesso Rapportini non consentito';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cantieri c WHERE c.id=p_cantiere_id
    AND c.lavori_conclusi IS DISTINCT FROM true) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non consentito';
  END IF;
END;
$function$
;
ALTER FUNCTION artecna_rapportini.autorizza_lettura_portale(text,uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_rapportini.accesso_allegato_finalizzato(p_id uuid, p_rapportino uuid, p_cantiere uuid, p_data date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE a record; f record; v_ext text; v_path text;
BEGIN
  SELECT id,rapportino_id,cantiere_id,chiave_client_allegato,stato,bucket,file_path,mime_type,byte_size,
    finalized_at,foto_cantiere_id,removed_at,lease_id,lease_until INTO a FROM artecna_rapportini.allegati WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Allegato non disponibile'; END IF;
  IF a.rapportino_id IS DISTINCT FROM p_rapportino OR a.cantiere_id IS DISTINCT FROM p_cantiere THEN
    RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Contesto allegato non valido';
  END IF;
  IF a.stato IN ('prenotato','scaduto','cancellazione_pending','cancellato') THEN
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Allegato non disponibile';
  END IF;
  IF a.stato IS DISTINCT FROM 'finalizzato' OR a.finalized_at IS NULL OR a.foto_cantiere_id IS NULL
    OR a.removed_at IS NOT NULL OR a.lease_id IS NOT NULL OR a.lease_until IS NOT NULL
    OR a.chiave_client_allegato IS NULL OR a.byte_size IS NULL OR a.byte_size NOT BETWEEN 1 AND 4000000 THEN
    RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
  END IF;
  v_ext:=CASE a.mime_type WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/png' THEN 'png' WHEN 'image/webp' THEN 'webp' END;
  v_path:='rapportini/'||p_cantiere::text||'/'||p_rapportino::text||'/'||a.chiave_client_allegato::text||'.'||v_ext;
  IF v_ext IS NULL OR a.bucket IS DISTINCT FROM 'rapportini-v1' OR a.file_path IS DISTINCT FROM v_path THEN
    RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Oggetto allegato non valido';
  END IF;
  SELECT allegato_v1_id,cantiere_id,rapportino_id,categoria,data_foto,file_url,file_path,immagine_base64,thumbnail_url,
    storage_provider,sync_status INTO f FROM public.foto_cantiere WHERE id=a.foto_cantiere_id;
  IF NOT FOUND OR f.allegato_v1_id IS DISTINCT FROM a.id OR f.cantiere_id IS DISTINCT FROM p_cantiere OR f.rapportino_id IS DISTINCT FROM p_rapportino::text
    OR f.categoria IS DISTINCT FROM 'rapportino' OR f.data_foto::text IS DISTINCT FROM p_data::text
    OR f.file_url IS NOT NULL OR f.file_path IS NOT NULL OR f.immagine_base64 IS DISTINCT FROM ''
    OR f.thumbnail_url IS NOT NULL OR f.storage_provider IS DISTINCT FROM 'cloud' OR f.sync_status IS DISTINCT FROM 'not_required' THEN
    RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Proiezione allegato non valida';
  END IF;
  -- Solo server: non è il DTO browser AutorizzazioneAccessoAllegato (URL futuro).
  RETURN pg_catalog.jsonb_build_object('versione_contratto',1,'allegato_id',a.id,'bucket',a.bucket,
    'file_path',a.file_path,'mime_type',a.mime_type,'byte_size',a.byte_size);
END;
$function$
;
ALTER FUNCTION artecna_rapportini.accesso_allegato_finalizzato(uuid,uuid,uuid,date) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.proteggi_ponte_economia()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE ids uuid[]; sorgenti uuid[]; v uuid; coinvolge boolean:=false;
 s public.variante_sorgenti%rowtype; r public.economia_raccolte%rowtype; voce jsonb;
BEGIN
 IF TG_TABLE_SCHEMA<>'public' OR TG_TABLE_NAME NOT IN ('variante_sorgenti','variante_lavorazioni')
   OR TG_OP NOT IN ('INSERT','UPDATE','DELETE') THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Contesto ponte non consentito'; END IF;
 IF TG_OP='INSERT' THEN ids:=ARRAY[NEW.variante_id];
 ELSIF TG_OP='DELETE' THEN ids:=ARRAY[OLD.variante_id];
 ELSE ids:=ARRAY[OLD.variante_id,NEW.variante_id]; END IF;
 IF TG_TABLE_NAME='variante_sorgenti' THEN
   IF TG_OP<>'INSERT' THEN coinvolge:=coalesce(OLD.tipo='raccolta_economia',false); END IF;
   IF TG_OP<>'DELETE' THEN coinvolge:=coinvolge OR coalesce(NEW.tipo='raccolta_economia',false); END IF;
 ELSE
   IF TG_OP='INSERT' THEN sorgenti:=ARRAY[NEW.variante_sorgente_id];
   ELSIF TG_OP='DELETE' THEN sorgenti:=ARRAY[OLD.variante_sorgente_id];
   ELSE sorgenti:=ARRAY[OLD.variante_sorgente_id,NEW.variante_sorgente_id]; END IF;
   coinvolge:=EXISTS(SELECT 1 FROM public.variante_sorgenti WHERE id=ANY(sorgenti) AND tipo='raccolta_economia');
 END IF;
 coinvolge:=coinvolge OR EXISTS(SELECT 1 FROM public.variante_sorgenti WHERE variante_id=ANY(ids) AND tipo='raccolta_economia');
 IF NOT coinvolge THEN IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
 FOR v IN SELECT DISTINCT x FROM unnest(ids) x WHERE x IS NOT NULL ORDER BY x LOOP
   PERFORM 1 FROM public.varianti_cantiere WHERE id=v FOR UPDATE;
 END LOOP;
 IF TG_OP<>'INSERT' OR current_user NOT IN ('artecna_ponte_economia_rpc','postgres') THEN
   RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Variante Economia dedicata immutabile'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.varianti_cantiere WHERE id=NEW.variante_id AND stato='bozza' AND numero IS NULL) THEN
   RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Contesto acquisizione incoerente'; END IF;
 IF TG_TABLE_NAME='variante_sorgenti' THEN
   IF NEW.tipo<>'raccolta_economia' OR EXISTS(SELECT 1 FROM public.variante_sorgenti WHERE variante_id=NEW.variante_id)
     OR EXISTS(SELECT 1 FROM public.variante_lavorazioni WHERE variante_id=NEW.variante_id) THEN
     RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Sorgente aggiuntiva non consentita'; END IF;
   SELECT * INTO r FROM public.economia_raccolte WHERE id=NEW.economia_raccolta_id;
   IF NOT FOUND OR r.stato<>'chiusa' OR r.revisione IS DISTINCT FROM NEW.economia_revisione_congelata
     OR NOT EXISTS(SELECT 1 FROM public.varianti_cantiere WHERE id=NEW.variante_id AND cantiere_id=r.cantiere_id)
     OR NEW.snapshot_version<>1 OR NEW.snapshot->>'raccolta_id' IS DISTINCT FROM r.id::text THEN
     RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Sorgente acquisizione incoerente'; END IF;
 ELSE
   SELECT * INTO s FROM public.variante_sorgenti WHERE id=NEW.variante_sorgente_id
     AND variante_id=NEW.variante_id AND tipo='raccolta_economia';
   IF NOT FOUND OR NEW.indice_voce_sorgente IS NULL OR NEW.indice_voce_sorgente<0 THEN
     RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Lavorazione aggiuntiva non consentita'; END IF;
   voce:=s.snapshot->'registrazioni'->NEW.indice_voce_sorgente;
   IF voce IS NULL OR NEW.numero_riga IS DISTINCT FROM (SELECT count(*) FROM jsonb_array_elements(s.snapshot->'registrazioni') WITH ORDINALITY t(v,ord) WHERE t.ord<=NEW.indice_voce_sorgente+1 AND coalesce(t.v->>'esclusa_proposta','false')='false') OR NEW.operazione<>'nuova'
     OR NEW.descrizione IS DISTINCT FROM voce->>'descrizione'
     OR NEW.unita_misura IS DISTINCT FROM voce->>'unita_misura'
     OR NEW.quantita_delta IS DISTINCT FROM (voce->>'quantita')::numeric
     OR NEW.prezzo_unitario IS DISTINCT FROM (voce->>'prezzo_unitario')::numeric
     OR NEW.delta_contratto IS DISTINCT FROM (voce->>'importo')::numeric
     OR voce->>'esclusa_proposta'='true' OR NEW.note IS DISTINCT FROM coalesce(voce->>'note','')
     OR NEW.riferimento_preventivo_lavorazione_id IS NOT NULL OR NEW.riferimento_variante_lavorazione_id IS NOT NULL THEN
     RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Lavorazione acquisizione incoerente'; END IF;
 END IF;
 IF current_user='artecna_ponte_economia_rpc' AND TG_TABLE_NAME='variante_sorgenti' THEN
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.snapshot->'registrazioni') x WHERE (x->'dettagli_analitici' ? 'cliente_materiale' OR x->'dettagli_analitici' ? 'proposta_non_economica')) THEN RAISE EXCEPTION 'Prezzo cliente presente: usare il ponte commerciale aggiornato' USING ERRCODE='22023'; END IF;
 END IF;
 IF current_user='postgres' THEN
  IF TG_TABLE_NAME='variante_sorgenti' THEN PERFORM artecna_guardie.certifica_snapshot_cliente(NEW.snapshot); ELSE PERFORM artecna_guardie.certifica_snapshot_cliente(s.snapshot); END IF;
 END IF;
 RETURN NEW;
END;
$function$
;
ALTER FUNCTION artecna_guardie.proteggi_ponte_economia() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_rapportini.proteggi_versione_materiali()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP='UPDATE' AND OLD.versione_materiali=1 AND NEW.versione_materiali<>1 THEN
    RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Gestione materiali irreversibile';
  END IF;
  IF (TG_OP='INSERT' AND NEW.versione_materiali<>0)
    OR (TG_OP='UPDATE' AND NEW.versione_materiali IS DISTINCT FROM OLD.versione_materiali) THEN
    IF current_user <> 'artecna_rapportini_rpc' THEN
      RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Versione materiali riservata al dominio Rapportini';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;
ALTER FUNCTION artecna_rapportini.proteggi_versione_materiali() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_rapportini.proteggi_materiale()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE r record;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Richiesta rimozione logica'; END IF;
  IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.rapportino_id IS DISTINCT FROM OLD.rapportino_id
    OR NEW.chiave_client IS DISTINCT FROM OLD.chiave_client OR NEW.created_at IS DISTINCT FROM OLD.created_at
    OR OLD.rimossa_at IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Identità immutabile o materiale rimosso';
  END IF;
  SELECT versione_prestazioni,versione_materiali INTO r FROM public.rapportini WHERE id=NEW.rapportino_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Rapportino padre assente';
  END IF;
  IF r.versione_prestazioni IS DISTINCT FROM 1 OR r.versione_materiali IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Materiali strutturati non adottati';
  END IF;
  IF TG_OP='INSERT' THEN
    NEW.revisione:=0; NEW.created_at:=statement_timestamp();
  ELSE NEW.revisione:=OLD.revisione+1;
  END IF;
  NEW.updated_at:=statement_timestamp();
  RETURN NEW;
END;
$function$
;
ALTER FUNCTION artecna_rapportini.proteggi_materiale() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_rapportini.materiali_fail_closed()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
 IF current_user<>'artecna_rapportini_rpc' OR TG_OP='DELETE' THEN
 RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Materiali riservati al writer Rapportino'; END IF;
 RETURN NEW;
END;
$function$
;
ALTER FUNCTION artecna_rapportini.materiali_fail_closed() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_rapportini.salva_contratto_uno(p_payload jsonb, p_sessione text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  a record; r public.rapportini%rowtype; rid uuid; req uuid; c uuid; giorno date;
  prev artecna_rapportini.richieste%rowtype; h bytea; result jsonb; dominio jsonb;
  documento jsonb; costo numeric; ore_totali numeric; presenti integer; elenco text;
  context_before text; x record;
BEGIN
  -- Connessione dedicata: session_user resta il LOGIN anche dentro DEFINER.
  IF session_user = 'artecna_rapportini_backend' AND
    (p_sessione IS NULL OR p_sessione !~ '^[0-9a-f]{64}$') THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Backend Rapportini: sessione portale obbligatoria';
  END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR octet_length(p_payload::text)>1048576
    OR NOT(p_payload ?& ARRAY['versione_contratto','richiesta_id','rapportino_id','revisione_attesa','cantiere_id','data','prestazioni'])
    OR p_payload->'versione_contratto' IS DISTINCT FROM '1'::jsonb
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN
      ('versione_contratto','richiesta_id','rapportino_id','revisione_attesa','cantiere_id','data','prestazioni','documento'))
    OR coalesce(p_payload->>'data','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Envelope servizio Rapportino non valido';
  END IF;
  req:=(p_payload->>'richiesta_id')::uuid; c:=(p_payload->>'cantiere_id')::uuid;
  giorno:=(p_payload->>'data')::date; rid:=(p_payload->>'rapportino_id')::uuid;
  IF req IS NULL OR c IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='UUID richiesta/cantiere obbligatori'; END IF;
  SELECT * INTO a FROM artecna_rapportini.autorizza(p_sessione,c);
  PERFORM pg_advisory_xact_lock(hashtextextended(a.canale||a.identita::text||req::text,0));
  h:=sha256(convert_to(p_payload::text,'UTF8'));
  SELECT * INTO prev FROM artecna_rapportini.richieste
    WHERE canale=a.canale AND utente_id=a.identita AND richiesta_id=req;
  IF FOUND THEN
    IF prev.payload_sha256 IS DISTINCT FROM h THEN
      RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Richiesta idempotente con payload differente';
    END IF;
    RETURN prev.risultato;
  END IF;
  documento:=coalesce(p_payload->'documento','{}');
  IF jsonb_typeof(documento) IS DISTINCT FROM 'object' OR EXISTS
    (SELECT 1 FROM jsonb_object_keys(documento) k WHERE k NOT IN ('note','materiali','quantita_materiali')) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Documento non valido o costo client non ammesso';
  END IF;
  FOR x IN SELECT key,value FROM jsonb_each(documento) LOOP
    IF jsonb_typeof(x.value) IS DISTINCT FROM 'string' OR length(x.value#>>'{}')>20000 THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Campo documento non valido';
    END IF;
  END LOOP;
  IF rid IS NULL THEN
    IF p_payload->'rapportino_id' IS DISTINCT FROM 'null'::jsonb
      OR p_payload->'revisione_attesa' IS DISTINCT FROM 'null'::jsonb
      OR p_payload#>'{prestazioni,aggiornate}' IS DISTINCT FROM '[]'::jsonb
      OR p_payload#>'{prestazioni,rimosse}' IS DISTINCT FROM '[]'::jsonb THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Creazione con UUID/revisione/operazioni non validi';
    END IF;
    -- Regola legacy: un documento per cantiere/giorno, senza UNIQUE/backfill.
    PERFORM pg_advisory_xact_lock(hashtextextended('rapportino-giorno:'||c::text||giorno::text,0));
    IF EXISTS(SELECT 1 FROM public.rapportini WHERE cantiere_id=c AND data=giorno) THEN
      RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Rapportino già presente per questa data';
    END IF;
    INSERT INTO public.rapportini(cantiere_id,cantiere,data,versione_prestazioni,
      compilato_da_operaio_id,compilato_da_nome,note,materiali,quantita_materiali)
      SELECT c,nome,giorno,1,CASE WHEN a.canale='portale' THEN a.identita ELSE NULL END,
        a.compilatore_nome,coalesce(documento->>'note',''),coalesce(documento->>'materiali',''),
        coalesce(documento->>'quantita_materiali','') FROM public.cantieri WHERE id=c
      RETURNING * INTO r;
    rid:=r.id;
  ELSE
    SELECT * INTO r FROM public.rapportini WHERE id=rid FOR UPDATE;
    IF NOT FOUND OR r.cantiere_id IS DISTINCT FROM c OR r.data IS DISTINCT FROM giorno THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Rapportino/contesto non valido';
    END IF;
    IF r.versione_prestazioni<>1 THEN
      RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Rapportino legacy: conversione non consentita';
    END IF;
  END IF;
  context_before:=current_setting('artecna.rapportino_sessione',true);
  PERFORM set_config('artecna.rapportino_sessione',coalesce(p_sessione,''),true);
  dominio:=(p_payload-'documento')||jsonb_build_object('rapportino_id',rid,
    'revisione_attesa',CASE WHEN p_payload->'rapportino_id'='null'::jsonb THEN '0'::jsonb ELSE p_payload->'revisione_attesa' END);
  result:=artecna_rapportini.applica_prestazioni_rapportino(dominio);
  PERFORM set_config('artecna.rapportino_sessione',coalesce(context_before,''),true);
  -- Anche le sole modifiche del documento consumano la revisione aggregata.
  IF (result->>'revisione')::bigint=r.revisione_prestazioni AND
    (p_payload->'rapportino_id'='null'::jsonb OR
      (documento ? 'note' AND documento->>'note' IS DISTINCT FROM r.note) OR
      (documento ? 'materiali' AND documento->>'materiali' IS DISTINCT FROM r.materiali) OR
      (documento ? 'quantita_materiali' AND documento->>'quantita_materiali' IS DISTINCT FROM r.quantita_materiali)) THEN
    UPDATE public.rapportini SET revisione_prestazioni=revisione_prestazioni+1 WHERE id=rid;
  END IF;
  -- Costi numerici: arrotondamento a centesimi una sola volta sul totale.
  SELECT coalesce(sum(p.ore*p.costo_orario_interno_storico),0),coalesce(sum(p.ore),0),
    count(DISTINCT p.operaio_id),coalesce(string_agg(format('%s (%s / %s - %sh)',o.nome,
      to_char(p.ora_inizio,'HH24:MI'),to_char(p.ora_fine,'HH24:MI'),p.ore),', ' ORDER BY p.created_at,p.id),'')
    INTO costo,ore_totali,presenti,elenco FROM public.rapportino_prestazioni p
      JOIN public.operai o ON o.id=p.operaio_id WHERE p.rapportino_id=rid AND p.rimossa_at IS NULL;
  UPDATE public.rapportini SET costo_manodopera=round(costo,2)::double precision,
    ore=ore_totali::text,operai=elenco,numero_presenti=presenti::text,
    -- Campo legacy: media delle ore totali per operaio distinto, non per riga.
    ore_per_operaio=CASE WHEN presenti=0 THEN '0' ELSE (ore_totali/presenti)::text END,
    note=CASE WHEN documento ? 'note' THEN documento->>'note' ELSE note END,
    materiali=CASE WHEN documento ? 'materiali' THEN documento->>'materiali' ELSE materiali END,
    quantita_materiali=CASE WHEN documento ? 'quantita_materiali' THEN documento->>'quantita_materiali' ELSE quantita_materiali END
    WHERE id=rid RETURNING * INTO r;
  -- Proiezione ricreabile; l'identità persistente resta quella della prestazione.
  DELETE FROM public.timbrature WHERE rapportino_id=rid AND stato='da rapportino';
  INSERT INTO public.timbrature(prestazione_rapportino_id,rapportino_id,operaio_id,operaio_nome,
    cantiere_id,cantiere,data,ora_entrata,ora_uscita,pausa_minuti,stato)
    SELECT p.id,rid,p.operaio_id,o.nome,c,r.cantiere,to_char(giorno,'YYYY-MM-DD'),
      to_char(p.ora_inizio,'HH24:MI'),to_char(p.ora_fine,'HH24:MI'),p.pausa_minuti,'da rapportino'
      FROM public.rapportino_prestazioni p JOIN public.operai o ON o.id=p.operaio_id
      WHERE p.rapportino_id=rid AND p.rimossa_at IS NULL;
  -- Risposta operativa senza tariffe/costi/stati Economia (STEP 6).
  result:=jsonb_build_object('versione_contratto',1,'rapportino_id',rid,'revisione',r.revisione_prestazioni,
    'cantiere_id',c,'data',to_char(giorno,'YYYY-MM-DD'),'documento',jsonb_build_object(
      'note',r.note,'materiali',r.materiali,'quantita_materiali',r.quantita_materiali),
    'prestazioni',(SELECT coalesce(jsonb_agg(jsonb_build_object('prestazione_id',p.id,
      'chiave_client',p.chiave_client,'operaio_id',p.operaio_id,'operaio_nome',o.nome,
      'ora_inizio',to_char(p.ora_inizio,'HH24:MI'),'ora_fine',to_char(p.ora_fine,'HH24:MI'),
      'pausa_minuti',p.pausa_minuti,'ore',p.ore,'lavoro_in_economia',p.lavoro_in_economia,
      'variante_id',p.variante_id,'revisione',p.revisione,'rimossa_at',p.rimossa_at)
      ORDER BY p.created_at,p.id),'[]') FROM public.rapportino_prestazioni p
        JOIN public.operai o ON o.id=p.operaio_id WHERE p.rapportino_id=rid));
  UPDATE artecna_rapportini.richieste SET payload_sha256=h,risultato=result
    WHERE canale=a.canale AND utente_id=a.identita AND richiesta_id=req;
  RETURN result;
END;
$function$
;
ALTER FUNCTION artecna_rapportini.salva_contratto_uno(jsonb,text) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_rapportini.applica_prestazioni_contratto_due(p_payload jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE rid uuid:=(p_payload->>'rapportino_id')::uuid; c uuid:=(p_payload->>'cantiere_id')::uuid;
 old public.rapportino_prestazioni%rowtype; ops jsonb; x jsonb; k text; pid uuid;
 seen uuid[]:='{}'; keys text[]:='{}'; oi uuid; vi uuid; econ boolean; start_time time; end_time time; pause integer;
 changed boolean:=false; exists_key boolean;
BEGIN
  ops:=p_payload->'prestazioni';
  IF jsonb_typeof(ops) IS DISTINCT FROM 'object' OR NOT (ops ?& ARRAY['nuove','aggiornate','rimosse'])
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(ops) z WHERE z NOT IN ('nuove','aggiornate','rimosse')) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Operazioni prestazioni non valide';
  END IF;
  FOREACH k IN ARRAY ARRAY['nuove','aggiornate','rimosse'] LOOP
    IF jsonb_typeof(ops->k) IS DISTINCT FROM 'array' OR jsonb_array_length(ops->k)>100 THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Array operazioni non valido';
    END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['nuove','aggiornate'] LOOP
    FOR x IN SELECT value FROM jsonb_array_elements(ops->k) LOOP
      IF jsonb_typeof(x) IS DISTINCT FROM 'object' OR NOT (x ?& ARRAY
        ['prestazione_id','chiave_client','operaio_id','ora_inizio','ora_fine','pausa_minuti','lavoro_in_economia','variante_id'])
        OR EXISTS(SELECT 1 FROM jsonb_object_keys(x) z WHERE z NOT IN
        ('prestazione_id','chiave_client','operaio_id','ora_inizio','ora_fine','pausa_minuti','lavoro_in_economia','variante_id'))
        OR jsonb_typeof(x->'chiave_client') IS DISTINCT FROM 'string'
        OR length(btrim(x->>'chiave_client')) NOT BETWEEN 1 AND 200
        OR x->>'chiave_client'<>btrim(x->>'chiave_client')
        OR jsonb_typeof(x->'lavoro_in_economia') IS DISTINCT FROM 'boolean'
        OR jsonb_typeof(x->'pausa_minuti') IS DISTINCT FROM 'number'
        OR x->>'pausa_minuti' !~ '^[0-9]+$'
        OR coalesce(x->>'ora_inizio','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        OR coalesce(x->>'ora_fine','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Prestazione non valida o campo autorevole client';
      END IF;
      IF x->>'chiave_client'=ANY(keys) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Chiave client ripetuta nel payload'; END IF;
      keys:=array_append(keys,x->>'chiave_client');
      oi:=(x->>'operaio_id')::uuid; vi:=(x->>'variante_id')::uuid;
      econ:=(x->>'lavoro_in_economia')::boolean;
      start_time:=(x->>'ora_inizio')::time; end_time:=(x->>'ora_fine')::time; pause:=(x->>'pausa_minuti')::integer;
      IF oi IS NULL OR (NOT econ AND vi IS NOT NULL) OR end_time<=start_time
        OR extract(epoch FROM (end_time-start_time))/60<=pause THEN
        RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Intervallo o destinazione non validi';
      END IF;
      IF k='nuove' THEN
        IF x->'prestazione_id' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='UUID nuovo assegnato dal server'; END IF;
        SELECT * INTO old FROM public.rapportino_prestazioni WHERE rapportino_id=rid AND chiave_client=x->>'chiave_client' FOR UPDATE;
        exists_key:=FOUND;
        IF exists_key THEN
          IF old.rimossa_at IS NOT NULL OR old.operaio_id IS DISTINCT FROM oi OR old.ora_inizio IS DISTINCT FROM start_time
            OR old.ora_fine IS DISTINCT FROM end_time OR old.pausa_minuti IS DISTINCT FROM pause
            OR old.lavoro_in_economia IS DISTINCT FROM econ OR old.variante_id IS DISTINCT FROM vi THEN
            RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Chiave client già usata per dati differenti';
          END IF;
        ELSE
          IF vi IS NOT NULL THEN PERFORM artecna_rapportini.verifica_nuovo_collegamento_variante(vi,c); END IF;
          INSERT INTO public.rapportino_prestazioni(rapportino_id,operaio_id,chiave_client,ora_inizio,ora_fine,pausa_minuti,lavoro_in_economia,variante_id)
          VALUES(rid,oi,x->>'chiave_client',start_time,end_time,pause,econ,vi);
          changed:=true;
        END IF;
      ELSE
        pid:=(x->>'prestazione_id')::uuid;
        IF pid IS NULL OR pid=ANY(seen) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='UUID aggiornamento non valido/ripetuto'; END IF;
        seen:=array_append(seen,pid);
        SELECT * INTO old FROM public.rapportino_prestazioni WHERE id=pid AND rapportino_id=rid FOR UPDATE;
        IF NOT FOUND OR old.rimossa_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Prestazione assente/rimossa/fuori Rapportino'; END IF;
        -- Revisione aggregata già verificata: nessun client può aggiornare una
        -- prestazione letta da una revisione obsoleta, senza cambiare DTO STEP 1.
        IF old.operaio_id IS DISTINCT FROM oi OR old.chiave_client IS DISTINCT FROM x->>'chiave_client' THEN
          RAISE EXCEPTION USING ERRCODE='PR403',MESSAGE='Identità prestazione immutabile';
        END IF;
        IF vi IS NOT NULL AND vi IS DISTINCT FROM old.variante_id THEN
          PERFORM artecna_rapportini.verifica_nuovo_collegamento_variante(vi,c);
        END IF;
        UPDATE public.rapportino_prestazioni SET ora_inizio=start_time,ora_fine=end_time,
          pausa_minuti=pause,lavoro_in_economia=econ,variante_id=vi WHERE id=pid;
        changed:=true;
      END IF;
    END LOOP;
  END LOOP;
  FOR x IN SELECT value FROM jsonb_array_elements(ops->'rimosse') LOOP
    IF jsonb_typeof(x) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Rimozione per UUID richiesta'; END IF;
    pid:=(x#>>'{}')::uuid;
    IF pid=ANY(seen) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Operazioni ripetute su UUID'; END IF;
    seen:=array_append(seen,pid);
    UPDATE public.rapportino_prestazioni SET rimossa_at=clock_timestamp() WHERE id=pid AND rapportino_id=rid AND rimossa_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Prestazione da rimuovere assente'; END IF;
    changed:=true;
  END LOOP;
  RETURN changed;
END;
$function$
;
ALTER FUNCTION artecna_rapportini.applica_prestazioni_contratto_due(jsonb) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_rapportini.salva_contratto_due(p_payload jsonb, p_sessione text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  a record; r public.rapportini%rowtype; rid uuid; req uuid; c uuid; giorno date;
  prev artecna_rapportini.richieste%rowtype; h bytea; result jsonb; dominio jsonb;
  documento jsonb; costo numeric; ore_totali numeric; presenti integer; elenco text;
  changed boolean; materiali_changed boolean; x record;
BEGIN
  -- Connessione dedicata: session_user resta il LOGIN anche dentro DEFINER.
  IF session_user = 'artecna_rapportini_backend' AND
    (p_sessione IS NULL OR p_sessione !~ '^[0-9a-f]{64}$') THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Backend Rapportini: sessione portale obbligatoria';
  END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR octet_length(p_payload::text)>1048576
    OR NOT(p_payload ?& ARRAY['versione_contratto','richiesta_id','rapportino_id','revisione_attesa','cantiere_id','data','prestazioni','materiali'])
    OR p_payload->'versione_contratto' IS DISTINCT FROM '2'::jsonb
    OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k WHERE k NOT IN
      ('versione_contratto','richiesta_id','rapportino_id','revisione_attesa','cantiere_id','data','prestazioni','documento','materiali'))
    OR coalesce(p_payload->>'data','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Envelope servizio Rapportino non valido';
  END IF;
  req:=(p_payload->>'richiesta_id')::uuid; c:=(p_payload->>'cantiere_id')::uuid;
  giorno:=(p_payload->>'data')::date; rid:=(p_payload->>'rapportino_id')::uuid;
  IF req IS NULL OR c IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='UUID richiesta/cantiere obbligatori'; END IF;
  SELECT * INTO a FROM artecna_rapportini.autorizza(p_sessione,c);
  PERFORM pg_advisory_xact_lock(hashtextextended(a.canale||a.identita::text||req::text,0));
  h:=sha256(convert_to(p_payload::text,'UTF8'));
  SELECT * INTO prev FROM artecna_rapportini.richieste
    WHERE canale=a.canale AND utente_id=a.identita AND richiesta_id=req;
  IF FOUND THEN
    IF prev.payload_sha256 IS DISTINCT FROM h THEN
      RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Richiesta idempotente con payload differente';
    END IF;
    RETURN prev.risultato;
  END IF;
  documento:=coalesce(p_payload->'documento','{}');
  IF jsonb_typeof(documento) IS DISTINCT FROM 'object' OR EXISTS
    (SELECT 1 FROM jsonb_object_keys(documento) k WHERE k NOT IN ('note')) THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Documento non valido o costo client non ammesso';
  END IF;
  FOR x IN SELECT key,value FROM jsonb_each(documento) LOOP
    IF jsonb_typeof(x.value) IS DISTINCT FROM 'string' OR length(x.value#>>'{}')>20000 THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Campo documento non valido';
    END IF;
  END LOOP;
  IF rid IS NULL THEN
    IF p_payload->'rapportino_id' IS DISTINCT FROM 'null'::jsonb
      OR p_payload->'revisione_attesa' IS DISTINCT FROM 'null'::jsonb
      OR p_payload#>'{prestazioni,aggiornate}' IS DISTINCT FROM '[]'::jsonb
      OR p_payload#>'{prestazioni,rimosse}' IS DISTINCT FROM '[]'::jsonb
      OR p_payload#>'{materiali,aggiornate}' IS DISTINCT FROM '[]'::jsonb
      OR p_payload#>'{materiali,rimosse}' IS DISTINCT FROM '[]'::jsonb THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Creazione con UUID/revisione/operazioni non validi';
    END IF;
    -- Regola legacy: un documento per cantiere/giorno, senza UNIQUE/backfill.
    PERFORM pg_advisory_xact_lock(hashtextextended('rapportino-giorno:'||c::text||giorno::text,0));
    IF EXISTS(SELECT 1 FROM public.rapportini WHERE cantiere_id=c AND data=giorno) THEN
      RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Rapportino già presente per questa data';
    END IF;
    INSERT INTO public.rapportini(cantiere_id,cantiere,data,versione_prestazioni,
      compilato_da_operaio_id,compilato_da_nome,note,materiali,quantita_materiali)
      SELECT c,nome,giorno,1,CASE WHEN a.canale='portale' THEN a.identita ELSE NULL END,
        a.compilatore_nome,coalesce(documento->>'note',''),'',
        '' FROM public.cantieri WHERE id=c
      RETURNING * INTO r;
    rid:=r.id;
  ELSE
    SELECT * INTO r FROM public.rapportini WHERE id=rid FOR UPDATE;
    IF NOT FOUND OR r.cantiere_id IS DISTINCT FROM c OR r.data IS DISTINCT FROM giorno THEN
      RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Rapportino/contesto non valido';
    END IF;
    IF r.versione_prestazioni<>1 THEN
      RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Rapportino legacy: conversione non consentita';
    END IF;
  END IF;
  IF p_payload->'rapportino_id' IS DISTINCT FROM 'null'::jsonb AND
    (jsonb_typeof(p_payload->'revisione_attesa') IS DISTINCT FROM 'number' OR p_payload->>'revisione_attesa' !~ '^[0-9]+$') THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Revisione attesa non valida'; END IF;
  IF p_payload->'rapportino_id' IS DISTINCT FROM 'null'::jsonb AND (p_payload->>'revisione_attesa')::bigint<>r.revisione_prestazioni THEN
    RAISE EXCEPTION USING ERRCODE='PR412',MESSAGE='Revisione Rapportino obsoleta'; END IF;
  dominio:=p_payload||jsonb_build_object('rapportino_id',rid);
  changed:=artecna_rapportini.applica_prestazioni_contratto_due(dominio);
  materiali_changed:=artecna_rapportini.applica_materiali_contratto_due(rid,p_payload->'materiali');
  -- Un solo incremento; nessun helper possiede la revisione aggregata.
  IF changed OR materiali_changed OR p_payload->'rapportino_id'='null'::jsonb OR
    (documento ? 'note' AND documento->>'note' IS DISTINCT FROM r.note) THEN
    UPDATE public.rapportini SET revisione_prestazioni=revisione_prestazioni+1 WHERE id=rid;
  END IF;
  -- Costi numerici: arrotondamento a centesimi una sola volta sul totale.
  SELECT coalesce(sum(p.ore*p.costo_orario_interno_storico),0),coalesce(sum(p.ore),0),
    count(DISTINCT p.operaio_id),coalesce(string_agg(format('%s (%s / %s - %sh)',o.nome,
      to_char(p.ora_inizio,'HH24:MI'),to_char(p.ora_fine,'HH24:MI'),p.ore),', ' ORDER BY p.created_at,p.id),'')
    INTO costo,ore_totali,presenti,elenco FROM public.rapportino_prestazioni p
      JOIN public.operai o ON o.id=p.operaio_id WHERE p.rapportino_id=rid AND p.rimossa_at IS NULL;
  UPDATE public.rapportini SET costo_manodopera=round(costo,2)::double precision,
    ore=ore_totali::text,operai=elenco,numero_presenti=presenti::text,
    -- Campo legacy: media delle ore totali per operaio distinto, non per riga.
    ore_per_operaio=CASE WHEN presenti=0 THEN '0' ELSE (ore_totali/presenti)::text END,
    note=CASE WHEN documento ? 'note' THEN documento->>'note' ELSE note END
    WHERE id=rid RETURNING * INTO r;
  -- Proiezione ricreabile; l'identità persistente resta quella della prestazione.
  DELETE FROM public.timbrature WHERE rapportino_id=rid AND stato='da rapportino';
  INSERT INTO public.timbrature(prestazione_rapportino_id,rapportino_id,operaio_id,operaio_nome,
    cantiere_id,cantiere,data,ora_entrata,ora_uscita,pausa_minuti,stato)
    SELECT p.id,rid,p.operaio_id,o.nome,c,r.cantiere,to_char(giorno,'YYYY-MM-DD'),
      to_char(p.ora_inizio,'HH24:MI'),to_char(p.ora_fine,'HH24:MI'),p.pausa_minuti,'da rapportino'
      FROM public.rapportino_prestazioni p JOIN public.operai o ON o.id=p.operaio_id
      WHERE p.rapportino_id=rid AND p.rimossa_at IS NULL;
  -- Risposta operativa senza tariffe/costi/stati Economia (STEP 6).
  result:=jsonb_build_object('versione_contratto',2,'rapportino_id',rid,'revisione',r.revisione_prestazioni,
    'cantiere_id',c,'data',to_char(giorno,'YYYY-MM-DD'),'documento',jsonb_build_object(
      'note',r.note),
    'prestazioni',(SELECT coalesce(jsonb_agg(jsonb_build_object('prestazione_id',p.id,
      'chiave_client',p.chiave_client,'operaio_id',p.operaio_id,'operaio_nome',o.nome,
      'ora_inizio',to_char(p.ora_inizio,'HH24:MI'),'ora_fine',to_char(p.ora_fine,'HH24:MI'),
      'pausa_minuti',p.pausa_minuti,'ore',p.ore,'lavoro_in_economia',p.lavoro_in_economia,
      'variante_id',p.variante_id,'revisione',p.revisione,'rimossa_at',p.rimossa_at)
      ORDER BY p.created_at,p.id),'[]') FROM public.rapportino_prestazioni p
        JOIN public.operai o ON o.id=p.operaio_id WHERE p.rapportino_id=rid));
  result:=result||jsonb_build_object('versione_materiali',r.versione_materiali,
    'materiali',(SELECT coalesce(jsonb_agg(jsonb_build_object(
      'materiale_id',m.id,'chiave_client',m.chiave_client,'descrizione',m.descrizione,'unita_misura',m.unita_misura,
      'quantita',m.quantita::text,'costo_unitario',m.costo_unitario::text,'costo_totale',m.costo_totale::text,
      'note',m.note,'revisione',m.revisione,'rimossa_at',m.rimossa_at) ORDER BY m.created_at,m.id),'[]')
      FROM public.rapportino_materiali m WHERE m.rapportino_id=rid),
    'riepilogo_materiali',(SELECT jsonb_build_object(
      'totale_materiali_valorizzati',coalesce(sum(m.costo_totale),0.00)::text,
      'numero_materiali_da_valorizzare',count(*) FILTER(WHERE m.costo_unitario IS NULL),
      'valorizzazione_completa',count(*) FILTER(WHERE m.costo_unitario IS NULL)=0)
      FROM public.rapportino_materiali m WHERE m.rapportino_id=rid AND m.rimossa_at IS NULL));
  INSERT INTO artecna_rapportini.richieste(canale,utente_id,richiesta_id,rapportino_id,payload_sha256,risultato)
    VALUES(a.canale,a.identita,req,rid,h,result);
  RETURN result;
END;
$function$
;
ALTER FUNCTION artecna_rapportini.salva_contratto_due(jsonb,text) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_rapportini.f3c3_verifica_proiezione(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE a artecna_rapportini.allegati%ROWTYPE; f public.foto_cantiere%ROWTYPE; r record; c record;
BEGIN
 SELECT * INTO a FROM artecna_rapportini.allegati WHERE id=p_id;
 IF NOT FOUND THEN
  IF EXISTS(SELECT 1 FROM public.foto_cantiere WHERE allegato_v1_id=p_id) THEN
   RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='F3C3: marker orfano'; END IF;
  RETURN;
 END IF;
 IF a.stato IN ('prenotato','scaduto','cancellato') AND a.foto_cantiere_id IS NOT NULL
  OR a.stato='finalizzato' AND (a.foto_cantiere_id IS NULL OR a.finalized_at IS NULL)
  OR a.stato='cancellazione_pending' AND ((a.foto_cantiere_id IS NULL)<>(a.finalized_at IS NULL)) THEN
  RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='F3C3: stato/proiezione incoerente'; END IF;
 IF a.foto_cantiere_id IS NULL THEN
  IF EXISTS(SELECT 1 FROM public.foto_cantiere WHERE allegato_v1_id=a.id) THEN
   RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='F3C3: proiezione inattesa'; END IF;
  RETURN;
 END IF;
 SELECT id,cantiere_id,data INTO r FROM public.rapportini WHERE id=a.rapportino_id;
 IF NOT FOUND OR r.cantiere_id IS DISTINCT FROM a.cantiere_id OR r.data IS NULL THEN
  RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='F3C3: contesto rapporto incoerente'; END IF;
 SELECT nome INTO c FROM public.cantieri WHERE id=a.cantiere_id;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='F3C3: cantiere assente'; END IF;
 SELECT * INTO f FROM public.foto_cantiere WHERE id=a.foto_cantiere_id;
 IF NOT FOUND OR f.allegato_v1_id IS DISTINCT FROM a.id
  OR f.cantiere_id IS DISTINCT FROM a.cantiere_id OR f.rapportino_id IS DISTINCT FROM a.rapportino_id::text
  OR f.cantiere IS DISTINCT FROM c.nome OR f.data_foto IS DISTINCT FROM r.data::text
  OR f.categoria IS DISTINCT FROM 'rapportino' OR f.nota IS DISTINCT FROM ''
  OR f.file_url IS NOT NULL OR f.file_path IS NOT NULL OR f.thumbnail_url IS NOT NULL
  OR f.immagine_base64 IS DISTINCT FROM '' OR f.storage_provider IS DISTINCT FROM 'cloud'
  OR f.sync_status IS DISTINCT FROM 'not_required' OR f.sopralluogo_id IS NOT NULL
  OR f.geolocalizzazione IS NOT NULL THEN
  RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='F3C3: reciprocità/proiezione incoerente'; END IF;
END;
$function$
;
ALTER FUNCTION artecna_rapportini.f3c3_verifica_proiezione(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_rapportini.f3c3_guardia_foto()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE protetta boolean; consumed uuid;
BEGIN
 IF TG_OP='INSERT' THEN
  protetta:=NEW.allegato_v1_id IS NOT NULL OR EXISTS(SELECT 1 FROM artecna_rapportini.allegati WHERE foto_cantiere_id=NEW.id);
  IF protetta THEN
   IF session_user<>'artecna_rapportini_backend' OR NEW.allegato_v1_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='F3C3: proiezione V1 protetta'; END IF;
   DELETE FROM artecna_rapportini.f3c3_capability WHERE foto_id=NEW.id AND allegato_id=NEW.allegato_v1_id
    AND tx=pg_current_xact_id() AND backend_pid=pg_backend_pid() RETURNING foto_id INTO consumed;
   IF consumed IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='F3C3: proiezione V1 protetta'; END IF;
  END IF;
  RETURN NEW;
 END IF;
 protetta:=OLD.allegato_v1_id IS NOT NULL OR EXISTS(SELECT 1 FROM artecna_rapportini.allegati WHERE foto_cantiere_id=OLD.id);
 IF TG_OP='UPDATE' THEN
  protetta:=protetta OR NEW.allegato_v1_id IS NOT NULL OR EXISTS(SELECT 1 FROM artecna_rapportini.allegati WHERE foto_cantiere_id=NEW.id);
 END IF;
 IF protetta THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='F3C3: proiezione V1 protetta'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END;
$function$
;
ALTER FUNCTION artecna_rapportini.f3c3_guardia_foto() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_rapportini.f3c3_guardia_truncate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
 IF EXISTS(SELECT 1 FROM public.foto_cantiere WHERE allegato_v1_id IS NOT NULL)
  OR EXISTS(SELECT 1 FROM artecna_rapportini.allegati WHERE foto_cantiere_id IS NOT NULL) THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='F3C3: TRUNCATE con proiezioni V1 negato'; END IF;
 RETURN NULL;
END;
$function$
;
ALTER FUNCTION artecna_rapportini.f3c3_guardia_truncate() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_rapportini.f3c3_reciprocita()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE v_id uuid;
BEGIN
 IF TG_TABLE_SCHEMA='artecna_rapportini' THEN
  IF TG_OP<>'INSERT' THEN PERFORM artecna_rapportini.f3c3_verifica_proiezione(OLD.id); END IF;
  IF TG_OP<>'DELETE' THEN PERFORM artecna_rapportini.f3c3_verifica_proiezione(NEW.id); END IF;
 ELSE
  IF TG_OP<>'INSERT' AND OLD.allegato_v1_id IS NOT NULL THEN PERFORM artecna_rapportini.f3c3_verifica_proiezione(OLD.allegato_v1_id); END IF;
  IF TG_OP<>'DELETE' AND NEW.allegato_v1_id IS NOT NULL THEN PERFORM artecna_rapportini.f3c3_verifica_proiezione(NEW.allegato_v1_id); END IF;
  FOR v_id IN SELECT id FROM artecna_rapportini.allegati WHERE foto_cantiere_id=CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END
  LOOP PERFORM artecna_rapportini.f3c3_verifica_proiezione(v_id); END LOOP;
 END IF;
 RETURN NULL;
END;
$function$
;
ALTER FUNCTION artecna_rapportini.f3c3_reciprocita() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_foto_desktop.verifica(p_allegato uuid, p_utente uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE a record; r record; resolved jsonb;
BEGIN
 IF p_utente IS NULL THEN RAISE EXCEPTION USING ERRCODE='PR401',MESSAGE='Identita Desktop obbligatoria'; END IF;
 SELECT id,cantiere_id,rapportino_id,foto_cantiere_id,sha256 INTO a FROM artecna_rapportini.allegati WHERE id=p_allegato;
 IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Foto non disponibile'; END IF;
 IF artecna_guardie.utente_puo_modificare_cantiere(p_utente,a.cantiere_id) IS DISTINCT FROM true
  THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non consentito'; END IF;
 SELECT cantiere_id,data,versione_prestazioni INTO r FROM public.rapportini WHERE id=a.rapportino_id;
 IF NOT FOUND OR r.cantiere_id IS DISTINCT FROM a.cantiere_id OR r.versione_prestazioni IS DISTINCT FROM 1
  OR r.data IS NULL OR NOT isfinite(r.data) THEN RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Contesto Foto incoerente'; END IF;
 -- Resolver certificato core: stato, path canonico, proiezione e marker.
 resolved:=artecna_rapportini.accesso_allegato_finalizzato(a.id,a.rapportino_id,a.cantiere_id,r.data);
 IF NOT EXISTS(SELECT 1 FROM public.foto_cantiere f WHERE f.id=a.foto_cantiere_id AND f.allegato_v1_id=a.id)
  OR (SELECT count(*) FROM public.foto_cantiere f WHERE f.allegato_v1_id=a.id)<>1
  THEN RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Reciprocita Foto incoerente'; END IF;
 RETURN resolved||jsonb_build_object('rapportino_id',a.rapportino_id,'cantiere_id',a.cantiere_id,
  'foto_cantiere_id',a.foto_cantiere_id,'sha256',encode(a.sha256,'hex'));
END;
$function$
;
ALTER FUNCTION artecna_foto_desktop.verifica(uuid,uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.proteggi_provenienza_economia_rapportino()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
 IF OLD.origine='rapportino' AND TG_OP='UPDATE'
  AND (SELECT stato FROM public.economia_raccolte WHERE id=OLD.raccolta_id) IS DISTINCT FROM 'bozza' THEN
  RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='Raccolta chiusa immutabile'; END IF;
 IF OLD.origine<>'rapportino' THEN
  IF TG_OP='UPDATE' AND NEW.origine='rapportino' THEN
   RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Conversione provenienza vietata'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
 END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Provenienza Rapportino persistente'; END IF;
 IF ROW(NEW.id,NEW.raccolta_id,NEW.origine,NEW.sorgente_id,NEW.indice_voce_sorgente,
   NEW.rapportino_prestazione_id,NEW.prestazione_revisione_acquisita,NEW.prestazione_snapshot,
   NEW.tipo_riga,NEW.dettagli_analitici,NEW.quantita,NEW.unita_misura,NEW.created_by,NEW.created_at)
  IS DISTINCT FROM ROW(OLD.id,OLD.raccolta_id,OLD.origine,OLD.sorgente_id,OLD.indice_voce_sorgente,
   OLD.rapportino_prestazione_id,OLD.prestazione_revisione_acquisita,OLD.prestazione_snapshot,
   OLD.tipo_riga,OLD.dettagli_analitici,OLD.quantita,OLD.unita_misura,OLD.created_by,OLD.created_at) THEN
  RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Provenienza Rapportino immutabile'; END IF;
 RETURN NEW;
END;
$function$
;
ALTER FUNCTION public.proteggi_provenienza_economia_rapportino() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.sal_blocca_eliminazione_preventivo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
 SET lock_timeout TO '3s'
AS $function$
DECLARE contratti bigint; sal bigint; lavorazioni bigint; varianti bigint; sorgenti bigint; origini bigint;
BEGIN
 -- Conserva solo il contesto amministrativo di distruzione gia esistente e autorizzato.
 IF artecna_distruzione.contesto_valido(OLD.cantiere_id) THEN RETURN OLD; END IF;
 LOCK TABLE public.cantieri,public.preventivi_cantiere,public.preventivo_lavorazioni,public.sal_lavorazioni,
 public.varianti_cantiere,public.variante_lavorazioni,public.variante_sorgenti IN SHARE ROW EXCLUSIVE MODE;
 SELECT count(*) INTO contratti FROM public.cantieri WHERE preventivo_contrattuale_id=OLD.id;
 SELECT count(*) INTO sal FROM public.sal_lavorazioni s JOIN public.preventivo_lavorazioni b ON b.id=s.source_lavorazione_id WHERE b.preventivo_id=OLD.id;
 SELECT count(*) INTO lavorazioni FROM public.preventivo_lavorazioni WHERE preventivo_id=OLD.id;
 SELECT count(*) INTO varianti FROM public.varianti_cantiere WHERE preventivo_contrattuale_id=OLD.id;
 SELECT count(*) INTO sorgenti FROM public.variante_sorgenti WHERE preventivo_sorgente_id=OLD.id;
 SELECT count(*) INTO origini FROM public.cantieri WHERE origine_preventivo_id=OLD.id;
 IF contratti+sal+lavorazioni+varianti+sorgenti+origini>0 THEN
 RAISE EXCEPTION USING ERRCODE='SP401',MESSAGE='Preventivo utilizzato: eliminazione normale bloccata',
 DETAIL=jsonb_build_object('contratti',contratti,'righe_sal',sal,'lavorazioni',lavorazioni,'varianti',varianti,'sorgenti_varianti',sorgenti,'origini_cantiere',origini)::text;
 END IF;
 RETURN OLD;
END
$function$
;
ALTER FUNCTION artecna_guardie.sal_blocca_eliminazione_preventivo() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.sal_blocca_cambio_contratto()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
 SET lock_timeout TO '3s'
AS $function$
DECLARE incompatibili bigint;
BEGIN
 IF NEW.preventivo_contrattuale_id IS NOT DISTINCT FROM OLD.preventivo_contrattuale_id THEN RETURN NEW; END IF;
 IF NEW.preventivo_contrattuale_id IS NULL
 AND (to_jsonb(NEW)-'preventivo_contrattuale_id') IS NOT DISTINCT FROM (to_jsonb(OLD)-'preventivo_contrattuale_id')
 AND artecna_distruzione.contesto_valido(OLD.id) THEN RETURN NEW; END IF;
 LOCK TABLE public.preventivi_cantiere,public.preventivo_lavorazioni,public.sal_lavorazioni,public.varianti_cantiere,public.variante_lavorazioni IN SHARE ROW EXCLUSIVE MODE;
 IF NEW.preventivo_contrattuale_id IS NOT NULL AND NOT EXISTS(
 SELECT 1 FROM public.preventivi_cantiere p WHERE p.id=NEW.preventivo_contrattuale_id AND p.cantiere_id=OLD.id) THEN
 RAISE EXCEPTION USING ERRCODE='SP403',MESSAGE='Il nuovo preventivo non appartiene al cantiere'; END IF;
 SELECT count(*) INTO incompatibili FROM public.sal_lavorazioni s
 LEFT JOIN public.preventivo_lavorazioni b ON b.id=s.source_lavorazione_id
 LEFT JOIN public.variante_lavorazioni l ON l.id=s.source_variante_lavorazione_id
 LEFT JOIN public.varianti_cantiere v ON v.id=l.variante_id
 WHERE (s.cantiere_id=OLD.id OR s.cantiere=OLD.nome)
 AND (s.source_lavorazione_id IS NOT NULL OR s.source_variante_lavorazione_id IS NOT NULL)
 AND (s.cantiere_id IS DISTINCT FROM OLD.id OR NEW.preventivo_contrattuale_id IS NULL
 OR (s.source_lavorazione_id IS NOT NULL AND s.source_variante_lavorazione_id IS NOT NULL)
 OR (s.source_lavorazione_id IS NOT NULL AND (b.id IS NULL OR b.cantiere_id IS DISTINCT FROM OLD.id OR b.preventivo_id IS DISTINCT FROM NEW.preventivo_contrattuale_id))
 OR (s.source_variante_lavorazione_id IS NOT NULL AND (l.id IS NULL OR v.id IS NULL OR v.cantiere_id IS DISTINCT FROM OLD.id OR v.preventivo_contrattuale_id IS DISTINCT FROM NEW.preventivo_contrattuale_id OR v.stato IS DISTINCT FROM 'approvata')));
 IF incompatibili>0 THEN RAISE EXCEPTION USING ERRCODE='SP402',
 MESSAGE='Esistono SAL collegati a un preventivo incompatibile con il nuovo contratto. Usa la procedura di sostituzione/reset controllato.',
 DETAIL=jsonb_build_object('righe_sal_incompatibili',incompatibili)::text; END IF;
 -- Non modifica sorgenti, SAL o Varianti. P2001 resta nella guardia preesistente.
 RETURN NEW;
END
$function$
;
ALTER FUNCTION artecna_guardie.sal_blocca_cambio_contratto() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.materiali_fattura_guardia()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.fattura_riga_id IS NOT NULL THEN RETURN NULL; END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' AND OLD.fattura_riga_id IS NOT NULL THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Assegnazione fattura immutabile'; END IF;
 IF NEW.fattura_riga_id IS NOT NULL AND current_user<>'artecna_materiali_fattura_rpc' THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Usare il writer materiali fattura'; END IF;
 RETURN NEW;
END $function$
;
ALTER FUNCTION artecna_guardie.materiali_fattura_guardia() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.materiali_fattura_legacy_guardia()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
 IF NEW.fattura_riga_id IS NULL AND nullif(btrim(NEW.nome_file),'') IS NOT NULL THEN
  PERFORM f.id FROM public.fatture_fornitori f WHERE f.nome_file=NEW.nome_file ORDER BY f.id FOR UPDATE;
 END IF;
 IF NEW.fattura_riga_id IS NULL AND nullif(btrim(NEW.nome_file),'') IS NOT NULL
 AND (EXISTS(SELECT 1 FROM public.materiali_cantiere m WHERE m.fattura_riga_id IS NOT NULL AND m.nome_file=NEW.nome_file)
 OR EXISTS(SELECT 1 FROM public.fatture_fornitori f JOIN public.fatture_fornitori_righe r ON r.fattura_id=f.id
  JOIN public.economia_righe e ON e.fattura_riga_id=r.id WHERE f.nome_file=NEW.nome_file)) THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Documento quantitativo: replace legacy vietato'; END IF;
 RETURN NEW;
END $function$
;
ALTER FUNCTION artecna_guardie.materiali_fattura_legacy_guardia() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.materiali_fattura_testata_guardia()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
 IF NEW.stato IS DISTINCT FROM OLD.stato AND EXISTS(
  SELECT 1 FROM public.fatture_fornitori_righe r WHERE r.fattura_id=OLD.id
   AND artecna_guardie.materiali_fattura_totale(r.id)>0) THEN
  SELECT CASE WHEN bool_and(a.q>=r.quantita) THEN 'assegnata'
   WHEN bool_or(a.q>0) THEN 'parzialmente_assegnata' ELSE 'da_assegnare' END INTO NEW.stato
  FROM public.fatture_fornitori_righe r CROSS JOIN LATERAL
   (SELECT artecna_guardie.materiali_fattura_totale(r.id) q) a WHERE r.fattura_id=OLD.id;
 END IF;
 RETURN NEW;
END $function$
;
ALTER FUNCTION artecna_guardie.materiali_fattura_testata_guardia() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.materiali_economia_globale_guardia()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE rid uuid; cid uuid; originale numeric; a numeric; BEGIN
 rid:=CASE WHEN TG_OP='INSERT' THEN NEW.fattura_riga_id ELSE OLD.fattura_riga_id END;
 IF rid IS NULL THEN
  IF TG_OP='UPDATE' AND NEW.fattura_riga_id IS NOT NULL THEN RAISE EXCEPTION 'Provenienza immutabile'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
 END IF;
 IF TG_OP='UPDATE' AND (NEW.fattura_riga_id IS DISTINCT FROM OLD.fattura_riga_id OR NEW.raccolta_id IS DISTINCT FROM OLD.raccolta_id) THEN RAISE EXCEPTION 'Provenienza immutabile'; END IF;
 SELECT cantiere_id INTO cid FROM public.economia_raccolte WHERE id=CASE WHEN TG_OP='INSERT' THEN NEW.raccolta_id ELSE OLD.raccolta_id END;
 PERFORM artecna_guardie.blocca_riga_fattura_economia(rid,cid);
 IF TG_OP<>'DELETE' THEN
  SELECT quantita INTO originale FROM public.fatture_fornitori_righe WHERE id=rid;
  a:=artecna_guardie.materiali_fattura_totale(rid);
  IF TG_OP='UPDATE' THEN a:=a-OLD.quantita; END IF;
  IF NEW.quantita IS NULL OR NEW.quantita<=0 OR NEW.quantita::text IN ('NaN','Infinity','-Infinity') OR a+NEW.quantita>originale THEN RAISE EXCEPTION 'Quantita globale oltre disponibilita'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $function$
;
ALTER FUNCTION artecna_guardie.materiali_economia_globale_guardia() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.materiali_economia_stato()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE fid uuid; BEGIN
 IF TG_OP='UPDATE' AND (NEW.dettagli_analitici-ARRAY['cliente_materiale','proposta_non_economica']) IS NOT DISTINCT FROM (OLD.dettagli_analitici-ARRAY['cliente_materiale','proposta_non_economica'])
 AND (to_jsonb(NEW)-ARRAY['dettagli_analitici','updated_at']) IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['dettagli_analitici','updated_at']) THEN RETURN NULL; END IF;
 SELECT fattura_id INTO fid FROM public.fatture_fornitori_righe WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.fattura_riga_id ELSE NEW.fattura_riga_id END;
 IF fid IS NOT NULL THEN PERFORM artecna_guardie.materiali_fattura_stato(fid); END IF;
 RETURN NULL;
END $function$
;
ALTER FUNCTION artecna_guardie.materiali_economia_stato() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.utente_puo_operare_impresa(p_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.utenti_impresa AS u
    WHERE p_user_id IS NOT NULL
      AND u.user_id = p_user_id
      AND u.attivo = true
      AND u.ruolo = 'titolare'
  )
$function$
;
ALTER FUNCTION artecna_guardie.utente_puo_operare_impresa(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.materiali_impresa_blocca(p_riga uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE fid uuid;
BEGIN
  IF current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='Richiesto READ COMMITTED; nessun retry automatico';
  END IF;
  SELECT fattura_id INTO fid FROM public.fatture_fornitori_righe WHERE id=p_riga;
  IF fid IS NULL THEN RAISE EXCEPTION USING ERRCODE='23503', MESSAGE='Riga fattura non disponibile'; END IF;
  PERFORM id FROM public.fatture_fornitori WHERE id=fid FOR UPDATE NOWAIT;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='23503', MESSAGE='Fattura non disponibile'; END IF;
  PERFORM id FROM public.fatture_fornitori_righe WHERE id=p_riga AND fattura_id=fid FOR UPDATE NOWAIT;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='40001', MESSAGE='Riga fattura cambiata'; END IF;
  RETURN fid;
END $function$
;
ALTER FUNCTION artecna_guardie.materiali_impresa_blocca(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.spese_impresa_conflitto_quantitativo()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE rid uuid;
BEGIN
  -- OLD e NEW in ordine deterministico. Nessun matching per nome_file/testo.
  FOR rid IN SELECT DISTINCT x FROM unnest(ARRAY[
    CASE WHEN TG_OP <> 'INSERT' THEN OLD.riga_fattura_id END,
    CASE WHEN TG_OP <> 'DELETE' THEN NEW.riga_fattura_id END]) x WHERE x IS NOT NULL ORDER BY x
  LOOP
    PERFORM artecna_guardie.materiali_impresa_blocca(rid);
  END LOOP;
  IF TG_OP <> 'DELETE' AND NEW.riga_fattura_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.materiali_impresa WHERE fattura_riga_id=NEW.riga_fattura_id) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Costo legacy in conflitto con assegnazione Generale impresa',
      DETAIL='riga_fattura_id='||NEW.riga_fattura_id::text, HINT='Non ripetere il salvataggio; rileggere le assegnazioni.';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $function$
;
ALTER FUNCTION artecna_guardie.spese_impresa_conflitto_quantitativo() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.materiali_impresa_conflitto_legacy()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Assegnazione Generale impresa immutabile';
  END IF;
  PERFORM artecna_guardie.materiali_impresa_blocca(NEW.fattura_riga_id);
  IF EXISTS(SELECT 1 FROM public.spese_impresa WHERE riga_fattura_id=NEW.fattura_riga_id) THEN
    RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='Assegnazione Generale impresa in conflitto con costo legacy',
      DETAIL='fattura_riga_id='||NEW.fattura_riga_id::text, HINT='Verifica manuale del costo legacy; nessuna conversione automatica.';
  END IF;
  RETURN NEW;
END $function$
;
ALTER FUNCTION artecna_guardie.materiali_impresa_conflitto_legacy() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.leggi_materiali_impresa_fattura(p_fattura_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE u uuid; result jsonb;
BEGIN
 u:=artecna_guardie.utente_jwt_corrente();
 IF u IS NULL OR artecna_guardie.utente_puo_operare_impresa(u) IS DISTINCT FROM true THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Titolare impresa non autorizzato'; END IF;
 IF p_fattura_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.fatture_fornitori WHERE id=p_fattura_id) THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Fattura non disponibile'; END IF;
 -- Dettagli solo Impresa. Economia/Cantiere: esclusivamente somme per residuo.
 -- Il totale/residuo autorevole resta quello della funzione globale installata.
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'fattura_riga_id',r.id,'quantita_originale',r.quantita,
  'quantita_assegnata_economia',a.e,'quantita_assegnata_cantiere',a.c,
  'quantita_assegnata_impresa',a.i,'quantita_assegnata',a.q,
  'quantita_residua',r.quantita-a.q,
  'stato',CASE WHEN a.q=0 THEN 'da_assegnare' WHEN a.q<r.quantita THEN 'parzialmente_assegnata' ELSE 'assegnata' END,
  'gia_presente_nella_raccolta',false,
  'assegnazioni',coalesce((SELECT jsonb_agg(jsonb_build_object(
   'id',m.id,'fattura_riga_id',m.fattura_riga_id,
   'destinazione','impresa','destinazione_label','Generale impresa',
   'categoria',m.categoria,'categoria_label',CASE m.categoria WHEN 'attrezzo_ditta' THEN 'Attrezzatura' WHEN 'magazzino' THEN 'Magazzino' END,
   'cantiere_id',NULL,'cantiere',NULL,'raccolta_id',NULL,'raccolta',NULL,
   'quantita',m.quantita,'unita_misura',m.unita_misura,
   'prezzo_unitario',m.prezzo_unitario,'totale',m.totale,
   'created_at',m.created_at,'data',m.created_at) ORDER BY m.created_at,m.id)
   FROM public.materiali_impresa m WHERE m.fattura_riga_id=r.id),'[]'::jsonb)
 ) ORDER BY r.id),'[]'::jsonb) INTO result
 FROM public.fatture_fornitori_righe r CROSS JOIN LATERAL (
  SELECT coalesce((SELECT sum(e.quantita) FROM public.economia_righe e WHERE e.fattura_riga_id=r.id),0) e,
   coalesce((SELECT sum(c.quantita) FROM public.materiali_cantiere c WHERE c.fattura_riga_id=r.id),0) c,
   coalesce((SELECT sum(i.quantita) FROM public.materiali_impresa i WHERE i.fattura_riga_id=r.id),0) i,
   artecna_guardie.materiali_fattura_totale(r.id) q
 ) a WHERE r.fattura_id=p_fattura_id;
 -- Fail closed su dati incoerenti o letture aggregate cambiate durante il comando.
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(result) x WHERE
   x->>'quantita_originale' IS NULL OR (x->>'quantita_originale')::numeric<=0
   OR x->>'quantita_originale' IN ('NaN','Infinity','-Infinity')
   OR (x->>'quantita_assegnata')::numeric<0
   OR x->>'quantita_assegnata' IN ('NaN','Infinity','-Infinity')
   OR (x->>'quantita_residua')::numeric<0
   OR (x->>'quantita_assegnata')::numeric IS DISTINCT FROM
     ((x->>'quantita_assegnata_economia')::numeric+(x->>'quantita_assegnata_cantiere')::numeric+(x->>'quantita_assegnata_impresa')::numeric)
   OR (x->>'quantita_assegnata_impresa')::numeric IS DISTINCT FROM
     (SELECT coalesce(sum((h->>'quantita')::numeric),0) FROM jsonb_array_elements(x->'assegnazioni') h)) THEN
  RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='Disponibilita non coerente: rileggere la fattura';
 END IF;
 RETURN result;
END $function$
;
ALTER FUNCTION artecna_guardie.leggi_materiali_impresa_fattura(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_rapportini.verifica_intervalli_prestazioni()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
  PERFORM 1 FROM public.rapportini WHERE id=NEW.rapportino_id FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public.rapportino_prestazioni a
    JOIN public.rapportino_prestazioni b
      ON b.rapportino_id=a.rapportino_id AND b.operaio_id=a.operaio_id AND a.id<b.id
    WHERE a.rapportino_id=NEW.rapportino_id AND a.rimossa_at IS NULL AND b.rimossa_at IS NULL
      AND a.ora_inizio<b.ora_fine AND b.ora_inizio<a.ora_fine
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23514',
      MESSAGE='Fasce orarie sovrapposte per lo stesso operaio: correggere le prestazioni';
  END IF;
  RETURN NULL;
END;
$function$
;
ALTER FUNCTION artecna_rapportini.verifica_intervalli_prestazioni() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_rapportini.costruisci_lettura_rapportino_v1(p_cantiere_id uuid, p_data date, p_rapportino_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE n bigint; v1 boolean; non_supportata boolean; r record; dettaglio jsonb;
BEGIN
  IF p_cantiere_id IS NULL OR p_data IS NULL OR NOT pg_catalog.isfinite(p_data)
    OR p_data < DATE '0001-01-01' OR p_data > DATE '9999-12-31' THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Cantiere e data validi obbligatori';
  END IF;
  IF p_rapportino_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.rapportini r0
    WHERE r0.id=p_rapportino_id AND r0.cantiere_id=p_cantiere_id AND r0.data=p_data) THEN
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='UUID e contesto Rapportino incoerenti';
  END IF;
  SELECT pg_catalog.count(*),pg_catalog.bool_or(r0.versione_prestazioni=1),
    pg_catalog.bool_or(r0.versione_prestazioni IS NULL OR r0.versione_prestazioni NOT IN (0,1))
    INTO n,v1,non_supportata FROM public.rapportini r0
    WHERE r0.cantiere_id=p_cantiere_id AND r0.data=p_data;
  IF non_supportata THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Versione Rapportino non supportata';
  END IF;
  IF n>1 AND v1 THEN
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Contesto Rapportino strutturato ambiguo';
  END IF;
  IF n=0 THEN
    RETURN pg_catalog.jsonb_build_object('versione_lettura',1,'cantiere_id',p_cantiere_id,
      'data',pg_catalog.to_char(p_data,'YYYY-MM-DD'),'presente',false,
      'versione_prestazioni',NULL,'rapportino_id',NULL,'dettaglio',NULL);
  END IF;
  -- V0 storico: ORDER BY created_at DESC (NULLS FIRST implicito) come /stato.
  -- Timestamp uguali: id DESC è lo spareggio deterministico prima non definito.
  -- L'UUID opzionale verifica la scelta; non forza la selezione di un V0 più vecchio.
  SELECT r0.id,r0.versione_prestazioni,r0.revisione_prestazioni,
    r0.note,r0.materiali,r0.quantita_materiali INTO r FROM public.rapportini r0
    WHERE r0.cantiere_id=p_cantiere_id AND r0.data=p_data
    ORDER BY r0.created_at DESC,r0.id DESC LIMIT 1;
  IF p_rapportino_id IS NOT NULL AND p_rapportino_id<>r.id THEN
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='UUID e contesto Rapportino incoerenti';
  END IF;
  dettaglio:=NULL;
  IF r.versione_prestazioni=1 THEN
    dettaglio:=pg_catalog.jsonb_build_object('versione_contratto',1,'rapportino_id',r.id,
      'revisione',r.revisione_prestazioni,'cantiere_id',p_cantiere_id,
      'data',pg_catalog.to_char(p_data,'YYYY-MM-DD'),'documento',pg_catalog.jsonb_build_object(
        'note',coalesce(r.note,''),'materiali',coalesce(r.materiali,''),
        'quantita_materiali',coalesce(r.quantita_materiali,'')),
      'prestazioni',(SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
        'prestazione_id',p.id,'chiave_client',p.chiave_client,'operaio_id',p.operaio_id,
        'operaio_nome',o.nome,'ora_inizio',pg_catalog.to_char(p.ora_inizio,'HH24:MI'),
        'ora_fine',pg_catalog.to_char(p.ora_fine,'HH24:MI'),'pausa_minuti',p.pausa_minuti,
        'lavoro_in_economia',p.lavoro_in_economia,'variante_id',p.variante_id,
        'ore',p.ore,'revisione',p.revisione,'rimossa_at',p.rimossa_at)
        ORDER BY p.created_at,p.id),'[]'::jsonb)
        FROM public.rapportino_prestazioni p JOIN public.operai o ON o.id=p.operaio_id
        WHERE p.rapportino_id=r.id));
  END IF;
  RETURN pg_catalog.jsonb_build_object('versione_lettura',1,'cantiere_id',p_cantiere_id,
    'data',pg_catalog.to_char(p_data,'YYYY-MM-DD'),'presente',true,
    'versione_prestazioni',r.versione_prestazioni,'rapportino_id',r.id,'dettaglio',dettaglio);
END;
$function$
;
ALTER FUNCTION artecna_rapportini.costruisci_lettura_rapportino_v1(uuid,date,uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.quaderno_versione_contenuto()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
  NEW.created_at := OLD.created_at;
  IF ROW(NEW.titolo,NEW.testo,NEW.checklist,NEW.disegni,NEW.analisi_ai)
    IS DISTINCT FROM ROW(OLD.titolo,OLD.testo,OLD.checklist,OLD.disegni,OLD.analisi_ai) THEN
    NEW.updated_at := CASE WHEN isfinite(OLD.updated_at)
      THEN greatest(clock_timestamp(),OLD.updated_at + interval '1 microsecond')
      ELSE clock_timestamp() END;
  ELSE
    NEW.updated_at := OLD.updated_at;
  END IF;
  RETURN NEW;
END $function$
;
ALTER FUNCTION public.quaderno_versione_contenuto() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.foto_fonti_variante(p_user uuid, p_variante uuid, p_collegate boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
 SET "TimeZone" TO 'UTC'
AS $function$
DECLARE v public.varianti_cantiere%ROWTYPE; risultato jsonb;
BEGIN
  SELECT * INTO v FROM public.varianti_cantiere WHERE id=p_variante;
  IF p_user IS NULL OR NOT FOUND OR artecna_guardie.utente_puo_modificare_cantiere(p_user,v.cantiere_id) IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Variante non accessibile';
  END IF;
  IF v.stato IS DISTINCT FROM 'bozza' OR p_collegate IS NULL THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Richiesta non consentita'; END IF;
  WITH foto AS (
    SELECT 'foto_cantiere'::text AS tipo,f.id,to_jsonb(f) AS doc,'cantiere'::text AS origine,
      NULL::text AS sopralluogo_id
    FROM public.foto_cantiere f WHERE f.cantiere_id=v.cantiere_id
    UNION ALL
    SELECT 'foto_sopralluogo',f.id,to_jsonb(f),'sopralluogo',f.sopralluogo_id::text
    FROM public.foto_sopralluogo f WHERE EXISTS (
      SELECT 1 FROM public.cantieri c JOIN public.preventivi_cantiere p
        ON p.id IN (c.origine_preventivo_id,c.preventivo_contrattuale_id)
      WHERE c.id=v.cantiere_id AND p.cantiere_id=c.id AND p.sopralluogo_id::text=f.sopralluogo_id::text
    )
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object('source_id',f.id,'source_type',f.tipo,
    'source_version',NULL,'origine',f.origine,'sopralluogo_id',f.sopralluogo_id,
    'impronta',encode(sha256(convert_to(f.doc::text,'UTF8')),'hex'),
    'collegata',l.source_id IS NOT NULL,'disponibile',true,
    'foto',f.doc || jsonb_build_object('id',f.id,'cantiere',coalesce(f.doc->>'cantiere',''),
      'nota',coalesce(f.doc->>'nota',''),'immagine_base64',coalesce(f.doc->>'immagine_base64',''),
      'allegato_v1_id',f.doc->'allegato_v1_id')) ORDER BY f.tipo,f.id),'[]'::jsonb)
  INTO risultato FROM foto f LEFT JOIN public.variante_fonti_visive l
    ON l.variante_id=v.id AND l.source_type=f.tipo AND l.source_id=f.id
  WHERE NOT p_collegate OR l.source_id IS NOT NULL;
  IF p_collegate THEN
    -- A reference that has lost context remains removable, without disclosing
    -- the now inaccessible photo/metadata. Its changed fingerprint invalidates analysis.
    SELECT risultato || coalesce(jsonb_agg(jsonb_build_object('source_id',l.source_id,'source_type',l.source_type,
      'source_version',NULL,'origine',CASE WHEN l.source_type='foto_cantiere' THEN 'cantiere' ELSE 'sopralluogo' END,
      'sopralluogo_id',NULL,'collegata',true,'disponibile',false,
      'impronta',encode(sha256(convert_to('fonte_non_accessibile','UTF8')),'hex'),
      'foto',jsonb_build_object('id',l.source_id,'cantiere','','nota','','immagine_base64','','allegato_v1_id',NULL))),'[]'::jsonb)
    INTO risultato FROM public.variante_fonti_visive l WHERE l.variante_id=v.id
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(risultato) x WHERE x->>'source_id'=l.source_id::text AND x->>'source_type'=l.source_type);
  END IF;
  RETURN (SELECT coalesce(jsonb_agg(x ORDER BY x->>'source_type',x->>'source_id'),'[]'::jsonb) FROM jsonb_array_elements(risultato) x);
END $function$
;
ALTER FUNCTION artecna_guardie.foto_fonti_variante(uuid,uuid,boolean) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.pacchetto_osservatore_variante(p_user uuid, p_variante uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
 SET "TimeZone" TO 'UTC'
AS $function$
DECLARE v public.varianti_cantiere%ROWTYPE; quaderni jsonb; foto jsonb; manifesto jsonb;
BEGIN
  -- This helper enforces membership/bozza even when there are no photos.
  foto:=artecna_guardie.foto_fonti_variante(p_user,p_variante,true);
  SELECT * INTO STRICT v FROM public.varianti_cantiere WHERE id=p_variante;
  IF EXISTS (SELECT 1 FROM public.variante_fonti_memory l LEFT JOIN public.quaderno_progetti q ON q.id=l.source_id
    WHERE l.variante_id=v.id AND (q.id IS NULL OR q.user_id IS DISTINCT FROM p_user OR q.gestione_copia OR q.gestione_id IS NOT NULL)) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Quaderno collegato non disponibile: rileggere le fonti';
  END IF;
  IF jsonb_array_length(foto)<>(SELECT count(*) FROM public.variante_fonti_visive WHERE variante_id=v.id) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Foto collegata non piu accessibile: scollegare il riferimento';
  END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',q.id,'titolo',q.titolo,'testo',q.testo,
    'updated_at',q.updated_at,'source_version',l.source_version,'aggiornato',q.updated_at=l.source_version,'disponibile',true) ORDER BY q.id),'[]'::jsonb)
  INTO quaderni FROM public.variante_fonti_memory l JOIN public.quaderno_progetti q ON q.id=l.source_id WHERE l.variante_id=v.id;
  manifesto:=jsonb_build_object('versione',1,'variante',jsonb_build_object('source_id',v.id,
    'impronta',encode(sha256(convert_to(jsonb_build_array(v.titolo,v.descrizione)::text,'UTF8')),'hex')),
    'quaderni',(SELECT coalesce(jsonb_agg(jsonb_build_object('source_id',x->>'id','source_version',x->>'updated_at') ORDER BY x->>'id'),'[]'::jsonb) FROM jsonb_array_elements(quaderni) x),
    'foto',(SELECT coalesce(jsonb_agg(jsonb_build_object('source_id',x->>'source_id','source_type',x->>'source_type','source_version',NULL,'impronta',x->>'impronta') ORDER BY x->>'source_type',x->>'source_id'),'[]'::jsonb) FROM jsonb_array_elements(foto) x));
  manifesto:=manifesto || jsonb_build_object('firma',encode(sha256(convert_to(manifesto::text,'UTF8')),'hex'));
  RETURN jsonb_build_object('variante',jsonb_build_object('id',v.id,'stato',v.stato,'titolo',v.titolo,'descrizione',coalesce(v.descrizione,'')),
    'cantiere_id',v.cantiere_id,'quaderni',quaderni,'foto',foto,'manifesto',manifesto);
END $function$
;
ALTER FUNCTION artecna_guardie.pacchetto_osservatore_variante(uuid,uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.proteggi_preventivo_integrativo_generato()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
 IF TG_OP='DELETE' AND current_user='artecna_cantieri_delete_rpc' THEN
  IF artecna_distruzione.contesto_valido(OLD.cantiere_id) THEN RETURN OLD; END IF;
 END IF;
 IF ((TG_OP<>'DELETE' AND NEW.natura='integrativo') OR (TG_OP<>'INSERT' AND OLD.natura='integrativo'))
 AND current_user<>'artecna_varianti_rpc' THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Documento integrativo gestito dalla Variante';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $function$
;
ALTER FUNCTION public.proteggi_preventivo_integrativo_generato() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_contabilita.autorizza(p_fattura uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE u uuid; c uuid;
BEGIN
 u:=artecna_guardie.utente_jwt_corrente();
 SELECT cantiere_id INTO c FROM public.fatture_emesse WHERE id=p_fattura;
 IF u IS NULL OR c IS NULL
 OR artecna_guardie.utente_puo_operare_impresa(u) IS NOT TRUE
 OR artecna_guardie.utente_puo_modificare_cantiere(u,c) IS NOT TRUE
 OR NOT EXISTS(SELECT 1 FROM public.cantieri WHERE id=c)
 THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Fattura non accessibile o contesto Cantiere non verificabile'; END IF;
 RETURN u;
END $function$
;
ALTER FUNCTION artecna_contabilita.autorizza(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_contabilita.proteggi_origine()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE presente boolean; attiva boolean; cambiata boolean;
BEGIN
 PERFORM pg_advisory_xact_lock(714028,1);
 IF TG_TABLE_NAME='fatture_emesse' THEN
  SELECT count(*)>0,coalesce(bool_or(scollegato_at IS NULL),false) INTO presente,attiva FROM artecna_contabilita.attribuzioni_clienti WHERE fattura_id=OLD.id;
 ELSE
  SELECT count(*)>0,coalesce(bool_or(scollegato_at IS NULL),false) INTO presente,attiva FROM artecna_contabilita.attribuzioni_clienti WHERE acconto_id=OLD.id;
 END IF;
 IF TG_OP='DELETE' THEN
  IF presente THEN RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='Origine conservata dallo storico attribuzioni: eliminazione non consentita'; END IF;
  RETURN OLD;
 END IF;
 IF TG_TABLE_NAME='fatture_emesse' THEN
  cambiata:=jsonb_build_array(to_jsonb(NEW)->'id',to_jsonb(NEW)->'totale',to_jsonb(NEW)->'data_fattura',to_jsonb(NEW)->'cantiere_id',to_jsonb(NEW)->'cantiere',to_jsonb(NEW)->'cliente',to_jsonb(NEW)->'stato',to_jsonb(NEW)->'importo_incassato',to_jsonb(NEW)->'tipo_documento')
   IS DISTINCT FROM jsonb_build_array(to_jsonb(OLD)->'id',to_jsonb(OLD)->'totale',to_jsonb(OLD)->'data_fattura',to_jsonb(OLD)->'cantiere_id',to_jsonb(OLD)->'cantiere',to_jsonb(OLD)->'cliente',to_jsonb(OLD)->'stato',to_jsonb(OLD)->'importo_incassato',to_jsonb(OLD)->'tipo_documento');
 ELSE
  cambiata:=jsonb_build_array(NEW.id,NEW.importo,NEW.data_incasso,NEW.cantiere_id,NEW.cantiere) IS DISTINCT FROM jsonb_build_array(OLD.id,OLD.importo,OLD.data_incasso,OLD.cantiere_id,OLD.cantiere);
 END IF;
 -- Anche l'identità di un'origine storica resta immutabile.
 IF (attiva AND cambiata) OR (presente AND NEW.id<>OLD.id)
 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Scollegare prima le attribuzioni attive; identità storica non modificabile'; END IF;
 RETURN NEW;
END $function$
;
ALTER FUNCTION artecna_contabilita.proteggi_origine() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_contabilita.proteggi_truncate()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN
 PERFORM pg_advisory_xact_lock(714028,1);
 IF EXISTS(SELECT 1 FROM artecna_contabilita.attribuzioni_clienti)
 THEN RAISE EXCEPTION USING ERRCODE='23503',MESSAGE='Storico attribuzioni presente: TRUNCATE non consentito'; END IF;
 RETURN NULL;
END $function$
;
ALTER FUNCTION artecna_contabilita.proteggi_truncate() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.link_rapportini_mobile_url_valido(p_url text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
 SELECT coalesce(p_url IS NOT NULL AND p_url=btrim(p_url) AND length(p_url) BETWEEN 1 AND 2048
 AND p_url !~ '[[:space:][:cntrl:]]' AND position(chr(92) in p_url)=0
 AND ((left(p_url,1)='/' AND left(p_url,2)<>'//')
   OR p_url ~* '^https://[^/?#@[:space:]]+([/?#].*)?$'),false)
$function$
;
ALTER FUNCTION public.link_rapportini_mobile_url_valido(text) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION public.proteggi_link_rapportini_mobile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE protetta boolean;
BEGIN
 IF TG_OP='TRUNCATE' THEN
  IF EXISTS(SELECT 1 FROM public.impostazioni_app WHERE chiave='rapportini_mobile_url')
  THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Impostazione portale protetta: TRUNCATE non consentito'; END IF;
  RETURN NULL;
 END IF;
 protetta := CASE WHEN TG_OP='INSERT' THEN NEW.chiave='rapportini_mobile_url'
  WHEN TG_OP='DELETE' THEN OLD.chiave='rapportini_mobile_url'
  ELSE OLD.chiave='rapportini_mobile_url' OR NEW.chiave='rapportini_mobile_url' END;
 IF protetta THEN
  IF artecna_guardie.utente_puo_operare_impresa(artecna_guardie.utente_jwt_corrente()) IS NOT TRUE
  THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Modifica link riservata al titolare attivo'; END IF;
  IF TG_OP='UPDATE' AND (NEW.id IS DISTINCT FROM OLD.id OR NEW.chiave IS DISTINCT FROM OLD.chiave)
  THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Identità impostazione portale non modificabile'; END IF;
  IF TG_OP<>'DELETE' AND public.link_rapportini_mobile_url_valido(NEW.valore) IS NOT TRUE
  THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Link portale non valido'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $function$
;
ALTER FUNCTION public.proteggi_link_rapportini_mobile() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.nc_testo(p_xml xml, p_path text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
  SELECT valore FROM XMLTABLE('.' PASSING p_xml COLUMNS valore text PATH p_path)
$function$
;
ALTER FUNCTION artecna_guardie.nc_testo(xml,text) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.nc_xml(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE f public.fatture_fornitori%ROWTYPE; x xml; g xml; r xml; rie xml;
  righe jsonb := '[]'; riferimenti jsonb := '[]'; imponibile numeric := 0; iva numeric := 0;
BEGIN
  SELECT * INTO STRICT f FROM public.fatture_fornitori WHERE id = p_id;
  IF nullif(btrim(f.xml_testo), '') IS NULL OR f.xml_testo ~* '<!DOCTYPE|<!ENTITY' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='XML originale verificabile non disponibile';
  END IF;
  x := xmlparse(document f.xml_testo);
  IF coalesce(artecna_guardie.nc_testo(x,'//*[local-name()="CedentePrestatore"]//*[local-name()="IdFiscaleIVA"]/*[local-name()="IdPaese"]'),'') !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'Paese identificativo IVA non verificabile nell’XML' USING ERRCODE='22023';
  END IF;
  IF cardinality(xpath('//*[local-name()="FatturaElettronicaBody"]',x)) <> 1 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='XML con numero di documenti non supportato';
  END IF;
  g := (xpath('//*[local-name()="DatiGeneraliDocumento"]',x))[1];
  IF artecna_guardie.nc_testo(g,'/*/*[local-name()="Divisa"]') IS DISTINCT FROM 'EUR' THEN
    RAISE EXCEPTION 'Divisa XML non EUR o non disponibile: nessuna conversione automatica' USING ERRCODE='22023';
  END IF;
  FOR r IN SELECT unnest(xpath('//*[local-name()="DettaglioLinee"]',x)) LOOP
    righe := righe || jsonb_build_array(jsonb_build_object(
      'numero', artecna_guardie.nc_testo(r,'/*/*[local-name()="NumeroLinea"]'),
      'descrizione', artecna_guardie.nc_testo(r,'/*/*[local-name()="Descrizione"]'),
      'quantita', coalesce(artecna_guardie.nc_testo(r,'/*/*[local-name()="Quantita"]'),'1'),
      'prezzo', artecna_guardie.nc_testo(r,'/*/*[local-name()="PrezzoUnitario"]'),
      'totale', artecna_guardie.nc_testo(r,'/*/*[local-name()="PrezzoTotale"]'),
      'iva', artecna_guardie.nc_testo(r,'/*/*[local-name()="AliquotaIVA"]'),
      'natura', artecna_guardie.nc_testo(r,'/*/*[local-name()="Natura"]')));
  END LOOP;
  FOR r IN SELECT unnest(xpath('//*[local-name()="DatiFattureCollegate"]',x)) LOOP
    riferimenti := riferimenti || jsonb_build_array(jsonb_build_object(
      'numero', artecna_guardie.nc_testo(r,'/*/*[local-name()="IdDocumento"]'),
      'data', artecna_guardie.nc_testo(r,'/*/*[local-name()="Data"]'),
      'linee', to_jsonb(xpath('/*/*[local-name()="RiferimentoNumeroLinea"]/text()',r)::text[])));
  END LOOP;
  IF cardinality(xpath('//*[local-name()="DatiRiepilogo"]',x)) = 0 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='Riepilogo IVA XML mancante';
  END IF;
  FOR rie IN SELECT unnest(xpath('//*[local-name()="DatiRiepilogo"]',x)) LOOP
    imponibile := imponibile + artecna_guardie.nc_testo(rie,'/*/*[local-name()="ImponibileImporto"]')::numeric;
    iva := iva + artecna_guardie.nc_testo(rie,'/*/*[local-name()="Imposta"]')::numeric;
  END LOOP;
  IF f.numero_fattura IS DISTINCT FROM artecna_guardie.nc_testo(g,'/*/*[local-name()="Numero"]') OR
    f.data_fattura::text IS DISTINCT FROM artecna_guardie.nc_testo(g,'/*/*[local-name()="Data"]') OR
    f.partita_iva IS DISTINCT FROM artecna_guardie.nc_testo(x,'//*[local-name()="CedentePrestatore"]//*[local-name()="IdFiscaleIVA"]/*[local-name()="IdCodice"]') OR
    round(f.importo_totale,2) IS DISTINCT FROM round(artecna_guardie.nc_testo(g,'/*/*[local-name()="ImportoTotaleDocumento"]')::numeric,2) THEN
    RAISE EXCEPTION 'Testata persistita non coerente con XML originale' USING ERRCODE='22023';
  END IF;
  RETURN jsonb_build_object('id',f.id,'numero',artecna_guardie.nc_testo(g,'/*/*[local-name()="Numero"]'),
    'data',artecna_guardie.nc_testo(g,'/*/*[local-name()="Data"]'),
    'tipo',artecna_guardie.nc_testo(g,'/*/*[local-name()="TipoDocumento"]'),
    'partita_iva',artecna_guardie.nc_testo(x,'//*[local-name()="CedentePrestatore"]//*[local-name()="IdFiscaleIVA"]/*[local-name()="IdCodice"]'),
    'paese',artecna_guardie.nc_testo(x,'//*[local-name()="CedentePrestatore"]//*[local-name()="IdFiscaleIVA"]/*[local-name()="IdPaese"]'),
    'totale_originale',artecna_guardie.nc_testo(g,'/*/*[local-name()="ImportoTotaleDocumento"]'),
    'imponibile_originale',imponibile::text,'iva_originale',iva::text,'righe',righe,'riferimenti',riferimenti);
EXCEPTION WHEN invalid_xml_document OR invalid_xml_content THEN
  RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='XML originale non valido';
END $function$
;
ALTER FUNCTION artecna_guardie.nc_xml(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.nc_righe_coerenti(p_id uuid, p_meta jsonb)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
  SELECT jsonb_array_length(p_meta->'righe')>0
    AND (SELECT count(*)=count(DISTINCT numero_riga) AND count(*)=jsonb_array_length(p_meta->'righe')
      FROM public.fatture_fornitori_righe WHERE fattura_id=p_id)
    AND (SELECT count(*)=count(DISTINCT value->>'numero') FROM jsonb_array_elements(p_meta->'righe'))
    AND NOT EXISTS(SELECT 1 FROM public.fatture_fornitori_righe r WHERE r.fattura_id=p_id
      AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_meta->'righe') x
        WHERE (x->>'numero')::integer=r.numero_riga AND (x->>'quantita')::numeric=r.quantita
          AND (x->>'prezzo')::numeric=r.prezzo_unitario AND x->>'descrizione'=r.descrizione))
$function$
;
ALTER FUNCTION artecna_guardie.nc_righe_coerenti(uuid,jsonb) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.nc_tipo(p_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE f public.fatture_fornitori%ROWTYPE; x xml;
BEGIN
  SELECT * INTO STRICT f FROM public.fatture_fornitori WHERE id=p_id;
  IF nullif(btrim(f.xml_testo),'') IS NULL THEN RETURN f.tipo_documento; END IF;
  IF f.xml_testo ~* '<!DOCTYPE|<!ENTITY' THEN RAISE EXCEPTION 'XML non ammesso' USING ERRCODE='22023'; END IF;
  x := xmlparse(document f.xml_testo);
  IF cardinality(xpath('//*[local-name()="FatturaElettronicaBody"]',x)) <> 1 THEN
    RAISE EXCEPTION 'XML non univoco' USING ERRCODE='22023';
  END IF;
  RETURN artecna_guardie.nc_testo(x,'//*[local-name()="DatiGeneraliDocumento"]/*[local-name()="TipoDocumento"]');
END $function$
;
ALTER FUNCTION artecna_guardie.nc_tipo(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.nc_quote(p_origine uuid)
 RETURNS TABLE(tipo text, id uuid, origine_riga_id uuid, cantiere_id uuid, categoria text, quantita numeric, netto numeric, costo numeric, numero_riga integer, descrizione text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
  SELECT 'economia',e.id,r.id,c.cantiere_id,'materiali',e.quantita,e.quantita*e.prezzo_unitario,e.quantita*e.prezzo_unitario,r.numero_riga,r.descrizione
    FROM public.economia_righe e JOIN public.economia_raccolte c ON c.id=e.raccolta_id
    JOIN public.fatture_fornitori_righe r ON r.id=e.fattura_riga_id WHERE r.fattura_id=p_origine
  UNION ALL SELECT 'cantiere',m.id,r.id,m.cantiere_id,'materiali',m.quantita,m.quantita*m.prezzo_unitario,m.totale,r.numero_riga,r.descrizione
    FROM public.materiali_cantiere m JOIN public.fatture_fornitori_righe r ON r.id=m.fattura_riga_id WHERE r.fattura_id=p_origine
  UNION ALL SELECT 'impresa',m.id,r.id,NULL,m.categoria,m.quantita,m.quantita*m.prezzo_unitario,m.totale,r.numero_riga,r.descrizione
    FROM public.materiali_impresa m JOIN public.fatture_fornitori_righe r ON r.id=m.fattura_riga_id WHERE r.fattura_id=p_origine
  UNION ALL SELECT 'spesa',s.id,r.id,NULL,s.categoria,r.quantita,r.quantita*r.prezzo_unitario,s.importo,r.numero_riga,r.descrizione
    FROM public.spese_impresa s JOIN public.fatture_fornitori_righe r ON r.id=s.riga_fattura_id
    WHERE r.fattura_id=p_origine AND s.fattura_id=p_origine
$function$
;
ALTER FUNCTION artecna_guardie.nc_quote(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.nc_accesso(p_cantiere uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE u uuid := artecna_guardie.utente_jwt_corrente();
BEGIN
  IF NOT coalesce(artecna_guardie.utente_puo_operare_impresa(u),false)
    OR (p_cantiere IS NOT NULL AND NOT coalesce(artecna_guardie.utente_puo_modificare_cantiere(u,p_cantiere),false)) THEN
    RAISE EXCEPTION 'Operazione riservata al titolare attivo nel contesto autorizzato' USING ERRCODE='42501';
  END IF;
END $function$
;
ALTER FUNCTION artecna_guardie.nc_accesso(uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.nc_immutabile()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
BEGIN RAISE EXCEPTION 'Registro rettifiche immutabile' USING ERRCODE='55000'; END $function$
;
ALTER FUNCTION artecna_guardie.nc_immutabile() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.nc_proteggi_quote()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE j jsonb := to_jsonb(NEW); prima jsonb; riga uuid; documento uuid;
BEGIN
  IF TG_OP='UPDATE' THEN prima := to_jsonb(OLD); END IF;
  IF current_setting('transaction_isolation')<>'read committed' AND
    coalesce(j->>'fattura_riga_id',j->>'riga_fattura_id',j->>'fattura_id',prima->>'fattura_riga_id',prima->>'riga_fattura_id',prima->>'fattura_id') IS NOT NULL THEN
    RAISE EXCEPTION 'Quote fattura: richiesta una transazione READ COMMITTED' USING ERRCODE='22023';
  END IF;
  -- Il lock precede il controllo storico: un UPDATE concorrente non deve
  -- usare una fotografia precedente al COMMIT della rettifica.
  riga := coalesce(j->>'fattura_riga_id',j->>'riga_fattura_id')::uuid;
  IF riga IS NOT NULL THEN SELECT fattura_id INTO documento FROM public.fatture_fornitori_righe WHERE id=riga; ELSE documento := (j->>'fattura_id')::uuid; END IF;
  IF documento IS NOT NULL THEN
    IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'Quote fattura: richiesta una transazione READ COMMITTED' USING ERRCODE='22023'; END IF;
    PERFORM 1 FROM public.fatture_fornitori WHERE id=documento FOR UPDATE;
  END IF;
  IF TG_OP='UPDATE' THEN
    prima := to_jsonb(OLD);
    IF EXISTS(SELECT 1 FROM public.fornitori_rettifiche r WHERE CASE TG_TABLE_NAME WHEN 'economia_righe' THEN r.economia_riga_id WHEN 'materiali_cantiere' THEN r.materiale_cantiere_id WHEN 'materiali_impresa' THEN r.materiale_impresa_id WHEN 'spese_impresa' THEN r.spesa_impresa_id END=OLD.id)
      AND (j->'quantita',j->'prezzo_unitario',j->'totale',j->'importo',j->'cantiere_id',j->'raccolta_id',j->'categoria',j->'origine',j->'tipo_riga',j->'sorgente_id',j->'dettagli_analitici',j->'unita_misura',j->'cantiere',j->'data_documento',j->'fattura_riga_id',j->'riga_fattura_id',j->'fattura_id')
      IS DISTINCT FROM (prima->'quantita',prima->'prezzo_unitario',prima->'totale',prima->'importo',prima->'cantiere_id',prima->'raccolta_id',prima->'categoria',prima->'origine',prima->'tipo_riga',prima->'sorgente_id',prima->'dettagli_analitici',prima->'unita_misura',prima->'cantiere',prima->'data_documento',prima->'fattura_riga_id',prima->'riga_fattura_id',prima->'fattura_id') THEN
      RAISE EXCEPTION 'Quota originaria con rettifica: dati economici/destinazione protetti' USING ERRCODE='55000';
    END IF;
  END IF;
  IF documento IS NOT NULL THEN
    IF artecna_guardie.nc_tipo(documento)='TD04' AND (TG_OP='INSERT' OR
      (j->'quantita',j->'prezzo_unitario',j->'totale',j->'importo',j->'fattura_riga_id',j->'riga_fattura_id',j->'fattura_id') IS DISTINCT FROM
      (prima->'quantita',prima->'prezzo_unitario',prima->'totale',prima->'importo',prima->'fattura_riga_id',prima->'riga_fattura_id',prima->'fattura_id')) THEN
      RAISE EXCEPTION 'TD04: usare il percorso di rettifica, non assegnazioni positive ordinarie' USING ERRCODE='22023';
    END IF;
  END IF;
  RETURN NEW;
END $function$
;
ALTER FUNCTION artecna_guardie.nc_proteggi_quote() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.nc_proteggi_documenti()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE j jsonb:=to_jsonb(NEW); prima jsonb:=to_jsonb(OLD);
BEGIN
  IF TG_TABLE_NAME='fatture_fornitori_righe' THEN
    IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'Righe fattura: richiesta una transazione READ COMMITTED' USING ERRCODE='22023'; END IF;
    PERFORM 1 FROM public.fatture_fornitori WHERE id IN ((j->>'fattura_id')::uuid,(prima->>'fattura_id')::uuid) ORDER BY id FOR UPDATE;
    IF EXISTS(SELECT 1 FROM public.fornitori_rettifiche WHERE nota_id IN ((j->>'fattura_id')::uuid,(prima->>'fattura_id')::uuid)
      OR origine_id IN ((j->>'fattura_id')::uuid,(prima->>'fattura_id')::uuid))
      AND (TG_OP<>'UPDATE' OR (j-'stato') IS DISTINCT FROM (prima-'stato')) THEN
      RAISE EXCEPTION 'Documento con rettifiche: inventario delle righe protetto' USING ERRCODE='55000';
    END IF;
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF artecna_guardie.nc_tipo((j->>'fattura_id')::uuid)='TD04' AND
    (TG_OP='INSERT' OR (j->'categoria_economica',j->'cantiere',j->'cantiere_id') IS DISTINCT FROM (prima->'categoria_economica',prima->'cantiere',prima->'cantiere_id'))
    AND (nullif(j->>'categoria_economica','') IS NOT NULL OR nullif(j->>'cantiere','') IS NOT NULL OR j->>'cantiere_id' IS NOT NULL) THEN
    RAISE EXCEPTION 'TD04: classificazione e destinazione solo tramite rettifica' USING ERRCODE='22023';
  END IF;
  END IF;
  IF TG_OP='UPDATE' AND ((TG_TABLE_NAME='fatture_fornitori' AND EXISTS(SELECT 1 FROM public.fornitori_rettifiche WHERE nota_id=OLD.id OR origine_id=OLD.id)
    AND (j-'stato'-'note') IS DISTINCT FROM (prima-'stato'-'note')) OR
    (TG_TABLE_NAME='fatture_fornitori_righe' AND EXISTS(SELECT 1 FROM public.fornitori_rettifiche WHERE nota_riga_id=OLD.id OR origine_riga_id=OLD.id)
    AND (j-'stato') IS DISTINCT FROM (prima-'stato'))) THEN
    RAISE EXCEPTION 'Documento con rettifiche: dati originali protetti' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END $function$
;
ALTER FUNCTION artecna_guardie.nc_proteggi_documenti() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_distruzione.fk_rettifiche_td04_certificata(p_oid oid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE k record; v_col text; v_target regclass;
BEGIN
 SELECT * INTO k FROM pg_constraint WHERE oid=p_oid;
 IF NOT FOUND OR k.conrelid<>'public.fornitori_rettifiche'::regclass THEN RETURN false; END IF;
 CASE k.conname
 WHEN 'fornitori_rettifiche_cantiere_id_fkey' THEN v_col:='cantiere_id';v_target:='public.cantieri'::regclass;
 WHEN 'fornitori_rettifiche_economia_riga_id_fkey' THEN v_col:='economia_riga_id';v_target:='public.economia_righe'::regclass;
 WHEN 'fornitori_rettifiche_materiale_cantiere_id_fkey' THEN v_col:='materiale_cantiere_id';v_target:='public.materiali_cantiere'::regclass;
 WHEN 'fornitori_rettifiche_nota_riga_id_fkey' THEN v_col:='nota_riga_id';v_target:='public.fatture_fornitori_righe'::regclass;
 WHEN 'fornitori_rettifiche_origine_riga_id_fkey' THEN v_col:='origine_riga_id';v_target:='public.fatture_fornitori_righe'::regclass;
 ELSE RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='FK storico TD04 non certificata';
 END CASE;
 IF k.contype<>'f' OR NOT k.convalidated OR k.condeferrable OR k.condeferred OR k.confrelid<>v_target
  OR k.confdeltype<>'r' OR k.confupdtype<>'a' OR k.confmatchtype<>'s'
  OR k.conkey IS DISTINCT FROM ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=k.conrelid AND attname=v_col AND NOT attisdropped)]::smallint[]
  OR k.confkey IS DISTINCT FROM ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid=v_target AND attname='id' AND NOT attisdropped)]::smallint[] THEN
  RAISE EXCEPTION USING ERRCODE='P2113',MESSAGE='FK storico TD04 divergente';
 END IF;
 -- Il passaggio esterno è utilizzabile solo dopo la certificazione integrale
 -- di inizia_contesto, non come scorciatoia per avviare una distruzione.
 RETURN EXISTS(SELECT 1 FROM artecna_distruzione.contesto c
   WHERE c.transazione=pg_current_xact_id_if_assigned() AND c.backend=pg_backend_pid()
     AND c.user_id=artecna_guardie.utente_jwt_corrente()
     AND artecna_distruzione.contesto_valido(c.cantiere_id));
END $function$
;
ALTER FUNCTION artecna_distruzione.fk_rettifiche_td04_certificata(oid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.prezzo_materiale_cliente(e public.economia_righe)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE j jsonb; p numeric;
BEGIN
 j:=e.dettagli_analitici->'cliente_materiale';
 IF j IS NULL THEN RETURN e.prezzo_unitario; END IF;
 IF e.tipo_riga<>'materiale' OR jsonb_typeof(j)<>'object' OR j->>'versione' IS DISTINCT FROM '1'
 OR jsonb_typeof(j->'storico')<>'array' OR jsonb_array_length(j->'storico')=0 THEN RAISE EXCEPTION 'Metadati prezzo cliente non validi' USING ERRCODE='22023'; END IF;
 p:=(j->>'prezzo')::numeric;
 IF p IS NULL OR p::text IN ('NaN','Infinity','-Infinity') OR p<=0 OR p>=1000000000000 OR p<>round(p,6)
 OR (j->'storico'->-1->>'prezzo')::numeric IS DISTINCT FROM p THEN RAISE EXCEPTION 'Prezzo cliente non valido' USING ERRCODE='22023'; END IF;
 RETURN p;
END $function$
;
ALTER FUNCTION artecna_guardie.prezzo_materiale_cliente(public.economia_righe) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.proteggi_prezzo_materiale_cliente()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE a jsonb; b jsonb; r public.economia_raccolte%rowtype;
BEGIN
 IF TG_OP='DELETE' THEN IF OLD.dettagli_analitici ? 'cliente_materiale' THEN RAISE EXCEPTION 'Storico prezzi cliente persistente' USING ERRCODE='55000'; END IF; RETURN OLD; END IF;
 a:=CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.dettagli_analitici->'cliente_materiale' END;
 b:=NEW.dettagli_analitici->'cliente_materiale';
 IF a IS NOT DISTINCT FROM b THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' OR current_user<>'postgres' OR b IS NULL OR NEW.tipo_riga<>'materiale' THEN RAISE EXCEPTION 'Scrittura prezzo cliente non consentita' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.economia_raccolte WHERE id=OLD.raccolta_id FOR UPDATE;
 IF r.stato IS DISTINCT FROM 'bozza' OR EXISTS(SELECT 1 FROM public.variante_sorgenti WHERE economia_raccolta_id=r.id AND tipo='raccolta_economia') THEN RAISE EXCEPTION 'Raccolta congelata' USING ERRCODE='55000'; END IF;
 IF (to_jsonb(NEW)-ARRAY['dettagli_analitici','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['dettagli_analitici','updated_at'])
 OR (NEW.dettagli_analitici-'cliente_materiale') IS DISTINCT FROM (OLD.dettagli_analitici-'cliente_materiale')
 OR b->'storico' IS DISTINCT FROM (coalesce(a->'storico','[]'::jsonb)||jsonb_build_array(b->'storico'->-1))
 OR (b->'storico'->-1->>'revisione_precedente')::bigint IS DISTINCT FROM r.revisione
 OR (b->'storico'->-1->>'utente')::uuid IS DISTINCT FROM artecna_guardie.utente_jwt_corrente() THEN RAISE EXCEPTION 'Origine o storico prezzo cliente modificato' USING ERRCODE='22023'; END IF;
 PERFORM artecna_guardie.prezzo_materiale_cliente(NEW);
 RETURN NEW;
END $function$
;
ALTER FUNCTION artecna_guardie.proteggi_prezzo_materiale_cliente() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.certifica_snapshot_cliente(snap jsonb)
 RETURNS void
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE rid uuid; registrazioni jsonb; totale numeric; r public.economia_raccolte%rowtype;
BEGIN
 IF snap->>'versione_esclusioni'='1' THEN PERFORM artecna_guardie.certifica_snapshot_esclusioni(snap); RETURN; END IF;
 rid:=(snap->>'raccolta_id')::uuid;
 SELECT * INTO r FROM public.economia_raccolte WHERE id=rid;
 IF NOT FOUND OR r.stato<>'chiusa' OR snap->>'versione_prezzi_cliente' IS DISTINCT FROM '1' OR snap->>'cantiere_id' IS DISTINCT FROM r.cantiere_id::text
 OR snap->>'titolo' IS DISTINCT FROM r.titolo OR snap->>'data' IS DISTINCT FROM r.data::text OR (snap->>'numero')::integer IS DISTINCT FROM r.numero OR snap->>'note' IS DISTINCT FROM r.note OR (snap->>'revisione_sorgente') IS NULL OR (snap->>'revisione_sorgente')::bigint NOT IN (r.revisione,r.revisione-1) OR (snap->>'revisione_congelata')::bigint IS DISTINCT FROM r.revisione THEN RAISE EXCEPTION 'Snapshot cliente non certificato' USING ERRCODE='XX001'; END IF;
 SELECT jsonb_agg(jsonb_build_object('id',e.id,'ordine',e.ordine,'descrizione',e.descrizione,'unita_misura',e.unita_misura,'quantita',e.quantita,
 'prezzo_unitario',artecna_guardie.prezzo_materiale_cliente(e),'importo',round(e.quantita*artecna_guardie.prezzo_materiale_cliente(e),2),
 'note',e.note,'origine',e.origine,'sorgente_id',e.sorgente_id,'indice_voce_sorgente',e.indice_voce_sorgente,'tipo_riga',e.tipo_riga,'dettagli_analitici',e.dettagli_analitici) ORDER BY ordine,id),sum(round(e.quantita*artecna_guardie.prezzo_materiale_cliente(e),2))
 INTO registrazioni,totale FROM public.economia_righe e WHERE raccolta_id=rid;
 IF registrazioni IS NULL OR snap->'registrazioni' IS DISTINCT FROM registrazioni OR (snap->>'totale')::numeric IS DISTINCT FROM totale
 OR (snap->>'numero_registrazioni')::integer IS DISTINCT FROM jsonb_array_length(registrazioni) OR EXISTS(SELECT 1 FROM public.economia_righe e WHERE raccolta_id=rid AND (e.quantita<=0 OR artecna_guardie.prezzo_materiale_cliente(e) IS NULL OR artecna_guardie.prezzo_materiale_cliente(e)<=0 OR round(e.quantita*artecna_guardie.prezzo_materiale_cliente(e),2)<=0)) THEN RAISE EXCEPTION 'Riconciliazione snapshot cliente divergente' USING ERRCODE='XX001'; END IF;
END $function$
;
ALTER FUNCTION artecna_guardie.certifica_snapshot_cliente(jsonb) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.riga_esclusa_proposta(e public.economia_righe)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE j jsonb; BEGIN
 j:=e.dettagli_analitici->'proposta_non_economica'; IF j IS NULL THEN RETURN false; END IF;
 IF e.tipo_riga<>'materiale' OR jsonb_typeof(j)<>'object' OR j->>'versione' IS DISTINCT FROM '1' OR jsonb_typeof(j->'esclusa') IS DISTINCT FROM 'boolean'
 OR jsonb_typeof(j->'motivo') IS DISTINCT FROM 'string' OR length(trim(j->>'motivo')) NOT BETWEEN 10 AND 1000 OR jsonb_typeof(j->'storico') IS DISTINCT FROM 'array' OR jsonb_array_length(j->'storico')=0
 OR j->'storico'->-1->'esclusa' IS DISTINCT FROM j->'esclusa' OR j->'storico'->-1->>'motivo' IS DISTINCT FROM j->>'motivo' THEN RAISE EXCEPTION 'Esclusione non verificabile' USING ERRCODE='22023'; END IF;
 IF (j->>'esclusa')::boolean AND (e.quantita IS NULL OR e.quantita<=0 OR e.quantita::text IN ('NaN','Infinity','-Infinity') OR artecna_guardie.prezzo_materiale_cliente(e) IS DISTINCT FROM 0::numeric) THEN RAISE EXCEPTION 'Solo riga a valore zero escludibile' USING ERRCODE='22023'; END IF;
 RETURN (j->>'esclusa')::boolean;
END $function$
;
ALTER FUNCTION artecna_guardie.riga_esclusa_proposta(public.economia_righe) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.proteggi_esclusione_proposta()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE a jsonb; b jsonb; r public.economia_raccolte%rowtype; BEGIN
 IF TG_OP='DELETE' THEN IF OLD.dettagli_analitici ? 'proposta_non_economica' THEN RAISE EXCEPTION 'Storico esclusione persistente' USING ERRCODE='55000'; END IF; RETURN OLD; END IF;
 a:=CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.dettagli_analitici->'proposta_non_economica' END; b:=NEW.dettagli_analitici->'proposta_non_economica';
 IF a IS NOT DISTINCT FROM b THEN RETURN NEW; END IF;
 IF TG_OP='INSERT' OR current_user<>'postgres' OR b IS NULL THEN RAISE EXCEPTION 'Classificazione non autorizzata' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM public.economia_raccolte WHERE id=OLD.raccolta_id FOR UPDATE;
 IF r.stato IS DISTINCT FROM 'bozza' OR EXISTS(SELECT 1 FROM public.variante_sorgenti WHERE economia_raccolta_id=r.id AND tipo='raccolta_economia') THEN RAISE EXCEPTION 'Raccolta congelata' USING ERRCODE='55000'; END IF;
 IF (to_jsonb(NEW)-ARRAY['dettagli_analitici','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['dettagli_analitici','updated_at']) OR (NEW.dettagli_analitici-'proposta_non_economica') IS DISTINCT FROM (OLD.dettagli_analitici-'proposta_non_economica')
 OR b->'storico' IS DISTINCT FROM coalesce(a->'storico','[]'::jsonb)||jsonb_build_array(b->'storico'->-1)
 OR (b->'storico'->-1->>'utente')::uuid IS DISTINCT FROM artecna_guardie.utente_jwt_corrente() OR (b->'storico'->-1->>'revisione_precedente')::bigint IS DISTINCT FROM r.revisione THEN RAISE EXCEPTION 'Storico o provenienza modificati' USING ERRCODE='22023'; END IF;
 PERFORM artecna_guardie.riga_esclusa_proposta(NEW); RETURN NEW;
END $function$
;
ALTER FUNCTION artecna_guardie.proteggi_esclusione_proposta() OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.certifica_snapshot_esclusioni(snap jsonb)
 RETURNS void
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$

DECLARE rid uuid; registrazioni jsonb; totale numeric; incluse integer; r public.economia_raccolte%rowtype;
BEGIN
 rid:=(snap->>'raccolta_id')::uuid;
 SELECT * INTO r FROM public.economia_raccolte WHERE id=rid;
 IF NOT FOUND OR r.stato<>'chiusa' OR snap->>'versione_prezzi_cliente' IS DISTINCT FROM '1' OR snap->>'cantiere_id' IS DISTINCT FROM r.cantiere_id::text
 OR snap->>'titolo' IS DISTINCT FROM r.titolo OR snap->>'data' IS DISTINCT FROM r.data::text OR (snap->>'numero')::integer IS DISTINCT FROM r.numero OR snap->>'note' IS DISTINCT FROM r.note OR (snap->>'revisione_sorgente') IS NULL OR (snap->>'revisione_sorgente')::bigint NOT IN (r.revisione,r.revisione-1) OR (snap->>'revisione_congelata')::bigint IS DISTINCT FROM r.revisione THEN RAISE EXCEPTION 'Snapshot cliente non certificato' USING ERRCODE='XX001'; END IF;
 SELECT jsonb_agg(jsonb_build_object('id',e.id,'ordine',e.ordine,'descrizione',e.descrizione,'unita_misura',e.unita_misura,'quantita',e.quantita,
 'prezzo_unitario',artecna_guardie.prezzo_materiale_cliente(e),'importo',round(e.quantita*artecna_guardie.prezzo_materiale_cliente(e),2),
 'note',e.note,'origine',e.origine,'sorgente_id',e.sorgente_id,'indice_voce_sorgente',e.indice_voce_sorgente,'tipo_riga',e.tipo_riga,'dettagli_analitici',e.dettagli_analitici,'esclusa_proposta',artecna_guardie.riga_esclusa_proposta(e)) ORDER BY ordine,id),sum(round(e.quantita*artecna_guardie.prezzo_materiale_cliente(e),2)) FILTER(WHERE NOT artecna_guardie.riga_esclusa_proposta(e))
 INTO registrazioni,totale FROM public.economia_righe e WHERE raccolta_id=rid;
 SELECT count(*) INTO incluse FROM public.economia_righe e WHERE raccolta_id=rid AND NOT artecna_guardie.riga_esclusa_proposta(e);
 IF snap->>'versione_esclusioni' IS DISTINCT FROM '1' OR incluse=0 OR (snap->>'numero_incluse')::integer IS DISTINCT FROM incluse OR (snap->>'numero_escluse')::integer IS DISTINCT FROM jsonb_array_length(registrazioni)-incluse THEN RAISE EXCEPTION 'Conteggi esclusione incoerenti' USING ERRCODE='XX001'; END IF;
 IF registrazioni IS NULL OR snap->'registrazioni' IS DISTINCT FROM registrazioni OR (snap->>'totale')::numeric IS DISTINCT FROM totale
 OR (snap->>'numero_registrazioni')::integer IS DISTINCT FROM jsonb_array_length(registrazioni) OR EXISTS(SELECT 1 FROM public.economia_righe e WHERE raccolta_id=rid AND NOT artecna_guardie.riga_esclusa_proposta(e) AND (e.quantita<=0 OR artecna_guardie.prezzo_materiale_cliente(e) IS NULL OR artecna_guardie.prezzo_materiale_cliente(e)<=0 OR round(e.quantita*artecna_guardie.prezzo_materiale_cliente(e),2)<=0)) THEN RAISE EXCEPTION 'Riconciliazione snapshot cliente divergente' USING ERRCODE='XX001'; END IF;
END
$function$
;
ALTER FUNCTION artecna_guardie.certifica_snapshot_esclusioni(jsonb) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_guardie.preflight_dipendenze(p_entita text, p_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'pg_temp'
 SET row_security TO 'off'
AS $function$
DECLARE
  required record; path record; found_dependency boolean;
  categories text[] := ARRAY[]::text[]; category text;
  root_oid oid; root_name text; site_name text; expected text[];
  result jsonb := jsonb_build_object('versione',1,'entita',p_entita,'id',p_id,
    'stato','non_verificabile','verifica_completa',false,'categorie','[]'::jsonb,
    'azione_consigliata','nessuna','verificato_at',statement_timestamp());
BEGIN
  IF p_entita NOT IN ('sopralluogo','cantiere') OR p_id IS NULL THEN RETURN result; END IF;
  root_name := CASE p_entita WHEN 'cantiere' THEN 'cantieri' ELSE 'sopralluoghi' END;
  root_oid := to_regclass(format('public.%I',root_name));
  -- Inventario minimo obbligatorio: mancanza di una relazione attesa NON vale
  -- come assenza di dati. Le FK e i riferimenti aggiuntivi sono censiti sotto.
  expected := CASE p_entita WHEN 'sopralluogo' THEN ARRAY[
    'sopralluoghi.id','foto_sopralluogo.sopralluogo_id','note_sopralluogo.sopralluogo_id',
    'note_allegati.nota_id','quaderno_richiami_sopralluogo.sopralluogo_id',
    'quaderno_copie_allegati.nota_id','quaderno_gestioni.sopralluogo_id',
    'preventivi_cantiere.sopralluogo_id','variante_fonti_visive.foto_sopralluogo_id']
  ELSE ARRAY['cantieri.id','cantieri.nome','cantieri.preventivo','cantieri.origine_preventivo_id',
    'cantieri.preventivo_contrattuale_id','utenti_cantiere.cantiere_id',
    'sal_lavorazioni.cantiere_id','acconti_cantiere.cantiere_id',
    'preventivi_cantiere.cantiere_id','preventivo_lavorazioni.cantiere_id',
    'economia_raccolte.cantiere_id','economia_righe.raccolta_id',
    'varianti_cantiere.cantiere_id','variante_lavorazioni.variante_id',
    'variante_sorgenti.variante_id','variante_documenti.variante_id',
    'fatture_emesse.cantiere_id','incassi_non_fatturati.cantiere_id',
    'fatture_fornitori_righe.cantiere_id','pagamenti_fornitori.cantiere_id',
    'fornitori_rettifiche.cantiere_id','rapportini.cantiere_id',
    'rapportino_prestazioni.rapportino_id','rapportino_materiali.rapportino_id',
    'timbrature.cantiere_id','materiali_cantiere.cantiere_id',
    'attrezzi_cantiere.cantiere_id','foto_cantiere.cantiere_id'] END;
  FOR required IN SELECT split_part(x,'.',1) AS tab,split_part(x,'.',2) AS col
    FROM unnest(expected) x LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_attribute a ON a.attrelid=c.oid
      WHERE n.nspname='public' AND c.relname=required.tab AND c.relkind IN ('r','p')
        AND a.attname=required.col AND a.attnum>0 AND NOT a.attisdropped) THEN RETURN result; END IF;
  END LOOP;
  -- Rami indiretti obbligatori: una FK rimossa o non validata non puo
  -- trasformare un figlio non piu raggiungibile in prova di eliminabilita.
  FOR required IN SELECT * FROM (VALUES
    ('sopralluogo','note_allegati','nota_id','note_sopralluogo'),
    ('sopralluogo','quaderno_copie_allegati','nota_id','note_sopralluogo'),
    ('sopralluogo','quaderno_copie_allegati','richiamo_id','quaderno_richiami_sopralluogo'),
    ('sopralluogo','variante_fonti_visive','foto_sopralluogo_id','foto_sopralluogo'),
    ('cantiere','economia_righe','raccolta_id','economia_raccolte'),
    ('cantiere','economia_sorgenti','raccolta_id','economia_raccolte'),
    ('cantiere','variante_lavorazioni','variante_id','varianti_cantiere'),
    ('cantiere','variante_sorgenti','variante_id','varianti_cantiere'),
    ('cantiere','variante_documenti','variante_id','varianti_cantiere'),
    ('cantiere','rapportino_prestazioni','rapportino_id','rapportini'),
    ('cantiere','rapportino_materiali','rapportino_id','rapportini')
  ) m(entita,tab,col,padre) WHERE entita=p_entita LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint k
      JOIN pg_attribute a ON a.attrelid=k.conrelid AND a.attnum=ANY(k.conkey)
      JOIN pg_attribute pa ON pa.attrelid=k.confrelid
        AND pa.attnum=k.confkey[array_position(k.conkey,a.attnum)]
      WHERE k.contype='f' AND k.convalidated
        AND k.conrelid=to_regclass(format('public.%I',required.tab))
        AND k.confrelid=to_regclass(format('public.%I',required.padre))
        AND a.attname=required.col AND pa.attname='id') THEN RETURN result; END IF;
  END LOOP;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE id::text=$1)',root_name)
    INTO found_dependency USING p_id;
  IF NOT found_dependency THEN RETURN result; END IF;
  IF p_entita='cantiere' THEN
    SELECT c.nome INTO site_name FROM public.cantieri c WHERE c.id::text=p_id;
    IF EXISTS (SELECT 1 FROM public.cantieri c WHERE c.id::text=p_id AND coalesce(c.preventivo,0)<>0) THEN
      categories := array_append(categories,'economia');
    END IF;
    IF EXISTS (SELECT 1 FROM public.cantieri c WHERE c.id::text=p_id
      AND (c.origine_preventivo_id IS NOT NULL OR c.preventivo_contrattuale_id IS NOT NULL)) THEN
      categories := array_append(categories,'preventivi');
    END IF;
  END IF;

  -- Semi: record radice, riferimenti logici *_id anche senza FK e nomi legacy
  -- (questi ultimi possono solo bloccare, mai provare ownership/eliminabilita).
  -- Poi si percorrono le FK entranti, incluse quelle composite e cross-schema.
  -- Una riga intermedia e gia un blocco: nessuna scrittura/manifest distruttivo.
  FOR path IN
    WITH RECURSIVE seeds AS (
      SELECT root_oid AS rel,format('public.%I t0',root_name) AS joins,
        't0.id::text=$1'::text AS predicate,ARRAY[root_oid] AS visited,0 AS depth,true AS root
      UNION ALL
      SELECT c.oid,format('%I.%I t0',n.nspname,c.relname),
        format('t0.%I::text=%s',a.attname,CASE WHEN a.attname='cantiere' THEN '$2' ELSE '$1' END),
        ARRAY[c.oid],0,false
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
      WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.oid<>root_oid
        AND c.relname<>'utenti_cantiere'
        AND a.attname=ANY(CASE p_entita WHEN 'cantiere' THEN ARRAY['cantiere_id','cantiere']
          ELSE ARRAY['sopralluogo_id'] END)
    ), walk AS (
      SELECT * FROM seeds
      UNION ALL
      SELECT k.conrelid,w.joins||format(' JOIN %I.%I t%s ON ',n.nspname,c.relname,w.depth+1)||
        (SELECT string_agg(format('t%s.%I=t%s.%I',w.depth+1,ca.attname,w.depth,pa.attname),' AND ' ORDER BY u.ord)
          FROM unnest(k.conkey,k.confkey) WITH ORDINALITY u(child,parent,ord)
          JOIN pg_attribute ca ON ca.attrelid=k.conrelid AND ca.attnum=u.child
          JOIN pg_attribute pa ON pa.attrelid=k.confrelid AND pa.attnum=u.parent),
        w.predicate,w.visited||k.conrelid,w.depth+1,false
      FROM walk w JOIN pg_constraint k ON k.confrelid=w.rel AND k.contype='f'
        JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE NOT k.conrelid=ANY(w.visited) AND w.depth<12
        AND NOT (n.nspname='public' AND c.relname='utenti_cantiere')
    ) SELECT w.*,c.relname,n.nspname FROM walk w
      JOIN pg_class c ON c.oid=w.rel JOIN pg_namespace n ON n.oid=c.relnamespace
      ORDER BY w.depth,c.oid
  LOOP
    IF path.depth=12 THEN RETURN result; END IF;
    IF path.root THEN CONTINUE; END IF;
    EXECUTE 'SELECT EXISTS(SELECT 1 FROM '||path.joins||' WHERE '||path.predicate||')'
      INTO found_dependency USING p_id,site_name;
    IF NOT found_dependency THEN CONTINUE; END IF;
    category := CASE
      WHEN path.relname LIKE '%sal%' AND path.relname NOT LIKE '%sopralluog%' THEN 'sal'
      WHEN path.relname LIKE '%accont%' THEN 'acconti'
      WHEN path.relname LIKE '%rettif%' THEN 'rettifiche'
      WHEN path.relname LIKE '%incass%' THEN 'incassi'
      WHEN path.relname LIKE '%fattur%' THEN 'fatture'
      WHEN path.relname LIKE '%pagament%' THEN 'pagamenti'
      WHEN path.relname LIKE '%economia%' THEN 'economia'
      WHEN path.relname LIKE '%variante%' OR path.relname LIKE '%varianti%' THEN 'varianti'
      WHEN path.relname LIKE '%preventiv%' THEN 'preventivi'
      WHEN path.relname LIKE '%rapportin%' THEN 'rapportini'
      WHEN path.relname LIKE '%timbratur%' OR path.relname LIKE '%presenz%' THEN 'presenze'
      WHEN path.relname LIKE '%material%' THEN 'materiali'
      WHEN path.relname LIKE '%attrezz%' OR path.relname LIKE '%attrezzi%' THEN 'attrezzature'
      WHEN path.relname LIKE '%foto%' THEN 'foto'
      WHEN path.relname IN ('note_allegati','quaderno_copie_allegati','quaderno_allegati') THEN 'allegati_quaderno'
      WHEN path.relname LIKE '%quaderno%' OR path.relname='note_sopralluogo' THEN 'quaderno'
      WHEN path.relname='cantieri' THEN 'cantieri'
      ELSE 'altri_collegamenti' END;
    IF NOT category=ANY(categories) THEN categories := array_append(categories,category); END IF;
  END LOOP;
  -- Riferimento JSON dimostrato dal reader legacy, fuori dal grafo delle FK.
  IF to_regclass('public.agenda_attivita') IS NULL THEN RETURN result; END IF;
  IF EXISTS (SELECT 1 FROM public.agenda_attivita a
    WHERE a.collegamento @> jsonb_build_object('tipo',p_entita,'id',p_id)) THEN
    categories := array_append(categories,'agenda');
  END IF;
  RETURN result || jsonb_build_object('stato',CASE WHEN cardinality(categories)=0 THEN 'eliminabile' ELSE 'bloccato' END,
    'verifica_completa',true,'categorie',to_jsonb(categories),
    'azione_consigliata',CASE WHEN cardinality(categories)=0 THEN 'conferma_eliminazione'
      WHEN p_entita='cantiere' THEN 'segna_concluso' ELSE 'nessuna' END);
EXCEPTION WHEN query_canceled THEN
  RETURN result;
WHEN OTHERS THEN
  -- Errori e SQL grezzo non escono dal server. Non si restituiscono categorie
  -- parziali: nessuna copertura incompleta puo diventare eliminabile.
  RETURN result;
END $function$
;
ALTER FUNCTION artecna_guardie.preflight_dipendenze(text,text) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_rapportini.prenota_allegato_core(p_sessione text, p_rapportino_id uuid, p_cantiere_id uuid, p_data date, p_chiave_client_allegato uuid, p_sha256 text, p_mime_type text, p_byte_size bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_accesso boolean; v_stato text; v_rapportino record;
  v_hash bytea; v_path text; v_ext text; v_count bigint;
  a artecna_rapportini.allegati%ROWTYPE;
  v_esito text := 'successo';
  v_upload_necessario boolean;
BEGIN
  IF session_user<>'artecna_rapportini_backend' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Backend obbligatorio'; END IF;
  IF p_rapportino_id IS NULL OR p_cantiere_id IS NULL OR p_data IS NULL
    OR NOT pg_catalog.isfinite(p_data) OR p_chiave_client_allegato IS NULL
    OR p_sha256 IS NULL OR p_sha256 !~ '^[0-9a-f]{64}$'
    OR p_mime_type IS NULL OR p_mime_type NOT IN ('image/jpeg','image/png','image/webp')
    OR p_byte_size IS NULL OR p_byte_size NOT BETWEEN 1 AND 4000000 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Richiesta allegato non valida';
  END IF;
  PERFORM 1 FROM public.cantieri WHERE id=p_cantiere_id
    AND lavori_conclusi IS DISTINCT FROM true FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non consentito';
  END IF;
  -- Lock per Rapportino: serializza identità e quota, anche per chiavi diverse.
  -- Nessun UPDATE testata/revisione. Nessun advisory lock globale.
  SELECT cantiere_id,data,versione_prestazioni INTO v_rapportino
    FROM public.rapportini WHERE id=p_rapportino_id FOR UPDATE;
  IF NOT FOUND OR v_rapportino.cantiere_id IS DISTINCT FROM p_cantiere_id
    OR v_rapportino.data IS DISTINCT FROM p_data THEN
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Contesto Rapportino incoerente';
  END IF;
  IF v_rapportino.versione_prestazioni IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Versione Rapportino non supportata';
  END IF;
  v_hash:=pg_catalog.decode(p_sha256,'hex');
  v_ext:=CASE p_mime_type WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/png' THEN 'png' ELSE 'webp' END;
  v_path:='rapportini/'||p_cantiere_id::text||'/'||p_rapportino_id::text||'/'||p_chiave_client_allegato::text||'.'||v_ext;
  SELECT * INTO a FROM artecna_rapportini.allegati
    WHERE rapportino_id=p_rapportino_id AND chiave_client_allegato=p_chiave_client_allegato FOR UPDATE;
  IF FOUND THEN
    IF a.rapportino_id IS DISTINCT FROM p_rapportino_id OR a.cantiere_id IS DISTINCT FROM p_cantiere_id
      OR a.chiave_client_allegato IS DISTINCT FROM p_chiave_client_allegato OR a.sha256 IS DISTINCT FROM v_hash
      OR a.mime_type IS DISTINCT FROM p_mime_type OR a.byte_size IS DISTINCT FROM p_byte_size
      OR a.bucket IS DISTINCT FROM 'rapportini-v1' OR a.file_path IS DISTINCT FROM v_path THEN
      RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Identità allegato in conflitto';
    END IF;
    -- Integrità storica: nessuna riparazione implicita, neppure della lease.
    IF (a.lease_id IS NULL) <> (a.lease_until IS NULL) THEN
      RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
    END IF;
    IF a.stato='cancellato' THEN
      IF a.removed_at IS NULL OR a.lease_id IS NOT NULL OR a.lease_until IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
      END IF;
      RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Allegato non riutilizzabile';
    ELSIF a.stato='cancellazione_pending' THEN
      IF a.removed_at IS NULL THEN
        RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
      END IF;
      RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Allegato non riutilizzabile';
    ELSIF a.stato='finalizzato' THEN
      IF a.finalized_at IS NULL OR a.removed_at IS NOT NULL OR a.foto_cantiere_id IS NULL
        OR a.lease_id IS NOT NULL OR a.lease_until IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
      END IF;
      v_esito:='successo';
      v_upload_necessario:=false;
    ELSIF a.stato='scaduto' THEN
      IF a.finalized_at IS NOT NULL OR a.removed_at IS NOT NULL OR a.foto_cantiere_id IS NOT NULL
        OR a.lease_id IS NOT NULL OR a.lease_until IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
      END IF;
      v_esito:='scaduto_persistito_con_conflitto';
      v_upload_necessario:=false;
    ELSIF a.stato='prenotato' THEN
      IF a.finalized_at IS NOT NULL OR a.removed_at IS NOT NULL OR a.foto_cantiere_id IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
      END IF;
      IF a.expires_at<=v_now THEN
        UPDATE artecna_rapportini.allegati SET stato='scaduto',lease_id=NULL,lease_until=NULL
          WHERE id=a.id RETURNING * INTO a;
        -- Esito normale: permette il COMMIT. Il futuro Node lo tradurrà in 409.
        v_esito:='scaduto_persistito_con_conflitto';
        v_upload_necessario:=false;
      ELSIF a.lease_until>v_now THEN
        RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Operazione allegato in corso';
      ELSE
        UPDATE artecna_rapportini.allegati SET lease_id=pg_catalog.gen_random_uuid(),lease_until=v_now+interval '2 minutes'
          WHERE id=a.id RETURNING * INTO a;
        v_upload_necessario:=true;
      END IF;
    ELSE
      RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
    END IF;
  ELSE
    -- Contano prenotazioni temporalmente valide, finalizzati e cancellazioni pendenti.
    SELECT count(*) INTO v_count FROM artecna_rapportini.allegati WHERE rapportino_id=p_rapportino_id
      AND (stato IN ('finalizzato','cancellazione_pending') OR (stato='prenotato' AND expires_at>v_now));
    IF v_count>=20 THEN
      RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Limite allegati raggiunto';
    END IF;
    INSERT INTO artecna_rapportini.allegati(rapportino_id,cantiere_id,chiave_client_allegato,
      sha256,bucket,file_path,mime_type,byte_size,stato,expires_at,lease_id,lease_until)
    VALUES(p_rapportino_id,p_cantiere_id,p_chiave_client_allegato,v_hash,'rapportini-v1',v_path,
      p_mime_type,p_byte_size,'prenotato',v_now+interval '24 hours',pg_catalog.gen_random_uuid(),v_now+interval '2 minutes')
      RETURNING * INTO a;
    v_upload_necessario:=true;
  END IF;
  -- Contratto INTERNO backend: mai inoltrare bucket/path/lease al browser.
  RETURN pg_catalog.jsonb_build_object('versione_contratto',1,'esito',v_esito,
    'allegato_id',a.id,'stato',a.stato,'upload_necessario',v_upload_necessario,
    'bucket',a.bucket,'file_path',a.file_path,'mime_type',a.mime_type,'byte_size',a.byte_size,
    'lease_id',a.lease_id,'lease_until',a.lease_until,'expires_at',a.expires_at);
END;
$function$
;
ALTER FUNCTION artecna_rapportini.prenota_allegato_core(text,uuid,uuid,date,uuid,text,text,bigint) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_rapportini.finalizza_allegato_core(p_sessione text, p_allegato_id uuid, p_lease_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_accesso boolean; v_stato text; target record; r record; v_nome text;
  a artecna_rapportini.allegati%ROWTYPE; f public.foto_cantiere%ROWTYPE;
  v_foto uuid; v_esito text := 'successo';
BEGIN
  IF session_user<>'artecna_rapportini_backend' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Backend obbligatorio'; END IF;
  IF p_allegato_id IS NULL OR p_lease_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Richiesta allegato non valida';
  END IF;
  -- Prima lettura solo per localizzare il contesto, nessuna decisione sullo stato.
  SELECT rapportino_id,cantiere_id INTO target FROM artecna_rapportini.allegati WHERE id=p_allegato_id;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Contesto allegato incoerente'; END IF;
  SELECT nome INTO v_nome FROM public.cantieri WHERE id=target.cantiere_id
    AND lavori_conclusi IS DISTINCT FROM true FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cantiere non consentito'; END IF;
  -- Ordine globale RPC allegati: Rapportino -> Allegato -> foto_cantiere.
  SELECT id,cantiere_id,data,versione_prestazioni INTO r FROM public.rapportini WHERE id=target.rapportino_id FOR UPDATE;
  IF NOT FOUND OR r.cantiere_id IS DISTINCT FROM target.cantiere_id OR r.data IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Contesto allegato incoerente';
  END IF;
  IF r.versione_prestazioni IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Versione Rapportino non supportata';
  END IF;
  SELECT * INTO a FROM artecna_rapportini.allegati WHERE id=p_allegato_id FOR UPDATE;
  IF NOT FOUND OR a.rapportino_id IS DISTINCT FROM r.id OR a.cantiere_id IS DISTINCT FROM r.cantiere_id THEN
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Contesto allegato incoerente';
  END IF;
  IF (a.lease_id IS NULL) <> (a.lease_until IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
  END IF;
  IF a.stato='prenotato' THEN
    IF a.finalized_at IS NOT NULL OR a.removed_at IS NOT NULL OR a.foto_cantiere_id IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
    END IF;
    IF a.expires_at<=v_now THEN
      UPDATE artecna_rapportini.allegati SET stato='scaduto',lease_id=NULL,lease_until=NULL
        WHERE id=a.id RETURNING * INTO a;
      v_esito:='scaduto_persistito_con_conflitto';
    ELSE
      IF a.lease_id IS DISTINCT FROM p_lease_id OR a.lease_until IS NULL OR a.lease_until<=v_now THEN
        RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Tentativo allegato non valido';
      END IF;
      v_foto:=artecna_rapportini.crea_proiezione_foto_v1(a.id,p_lease_id);
      UPDATE artecna_rapportini.allegati SET stato='finalizzato',foto_cantiere_id=v_foto,finalized_at=v_now,
        lease_id=NULL,lease_until=NULL WHERE id=a.id RETURNING * INTO a;
    END IF;
  ELSIF a.stato='finalizzato' THEN
    IF a.finalized_at IS NULL OR a.removed_at IS NOT NULL OR a.foto_cantiere_id IS NULL
      OR a.lease_id IS NOT NULL OR a.lease_until IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
    END IF;
    -- Solo verifica: mai ricreare o riparare una proiezione mancante/incoerente.
    SELECT * INTO f FROM public.foto_cantiere WHERE id=a.foto_cantiere_id FOR SHARE;
    IF NOT FOUND OR f.allegato_v1_id IS DISTINCT FROM a.id OR f.cantiere_id IS DISTINCT FROM r.cantiere_id OR f.rapportino_id IS DISTINCT FROM r.id::text
      OR f.cantiere IS DISTINCT FROM v_nome OR f.categoria IS DISTINCT FROM 'rapportino'
      OR f.data_foto::text IS DISTINCT FROM r.data::text OR f.nota IS DISTINCT FROM ''
      OR f.file_url IS NOT NULL OR f.file_path IS NOT NULL OR f.immagine_base64 IS DISTINCT FROM ''
      OR f.thumbnail_url IS NOT NULL OR f.storage_provider IS DISTINCT FROM 'cloud'
      OR f.sync_status IS DISTINCT FROM 'not_required' THEN
      RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Proiezione allegato non valida';
    END IF;
  ELSIF a.stato='scaduto' THEN
    IF a.finalized_at IS NOT NULL OR a.removed_at IS NOT NULL OR a.foto_cantiere_id IS NOT NULL
      OR a.lease_id IS NOT NULL OR a.lease_until IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
    END IF;
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Allegato non riutilizzabile';
  ELSIF a.stato='cancellazione_pending' THEN
    IF a.removed_at IS NULL THEN RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido'; END IF;
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Allegato non riutilizzabile';
  ELSIF a.stato='cancellato' THEN
    IF a.removed_at IS NULL OR a.lease_id IS NOT NULL OR a.lease_until IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
    END IF;
    RAISE EXCEPTION USING ERRCODE='PR409',MESSAGE='Allegato non riutilizzabile';
  ELSE
    RAISE EXCEPTION USING ERRCODE='XX001',MESSAGE='Stato allegato non valido';
  END IF;
  RETURN pg_catalog.jsonb_build_object('versione_contratto',1,'esito',v_esito,'allegato_id',a.id,
    'stato',a.stato,'foto_cantiere_id',a.foto_cantiere_id,'finalized_at',a.finalized_at);
END;
$function$
;
ALTER FUNCTION artecna_rapportini.finalizza_allegato_core(text,uuid,uuid) OWNER TO "postgres";
CREATE OR REPLACE FUNCTION artecna_rapportini.arricchisci_lettura_rapportino_v2(p_lettura_v1 jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'pg_temp'
AS $function$
DECLARE base jsonb:=p_lettura_v1; dettaglio jsonb; materiali jsonb; riepilogo jsonb; rid uuid; vm smallint;
BEGIN
 IF base->'versione_prestazioni' IS DISTINCT FROM '1'::jsonb THEN RETURN base||jsonb_build_object('versione_lettura',2); END IF;
 rid:=(base->>'rapportino_id')::uuid;
 SELECT versione_materiali INTO vm FROM public.rapportini WHERE id=rid;
 IF vm IS NULL OR vm NOT IN(0,1) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Versione materiali non supportata'; END IF;
 IF vm=0 AND EXISTS(SELECT 1 FROM public.rapportino_materiali WHERE rapportino_id=rid) THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='Contesto materiali incoerente'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('materiale_id',m.id,'chiave_client',m.chiave_client,'descrizione',m.descrizione,'unita_misura',m.unita_misura,
 'quantita',m.quantita::text,'costo_unitario',m.costo_unitario::text,'costo_totale',m.costo_totale::text,'note',m.note,'revisione',m.revisione,'rimossa_at',m.rimossa_at)
 ORDER BY m.created_at,m.id),'[]'::jsonb) INTO materiali FROM public.rapportino_materiali m WHERE m.rapportino_id=rid;
 SELECT jsonb_build_object('totale_materiali_valorizzati',coalesce(sum(m.costo_totale),0.00)::text,
 'numero_materiali_da_valorizzare',count(*) FILTER(WHERE m.costo_unitario IS NULL),'valorizzazione_completa',count(*) FILTER(WHERE m.costo_unitario IS NULL)=0)
 INTO riepilogo FROM public.rapportino_materiali m WHERE m.rapportino_id=rid AND m.rimossa_at IS NULL;
 dettaglio:=((base->'dettaglio')-'documento')||jsonb_build_object('versione_contratto',2,
 'documento',jsonb_build_object('note',base#>>'{dettaglio,documento,note}'),
 'documento_legacy_materiali',jsonb_build_object('materiali',base#>>'{dettaglio,documento,materiali}','quantita_materiali',base#>>'{dettaglio,documento,quantita_materiali}'),
 'versione_materiali',vm,'materiali',materiali,'riepilogo_materiali',riepilogo);
 RETURN base||jsonb_build_object('versione_lettura',2,'dettaglio',dettaglio);
END;
$function$
;
ALTER FUNCTION artecna_rapportini.arricchisci_lettura_rapportino_v2(jsonb) OWNER TO "postgres";
ALTER TABLE public.varianti_cantiere ADD CONSTRAINT "varianti_cantiere_pkey" PRIMARY KEY (id);
ALTER TABLE public.variante_lavorazioni ADD CONSTRAINT "variante_lavorazioni_pkey" PRIMARY KEY (id);
ALTER TABLE public.variante_documenti ADD CONSTRAINT "variante_documenti_pkey" PRIMARY KEY (id);
ALTER TABLE public.utenti_cantiere ADD CONSTRAINT "utenti_cantiere_pkey" PRIMARY KEY (cantiere_id, user_id);
ALTER TABLE public.variante_sorgenti ADD CONSTRAINT "variante_sorgenti_pkey" PRIMARY KEY (id);
ALTER TABLE artecna_distruzione.contesto ADD CONSTRAINT "contesto_pkey" PRIMARY KEY (transazione, backend);
ALTER TABLE artecna_distruzione.cleanup_storage ADD CONSTRAINT "cleanup_storage_pkey" PRIMARY KEY (id);
ALTER TABLE public.economia_raccolte ADD CONSTRAINT "economia_raccolte_pkey" PRIMARY KEY (id);
ALTER TABLE public.economia_sorgenti ADD CONSTRAINT "economia_sorgenti_pkey" PRIMARY KEY (id);
ALTER TABLE public.economia_righe ADD CONSTRAINT "economia_righe_pkey" PRIMARY KEY (id);
ALTER TABLE public.rapportino_prestazioni ADD CONSTRAINT "rapportino_prestazioni_pkey" PRIMARY KEY (id);
ALTER TABLE artecna_rapportini.sessioni_portale ADD CONSTRAINT "sessioni_portale_pkey" PRIMARY KEY (token_sha256);
ALTER TABLE artecna_rapportini.richieste ADD CONSTRAINT "richieste_pkey" PRIMARY KEY (canale, utente_id, richiesta_id);
ALTER TABLE artecna_rapportini.allegati ADD CONSTRAINT "allegati_pkey" PRIMARY KEY (id);
ALTER TABLE public.rapportino_materiali ADD CONSTRAINT "rapportino_materiali_pkey" PRIMARY KEY (id);
ALTER TABLE artecna_rapportini.f3c3_capability ADD CONSTRAINT "f3c3_capability_pkey" PRIMARY KEY (foto_id);
ALTER TABLE public.utenti_impresa ADD CONSTRAINT "utenti_impresa_pkey" PRIMARY KEY (user_id);
ALTER TABLE public.materiali_impresa ADD CONSTRAINT "materiali_impresa_pkey" PRIMARY KEY (id);
ALTER TABLE artecna_guardie.fatture_classificazione_richieste ADD CONSTRAINT "fatture_classificazione_richieste_pkey" PRIMARY KEY (user_id, richiesta_id);
ALTER TABLE public.quaderno_progetti ADD CONSTRAINT "quaderno_progetti_pkey" PRIMARY KEY (id);
ALTER TABLE public.quaderno_allegati ADD CONSTRAINT "quaderno_allegati_pkey" PRIMARY KEY (id);
ALTER TABLE public.quaderno_richiami_sopralluogo ADD CONSTRAINT "quaderno_richiami_sopralluogo_pkey" PRIMARY KEY (id);
ALTER TABLE public.quaderno_copie_allegati ADD CONSTRAINT "quaderno_copie_allegati_pkey" PRIMARY KEY (id);
ALTER TABLE public.quaderno_gestioni ADD CONSTRAINT "quaderno_gestioni_pkey" PRIMARY KEY (id);
ALTER TABLE public.variante_fonti_memory ADD CONSTRAINT "variante_fonti_memory_pkey" PRIMARY KEY (variante_id, source_type, source_id);
ALTER TABLE public.variante_fonti_visive ADD CONSTRAINT "variante_fonti_visive_pkey" PRIMARY KEY (variante_id, source_type, source_id);
ALTER TABLE public.variante_osservatore_analisi ADD CONSTRAINT "variante_osservatore_analisi_pkey" PRIMARY KEY (id);
ALTER TABLE artecna_contabilita.attribuzioni_clienti ADD CONSTRAINT "attribuzioni_clienti_pkey" PRIMARY KEY (id);
ALTER TABLE public.fornitori_rettifiche ADD CONSTRAINT "fornitori_rettifiche_pkey" PRIMARY KEY (id);
ALTER TABLE public.cantieri ADD CONSTRAINT "cantieri_pkey" PRIMARY KEY (id);
ALTER TABLE public.rapportini ADD CONSTRAINT "rapportini_pkey" PRIMARY KEY (id);
ALTER TABLE public.foto_cantiere ADD CONSTRAINT "foto_cantiere_pkey" PRIMARY KEY (id);
ALTER TABLE public.operai ADD CONSTRAINT "operai_pkey" PRIMARY KEY (id);
ALTER TABLE public.timbrature ADD CONSTRAINT "timbrature_pkey" PRIMARY KEY (id);
ALTER TABLE public.preventivi_cantiere ADD CONSTRAINT "preventivi_cantiere_pkey" PRIMARY KEY (id);
ALTER TABLE public.materiali_cantiere ADD CONSTRAINT "materiali_cantiere_pkey" PRIMARY KEY (id);
ALTER TABLE public.attrezzi_cantiere ADD CONSTRAINT "attrezzi_cantiere_pkey" PRIMARY KEY (id);
ALTER TABLE public.pagamenti_operai ADD CONSTRAINT "pagamenti_operai_pkey" PRIMARY KEY (id);
ALTER TABLE public.pagamenti_fornitori ADD CONSTRAINT "pagamenti_fornitori_pkey" PRIMARY KEY (id);
ALTER TABLE public.impostazioni_app ADD CONSTRAINT "impostazioni_app_pkey" PRIMARY KEY (id);
ALTER TABLE public.acconti_cantiere ADD CONSTRAINT "acconti_cantiere_pkey" PRIMARY KEY (id);
ALTER TABLE public.sal_lavorazioni ADD CONSTRAINT "sal_lavorazioni_pkey" PRIMARY KEY (id);
ALTER TABLE public.preventivo_lavorazioni ADD CONSTRAINT "preventivo_lavorazioni_pkey" PRIMARY KEY (id);
ALTER TABLE public.fatture_fornitori ADD CONSTRAINT "fatture_fornitori_pkey" PRIMARY KEY (id);
ALTER TABLE public.fatture_fornitori_righe ADD CONSTRAINT "fatture_fornitori_righe_pkey" PRIMARY KEY (id);
ALTER TABLE public.fatture_emesse ADD CONSTRAINT "fatture_emesse_pkey" PRIMARY KEY (id);
ALTER TABLE public.incassi_non_fatturati ADD CONSTRAINT "incassi_non_fatturati_pkey" PRIMARY KEY (id);
ALTER TABLE public.spese_impresa ADD CONSTRAINT "spese_impresa_pkey" PRIMARY KEY (id);
ALTER TABLE public.sopralluoghi ADD CONSTRAINT "sopralluoghi_pkey" PRIMARY KEY (id);
ALTER TABLE public.foto_sopralluogo ADD CONSTRAINT "foto_sopralluogo_pkey" PRIMARY KEY (id);
ALTER TABLE public.prezzi_lavorazioni ADD CONSTRAINT "prezzi_lavorazioni_pkey" PRIMARY KEY (id);
ALTER TABLE public.memoria_prezzi ADD CONSTRAINT "memoria_prezzi_pkey" PRIMARY KEY (id);
ALTER TABLE public.prezziario_sicilia ADD CONSTRAINT "prezziario_sicilia_pkey" PRIMARY KEY (id);
ALTER TABLE public.utilizzo_ai ADD CONSTRAINT "utilizzo_ai_pkey" PRIMARY KEY (id);
ALTER TABLE public.note_sopralluogo ADD CONSTRAINT "note_sopralluogo_pkey" PRIMARY KEY (id);
ALTER TABLE public.note_allegati ADD CONSTRAINT "note_allegati_pkey" PRIMARY KEY (id);
ALTER TABLE public.agenda_attivita ADD CONSTRAINT "agenda_attivita_pkey" PRIMARY KEY (id);
ALTER TABLE public.varianti_cantiere ADD CONSTRAINT "varianti_cantiere_numero_uq" UNIQUE (cantiere_id, numero);
ALTER TABLE public.variante_lavorazioni ADD CONSTRAINT "variante_lavorazioni_numero_uq" UNIQUE (variante_id, numero_riga);
ALTER TABLE public.variante_documenti ADD CONSTRAINT "variante_documenti_path_uq" UNIQUE (variante_id, storage_path);
ALTER TABLE artecna_distruzione.cleanup_storage ADD CONSTRAINT "cleanup_storage_identita" UNIQUE (cantiere_id, bucket, path);
ALTER TABLE public.economia_raccolte ADD CONSTRAINT "economia_raccolte_numero_unique" UNIQUE (cantiere_id, numero);
ALTER TABLE public.economia_sorgenti ADD CONSTRAINT "economia_sorgenti_file_unique" UNIQUE (raccolta_id, file_sha256);
ALTER TABLE public.economia_sorgenti ADD CONSTRAINT "economia_sorgenti_identita_raccolta_unique" UNIQUE (id, raccolta_id);
ALTER TABLE public.economia_righe ADD CONSTRAINT "economia_righe_ordine_unique" UNIQUE (raccolta_id, ordine) DEFERRABLE;
ALTER TABLE public.economia_righe ADD CONSTRAINT "economia_righe_voce_sorgente_unique" UNIQUE (sorgente_id, indice_voce_sorgente);
ALTER TABLE public.rapportino_prestazioni ADD CONSTRAINT "rapportino_prestazioni_chiave" UNIQUE (rapportino_id, chiave_client);
ALTER TABLE artecna_rapportini.allegati ADD CONSTRAINT "allegati_identita" UNIQUE (rapportino_id, chiave_client_allegato);
ALTER TABLE artecna_rapportini.allegati ADD CONSTRAINT "allegati_oggetto" UNIQUE (bucket, file_path);
ALTER TABLE artecna_rapportini.allegati ADD CONSTRAINT "allegati_foto" UNIQUE (foto_cantiere_id);
ALTER TABLE public.rapportino_materiali ADD CONSTRAINT "rapportino_materiali_identita" UNIQUE (rapportino_id, chiave_client);
ALTER TABLE public.foto_cantiere ADD CONSTRAINT "foto_cantiere_allegato_v1_key" UNIQUE (allegato_v1_id);
ALTER TABLE public.economia_righe ADD CONSTRAINT "economia_righe_prestazione_unique" UNIQUE (rapportino_prestazione_id);
ALTER TABLE public.materiali_impresa ADD CONSTRAINT "materiali_impresa_richiesta_id_key" UNIQUE (richiesta_id);
ALTER TABLE public.quaderno_progetti ADD CONSTRAINT "quaderno_progetti_id_user_id_key" UNIQUE (id, user_id);
ALTER TABLE public.quaderno_copie_allegati ADD CONSTRAINT "quaderno_copie_allegati_storage_path_key" UNIQUE (storage_path);
ALTER TABLE artecna_contabilita.attribuzioni_clienti ADD CONSTRAINT "attribuzioni_clienti_richiesta_scollega_key" UNIQUE (richiesta_scollega);
ALTER TABLE public.impostazioni_app ADD CONSTRAINT "impostazioni_app_chiave_key" UNIQUE (chiave);
ALTER TABLE public.note_sopralluogo ADD CONSTRAINT "note_sopralluogo_user_id_sopralluogo_id_key" UNIQUE (user_id, sopralluogo_id);
ALTER TABLE public.varianti_cantiere ADD CONSTRAINT "varianti_cantiere_titolo_ck" CHECK (btrim(titolo) <> ''::text);
ALTER TABLE public.varianti_cantiere ADD CONSTRAINT "varianti_cantiere_stato_ck" CHECK (stato = ANY (ARRAY['bozza'::text, 'proposta'::text, 'approvata'::text, 'rifiutata'::text, 'annullata'::text]));
ALTER TABLE public.varianti_cantiere ADD CONSTRAINT "varianti_cantiere_numero_ck" CHECK ((numero IS NULL OR numero > 0) AND (stato <> 'bozza'::text OR numero IS NULL) AND ((stato <> ALL (ARRAY['proposta'::text, 'approvata'::text, 'rifiutata'::text])) OR numero IS NOT NULL));
ALTER TABLE public.varianti_cantiere ADD CONSTRAINT "varianti_cantiere_approvazione_ck" CHECK (stato = 'approvata'::text AND importo_delta_approvato IS NOT NULL AND importo_delta_approvato <> 'NaN'::numeric AND approvata_at IS NOT NULL AND riferimento_approvazione IS NOT NULL AND btrim(riferimento_approvazione) <> ''::text OR stato <> 'approvata'::text AND importo_delta_approvato IS NULL AND approvata_at IS NULL AND riferimento_approvazione IS NULL);
ALTER TABLE public.variante_lavorazioni ADD CONSTRAINT "variante_lavorazioni_numero_ck" CHECK (numero_riga > 0);
ALTER TABLE public.variante_lavorazioni ADD CONSTRAINT "variante_lavorazioni_descrizione_ck" CHECK (btrim(descrizione) <> ''::text);
ALTER TABLE public.variante_lavorazioni ADD CONSTRAINT "variante_lavorazioni_operazione_ck" CHECK (operazione = ANY (ARRAY['nuova'::text, 'aumento'::text, 'riduzione_residua'::text, 'eliminazione_residua'::text]));
ALTER TABLE public.variante_lavorazioni ADD CONSTRAINT "variante_lavorazioni_valori_ck" CHECK (quantita_delta <> 'NaN'::numeric AND prezzo_unitario <> 'NaN'::numeric AND delta_contratto <> 'NaN'::numeric AND prezzo_unitario >= 0::numeric);
ALTER TABLE public.variante_lavorazioni ADD CONSTRAINT "variante_lavorazioni_segni_ck" CHECK ((operazione = ANY (ARRAY['nuova'::text, 'aumento'::text])) AND delta_contratto > 0::numeric AND quantita_delta > 0::numeric OR (operazione = ANY (ARRAY['riduzione_residua'::text, 'eliminazione_residua'::text])) AND delta_contratto < 0::numeric AND quantita_delta < 0::numeric);
ALTER TABLE public.variante_lavorazioni ADD CONSTRAINT "variante_lavorazioni_riferimenti_ck" CHECK (operazione = 'nuova'::text AND riferimento_preventivo_lavorazione_id IS NULL AND riferimento_variante_lavorazione_id IS NULL OR operazione <> 'nuova'::text AND (riferimento_preventivo_lavorazione_id IS NOT NULL) <> (riferimento_variante_lavorazione_id IS NOT NULL));
ALTER TABLE public.variante_lavorazioni ADD CONSTRAINT "variante_lavorazioni_no_self_ck" CHECK (riferimento_variante_lavorazione_id IS NULL OR riferimento_variante_lavorazione_id <> id);
ALTER TABLE public.variante_lavorazioni ADD CONSTRAINT "variante_lavorazioni_motivo_ck" CHECK ((operazione <> ALL (ARRAY['riduzione_residua'::text, 'eliminazione_residua'::text])) OR btrim(note) <> ''::text);
ALTER TABLE public.variante_documenti ADD CONSTRAINT "variante_documenti_nome_ck" CHECK (btrim(nome_file) <> ''::text);
ALTER TABLE public.variante_documenti ADD CONSTRAINT "variante_documenti_path_ck" CHECK (btrim(storage_path) <> ''::text);
ALTER TABLE public.variante_documenti ADD CONSTRAINT "variante_documenti_tipo_ck" CHECK (tipo = ANY (ARRAY['documento'::text, 'allegato'::text, 'approvazione'::text]));
ALTER TABLE public.sal_lavorazioni ADD CONSTRAINT "sal_lavorazioni_sorgenti_alternative_ck" CHECK (source_lavorazione_id IS NULL OR source_variante_lavorazione_id IS NULL);
ALTER TABLE public.utenti_cantiere ADD CONSTRAINT "utenti_cantiere_ruolo_check" CHECK (ruolo = 'owner'::text);
ALTER TABLE public.preventivi_cantiere ADD CONSTRAINT "preventivi_cantiere_archiviazione_pair_ck" CHECK (archiviazione_key IS NULL AND archiviazione_payload_hash IS NULL OR archiviazione_key IS NOT NULL AND archiviazione_payload_hash IS NOT NULL);
ALTER TABLE public.preventivi_cantiere ADD CONSTRAINT "preventivi_cantiere_archiviazione_hash_ck" CHECK (archiviazione_payload_hash IS NULL OR length(archiviazione_payload_hash) = 64 AND archiviazione_payload_hash ~ '^[0-9a-f]{64}$'::text);
ALTER TABLE public.variante_sorgenti ADD CONSTRAINT "variante_sorgenti_titolo_check" CHECK (btrim(titolo) <> ''::text);
ALTER TABLE public.variante_sorgenti ADD CONSTRAINT "variante_sorgenti_snapshot_version_check" CHECK (snapshot_version > 0);
ALTER TABLE public.variante_sorgenti ADD CONSTRAINT "variante_sorgenti_snapshot_check" CHECK (jsonb_typeof(snapshot) = 'object'::text);
ALTER TABLE public.variante_lavorazioni ADD CONSTRAINT "variante_lavorazioni_indice_voce_sorgente_check" CHECK (indice_voce_sorgente IS NULL OR indice_voce_sorgente >= 0);
ALTER TABLE public.variante_lavorazioni ADD CONSTRAINT "variante_lavorazioni_provenienza_coppia_check" CHECK (variante_sorgente_id IS NULL AND indice_voce_sorgente IS NULL OR variante_sorgente_id IS NOT NULL AND indice_voce_sorgente IS NOT NULL);
ALTER TABLE artecna_distruzione.cleanup_storage ADD CONSTRAINT "cleanup_storage_bucket_check" CHECK (btrim(bucket) <> ''::text);
ALTER TABLE artecna_distruzione.cleanup_storage ADD CONSTRAINT "cleanup_storage_path_check" CHECK (btrim(path) <> ''::text);
ALTER TABLE artecna_distruzione.cleanup_storage ADD CONSTRAINT "cleanup_storage_stato_check" CHECK (stato = ANY (ARRAY['pending'::text, 'failed'::text, 'completed'::text]));
ALTER TABLE artecna_distruzione.cleanup_storage ADD CONSTRAINT "cleanup_storage_tentativi_check" CHECK (tentativi >= 0);
ALTER TABLE artecna_distruzione.cleanup_storage ADD CONSTRAINT "cleanup_storage_completamento" CHECK ((stato = 'completed'::text) = (completed_at IS NOT NULL));
ALTER TABLE artecna_distruzione.contesto ADD CONSTRAINT "contesto_ruolo_check" CHECK (ruolo = 'artecna_cantieri_delete_rpc'::name);
ALTER TABLE public.economia_raccolte ADD CONSTRAINT "economia_raccolte_numero_check" CHECK (numero > 0);
ALTER TABLE public.economia_raccolte ADD CONSTRAINT "economia_raccolte_titolo_check" CHECK (btrim(titolo) <> ''::text);
ALTER TABLE public.economia_raccolte ADD CONSTRAINT "economia_raccolte_stato_check" CHECK (stato = ANY (ARRAY['bozza'::text, 'chiusa'::text]));
ALTER TABLE public.economia_raccolte ADD CONSTRAINT "economia_raccolte_revisione_check" CHECK (revisione >= 0);
ALTER TABLE public.economia_sorgenti ADD CONSTRAINT "economia_sorgenti_nome_file_check" CHECK (btrim(nome_file) <> ''::text);
ALTER TABLE public.economia_sorgenti ADD CONSTRAINT "economia_sorgenti_file_sha256_check" CHECK (length(file_sha256) = 64 AND file_sha256 ~ '^[0-9a-f]{64}$'::text);
ALTER TABLE public.economia_sorgenti ADD CONSTRAINT "economia_sorgenti_snapshot_version_check" CHECK (snapshot_version > 0);
ALTER TABLE public.economia_sorgenti ADD CONSTRAINT "economia_sorgenti_snapshot_check" CHECK (jsonb_typeof(snapshot) = 'object'::text);
ALTER TABLE public.economia_righe ADD CONSTRAINT "economia_righe_ordine_check" CHECK (ordine > 0);
ALTER TABLE public.economia_righe ADD CONSTRAINT "economia_righe_descrizione_check" CHECK (btrim(descrizione) <> ''::text);
ALTER TABLE public.economia_righe ADD CONSTRAINT "economia_righe_unita_misura_check" CHECK (btrim(unita_misura) <> ''::text);
ALTER TABLE public.economia_righe ADD CONSTRAINT "economia_righe_quantita_check" CHECK (quantita > 0::numeric AND quantita <> 'NaN'::numeric);
ALTER TABLE public.economia_righe ADD CONSTRAINT "economia_righe_prezzo_unitario_check" CHECK (prezzo_unitario IS NULL OR prezzo_unitario >= 0::numeric AND prezzo_unitario <> 'NaN'::numeric);
ALTER TABLE public.economia_righe ADD CONSTRAINT "economia_righe_tipo_riga_check" CHECK (tipo_riga = ANY (ARRAY['generica'::text, 'manodopera'::text, 'materiale'::text]));
ALTER TABLE public.economia_righe ADD CONSTRAINT "economia_righe_dettagli_analitici_check" CHECK (tipo_riga = 'generica'::text AND dettagli_analitici IS NULL OR (tipo_riga = ANY (ARRAY['manodopera'::text, 'materiale'::text])) AND dettagli_analitici IS NOT NULL AND jsonb_typeof(dettagli_analitici) = 'object'::text AND dettagli_analitici ? 'version'::text AND (dettagli_analitici -> 'version'::text) = '1'::jsonb);
ALTER TABLE public.rapportini ADD CONSTRAINT "rapportini_versione_prestazioni_check" CHECK (versione_prestazioni = ANY (ARRAY[0, 1]));
ALTER TABLE public.rapportini ADD CONSTRAINT "rapportini_revisione_prestazioni_check" CHECK (revisione_prestazioni >= 0);
ALTER TABLE public.rapportino_prestazioni ADD CONSTRAINT "rapportino_prestazioni_chiave_client_check" CHECK (length(btrim(chiave_client)) >= 1 AND length(btrim(chiave_client)) <= 200 AND chiave_client = btrim(chiave_client));
ALTER TABLE public.rapportino_prestazioni ADD CONSTRAINT "rapportino_prestazioni_pausa_minuti_check" CHECK (pausa_minuti >= 0);
ALTER TABLE public.rapportino_prestazioni ADD CONSTRAINT "rapportino_prestazioni_revisione_check" CHECK (revisione >= 0);
ALTER TABLE public.rapportino_prestazioni ADD CONSTRAINT "rapportino_prestazioni_minuti" CHECK (EXTRACT(second FROM ora_inizio) = 0::numeric AND EXTRACT(second FROM ora_fine) = 0::numeric AND ora_inizio < '24:00:00'::time without time zone AND ora_fine < '24:00:00'::time without time zone);
ALTER TABLE public.rapportino_prestazioni ADD CONSTRAINT "rapportino_prestazioni_intervallo" CHECK (ora_fine > ora_inizio AND (EXTRACT(epoch FROM ora_fine - ora_inizio) / 60::numeric) > pausa_minuti::numeric);
ALTER TABLE public.rapportino_prestazioni ADD CONSTRAINT "rapportino_prestazioni_destinazione" CHECK (lavoro_in_economia OR variante_id IS NULL);
ALTER TABLE artecna_rapportini.richieste ADD CONSTRAINT "richieste_payload_sha256_check" CHECK (octet_length(payload_sha256) = 32);
ALTER TABLE public.rapportino_prestazioni ADD CONSTRAINT "rapportino_prestazioni_costo_orario_interno_storico_check" CHECK (costo_orario_interno_storico >= 0::numeric AND (costo_orario_interno_storico::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text])));
ALTER TABLE artecna_rapportini.sessioni_portale ADD CONSTRAINT "sessioni_portale_token_sha256_check" CHECK (octet_length(token_sha256) = 32);
ALTER TABLE artecna_rapportini.sessioni_portale ADD CONSTRAINT "sessioni_portale_check" CHECK (scade_at > created_at);
ALTER TABLE public.timbrature ADD CONSTRAINT "timbrature_prestazione_stato" CHECK (prestazione_rapportino_id IS NULL OR NOT stato IS DISTINCT FROM 'da rapportino'::text);
ALTER TABLE artecna_rapportini.richieste ADD CONSTRAINT "richieste_canale_check" CHECK (canale = ANY (ARRAY['desktop'::text, 'portale'::text]));
ALTER TABLE artecna_rapportini.allegati ADD CONSTRAINT "allegati_sha" CHECK (octet_length(sha256) = 32);
ALTER TABLE artecna_rapportini.allegati ADD CONSTRAINT "allegati_bucket" CHECK (bucket = 'rapportini-v1'::text);
ALTER TABLE artecna_rapportini.allegati ADD CONSTRAINT "allegati_mime" CHECK (mime_type = ANY (ARRAY['image/jpeg'::text, 'image/png'::text, 'image/webp'::text]));
ALTER TABLE artecna_rapportini.allegati ADD CONSTRAINT "allegati_dimensione" CHECK (byte_size >= 1 AND byte_size <= 4000000);
ALTER TABLE artecna_rapportini.allegati ADD CONSTRAINT "allegati_stato" CHECK (stato = ANY (ARRAY['prenotato'::text, 'finalizzato'::text, 'cancellazione_pending'::text, 'cancellato'::text, 'scaduto'::text]));
ALTER TABLE artecna_rapportini.allegati ADD CONSTRAINT "allegati_path" CHECK (btrim(file_path) <> ''::text AND file_path !~~ '/%'::text AND strpos(file_path, '..'::text) = 0 AND file_path ~~ 'rapportini/%'::text AND length(file_path) > 11);
ALTER TABLE artecna_rapportini.allegati ADD CONSTRAINT "allegati_coerenza" CHECK (stato = 'prenotato'::text AND finalized_at IS NULL AND removed_at IS NULL AND foto_cantiere_id IS NULL OR stato = 'finalizzato'::text AND finalized_at IS NOT NULL AND removed_at IS NULL AND foto_cantiere_id IS NOT NULL OR stato = 'scaduto'::text AND finalized_at IS NULL AND removed_at IS NULL AND foto_cantiere_id IS NULL OR (stato = ANY (ARRAY['cancellazione_pending'::text, 'cancellato'::text])) AND removed_at IS NOT NULL);
ALTER TABLE artecna_rapportini.allegati ADD CONSTRAINT "allegati_lease" CHECK (lease_id IS NULL AND lease_until IS NULL OR lease_id IS NOT NULL AND lease_until IS NOT NULL AND (stato = ANY (ARRAY['prenotato'::text, 'cancellazione_pending'::text])));
ALTER TABLE artecna_rapportini.allegati ADD CONSTRAINT "allegati_cancellato_post_cleanup" CHECK (stato <> 'cancellato'::text OR removed_at IS NOT NULL AND foto_cantiere_id IS NULL AND lease_id IS NULL AND lease_until IS NULL);
ALTER TABLE public.variante_sorgenti ADD CONSTRAINT "variante_sorgenti_tipo_check" CHECK (tipo = ANY (ARRAY['preventivo_artecna'::text, 'file'::text, 'raccolta_economia'::text]));
ALTER TABLE public.variante_sorgenti ADD CONSTRAINT "variante_sorgenti_coerenza_tipo_check" CHECK (economia_raccolta_id IS NULL AND economia_revisione_sorgente IS NULL AND economia_revisione_congelata IS NULL AND (tipo = 'preventivo_artecna'::text AND preventivo_sorgente_id IS NOT NULL AND nome_file IS NULL AND formato IS NULL AND file_sha256 IS NULL OR tipo = 'file'::text AND preventivo_sorgente_id IS NULL AND nome_file IS NOT NULL AND btrim(nome_file) <> ''::text AND formato IS NOT NULL AND (formato = ANY (ARRAY['pdf'::text, 'excel'::text, 'immagine'::text]))) OR tipo = 'raccolta_economia'::text AND economia_raccolta_id IS NOT NULL AND economia_revisione_sorgente IS NOT NULL AND economia_revisione_sorgente >= 0 AND economia_revisione_congelata IS NOT NULL AND economia_revisione_congelata >= 0 AND (economia_revisione_congelata::numeric = economia_revisione_sorgente::numeric OR economia_revisione_congelata::numeric = (economia_revisione_sorgente::numeric + 1::numeric)) AND preventivo_sorgente_id IS NULL AND nome_file IS NULL AND formato IS NULL AND file_sha256 IS NULL);
ALTER TABLE public.rapportini ADD CONSTRAINT "rapportini_versione_materiali_ck" CHECK (versione_materiali = ANY (ARRAY[0, 1]));
ALTER TABLE public.rapportini ADD CONSTRAINT "rapportini_materiali_v1_ck" CHECK (versione_materiali = 0 OR versione_prestazioni = 1);
ALTER TABLE public.rapportino_materiali ADD CONSTRAINT "rapportino_materiali_chiave_ck" CHECK ((chiave_client COLLATE "C") = (chiave_client::uuid::text COLLATE "C"));
ALTER TABLE public.rapportino_materiali ADD CONSTRAINT "rapportino_materiali_descrizione_ck" CHECK (descrizione = btrim(descrizione) AND length(descrizione) >= 1 AND length(descrizione) <= 2000);
ALTER TABLE public.rapportino_materiali ADD CONSTRAINT "rapportino_materiali_um_ck" CHECK (unita_misura = btrim(unita_misura) AND length(unita_misura) >= 1 AND length(unita_misura) <= 50);
ALTER TABLE public.rapportino_materiali ADD CONSTRAINT "rapportino_materiali_quantita_ck" CHECK (quantita > 0::numeric AND quantita::text <> 'NaN'::text);
ALTER TABLE public.rapportino_materiali ADD CONSTRAINT "rapportino_materiali_costo_ck" CHECK (costo_unitario IS NULL OR costo_unitario >= 0::numeric AND costo_unitario::text <> 'NaN'::text);
ALTER TABLE public.rapportino_materiali ADD CONSTRAINT "rapportino_materiali_note_ck" CHECK (length(note) <= 20000);
ALTER TABLE public.rapportino_materiali ADD CONSTRAINT "rapportino_materiali_revisione_ck" CHECK (revisione >= 0);
ALTER TABLE public.prezzi_lavorazioni ADD CONSTRAINT "prezzi_lavorazioni_override_origine_check" CHECK (origine_prezzario_id IS NULL OR NOT tipo_prezzo IS DISTINCT FROM 'artecna'::text AND origine_prezzario_id <> id);
ALTER TABLE public.economia_sorgenti ADD CONSTRAINT "economia_sorgenti_tipo_check" CHECK (tipo = 'file'::text OR tipo = 'fattura_fornitore'::text);
ALTER TABLE public.economia_righe ADD CONSTRAINT "economia_righe_origine_valore_check" CHECK ((origine = ANY (ARRAY['manuale'::text, 'file'::text, 'rapportino'::text])) OR origine = 'fattura_fornitore'::text);
ALTER TABLE public.economia_righe ADD CONSTRAINT "economia_righe_origine_coerenza_check" CHECK (origine = 'manuale'::text AND sorgente_id IS NULL AND indice_voce_sorgente IS NULL OR origine = 'file'::text AND sorgente_id IS NOT NULL AND indice_voce_sorgente IS NOT NULL AND indice_voce_sorgente >= 0 OR origine = 'rapportino'::text AND sorgente_id IS NULL AND indice_voce_sorgente IS NULL OR origine = 'fattura_fornitore'::text AND sorgente_id IS NOT NULL AND indice_voce_sorgente IS NULL);
ALTER TABLE public.economia_righe ADD CONSTRAINT "economia_righe_prestazione_provenienza_check" CHECK ((origine = 'rapportino'::text AND tipo_riga = 'manodopera'::text AND rapportino_prestazione_id IS NOT NULL AND prestazione_revisione_acquisita IS NOT NULL AND prestazione_revisione_acquisita >= 0 AND prestazione_snapshot IS NOT NULL AND jsonb_typeof(prestazione_snapshot) = 'object'::text AND prestazione_snapshot ? 'version'::text AND (prestazione_snapshot -> 'version'::text) = '1'::jsonb OR (origine = ANY (ARRAY['manuale'::text, 'file'::text])) AND rapportino_prestazione_id IS NULL AND prestazione_revisione_acquisita IS NULL AND prestazione_snapshot IS NULL) IS TRUE OR origine = 'fattura_fornitore'::text AND rapportino_prestazione_id IS NULL AND prestazione_revisione_acquisita IS NULL AND prestazione_snapshot IS NULL);
ALTER TABLE public.economia_righe ADD CONSTRAINT "economia_righe_analitiche_origine_check" CHECK (tipo_riga = 'generica'::text OR origine = 'file'::text OR origine = 'rapportino'::text AND tipo_riga = 'manodopera'::text OR origine = 'fattura_fornitore'::text AND tipo_riga = 'materiale'::text);
ALTER TABLE public.economia_righe ADD CONSTRAINT "economia_righe_fattura_provenienza_check" CHECK ((origine = 'fattura_fornitore'::text AND fattura_riga_id IS NOT NULL AND tipo_riga = 'materiale'::text AND sorgente_id IS NOT NULL AND indice_voce_sorgente IS NULL OR origine <> 'fattura_fornitore'::text AND fattura_riga_id IS NULL) IS TRUE);
ALTER TABLE public.economia_sorgenti ADD CONSTRAINT "economia_sorgenti_formato_check" CHECK ((formato = ANY (ARRAY['pdf'::text, 'excel'::text, 'immagine'::text])) OR tipo = 'fattura_fornitore'::text AND formato = 'fattura'::text);
ALTER TABLE public.materiali_cantiere ADD CONSTRAINT "materiali_cantiere_fattura_valori_check" CHECK (fattura_riga_id IS NULL OR (cantiere_id IS NOT NULL AND quantita > 0::numeric AND quantita < '1000000000000'::bigint::numeric AND quantita = round(quantita, 6) AND prezzo_unitario >= 0::numeric AND prezzo_unitario < '1000000000000'::bigint::numeric AND prezzo_unitario = round(prezzo_unitario, 6) AND totale = round(quantita * prezzo_unitario, 2) AND (quantita::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text])) AND (prezzo_unitario::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text])) AND (totale::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text])) AND btrim(unita_misura) <> ''::text AND length(unita_misura) <= 64 AND unita_misura !~ '[[:cntrl:]]'::text) IS TRUE);
ALTER TABLE public.utenti_impresa ADD CONSTRAINT "utenti_impresa_ruolo_check" CHECK (ruolo = 'titolare'::text);
ALTER TABLE public.utenti_impresa ADD CONSTRAINT "utenti_impresa_timestamp_check" CHECK (updated_at >= created_at);
ALTER TABLE public.materiali_impresa ADD CONSTRAINT "materiali_impresa_quantita_check" CHECK (quantita > 0::numeric AND quantita < '1000000000000'::bigint::numeric AND quantita = round(quantita, 6));
ALTER TABLE public.materiali_impresa ADD CONSTRAINT "materiali_impresa_unita_misura_check" CHECK (btrim(unita_misura) <> ''::text AND length(unita_misura) <= 64 AND unita_misura !~ '[[:cntrl:]]'::text);
ALTER TABLE public.materiali_impresa ADD CONSTRAINT "materiali_impresa_prezzo_unitario_check" CHECK (prezzo_unitario >= 0::numeric AND prezzo_unitario < '1000000000000'::bigint::numeric AND prezzo_unitario = round(prezzo_unitario, 6));
ALTER TABLE public.materiali_impresa ADD CONSTRAINT "materiali_impresa_check" CHECK (totale = round(quantita * prezzo_unitario, 2));
ALTER TABLE public.materiali_impresa ADD CONSTRAINT "materiali_impresa_categoria_check" CHECK (categoria = ANY (ARRAY['attrezzo_ditta'::text, 'magazzino'::text]));
ALTER TABLE public.quaderno_progetti ADD CONSTRAINT "quaderno_progetti_checklist_check" CHECK (jsonb_typeof(checklist) = 'array'::text);
ALTER TABLE public.quaderno_progetti ADD CONSTRAINT "quaderno_progetti_disegni_check" CHECK (jsonb_typeof(disegni) = 'array'::text);
ALTER TABLE public.quaderno_allegati ADD CONSTRAINT "quaderno_allegati_tipo_check" CHECK (tipo = ANY (ARRAY['foto'::text, 'allegato'::text, 'audio'::text]));
ALTER TABLE public.quaderno_allegati ADD CONSTRAINT "quaderno_allegati_storage_bucket_check" CHECK (storage_bucket = 'quaderno-privato'::text);
ALTER TABLE public.quaderno_allegati ADD CONSTRAINT "quaderno_allegati_url_check" CHECK (url IS NULL);
ALTER TABLE public.quaderno_richiami_sopralluogo ADD CONSTRAINT "quaderno_richiami_sopralluogo_stato_check" CHECK (stato = ANY (ARRAY['preparazione'::text, 'completato'::text, 'annullato'::text]));
ALTER TABLE public.quaderno_richiami_sopralluogo ADD CONSTRAINT "quaderno_richiami_sopralluogo_check" CHECK (stato <> 'completato'::text AND nota_id IS NULL OR stato = 'completato'::text AND nota_id IS NOT NULL);
ALTER TABLE public.quaderno_copie_allegati ADD CONSTRAINT "quaderno_copie_allegati_tipo_check" CHECK (tipo = ANY (ARRAY['immagine'::text, 'foto'::text, 'allegato'::text, 'audio'::text]));
ALTER TABLE public.quaderno_copie_allegati ADD CONSTRAINT "quaderno_copie_allegati_storage_bucket_check" CHECK (storage_bucket = 'quaderno-sopralluoghi'::text);
ALTER TABLE public.quaderno_gestioni ADD CONSTRAINT "quaderno_gestioni_tipo_check" CHECK (tipo = ANY (ARRAY['duplica'::text, 'elimina'::text, 'rimuovi'::text]));
ALTER TABLE public.quaderno_gestioni ADD CONSTRAINT "quaderno_gestioni_stato_check" CHECK (stato = ANY (ARRAY['aperto'::text, 'pulizia'::text, 'completato'::text]));
ALTER TABLE public.quaderno_gestioni ADD CONSTRAINT "quaderno_gestioni_assets_check" CHECK (jsonb_typeof(assets) = 'array'::text);
ALTER TABLE public.variante_fonti_memory ADD CONSTRAINT "variante_fonti_memory_source_type_check" CHECK (source_type = 'quaderno'::text);
ALTER TABLE public.variante_fonti_memory ADD CONSTRAINT "variante_fonti_memory_source_version_check" CHECK (isfinite(source_version));
ALTER TABLE public.variante_fonti_visive ADD CONSTRAINT "variante_fonti_visive_source_type_check" CHECK (source_type = ANY (ARRAY['foto_cantiere'::text, 'foto_sopralluogo'::text]));
ALTER TABLE public.variante_fonti_visive ADD CONSTRAINT "variante_fonti_visive_source_version_check" CHECK (source_version IS NULL);
ALTER TABLE public.variante_osservatore_analisi ADD CONSTRAINT "variante_osservatore_analisi_modello_check" CHECK (modello = 'gpt-4.1-mini'::text);
ALTER TABLE public.variante_osservatore_analisi ADD CONSTRAINT "variante_osservatore_analisi_fonti_check" CHECK (jsonb_typeof(fonti) = 'object'::text);
ALTER TABLE public.variante_osservatore_analisi ADD CONSTRAINT "variante_osservatore_analisi_risultato_check" CHECK (jsonb_typeof(risultato) = 'object'::text);
ALTER TABLE public.preventivi_cantiere ADD CONSTRAINT "preventivi_cantiere_natura_check" CHECK (natura = ANY (ARRAY['contrattuale'::text, 'integrativo'::text]));
ALTER TABLE public.preventivi_cantiere ADD CONSTRAINT "preventivo_integrativo_genealogia" CHECK (natura IS DISTINCT FROM 'integrativo'::text AND variante_id IS NULL AND preventivo_contrattuale_id IS NULL AND provenienza_generazione IS NULL OR NOT natura IS DISTINCT FROM 'integrativo'::text AND variante_id IS NOT NULL AND cantiere_id IS NOT NULL AND preventivo_contrattuale_id IS NOT NULL AND preventivo_contrattuale_id <> id AND jsonb_typeof(provenienza_generazione) = 'object'::text AND COALESCE(provenienza_generazione ->> 'firma'::text, ''::text) ~ '^[0-9a-f]{64}$'::text);
ALTER TABLE artecna_contabilita.attribuzioni_clienti ADD CONSTRAINT "attribuzioni_clienti_cliente_confermato_check" CHECK (btrim(cliente_confermato) <> ''::text);
ALTER TABLE artecna_contabilita.attribuzioni_clienti ADD CONSTRAINT "attribuzioni_clienti_importo_check" CHECK (importo > 0::numeric);
ALTER TABLE artecna_contabilita.attribuzioni_clienti ADD CONSTRAINT "attribuzioni_clienti_verificato_check" CHECK (verificato);
ALTER TABLE artecna_contabilita.attribuzioni_clienti ADD CONSTRAINT "attribuzioni_clienti_check" CHECK (scollegato_at IS NULL AND scollegato_da IS NULL AND richiesta_scollega IS NULL OR scollegato_at IS NOT NULL AND scollegato_da IS NOT NULL AND richiesta_scollega IS NOT NULL);
ALTER TABLE public.fornitori_rettifiche ADD CONSTRAINT "fornitori_rettifiche_categoria_check" CHECK (btrim(categoria) <> ''::text);
ALTER TABLE public.fornitori_rettifiche ADD CONSTRAINT "fornitori_rettifiche_quantita_check" CHECK (quantita > 0::numeric);
ALTER TABLE public.fornitori_rettifiche ADD CONSTRAINT "fornitori_rettifiche_importo_netto_check" CHECK (importo_netto < 0::numeric);
ALTER TABLE public.fornitori_rettifiche ADD CONSTRAINT "fornitori_rettifiche_importo_costo_check" CHECK (importo_costo < 0::numeric);
ALTER TABLE public.fornitori_rettifiche ADD CONSTRAINT "fornitori_rettifiche_check" CHECK (nota_id <> origine_id AND nota_riga_id <> origine_riga_id);
ALTER TABLE public.fornitori_rettifiche ADD CONSTRAINT "fornitori_rettifiche_check1" CHECK (num_nonnulls(economia_riga_id, materiale_cantiere_id, materiale_impresa_id, spesa_impresa_id) = 1);
ALTER TABLE public.note_allegati ADD CONSTRAINT "note_allegati_tipo_check" CHECK (tipo = ANY (ARRAY['foto'::text, 'allegato'::text, 'audio'::text]));
ALTER TABLE public.agenda_attivita ADD CONSTRAINT "agenda_attivita_orario_valido" CHECK (ora_fine >= ora_inizio);
ALTER TABLE public.agenda_attivita ADD CONSTRAINT "agenda_attivita_stato_valido" CHECK (stato = ANY (ARRAY['da_fare'::text, 'completata'::text]));
ALTER TABLE public.preventivi_cantiere ADD CONSTRAINT "preventivi_cantiere_cantiere_id_fkey" FOREIGN KEY (cantiere_id) REFERENCES public.cantieri(id);
ALTER TABLE public.preventivo_lavorazioni ADD CONSTRAINT "preventivo_lavorazioni_cantiere_id_fkey" FOREIGN KEY (cantiere_id) REFERENCES public.cantieri(id);
ALTER TABLE public.sal_lavorazioni ADD CONSTRAINT "sal_lavorazioni_cantiere_id_fkey" FOREIGN KEY (cantiere_id) REFERENCES public.cantieri(id);
ALTER TABLE public.acconti_cantiere ADD CONSTRAINT "acconti_cantiere_cantiere_id_fkey" FOREIGN KEY (cantiere_id) REFERENCES public.cantieri(id);
ALTER TABLE public.fatture_emesse ADD CONSTRAINT "fatture_emesse_cantiere_id_fkey" FOREIGN KEY (cantiere_id) REFERENCES public.cantieri(id);
ALTER TABLE public.materiali_cantiere ADD CONSTRAINT "materiali_cantiere_cantiere_id_fkey" FOREIGN KEY (cantiere_id) REFERENCES public.cantieri(id);
ALTER TABLE public.foto_cantiere ADD CONSTRAINT "foto_cantiere_cantiere_id_fkey" FOREIGN KEY (cantiere_id) REFERENCES public.cantieri(id);
ALTER TABLE public.rapportini ADD CONSTRAINT "rapportini_cantiere_id_fkey" FOREIGN KEY (cantiere_id) REFERENCES public.cantieri(id);
ALTER TABLE public.timbrature ADD CONSTRAINT "timbrature_cantiere_id_fkey" FOREIGN KEY (cantiere_id) REFERENCES public.cantieri(id);
ALTER TABLE public.fatture_fornitori_righe ADD CONSTRAINT "fatture_fornitori_righe_cantiere_id_fkey" FOREIGN KEY (cantiere_id) REFERENCES public.cantieri(id);
ALTER TABLE public.attrezzi_cantiere ADD CONSTRAINT "attrezzi_cantiere_cantiere_id_fkey" FOREIGN KEY (cantiere_id) REFERENCES public.cantieri(id);
ALTER TABLE public.incassi_non_fatturati ADD CONSTRAINT "incassi_non_fatturati_cantiere_id_fkey" FOREIGN KEY (cantiere_id) REFERENCES public.cantieri(id);
ALTER TABLE public.pagamenti_fornitori ADD CONSTRAINT "pagamenti_fornitori_cantiere_id_fkey" FOREIGN KEY (cantiere_id) REFERENCES public.cantieri(id);
ALTER TABLE public.preventivo_lavorazioni ADD CONSTRAINT "preventivo_lavorazioni_preventivo_id_fkey" FOREIGN KEY (preventivo_id) REFERENCES public.preventivi_cantiere(id) ON DELETE RESTRICT;
ALTER TABLE public.sal_lavorazioni ADD CONSTRAINT "sal_lavorazioni_source_lavorazione_id_fkey" FOREIGN KEY (source_lavorazione_id) REFERENCES public.preventivo_lavorazioni(id) ON DELETE RESTRICT;
ALTER TABLE public.cantieri ADD CONSTRAINT "cantieri_preventivo_contrattuale_id_fkey" FOREIGN KEY (preventivo_contrattuale_id) REFERENCES public.preventivi_cantiere(id) ON DELETE RESTRICT;
ALTER TABLE public.varianti_cantiere ADD CONSTRAINT "varianti_cantiere_cantiere_fk" FOREIGN KEY (cantiere_id) REFERENCES public.cantieri(id) ON DELETE RESTRICT;
ALTER TABLE public.varianti_cantiere ADD CONSTRAINT "varianti_cantiere_contratto_fk" FOREIGN KEY (preventivo_contrattuale_id) REFERENCES public.preventivi_cantiere(id) ON DELETE RESTRICT;
ALTER TABLE public.variante_lavorazioni ADD CONSTRAINT "variante_lavorazioni_variante_fk" FOREIGN KEY (variante_id) REFERENCES public.varianti_cantiere(id) ON DELETE RESTRICT;
ALTER TABLE public.variante_lavorazioni ADD CONSTRAINT "variante_lavorazioni_preventivo_fk" FOREIGN KEY (riferimento_preventivo_lavorazione_id) REFERENCES public.preventivo_lavorazioni(id) ON DELETE RESTRICT;
ALTER TABLE public.variante_lavorazioni ADD CONSTRAINT "variante_lavorazioni_precedente_fk" FOREIGN KEY (riferimento_variante_lavorazione_id) REFERENCES public.variante_lavorazioni(id) ON DELETE RESTRICT;
ALTER TABLE public.variante_documenti ADD CONSTRAINT "variante_documenti_variante_fk" FOREIGN KEY (variante_id) REFERENCES public.varianti_cantiere(id) ON DELETE RESTRICT;
ALTER TABLE public.sal_lavorazioni ADD CONSTRAINT "sal_lavorazioni_variante_source_fk" FOREIGN KEY (source_variante_lavorazione_id) REFERENCES public.variante_lavorazioni(id) ON DELETE RESTRICT;
ALTER TABLE public.utenti_cantiere ADD CONSTRAINT "utenti_cantiere_cantiere_fkey" FOREIGN KEY (cantiere_id) REFERENCES public.cantieri(id) ON DELETE CASCADE;
ALTER TABLE public.utenti_cantiere ADD CONSTRAINT "utenti_cantiere_user_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.variante_sorgenti ADD CONSTRAINT "variante_sorgenti_variante_fk" FOREIGN KEY (variante_id) REFERENCES public.varianti_cantiere(id) ON DELETE RESTRICT;
ALTER TABLE public.variante_sorgenti ADD CONSTRAINT "variante_sorgenti_preventivo_fk" FOREIGN KEY (preventivo_sorgente_id) REFERENCES public.preventivi_cantiere(id) ON DELETE RESTRICT;
ALTER TABLE public.variante_lavorazioni ADD CONSTRAINT "variante_lavorazioni_sorgente_fk" FOREIGN KEY (variante_sorgente_id) REFERENCES public.variante_sorgenti(id) ON DELETE RESTRICT;
ALTER TABLE public.economia_raccolte ADD CONSTRAINT "economia_raccolte_cantiere_fk" FOREIGN KEY (cantiere_id) REFERENCES public.cantieri(id) ON DELETE RESTRICT;
ALTER TABLE public.economia_sorgenti ADD CONSTRAINT "economia_sorgenti_raccolta_fk" FOREIGN KEY (raccolta_id) REFERENCES public.economia_raccolte(id) ON DELETE RESTRICT;
ALTER TABLE public.economia_righe ADD CONSTRAINT "economia_righe_raccolta_fk" FOREIGN KEY (raccolta_id) REFERENCES public.economia_raccolte(id) ON DELETE RESTRICT;
ALTER TABLE public.economia_righe ADD CONSTRAINT "economia_righe_sorgente_fk" FOREIGN KEY (sorgente_id, raccolta_id) REFERENCES public.economia_sorgenti(id, raccolta_id) ON DELETE RESTRICT;
ALTER TABLE public.rapportino_prestazioni ADD CONSTRAINT "rapportino_prestazioni_rapportino_id_fkey" FOREIGN KEY (rapportino_id) REFERENCES public.rapportini(id) ON DELETE RESTRICT;
ALTER TABLE public.rapportino_prestazioni ADD CONSTRAINT "rapportino_prestazioni_operaio_id_fkey" FOREIGN KEY (operaio_id) REFERENCES public.operai(id) ON DELETE RESTRICT;
ALTER TABLE public.rapportino_prestazioni ADD CONSTRAINT "rapportino_prestazioni_variante_id_fkey" FOREIGN KEY (variante_id) REFERENCES public.varianti_cantiere(id) ON DELETE RESTRICT;
ALTER TABLE artecna_rapportini.richieste ADD CONSTRAINT "richieste_rapportino_id_fkey" FOREIGN KEY (rapportino_id) REFERENCES public.rapportini(id) ON DELETE RESTRICT;
ALTER TABLE public.timbrature ADD CONSTRAINT "timbrature_prestazione_rapportino_id_fkey" FOREIGN KEY (prestazione_rapportino_id) REFERENCES public.rapportino_prestazioni(id) ON DELETE RESTRICT;
ALTER TABLE artecna_rapportini.sessioni_portale ADD CONSTRAINT "sessioni_portale_operaio_id_fkey" FOREIGN KEY (operaio_id) REFERENCES public.operai(id) ON DELETE RESTRICT;
ALTER TABLE artecna_rapportini.allegati ADD CONSTRAINT "allegati_rapportino_id_fkey" FOREIGN KEY (rapportino_id) REFERENCES public.rapportini(id) ON DELETE RESTRICT;
ALTER TABLE artecna_rapportini.allegati ADD CONSTRAINT "allegati_cantiere_id_fkey" FOREIGN KEY (cantiere_id) REFERENCES public.cantieri(id) ON DELETE RESTRICT;
ALTER TABLE artecna_rapportini.allegati ADD CONSTRAINT "allegati_foto_cantiere_id_fkey" FOREIGN KEY (foto_cantiere_id) REFERENCES public.foto_cantiere(id) ON DELETE RESTRICT;
ALTER TABLE public.variante_sorgenti ADD CONSTRAINT "variante_sorgenti_economia_raccolta_fk" FOREIGN KEY (economia_raccolta_id) REFERENCES public.economia_raccolte(id) ON DELETE RESTRICT;
ALTER TABLE public.rapportino_materiali ADD CONSTRAINT "rapportino_materiali_rapportino_fk" FOREIGN KEY (rapportino_id) REFERENCES public.rapportini(id) ON DELETE RESTRICT;
ALTER TABLE public.foto_cantiere ADD CONSTRAINT "foto_cantiere_allegato_v1_fkey" FOREIGN KEY (allegato_v1_id) REFERENCES artecna_rapportini.allegati(id) ON DELETE RESTRICT;
ALTER TABLE public.economia_righe ADD CONSTRAINT "economia_righe_prestazione_fk" FOREIGN KEY (rapportino_prestazione_id) REFERENCES public.rapportino_prestazioni(id) ON DELETE RESTRICT;
ALTER TABLE public.prezzi_lavorazioni ADD CONSTRAINT "prezzi_lavorazioni_origine_prezzario_fkey" FOREIGN KEY (origine_prezzario_id) REFERENCES public.prezzi_lavorazioni(id) ON DELETE RESTRICT;
ALTER TABLE public.economia_righe ADD CONSTRAINT "economia_righe_fattura_riga_fk" FOREIGN KEY (fattura_riga_id) REFERENCES public.fatture_fornitori_righe(id) ON DELETE RESTRICT;
ALTER TABLE public.materiali_cantiere ADD CONSTRAINT "materiali_cantiere_fattura_riga_fk" FOREIGN KEY (fattura_riga_id) REFERENCES public.fatture_fornitori_righe(id) ON DELETE RESTRICT;
ALTER TABLE public.utenti_impresa ADD CONSTRAINT "utenti_impresa_user_fk" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE public.materiali_impresa ADD CONSTRAINT "materiali_impresa_fattura_riga_id_fkey" FOREIGN KEY (fattura_riga_id) REFERENCES public.fatture_fornitori_righe(id) ON DELETE RESTRICT;
ALTER TABLE public.materiali_impresa ADD CONSTRAINT "materiali_impresa_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE artecna_guardie.fatture_classificazione_richieste ADD CONSTRAINT "fatture_classificazione_richieste_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE public.quaderno_progetti ADD CONSTRAINT "quaderno_progetti_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.quaderno_allegati ADD CONSTRAINT "quaderno_allegati_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.quaderno_allegati ADD CONSTRAINT "quaderno_allegati_nota_id_user_id_fkey" FOREIGN KEY (nota_id, user_id) REFERENCES public.quaderno_progetti(id, user_id) ON DELETE CASCADE;
ALTER TABLE public.quaderno_richiami_sopralluogo ADD CONSTRAINT "quaderno_richiami_sopralluogo_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.quaderno_richiami_sopralluogo ADD CONSTRAINT "quaderno_richiami_sopralluogo_nota_id_fkey" FOREIGN KEY (nota_id) REFERENCES public.note_sopralluogo(id) ON DELETE CASCADE;
ALTER TABLE public.quaderno_copie_allegati ADD CONSTRAINT "quaderno_copie_allegati_richiamo_id_fkey" FOREIGN KEY (richiamo_id) REFERENCES public.quaderno_richiami_sopralluogo(id) ON DELETE CASCADE;
ALTER TABLE public.quaderno_copie_allegati ADD CONSTRAINT "quaderno_copie_allegati_nota_id_fkey" FOREIGN KEY (nota_id) REFERENCES public.note_sopralluogo(id) ON DELETE CASCADE;
ALTER TABLE public.quaderno_copie_allegati ADD CONSTRAINT "quaderno_copie_allegati_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.quaderno_gestioni ADD CONSTRAINT "quaderno_gestioni_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.variante_fonti_memory ADD CONSTRAINT "variante_fonti_memory_variante_id_fkey" FOREIGN KEY (variante_id) REFERENCES public.varianti_cantiere(id) ON DELETE CASCADE;
ALTER TABLE public.variante_fonti_memory ADD CONSTRAINT "variante_fonti_memory_source_id_fkey" FOREIGN KEY (source_id) REFERENCES public.quaderno_progetti(id) ON DELETE CASCADE;
ALTER TABLE public.variante_fonti_visive ADD CONSTRAINT "variante_fonti_visive_variante_id_fkey" FOREIGN KEY (variante_id) REFERENCES public.varianti_cantiere(id) ON DELETE CASCADE;
ALTER TABLE public.variante_fonti_visive ADD CONSTRAINT "variante_fonti_visive_foto_cantiere_id_fkey" FOREIGN KEY (foto_cantiere_id) REFERENCES public.foto_cantiere(id) ON DELETE CASCADE;
ALTER TABLE public.variante_fonti_visive ADD CONSTRAINT "variante_fonti_visive_foto_sopralluogo_id_fkey" FOREIGN KEY (foto_sopralluogo_id) REFERENCES public.foto_sopralluogo(id) ON DELETE CASCADE;
ALTER TABLE public.variante_osservatore_analisi ADD CONSTRAINT "variante_osservatore_analisi_variante_id_fkey" FOREIGN KEY (variante_id) REFERENCES public.varianti_cantiere(id) ON DELETE CASCADE;
ALTER TABLE public.preventivi_cantiere ADD CONSTRAINT "preventivi_cantiere_variante_id_fkey" FOREIGN KEY (variante_id) REFERENCES public.varianti_cantiere(id) ON DELETE RESTRICT;
ALTER TABLE public.preventivi_cantiere ADD CONSTRAINT "preventivi_cantiere_preventivo_contrattuale_id_fkey" FOREIGN KEY (preventivo_contrattuale_id) REFERENCES public.preventivi_cantiere(id) ON DELETE RESTRICT;
ALTER TABLE public.fornitori_rettifiche ADD CONSTRAINT "fornitori_rettifiche_nota_id_fkey" FOREIGN KEY (nota_id) REFERENCES public.fatture_fornitori(id) ON DELETE RESTRICT;
ALTER TABLE public.fornitori_rettifiche ADD CONSTRAINT "fornitori_rettifiche_nota_riga_id_fkey" FOREIGN KEY (nota_riga_id) REFERENCES public.fatture_fornitori_righe(id) ON DELETE RESTRICT;
ALTER TABLE public.fornitori_rettifiche ADD CONSTRAINT "fornitori_rettifiche_origine_id_fkey" FOREIGN KEY (origine_id) REFERENCES public.fatture_fornitori(id) ON DELETE RESTRICT;
ALTER TABLE public.fornitori_rettifiche ADD CONSTRAINT "fornitori_rettifiche_origine_riga_id_fkey" FOREIGN KEY (origine_riga_id) REFERENCES public.fatture_fornitori_righe(id) ON DELETE RESTRICT;
ALTER TABLE public.fornitori_rettifiche ADD CONSTRAINT "fornitori_rettifiche_economia_riga_id_fkey" FOREIGN KEY (economia_riga_id) REFERENCES public.economia_righe(id) ON DELETE RESTRICT;
ALTER TABLE public.fornitori_rettifiche ADD CONSTRAINT "fornitori_rettifiche_materiale_cantiere_id_fkey" FOREIGN KEY (materiale_cantiere_id) REFERENCES public.materiali_cantiere(id) ON DELETE RESTRICT;
ALTER TABLE public.fornitori_rettifiche ADD CONSTRAINT "fornitori_rettifiche_materiale_impresa_id_fkey" FOREIGN KEY (materiale_impresa_id) REFERENCES public.materiali_impresa(id) ON DELETE RESTRICT;
ALTER TABLE public.fornitori_rettifiche ADD CONSTRAINT "fornitori_rettifiche_spesa_impresa_id_fkey" FOREIGN KEY (spesa_impresa_id) REFERENCES public.spese_impresa(id) ON DELETE RESTRICT;
ALTER TABLE public.fornitori_rettifiche ADD CONSTRAINT "fornitori_rettifiche_cantiere_id_fkey" FOREIGN KEY (cantiere_id) REFERENCES public.cantieri(id) ON DELETE RESTRICT;
ALTER TABLE public.fatture_fornitori_righe ADD CONSTRAINT "fatture_fornitori_righe_fattura_id_fkey" FOREIGN KEY (fattura_id) REFERENCES public.fatture_fornitori(id) ON DELETE CASCADE;
ALTER TABLE public.foto_sopralluogo ADD CONSTRAINT "foto_sopralluogo_sopralluogo_id_fkey" FOREIGN KEY (sopralluogo_id) REFERENCES public.sopralluoghi(id) ON DELETE CASCADE;
ALTER TABLE public.note_sopralluogo ADD CONSTRAINT "note_sopralluogo_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.note_allegati ADD CONSTRAINT "note_allegati_nota_id_fkey" FOREIGN KEY (nota_id) REFERENCES public.note_sopralluogo(id) ON DELETE CASCADE;
ALTER TABLE public.note_allegati ADD CONSTRAINT "note_allegati_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.agenda_attivita ADD CONSTRAINT "agenda_attivita_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX sal_lavorazioni_source_lavorazione_id_uidx ON public.sal_lavorazioni USING btree (source_lavorazione_id) WHERE (source_lavorazione_id IS NOT NULL);
CREATE INDEX cantieri_preventivo_contrattuale_id_idx ON public.cantieri USING btree (preventivo_contrattuale_id);
CREATE INDEX varianti_cantiere_stato_idx ON public.varianti_cantiere USING btree (cantiere_id, stato);
CREATE INDEX varianti_cantiere_contratto_idx ON public.varianti_cantiere USING btree (preventivo_contrattuale_id);
CREATE INDEX variante_lavorazioni_preventivo_idx ON public.variante_lavorazioni USING btree (riferimento_preventivo_lavorazione_id) WHERE (riferimento_preventivo_lavorazione_id IS NOT NULL);
CREATE INDEX variante_lavorazioni_precedente_idx ON public.variante_lavorazioni USING btree (riferimento_variante_lavorazione_id) WHERE (riferimento_variante_lavorazione_id IS NOT NULL);
CREATE UNIQUE INDEX sal_lavorazioni_variante_source_uq ON public.sal_lavorazioni USING btree (source_variante_lavorazione_id) WHERE (source_variante_lavorazione_id IS NOT NULL);
CREATE INDEX utenti_cantiere_user_id_idx ON public.utenti_cantiere USING btree (user_id);
CREATE UNIQUE INDEX preventivi_cantiere_archiviazione_key_uidx ON public.preventivi_cantiere USING btree (archiviazione_key) WHERE (archiviazione_key IS NOT NULL);
CREATE UNIQUE INDEX variante_sorgenti_preventivo_unique ON public.variante_sorgenti USING btree (variante_id, preventivo_sorgente_id) WHERE (tipo = 'preventivo_artecna'::text);
CREATE UNIQUE INDEX variante_sorgenti_file_sha256_unique ON public.variante_sorgenti USING btree (variante_id, file_sha256) WHERE ((tipo = 'file'::text) AND (file_sha256 IS NOT NULL));
CREATE INDEX variante_sorgenti_lettura_idx ON public.variante_sorgenti USING btree (variante_id, created_at, id);
CREATE UNIQUE INDEX variante_lavorazioni_sorgente_voce_unique ON public.variante_lavorazioni USING btree (variante_sorgente_id, indice_voce_sorgente) WHERE ((variante_sorgente_id IS NOT NULL) AND (indice_voce_sorgente IS NOT NULL));
CREATE INDEX rapportino_prestazioni_variante ON public.rapportino_prestazioni USING btree (variante_id) WHERE (variante_id IS NOT NULL);
CREATE UNIQUE INDEX timbrature_prestazione_rapportino_unica ON public.timbrature USING btree (prestazione_rapportino_id) WHERE (prestazione_rapportino_id IS NOT NULL);
CREATE INDEX allegati_cantiere ON artecna_rapportini.allegati USING btree (cantiere_id);
CREATE INDEX allegati_scadenza ON artecna_rapportini.allegati USING btree (expires_at) WHERE (stato = 'prenotato'::text);
CREATE UNIQUE INDEX variante_sorgenti_economia_raccolta_unique ON public.variante_sorgenti USING btree (economia_raccolta_id) WHERE (tipo = 'raccolta_economia'::text);
CREATE UNIQUE INDEX variante_sorgenti_economia_variante_unique ON public.variante_sorgenti USING btree (variante_id) WHERE (tipo = 'raccolta_economia'::text);
CREATE INDEX rapportino_materiali_attivi ON public.rapportino_materiali USING btree (rapportino_id, created_at, id) WHERE (rimossa_at IS NULL);
CREATE UNIQUE INDEX prezzi_lavorazioni_origine_prezzario_uidx ON public.prezzi_lavorazioni USING btree (origine_prezzario_id) WHERE (origine_prezzario_id IS NOT NULL);
CREATE UNIQUE INDEX economia_righe_raccolta_fattura_riga_unique ON public.economia_righe USING btree (raccolta_id, fattura_riga_id) WHERE (fattura_riga_id IS NOT NULL);
CREATE INDEX materiali_cantiere_fattura_riga_idx ON public.materiali_cantiere USING btree (fattura_riga_id) WHERE (fattura_riga_id IS NOT NULL);
CREATE INDEX materiali_impresa_fattura_riga_idx ON public.materiali_impresa USING btree (fattura_riga_id);
CREATE INDEX quaderno_progetti_archivio_idx ON public.quaderno_progetti USING btree (user_id, updated_at DESC);
CREATE INDEX quaderno_allegati_progetto_idx ON public.quaderno_allegati USING btree (nota_id);
CREATE INDEX quaderno_copie_nota_idx ON public.quaderno_copie_allegati USING btree (nota_id);
CREATE UNIQUE INDEX quaderno_richiamo_aperto_idx ON public.quaderno_richiami_sopralluogo USING btree (user_id, sopralluogo_id) WHERE (confermato_at IS NULL);
CREATE UNIQUE INDEX quaderno_gestione_attiva_idx ON public.quaderno_gestioni USING btree (user_id, COALESCE(progetto_id, richiamo_id)) WHERE (stato <> 'completato'::text);
CREATE INDEX variante_fonti_memory_sorgente_idx ON public.variante_fonti_memory USING btree (source_id);
CREATE INDEX variante_fonti_visive_source_idx ON public.variante_fonti_visive USING btree (source_type, source_id);
CREATE INDEX variante_osservatore_ultima_idx ON public.variante_osservatore_analisi USING btree (variante_id, created_at DESC, id);
CREATE UNIQUE INDEX preventivo_integrativo_variante_unique ON public.preventivi_cantiere USING btree (variante_id) WHERE (natura = 'integrativo'::text);
CREATE INDEX attribuzioni_clienti_fattura ON artecna_contabilita.attribuzioni_clienti USING btree (fattura_id);
CREATE INDEX attribuzioni_clienti_acconto ON artecna_contabilita.attribuzioni_clienti USING btree (acconto_id);
CREATE INDEX fornitori_rettifiche_nota ON public.fornitori_rettifiche USING btree (nota_id, nota_riga_id);
CREATE INDEX fornitori_rettifiche_origine ON public.fornitori_rettifiche USING btree (origine_id, origine_riga_id);
CREATE INDEX fornitori_rettifiche_periodo ON public.fornitori_rettifiche USING btree (cantiere_id, data_nota);
CREATE INDEX fornitori_rettifiche_richiesta ON public.fornitori_rettifiche USING btree (richiesta_id);
CREATE UNIQUE INDEX fatture_fornitori_duplicato_idx ON public.fatture_fornitori USING btree (partita_iva, numero_fattura, data_fattura, importo_totale);
CREATE INDEX note_sopralluogo_sopralluogo_idx ON public.note_sopralluogo USING btree (sopralluogo_id);
CREATE INDEX note_allegati_nota_idx ON public.note_allegati USING btree (nota_id);
CREATE INDEX agenda_attivita_user_data_ora_idx ON public.agenda_attivita USING btree (user_id, data, ora_inizio);
CREATE UNIQUE INDEX prezzi_lavorazioni_codice_fonte_versione_uidx ON public.prezzi_lavorazioni USING btree (codice, fonte, versione);
CREATE INDEX prezzi_lavorazioni_codice_idx ON public.prezzi_lavorazioni USING btree (codice);
CREATE INDEX prezzi_lavorazioni_fonte_regione_anno_idx ON public.prezzi_lavorazioni USING btree (fonte, regione, anno);
CREATE TRIGGER a_rapportino_materiali_integrita BEFORE INSERT OR DELETE OR UPDATE ON public.rapportino_materiali FOR EACH ROW EXECUTE FUNCTION artecna_rapportini.proteggi_materiale();
CREATE TRIGGER a_sal_protezione_cambio_contratto BEFORE UPDATE OF preventivo_contrattuale_id ON public.cantieri FOR EACH ROW EXECUTE FUNCTION artecna_guardie.sal_blocca_cambio_contratto();
CREATE TRIGGER a_sal_protezione_elimina_preventivo BEFORE DELETE ON public.preventivi_cantiere FOR EACH ROW EXECUTE FUNCTION artecna_guardie.sal_blocca_eliminazione_preventivo();
CREATE TRIGGER acconti_attribuzioni_guard BEFORE DELETE OR UPDATE ON public.acconti_cantiere FOR EACH ROW EXECUTE FUNCTION artecna_contabilita.proteggi_origine();
CREATE TRIGGER acconti_attribuzioni_truncate BEFORE TRUNCATE ON public.acconti_cantiere FOR EACH STATEMENT EXECUTE FUNCTION artecna_contabilita.proteggi_truncate();
CREATE TRIGGER e31_prezzo_materiale_cliente BEFORE INSERT OR DELETE OR UPDATE ON public.economia_righe FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_prezzo_materiale_cliente();
CREATE TRIGGER e32_esclusione_proposta BEFORE INSERT OR DELETE OR UPDATE ON public.economia_righe FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_esclusione_proposta();
CREATE TRIGGER e32_provenienza BEFORE DELETE OR UPDATE ON public.economia_righe FOR EACH ROW EXECUTE FUNCTION public.proteggi_provenienza_economia_rapportino();
CREATE CONSTRAINT TRIGGER f3c3_allegati_reciprocita AFTER INSERT OR DELETE OR UPDATE ON artecna_rapportini.allegati DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION artecna_rapportini.f3c3_reciprocita();
CREATE TRIGGER f3c3_foto_dml BEFORE INSERT OR DELETE OR UPDATE ON public.foto_cantiere FOR EACH ROW EXECUTE FUNCTION artecna_rapportini.f3c3_guardia_foto();
CREATE CONSTRAINT TRIGGER f3c3_foto_reciprocita AFTER INSERT OR DELETE OR UPDATE ON public.foto_cantiere DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION artecna_rapportini.f3c3_reciprocita();
CREATE TRIGGER f3c3_foto_truncate BEFORE TRUNCATE ON public.foto_cantiere FOR EACH STATEMENT EXECUTE FUNCTION artecna_rapportini.f3c3_guardia_truncate();
CREATE TRIGGER fatture_emesse_attribuzioni_guard BEFORE DELETE OR UPDATE ON public.fatture_emesse FOR EACH ROW EXECUTE FUNCTION artecna_contabilita.proteggi_origine();
CREATE TRIGGER fatture_emesse_attribuzioni_truncate BEFORE TRUNCATE ON public.fatture_emesse FOR EACH STATEMENT EXECUTE FUNCTION artecna_contabilita.proteggi_truncate();
CREATE TRIGGER fornitori_rettifiche_immutabile BEFORE DELETE OR UPDATE ON public.fornitori_rettifiche FOR EACH ROW EXECUTE FUNCTION artecna_guardie.nc_immutabile();
CREATE TRIGGER fornitori_rettifiche_no_truncate BEFORE TRUNCATE ON public.fornitori_rettifiche FOR EACH STATEMENT EXECUTE FUNCTION artecna_guardie.nc_immutabile();
CREATE TRIGGER guardia_archiviazione_preventivo BEFORE INSERT OR UPDATE ON public.preventivi_cantiere FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_archiviazione_preventivo();
CREATE TRIGGER guardia_contrattuale_cantiere BEFORE UPDATE ON public.cantieri FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_contrattuale_cantiere();
CREATE TRIGGER guardia_lavorazione_base BEFORE INSERT OR DELETE OR UPDATE ON public.preventivo_lavorazioni FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_lavorazione_base();
CREATE TRIGGER guardia_preventivo_base BEFORE DELETE OR UPDATE ON public.preventivi_cantiere FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_preventivo_base();
CREATE TRIGGER guardia_variante_documenti BEFORE INSERT OR DELETE OR UPDATE ON public.variante_documenti FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_variante_figlio();
CREATE TRIGGER guardia_variante_lavorazioni BEFORE INSERT OR DELETE OR UPDATE ON public.variante_lavorazioni FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_variante_figlio();
CREATE TRIGGER guardia_variante_testata BEFORE INSERT OR DELETE OR UPDATE ON public.varianti_cantiere FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_variante_testata();
CREATE TRIGGER impostazioni_link_rapportini_guard BEFORE INSERT OR DELETE OR UPDATE ON public.impostazioni_app FOR EACH ROW EXECUTE FUNCTION public.proteggi_link_rapportini_mobile();
CREATE TRIGGER impostazioni_link_rapportini_truncate BEFORE TRUNCATE ON public.impostazioni_app FOR EACH STATEMENT EXECUTE FUNCTION public.proteggi_link_rapportini_mobile();
CREATE TRIGGER materiali_economia_globale_guardia BEFORE INSERT OR DELETE OR UPDATE ON public.economia_righe FOR EACH ROW EXECUTE FUNCTION artecna_guardie.materiali_economia_globale_guardia();
CREATE TRIGGER materiali_economia_stato AFTER INSERT OR DELETE OR UPDATE ON public.economia_righe FOR EACH ROW EXECUTE FUNCTION artecna_guardie.materiali_economia_stato();
CREATE TRIGGER materiali_fattura_guardia BEFORE INSERT OR DELETE OR UPDATE ON public.materiali_cantiere FOR EACH ROW EXECUTE FUNCTION artecna_guardie.materiali_fattura_guardia();
CREATE TRIGGER materiali_fattura_legacy_guardia BEFORE INSERT OR UPDATE ON public.materiali_cantiere FOR EACH ROW EXECUTE FUNCTION artecna_guardie.materiali_fattura_legacy_guardia();
CREATE TRIGGER materiali_fattura_testata_guardia BEFORE UPDATE OF stato ON public.fatture_fornitori FOR EACH ROW EXECUTE FUNCTION artecna_guardie.materiali_fattura_testata_guardia();
CREATE TRIGGER materiali_impresa_conflitto_legacy BEFORE INSERT OR DELETE OR UPDATE ON public.materiali_impresa FOR EACH ROW EXECUTE FUNCTION artecna_guardie.materiali_impresa_conflitto_legacy();
CREATE TRIGGER nc_documenti_originali BEFORE UPDATE ON public.fatture_fornitori FOR EACH ROW EXECUTE FUNCTION artecna_guardie.nc_proteggi_documenti();
CREATE TRIGGER nc_quote_cantiere BEFORE INSERT OR UPDATE ON public.materiali_cantiere FOR EACH ROW EXECUTE FUNCTION artecna_guardie.nc_proteggi_quote();
CREATE TRIGGER nc_quote_economia BEFORE INSERT OR UPDATE ON public.economia_righe FOR EACH ROW EXECUTE FUNCTION artecna_guardie.nc_proteggi_quote();
CREATE TRIGGER nc_quote_impresa BEFORE INSERT OR UPDATE ON public.materiali_impresa FOR EACH ROW EXECUTE FUNCTION artecna_guardie.nc_proteggi_quote();
CREATE TRIGGER nc_quote_spese BEFORE INSERT OR UPDATE ON public.spese_impresa FOR EACH ROW EXECUTE FUNCTION artecna_guardie.nc_proteggi_quote();
CREATE TRIGGER nc_righe_originali BEFORE INSERT OR DELETE OR UPDATE ON public.fatture_fornitori_righe FOR EACH ROW EXECUTE FUNCTION artecna_guardie.nc_proteggi_documenti();
CREATE TRIGGER ponte_economia_lavorazioni BEFORE INSERT OR DELETE OR UPDATE ON public.variante_lavorazioni FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_ponte_economia();
CREATE TRIGGER ponte_economia_sorgenti BEFORE INSERT OR DELETE OR UPDATE ON public.variante_sorgenti FOR EACH ROW EXECUTE FUNCTION artecna_guardie.proteggi_ponte_economia();
CREATE TRIGGER preventivo_integrativo_generato_guard BEFORE INSERT OR DELETE OR UPDATE ON public.preventivi_cantiere FOR EACH ROW EXECUTE FUNCTION public.proteggi_preventivo_integrativo_generato();
CREATE TRIGGER quaderno_allegati_gestione BEFORE INSERT OR DELETE OR UPDATE ON public.quaderno_allegati FOR EACH ROW EXECUTE FUNCTION public.quaderno_gestione_allegati_guard();
CREATE TRIGGER quaderno_copie_gestione BEFORE DELETE ON public.quaderno_copie_allegati FOR EACH ROW EXECUTE FUNCTION public.quaderno_gestione_allegati_guard();
CREATE TRIGGER quaderno_gestione_richiamo BEFORE INSERT ON public.quaderno_richiami_sopralluogo FOR EACH ROW EXECUTE FUNCTION public.quaderno_gestione_richiamo_guard();
CREATE TRIGGER quaderno_nota_gestione BEFORE INSERT OR DELETE OR UPDATE ON public.note_sopralluogo FOR EACH ROW EXECUTE FUNCTION public.quaderno_gestione_blocco();
CREATE TRIGGER quaderno_progetto_gestione BEFORE INSERT OR DELETE OR UPDATE ON public.quaderno_progetti FOR EACH ROW EXECUTE FUNCTION public.quaderno_gestione_blocco();
CREATE TRIGGER quaderno_progetto_versione_contenuto BEFORE UPDATE ON public.quaderno_progetti FOR EACH ROW EXECUTE FUNCTION public.quaderno_versione_contenuto();
CREATE TRIGGER rapportino_materiali_versione BEFORE INSERT OR UPDATE ON public.rapportini FOR EACH ROW EXECUTE FUNCTION artecna_rapportini.proteggi_versione_materiali();
CREATE TRIGGER rapportino_prestazioni_costo_storico BEFORE INSERT OR UPDATE ON public.rapportino_prestazioni FOR EACH ROW EXECUTE FUNCTION artecna_rapportini.fotografa_costo();
CREATE TRIGGER rapportino_prestazioni_guardia BEFORE INSERT OR DELETE OR UPDATE ON public.rapportino_prestazioni FOR EACH ROW EXECUTE FUNCTION artecna_rapportini.proteggi_prestazione();
CREATE CONSTRAINT TRIGGER rapportino_prestazioni_intervalli AFTER INSERT OR UPDATE ON public.rapportino_prestazioni DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION artecna_rapportini.verifica_intervalli_prestazioni();
CREATE TRIGGER rapportino_prestazioni_proiezione BEFORE INSERT OR UPDATE ON public.timbrature FOR EACH ROW EXECUTE FUNCTION artecna_rapportini.proteggi_proiezione();
CREATE TRIGGER rapportino_prestazioni_testata BEFORE INSERT OR UPDATE ON public.rapportini FOR EACH ROW EXECUTE FUNCTION artecna_rapportini.proteggi_testata();
CREATE TRIGGER rapportino_prestazioni_variante BEFORE UPDATE OF cantiere_id ON public.varianti_cantiere FOR EACH ROW EXECUTE FUNCTION artecna_rapportini.proteggi_cantiere_variante();
CREATE TRIGGER rapportino_strutturato_guardia BEFORE DELETE OR UPDATE ON public.rapportini FOR EACH ROW EXECUTE FUNCTION artecna_rapportini.proteggi_strutturato();
CREATE TRIGGER spese_impresa_conflitto_quantitativo BEFORE INSERT OR DELETE OR UPDATE ON public.spese_impresa FOR EACH ROW EXECUTE FUNCTION artecna_guardie.spese_impresa_conflitto_quantitativo();
CREATE TRIGGER timbratura_strutturata_guardia BEFORE INSERT OR DELETE OR UPDATE ON public.timbrature FOR EACH ROW EXECUTE FUNCTION artecna_rapportini.proteggi_strutturato();
CREATE TRIGGER z_rapportino_materiali_fail_closed BEFORE INSERT OR DELETE OR UPDATE ON public.rapportino_materiali FOR EACH ROW EXECUTE FUNCTION artecna_rapportini.materiali_fail_closed();
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";
GRANT USAGE ON SCHEMA "public" TO "artecna_cantieri_delete_rpc";
GRANT USAGE ON SCHEMA "public" TO "artecna_cantieri_rpc";
GRANT USAGE ON SCHEMA "public" TO "artecna_economia_rpc";
GRANT USAGE ON SCHEMA "public" TO "artecna_foto_v1_writer";
GRANT USAGE ON SCHEMA "public" TO "artecna_materiali_fattura_rpc";
GRANT USAGE ON SCHEMA "public" TO "artecna_ponte_economia_rpc";
GRANT USAGE ON SCHEMA "public" TO "artecna_preventivi_rpc";
GRANT USAGE ON SCHEMA "public" TO "artecna_rapportini_rpc";
GRANT USAGE ON SCHEMA "public" TO "artecna_sal_rpc";
GRANT USAGE ON SCHEMA "public" TO "artecna_varianti_rpc";
GRANT USAGE ON SCHEMA "public" TO "artecna_rapportini_backend";
GRANT USAGE ON SCHEMA "artecna_rapportini" TO "anon";
GRANT USAGE ON SCHEMA "artecna_rapportini" TO "authenticated";
GRANT USAGE ON SCHEMA "artecna_rapportini" TO "service_role";
GRANT USAGE ON SCHEMA "artecna_rapportini" TO "artecna_cantieri_delete_rpc";
GRANT USAGE ON SCHEMA "artecna_rapportini" TO "artecna_cantieri_rpc";
GRANT USAGE ON SCHEMA "artecna_rapportini" TO "artecna_economia_rpc";
GRANT USAGE ON SCHEMA "artecna_rapportini" TO "artecna_foto_v1_writer";
GRANT USAGE ON SCHEMA "artecna_rapportini" TO "artecna_materiali_fattura_rpc";
GRANT USAGE ON SCHEMA "artecna_rapportini" TO "artecna_ponte_economia_rpc";
GRANT USAGE ON SCHEMA "artecna_rapportini" TO "artecna_preventivi_rpc";
GRANT USAGE ON SCHEMA "artecna_rapportini" TO "artecna_rapportini_rpc";
GRANT USAGE ON SCHEMA "artecna_rapportini" TO "artecna_sal_rpc";
GRANT USAGE ON SCHEMA "artecna_rapportini" TO "artecna_varianti_rpc";
GRANT USAGE ON SCHEMA "artecna_rapportini" TO "artecna_rapportini_backend";
GRANT USAGE ON SCHEMA "artecna_distruzione" TO "anon";
GRANT USAGE ON SCHEMA "artecna_distruzione" TO "authenticated";
GRANT USAGE ON SCHEMA "artecna_distruzione" TO "service_role";
GRANT USAGE ON SCHEMA "artecna_distruzione" TO "artecna_cantieri_delete_rpc";
GRANT USAGE ON SCHEMA "artecna_distruzione" TO "artecna_cantieri_rpc";
GRANT USAGE ON SCHEMA "artecna_distruzione" TO "artecna_economia_rpc";
GRANT USAGE ON SCHEMA "artecna_distruzione" TO "artecna_foto_v1_writer";
GRANT USAGE ON SCHEMA "artecna_distruzione" TO "artecna_materiali_fattura_rpc";
GRANT USAGE ON SCHEMA "artecna_distruzione" TO "artecna_ponte_economia_rpc";
GRANT USAGE ON SCHEMA "artecna_distruzione" TO "artecna_preventivi_rpc";
GRANT USAGE ON SCHEMA "artecna_distruzione" TO "artecna_rapportini_rpc";
GRANT USAGE ON SCHEMA "artecna_distruzione" TO "artecna_sal_rpc";
GRANT USAGE ON SCHEMA "artecna_distruzione" TO "artecna_varianti_rpc";
GRANT USAGE ON SCHEMA "artecna_distruzione" TO "artecna_rapportini_backend";
GRANT USAGE ON SCHEMA "artecna_guardie" TO "anon";
GRANT USAGE ON SCHEMA "artecna_guardie" TO "authenticated";
GRANT USAGE ON SCHEMA "artecna_guardie" TO "service_role";
GRANT USAGE ON SCHEMA "artecna_guardie" TO "artecna_cantieri_delete_rpc";
GRANT USAGE ON SCHEMA "artecna_guardie" TO "artecna_cantieri_rpc";
GRANT USAGE ON SCHEMA "artecna_guardie" TO "artecna_economia_rpc";
GRANT USAGE ON SCHEMA "artecna_guardie" TO "artecna_foto_v1_writer";
GRANT USAGE ON SCHEMA "artecna_guardie" TO "artecna_materiali_fattura_rpc";
GRANT USAGE ON SCHEMA "artecna_guardie" TO "artecna_ponte_economia_rpc";
GRANT USAGE ON SCHEMA "artecna_guardie" TO "artecna_preventivi_rpc";
GRANT USAGE ON SCHEMA "artecna_guardie" TO "artecna_rapportini_rpc";
GRANT USAGE ON SCHEMA "artecna_guardie" TO "artecna_sal_rpc";
GRANT USAGE ON SCHEMA "artecna_guardie" TO "artecna_varianti_rpc";
GRANT USAGE ON SCHEMA "artecna_guardie" TO "artecna_rapportini_backend";
GRANT USAGE ON SCHEMA "artecna_contabilita" TO "anon";
GRANT USAGE ON SCHEMA "artecna_contabilita" TO "authenticated";
GRANT USAGE ON SCHEMA "artecna_contabilita" TO "service_role";
GRANT USAGE ON SCHEMA "artecna_contabilita" TO "artecna_cantieri_delete_rpc";
GRANT USAGE ON SCHEMA "artecna_contabilita" TO "artecna_cantieri_rpc";
GRANT USAGE ON SCHEMA "artecna_contabilita" TO "artecna_economia_rpc";
GRANT USAGE ON SCHEMA "artecna_contabilita" TO "artecna_foto_v1_writer";
GRANT USAGE ON SCHEMA "artecna_contabilita" TO "artecna_materiali_fattura_rpc";
GRANT USAGE ON SCHEMA "artecna_contabilita" TO "artecna_ponte_economia_rpc";
GRANT USAGE ON SCHEMA "artecna_contabilita" TO "artecna_preventivi_rpc";
GRANT USAGE ON SCHEMA "artecna_contabilita" TO "artecna_rapportini_rpc";
GRANT USAGE ON SCHEMA "artecna_contabilita" TO "artecna_sal_rpc";
GRANT USAGE ON SCHEMA "artecna_contabilita" TO "artecna_varianti_rpc";
GRANT USAGE ON SCHEMA "artecna_contabilita" TO "artecna_rapportini_backend";
REVOKE ALL ON TABLE "public"."materiali_cantiere" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."materiali_cantiere" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."materiali_cantiere" TO "anon";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."materiali_cantiere" TO "authenticated";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."materiali_cantiere" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."materiali_cantiere" TO "artecna_cantieri_delete_rpc";
GRANT INSERT ON TABLE "public"."materiali_cantiere" TO "artecna_materiali_fattura_rpc";
REVOKE ALL ON TABLE "public"."fatture_fornitori_righe" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."fatture_fornitori_righe" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."fatture_fornitori_righe" TO "anon";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."fatture_fornitori_righe" TO "authenticated";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."fatture_fornitori_righe" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."fatture_fornitori_righe" TO "artecna_cantieri_delete_rpc";
GRANT SELECT ON TABLE "public"."fatture_fornitori_righe" TO "artecna_materiali_fattura_rpc";
REVOKE ALL ON TABLE "public"."variante_documenti" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."variante_documenti" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."variante_documenti" TO "anon";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."variante_documenti" TO "authenticated";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."variante_documenti" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."variante_documenti" TO "artecna_cantieri_delete_rpc";
REVOKE ALL ON TABLE "public"."rapportini" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."rapportini" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."rapportini" TO "anon";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."rapportini" TO "authenticated";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."rapportini" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."rapportini" TO "artecna_cantieri_delete_rpc";
REVOKE ALL ON TABLE "public"."foto_cantiere" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."foto_cantiere" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."foto_cantiere" TO "anon";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."foto_cantiere" TO "authenticated";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."foto_cantiere" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."foto_cantiere" TO "artecna_cantieri_delete_rpc";
REVOKE ALL ON TABLE "public"."timbrature" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."timbrature" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."timbrature" TO "anon";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."timbrature" TO "authenticated";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."timbrature" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."timbrature" TO "artecna_cantieri_delete_rpc";
REVOKE ALL ON TABLE "public"."attrezzi_cantiere" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."attrezzi_cantiere" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."attrezzi_cantiere" TO "anon";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."attrezzi_cantiere" TO "authenticated";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."attrezzi_cantiere" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."attrezzi_cantiere" TO "artecna_cantieri_delete_rpc";
REVOKE ALL ON TABLE "public"."pagamenti_fornitori" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."pagamenti_fornitori" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."pagamenti_fornitori" TO "anon";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."pagamenti_fornitori" TO "authenticated";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."pagamenti_fornitori" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."pagamenti_fornitori" TO "artecna_cantieri_delete_rpc";
REVOKE ALL ON TABLE "public"."incassi_non_fatturati" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."incassi_non_fatturati" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."incassi_non_fatturati" TO "anon";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."incassi_non_fatturati" TO "authenticated";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."incassi_non_fatturati" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."incassi_non_fatturati" TO "artecna_cantieri_delete_rpc";
REVOKE ALL ON TABLE "public"."fatture_fornitori" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."fatture_fornitori" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."fatture_fornitori" TO "anon";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."fatture_fornitori" TO "authenticated";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."fatture_fornitori" TO "service_role";
GRANT SELECT ON TABLE "public"."fatture_fornitori" TO "artecna_materiali_fattura_rpc";
REVOKE ALL ON TABLE "public"."variante_lavorazioni" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."variante_lavorazioni" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."variante_lavorazioni" TO "anon";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."variante_lavorazioni" TO "authenticated";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."variante_lavorazioni" TO "service_role";
GRANT INSERT,SELECT ON TABLE "public"."variante_lavorazioni" TO "artecna_varianti_rpc";
GRANT SELECT ON TABLE "public"."variante_lavorazioni" TO "artecna_sal_rpc";
GRANT SELECT,DELETE ON TABLE "public"."variante_lavorazioni" TO "artecna_cantieri_delete_rpc";
GRANT INSERT,SELECT ON TABLE "public"."variante_lavorazioni" TO "artecna_ponte_economia_rpc";
REVOKE ALL ON TABLE "public"."variante_sorgenti" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."variante_sorgenti" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."variante_sorgenti" TO "anon";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."variante_sorgenti" TO "authenticated";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."variante_sorgenti" TO "service_role";
GRANT INSERT,SELECT,DELETE ON TABLE "public"."variante_sorgenti" TO "artecna_varianti_rpc";
GRANT SELECT,DELETE ON TABLE "public"."variante_sorgenti" TO "artecna_cantieri_delete_rpc";
GRANT INSERT,SELECT ON TABLE "public"."variante_sorgenti" TO "artecna_ponte_economia_rpc";
REVOKE ALL ON TABLE "public"."preventivi_cantiere" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."preventivi_cantiere" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."preventivi_cantiere" TO "anon";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."preventivi_cantiere" TO "authenticated";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."preventivi_cantiere" TO "service_role";
GRANT SELECT ON TABLE "public"."preventivi_cantiere" TO "artecna_varianti_rpc";
GRANT SELECT,DELETE ON TABLE "public"."preventivi_cantiere" TO "artecna_cantieri_delete_rpc";
GRANT SELECT ON TABLE "public"."preventivi_cantiere" TO "artecna_ponte_economia_rpc";
REVOKE ALL ON TABLE "public"."preventivo_lavorazioni" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."preventivo_lavorazioni" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."preventivo_lavorazioni" TO "anon";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."preventivo_lavorazioni" TO "authenticated";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."preventivo_lavorazioni" TO "service_role";
GRANT SELECT ON TABLE "public"."preventivo_lavorazioni" TO "artecna_varianti_rpc";
GRANT SELECT,DELETE ON TABLE "public"."preventivo_lavorazioni" TO "artecna_cantieri_delete_rpc";
REVOKE ALL ON TABLE "public"."varianti_cantiere" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."varianti_cantiere" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."varianti_cantiere" TO "anon";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."varianti_cantiere" TO "authenticated";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."varianti_cantiere" TO "service_role";
GRANT SELECT ON TABLE "public"."varianti_cantiere" TO "artecna_varianti_rpc";
GRANT SELECT ON TABLE "public"."varianti_cantiere" TO "artecna_sal_rpc";
GRANT SELECT,DELETE ON TABLE "public"."varianti_cantiere" TO "artecna_cantieri_delete_rpc";
GRANT INSERT,SELECT ON TABLE "public"."varianti_cantiere" TO "artecna_ponte_economia_rpc";
REVOKE ALL ON TABLE "public"."cantieri" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."cantieri" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."cantieri" TO "anon";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."cantieri" TO "authenticated";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."cantieri" TO "service_role";
GRANT SELECT ON TABLE "public"."cantieri" TO "artecna_varianti_rpc";
GRANT SELECT ON TABLE "public"."cantieri" TO "artecna_sal_rpc";
GRANT SELECT,DELETE ON TABLE "public"."cantieri" TO "artecna_cantieri_delete_rpc";
GRANT SELECT ON TABLE "public"."cantieri" TO "artecna_ponte_economia_rpc";
GRANT SELECT ON TABLE "public"."cantieri" TO "artecna_materiali_fattura_rpc";
REVOKE ALL ON TABLE "public"."sal_lavorazioni" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."sal_lavorazioni" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."sal_lavorazioni" TO "anon";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."sal_lavorazioni" TO "authenticated";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."sal_lavorazioni" TO "service_role";
GRANT SELECT ON TABLE "public"."sal_lavorazioni" TO "artecna_varianti_rpc";
GRANT SELECT ON TABLE "public"."sal_lavorazioni" TO "artecna_sal_rpc";
GRANT SELECT,DELETE ON TABLE "public"."sal_lavorazioni" TO "artecna_cantieri_delete_rpc";
REVOKE ALL ON TABLE "public"."operai" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."operai" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."operai" TO "anon";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."operai" TO "authenticated";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."operai" TO "service_role";
REVOKE ALL ON TABLE "public"."pagamenti_operai" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."pagamenti_operai" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."pagamenti_operai" TO "anon";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."pagamenti_operai" TO "authenticated";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."pagamenti_operai" TO "service_role";
REVOKE ALL ON TABLE "public"."impostazioni_app" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."impostazioni_app" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."impostazioni_app" TO "anon";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."impostazioni_app" TO "authenticated";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."impostazioni_app" TO "service_role";
REVOKE ALL ON TABLE "public"."spese_impresa" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."spese_impresa" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."spese_impresa" TO "anon";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."spese_impresa" TO "authenticated";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."spese_impresa" TO "service_role";
REVOKE ALL ON TABLE "public"."sopralluoghi" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."sopralluoghi" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."sopralluoghi" TO "anon";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."sopralluoghi" TO "authenticated";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."sopralluoghi" TO "service_role";
REVOKE ALL ON TABLE "public"."foto_sopralluogo" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."foto_sopralluogo" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."foto_sopralluogo" TO "anon";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."foto_sopralluogo" TO "authenticated";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."foto_sopralluogo" TO "service_role";
REVOKE ALL ON TABLE "public"."prezzi_lavorazioni" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."prezzi_lavorazioni" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."prezzi_lavorazioni" TO "anon";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."prezzi_lavorazioni" TO "authenticated";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."prezzi_lavorazioni" TO "service_role";
REVOKE ALL ON TABLE "public"."memoria_prezzi" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."memoria_prezzi" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."memoria_prezzi" TO "anon";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."memoria_prezzi" TO "authenticated";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."memoria_prezzi" TO "service_role";
REVOKE ALL ON TABLE "public"."prezziario_sicilia" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."prezziario_sicilia" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."prezziario_sicilia" TO "anon";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."prezziario_sicilia" TO "authenticated";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."prezziario_sicilia" TO "service_role";
REVOKE ALL ON TABLE "public"."utilizzo_ai" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."utilizzo_ai" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."utilizzo_ai" TO "anon";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."utilizzo_ai" TO "authenticated";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."utilizzo_ai" TO "service_role";
REVOKE ALL ON TABLE "public"."note_sopralluogo" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."note_sopralluogo" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."note_sopralluogo" TO "anon";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."note_sopralluogo" TO "authenticated";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."note_sopralluogo" TO "service_role";
REVOKE ALL ON TABLE "public"."note_allegati" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."note_allegati" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."note_allegati" TO "anon";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."note_allegati" TO "authenticated";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."note_allegati" TO "service_role";
REVOKE ALL ON TABLE "public"."agenda_attivita" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."agenda_attivita" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."agenda_attivita" TO "anon";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."agenda_attivita" TO "authenticated";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."agenda_attivita" TO "service_role";
REVOKE ALL ON TABLE "public"."utenti_cantiere" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."utenti_cantiere" TO "postgres";
GRANT SELECT,DELETE ON TABLE "public"."utenti_cantiere" TO "artecna_cantieri_delete_rpc";
GRANT SELECT ON TABLE "public"."utenti_cantiere" TO "artecna_ponte_economia_rpc";
REVOKE ALL ON TABLE "public"."variante_fonti_visive" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."variante_fonti_visive" TO "postgres";
GRANT SELECT,DELETE ON TABLE "public"."variante_fonti_visive" TO "artecna_cantieri_delete_rpc";
REVOKE ALL ON TABLE "public"."variante_osservatore_analisi" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."variante_osservatore_analisi" TO "postgres";
GRANT SELECT,DELETE ON TABLE "public"."variante_osservatore_analisi" TO "artecna_cantieri_delete_rpc";
REVOKE ALL ON TABLE "public"."economia_raccolte" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."economia_raccolte" TO "postgres";
GRANT INSERT,SELECT ON TABLE "public"."economia_raccolte" TO "artecna_economia_rpc";
GRANT SELECT,DELETE ON TABLE "public"."economia_raccolte" TO "artecna_cantieri_delete_rpc";
GRANT SELECT ON TABLE "public"."economia_raccolte" TO "artecna_ponte_economia_rpc";
REVOKE ALL ON TABLE "public"."economia_sorgenti" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."economia_sorgenti" TO "postgres";
GRANT INSERT,SELECT ON TABLE "public"."economia_sorgenti" TO "artecna_economia_rpc";
GRANT SELECT,DELETE ON TABLE "public"."economia_sorgenti" TO "artecna_cantieri_delete_rpc";
GRANT SELECT ON TABLE "public"."economia_sorgenti" TO "artecna_ponte_economia_rpc";
REVOKE ALL ON TABLE "public"."economia_righe" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."economia_righe" TO "postgres";
GRANT INSERT,SELECT,DELETE ON TABLE "public"."economia_righe" TO "artecna_economia_rpc";
GRANT SELECT,DELETE ON TABLE "public"."economia_righe" TO "artecna_cantieri_delete_rpc";
GRANT SELECT ON TABLE "public"."economia_righe" TO "artecna_ponte_economia_rpc";
REVOKE ALL ON TABLE "artecna_rapportini"."richieste" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "artecna_rapportini"."richieste" TO "postgres";
GRANT INSERT,SELECT ON TABLE "artecna_rapportini"."richieste" TO "artecna_rapportini_rpc";
REVOKE ALL ON TABLE "public"."rapportino_prestazioni" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."rapportino_prestazioni" TO "postgres";
GRANT INSERT,SELECT,UPDATE ON TABLE "public"."rapportino_prestazioni" TO "artecna_rapportini_rpc";
REVOKE ALL ON TABLE "public"."rapportino_materiali" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."rapportino_materiali" TO "postgres";
GRANT INSERT,SELECT,UPDATE ON TABLE "public"."rapportino_materiali" TO "artecna_rapportini_rpc";
REVOKE ALL ON TABLE "public"."quaderno_allegati" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."quaderno_allegati" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."quaderno_allegati" TO "authenticated";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."quaderno_allegati" TO "service_role";
REVOKE ALL ON TABLE "public"."quaderno_progetti" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."quaderno_progetti" TO "postgres";
GRANT INSERT,SELECT,UPDATE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."quaderno_progetti" TO "authenticated";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."quaderno_progetti" TO "service_role";
REVOKE ALL ON TABLE "public"."acconti_cantiere" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."acconti_cantiere" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."acconti_cantiere" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."acconti_cantiere" TO "artecna_cantieri_delete_rpc";
GRANT INSERT,SELECT,UPDATE,DELETE ON TABLE "public"."acconti_cantiere" TO "authenticated";
REVOKE ALL ON TABLE "public"."fatture_emesse" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."fatture_emesse" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."fatture_emesse" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."fatture_emesse" TO "artecna_cantieri_delete_rpc";
GRANT INSERT,SELECT,UPDATE,DELETE ON TABLE "public"."fatture_emesse" TO "authenticated";
REVOKE ALL ON TABLE "public"."variante_fonti_memory" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."variante_fonti_memory" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."variante_fonti_memory" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."variante_fonti_memory" TO "artecna_cantieri_delete_rpc";
REVOKE ALL ON TABLE "public"."quaderno_richiami_sopralluogo" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."quaderno_richiami_sopralluogo" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."quaderno_richiami_sopralluogo" TO "service_role";
GRANT SELECT ON TABLE "public"."quaderno_richiami_sopralluogo" TO "authenticated";
REVOKE ALL ON TABLE "public"."quaderno_gestioni" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."quaderno_gestioni" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."quaderno_gestioni" TO "service_role";
GRANT SELECT ON TABLE "public"."quaderno_gestioni" TO "authenticated";
REVOKE ALL ON TABLE "public"."quaderno_copie_allegati" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."quaderno_copie_allegati" TO "postgres";
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."quaderno_copie_allegati" TO "service_role";
GRANT SELECT,DELETE ON TABLE "public"."quaderno_copie_allegati" TO "authenticated";
REVOKE ALL ON TABLE "artecna_distruzione"."contesto" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "artecna_distruzione"."contesto" TO "postgres";
REVOKE ALL ON TABLE "artecna_distruzione"."cleanup_storage" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "artecna_distruzione"."cleanup_storage" TO "postgres";
REVOKE ALL ON TABLE "artecna_rapportini"."sessioni_portale" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "artecna_rapportini"."sessioni_portale" TO "postgres";
REVOKE ALL ON TABLE "artecna_rapportini"."allegati" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "artecna_rapportini"."allegati" TO "postgres";
REVOKE ALL ON TABLE "artecna_rapportini"."f3c3_capability" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "artecna_rapportini"."f3c3_capability" TO "postgres";
REVOKE ALL ON TABLE "public"."utenti_impresa" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."utenti_impresa" TO "postgres";
REVOKE ALL ON TABLE "public"."materiali_impresa" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."materiali_impresa" TO "postgres";
REVOKE ALL ON TABLE "artecna_guardie"."fatture_classificazione_richieste" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "artecna_guardie"."fatture_classificazione_richieste" TO "postgres";
REVOKE ALL ON TABLE "artecna_contabilita"."attribuzioni_clienti" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "artecna_contabilita"."attribuzioni_clienti" TO "postgres";
REVOKE ALL ON TABLE "public"."fornitori_rettifiche" FROM PUBLIC;
GRANT INSERT,SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON TABLE "public"."fornitori_rettifiche" TO "postgres";
GRANT SELECT ("fattura_riga_id") ON TABLE "public"."materiali_impresa" TO "artecna_cantieri_delete_rpc";
GRANT SELECT ("variante_id") ON TABLE "public"."rapportino_prestazioni" TO "artecna_cantieri_delete_rpc";
GRANT UPDATE ("id") ON TABLE "public"."economia_raccolte" TO "artecna_cantieri_delete_rpc";
GRANT UPDATE ("id") ON TABLE "public"."economia_raccolte" TO "artecna_ponte_economia_rpc";
GRANT UPDATE ("id") ON TABLE "public"."economia_sorgenti" TO "artecna_cantieri_delete_rpc";
GRANT UPDATE ("id") ON TABLE "public"."economia_sorgenti" TO "artecna_ponte_economia_rpc";
GRANT UPDATE ("id") ON TABLE "public"."economia_righe" TO "artecna_cantieri_delete_rpc";
GRANT UPDATE ("id") ON TABLE "public"."economia_righe" TO "artecna_ponte_economia_rpc";
GRANT UPDATE ("cantiere_id") ON TABLE "public"."rapportini" TO "artecna_cantieri_delete_rpc";
GRANT SELECT ("cantiere_id") ON TABLE "public"."rapportini" TO "artecna_rapportini_rpc";
GRANT UPDATE ("cantiere_id") ON TABLE "public"."incassi_non_fatturati" TO "artecna_cantieri_delete_rpc";
GRANT UPDATE ("cantiere_id") ON TABLE "public"."pagamenti_fornitori" TO "artecna_cantieri_delete_rpc";
GRANT UPDATE ("cantiere_id") ON TABLE "public"."fatture_fornitori_righe" TO "artecna_cantieri_delete_rpc";
GRANT UPDATE ("cantiere_id") ON TABLE "public"."fatture_emesse" TO "artecna_cantieri_delete_rpc";
GRANT UPDATE ("cantiere_id") ON TABLE "public"."foto_cantiere" TO "artecna_cantieri_delete_rpc";
GRANT UPDATE ("cantiere_id") ON TABLE "public"."materiali_cantiere" TO "artecna_cantieri_delete_rpc";
GRANT UPDATE ("cantiere_id") ON TABLE "public"."attrezzi_cantiere" TO "artecna_cantieri_delete_rpc";
GRANT UPDATE ("cantiere_id") ON TABLE "public"."timbrature" TO "artecna_cantieri_delete_rpc";
GRANT UPDATE ("cantiere_id") ON TABLE "public"."acconti_cantiere" TO "artecna_cantieri_delete_rpc";
GRANT UPDATE ("variante_id") ON TABLE "public"."variante_fonti_memory" TO "artecna_cantieri_delete_rpc";
GRANT UPDATE ("variante_id") ON TABLE "public"."variante_fonti_visive" TO "artecna_cantieri_delete_rpc";
GRANT UPDATE ("variante_id") ON TABLE "public"."variante_documenti" TO "artecna_cantieri_delete_rpc";
GRANT UPDATE ("variante_id") ON TABLE "public"."variante_sorgenti" TO "artecna_cantieri_delete_rpc";
GRANT UPDATE ("variante_id") ON TABLE "public"."variante_osservatore_analisi" TO "artecna_cantieri_delete_rpc";
GRANT INSERT ("preventivo"),SELECT ("preventivo") ON TABLE "public"."cantieri" TO "artecna_cantieri_rpc";
GRANT SELECT ("created_at") ON TABLE "public"."cantieri" TO "artecna_cantieri_rpc";
GRANT SELECT ("lavori_conclusi") ON TABLE "public"."cantieri" TO "artecna_cantieri_rpc";
GRANT UPDATE ("chiusa_at") ON TABLE "public"."economia_raccolte" TO "artecna_economia_rpc";
GRANT UPDATE ("data") ON TABLE "public"."economia_raccolte" TO "artecna_economia_rpc";
GRANT UPDATE ("descrizione") ON TABLE "public"."economia_righe" TO "artecna_economia_rpc";
GRANT UPDATE ("dettagli_analitici") ON TABLE "public"."economia_righe" TO "artecna_economia_rpc";
GRANT UPDATE ("note") ON TABLE "public"."economia_raccolte" TO "artecna_economia_rpc";
GRANT UPDATE ("note") ON TABLE "public"."economia_righe" TO "artecna_economia_rpc";
GRANT UPDATE ("ordine") ON TABLE "public"."economia_righe" TO "artecna_economia_rpc";
GRANT UPDATE ("prezzo_unitario") ON TABLE "public"."economia_righe" TO "artecna_economia_rpc";
GRANT UPDATE ("quantita") ON TABLE "public"."economia_righe" TO "artecna_economia_rpc";
GRANT UPDATE ("revisione") ON TABLE "public"."economia_raccolte" TO "artecna_economia_rpc";
GRANT UPDATE ("stato") ON TABLE "public"."economia_raccolte" TO "artecna_economia_rpc";
GRANT UPDATE ("tipo_riga") ON TABLE "public"."economia_righe" TO "artecna_economia_rpc";
GRANT UPDATE ("titolo") ON TABLE "public"."economia_raccolte" TO "artecna_economia_rpc";
GRANT UPDATE ("unita_misura") ON TABLE "public"."economia_righe" TO "artecna_economia_rpc";
GRANT UPDATE ("updated_at") ON TABLE "public"."economia_raccolte" TO "artecna_economia_rpc";
GRANT UPDATE ("updated_at") ON TABLE "public"."economia_righe" TO "artecna_economia_rpc";
GRANT SELECT ("id") ON TABLE "public"."materiali_cantiere" TO "artecna_materiali_fattura_rpc";
GRANT INSERT ("descrizione"),SELECT ("descrizione") ON TABLE "public"."preventivo_lavorazioni" TO "artecna_preventivi_rpc";
GRANT SELECT ("descrizione") ON TABLE "public"."preventivo_lavorazioni" TO "artecna_sal_rpc";
GRANT SELECT ("descrizione") ON TABLE "public"."preventivo_lavorazioni" TO "artecna_varianti_rpc";
GRANT INSERT ("approvato"),SELECT ("approvato") ON TABLE "public"."preventivi_cantiere" TO "artecna_preventivi_rpc";
GRANT INSERT ("approvato") ON TABLE "public"."preventivi_cantiere" TO "artecna_varianti_rpc";
GRANT INSERT ("cantiere"),SELECT ("cantiere") ON TABLE "public"."preventivi_cantiere" TO "artecna_preventivi_rpc";
GRANT INSERT ("cantiere") ON TABLE "public"."preventivi_cantiere" TO "artecna_varianti_rpc";
GRANT INSERT ("note"),SELECT ("note") ON TABLE "public"."preventivi_cantiere" TO "artecna_preventivi_rpc";
GRANT INSERT ("note") ON TABLE "public"."preventivi_cantiere" TO "artecna_varianti_rpc";
GRANT INSERT ("stato_preventivo"),SELECT ("stato_preventivo") ON TABLE "public"."preventivi_cantiere" TO "artecna_preventivi_rpc";
GRANT INSERT ("stato_preventivo") ON TABLE "public"."preventivi_cantiere" TO "artecna_varianti_rpc";
GRANT INSERT ("importo_totale"),SELECT ("importo_totale") ON TABLE "public"."preventivi_cantiere" TO "artecna_preventivi_rpc";
GRANT INSERT ("importo_totale"),SELECT ("importo_totale") ON TABLE "public"."preventivi_cantiere" TO "artecna_varianti_rpc";
GRANT INSERT ("nome_file"),SELECT ("nome_file") ON TABLE "public"."preventivi_cantiere" TO "artecna_preventivi_rpc";
GRANT INSERT ("nome_file"),SELECT ("nome_file"),UPDATE ("nome_file") ON TABLE "public"."preventivi_cantiere" TO "artecna_varianti_rpc";
GRANT INSERT ("anteprima_testo"),SELECT ("anteprima_testo") ON TABLE "public"."preventivi_cantiere" TO "artecna_preventivi_rpc";
GRANT INSERT ("archiviazione_key"),SELECT ("archiviazione_key") ON TABLE "public"."preventivi_cantiere" TO "artecna_preventivi_rpc";
GRANT INSERT ("archiviazione_payload_hash"),SELECT ("archiviazione_payload_hash") ON TABLE "public"."preventivi_cantiere" TO "artecna_preventivi_rpc";
GRANT INSERT ("cantiere"),SELECT ("cantiere") ON TABLE "public"."preventivo_lavorazioni" TO "artecna_preventivi_rpc";
GRANT INSERT ("file_path"),SELECT ("file_path") ON TABLE "public"."preventivi_cantiere" TO "artecna_preventivi_rpc";
GRANT INSERT ("file_tipo"),SELECT ("file_tipo") ON TABLE "public"."preventivi_cantiere" TO "artecna_preventivi_rpc";
GRANT INSERT ("file_url"),SELECT ("file_url") ON TABLE "public"."preventivi_cantiere" TO "artecna_preventivi_rpc";
GRANT INSERT ("fonte"),SELECT ("fonte") ON TABLE "public"."preventivo_lavorazioni" TO "artecna_preventivi_rpc";
GRANT SELECT ("nome") ON TABLE "public"."cantieri" TO "artecna_preventivi_rpc";
GRANT INSERT ("nome"),SELECT ("nome") ON TABLE "public"."cantieri" TO "artecna_cantieri_rpc";
GRANT SELECT ("nome") ON TABLE "public"."cantieri" TO "artecna_varianti_rpc";
GRANT SELECT ("data") ON TABLE "public"."rapportini" TO "artecna_rapportini_rpc";
GRANT SELECT ("id") ON TABLE "public"."rapportini" TO "artecna_rapportini_rpc";
GRANT SELECT ("id") ON TABLE "public"."operai" TO "artecna_rapportini_rpc";
GRANT SELECT ("revisione_prestazioni"),UPDATE ("revisione_prestazioni") ON TABLE "public"."rapportini" TO "artecna_rapportini_rpc";
GRANT SELECT ("versione_materiali"),UPDATE ("versione_materiali") ON TABLE "public"."rapportini" TO "artecna_rapportini_rpc";
GRANT SELECT ("versione_prestazioni"),UPDATE ("versione_prestazioni") ON TABLE "public"."rapportini" TO "artecna_rapportini_rpc";
GRANT INSERT ("cantiere") ON TABLE "public"."sal_lavorazioni" TO "artecna_sal_rpc";
GRANT INSERT ("descrizione") ON TABLE "public"."sal_lavorazioni" TO "artecna_sal_rpc";
GRANT INSERT ("note") ON TABLE "public"."sal_lavorazioni" TO "artecna_sal_rpc";
GRANT INSERT ("cantiere_id"),SELECT ("cantiere_id") ON TABLE "public"."sal_lavorazioni" TO "artecna_sal_rpc";
GRANT UPDATE ("cantiere_id") ON TABLE "public"."sal_lavorazioni" TO "artecna_cantieri_delete_rpc";
GRANT INSERT ("importo_previsto"),SELECT ("importo_previsto") ON TABLE "public"."sal_lavorazioni" TO "artecna_sal_rpc";
GRANT INSERT ("source_variante_lavorazione_id"),SELECT ("source_variante_lavorazione_id") ON TABLE "public"."sal_lavorazioni" TO "artecna_sal_rpc";
GRANT INSERT ("completata"),SELECT ("completata"),UPDATE ("completata") ON TABLE "public"."sal_lavorazioni" TO "artecna_sal_rpc";
GRANT INSERT ("data_aggiornamento"),SELECT ("data_aggiornamento"),UPDATE ("data_aggiornamento") ON TABLE "public"."sal_lavorazioni" TO "artecna_sal_rpc";
GRANT INSERT ("importo_maturato"),SELECT ("importo_maturato"),UPDATE ("importo_maturato") ON TABLE "public"."sal_lavorazioni" TO "artecna_sal_rpc";
GRANT INSERT ("percentuale"),SELECT ("percentuale"),UPDATE ("percentuale") ON TABLE "public"."sal_lavorazioni" TO "artecna_sal_rpc";
GRANT SELECT ("preventivo_contrattuale_id") ON TABLE "public"."cantieri" TO "artecna_sal_rpc";
GRANT UPDATE ("preventivo_contrattuale_id") ON TABLE "public"."cantieri" TO "artecna_cantieri_delete_rpc";
GRANT SELECT ("id") ON TABLE "public"."varianti_cantiere" TO "artecna_sal_rpc";
GRANT UPDATE ("id") ON TABLE "public"."varianti_cantiere" TO "artecna_ponte_economia_rpc";
GRANT SELECT ("cantiere_id") ON TABLE "public"."preventivi_cantiere" TO "artecna_sal_rpc";
GRANT INSERT ("cantiere_id"),SELECT ("cantiere_id") ON TABLE "public"."preventivi_cantiere" TO "artecna_preventivi_rpc";
GRANT UPDATE ("cantiere_id") ON TABLE "public"."preventivi_cantiere" TO "artecna_cantieri_delete_rpc";
GRANT INSERT ("cantiere_id"),SELECT ("cantiere_id") ON TABLE "public"."preventivi_cantiere" TO "artecna_varianti_rpc";
GRANT SELECT ("cantiere_id") ON TABLE "public"."preventivo_lavorazioni" TO "artecna_sal_rpc";
GRANT INSERT ("cantiere_id"),SELECT ("cantiere_id") ON TABLE "public"."preventivo_lavorazioni" TO "artecna_preventivi_rpc";
GRANT UPDATE ("cantiere_id") ON TABLE "public"."preventivo_lavorazioni" TO "artecna_cantieri_delete_rpc";
GRANT SELECT ("cantiere_id") ON TABLE "public"."preventivo_lavorazioni" TO "artecna_varianti_rpc";
GRANT SELECT ("importo_previsto") ON TABLE "public"."preventivo_lavorazioni" TO "artecna_sal_rpc";
GRANT INSERT ("importo_previsto"),SELECT ("importo_previsto") ON TABLE "public"."preventivo_lavorazioni" TO "artecna_preventivi_rpc";
GRANT SELECT ("importo_previsto") ON TABLE "public"."preventivo_lavorazioni" TO "artecna_varianti_rpc";
GRANT SELECT ("preventivo_id") ON TABLE "public"."preventivo_lavorazioni" TO "artecna_sal_rpc";
GRANT INSERT ("preventivo_id"),SELECT ("preventivo_id") ON TABLE "public"."preventivo_lavorazioni" TO "artecna_preventivi_rpc";
GRANT SELECT ("preventivo_id") ON TABLE "public"."preventivo_lavorazioni" TO "artecna_varianti_rpc";
GRANT SELECT ("prezzo_unitario") ON TABLE "public"."preventivo_lavorazioni" TO "artecna_sal_rpc";
GRANT INSERT ("prezzo_unitario"),SELECT ("prezzo_unitario") ON TABLE "public"."preventivo_lavorazioni" TO "artecna_preventivi_rpc";
GRANT SELECT ("prezzo_unitario") ON TABLE "public"."preventivo_lavorazioni" TO "artecna_varianti_rpc";
GRANT SELECT ("quantita") ON TABLE "public"."preventivo_lavorazioni" TO "artecna_sal_rpc";
GRANT INSERT ("quantita"),SELECT ("quantita") ON TABLE "public"."preventivo_lavorazioni" TO "artecna_preventivi_rpc";
GRANT SELECT ("quantita") ON TABLE "public"."preventivo_lavorazioni" TO "artecna_varianti_rpc";
GRANT SELECT ("unita_misura") ON TABLE "public"."preventivo_lavorazioni" TO "artecna_sal_rpc";
GRANT INSERT ("unita_misura"),SELECT ("unita_misura") ON TABLE "public"."preventivo_lavorazioni" TO "artecna_preventivi_rpc";
GRANT SELECT ("unita_misura") ON TABLE "public"."preventivo_lavorazioni" TO "artecna_varianti_rpc";
GRANT SELECT ("cantiere_id") ON TABLE "public"."varianti_cantiere" TO "artecna_sal_rpc";
GRANT INSERT ("cantiere_id") ON TABLE "public"."varianti_cantiere" TO "artecna_varianti_rpc";
GRANT UPDATE ("cantiere_id") ON TABLE "public"."varianti_cantiere" TO "artecna_cantieri_delete_rpc";
GRANT SELECT ("variante_id") ON TABLE "public"."variante_lavorazioni" TO "artecna_sal_rpc";
GRANT INSERT ("variante_id") ON TABLE "public"."variante_lavorazioni" TO "artecna_varianti_rpc";
GRANT UPDATE ("variante_id") ON TABLE "public"."variante_lavorazioni" TO "artecna_cantieri_delete_rpc";
GRANT SELECT ("delta_contratto") ON TABLE "public"."variante_lavorazioni" TO "artecna_sal_rpc";
GRANT INSERT ("delta_contratto") ON TABLE "public"."variante_lavorazioni" TO "artecna_varianti_rpc";
GRANT SELECT ("operazione") ON TABLE "public"."variante_lavorazioni" TO "artecna_sal_rpc";
GRANT INSERT ("operazione") ON TABLE "public"."variante_lavorazioni" TO "artecna_varianti_rpc";
GRANT SELECT ("preventivo_contrattuale_id") ON TABLE "public"."varianti_cantiere" TO "artecna_sal_rpc";
GRANT INSERT ("preventivo_contrattuale_id") ON TABLE "public"."varianti_cantiere" TO "artecna_varianti_rpc";
GRANT SELECT ("prezzo_unitario") ON TABLE "public"."variante_lavorazioni" TO "artecna_sal_rpc";
GRANT INSERT ("prezzo_unitario") ON TABLE "public"."variante_lavorazioni" TO "artecna_varianti_rpc";
GRANT SELECT ("quantita_delta") ON TABLE "public"."variante_lavorazioni" TO "artecna_sal_rpc";
GRANT INSERT ("quantita_delta") ON TABLE "public"."variante_lavorazioni" TO "artecna_varianti_rpc";
GRANT SELECT ("unita_misura") ON TABLE "public"."variante_lavorazioni" TO "artecna_sal_rpc";
GRANT INSERT ("unita_misura") ON TABLE "public"."variante_lavorazioni" TO "artecna_varianti_rpc";
GRANT SELECT ("cantiere_id") ON TABLE "public"."utenti_cantiere" TO "artecna_sal_rpc";
GRANT SELECT ("cantiere_id") ON TABLE "public"."utenti_cantiere" TO "artecna_varianti_rpc";
GRANT SELECT ("cantiere_id") ON TABLE "public"."utenti_cantiere" TO "artecna_preventivi_rpc";
GRANT INSERT ("cantiere_id"),SELECT ("cantiere_id") ON TABLE "public"."utenti_cantiere" TO "artecna_cantieri_rpc";
GRANT UPDATE ("cantiere_id") ON TABLE "public"."utenti_cantiere" TO "artecna_cantieri_delete_rpc";
GRANT SELECT ("cantiere_id") ON TABLE "public"."utenti_cantiere" TO "artecna_economia_rpc";
GRANT SELECT ("cantiere_id") ON TABLE "public"."utenti_cantiere" TO "artecna_rapportini_rpc";
GRANT SELECT ("ruolo") ON TABLE "public"."utenti_cantiere" TO "artecna_sal_rpc";
GRANT SELECT ("ruolo") ON TABLE "public"."utenti_cantiere" TO "artecna_varianti_rpc";
GRANT SELECT ("ruolo") ON TABLE "public"."utenti_cantiere" TO "artecna_preventivi_rpc";
GRANT INSERT ("ruolo"),SELECT ("ruolo") ON TABLE "public"."utenti_cantiere" TO "artecna_cantieri_rpc";
GRANT SELECT ("ruolo") ON TABLE "public"."utenti_cantiere" TO "artecna_economia_rpc";
GRANT SELECT ("ruolo") ON TABLE "public"."utenti_cantiere" TO "artecna_rapportini_rpc";
GRANT SELECT ("user_id") ON TABLE "public"."utenti_cantiere" TO "artecna_sal_rpc";
GRANT SELECT ("user_id") ON TABLE "public"."utenti_cantiere" TO "artecna_varianti_rpc";
GRANT SELECT ("user_id") ON TABLE "public"."utenti_cantiere" TO "artecna_preventivi_rpc";
GRANT INSERT ("user_id"),SELECT ("user_id") ON TABLE "public"."utenti_cantiere" TO "artecna_cantieri_rpc";
GRANT SELECT ("user_id"),UPDATE ("user_id") ON TABLE "public"."utenti_cantiere" TO "artecna_economia_rpc";
GRANT SELECT ("user_id") ON TABLE "public"."utenti_cantiere" TO "artecna_rapportini_rpc";
GRANT UPDATE ("user_id") ON TABLE "public"."utenti_cantiere" TO "artecna_ponte_economia_rpc";
GRANT SELECT ("id") ON TABLE "public"."variante_lavorazioni" TO "artecna_sal_rpc";
GRANT SELECT ("id") ON TABLE "public"."sal_lavorazioni" TO "artecna_sal_rpc";
GRANT SELECT ("riferimento_preventivo_lavorazione_id") ON TABLE "public"."variante_lavorazioni" TO "artecna_sal_rpc";
GRANT SELECT ("riferimento_variante_lavorazione_id") ON TABLE "public"."variante_lavorazioni" TO "artecna_sal_rpc";
GRANT SELECT ("source_lavorazione_id") ON TABLE "public"."sal_lavorazioni" TO "artecna_sal_rpc";
GRANT SELECT ("id"),UPDATE ("id") ON TABLE "public"."preventivi_cantiere" TO "artecna_sal_rpc";
GRANT INSERT ("id"),SELECT ("id") ON TABLE "public"."preventivi_cantiere" TO "artecna_preventivi_rpc";
GRANT INSERT ("id"),SELECT ("id") ON TABLE "public"."preventivi_cantiere" TO "artecna_varianti_rpc";
GRANT SELECT ("id"),UPDATE ("id") ON TABLE "public"."preventivo_lavorazioni" TO "artecna_sal_rpc";
GRANT SELECT ("id") ON TABLE "public"."preventivo_lavorazioni" TO "artecna_preventivi_rpc";
GRANT SELECT ("id") ON TABLE "public"."preventivo_lavorazioni" TO "artecna_varianti_rpc";
GRANT INSERT ("titolo") ON TABLE "public"."varianti_cantiere" TO "artecna_varianti_rpc";
GRANT UPDATE ("titolo") ON TABLE "public"."varianti_cantiere" TO "artecna_cantieri_delete_rpc";
GRANT INSERT ("data_variante") ON TABLE "public"."varianti_cantiere" TO "artecna_varianti_rpc";
GRANT INSERT ("descrizione_ai") ON TABLE "public"."preventivi_cantiere" TO "artecna_varianti_rpc";
GRANT INSERT ("descrizione") ON TABLE "public"."varianti_cantiere" TO "artecna_varianti_rpc";
GRANT INSERT ("descrizione") ON TABLE "public"."variante_lavorazioni" TO "artecna_varianti_rpc";
GRANT INSERT ("numero_riga") ON TABLE "public"."variante_lavorazioni" TO "artecna_varianti_rpc";
GRANT INSERT ("natura"),SELECT ("natura") ON TABLE "public"."preventivi_cantiere" TO "artecna_varianti_rpc";
GRANT SELECT ("natura") ON TABLE "public"."preventivi_cantiere" TO "artecna_cantieri_delete_rpc";
GRANT INSERT ("preventivo_contrattuale_id"),SELECT ("preventivo_contrattuale_id") ON TABLE "public"."preventivi_cantiere" TO "artecna_varianti_rpc";
GRANT SELECT ("preventivo_contrattuale_id") ON TABLE "public"."preventivi_cantiere" TO "artecna_cantieri_delete_rpc";
GRANT INSERT ("variante_id"),SELECT ("variante_id") ON TABLE "public"."preventivi_cantiere" TO "artecna_varianti_rpc";
GRANT SELECT ("variante_id") ON TABLE "public"."preventivi_cantiere" TO "artecna_cantieri_delete_rpc";
GRANT INSERT ("json_voci_ai"),SELECT ("json_voci_ai") ON TABLE "public"."preventivi_cantiere" TO "artecna_varianti_rpc";
GRANT INSERT ("sopralluogo_id"),SELECT ("sopralluogo_id") ON TABLE "public"."preventivi_cantiere" TO "artecna_varianti_rpc";
GRANT INSERT ("data_preventivo"),SELECT ("data_preventivo"),UPDATE ("data_preventivo") ON TABLE "public"."preventivi_cantiere" TO "artecna_varianti_rpc";
GRANT INSERT ("provenienza_generazione"),SELECT ("provenienza_generazione"),UPDATE ("provenienza_generazione") ON TABLE "public"."preventivi_cantiere" TO "artecna_varianti_rpc";
GRANT INSERT ("origine_ai"),UPDATE ("origine_ai") ON TABLE "public"."preventivi_cantiere" TO "artecna_varianti_rpc";
GRANT SELECT ("cliente_ai"),UPDATE ("cliente_ai") ON TABLE "public"."preventivi_cantiere" TO "artecna_varianti_rpc";
GRANT UPDATE ("stato") ON TABLE "public"."varianti_cantiere" TO "artecna_varianti_rpc";
GRANT SELECT ("stato") ON TABLE "public"."varianti_cantiere" TO "artecna_sal_rpc";
GRANT UPDATE ("id") ON TABLE "public"."cantieri" TO "artecna_varianti_rpc";
GRANT SELECT ("id"),UPDATE ("id") ON TABLE "public"."cantieri" TO "artecna_sal_rpc";
GRANT SELECT ("id"),UPDATE ("id") ON TABLE "public"."cantieri" TO "artecna_preventivi_rpc";
GRANT INSERT ("id"),SELECT ("id") ON TABLE "public"."cantieri" TO "artecna_cantieri_rpc";
GRANT SELECT ("id"),UPDATE ("id") ON TABLE "public"."cantieri" TO "artecna_economia_rpc";
GRANT UPDATE ("id") ON TABLE "public"."cantieri" TO "artecna_ponte_economia_rpc";
GRANT UPDATE ("approvata_at") ON TABLE "public"."varianti_cantiere" TO "artecna_varianti_rpc";
GRANT UPDATE ("importo_delta_approvato") ON TABLE "public"."varianti_cantiere" TO "artecna_varianti_rpc";
GRANT UPDATE ("numero") ON TABLE "public"."varianti_cantiere" TO "artecna_varianti_rpc";
GRANT UPDATE ("riferimento_approvazione") ON TABLE "public"."varianti_cantiere" TO "artecna_varianti_rpc";
GRANT UPDATE ("updated_at") ON TABLE "public"."varianti_cantiere" TO "artecna_varianti_rpc";
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO "postgres";
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO "anon";
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO "authenticated";
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO "service_role";
REVOKE ALL ON FUNCTION public.elimina_cantiere_definitivamente(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.elimina_cantiere_definitivamente(uuid,text) TO "artecna_cantieri_delete_rpc";
GRANT EXECUTE ON FUNCTION public.elimina_cantiere_definitivamente(uuid,text) TO "authenticated";
REVOKE ALL ON FUNCTION public.verifica_bozza_vuota(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verifica_bozza_vuota(text,uuid) TO "artecna_cantieri_delete_rpc";
GRANT EXECUTE ON FUNCTION public.verifica_bozza_vuota(text,uuid) TO "authenticated";
REVOKE ALL ON FUNCTION public.elimina_bozza_vuota(text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.elimina_bozza_vuota(text,uuid,text) TO "artecna_cantieri_delete_rpc";
GRANT EXECUTE ON FUNCTION public.elimina_bozza_vuota(text,uuid,text) TO "authenticated";
REVOKE ALL ON FUNCTION public.rinomina_variante_bozza(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rinomina_variante_bozza(uuid,text) TO "artecna_cantieri_delete_rpc";
GRANT EXECUTE ON FUNCTION public.rinomina_variante_bozza(uuid,text) TO "authenticated";
REVOKE ALL ON FUNCTION artecna_guardie.controlla_bozza_vuota(text,uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.controlla_bozza_vuota(text,uuid,boolean) TO "artecna_cantieri_delete_rpc";
REVOKE ALL ON FUNCTION public.crea_cantiere_con_owner(text,double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crea_cantiere_con_owner(text,double precision) TO "artecna_cantieri_rpc";
GRANT EXECUTE ON FUNCTION public.crea_cantiere_con_owner(text,double precision) TO "authenticated";
REVOKE ALL ON FUNCTION public.chiudi_raccolta_economia(uuid,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.chiudi_raccolta_economia(uuid,bigint) TO "artecna_economia_rpc";
GRANT EXECUTE ON FUNCTION public.chiudi_raccolta_economia(uuid,bigint) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.chiudi_raccolta_economia(uuid,bigint) TO "artecna_ponte_economia_rpc";
REVOKE ALL ON FUNCTION public.crea_raccolta_economia(uuid,text,date,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crea_raccolta_economia(uuid,text,date,text) TO "artecna_economia_rpc";
GRANT EXECUTE ON FUNCTION public.crea_raccolta_economia(uuid,text,date,text) TO "authenticated";
REVOKE ALL ON FUNCTION public.leggi_raccolte_economia(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leggi_raccolte_economia(uuid) TO "artecna_economia_rpc";
GRANT EXECUTE ON FUNCTION public.leggi_raccolte_economia(uuid) TO "authenticated";
REVOKE ALL ON FUNCTION public.leggi_raccolta_economia(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leggi_raccolta_economia(uuid) TO "artecna_economia_rpc";
GRANT EXECUTE ON FUNCTION public.leggi_raccolta_economia(uuid) TO "authenticated";
REVOKE ALL ON FUNCTION public.salva_bozza_economia(uuid,bigint,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salva_bozza_economia(uuid,bigint,jsonb) TO "artecna_economia_rpc";
GRANT EXECUTE ON FUNCTION public.salva_bozza_economia(uuid,bigint,jsonb) TO "authenticated";
REVOKE ALL ON FUNCTION artecna_rapportini.crea_proiezione_foto_v1(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_rapportini.crea_proiezione_foto_v1(uuid,uuid) TO "artecna_foto_v1_writer";
GRANT EXECUTE ON FUNCTION artecna_rapportini.crea_proiezione_foto_v1(uuid,uuid) TO "postgres";
REVOKE ALL ON FUNCTION public.assegna_materiale_fattura_cantiere(uuid,uuid,numeric,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assegna_materiale_fattura_cantiere(uuid,uuid,numeric,text) TO "artecna_materiali_fattura_rpc";
GRANT EXECUTE ON FUNCTION public.assegna_materiale_fattura_cantiere(uuid,uuid,numeric,text) TO "authenticated";
REVOKE ALL ON FUNCTION public.usa_raccolta_economia_in_variante(uuid,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.usa_raccolta_economia_in_variante(uuid,bigint) TO "artecna_ponte_economia_rpc";
GRANT EXECUTE ON FUNCTION public.usa_raccolta_economia_in_variante(uuid,bigint) TO "authenticated";
REVOKE ALL ON FUNCTION artecna_guardie.verifica_acquisizione_economia(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.verifica_acquisizione_economia(uuid,jsonb) TO "artecna_ponte_economia_rpc";
REVOKE ALL ON FUNCTION public.archivia_preventivo_strutturato(uuid,uuid,text,text,text,text,text,numeric,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archivia_preventivo_strutturato(uuid,uuid,text,text,text,text,text,numeric,jsonb) TO "artecna_preventivi_rpc";
GRANT EXECUTE ON FUNCTION public.archivia_preventivo_strutturato(uuid,uuid,text,text,text,text,text,numeric,jsonb) TO "authenticated";
REVOKE ALL ON FUNCTION public.struttura_preventivo_esistente(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.struttura_preventivo_esistente(uuid,jsonb) TO "artecna_preventivi_rpc";
GRANT EXECUTE ON FUNCTION public.struttura_preventivo_esistente(uuid,jsonb) TO "authenticated";
REVOKE ALL ON FUNCTION artecna_rapportini.applica_materiali_contratto_due(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_rapportini.applica_materiali_contratto_due(uuid,jsonb) TO "artecna_rapportini_rpc";
GRANT EXECUTE ON FUNCTION artecna_rapportini.applica_materiali_contratto_due(uuid,jsonb) TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.calcola_residuo_componente(text,bigint,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.calcola_residuo_componente(text,bigint,uuid,uuid) TO "artecna_sal_rpc";
GRANT EXECUTE ON FUNCTION artecna_guardie.calcola_residuo_componente(text,bigint,uuid,uuid) TO "artecna_varianti_rpc";
REVOKE ALL ON FUNCTION public.importa_variante_approvata_nel_sal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.importa_variante_approvata_nel_sal(uuid) TO "artecna_sal_rpc";
GRANT EXECUTE ON FUNCTION public.importa_variante_approvata_nel_sal(uuid) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.importa_variante_approvata_nel_sal(uuid) TO "artecna_varianti_rpc";
REVOKE ALL ON FUNCTION public.aggiorna_avanzamento_sal(bigint,numeric,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aggiorna_avanzamento_sal(bigint,numeric,boolean) TO "artecna_sal_rpc";
GRANT EXECUTE ON FUNCTION public.aggiorna_avanzamento_sal(bigint,numeric,boolean) TO "authenticated";
REVOKE ALL ON FUNCTION public.proponi_variante(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proponi_variante(uuid) TO "artecna_varianti_rpc";
GRANT EXECUTE ON FUNCTION public.proponi_variante(uuid) TO "authenticated";
REVOKE ALL ON FUNCTION public.crea_bozza_variante(uuid,text,text,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crea_bozza_variante(uuid,text,text,date) TO "artecna_varianti_rpc";
GRANT EXECUTE ON FUNCTION public.crea_bozza_variante(uuid,text,text,date) TO "authenticated";
REVOKE ALL ON FUNCTION public.leggi_varianti_cantiere(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leggi_varianti_cantiere(uuid) TO "artecna_varianti_rpc";
GRANT EXECUTE ON FUNCTION public.leggi_varianti_cantiere(uuid) TO "authenticated";
REVOKE ALL ON FUNCTION public.aggiungi_lavorazione_variante(uuid,text,text,numeric,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aggiungi_lavorazione_variante(uuid,text,text,numeric,numeric) TO "artecna_varianti_rpc";
GRANT EXECUTE ON FUNCTION public.aggiungi_lavorazione_variante(uuid,text,text,numeric,numeric) TO "authenticated";
REVOKE ALL ON FUNCTION public.leggi_lavorazioni_variante(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leggi_lavorazioni_variante(uuid) TO "artecna_varianti_rpc";
GRANT EXECUTE ON FUNCTION public.leggi_lavorazioni_variante(uuid) TO "authenticated";
REVOKE ALL ON FUNCTION public.approva_variante(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approva_variante(uuid,text) TO "artecna_varianti_rpc";
GRANT EXECUTE ON FUNCTION public.approva_variante(uuid,text) TO "authenticated";
REVOKE ALL ON FUNCTION public.aggiungi_sorgente_variante(uuid,text,uuid,text,text,text,text,integer,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aggiungi_sorgente_variante(uuid,text,uuid,text,text,text,text,integer,jsonb) TO "artecna_varianti_rpc";
GRANT EXECUTE ON FUNCTION public.aggiungi_sorgente_variante(uuid,text,uuid,text,text,text,text,integer,jsonb) TO "authenticated";
REVOKE ALL ON FUNCTION public.leggi_sorgenti_variante(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leggi_sorgenti_variante(uuid) TO "artecna_varianti_rpc";
GRANT EXECUTE ON FUNCTION public.leggi_sorgenti_variante(uuid) TO "authenticated";
REVOKE ALL ON FUNCTION public.leggi_sorgente_variante(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leggi_sorgente_variante(uuid) TO "artecna_varianti_rpc";
GRANT EXECUTE ON FUNCTION public.leggi_sorgente_variante(uuid) TO "authenticated";
REVOKE ALL ON FUNCTION public.rimuovi_sorgente_variante(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rimuovi_sorgente_variante(uuid) TO "artecna_varianti_rpc";
GRANT EXECUTE ON FUNCTION public.rimuovi_sorgente_variante(uuid) TO "authenticated";
REVOKE ALL ON FUNCTION public.conferma_preventivo_integrativo(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.conferma_preventivo_integrativo(uuid,jsonb) TO "artecna_varianti_rpc";
GRANT EXECUTE ON FUNCTION public.conferma_preventivo_integrativo(uuid,jsonb) TO "authenticated";
REVOKE ALL ON FUNCTION public.aggiungi_correzione_variante(uuid,text,bigint,text,numeric,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aggiungi_correzione_variante(uuid,text,bigint,text,numeric,text) TO "artecna_varianti_rpc";
GRANT EXECUTE ON FUNCTION public.aggiungi_correzione_variante(uuid,text,bigint,text,numeric,text) TO "authenticated";
REVOKE ALL ON FUNCTION public.leggi_contesto_preventivo_integrativo(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leggi_contesto_preventivo_integrativo(uuid) TO "artecna_varianti_rpc";
GRANT EXECUTE ON FUNCTION public.leggi_contesto_preventivo_integrativo(uuid) TO "authenticated";
REVOKE ALL ON FUNCTION public.salva_preventivo_integrativo_generato(uuid,uuid,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salva_preventivo_integrativo_generato(uuid,uuid,text,text,jsonb) TO "artecna_varianti_rpc";
GRANT EXECUTE ON FUNCTION public.salva_preventivo_integrativo_generato(uuid,uuid,text,text,jsonb) TO "authenticated";
REVOKE ALL ON FUNCTION public.salva_preventivo_integrativo_manuale(uuid,uuid,text,text,jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salva_preventivo_integrativo_manuale(uuid,uuid,text,text,jsonb,jsonb) TO "artecna_varianti_rpc";
GRANT EXECUTE ON FUNCTION public.salva_preventivo_integrativo_manuale(uuid,uuid,text,text,jsonb,jsonb) TO "authenticated";
REVOKE ALL ON FUNCTION artecna_guardie.valida_correzioni_variante(uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.valida_correzioni_variante(uuid,uuid,uuid) TO "artecna_varianti_rpc";
REVOKE ALL ON FUNCTION public.valorizza_manodopera_economia(uuid,numeric,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.valorizza_manodopera_economia(uuid,numeric,bigint) TO "postgres";
GRANT EXECUTE ON FUNCTION public.valorizza_manodopera_economia(uuid,numeric,bigint) TO "anon";
GRANT EXECUTE ON FUNCTION public.valorizza_manodopera_economia(uuid,numeric,bigint) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.valorizza_manodopera_economia(uuid,numeric,bigint) TO "service_role";
REVOKE ALL ON FUNCTION public.leggi_tariffe_manodopera_economia() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leggi_tariffe_manodopera_economia() TO "postgres";
GRANT EXECUTE ON FUNCTION public.leggi_tariffe_manodopera_economia() TO "anon";
GRANT EXECUTE ON FUNCTION public.leggi_tariffe_manodopera_economia() TO "authenticated";
GRANT EXECUTE ON FUNCTION public.leggi_tariffe_manodopera_economia() TO "service_role";
REVOKE ALL ON FUNCTION public.quaderno_file_autorizzato(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quaderno_file_autorizzato(text) TO "postgres";
GRANT EXECUTE ON FUNCTION public.quaderno_file_autorizzato(text) TO "anon";
GRANT EXECUTE ON FUNCTION public.quaderno_file_autorizzato(text) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.quaderno_file_autorizzato(text) TO "service_role";
REVOKE ALL ON FUNCTION public.quaderno_copia_file_autorizzato(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quaderno_copia_file_autorizzato(text) TO "postgres";
GRANT EXECUTE ON FUNCTION public.quaderno_copia_file_autorizzato(text) TO "anon";
GRANT EXECUTE ON FUNCTION public.quaderno_copia_file_autorizzato(text) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.quaderno_copia_file_autorizzato(text) TO "service_role";
REVOKE ALL ON FUNCTION public.quaderno_copia_file_scrivibile(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quaderno_copia_file_scrivibile(text) TO "postgres";
GRANT EXECUTE ON FUNCTION public.quaderno_copia_file_scrivibile(text) TO "anon";
GRANT EXECUTE ON FUNCTION public.quaderno_copia_file_scrivibile(text) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.quaderno_copia_file_scrivibile(text) TO "service_role";
REVOKE ALL ON FUNCTION artecna_distruzione.inizia_contesto(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_distruzione.inizia_contesto(uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION artecna_distruzione.inizia_contesto(uuid) TO "artecna_cantieri_delete_rpc";
REVOKE ALL ON FUNCTION artecna_distruzione.contesto_valido(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_distruzione.contesto_valido(uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION artecna_distruzione.contesto_valido(uuid) TO "artecna_cantieri_delete_rpc";
REVOKE ALL ON FUNCTION artecna_distruzione.contesto_variante_valido(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_distruzione.contesto_variante_valido(uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION artecna_distruzione.contesto_variante_valido(uuid) TO "artecna_cantieri_delete_rpc";
REVOKE ALL ON FUNCTION artecna_distruzione.termina_contesto() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_distruzione.termina_contesto() TO "postgres";
GRANT EXECUTE ON FUNCTION artecna_distruzione.termina_contesto() TO "artecna_cantieri_delete_rpc";
REVOKE ALL ON FUNCTION artecna_distruzione.manifest_cantiere(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_distruzione.manifest_cantiere(uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION artecna_distruzione.manifest_cantiere(uuid) TO "artecna_cantieri_delete_rpc";
REVOKE ALL ON FUNCTION artecna_distruzione.prepara_cleanup_storage(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_distruzione.prepara_cleanup_storage(uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION artecna_distruzione.prepara_cleanup_storage(uuid) TO "artecna_cantieri_delete_rpc";
REVOKE ALL ON FUNCTION artecna_distruzione.impronta_cleanup_storage(uuid,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_distruzione.impronta_cleanup_storage(uuid,bigint) TO "postgres";
GRANT EXECUTE ON FUNCTION artecna_distruzione.impronta_cleanup_storage(uuid,bigint) TO "artecna_cantieri_delete_rpc";
REVOKE ALL ON FUNCTION artecna_rapportini.compat_foto_fk_allegati(oid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_rapportini.compat_foto_fk_allegati(oid) TO "postgres";
GRANT EXECUTE ON FUNCTION artecna_rapportini.compat_foto_fk_allegati(oid) TO "artecna_cantieri_delete_rpc";
REVOKE ALL ON FUNCTION artecna_rapportini.compat_foto_verifica_cantiere(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_rapportini.compat_foto_verifica_cantiere(uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION artecna_rapportini.compat_foto_verifica_cantiere(uuid) TO "artecna_cantieri_delete_rpc";
REVOKE ALL ON FUNCTION artecna_distruzione.numero_fk_economia_rapportino() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_distruzione.numero_fk_economia_rapportino() TO "postgres";
GRANT EXECUTE ON FUNCTION artecna_distruzione.numero_fk_economia_rapportino() TO "artecna_cantieri_delete_rpc";
REVOKE ALL ON FUNCTION artecna_guardie.materiali_fattura_totale(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.materiali_fattura_totale(uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION artecna_guardie.materiali_fattura_totale(uuid) TO "artecna_economia_rpc";
GRANT EXECUTE ON FUNCTION artecna_guardie.materiali_fattura_totale(uuid) TO "artecna_materiali_fattura_rpc";
REVOKE ALL ON FUNCTION public.economia_oggetto_analitico(jsonb,text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.economia_oggetto_analitico(jsonb,text[]) TO "postgres";
GRANT EXECUTE ON FUNCTION public.economia_oggetto_analitico(jsonb,text[]) TO "artecna_economia_rpc";
GRANT EXECUTE ON FUNCTION public.economia_oggetto_analitico(jsonb,text[]) TO "artecna_ponte_economia_rpc";
REVOKE ALL ON FUNCTION public.economia_numero_sorgente(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.economia_numero_sorgente(jsonb) TO "postgres";
GRANT EXECUTE ON FUNCTION public.economia_numero_sorgente(jsonb) TO "artecna_economia_rpc";
GRANT EXECUTE ON FUNCTION public.economia_numero_sorgente(jsonb) TO "artecna_ponte_economia_rpc";
REVOKE ALL ON FUNCTION public.economia_valida_dettagli(text,jsonb,jsonb,integer,integer,numeric,numeric,text,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.economia_valida_dettagli(text,jsonb,jsonb,integer,integer,numeric,numeric,text,text,boolean) TO "postgres";
GRANT EXECUTE ON FUNCTION public.economia_valida_dettagli(text,jsonb,jsonb,integer,integer,numeric,numeric,text,text,boolean) TO "artecna_economia_rpc";
GRANT EXECUTE ON FUNCTION public.economia_valida_dettagli(text,jsonb,jsonb,integer,integer,numeric,numeric,text,text,boolean) TO "artecna_ponte_economia_rpc";
REVOKE ALL ON FUNCTION artecna_guardie.verifica_riga_economia_rapportino(public.economia_righe,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.verifica_riga_economia_rapportino(public.economia_righe,boolean) TO "postgres";
GRANT EXECUTE ON FUNCTION artecna_guardie.verifica_riga_economia_rapportino(public.economia_righe,boolean) TO "artecna_economia_rpc";
GRANT EXECUTE ON FUNCTION artecna_guardie.verifica_riga_economia_rapportino(public.economia_righe,boolean) TO "artecna_ponte_economia_rpc";
REVOKE ALL ON FUNCTION artecna_guardie.verifica_materiale_fattura_economia(public.economia_righe) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.verifica_materiale_fattura_economia(public.economia_righe) TO "postgres";
GRANT EXECUTE ON FUNCTION artecna_guardie.verifica_materiale_fattura_economia(public.economia_righe) TO "artecna_economia_rpc";
GRANT EXECUTE ON FUNCTION artecna_guardie.verifica_materiale_fattura_economia(public.economia_righe) TO "artecna_ponte_economia_rpc";
REVOKE ALL ON FUNCTION artecna_guardie.economia_snapshot_fattura(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.economia_snapshot_fattura(uuid,uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION artecna_guardie.economia_snapshot_fattura(uuid,uuid) TO "artecna_economia_rpc";
REVOKE ALL ON FUNCTION artecna_guardie.blocca_riga_fattura_economia(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.blocca_riga_fattura_economia(uuid,uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION artecna_guardie.blocca_riga_fattura_economia(uuid,uuid) TO "artecna_economia_rpc";
REVOKE ALL ON FUNCTION artecna_guardie.materiali_fattura_ordine_lock(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.materiali_fattura_ordine_lock(jsonb) TO "postgres";
GRANT EXECUTE ON FUNCTION artecna_guardie.materiali_fattura_ordine_lock(jsonb) TO "artecna_economia_rpc";
REVOKE ALL ON FUNCTION artecna_rapportini.f3c3_inserisci_proiezione(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_rapportini.f3c3_inserisci_proiezione(uuid,uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION artecna_rapportini.f3c3_inserisci_proiezione(uuid,uuid) TO "artecna_foto_v1_writer";
REVOKE ALL ON FUNCTION artecna_guardie.materiali_fattura_stato(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.materiali_fattura_stato(uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION artecna_guardie.materiali_fattura_stato(uuid) TO "artecna_materiali_fattura_rpc";
REVOKE ALL ON FUNCTION artecna_guardie.materiali_fattura_blocca(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.materiali_fattura_blocca(uuid,uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION artecna_guardie.materiali_fattura_blocca(uuid,uuid) TO "artecna_materiali_fattura_rpc";
REVOKE ALL ON FUNCTION artecna_guardie.base_congelata(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.base_congelata(uuid,uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION artecna_guardie.base_congelata(uuid,uuid) TO "artecna_preventivi_rpc";
REVOKE ALL ON FUNCTION public.leggi_rapportino_portale(text,uuid,date,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leggi_rapportino_portale(text,uuid,date,uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.leggi_rapportino_portale(text,uuid,date,uuid) TO "artecna_rapportini_backend";
REVOKE ALL ON FUNCTION public.prenota_allegato_rapportino_portale(text,uuid,uuid,date,uuid,text,text,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prenota_allegato_rapportino_portale(text,uuid,uuid,date,uuid,text,text,bigint) TO "postgres";
GRANT EXECUTE ON FUNCTION public.prenota_allegato_rapportino_portale(text,uuid,uuid,date,uuid,text,text,bigint) TO "artecna_rapportini_backend";
REVOKE ALL ON FUNCTION public.finalizza_allegato_rapportino_portale(text,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalizza_allegato_rapportino_portale(text,uuid,uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.finalizza_allegato_rapportino_portale(text,uuid,uuid) TO "artecna_rapportini_backend";
REVOKE ALL ON FUNCTION public.elenca_allegati_rapportino_portale(text,uuid,uuid,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.elenca_allegati_rapportino_portale(text,uuid,uuid,date) TO "postgres";
GRANT EXECUTE ON FUNCTION public.elenca_allegati_rapportino_portale(text,uuid,uuid,date) TO "artecna_rapportini_backend";
REVOKE ALL ON FUNCTION public.autorizza_accesso_allegato_portale(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.autorizza_accesso_allegato_portale(text,uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.autorizza_accesso_allegato_portale(text,uuid) TO "artecna_rapportini_backend";
REVOKE ALL ON FUNCTION public.cancella_allegato_rapportino_portale(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancella_allegato_rapportino_portale(text,uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.cancella_allegato_rapportino_portale(text,uuid) TO "artecna_rapportini_backend";
REVOKE ALL ON FUNCTION public.leggi_rapportino_portale(text,uuid,date,uuid,smallint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leggi_rapportino_portale(text,uuid,date,uuid,smallint) TO "postgres";
GRANT EXECUTE ON FUNCTION public.leggi_rapportino_portale(text,uuid,date,uuid,smallint) TO "artecna_rapportini_backend";
REVOKE ALL ON FUNCTION artecna_foto_desktop.risolvi(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_foto_desktop.risolvi(uuid,uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION artecna_foto_desktop.risolvi(uuid,uuid) TO "artecna_rapportini_backend";
REVOKE ALL ON FUNCTION artecna_guardie.salva_osservatore_variante(uuid,uuid,uuid,jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.salva_osservatore_variante(uuid,uuid,uuid,jsonb,jsonb) TO "postgres";
GRANT EXECUTE ON FUNCTION artecna_guardie.salva_osservatore_variante(uuid,uuid,uuid,jsonb,jsonb) TO "artecna_rapportini_backend";
REVOKE ALL ON FUNCTION public.prenota_allegato_rapportino_desktop(uuid,uuid,uuid,date,uuid,text,text,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prenota_allegato_rapportino_desktop(uuid,uuid,uuid,date,uuid,text,text,bigint) TO "postgres";
GRANT EXECUTE ON FUNCTION public.prenota_allegato_rapportino_desktop(uuid,uuid,uuid,date,uuid,text,text,bigint) TO "artecna_rapportini_backend";
REVOKE ALL ON FUNCTION public.finalizza_allegato_rapportino_desktop(uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalizza_allegato_rapportino_desktop(uuid,uuid,uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.finalizza_allegato_rapportino_desktop(uuid,uuid,uuid) TO "artecna_rapportini_backend";
REVOKE ALL ON FUNCTION artecna_rapportini.variante_del_cantiere(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_rapportini.variante_del_cantiere(uuid,uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION artecna_rapportini.variante_del_cantiere(uuid,uuid) TO "artecna_rapportini_rpc";
REVOKE ALL ON FUNCTION artecna_rapportini.applica_prestazioni_rapportino(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_rapportini.applica_prestazioni_rapportino(jsonb) TO "postgres";
GRANT EXECUTE ON FUNCTION artecna_rapportini.applica_prestazioni_rapportino(jsonb) TO "artecna_rapportini_rpc";
REVOKE ALL ON FUNCTION artecna_rapportini.autorizza(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_rapportini.autorizza(text,uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION artecna_rapportini.autorizza(text,uuid) TO "artecna_rapportini_rpc";
REVOKE ALL ON FUNCTION artecna_rapportini.verifica_nuovo_collegamento_variante(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_rapportini.verifica_nuovo_collegamento_variante(uuid,uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION artecna_rapportini.verifica_nuovo_collegamento_variante(uuid,uuid) TO "artecna_rapportini_rpc";
REVOKE ALL ON FUNCTION artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid) TO "artecna_sal_rpc";
GRANT EXECUTE ON FUNCTION artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid) TO "artecna_varianti_rpc";
GRANT EXECUTE ON FUNCTION artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid) TO "artecna_preventivi_rpc";
GRANT EXECUTE ON FUNCTION artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid) TO "artecna_cantieri_delete_rpc";
GRANT EXECUTE ON FUNCTION artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid) TO "artecna_economia_rpc";
GRANT EXECUTE ON FUNCTION artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid) TO "artecna_rapportini_rpc";
GRANT EXECUTE ON FUNCTION artecna_guardie.utente_puo_modificare_cantiere(uuid,uuid) TO "artecna_ponte_economia_rpc";
REVOKE ALL ON FUNCTION artecna_guardie.utente_jwt_corrente() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.utente_jwt_corrente() TO "postgres";
GRANT EXECUTE ON FUNCTION artecna_guardie.utente_jwt_corrente() TO "artecna_sal_rpc";
GRANT EXECUTE ON FUNCTION artecna_guardie.utente_jwt_corrente() TO "artecna_varianti_rpc";
GRANT EXECUTE ON FUNCTION artecna_guardie.utente_jwt_corrente() TO "artecna_preventivi_rpc";
GRANT EXECUTE ON FUNCTION artecna_guardie.utente_jwt_corrente() TO "artecna_cantieri_rpc";
GRANT EXECUTE ON FUNCTION artecna_guardie.utente_jwt_corrente() TO "artecna_cantieri_delete_rpc";
GRANT EXECUTE ON FUNCTION artecna_guardie.utente_jwt_corrente() TO "artecna_economia_rpc";
GRANT EXECUTE ON FUNCTION artecna_guardie.utente_jwt_corrente() TO "artecna_rapportini_rpc";
GRANT EXECUTE ON FUNCTION artecna_guardie.utente_jwt_corrente() TO "artecna_ponte_economia_rpc";
REVOKE ALL ON FUNCTION public.leggi_osservatore_variante(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leggi_osservatore_variante(uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.leggi_osservatore_variante(uuid) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.leggi_osservatore_variante(uuid) TO "artecna_varianti_rpc";
REVOKE ALL ON FUNCTION public.salva_rapportino_con_prestazioni(jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salva_rapportino_con_prestazioni(jsonb,text) TO "postgres";
GRANT EXECUTE ON FUNCTION public.salva_rapportino_con_prestazioni(jsonb,text) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.salva_rapportino_con_prestazioni(jsonb,text) TO "service_role";
GRANT EXECUTE ON FUNCTION public.salva_rapportino_con_prestazioni(jsonb,text) TO "artecna_rapportini_backend";
REVOKE ALL ON FUNCTION public.quaderno_target_accessibile(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quaderno_target_accessibile(text) TO "postgres";
GRANT EXECUTE ON FUNCTION public.quaderno_target_accessibile(text) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.quaderno_target_accessibile(text) TO "service_role";
REVOKE ALL ON FUNCTION public.salva_nota_quaderno(text,jsonb,timestamp with time zone) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salva_nota_quaderno(text,jsonb,timestamp with time zone) TO "postgres";
GRANT EXECUTE ON FUNCTION public.salva_nota_quaderno(text,jsonb,timestamp with time zone) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.salva_nota_quaderno(text,jsonb,timestamp with time zone) TO "service_role";
REVOKE ALL ON FUNCTION public.prepara_richiamo_quaderno(uuid,text,uuid,timestamp with time zone,jsonb,jsonb,timestamp with time zone) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepara_richiamo_quaderno(uuid,text,uuid,timestamp with time zone,jsonb,jsonb,timestamp with time zone) TO "postgres";
GRANT EXECUTE ON FUNCTION public.prepara_richiamo_quaderno(uuid,text,uuid,timestamp with time zone,jsonb,jsonb,timestamp with time zone) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.prepara_richiamo_quaderno(uuid,text,uuid,timestamp with time zone,jsonb,jsonb,timestamp with time zone) TO "service_role";
REVOKE ALL ON FUNCTION public.esito_richiamo_quaderno(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.esito_richiamo_quaderno(uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.esito_richiamo_quaderno(uuid) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.esito_richiamo_quaderno(uuid) TO "service_role";
REVOKE ALL ON FUNCTION public.completa_richiamo_quaderno(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.completa_richiamo_quaderno(uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.completa_richiamo_quaderno(uuid) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.completa_richiamo_quaderno(uuid) TO "service_role";
REVOKE ALL ON FUNCTION public.annulla_richiamo_quaderno(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.annulla_richiamo_quaderno(uuid,text) TO "postgres";
GRANT EXECUTE ON FUNCTION public.annulla_richiamo_quaderno(uuid,text) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.annulla_richiamo_quaderno(uuid,text) TO "service_role";
REVOKE ALL ON FUNCTION public.conferma_richiamo_quaderno(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.conferma_richiamo_quaderno(uuid,boolean) TO "postgres";
GRANT EXECUTE ON FUNCTION public.conferma_richiamo_quaderno(uuid,boolean) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.conferma_richiamo_quaderno(uuid,boolean) TO "service_role";
REVOKE ALL ON FUNCTION public.quaderno_rinomina(uuid,text,timestamp with time zone) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quaderno_rinomina(uuid,text,timestamp with time zone) TO "postgres";
GRANT EXECUTE ON FUNCTION public.quaderno_rinomina(uuid,text,timestamp with time zone) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.quaderno_rinomina(uuid,text,timestamp with time zone) TO "service_role";
REVOKE ALL ON FUNCTION public.quaderno_gestione_esito(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quaderno_gestione_esito(uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.quaderno_gestione_esito(uuid) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.quaderno_gestione_esito(uuid) TO "service_role";
REVOKE ALL ON FUNCTION public.quaderno_prepara_eliminazione(uuid,uuid,timestamp with time zone) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quaderno_prepara_eliminazione(uuid,uuid,timestamp with time zone) TO "postgres";
GRANT EXECUTE ON FUNCTION public.quaderno_prepara_eliminazione(uuid,uuid,timestamp with time zone) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.quaderno_prepara_eliminazione(uuid,uuid,timestamp with time zone) TO "service_role";
REVOKE ALL ON FUNCTION public.quaderno_prepara_duplicazione(uuid,uuid,timestamp with time zone,uuid,jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quaderno_prepara_duplicazione(uuid,uuid,timestamp with time zone,uuid,jsonb,jsonb) TO "postgres";
GRANT EXECUTE ON FUNCTION public.quaderno_prepara_duplicazione(uuid,uuid,timestamp with time zone,uuid,jsonb,jsonb) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.quaderno_prepara_duplicazione(uuid,uuid,timestamp with time zone,uuid,jsonb,jsonb) TO "service_role";
REVOKE ALL ON FUNCTION public.quaderno_prepara_rimozione(uuid,uuid,timestamp with time zone) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quaderno_prepara_rimozione(uuid,uuid,timestamp with time zone) TO "postgres";
GRANT EXECUTE ON FUNCTION public.quaderno_prepara_rimozione(uuid,uuid,timestamp with time zone) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.quaderno_prepara_rimozione(uuid,uuid,timestamp with time zone) TO "service_role";
REVOKE ALL ON FUNCTION public.quaderno_annulla_duplicazione(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quaderno_annulla_duplicazione(uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.quaderno_annulla_duplicazione(uuid) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.quaderno_annulla_duplicazione(uuid) TO "service_role";
REVOKE ALL ON FUNCTION public.quaderno_concludi_gestione(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quaderno_concludi_gestione(uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.quaderno_concludi_gestione(uuid) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.quaderno_concludi_gestione(uuid) TO "service_role";
REVOKE ALL ON FUNCTION public.quaderno_archivia_non_avviata(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quaderno_archivia_non_avviata(uuid,text) TO "postgres";
GRANT EXECUTE ON FUNCTION public.quaderno_archivia_non_avviata(uuid,text) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.quaderno_archivia_non_avviata(uuid,text) TO "service_role";
REVOKE ALL ON FUNCTION public.leggi_fonti_memory_variante(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leggi_fonti_memory_variante(uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.leggi_fonti_memory_variante(uuid) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.leggi_fonti_memory_variante(uuid) TO "service_role";
REVOKE ALL ON FUNCTION public.modifica_fonte_memory_variante(uuid,uuid,text,timestamp with time zone) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.modifica_fonte_memory_variante(uuid,uuid,text,timestamp with time zone) TO "postgres";
GRANT EXECUTE ON FUNCTION public.modifica_fonte_memory_variante(uuid,uuid,text,timestamp with time zone) TO "authenticated";
GRANT EXECUTE ON FUNCTION public.modifica_fonte_memory_variante(uuid,uuid,text,timestamp with time zone) TO "service_role";
REVOKE ALL ON FUNCTION public.elimina_rapportino_legacy_senza_allegati(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.elimina_rapportino_legacy_senza_allegati(uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.elimina_rapportino_legacy_senza_allegati(uuid) TO "authenticated";
REVOKE ALL ON FUNCTION public.rinomina_cantiere_legacy_senza_allegati(uuid,text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rinomina_cantiere_legacy_senza_allegati(uuid,text,text,text,jsonb) TO "postgres";
GRANT EXECUTE ON FUNCTION public.rinomina_cantiere_legacy_senza_allegati(uuid,text,text,text,jsonb) TO "authenticated";
REVOKE ALL ON FUNCTION public.elenca_foto_rapportino_desktop(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.elenca_foto_rapportino_desktop(uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.elenca_foto_rapportino_desktop(uuid) TO "authenticated";
REVOKE ALL ON FUNCTION public.elenca_prestazioni_economia_rapportini(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.elenca_prestazioni_economia_rapportini(uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.elenca_prestazioni_economia_rapportini(uuid) TO "authenticated";
REVOKE ALL ON FUNCTION public.acquisisci_prestazioni_economia_rapportini(uuid,bigint,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.acquisisci_prestazioni_economia_rapportini(uuid,bigint,jsonb) TO "postgres";
GRANT EXECUTE ON FUNCTION public.acquisisci_prestazioni_economia_rapportini(uuid,bigint,jsonb) TO "authenticated";
REVOKE ALL ON FUNCTION public.leggi_disponibilita_materiali_fattura(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leggi_disponibilita_materiali_fattura(uuid,uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.leggi_disponibilita_materiali_fattura(uuid,uuid) TO "authenticated";
REVOKE ALL ON FUNCTION public.fattura_con_assegnazioni_quantitative(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fattura_con_assegnazioni_quantitative(uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.fattura_con_assegnazioni_quantitative(uuid) TO "authenticated";
REVOKE ALL ON FUNCTION public.leggi_assegnazioni_materiali_fattura(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leggi_assegnazioni_materiali_fattura(uuid,uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.leggi_assegnazioni_materiali_fattura(uuid,uuid) TO "authenticated";
REVOKE ALL ON FUNCTION public.assegna_materiale_fattura_impresa(uuid,numeric,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assegna_materiale_fattura_impresa(uuid,numeric,text,text,uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.assegna_materiale_fattura_impresa(uuid,numeric,text,text,uuid) TO "authenticated";
REVOKE ALL ON FUNCTION public.salva_classificazione_fattura(uuid,jsonb,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salva_classificazione_fattura(uuid,jsonb,uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.salva_classificazione_fattura(uuid,jsonb,uuid) TO "authenticated";
REVOKE ALL ON FUNCTION public.leggi_rapportino_desktop(uuid,date,uuid,smallint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leggi_rapportino_desktop(uuid,date,uuid,smallint) TO "postgres";
GRANT EXECUTE ON FUNCTION public.leggi_rapportino_desktop(uuid,date,uuid,smallint) TO "authenticated";
REVOKE ALL ON FUNCTION public.leggi_foto_fonti_variante(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leggi_foto_fonti_variante(uuid,boolean) TO "postgres";
GRANT EXECUTE ON FUNCTION public.leggi_foto_fonti_variante(uuid,boolean) TO "authenticated";
REVOKE ALL ON FUNCTION public.modifica_foto_fonti_variante(uuid,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.modifica_foto_fonti_variante(uuid,jsonb,text) TO "postgres";
GRANT EXECUTE ON FUNCTION public.modifica_foto_fonti_variante(uuid,jsonb,text) TO "authenticated";
REVOKE ALL ON FUNCTION public.leggi_memoria_prezzi_preventivo(integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leggi_memoria_prezzi_preventivo(integer,integer) TO "postgres";
GRANT EXECUTE ON FUNCTION public.leggi_memoria_prezzi_preventivo(integer,integer) TO "authenticated";
REVOKE ALL ON FUNCTION public.leggi_attribuzioni_cliente(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leggi_attribuzioni_cliente(uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.leggi_attribuzioni_cliente(uuid) TO "authenticated";
REVOKE ALL ON FUNCTION public.collega_incasso_cliente(uuid,uuid,uuid,numeric,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.collega_incasso_cliente(uuid,uuid,uuid,numeric,boolean) TO "postgres";
GRANT EXECUTE ON FUNCTION public.collega_incasso_cliente(uuid,uuid,uuid,numeric,boolean) TO "authenticated";
REVOKE ALL ON FUNCTION public.scollega_incasso_cliente(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.scollega_incasso_cliente(uuid,uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.scollega_incasso_cliente(uuid,uuid) TO "authenticated";
REVOKE ALL ON FUNCTION artecna_clienti_sicurezza.puo_scrivere_sorgente(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_clienti_sicurezza.puo_scrivere_sorgente(uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION artecna_clienti_sicurezza.puo_scrivere_sorgente(uuid) TO "authenticated";
REVOKE ALL ON FUNCTION public.leggi_link_rapportini_mobile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leggi_link_rapportini_mobile() TO "postgres";
GRANT EXECUTE ON FUNCTION public.leggi_link_rapportini_mobile() TO "authenticated";
REVOKE ALL ON FUNCTION public.salva_link_rapportini_mobile(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.salva_link_rapportini_mobile(text) TO "postgres";
GRANT EXECUTE ON FUNCTION public.salva_link_rapportini_mobile(text) TO "authenticated";
REVOKE ALL ON FUNCTION public.leggi_nota_credito_fornitore(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leggi_nota_credito_fornitore(uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.leggi_nota_credito_fornitore(uuid) TO "authenticated";
REVOKE ALL ON FUNCTION public.applica_nota_credito_fornitore(uuid,uuid,jsonb,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.applica_nota_credito_fornitore(uuid,uuid,jsonb,uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.applica_nota_credito_fornitore(uuid,uuid,jsonb,uuid) TO "authenticated";
REVOKE ALL ON FUNCTION public.leggi_costi_fornitori_rettificati(uuid,date,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leggi_costi_fornitori_rettificati(uuid,date,date) TO "postgres";
GRANT EXECUTE ON FUNCTION public.leggi_costi_fornitori_rettificati(uuid,date,date) TO "authenticated";
REVOKE ALL ON FUNCTION public.valorizza_materiale_economia(uuid,uuid,numeric,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.valorizza_materiale_economia(uuid,uuid,numeric,bigint) TO "postgres";
GRANT EXECUTE ON FUNCTION public.valorizza_materiale_economia(uuid,uuid,numeric,bigint) TO "authenticated";
REVOKE ALL ON FUNCTION public.leggi_raccolta_economia_cliente(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leggi_raccolta_economia_cliente(uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.leggi_raccolta_economia_cliente(uuid) TO "authenticated";
REVOKE ALL ON FUNCTION public.leggi_raccolte_economia_cliente(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leggi_raccolte_economia_cliente(uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.leggi_raccolte_economia_cliente(uuid) TO "authenticated";
REVOKE ALL ON FUNCTION public.usa_raccolta_economia_cliente_in_variante(uuid,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.usa_raccolta_economia_cliente_in_variante(uuid,bigint) TO "postgres";
GRANT EXECUTE ON FUNCTION public.usa_raccolta_economia_cliente_in_variante(uuid,bigint) TO "authenticated";
REVOKE ALL ON FUNCTION public.classifica_riga_non_economica(uuid,uuid,boolean,text,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.classifica_riga_non_economica(uuid,uuid,boolean,text,bigint) TO "postgres";
GRANT EXECUTE ON FUNCTION public.classifica_riga_non_economica(uuid,uuid,boolean,text,bigint) TO "authenticated";
REVOKE ALL ON FUNCTION public.leggi_identita_lavorazioni_variante(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leggi_identita_lavorazioni_variante(uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.leggi_identita_lavorazioni_variante(uuid) TO "authenticated";
REVOKE ALL ON FUNCTION public.preflight_eliminazione_sopralluogo(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preflight_eliminazione_sopralluogo(text) TO "postgres";
GRANT EXECUTE ON FUNCTION public.preflight_eliminazione_sopralluogo(text) TO "authenticated";
REVOKE ALL ON FUNCTION public.preflight_eliminazione_cantiere(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preflight_eliminazione_cantiere(uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.preflight_eliminazione_cantiere(uuid) TO "authenticated";
REVOKE ALL ON FUNCTION public.crea_sessione_rapportino(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crea_sessione_rapportino(text,text) TO "postgres";
GRANT EXECUTE ON FUNCTION public.crea_sessione_rapportino(text,text) TO "service_role";
GRANT EXECUTE ON FUNCTION public.crea_sessione_rapportino(text,text) TO "artecna_rapportini_backend";
REVOKE ALL ON FUNCTION public.verifica_sessione_rapportino(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verifica_sessione_rapportino(text,uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.verifica_sessione_rapportino(text,uuid) TO "service_role";
GRANT EXECUTE ON FUNCTION public.verifica_sessione_rapportino(text,uuid) TO "artecna_rapportini_backend";
REVOKE ALL ON FUNCTION public.varianti_rapportino_portale(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.varianti_rapportino_portale(text,uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION public.varianti_rapportino_portale(text,uuid) TO "service_role";
GRANT EXECUTE ON FUNCTION public.varianti_rapportino_portale(text,uuid) TO "artecna_rapportini_backend";
REVOKE ALL ON FUNCTION public.quaderno_copia_scrittura_guard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quaderno_copia_scrittura_guard() TO "postgres";
GRANT EXECUTE ON FUNCTION public.quaderno_copia_scrittura_guard() TO "service_role";
REVOKE ALL ON FUNCTION public.quaderno_gestione_blocco() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quaderno_gestione_blocco() TO "postgres";
GRANT EXECUTE ON FUNCTION public.quaderno_gestione_blocco() TO "service_role";
REVOKE ALL ON FUNCTION public.quaderno_gestione_allegati_guard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quaderno_gestione_allegati_guard() TO "postgres";
GRANT EXECUTE ON FUNCTION public.quaderno_gestione_allegati_guard() TO "service_role";
REVOKE ALL ON FUNCTION public.quaderno_gestione_storage_guard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quaderno_gestione_storage_guard() TO "postgres";
GRANT EXECUTE ON FUNCTION public.quaderno_gestione_storage_guard() TO "service_role";
REVOKE ALL ON FUNCTION public.quaderno_gestione_richiamo_guard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quaderno_gestione_richiamo_guard() TO "postgres";
GRANT EXECUTE ON FUNCTION public.quaderno_gestione_richiamo_guard() TO "service_role";
REVOKE ALL ON FUNCTION public.quaderno_filtra_richiamo(jsonb,text,text[],text[],jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quaderno_filtra_richiamo(jsonb,text,text[],text[],jsonb) TO "postgres";
GRANT EXECUTE ON FUNCTION public.quaderno_filtra_richiamo(jsonb,text,text[],text[],jsonb) TO "service_role";
REVOKE ALL ON FUNCTION artecna_guardie.proteggi_contrattuale_cantiere() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.proteggi_contrattuale_cantiere() TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.proteggi_preventivo_base() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.proteggi_preventivo_base() TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.proteggi_lavorazione_base() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.proteggi_lavorazione_base() TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.proteggi_variante_testata() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.proteggi_variante_testata() TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.proteggi_variante_figlio() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.proteggi_variante_figlio() TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.proteggi_archiviazione_preventivo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.proteggi_archiviazione_preventivo() TO "postgres";
REVOKE ALL ON FUNCTION artecna_rapportini.proteggi_proiezione() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_rapportini.proteggi_proiezione() TO "postgres";
REVOKE ALL ON FUNCTION artecna_rapportini.proteggi_prestazione() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_rapportini.proteggi_prestazione() TO "postgres";
REVOKE ALL ON FUNCTION artecna_rapportini.proteggi_testata() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_rapportini.proteggi_testata() TO "postgres";
REVOKE ALL ON FUNCTION artecna_rapportini.proteggi_cantiere_variante() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_rapportini.proteggi_cantiere_variante() TO "postgres";
REVOKE ALL ON FUNCTION artecna_rapportini.fotografa_costo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_rapportini.fotografa_costo() TO "postgres";
REVOKE ALL ON FUNCTION artecna_rapportini.proteggi_strutturato() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_rapportini.proteggi_strutturato() TO "postgres";
REVOKE ALL ON FUNCTION artecna_rapportini.autorizza_lettura_portale(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_rapportini.autorizza_lettura_portale(text,uuid) TO "postgres";
REVOKE ALL ON FUNCTION artecna_rapportini.accesso_allegato_finalizzato(uuid,uuid,uuid,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_rapportini.accesso_allegato_finalizzato(uuid,uuid,uuid,date) TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.proteggi_ponte_economia() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.proteggi_ponte_economia() TO "postgres";
REVOKE ALL ON FUNCTION artecna_rapportini.proteggi_versione_materiali() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_rapportini.proteggi_versione_materiali() TO "postgres";
REVOKE ALL ON FUNCTION artecna_rapportini.proteggi_materiale() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_rapportini.proteggi_materiale() TO "postgres";
REVOKE ALL ON FUNCTION artecna_rapportini.materiali_fail_closed() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_rapportini.materiali_fail_closed() TO "postgres";
REVOKE ALL ON FUNCTION artecna_rapportini.salva_contratto_uno(jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_rapportini.salva_contratto_uno(jsonb,text) TO "postgres";
REVOKE ALL ON FUNCTION artecna_rapportini.applica_prestazioni_contratto_due(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_rapportini.applica_prestazioni_contratto_due(jsonb) TO "postgres";
REVOKE ALL ON FUNCTION artecna_rapportini.salva_contratto_due(jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_rapportini.salva_contratto_due(jsonb,text) TO "postgres";
REVOKE ALL ON FUNCTION artecna_rapportini.f3c3_verifica_proiezione(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_rapportini.f3c3_verifica_proiezione(uuid) TO "postgres";
REVOKE ALL ON FUNCTION artecna_rapportini.f3c3_guardia_foto() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_rapportini.f3c3_guardia_foto() TO "postgres";
REVOKE ALL ON FUNCTION artecna_rapportini.f3c3_guardia_truncate() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_rapportini.f3c3_guardia_truncate() TO "postgres";
REVOKE ALL ON FUNCTION artecna_rapportini.f3c3_reciprocita() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_rapportini.f3c3_reciprocita() TO "postgres";
REVOKE ALL ON FUNCTION artecna_foto_desktop.verifica(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_foto_desktop.verifica(uuid,uuid) TO "postgres";
REVOKE ALL ON FUNCTION public.proteggi_provenienza_economia_rapportino() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proteggi_provenienza_economia_rapportino() TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.sal_blocca_eliminazione_preventivo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.sal_blocca_eliminazione_preventivo() TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.sal_blocca_cambio_contratto() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.sal_blocca_cambio_contratto() TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.materiali_fattura_guardia() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.materiali_fattura_guardia() TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.materiali_fattura_legacy_guardia() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.materiali_fattura_legacy_guardia() TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.materiali_fattura_testata_guardia() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.materiali_fattura_testata_guardia() TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.materiali_economia_globale_guardia() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.materiali_economia_globale_guardia() TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.materiali_economia_stato() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.materiali_economia_stato() TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.utente_puo_operare_impresa(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.utente_puo_operare_impresa(uuid) TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.materiali_impresa_blocca(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.materiali_impresa_blocca(uuid) TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.spese_impresa_conflitto_quantitativo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.spese_impresa_conflitto_quantitativo() TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.materiali_impresa_conflitto_legacy() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.materiali_impresa_conflitto_legacy() TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.leggi_materiali_impresa_fattura(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.leggi_materiali_impresa_fattura(uuid) TO "postgres";
REVOKE ALL ON FUNCTION artecna_rapportini.verifica_intervalli_prestazioni() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_rapportini.verifica_intervalli_prestazioni() TO "postgres";
REVOKE ALL ON FUNCTION artecna_rapportini.costruisci_lettura_rapportino_v1(uuid,date,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_rapportini.costruisci_lettura_rapportino_v1(uuid,date,uuid) TO "postgres";
REVOKE ALL ON FUNCTION public.quaderno_versione_contenuto() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.quaderno_versione_contenuto() TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.foto_fonti_variante(uuid,uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.foto_fonti_variante(uuid,uuid,boolean) TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.pacchetto_osservatore_variante(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.pacchetto_osservatore_variante(uuid,uuid) TO "postgres";
REVOKE ALL ON FUNCTION public.proteggi_preventivo_integrativo_generato() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proteggi_preventivo_integrativo_generato() TO "postgres";
REVOKE ALL ON FUNCTION artecna_contabilita.autorizza(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_contabilita.autorizza(uuid) TO "postgres";
REVOKE ALL ON FUNCTION artecna_contabilita.proteggi_origine() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_contabilita.proteggi_origine() TO "postgres";
REVOKE ALL ON FUNCTION artecna_contabilita.proteggi_truncate() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_contabilita.proteggi_truncate() TO "postgres";
REVOKE ALL ON FUNCTION public.link_rapportini_mobile_url_valido(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_rapportini_mobile_url_valido(text) TO "postgres";
REVOKE ALL ON FUNCTION public.proteggi_link_rapportini_mobile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.proteggi_link_rapportini_mobile() TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.nc_testo(xml,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.nc_testo(xml,text) TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.nc_xml(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.nc_xml(uuid) TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.nc_righe_coerenti(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.nc_righe_coerenti(uuid,jsonb) TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.nc_tipo(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.nc_tipo(uuid) TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.nc_quote(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.nc_quote(uuid) TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.nc_accesso(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.nc_accesso(uuid) TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.nc_immutabile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.nc_immutabile() TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.nc_proteggi_quote() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.nc_proteggi_quote() TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.nc_proteggi_documenti() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.nc_proteggi_documenti() TO "postgres";
REVOKE ALL ON FUNCTION artecna_distruzione.fk_rettifiche_td04_certificata(oid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_distruzione.fk_rettifiche_td04_certificata(oid) TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.prezzo_materiale_cliente(public.economia_righe) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.prezzo_materiale_cliente(public.economia_righe) TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.proteggi_prezzo_materiale_cliente() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.proteggi_prezzo_materiale_cliente() TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.certifica_snapshot_cliente(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.certifica_snapshot_cliente(jsonb) TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.riga_esclusa_proposta(public.economia_righe) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.riga_esclusa_proposta(public.economia_righe) TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.proteggi_esclusione_proposta() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.proteggi_esclusione_proposta() TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.certifica_snapshot_esclusioni(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.certifica_snapshot_esclusioni(jsonb) TO "postgres";
REVOKE ALL ON FUNCTION artecna_guardie.preflight_dipendenze(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_guardie.preflight_dipendenze(text,text) TO "postgres";
REVOKE ALL ON FUNCTION artecna_rapportini.prenota_allegato_core(text,uuid,uuid,date,uuid,text,text,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_rapportini.prenota_allegato_core(text,uuid,uuid,date,uuid,text,text,bigint) TO "postgres";
REVOKE ALL ON FUNCTION artecna_rapportini.finalizza_allegato_core(text,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_rapportini.finalizza_allegato_core(text,uuid,uuid) TO "postgres";
REVOKE ALL ON FUNCTION artecna_rapportini.arricchisci_lettura_rapportino_v2(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION artecna_rapportini.arricchisci_lettura_rapportino_v2(jsonb) TO "postgres";
SET check_function_bodies=on;
