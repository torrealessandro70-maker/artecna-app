'use client'

import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'

type Quota = { attribuzione_id: string; quota: number | string }
type Lettura = {
  revisione: number
  stato?: string
  termine?: string
  giorni_residui?: number
  data_fiscale?: string
  tipo?: string
  esito?: string
  trasmessa_at?: string
  esito_at?: string
  protocollo?: string
  ricevuta?: string
  rettifica_id?: string
  quote?: Quota[]
}

function LocaleData(value: string | undefined) {
  if (!value) return ''
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export default function ContrattoFiscalePanel({ id, acconto = false, dataIncasso }: {
  id: string; acconto?: boolean; dataIncasso?: string | null
}) {
  const [dati, setDati] = useState<Lettura>()
  const [errore, setErrore] = useState('')
  const [occupato, setOccupato] = useState(false)
  const [quote, setQuote] = useState<Quota[]>([])
  const [tipo, setTipo] = useState('TD01')

  async function leggi() {
    const { data, error } = await supabase.rpc(acconto ? 'leggi_acconto_fiscale' : 'leggi_fattura_sdi', { p_id: id })
    if (error) {
      setDati(undefined)
      setErrore('Lettura fiscale non disponibile.')
      return
    }
    const lettura = data as Lettura
    setDati(lettura)
    setQuote(lettura.quote ?? [])
    setTipo(lettura.tipo ?? 'TD01')
  }

  async function salva(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!dati || occupato) return
    const form = new FormData(event.currentTarget)
    const campo = (nome: string) => String(form.get(nome) ?? '').trim() || null
    const istante = (nome: string) => {
      const valore = campo(nome)
      return valore ? new Date(valore).toISOString() : null
    }
    setOccupato(true)
    setErrore('')
    try {
      const comune = { p_id: id, p_revisione: dati.revisione }
      const { error } = acconto
        ? await supabase.rpc('registra_acconto_fiscale', {
          ...comune, p_stato: campo('stato'), p_regime: campo('regime'),
          p_data: campo('stato') === 'incassato' ? campo('data') : null, p_motivo: campo('motivo'),
        })
        : await supabase.rpc('registra_evidenza_sdi', {
          ...comune, p_tipo: tipo, p_esito: campo('esito'), p_trasmessa: istante('trasmessa'),
          p_esito_at: istante('esito_at'), p_protocollo: campo('protocollo'), p_ricevuta: campo('ricevuta'),
          p_rettifica: tipo === 'TD04' ? campo('rettifica') : null,
          p_quote: tipo === 'TD04' ? quote : [],
        })
      if (error) setErrore(error.message)
      else await leggi()
    } finally {
      setOccupato(false)
    }
  }

  return <details onToggle={e => { if (e.currentTarget.open) void leggi() }}>
    <summary>{acconto ? 'Stato fiscale acconto' : 'Tipo fiscale, SdI e storni'}</summary>
    {errore && <p role="alert">{errore}</p>}
    {dati && <>
      <p>{acconto ? dati.stato : [dati.tipo, dati.esito?.replaceAll('_', ' ')].filter(Boolean).join(' · ')}
        {dati.termine && ` · Termine ${dati.termine} (${dati.giorni_residui} giorni)`}</p>
      <form key={dati.revisione} onSubmit={salva}>
        <fieldset disabled={occupato}>
          {acconto ? <>
            <label>Incasso <select name="stato" defaultValue="da_verificare">
              <option value="da_verificare">Da verificare</option>
              <option value="previsto">Previsto</option>
              <option value="incassato">Confermo l’incasso</option>
              <option value="stornato">Stornato</option>
            </select></label>
            <label>Data fiscale <input type="date" name="data" defaultValue={dati.data_fiscale ?? dataIncasso ?? ''} /></label>
            <label>Fatturazione <select name="regime"><option value="da_verificare">Da verificare</option><option value="ordinario">Immediata ordinaria</option></select></label>
            <label>Motivo <input name="motivo" required maxLength={500} /></label>
          </> : <>
            <label>Tipo fiscale <select value={tipo} disabled={!!dati.tipo} onChange={e => setTipo(e.target.value)}>
              <option>TD01</option><option>TD02</option><option>TD04</option>
            </select></label>
            <label>Esito SdI <select name="esito" defaultValue={dati.esito}>
              <option value="da_verificare">Da verificare</option><option value="bozza">Bozza</option>
              <option value="inviata">Inviata</option><option value="consegnata">Consegnata</option>
              <option value="mancata_consegna">Mancata consegna</option><option value="scartata">Scartata</option>
            </select></label>
            <label>Trasmissione <input type="datetime-local" name="trasmessa" defaultValue={LocaleData(dati.trasmessa_at)} /></label>
            <label>Data esito <input type="datetime-local" name="esito_at" defaultValue={LocaleData(dati.esito_at)} /></label>
            <label>Protocollo <input name="protocollo" maxLength={150} defaultValue={dati.protocollo ?? ''} /></label>
            <label>Riferimento ricevuta <input name="ricevuta" maxLength={500} defaultValue={dati.ricevuta ?? ''} /></label>
            {tipo === 'TD04' && <>
              <label>UUID fattura rettificata <input name="rettifica" defaultValue={dati.rettifica_id ?? ''} /></label>
              {quote.map((q, i) => <div key={i}>
                <label>UUID attribuzione <input required value={q.attribuzione_id}
                  onChange={e => setQuote(quote.map((r, j) => j === i ? { ...r, attribuzione_id: e.target.value } : r))} /></label>
                <label>Quota stornata <input required type="number" min="0.01" step="0.01" value={q.quota}
                  onChange={e => setQuote(quote.map((r, j) => j === i ? { ...r, quota: e.target.value } : r))} /></label>
                <button type="button" onClick={() => setQuote(quote.filter((_, j) => j !== i))}>Rimuovi quota</button>
              </div>)}
              <button type="button" onClick={() => setQuote([...quote, { attribuzione_id: '', quota: '' }])}>Aggiungi quota</button>
            </>}
          </>}
          <button type="submit">{acconto ? 'Registra stato fiscale' : 'Registra evidenza SdI'}</button>
        </fieldset>
      </form>
    </>}
  </details>
}
