BEGIN;

ALTER TABLE public.variante_lavorazioni
  ADD COLUMN variante_sorgente_id uuid NULL,
  ADD COLUMN indice_voce_sorgente integer NULL,
  ADD CONSTRAINT variante_lavorazioni_sorgente_fk
    FOREIGN KEY (variante_sorgente_id)
    REFERENCES public.variante_sorgenti(id) ON DELETE RESTRICT,
  ADD CONSTRAINT variante_lavorazioni_indice_voce_sorgente_check
    CHECK (indice_voce_sorgente IS NULL OR indice_voce_sorgente >= 0),
  ADD CONSTRAINT variante_lavorazioni_provenienza_coppia_check
    CHECK (
      (variante_sorgente_id IS NULL AND indice_voce_sorgente IS NULL)
      OR
      (variante_sorgente_id IS NOT NULL AND indice_voce_sorgente IS NOT NULL)
    );

CREATE UNIQUE INDEX variante_lavorazioni_sorgente_voce_unique
  ON public.variante_lavorazioni (variante_sorgente_id, indice_voce_sorgente)
  WHERE variante_sorgente_id IS NOT NULL
    AND indice_voce_sorgente IS NOT NULL;

COMMENT ON COLUMN public.variante_lavorazioni.variante_sorgente_id IS
  'Sorgente persistente della lavorazione del Preventivo integrativo, separata dai riferimenti economici legacy. La futura RPC batch deve verificare server-side che la sorgente appartenga alla stessa variante_id della lavorazione.';
COMMENT ON COLUMN public.variante_lavorazioni.indice_voce_sorgente IS
  'Indice zero-based della voce nello snapshot della sorgente. NULL insieme a variante_sorgente_id per le lavorazioni legacy/manuali.';

COMMIT;
