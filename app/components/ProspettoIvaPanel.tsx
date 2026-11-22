'use client'

import { useMemo, useRef, useState } from 'react'
import { costruisciProspettoIva, preparaArchivioIva, posizioneDocumentale, FONTI_LIQUIDAZIONE_MANCANTI, type QuotaIva } from '../engines/contabilita-ditta/prospettoIva'
import { dataValida, type Fonti, type Periodo } from '../engines/contabilita-ditta/riepilogo'
import VistaOperativa from './VistaOperativa'
import styles from './RiepilogoDittaPanel.module.css'

const euro = (n: number | null) => n === null ? 'Non determinabile' : (n / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
const copertura = (q: QuotaIva) => `${q.stato}: ${q.inclusi} inclusi, ${q.esclusi} esclusi${q.nonDatati ? ` (${q.nonDatati} senza data valida)` : ''}`

type Props = { fonti: Fonti; periodo: Periodo; onApriScadenziario?: () => void; onApri?: (destinazione: 'fatture-emesse' | 'fatture-fornitori') => void }
export default function ProspettoIvaPanel({ fonti, periodo, onApriScadenziario, onApri }: Props) {
  const archivio = useMemo(() => preparaArchivioIva(fonti), [fonti])
  const prospetto = useMemo(() => costruisciProspettoIva(archivio, periodo), [archivio, periodo])
  const [aperto, setAperto] = useState(false)
  const ritornoRef = useRef<HTMLButtonElement | null>(null)
  const totale = prospetto.totale
  const indicatori: [string, number | null][] = [
    ['IVA esposta sulle fatture emesse', totale?.emesse.valore ?? null],
    ['IVA esposta sulle fatture ricevute', totale?.ricevute.valore ?? null],
    ['Differenza IVA documentale', totale?.differenza ?? null],
  ]
  return <section aria-label="Differenza IVA sui documenti registrati" className={styles.qualita}>
    <h3>Differenza IVA sui documenti registrati</h3>
    <p>Periodo documenti: {periodo.da || 'data mancante'} → {periodo.a || 'data mancante'}. Consultazione gestionale per data documento, separata dalla liquidazione fiscale.</p>
    <dl style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }} aria-live="polite">
      {indicatori.map(([nome, valore]) => <div key={nome}><dt>{nome}</dt><dd><strong>{euro(valore)}</strong></dd></div>)}
      <div><dt>Posizione documentale</dt><dd><strong>{posizioneDocumentale(totale)}</strong></dd></div>
      <div><dt>Saldo fiscale</dt><dd>Non determinabile</dd></div>
    </dl>
    <p>L’IVA ricevuta esposta non certifica la detraibilità; l’IVA emessa esposta non certifica l’esigibilità. Incassi e acconti non vengono sommati alle imposte. Senza fattura collegata non significa IVA 0% o assenza dell’obbligo fiscale.</p>
    {prospetto.errore ? <p role="status">Non determinabile — {prospetto.errore}</p> : totale && <>
      <p><strong>{totale.stato} · Differenza del periodo: {euro(totale.differenza)}</strong> · Differenza accumulata: {euro(totale.accumulata)}</p>
      <p>Copertura emesse — {copertura(totale.emesse)}. Ricevute — {copertura(totale.ricevute)}. Posizione riferita ai soli documenti caricati; completezza esterna non certificata.</p>
      <p>Gli importi con copertura limitata sono subtotali dei soli documenti verificabili: la posizione complessiva resta Non determinabile. Il progressivo parte dal {periodo.da}, senza saldi precedenti, crediti riportati o compensazioni. Una lacuna non viene sostituita con zero.</p>
      <button ref={ritornoRef} type="button" onClick={() => setAperto(true)}>Dettaglio IVA e fonti fiscali</button>
    </>}
    {onApriScadenziario && <button type="button" onClick={onApriScadenziario}>Apri scadenziario</button>}
    {aperto && <VistaOperativa titolo="IVA documentale e fonti fiscali" etichettaRitorno="← Torna a Economia generale" onChiudi={() => setAperto(false)} ritornoFocusRef={ritornoRef}><DettagliIva fonti={fonti} archivio={archivio} prospetto={prospetto} periodo={periodo} onApri={onApri} /></VistaOperativa>}
  </section>
}

