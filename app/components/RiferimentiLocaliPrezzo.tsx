import type { RiferimentoLocale } from '../engines/price-resolution/riferimenti-locali'

export default function RiferimentiLocaliPrezzo({ riferimenti, propostaInBozza = false }: { riferimenti: readonly RiferimentoLocale[]; propostaInBozza?: boolean }) {
  if (!riferimenti.length) return null
  return <details style={{ marginTop: 10, padding: 10, border: '1px solid #94a3b8', borderRadius: 8, background: '#f8fafc', overflowWrap: 'anywhere' }}>
    <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Riferimenti locali da verificare ({riferimenti.length})</summary>
    <p>{propostaInBozza ? 'Riferimenti della proposta nella bozza: il matching originale resta non risolto. Controlla prezzo, ambito e inclusioni prima di confermare.' : 'Solo confronto informativo. La voce resta non risolta: nessun prezzo applicato.'} La somiglianza testuale non certifica l’equivalenza della prestazione.</p>
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {riferimenti.map((r, i) => <li key={`${r.fonte}:${r.codice}:${i}`} style={{ padding: '10px 0', borderTop: '1px solid #cbd5e1', fontSize: 14 }}>
        <strong>{r.fonte}</strong> · {r.codice || 'Codice non disponibile'}
        <p style={{ margin: '6px 0' }}>{r.descrizione.length > 280 ? `${r.descrizione.slice(0, 280)}…` : r.descrizione}</p>
        {r.descrizione.length > 280 && <details><summary>Descrizione completa</summary><p>{r.descrizione}</p></details>}
        <div>U.M.: {r.unitaMisura || 'Non indicata'} · Prezzo: {r.prezzo.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })} · Somiglianza testuale: {(r.somiglianza * 100).toFixed(1)}%</div>
        <ul style={{ margin: '6px 0', paddingLeft: 20, color: '#92400e' }}>{r.avvisi.map(a => <li key={a}>{a}</li>)}</ul>
      </li>)}
    </ul>
  </details>
}
