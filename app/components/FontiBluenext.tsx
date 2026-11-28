'use client'

import { useState } from 'react'
import type { ClientRiconciliazione } from '../engines/contabilita-ditta/riconciliazioneUnificata'
import { sha256 } from '../engines/fatture/bluenextIntegrato'
type Fonte = { nome: string; tipo: string; sha256: string; bytes: number; acquisita_at: string; puo_scaricare: boolean; evidenza: { ricevuta_originale: boolean; report_intermediario: unknown } }
export default function FontiBluenext({ client, fatturaId }: { client: ClientRiconciliazione; fatturaId: string }) {
  const [fonti, setFonti] = useState<Fonte[] | null>(null), [errore, setErrore] = useState(''), [busy, setBusy] = useState(false)
  async function leggi() {
    setBusy(true);setErrore('')
    try { const r = await client.rpc('elenca_fonti_bluenext', { p_fattura: fatturaId });if (r.error || !Array.isArray(r.data)) throw Error('Fonti non disponibili: verifica la disponibilità della procedura integrata.');setFonti(r.data as Fonte[]) }
    catch (e) { setErrore(e instanceof Error ? e.message : 'Fonti non disponibili.') }
    finally { setBusy(false) }
  }
  async function scarica(fonte: Fonte) {
    if (busy) return
    setBusy(true);setErrore('')
    try {
      const r = await client.rpc('leggi_fonte_bluenext', { p_fattura: fatturaId, p_sha: fonte.sha256 })
      const d = r.data as { base64?: string; sha256?: string } | null
      if (r.error || !d?.base64 || d.sha256 !== fonte.sha256) throw Error('Originale non accessibile: il file completo è riservato al suo autore.')
      const bytes = Uint8Array.from(atob(d.base64.replace(/\s/g, '')), c => c.charCodeAt(0))
      if (await sha256(bytes) !== fonte.sha256) throw Error('Integrità della fonte non verificata: download interrotto.')
      const url = URL.createObjectURL(new Blob([bytes.buffer], { type: 'application/octet-stream' }))
      const a = document.createElement('a');a.href = url;a.download = fonte.nome.split(/[\\/]/).pop() || 'fonte-bluenext';a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) { setErrore(e instanceof Error ? e.message : 'Download non completato.') }
    finally { setBusy(false) }
  }
  return <details onToggle={e => { if (e.target === e.currentTarget && e.currentTarget.open) void leggi() }}>
    <summary>Fonti originali Bluenext</summary>
    {busy && <p role="status">Verifica fonti…</p>}{errore && <p role="alert">{errore}</p>}
    {fonti?.length === 0 && <p>Nessuna fonte integrata conservata per questa fattura.</p>}
    {fonti?.map(f => <div key={f.sha256} style={{ overflowWrap: 'anywhere' }}><p>{f.nome} · {f.tipo.toUpperCase()} · {f.bytes} byte · SHA256 {f.sha256}</p>
      <p>{f.evidenza.ricevuta_originale ? 'Documento ricevuta: struttura, identificativo, file e date controllati. Provenienza attestata dall’utente; firma digitale non verificata automaticamente.' : f.tipo === 'xls' || f.tipo === 'xlsx' ? 'Report intermediario, distinto dalla ricevuta SdI.' : 'Fonte originale caricata.'}</p>
      <button type="button" disabled={busy || !f.puo_scaricare} onClick={() => void scarica(f)}>Scarica originale verificato</button>
      {!f.puo_scaricare && <p>Il report completo può contenere altri documenti: originale riservato all’autore del caricamento.</p>}
    </div>)}
  </details>
}
