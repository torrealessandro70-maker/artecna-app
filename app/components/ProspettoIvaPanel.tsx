'use client'

import { useMemo } from 'react'
import { costruisciProspettoIva, preparaArchivioIva, type QuotaIva } from '../engines/contabilita-ditta/prospettoIva'
import { dataValida, type Fonti, type Periodo } from '../engines/contabilita-ditta/riepilogo'
import styles from './RiepilogoDittaPanel.module.css'

const euro = (n: number | null) => n === null ? 'Non determinabile' : (n / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
const copertura = (q: QuotaIva) => `${q.stato}: ${q.inclusi} inclusi, ${q.esclusi} esclusi${q.nonDatati ? ` (${q.nonDatati} senza data valida)` : ''}`

export default function ProspettoIvaPanel({ fonti, periodo }: { fonti: Fonti; periodo: Periodo }) {
  const archivio = useMemo(() => preparaArchivioIva(fonti), [fonti])
  const prospetto = useMemo(() => costruisciProspettoIva(archivio, periodo), [archivio, periodo])
  const totale = prospetto.totale
  const documenti = archivio.documenti.filter(d => !dataValida(d.data) || (d.data >= periodo.da && d.data <= periodo.a))
  return <section aria-label="Differenza IVA sui documenti registrati" className={styles.qualita}>
    <h3>Differenza IVA sui documenti registrati</h3>
    <p>Consultazione gestionale per data documento. Separata dalla contabilità ufficiale e dalla liquidazione fiscale; l’IVA ricevuta esposta non certifica la detraibilità.</p>
    {prospetto.errore ? <p role="status">Non determinabile — {prospetto.errore}</p> : totale && <>
      <p aria-live="polite"><strong>{totale.stato} · Differenza del periodo: {euro(totale.differenza)}</strong><br />IVA emesse: {euro(totale.emesse.valore)} · IVA ricevute: {euro(totale.ricevute.valore)}<br />Differenza accumulata: {euro(totale.accumulata)}</p>
      <p>Copertura emesse — {copertura(totale.emesse)}. Ricevute — {copertura(totale.ricevute)}.</p>
      <p>Gli importi con copertura limitata sono subtotali dei soli documenti verificabili. Il progressivo parte dal {periodo.da}, senza saldi precedenti, crediti riportati o compensazioni. Una lacuna non viene sostituita con zero.</p>
      <details><summary>Mostra prospetto mensile e trimestrale</summary>
        <div className={styles.scorrimentoFonti} role="region" aria-label="Prospetto IVA mensile e trimestrale" tabIndex={0}><table className={styles.riepilogo}>
          <caption>Imposte documentali — mesi e subtotali trimestrali del periodo selezionato</caption>
          <thead><tr>{['Periodo', 'IVA emesse', 'IVA ricevute', 'Differenza', 'Differenza accumulata', 'Copertura'].map(t => <th scope="col" key={t}>{t}</th>)}</tr></thead>
          <tbody>{prospetto.righe.map(r => <tr key={`${r.tipo}:${r.periodo.da}`}>
            <th scope="row">{r.etichetta}</th><td>{euro(r.emesse.valore)}</td><td>{euro(r.ricevute.valore)}</td><td>{euro(r.differenza)}</td><td>{euro(r.accumulata)}</td>
            <td><strong>{r.stato}</strong><small>Emesse: {copertura(r.emesse)}<br />Ricevute: {copertura(r.ricevute)}</small></td>
          </tr>)}</tbody>
        </table></div>
        <details><summary>Documenti, esclusioni e limiti del calcolo ({documenti.length})</summary>
          <p>XML: imposte dichiarate in tutti i DatiRiepilogo, solo EUR e tipi ordinari supportati; TD04 sottratte una volta. Importi non riconciliabili sono esclusi. Nessuna IVA stimata da PDF/OCR, totali o aliquota predefinita.</p>
          <p>Emesse manuali: base e aliquota esplicite riconciliate con il totale, sempre Limitato. Il campo iva degli import XML è ambiguo e non viene usato senza XML fiscale registrato. Nessun download di allegati.</p>
          <p>Non si ricostruiscono regimi speciali, detraibilità, liquidazioni per cassa, split payment o scadenze. Esigibilità speciale segnalata come Limitato. Le rettifiche gestionali dei costi non sono sommate ai documenti.</p>
          <p>Disponibile riguarda solo la fotografia caricata, non prova che tutti i documenti esterni siano registrati. I subtotali trimestrali comprendono soltanto le date selezionate.</p>
          {(['fatture_emesse', 'fatture_fornitori'] as const).map(f => <p key={f}>{f}: {fonti[f].stato}{fonti[f].limite ? ` — ${fonti[f].limite}` : ''}.</p>)}
          <ul>{documenti.map((d, i) => <li key={`${d.fonte}:${d.id}:${i}`}>{d.fonte} · {d.numero || d.id || 'Senza ID'} · {d.data || 'Data mancante'} — {d.iva === null ? 'Escluso' : euro(d.iva)}: {d.motivo}</li>)}</ul>
        </details>
      </details>
    </>}
  </section>
}
