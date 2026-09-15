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