export function DettagliIva({ fonti, archivio, prospetto, periodo, onApri }: Pick<Props, "fonti" | "periodo" | "onApri"> & { archivio: ReturnType<typeof preparaArchivioIva>; prospetto: ReturnType<typeof costruisciProspettoIva> }) {
  const [filtro, setFiltro] = useState('tutti')
  const documenti = archivio.documenti.filter(d => !dataValida(d.data) || (d.data >= periodo.da && d.data <= periodo.a))
  const filtrati = documenti.filter(d => filtro === 'tutti' || (filtro === 'esclusi' ? d.iva === null : filtro === 'verificare' ? d.limitato || d.iva === null : d.iva !== null))
  return <>
    <p>Disponibile riguarda solo la fotografia caricata, non prova che tutti i documenti esterni siano registrati. I subtotali trimestrali comprendono soltanto le date selezionate.</p>
    <div className={styles.scorrimentoFonti} role="region" aria-label="Prospetto IVA mensile e trimestrale" tabIndex={0}><table className={styles.riepilogo}>
      <caption>Imposte documentali — mesi e subtotali trimestrali del periodo selezionato</caption>
      <thead><tr>{['Periodo', 'IVA emesse', 'IVA ricevute', 'Differenza', 'Differenza accumulata', 'Copertura', 'Posizione documentale'].map(t => <th scope="col" key={t}>{t}</th>)}</tr></thead>
      <tbody>{prospetto.righe.map(r => <tr key={`${r.tipo}:${r.periodo.da}`}>
        <th scope="row">{r.etichetta}</th><td>{euro(r.emesse.valore)}</td><td>{euro(r.ricevute.valore)}</td><td>{euro(r.differenza)}</td><td>{euro(r.accumulata)}</td>
        <td><strong>{r.stato}</strong><small>Emesse: {copertura(r.emesse)}<br />Ricevute: {copertura(r.ricevute)}</small></td><td>{posizioneDocumentale(r)}</td>
      </tr>)}</tbody>
    </table></div>
    <h4>Liquidazione fiscale</h4>
    <p>Saldo fiscale: <strong>Non determinabile</strong>. I documenti F24 archiviati e le scadenze manuali non certificano versamenti, compensazioni o crediti. Nessun importo viene ricavato dai PDF.</p>
    <dl>{FONTI_LIQUIDAZIONE_MANCANTI.map(([nome, fonte]) => <div key={nome}><dt>{nome}</dt><dd>Non determinabile — occorre: {fonte}.</dd></div>)}</dl>
    <details><summary>Documenti, esclusioni e limiti del calcolo ({documenti.length})</summary>
      <p>XML: imposte dichiarate in tutti i DatiRiepilogo, solo EUR e tipi ordinari supportati; TD04 sottratte una volta. Importi non riconciliabili sono esclusi. Nessuna IVA stimata da PDF/OCR, totali o aliquota predefinita.</p>
      <p>Emesse manuali: base e aliquota esplicite riconciliate con il totale, sempre Limitato. Il campo iva degli import XML è ambiguo e non viene usato senza XML fiscale registrato. Nessun download di allegati.</p>
      <p>Reverse charge, regimi speciali, split payment, IVA per cassa e IVA indetraibile non vengono trasformati in IVA esigibile o detraibile. Le rettifiche gestionali dei costi non sono sommate ai documenti.</p>
      {(['fatture_emesse', 'fatture_fornitori'] as const).map(f => <p key={f}>{f}: {fonti[f].stato}{fonti[f].limite ? ` — ${fonti[f].limite}` : ''}.</p>)}
      <label>Documenti IVA <select value={filtro} onChange={e => setFiltro(e.target.value)}><option value="tutti">Tutti</option><option value="inclusi">Inclusi</option><option value="esclusi">Esclusi</option><option value="verificare">Da verificare</option></select></label>
      <ul>{filtrati.map((d, i) => {
        const sorgente = fonti[d.fonte].righe.find(r => String(r.id) === d.id)
        const rawUrl = sorgente?.xml_url || sorgente?.pdf_url
        const url = typeof rawUrl === 'string' && /^https:\/\//i.test(rawUrl) ? rawUrl : null
        return <li key={`${d.fonte}:${d.id}:${i}`}>{d.fonte} · {d.numero || d.id || 'Senza ID'} · {d.data || 'Data mancante'} — {d.iva === null ? 'Escluso' : euro(d.iva)}: {d.motivo}
          {url && <> · <a href={url} target="_blank" rel="noopener noreferrer">Apri documento {d.numero || d.id}</a></>}
          {onApri && <button type="button" onClick={() => onApri(d.fonte === 'fatture_emesse' ? 'fatture-emesse' : 'fatture-fornitori')}>Apri registro {d.fonte === 'fatture_emesse' ? 'emesse' : 'ricevute'} · {d.numero || d.id}</button>}
          {!url && !onApri && <span> · Documento originale non disponibile in questa vista</span>}
        </li>
      })}</ul>
      {!filtrati.length && <p>Nessun documento per questo filtro.</p>}
    </details>
  </>
}
