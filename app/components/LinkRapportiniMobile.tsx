'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { LINK_PORTALE_PREDEFINITO, leggiLinkPortale, salvaLinkPortale, validaLinkPortale, type ClientLinkPortale, type ConfigLinkPortale } from '../engines/rapportini/linkPortale'

export default function LinkRapportiniMobile({ client, buttonPrimary, buttonSecondary, inputStyle }: { client: ClientLinkPortale; buttonPrimary: CSSProperties; buttonSecondary: CSSProperties; inputStyle: CSSProperties }) {
  const [config, setConfig] = useState<ConfigLinkPortale | null>(null)
  const [errore, setErrore] = useState('')
  const [esito, setEsito] = useState('')
  const [modifica, setModifica] = useState(false)
  const [bozza, setBozza] = useState('')
  const [attesa, setAttesa] = useState(false)
  const invio = useRef(false)
  useEffect(() => {
    let attivo = true
    void leggiLinkPortale(client).then(c => { if (attivo) setConfig(c) }).catch(e => { if (attivo) setErrore(e instanceof Error ? e.message : 'Impostazioni non disponibili.') })
    return () => { attivo = false }
  }, [client])
  let href: string | null = null, problema = ''
  try { href = validaLinkPortale(config ? config.url : LINK_PORTALE_PREDEFINITO) } catch (e) { problema = e instanceof Error ? e.message : 'Link non valido.' }
  const salva = async () => {
    if (invio.current) return
    try { validaLinkPortale(bozza) } catch (e) { setErrore(e instanceof Error ? e.message : 'Link non valido.'); return }
    invio.current = true; setAttesa(true); setErrore(''); setEsito('')
    try {
      const salvato = await salvaLinkPortale(client, bozza)
      setConfig(salvato); setModifica(false)
      try {
        const riletto = await leggiLinkPortale(client)
        if (riletto.url !== salvato.url) throw Error('Configurazione variata durante la verifica.')
        setConfig(riletto); setEsito('Link salvato e riletto correttamente.')
      } catch { setEsito('Link salvato; rilettura non confermata. Ricaricare le impostazioni senza ripetere la scrittura.') }
    } catch (e) { setErrore(e instanceof Error ? e.message : 'Salvataggio non confermato.'); setConfig(c => c ? { ...c, modificabile: false } : c); setModifica(false) }
    finally { invio.current = false; setAttesa(false) }
  }
  return <section aria-label="Portale Rapportini Mobile" style={{ padding: 14, border: '1px solid #cbd5e1', borderRadius: 10, marginBottom: 16 }}>
    <h3 style={{ marginTop: 0 }}>Portale Rapportini Mobile</h3>
    <p>Accesso al portale operai in una nuova scheda. La gestione dei rapportini resta in questa pagina.</p>
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
      {href ? <a href={href} target="_blank" rel="noopener noreferrer" style={{ ...buttonPrimary, display: 'inline-block', textDecoration: 'none', whiteSpace: 'normal' }}>Apri Rapportini Mobile</a> : <button type="button" disabled style={buttonPrimary}>Apri Rapportini Mobile</button>}
      {config?.modificabile && !modifica && <button type="button" style={buttonSecondary} onClick={() => { setBozza(config.url || ''); setModifica(true); setErrore(''); setEsito('') }}>Modifica link</button>}
    </div>
    {!config && !errore && <p role="status">Caricamento impostazioni; portale interno disponibile.</p>}
    {problema && <p role="alert">{problema}</p>}
    {errore && <p role="alert">{errore}</p>}
    {esito && <p role="status">{esito}</p>}
    {modifica && <div style={{ marginTop: 12 }}>
      <label htmlFor="url-portale-rapportini">URL del Portale Rapportini Mobile</label>
      <input id="url-portale-rapportini" type="text" inputMode="url" value={bozza} onChange={e => setBozza(e.target.value)} disabled={attesa} style={{ ...inputStyle, display: 'block', width: '100%', boxSizing: 'border-box', margin: '8px 0' }} />
      <p>Consigliato: /rapportino, relativo a questa applicazione e senza dominio da aggiornare. In alternativa è ammesso un URL HTTPS.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}><button type="button" disabled={attesa} style={buttonPrimary} onClick={() => void salva()}>{attesa ? 'Salvataggio…' : 'Salva'}</button><button type="button" disabled={attesa} style={buttonSecondary} onClick={() => { setModifica(false); setErrore('') }}>Annulla</button></div>
    </div>}
  </section>
}
