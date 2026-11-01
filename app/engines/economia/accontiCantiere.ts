export type StatoAcconti = 'non_caricato' | 'caricamento' | 'caricato' | 'vuoto' | 'errore'
export type RigaAcconto = {
  id?: string
  descrizione?: string | null
  metodo?: string | null
  nota?: string | null
  cantiere_id?: string | null
  cantiere?: string | null
  data_incasso?: string | null
  importo?: number | string | null
}

export const accontiCaricati = (stato: StatoAcconti) => stato === 'caricato' || stato === 'vuoto'

export function selezionaAcconti<T extends RigaAcconto>(righe: T[], nome: string, id?: string, da = '', a = ''): T[] {
  return righe.filter(riga => {
    // Un UUID diverso non può essere recuperato tramite un nome omonimo.
    const appartiene = id && riga.cantiere_id ? riga.cantiere_id === id : riga.cantiere === nome
    const data = String(riga.data_incasso || '')
    return appartiene && (!da || data >= da) && (!a || data <= a)
  })
}

export const messaggioAcconti = (stato: StatoAcconti) => ({
  non_caricato: 'Acconti non ancora caricati.',
  caricamento: 'Caricamento acconti…',
  errore: 'Impossibile caricare gli acconti. Riprova con Ricarica acconti.',
  caricato: '',
  vuoto: '',
})[stato]
