'use client'

import { eliminaFilePreventivi, messaggioEliminazione } from '../utils/eliminazionePreventivo'

type Props = {
  salCantiere: string

  preventivi: any[]

  supabase: any

  caricaCantieri: () => Promise<void>
  caricaEconomia: () => Promise<void>
  caricaPreventivoLavorazioni: () => Promise<void>
  caricaSalLavorazioni: () => Promise<void>
}

export default function PulisciPreventivoSalButton({
  salCantiere,
  preventivi,
  supabase,
  caricaCantieri,
  caricaEconomia,
  caricaPreventivoLavorazioni,
  caricaSalLavorazioni,
}: Props) {
  return (
    <button
      onClick={async () => {
        if (!salCantiere) return

        const conferma = confirm(
          'Pulire TUTTI i dati preventivo/SAL di questo cantiere? Verranno eliminati preventivi caricati, lavorazioni preventivo e lavorazioni SAL.'
        )

        if (!conferma) return

        // Verifica tutte le pagine prima di qualsiasi cancellazione del pulsante.
        let offset = 0
        let totaleAtteso: number | null = null
        while (true) {
          const { data: righe, error, count } = await supabase.from('sal_lavorazioni')
            .select('id, cantiere, cantiere_id, source_lavorazione_id, source_variante_lavorazione_id', { count: 'exact' })
            .eq('cantiere', salCantiere).order('id', { ascending: true })
            .range(offset, offset + 199)
          if (error || !Array.isArray(righe) || !Number.isInteger(count) || count < 0 ||
              (totaleAtteso !== null && totaleAtteso !== count) ||
              offset + righe.length > count || (righe.length === 0 && offset < count) ||
              righe.some((r: any) => r.cantiere !== salCantiere ||
                r.source_lavorazione_id === undefined || r.source_variante_lavorazione_id === undefined)) {
            alert('Impossibile verificare tutte le lavorazioni SAL. Pulizia bloccata.')
            return
          }
          if (righe.some((r: any) => r.source_lavorazione_id !== null || r.source_variante_lavorazione_id !== null)) {
            alert('Pulizia bloccata: il SAL contiene lavorazioni collegate al contratto o a Varianti.')
            return
          }
          totaleAtteso = count
          offset += righe.length
          if (offset === count) break
        }

        // Explicit total cleanup: delete children before parents. These requests
        // are not a transaction; stop on the first failure and keep Storage intact.
        for (const tabella of ['sal_lavorazioni', 'preventivo_lavorazioni']) {
          const { error } = await supabase.from(tabella).delete().eq('cantiere', salCantiere)
          if (error) {
            alert(messaggioEliminazione(error, tabella) + ' Pulizia interrotta: eventuali cancellazioni DB precedenti restano applicate.')
            await caricaPreventivoLavorazioni()
            await caricaSalLavorazioni()
            return
          }
        }
        const { data: preventiviEliminati, error: errorePreventivi } = await supabase
          .from('preventivi_cantiere').delete().eq('cantiere', salCantiere).select('id, file_path')
        if (errorePreventivi) {
          alert(messaggioEliminazione(errorePreventivi, 'Preventivi') + ' Pulizia interrotta dopo la cancellazione delle lavorazioni.')
          await caricaPreventivoLavorazioni()
          await caricaSalLavorazioni()
          return
        }
        const avvisoStorage = await eliminaFilePreventivi(supabase,
          (preventiviEliminati || []).map((row: any) => row.file_path))
        if (avvisoStorage) alert(avvisoStorage)

        const { error: erroreCantiere } = await supabase
          .from('cantieri')
          .update({ preventivo: 0 })
          .eq('nome', salCantiere)

        if (erroreCantiere) {
          alert(
            'Errore azzeramento cantiere: ' +
              erroreCantiere.message
          )
          return
        }

        await caricaCantieri()
        await caricaEconomia()
        await caricaPreventivoLavorazioni()
        await caricaSalLavorazioni()

        if (!avvisoStorage) alert('Preventivi e SAL del cantiere puliti')
      }}
      style={{
        marginTop: 12,
        background: '#f97316',
        color: '#fff',
        border: 'none',
        borderRadius: 6,
        padding: '8px 12px',
        cursor: 'pointer',
      }}
    >
      Pulisci preventivo e SAL del cantiere
    </button>
  )
}
