'use client'

import { useEffect, useState } from 'react'
import { caricaRaccolteSorgenti, type CollegamentoRaccolta, type LettoreRaccoltaSorgente } from '../engines/economia/raccoltaSorgenteVariante'

export function SchedaRaccoltaSorgente({ valore, onApri }: { valore: CollegamentoRaccolta; onApri: () => void }) {
  return <section aria-label="Raccolta Economia collegata" style={{ marginTop: 12, padding: 12, border: '1px solid #cbd5e1', borderRadius: 8 }}>
    <h5>Raccolta Economia collegata</h5><p>{valore.nome}</p>
    <p>Stato raccolta corrente: {valore.statoCorrente || 'Non disponibile'}<br />Revisione sorgente: {valore.revisioneSorgente}<br />Revisione acquisita (congelata): {valore.revisioneCongelata}<br />Revisione corrente: {valore.revisioneCorrente ?? 'Non disponibile'}{valore.data && <><br />Data acquisita: {valore.data}</>}</p>
    {valore.integrazioniSuccessive && <p role="note">La raccolta Economia contiene integrazioni successive alla revisione acquisita in questa Variante.</p>}
    {!valore.correnteDisponibile && <p role="status">Raccolta corrente non disponibile. Il collegamento acquisito resta invariato.</p>}
    <button type="button" disabled={!valore.correnteDisponibile} onClick={onApri}>Apri raccolta Economia</button>
  </section>
}
export default function RaccoltaSorgenteVariante({ client, sorgenti, varianteId, cantiereId }: {
  client: LettoreRaccoltaSorgente; sorgenti: readonly Record<string, any>[] | null; varianteId: string; cantiereId: string
}) {
  const [esito, setEsito] = useState<{ sorgenti: typeof sorgenti; client: LettoreRaccoltaSorgente; varianteId: string; cantiereId: string; collegamenti: CollegamentoRaccolta[] | null } | null>(null)
  const [aperta, setAperta] = useState<string | null>(null)
  useEffect(() => {
    let attivo = true
    setEsito(null); setAperta(null)
    if (sorgenti === null) return () => { attivo = false }
    void caricaRaccolteSorgenti(client, sorgenti, varianteId, cantiereId).then(
      collegamenti => { if (attivo) setEsito({ sorgenti, client, varianteId, cantiereId, collegamenti }) },
      () => { if (attivo) setEsito({ sorgenti, client, varianteId, cantiereId, collegamenti: null }) },
    )
    return () => { attivo = false }
  }, [client, sorgenti, varianteId, cantiereId])
  if (sorgenti === null || !sorgenti.some(s => s.tipo === 'raccolta_economia')) return null
  const corrente = esito?.sorgenti === sorgenti && esito.client === client && esito.varianteId === varianteId && esito.cantiereId === cantiereId ? esito : null
  if (!corrente) return <p role="status">Verifica raccolta sorgente…</p>
  if (!corrente.collegamenti) return <p role="status">Collegamento raccolta sorgente non verificabile.</p>
  const dettaglio = corrente.collegamenti.find(c => c.raccoltaId === aperta)
  return <>{corrente.collegamenti.map(c => <SchedaRaccoltaSorgente key={c.sorgenteId} valore={c} onApri={() => setAperta(c.raccoltaId)} />)}
    {dettaglio && <section aria-label="Consultazione raccolta sorgente" style={{ padding: 12, marginTop: 8, border: '1px solid #cbd5e1' }}>
      <h5>{dettaglio.nome} — raccolta corrente, sola lettura</h5><p>ID raccolta: {dettaglio.raccoltaId}. Revisione corrente: {dettaglio.revisioneCorrente}.</p>
      <p>Questa consultazione non aggiorna lo snapshot acquisito nella Variante.</p>
      <div style={{ overflowX: 'auto' }}><table><thead><tr>{['Descrizione','Quantità','U.M.','Prezzo unitario'].map(t => <th scope="col" key={t}>{t}</th>)}</tr></thead><tbody>{dettaglio.righeCorrenti.map(r => <tr key={r.id}>{[r.descrizione,r.quantita,r.um,r.prezzo].map((v,i) => <td key={i} style={{ padding: 8, whiteSpace: 'pre-wrap' }}>{v}</td>)}</tr>)}</tbody></table></div>
      <button type="button" onClick={() => setAperta(null)}>Chiudi raccolta Economia</button>
    </section>}
  </>
}
