'use client'

type Props = {
  cantiereScheda: string
  cantieri: any[]
  supabase: any
  caricaCantieri: () => Promise<void>
}

export default function DashboardEconomiaPanel({
  cantiereScheda,
  cantieri,
  supabase,
  caricaCantieri,
}: Props) {
  const cantiereCorrente = cantieri.find((c) => c.nome === cantiereScheda)

  return (
    <>
      <h3>{cantiereScheda}</h3>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 10,
          marginBottom: 15,
          padding: 12,
          border: '1px solid #ddd',
          borderRadius: 8,
          background: '#f8fafc',
        }}
      >
        <label>
          <strong>Data inizio lavori</strong>
          <input
            type="date"
            value={cantiereCorrente?.data_inizio_lavori || ''}
            onChange={async (e) => {
              const nuovaData = e.target.value || null

              const { error } = await supabase
                .from('cantieri')
                .update({ data_inizio_lavori: nuovaData })
                .eq('nome', cantiereScheda)

              if (error) {
                alert('Errore salvataggio data inizio: ' + error.message)
                return
              }

              await caricaCantieri()
            }}
          />
        </label>

        <label>
          <strong>Data fine lavori</strong>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="date"
              value={cantiereCorrente?.data_fine_lavori || ''}
              onChange={async (e) => {
                const nuovaData = e.target.value || null

                const { error } = await supabase
                  .from('cantieri')
                  .update({ data_fine_lavori: nuovaData })
                  .eq('nome', cantiereScheda)

                if (error) {
                  alert('Errore salvataggio data fine: ' + error.message)
                  return
                }

                await caricaCantieri()
              }}
            />

            <input
              type="checkbox"
              title="Considera lavori conclusi"
              checked={Boolean(cantiereCorrente?.lavori_conclusi)}
              onChange={async (e) => {
                const concluso = e.target.checked

                const { error } = await supabase
                  .from('cantieri')
                  .update({ lavori_conclusi: concluso })
                  .eq('nome', cantiereScheda)

                if (error) {
                  alert('Errore aggiornamento stato lavori: ' + error.message)
                  return
                }

                await caricaCantieri()
              }}
              style={{
                width: 18,
                height: 18,
                cursor: 'pointer',
                marginBottom: 10,
              }}
            />
          </div>
        </label>
      </div>
    </>
  )
}