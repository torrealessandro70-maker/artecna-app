export function identificaNotaPdf(richiesto: string, utente: string, nota: { sopralluogo_id?: string; user_id?: string } | null) {
  if (!richiesto || !utente || (nota && (nota.sopralluogo_id !== richiesto || nota.user_id !== utente))) throw Error('Nota Quaderno: UUID o proprietario non corrispondenti')
  return { id: nota ? nota.sopralluogo_id! : richiesto, presente: !!nota }
}
export type PaginePdfSopralluogo = Readonly<{ sopralluogoId: string; quadernoPresente: boolean; pagine: readonly string[] }>
export async function esportaPaginePdf<T>({ richiesto, stato, pagine, render, signal }: {
  richiesto: string; stato: () => { id: string; pronto: boolean; presente: boolean }
  pagine: readonly T[]; render: (pagina: T) => Promise<string | null>; signal?: AbortSignal
}): Promise<PaginePdfSopralluogo> {
  const verifica = () => { const s = stato(); if (signal?.aborted || !richiesto || s.id !== richiesto || !s.pronto) throw Error('Quaderno PDF: UUID non corrispondente o renderer non pronto'); return s }
  const iniziale = verifica()
  if (!iniziale.presente) return Object.freeze({ sopralluogoId: richiesto, quadernoPresente: false, pagine: Object.freeze([]) })
  if (!pagine.length) throw Error('Quaderno PDF: pagine persistite non renderizzate')
  const immagini: string[] = []
  for (const pagina of pagine) { verifica(); const png = await render(pagina); verifica(); if (!png?.startsWith('data:image/png')) throw Error('Quaderno PDF: pagina incompleta'); immagini.push(png) }
  verifica()
  return Object.freeze({ sopralluogoId: richiesto, quadernoPresente: true, pagine: Object.freeze(immagini) })
}
export function componiContestoPdf<S extends { id?: string; firma_cliente?: string | null }, F extends { sopralluogo_id?: string }>(id: string, sopralluogo: S, foto: readonly F[], appunti: PaginePdfSopralluogo) {
  if (!id || sopralluogo.id !== id || appunti.sopralluogoId !== id || foto.some(f => f.sopralluogo_id !== id)) throw Error('Contesto PDF: UUID non corrispondenti')
  return Object.freeze({ sopralluogo: Object.freeze(structuredClone(sopralluogo)), sopralluogoId: id, firma: sopralluogo.firma_cliente || '', foto: Object.freeze(foto.map(f => Object.freeze(structuredClone(f)))), pagine: Object.freeze([...appunti.pagine]) })
}
export function attendiPagineMontate(root: HTMLElement, ids: readonly string[], signal: AbortSignal): Promise<void> {
  const pronte = () => ids.every(id => [...root.querySelectorAll('[data-quaderno-page-id]')].filter(el => el.getAttribute('data-quaderno-page-id') === id && el.querySelector('svg')).length === 1)
  if (signal.aborted) return Promise.reject(Error('Esportazione annullata'))
  if (pronte()) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const termina = (errore?: Error) => { observer.disconnect(); clearTimeout(timer); signal.removeEventListener('abort', annulla); if (errore) reject(errore); else resolve() }
    const annulla = () => termina(Error('Esportazione annullata'))
    const observer = new MutationObserver(() => { if (pronte()) termina() })
    const timer = setTimeout(() => termina(Error('Quaderno PDF: rendering pagine non completato')), 30000)
    observer.observe(root, { childList: true, subtree: true }); signal.addEventListener('abort', annulla, { once: true })
  })
}
