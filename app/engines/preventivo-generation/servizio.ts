import type { ResponseCreateParamsNonStreaming } from 'openai/resources/responses/responses'
import { creaRichiestaPreventivoAi, type FotoInput } from './richiesta'
import { contestoVariante, leggiRispostaIntegrativa, messaggioAnalisiObsoleta, type SnapshotIntegrativo } from './contesto'
import type { FotoFonte } from '../variante-fonti/contratto'

import { leggiSnapshotIntegrativo } from './lettura'
export { leggiSnapshotIntegrativo } from './lettura'
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
export function richiestaIntegrativa(snapshot: SnapshotIntegrativo, foto: FotoInput[], prezzi: unknown[]) {
  const contesto = contestoVariante(snapshot)
  const request = creaRichiestaPreventivoAi({ sopralluogo: { tipo_lavoro: 'Preventivo Integrativo', note: contesto.narrativa.testoUnificato }, foto, prezzi_riferimento: prezzi })
  const input = request.input as { role: 'user'; content: ({ type: 'input_text'; text: string } | { type: 'input_image'; image_url: string; detail?: string })[] }[]
  input[0].content.splice(1, 0, { type: 'input_text', text: `MODALITA INTEGRATIVO — questo vincolo prevale sull'estensione dell'intervento.
Genera SOLO i delta documentati dalla Variante. NON ricopiare o rigenerare il contratto.
Il CONTRATTO strutturato seguente serve soltanto al confronto, non e' narrativa o una lista da riprodurre.
CONTRATTO (contesto separato): ${JSON.stringify(contesto.contestoContrattuale)}
Per ogni voce usa gli stessi campi JSON esistenti e aggiungi operazione: nuova|aumento|riduzione|eliminazione,
riferimento_preventivo_lavorazione_id: ID stringa di una voce del contratto fornito oppure null,
da_verificare: boolean. Usa quantita non negativa; il segno economico dipende dall'operazione.
Non inventare riferimenti. In caso di dubbio riferimento null, da_verificare true e revisione umana.
Riduzioni/eliminazioni soltanto se esplicitamente documentate; nessuna detrazione implicita.
Una sostituzione richiede evidenza distinta di rimozione e nuova lavorazione: non dedurre la detrazione.
Per modifiche contrattuali conserva UM/prezzo del riferimento; eliminazione riguarda soltanto il residuo verificato.
L'analisi Osservatore e' osservazione prudente, non autorizza lavorazioni o quantita non documentate.` })
  return request
}
export function parseJsonPreventivo(testo: string): unknown {
  testo = testo.replace(/```json/g, '').replace(/```/g, '').trim()
  const start = testo.indexOf('{'), end = testo.lastIndexOf('}')
  if (start >= 0 && end >= 0) testo = testo.slice(start, end + 1)
  return JSON.parse(testo)
}
type Session = { read(id: string): Promise<unknown>; prices(): Promise<unknown[]> }
const risposta = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Authorization' } })
export type DipendenzeGenerazione = {
  authorize(token: string): Promise<Session>
  photo(foto: FotoFonte, token: string): Promise<{ immagine_base64: string; sha256?: string }>
  generate(input: ResponseCreateParamsNonStreaming): Promise<{ output_text?: string | null }>
}
export function creaGeneratoreIntegrativo(dep: DipendenzeGenerazione) {
  return async (req: Request, body: unknown): Promise<Response> => {
    let fase = 'auth'
    try {
      if (!obj(body) || Object.keys(body).sort().join(',') !== 'tipo,variante_id' || body.tipo !== 'integrativo' || !uuid.test(String(body.variante_id))) return risposta({ error: 'Richiesta integrativa non valida' }, 400)
      const token = req.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1]
      if (!token) return risposta({ error: 'Accesso richiesto' }, 401)
      const session = await dep.authorize(token); fase = 'read'
      const s = leggiSnapshotIntegrativo(await session.read(String(body.variante_id)), String(body.variante_id))
      // Check stale/unavailable sources before reading bytes or invoking a provider.
      contestoVariante(s)
      if (s.lettura.fonti.foto.length > 8) throw Error('Massimo otto foto')
      const foto: FotoInput[] = []
      for (const f of s.lettura.fonti.foto) {
        const immagine = await dep.photo(f, token)
        if (s.lettura.analisi) {
          const usata = s.lettura.analisi.fonti.foto_bytes.find(b => b.source_id === f.source_id && b.source_type === f.source_type)
          if (!immagine.sha256 || usata?.sha256 !== immagine.sha256) throw Error(messaggioAnalisiObsoleta)
        }
        foto.push({ immagine_base64: immagine.immagine_base64, nota: f.foto.nota })
      }
      const request = richiestaIntegrativa(s, foto, await session.prices()); fase = 'generate'
      const raw = parseJsonPreventivo((await dep.generate(request)).output_text || '{}')
      leggiRispostaIntegrativa(raw, s.contratto)
      if (!obj(raw)) throw Error('JSON non valido')
      return risposta({ ...raw, integrativo: { contratto: s.contratto, genealogia: s.genealogia,
        firma: s.firma, manifesto: s.lettura.fonti.manifesto, analisi_id: s.lettura.analisi?.id ?? null } })
    } catch (e) {
      const stale = e instanceof Error && e.message.includes('non è allineata')
      return risposta({ error: stale ? e.message : fase === 'auth' ? 'Accesso non valido' : 'Generazione non confermata: verifica fonti e contratto prima di riprovare.' }, stale ? 409 : fase === 'auth' ? 401 : fase === 'read' ? 409 : 502)
    }
  }
}
