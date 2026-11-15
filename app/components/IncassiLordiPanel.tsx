'use client'

import { useRef, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'

type Incasso = { id: string; importo: number; ricevuto_il: string; riferimento: string; disponibile: number }
type Quota = { id: string; numero_fattura: string | null; importo: number; revocato_at: string | null }
type Imputazione = { revisione: number; destinazione: string; motivo: string; autore: string; registrata_at: string }
const destinazioni = { contratto: "Contratto principale", economia: "Lavori in economia", da_verificare: "Da verificare" } as const

type Lettura = { totale: number | null; attribuito: number | null; residuo: number | null; incassi: Incasso[]; quote: Quota[]; imputazioni: Imputazione[] | null; imputazione_effettiva: keyof typeof destinazioni | null }
type Operazione = { rpc: string; args: Record<string, string> }
const euro = (n: number | null) => n === null ? 'Da verificare' : n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })

export default function IncassiLordiPanel({ id, contesto, netto }: {
  id: string; contesto: 'acconto' | 'fattura'; netto?: number | string | null
}) {
  const [dati, setDati] = useState<Lettura | null>(null)
  const [messaggio, setMessaggio] = useState('')
  const [attesa, setAttesa] = useState(false)
  const blocco = useRef(false)
  const chiave = 'artecna-incasso-lordo:' + contesto + ':' + id
  const [pendente, setPendente] = useState<Operazione | null>(() => {
    try { return JSON.parse(sessionStorage.getItem(chiave) ?? 'null') as Operazione | null }
    catch { return null }
  })
  const fattura = contesto === 'fattura'

  async function esegui(op?: Operazione) {
    if (blocco.current) return
    blocco.current = true
    setAttesa(true)
    setMessaggio('')
    try {
      if (op) {
        sessionStorage.setItem(chiave, JSON.stringify(op))
        setPendente(op)
        const { error } = await supabase.rpc(op.rpc, op.args)
        if (error && !['22023','23505','23514','23503','42501','40001'].includes(error.code)) throw error
        sessionStorage.removeItem(chiave)
        setPendente(null)
        setMessaggio(error ? error.message : 'Operazione confermata.')
        if (!error) window.dispatchEvent(new Event('artecna-incassi-lordi-aggiornati'))
      }
      const { data, error } = await supabase.rpc('leggi_incassi_lordi_cliente', { p_id: id, p_contesto: contesto })
      if (!error) setDati(data as Lettura)
      else setMessaggio('Lettura non disponibile. Aggiorna per vedere la situazione attuale.')
    } catch { setMessaggio('Esito non confermato. Recupera la stessa richiesta.') }
    finally { blocco.current = false; setAttesa(false) }
  }

  function salva(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pendente || attesa) return
    const campi = new FormData(e.currentTarget)
    const valore = (nome: string) => String(campi.get(nome) ?? '')
    const base = { p_id: crypto.randomUUID(), p_importo: valore('importo').trim().replace(',', '.') }
    void esegui(fattura
      ? { rpc: 'attribuisci_incasso_lordo_cliente', args: { ...base, p_fattura: id, p_incasso: valore('incasso') } }
      : { rpc: 'conferma_incasso_lordo_cliente', args: { ...base, p_acconto: id, p_data: valore('data'),
          p_metodo: valore('metodo'), p_riferimento: valore('riferimento'), p_fonte: valore('fonte') } })
  }

  return <details onToggle={e => { if (e.currentTarget.open) void esegui() }}>
    <summary>Incassi lordi verificati</summary>
    {messaggio && <p role="status">{messaggio}</p>}
    <button type="button" disabled={attesa} onClick={() => void esegui()}>Aggiorna incassi</button>
    {pendente && <button type="button" disabled={attesa} onClick={() => void esegui(pendente)}>Recupera richiesta</button>}
    {dati && <>
      {fattura ? <dl>
        <dt>Totale IVA inclusa</dt><dd>{euro(dati.totale)}</dd>
        <dt>Incassi lordi attribuiti</dt><dd>{euro(dati.attribuito)}</dd>
        <dt>Residuo finanziario verificabile</dt><dd>{euro(dati.residuo)}</dd>
      </dl> : <>
        <p>Importo registrato: {euro(netto == null ? null : Number(netto))}</p>
        <p>Incasso lordo confermato: {euro(dati.incassi.length ? dati.incassi.reduce((somma, i) => somma + i.importo, 0) : null)}</p>
        <p>Imputazione attuale: {destinazioni[dati.imputazione_effettiva ?? "da_verificare"]}</p>
        <form onSubmit={e => {
          e.preventDefault()
          const campi = new FormData(e.currentTarget)
          void esegui({ rpc: "imputa_acconto_cliente", args: { p_richiesta: crypto.randomUUID(), p_acconto: id,
            p_revisione: String(dati.imputazioni?.[0]?.revisione ?? 0), p_destinazione: String(campi.get("destinazione") ?? ""),
            p_motivo: String(campi.get("motivo") ?? "") } })
        }}>
          <fieldset disabled={attesa || !!pendente}>
            <label>Imputazione <select name="destinazione" defaultValue="da_verificare">
              {Object.entries(destinazioni).map(([valore, nome]) => <option key={valore} value={valore}>{nome}</option>)}
            </select></label>
            <label>Motivo della scelta <input name="motivo" required maxLength={500} /></label>
            <button type="submit">Registra imputazione</button>
          </fieldset>
        </form>
        {!!dati.imputazioni?.length && <details><summary>Storico imputazioni</summary><ol>
          {dati.imputazioni.map(i => <li key={i.revisione}>{i.registrata_at} · {destinazioni[i.destinazione as keyof typeof destinazioni]} · {i.motivo} · {i.autore}</li>)}
        </ol></details>}
        {dati.incassi.map(i => <p key={i.id}>{i.ricevuto_il} · {euro(i.importo)} · Disponibile {euro(i.disponibile)}</p>)}
      </>}
      {dati.quote.map(q => <p key={q.id}>Fattura {q.numero_fattura ?? 'senza numero'} · {euro(q.importo)}
        {q.revocato_at ? ' · Revocata' : fattura && <button type="button" disabled={attesa || !!pendente}
          onClick={() => { if (window.confirm('Revocare la quota finanziaria?')) void esegui({
            rpc: 'revoca_quota_lorda_cliente', args: { p_id: crypto.randomUUID(), p_quota: q.id },
          }) }}>Revoca quota</button>}</p>)}
      {(!fattura || dati.totale !== null && dati.incassi.some(i => i.disponibile > 0)) && <form onSubmit={salva}>
        <fieldset disabled={attesa || !!pendente}>
          <label>Importo lordo <input name="importo" required inputMode="decimal" /></label>
          {fattura ? <label>Pagamento <select name="incasso" required><option value="">Seleziona</option>
            {dati.incassi.filter(i => i.disponibile > 0).map(i => <option value={i.id} key={i.id}>
              {i.ricevuto_il} · {i.riferimento} · {euro(i.disponibile)}
            </option>)}</select></label> : <>
            <label>Data effettiva <input name="data" type="date" required /></label>
            <label>Metodo <select name="metodo"><option value="bonifico">Bonifico</option><option value="contanti">Contanti</option><option value="altro">Altro</option></select></label>
            <label>Riferimento univoco <input name="riferimento" required maxLength={200} /></label>
            <label>Fonte della verifica <input name="fonte" required maxLength={200} /></label>
          </>}
          <label><input type="checkbox" required /> Ho verificato pagamento e riferimento documentale.</label>
          <button type="submit">{fattura ? 'Attribuisci quota lorda' : 'Conferma pagamento lordo'}</button>
        </fieldset>
      </form>}
    </>}
  </details>
}
