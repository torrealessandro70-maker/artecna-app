type CantiereFoto = { id?: string; nome: string }
type FotoConCantiere = { cantiere: string; cantiere_id?: string | null }

/** Capture the selected identity before the first asynchronous upload. Never infer it from a name. */
export function contestoUploadFotoCantiere(cantiere: CantiereFoto | null | undefined) {
  if (!cantiere?.id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cantiere.id) || !cantiere.nome.trim()) {
    throw new Error('Seleziona un cantiere valido prima di salvare le foto')
  }
  return { cantiere_id: cantiere.id, cantiere: cantiere.nome }
}

/** Legacy names are display-only compatibility, never a new persistent association. */
export function fotoNelCantiere(foto: FotoConCantiere, cantiere: CantiereFoto, cantieri: readonly CantiereFoto[]) {
  if (!cantiere.id) return false
  if (foto.cantiere_id) return foto.cantiere_id === cantiere.id
  return foto.cantiere === cantiere.nome && cantieri.filter(c => c.nome === cantiere.nome).length === 1
}
