// Stesso parsing per anteprima e salvataggio manuale; accetta virgola o punto decimale.
export function calcolaAttrezzoManuale(quantita: string, prezzo: string) {
  const leggi = (valore: string) => {
    const normalizzato = valore.trim().replace(',', '.')
    return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalizzato) ? Number(normalizzato) : NaN
  }
  const qta = leggi(quantita)
  const unitario = leggi(prezzo)
  const totale = qta * unitario
  if (!Number.isFinite(qta) || qta <= 0 || !Number.isFinite(unitario) || unitario < 0 || !Number.isFinite(totale)) return null
  return { quantita: qta, prezzo: unitario, totale }
}
