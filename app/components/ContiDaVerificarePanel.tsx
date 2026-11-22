'use client'

import { useMemo, useRef, useState } from 'react'
import VistaOperativa from './VistaOperativa'
import { costruisciContiDaVerificare, filtraConti, GRUPPI_CONTI, chiaveConto, type ContoVerificare, type LetturaContiIncassi } from '../engines/contabilita-ditta/contiDaVerificare'
import { dataValida, type Fonti, type Periodo } from '../engines/contabilita-ditta/riepilogo'
import styles from './ContiDaVerificarePanel.module.css'

const euro = (n: number | null) => n === null ? 'Non determinabile' : (n / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
const uuid = (s: string | null | undefined): s is string => !!s && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(s)
type Props = { fonti: Fonti; periodo: Periodo; incassi: LetturaContiIncassi | null; correzioneAperta?: boolean; onVerificaAcconto?: (id: string, autore: string) => void }

export default function ContiDaVerificarePanel({ fonti, periodo, incassi, correzioneAperta = false, onVerificaAcconto }: Props) {
  const archivio = useMemo(() => costruisciContiDaVerificare(fonti, periodo, incassi), [fonti, periodo, incassi])
  const [aperto, setAperto] = useState(false), [gruppo, setGruppo] = useState(''), [cerca, setCerca] = useState(''), [pagina, setPagina] = useState(0)
  const [selezione, setSelezione] = useState<string | null>(null)
  const [versioneAperta, setVersioneAperta] = useState<{ conto: ContoVerificare; fonti: Fonti } | null>(null)
  const ritornoLista = useRef<HTMLButtonElement | null>(null), ritornoDettaglio = useRef<HTMLButtonElement | null>(null), scrollLista = useRef(0)
  const lista = filtraConti(archivio.conti, gruppo, cerca, pagina)
  const corrente = selezione ? archivio.schede.get(selezione) : null
  // Non mostrare la fotografia vecchia se cambia la sessione o scompare il record.
  const conto = corrente && versioneAperta && corrente.id === versioneAperta.conto.id && (corrente.id || versioneAperta.fonti === fonti) ? corrente : null
  const salvaPosizione = () => { scrollLista.current = document.getElementById('area-lavoro-principale')?.scrollTop ?? scrollLista.current }
  const mostra = (c: ContoVerificare, button: HTMLButtonElement) => { salvaPosizione(); ritornoDettaglio.current = button; setVersioneAperta({ conto: c, fonti }); setSelezione(c.chiave) }
  const chiudiDettaglio = () => { setSelezione(null); setVersioneAperta(null) }
  return <section className={styles.pannello} aria-label="Da verificare e sistemare">
    <h3>Da verificare e sistemare</h3>
    <p>Posizioni da controllare nelle letture disponibili, senza sommare di nuovo documenti e incassi. Periodo: {periodo.da} → {periodo.a}.</p>
    <div className={styles.gruppi}>{Object.entries(GRUPPI_CONTI).map(([key, label]) => <button type="button" key={key} onClick={e => { ritornoLista.current = e.currentTarget; setGruppo(key); setAperto(true) }}>
      {label}: <strong>{archivio.conti.filter(c => c.gruppo === key).length} posizioni caricate</strong>
    </button>)}</div>
    {!!archivio.avvisi.length && <p role="status">Copertura incompleta o da verificare: i conteggi descrivono solo le posizioni disponibili.</p>}
    <button type="button" onClick={e => { ritornoLista.current = e.currentTarget; setGruppo(''); setAperto(true) }}>Vedi tutti i conti da verificare</button>
    {aperto && <VistaOperativa titolo="Conti da verificare" etichettaRitorno="Torna a Economia generale" onChiudi={() => { salvaPosizione(); setAperto(false) }} visibile={!selezione && !correzioneAperta} ritornoFocusRef={ritornoLista} scrollRef={scrollLista}>
      <p>Periodo documenti e movimenti: {periodo.da} → {periodo.a}. Le esclusioni dai cumulativi dichiarati conservano il proprio ambito complessivo.</p>
      <p>Saldo fiscale: Non determinabile. IVA esposta e IVA detraibile restano distinte.</p>
      {!!archivio.avvisi.length && <details><summary>Disponibilità delle fonti</summary><ul>{archivio.avvisi.map((a, n) => <li key={n}>{a}</li>)}</ul></details>}
      <fieldset className={styles.filtri}><legend>Filtra conti</legend>
        <label>Gruppo <select value={gruppo} onChange={e => { setGruppo(e.target.value); setPagina(0); scrollLista.current = 0 }}><option value="">Tutti</option>{Object.entries(GRUPPI_CONTI).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
        <label>Cerca documento o movimento <input type="search" value={cerca} onChange={e => { setCerca(e.target.value); setPagina(0); scrollLista.current = 0 }} /></label>
      </fieldset>
      <p aria-live="polite">{lista.totale} posizioni disponibili · Pagina {lista.corrente + 1} di {lista.pagine}</p>
      <nav aria-label="Pagine conti da verificare" className={styles.azioni}><button type="button" disabled={lista.corrente === 0} onClick={() => setPagina(lista.corrente - 1)}>Precedente</button><button type="button" disabled={lista.corrente + 1 >= lista.pagine} onClick={() => setPagina(lista.corrente + 1)}>Successiva</button></nav>
      {!lista.righe.length && <p>Nessuna posizione disponibile per questi filtri. Una fonte mancante non equivale a un archivio senza problemi.</p>}
      <ul className={styles.elenco}>{lista.righe.map(c => <li key={c.chiave} className={styles.voce}>
        <h3>{c.controparte || 'Controparte da verificare'} · {c.numero || c.movimento?.descrizione || (c.movimento ? 'Incasso da verificare' : c.id ? 'Movimento da verificare' : 'Identità mancante')}</h3>
        {c.id && <p>Riferimento: …{c.id.slice(-8)}</p>}
        <p>{c.data || 'Data mancante'} · {c.destinazione || 'Destinazione non disponibile'}</p>
        <p>{c.problemi.map(p => p.ambito).filter((a, i, all) => all.indexOf(a) === i).join(' · ')}</p>
        <p>Lordo: {euro(c.lordo)}</p><button type="button" onClick={e => mostra(c, e.currentTarget)}>Apri dettaglio</button>
      </li>)}</ul>
    </VistaOperativa>}
    {aperto && selezione && <VistaOperativa titolo="Dettaglio conto da verificare" etichettaRitorno="Torna ai conti da verificare" onChiudi={chiudiDettaglio} ritornoFocusRef={ritornoDettaglio} visibile={!correzioneAperta}>
      {conto ? <SchedaConto conto={conto} onVerificaAcconto={onVerificaAcconto} onApriCollegata={id => {
        const scheda = archivio.schede.get(chiaveConto('fatture_emesse', id))
        if (scheda) { setVersioneAperta({ conto: scheda, fonti }); setSelezione(scheda.chiave) }
      }} collegataDisponibile={id => archivio.schede.has(chiaveConto('fatture_emesse', id))} /> : <p role="status">Record non più disponibile nelle letture correnti. Nessuna fotografia precedente utilizzata: torna all’elenco e rileggi le fonti autorizzate.</p>}
    </VistaOperativa>}
  </section>
}

export function SchedaConto({ conto: c, onVerificaAcconto, onApriCollegata, collegataDisponibile }: {
  conto: ContoVerificare; onVerificaAcconto?: Props['onVerificaAcconto']; onApriCollegata?: (id: string, button: HTMLButtonElement) => void; collegataDisponibile?: (id: string) => boolean
}) {
  const azioneAcconto = c.copie === 1 && c.movimento && uuid(c.movimento.acconto_id) && uuid(c.autore) && onVerificaAcconto
  return <article className={styles.scheda}>
    <h3>{c.controparte || 'Cliente o fornitore non disponibile'}</h3>
    <dl className={styles.dati}>
      {[['Identificativo originale', c.id || 'UUID mancante: apertura della sola fotografia locale autorizzata'], ['Numero documento', c.numero || 'Non disponibile'], ['Data', dataValida(c.data) ? c.data : c.data ? `Non valida: ${c.data}` : 'Non disponibile'], ['Cantiere o destinazione', c.destinazione || 'Non disponibile'], ['Lordo', euro(c.lordo)], ['Imponibile', euro(c.imponibile)], ['IVA esposta verificabile', euro(c.iva)], ['Importo registrato (base da verificare)', euro(c.registrato)], ['Stato dichiarato', c.stato || 'Non disponibile']].map(([nome, valore]) => <div key={nome}><dt>{nome}</dt><dd>{valore}</dd></div>)}
    </dl>
    {c.copie > 1 && <p role="status">Identificativo presente in {c.copie} registrazioni. Dati discordanti non scelti automaticamente; nessun collegamento operativo consentito.</p>}
    <h4>Perché richiede verifica</h4>
    {c.problemi.length ? c.problemi.map((p, i) => <section key={i}><h4>{p.ambito}</h4><p>{p.motivo}</p><p><strong>Verifica necessaria:</strong> {p.verifica}</p></section>) : <p>Nessuna esclusione rilevata per questo identificativo nelle letture correnti. L’assenza di esclusioni non attesta la regolarità fiscale.</p>}
    <p>Posizione fiscale: Non determinabile senza fonti validate. Nessuna imposta fiscalmente detraibile o liquidazione dedotta da questi importi.</p>
    <h4>Fonte originale</h4>
    {c.url && c.copie === 1 ? <a href={c.url} target="_blank" rel="noopener noreferrer">Apri documento originale</a> : <p>Documento originale non disponibile tramite un collegamento autorizzato nelle letture correnti.</p>}
    {c.movimento && <>
      {c.movimento.descrizione && <p>{c.movimento.descrizione}</p>}
      <p>UUID acconto collegato: {c.movimento.acconto_id}. Metodo: {c.movimento.metodo}. Fonte di verifica: {c.movimento.fonte}.</p>
      <p>Imputazione: {c.movimento.imputazione}. Stato fiscale: {c.movimento.fiscale.stato}.</p>
      <ul>{c.movimento.quote.map(q => <li key={q.id}>Fattura {q.numero || 'numero non disponibile'} · {q.fattura_id} · {q.revocata ? 'Collegamento revocato' : q.valida ? 'Copertura verificata' : 'Copertura da verificare'}
        {collegataDisponibile?.(q.fattura_id) && onApriCollegata ? <button type="button" onClick={e => onApriCollegata(q.fattura_id, e.currentTarget)}>Apri dettaglio fattura collegata</button> : <span> · Documento non disponibile nelle letture autorizzate correnti</span>}
      </li>)}</ul>
    </>}
    {azioneAcconto && c.movimento && c.autore && <section><h4>Cosa fare</h4><p>Apri il percorso esistente dell’acconto esatto. Permessi, rettifiche e conferme sono verificati dal modulo originale; nessun salvataggio avviene all’apertura.</p><button type="button" onClick={() => onVerificaAcconto?.(c.movimento!.acconto_id, c.autore!)}>Apri verifica acconto esistente</button></section>}
    <details><summary>Identificativi e dettagli tecnici</summary><p>Fonte: {c.fonte}. Identificativo: {c.id || 'mancante'}. Registrazioni: {c.copie}.</p></details>
  </article>
}
