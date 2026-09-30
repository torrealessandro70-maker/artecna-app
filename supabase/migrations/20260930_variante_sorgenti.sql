create table public.variante_sorgenti (
  id uuid primary key default gen_random_uuid(),
  variante_id uuid not null,
  tipo text not null,
  preventivo_sorgente_id uuid,
  titolo text not null,
  nome_file text,
  formato text,
  file_sha256 text,
  snapshot_version integer not null default 1,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),

  constraint variante_sorgenti_variante_fk
    foreign key (variante_id)
    references public.varianti_cantiere(id) on delete restrict,
  constraint variante_sorgenti_preventivo_fk
    foreign key (preventivo_sorgente_id)
    references public.preventivi_cantiere(id) on delete restrict,
  constraint variante_sorgenti_tipo_check
    check (tipo in ('preventivo_artecna', 'file')),
  constraint variante_sorgenti_titolo_check
    check (btrim(titolo) <> ''),
  constraint variante_sorgenti_snapshot_version_check
    check (snapshot_version > 0),
  constraint variante_sorgenti_snapshot_check
    check (jsonb_typeof(snapshot) = 'object'),
  constraint variante_sorgenti_coerenza_tipo_check
    check (
      (
        tipo = 'preventivo_artecna'
        and preventivo_sorgente_id is not null
        and nome_file is null
        and formato is null
        and file_sha256 is null
      )
      or
      (
        tipo = 'file'
        and preventivo_sorgente_id is null
        and nome_file is not null
        and btrim(nome_file) <> ''
        and formato is not null
        and formato in ('pdf', 'excel', 'immagine')
      )
    )
);

create unique index variante_sorgenti_preventivo_unique
  on public.variante_sorgenti (variante_id, preventivo_sorgente_id)
  where tipo = 'preventivo_artecna';

create unique index variante_sorgenti_file_sha256_unique
  on public.variante_sorgenti (variante_id, file_sha256)
  where tipo = 'file' and file_sha256 is not null;

create index variante_sorgenti_lettura_idx
  on public.variante_sorgenti (variante_id, created_at, id);

-- Accesso previsto tramite future RPC SECURITY DEFINER autorizzate.
-- Nessuna policy o concessione di accesso diretto introdotta qui.
alter table public.variante_sorgenti enable row level security;

comment on table public.variante_sorgenti is
  'Sorgenti acquisite della Variante, separate dalle lavorazioni economiche. Le future RPC devono verificare autorizzazione, stato bozza e appartenenza del preventivo sorgente allo stesso cantiere della Variante: le sole FK non garantiscono questa coerenza.';
comment on column public.variante_sorgenti.snapshot is
  'Copia immutabile della proposta sorgente acquisita. Le future RPC devono preservarla separata dalla revisione; nessun trigger di immutabilita viene introdotto qui.';
comment on column public.variante_sorgenti.file_sha256 is
  'Deduplicazione opzionale del file nella Variante, non certificazione del documento. In V1 puo essere NULL; non sostituisce la deduplicazione locale di sessione.';
comment on column public.variante_sorgenti.preventivo_sorgente_id is
  'Riferimento al preventivo sorgente usato solo per tipo preventivo_artecna.';
