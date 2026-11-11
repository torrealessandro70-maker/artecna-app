import type { SupabaseClient } from '@supabase/supabase-js'
import { dataValida } from './riepilogo'

export const BUCKET_FISCALE = 'documenti-fiscali-privati'
export const LIMITE_PDF_FISCALE = 10 * 1024 * 1024
const MIME = 'application/pdf'
export type ClientDocumentiFiscali = Pick<SupabaseClient, 'rpc' | 'storage'>
export type MetadatoFiscale = { tipo: 'F24' | 'Altro'; nome: string; data: string }
export type DocumentoFiscale = {
  id: string
  tipo_documento: MetadatoFiscale['tipo']
  nome_file: string
  data_documento: string | null
  storage_path: string
  revisione: number
  byte_size: number
  caricato_at: string | null
  archiviata_at: string | null
}

function documento(raw: unknown): DocumentoFiscale {
  const d = raw as DocumentoFiscale
  if (!d || typeof d.id !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(d.id)
    || d.storage_path !== 'documenti/' + d.id + '.pdf'
    || !['F24', 'Altro'].includes(d.tipo_documento) || typeof d.nome_file !== 'string'
    || (d.data_documento !== null && !dataValida(d.data_documento))
    || !Number.isSafeInteger(d.revisione) || d.revisione < 0
    || !Number.isInteger(d.byte_size) || d.byte_size < 1 || d.byte_size > LIMITE_PDF_FISCALE
    || (d.caricato_at !== null && typeof d.caricato_at !== 'string')
    || (d.archiviata_at !== null && typeof d.archiviata_at !== 'string')) throw Error('Risposta documentale non valida.')
  return d
}

function parametri(dati: MetadatoFiscale) {
  const nome = dati.nome.trim()
  if (!nome || nome.length > 255 || /[\/\\\x00-\x1f\x7f]/.test(nome) || (dati.data && !dataValida(dati.data))) {
    throw Error('Verificare nome e data del documento.')
  }
  return { p_tipo: dati.tipo, p_nome: nome, p_data: dati.data || null }
}

export async function verificaPdfFiscale(file: File) {
  if (file.type !== MIME || file.size < 5 || file.size > LIMITE_PDF_FISCALE
    || await file.slice(0, 5).text() !== '%PDF-') throw Error('Selezionare un PDF valido fino a 10 MiB.')
}

export function creaArchivioDocumentiFiscali(client: ClientDocumentiFiscali) {
  async function rpc(nome: string, argomenti?: Record<string, unknown>) {
    const { data, error } = await client.rpc(nome, argomenti)
    if (error?.code === '40001') throw Error('Conflitto di revisione: rileggere il registro prima di modificare.')
    if (error) throw Error('Operazione documentale non confermata. Rileggere il registro.')
    return data as unknown
  }
  const storage = () => client.storage.from(BUCKET_FISCALE)
  return {
    async elenco() {
      const dati = await rpc('elenca_documenti_fiscali')
      if (!Array.isArray(dati)) throw Error('Registro documenti non disponibile.')
      return dati.map(documento)
    },
    async crea(dati: MetadatoFiscale, file: File, id: string) {
      await verificaPdfFiscale(file)
      if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id)) throw Error('Identità richiesta non valida.')
      const creato = documento(await rpc('crea_documento_fiscale', { p_id: id, ...parametri(dati), p_byte_size: file.size }))
      if (creato.id !== id) throw Error('Registrazione non confermata. Rileggere il registro.')
      return creato
    },
    async aggiorna(id: string, revisione: number, dati: MetadatoFiscale) {
      return documento(await rpc('aggiorna_documento_fiscale', { p_id: id, p_revisione_attesa: revisione, ...parametri(dati) }))
    },
    async archivia(id: string, revisione: number) {
      return documento(await rpc('archivia_documento_fiscale', { p_id: id, p_revisione_attesa: revisione }))
    },
    async conferma(id: string) {
      const confermato = documento(await rpc('conferma_upload_documento_fiscale', { p_id: id }))
      if (confermato.id !== id || !confermato.caricato_at) throw Error('Upload non confermato.')
      return confermato
    },
    async carica(raw: DocumentoFiscale, file: File) {
      const d = documento(raw)
      await verificaPdfFiscale(file)
      if (d.caricato_at || d.archiviata_at || file.size !== d.byte_size) throw Error('PDF non coerente con la prenotazione.')
      const firma = await storage().createSignedUploadUrl(d.storage_path, { upsert: false })
      if (firma.error || !firma.data?.token || firma.data.path !== d.storage_path) throw Error('Firma di upload non disponibile.')
      const upload = await storage().uploadToSignedUrl(d.storage_path, firma.data.token, file, { contentType: MIME, upsert: false })
      if (upload.error) throw Error('Upload non confermato. Verificare il file già caricato prima di riprovare.')
    },
    async urlFirmato(raw: DocumentoFiscale) {
      const d = documento(raw)
      if (!d.caricato_at) throw Error('PDF non ancora disponibile.')
      const { data, error } = await storage().createSignedUrl(d.storage_path, 120, { download: true })
      if (error || !data?.signedUrl) throw Error('Accesso al PDF non disponibile.')
      return data.signedUrl
    },
  }
}

export type ArchivioDocumentiFiscali = ReturnType<typeof creaArchivioDocumentiFiscali>
