import React, { useState } from 'react'
import { formatMoney } from './lib/utils'

export default function Dashboard() {
  const [sezioneAttiva] = useState('cantieri')
  const [sottoSezioneCantieri] = useState('scheda')
  const [cantieri] = useState<any[]>([])
  const [cantiereScheda, setCantiereScheda] = useState('')

  let datiCantiere = {
    preventivo: 0,
    costoManodopera: 0,
    costoFornitori: 0,
    costoTotale: 0,
    utileReale: 0,
  }

  let margine = 0

  if (cantiereScheda) {
    const cantiere = cantieri.find((c) => c.nome === cantiereScheda)
    const preventivo = Number(cantiere?.preventivo || 0)
    const costoTotale = 0
    const utileReale = preventivo - costoTotale

    datiCantiere = {
      preventivo,
      costoManodopera: 0,
      costoFornitori: 0,
      costoTotale,
      utileReale,
    }

    margine = preventivo > 0 ? Number(((utileReale / preventivo) * 100).toFixed(1)) : 0
  }

  return (
    <>
      {sezioneAttiva === 'cantieri' && sottoSezioneCantieri === 'scheda' && (
        <div style={{ padding: 20, border: '1px solid #ccc', borderRadius: 10 }}>
          <h2>Scheda cantiere</h2>

          <select
            value={cantiereScheda}
            onChange={(e) => setCantiereScheda(e.target.value)}
            style={{ padding: 8, width: 260, marginBottom: 15 }}
          >
            <option value="">Seleziona cantiere</option>
            {cantieri.map((c, i) => (
              <option key={c.id || i} value={c.nome}>
                {c.nome}
              </option>
            ))}
          </select>

          {!cantiereScheda ? (
            <p>Seleziona un cantiere per vedere i dettagli.</p>
          ) : (
            <div>
              <h3>{cantiereScheda}</h3>

              <div style={{ marginTop: 15, padding: 15, border: '1px solid #ddd', borderRadius: 10 }}>
                <h3 style={{ marginTop: 0 }}>Stato cantiere</h3>
                <p>Preventivo: {formatMoney(datiCantiere.preventivo)}</p>
                <p>Manodopera: {formatMoney(datiCantiere.costoManodopera)}</p>
                <p>Fornitori: {formatMoney(datiCantiere.costoFornitori)}</p>
                <p><strong>Costo totale: {formatMoney(datiCantiere.costoTotale)}</strong></p>
                <p>
                  <strong style={{ color: datiCantiere.utileReale >= 0 ? 'green' : 'red' }}>
                    Utile: {formatMoney(datiCantiere.utileReale)}
                  </strong>
                </p>
                <p><strong>Margine: {margine}%</strong></p>
              </div>

              <div style={{ marginTop: 15 }}>
                {datiCantiere.utileReale < 0 ? (
                  <strong style={{ color: 'red' }}>🚨 Cantiere in perdita</strong>
                ) : Number(margine) < 10 ? (
                  <strong style={{ color: '#f59e0b' }}>⚠️ Margine basso</strong>
                ) : (
                  <strong style={{ color: 'green' }}>✅ Cantiere in utile</strong>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}