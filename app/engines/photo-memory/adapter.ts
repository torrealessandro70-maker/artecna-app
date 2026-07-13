import { buildArtecnaPhoto } from './builder'
import type { ArtecnaPhoto } from './types'
import type { AllegatoNota } from '@/app/components/note/types'

export const isAllegatoImmagine = (
  allegato: AllegatoNota,
): boolean => {
  return (
    allegato.tipo === 'foto' ||
    allegato.mime_type?.startsWith('image/') === true
  )
}

export const allegatoToArtecnaPhoto = (
  allegato: AllegatoNota,
): ArtecnaPhoto | null => {
  if (!isAllegatoImmagine(allegato)) {
    return null
  }

  return buildArtecnaPhoto({
    id: allegato.id,
    url: allegato.url,
    nome: allegato.nome_file,
    mimeType: allegato.mime_type ?? undefined,
    createdAt: allegato.created_at,
        destinations: ['quaderno'],
  })
}
type FotoGalleriaNota = {
  id?: string
  sopralluogo_id?: string
  immagine_base64: string
  nota?: string
  tag?: string
}

export const fotoGalleriaToArtecnaPhoto = (
  foto: FotoGalleriaNota,
): ArtecnaPhoto => {
  return buildArtecnaPhoto({
    id: foto.id ?? crypto.randomUUID(),
    url: foto.immagine_base64,
    nome: foto.nota,
    sopralluogoId: foto.sopralluogo_id,
    destinations: ['galleria'],
  })
}