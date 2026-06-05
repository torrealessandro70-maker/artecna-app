'use client'

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

        const preventiviDaEliminare = preventivi.filter(
          (p) => p.cantiere === salCantiere
        )

        const fileDaEliminare = preventiviDaEliminare
          .map((p) => p.file_path)
          .filter((path): path is string => Boolean(path))

        if (fileDaEliminare.length > 0) {
          await supabase.storage
            .from('preventivi')
            .remove(fileDaEliminare)
        }

        const { error: errorePreventivi } = await supabase
          .from('preventivi_cantiere')
          .delete()
          .eq('cantiere', salCantiere)

        if (errorePreventivi) {
          alert(
            'Errore eliminazione preventivi: ' +
              errorePreventivi.message
          )
          return
        }

        const { error: erroreLavorazioniPreventivo } =
          await supabase
            .from('preventivo_lavorazioni')
            .delete()
            .eq('cantiere', salCantiere)

        if (erroreLavorazioniPreventivo) {
          alert(
            'Errore eliminazione lavorazioni preventivo: ' +
              erroreLavorazioniPreventivo.message
          )
          return
        }

        const { error: erroreSal } = await supabase
          .from('sal_lavorazioni')
          .delete()
          .eq('cantiere', salCantiere)

        if (erroreSal) {
          alert(
            'Errore eliminazione SAL: ' +
              erroreSal.message
          )
          return
        }

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

        alert('Preventivi e SAL del cantiere puliti')
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
