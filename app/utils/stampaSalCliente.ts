export type RigaStampaSal = {
  descrizione: string
  importoContrattuale: number
  percentuale: number
  importoMaturato: number
}

export type DatiStampaSal = {
  cantiere: string
  committente?: string
  preventivoContrattuale: { nome: string; importo: number }
  righe: readonly RigaStampaSal[]
  accontiRicevuti: number
  contratto: {
    incrementi: number
    riduzioni: number
    aggiornamenti: readonly { data: string | null; approvataIl: string | null; variante: string; descrizione: string; tipo: 'Incremento' | 'Riduzione' | 'Eliminazione'; importo: number }[]
  }
}

const caratteriHtml: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const html = (value: string) => value.replace(/[&<>"']/g, carattere => caratteriHtml[carattere])
const euro = (value: number) => value.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })

export type OpzioniStampaSal = { detrazioneAccontoPercentuale: number | string; ivaPercentuale: number | string }

// Stesso criterio monetario degli helper Varianti: centesimi, solo rumore floating-point.
function roundEuro(value: number): number {
  const scaled = Math.abs(value) * 100
  const noise = Math.min(1e-7, 4 * Number.EPSILON * Math.max(1, scaled))
  const cents = Math.round(scaled + noise)
  if (!Number.isSafeInteger(cents)) throw new Error('Importo monetario non rappresentabile in centesimi.')
  return cents === 0 ? 0 : Math.sign(value) * cents / 100
}

export function calcolaStampaSal(dati: DatiStampaSal, opzioni: OpzioniStampaSal) {
  const percentuale = (value: number | string) => {
    if ((typeof value !== 'number' && typeof value !== 'string') ||
        (typeof value === 'string' && !value.trim()) || !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 100) {
      throw new Error('Inserisci detrazione acconto e IVA tra 0 e 100%.')
    }
    return Number(value)
  }
  const detrazionePercentuale = percentuale(opzioni?.detrazioneAccontoPercentuale)
  const ivaPercentuale = percentuale(opzioni?.ivaPercentuale)
  if (!dati.contratto) throw new Error('Contesto contrattuale non verificabile per la stampa.')
  const numeri = [dati.preventivoContrattuale.importo, dati.accontiRicevuti, dati.contratto.incrementi, dati.contratto.riduzioni,
    ...dati.righe.flatMap(riga => [riga.importoContrattuale, riga.percentuale, riga.importoMaturato])]
  if (!dati.cantiere.trim() || !dati.preventivoContrattuale.nome.trim() || !dati.righe.length ||
      numeri.some(value => !Number.isFinite(value) || value < 0) || dati.righe.some(riga => riga.percentuale > 100)) {
    throw new Error('Dati SAL non disponibili o non verificabili per la stampa.')
  }
  const totaleRighe = dati.righe.reduce((totale, riga) => totale + riga.importoContrattuale, 0)
  const totaleMaturato = dati.righe.reduce((totale, riga) => totale + riga.importoMaturato, 0)
  if (!Array.isArray(dati.contratto.aggiornamenti) || dati.contratto.aggiornamenti.some(r => !Number.isFinite(r.importo))) {
    throw new Error('Aggiornamenti contrattuali non verificabili per la stampa.')
  }
  const contrattoOriginario = dati.preventivoContrattuale.importo
  const incrementi = dati.contratto.incrementi, riduzioni = dati.contratto.riduzioni
  const contrattoAggiornato = contrattoOriginario + incrementi - riduzioni
  const residuo = contrattoAggiornato - totaleMaturato
  const detrazioneAcconto = dati.accontiRicevuti * detrazionePercentuale / 100
  const imponibile = totaleMaturato - detrazioneAcconto
  const iva = imponibile * ivaPercentuale / 100
  const daRichiedere = imponibile + iva
  if ([contrattoAggiornato, totaleRighe, totaleMaturato, residuo, detrazioneAcconto, imponibile, iva, daRichiedere].some(value => !Number.isFinite(value))) {
    throw new Error('Totali SAL non verificabili per la stampa.')
  }
  if (detrazioneAcconto > totaleMaturato || imponibile < 0 || residuo < 0) {
    throw new Error('Importi negativi o detrazione superiore al maturato: verifica i dati prima della stampa.')
  }
  // Le guardie precedenti operano sui valori grezzi: l'arrotondamento non sana importi invalidi.
  const maturatoEuro = roundEuro(totaleMaturato)
  const contrattoEuro = roundEuro(contrattoAggiornato)
  const detrazioneEuro = roundEuro(detrazioneAcconto)
  const imponibileEuro = roundEuro(maturatoEuro - detrazioneEuro)
  const ivaEuro = roundEuro(imponibileEuro * ivaPercentuale / 100)
  const totaleEuro = roundEuro(imponibileEuro + ivaEuro)
  return { contrattoOriginario, incrementi, riduzioni, contrattoAggiornato: contrattoEuro,
    totaleRighe: roundEuro(totaleRighe), totaleMaturato: maturatoEuro, residuo: roundEuro(contrattoEuro - maturatoEuro),
    detrazionePercentuale, detrazioneAcconto: detrazioneEuro, imponibile: imponibileEuro, ivaPercentuale, iva: ivaEuro, daRichiedere: totaleEuro }
}

export function documentoSalCliente(dati: DatiStampaSal, opzioni: OpzioniStampaSal, dataStampa = new Date()): string {
  const { contrattoOriginario, incrementi, riduzioni, contrattoAggiornato, totaleRighe, totaleMaturato, residuo, detrazionePercentuale, detrazioneAcconto, imponibile, ivaPercentuale, iva, daRichiedere } = calcolaStampaSal(dati, opzioni)
  const data = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleDateString('it-IT') : 'Non disponibile'
  if (!Number.isFinite(dataStampa.getTime())) throw new Error('Data stampa non verificabile.')
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><title>SAL — Stato Avanzamento Lavori</title>
<style>@page{size:A4;margin:16mm}body{font:12px Arial,sans-serif;color:#172033;line-height:1.4}h1{font-size:23px}h2{font-size:18px}table{width:100%;border-collapse:collapse;margin:18px 0}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}th:not(:first-child),td:not(:first-child){text-align:right}thead{display:table-header-group}tr,.riepilogo,.firme{break-inside:avoid}.descrizione{white-space:pre-wrap;overflow-wrap:anywhere}.riepilogo{border:1px solid #aaa;padding:14px}.riepilogo p{margin:6px 0}.firme{margin-top:40px;display:flex;justify-content:space-between;gap:25px}.firma{padding-top:18px}</style></head><body>
<h1>ARTECNA</h1><h2>SAL — Stato Avanzamento Lavori</h2>
<p>Cantiere: ${html(dati.cantiere)}${dati.committente?.trim() ? '<br>Committente: ' + html(dati.committente.trim()) : ''}<br>Preventivo contrattuale: ${html(dati.preventivoContrattuale.nome)}<br>Data stampa: ${dataStampa.toLocaleDateString('it-IT')}</p>
<p>Il presente documento rappresenta lo stato cumulativo aggiornato delle lavorazioni.</p>
<table><thead><tr><th>Descrizione</th><th>Importo contrattuale</th><th>% avanzamento</th><th>Importo maturato</th></tr></thead><tbody>${dati.righe.map(riga => `<tr><td class="descrizione">${html(riga.descrizione)}</td><td>${euro(riga.importoContrattuale)}</td><td>${riga.percentuale.toLocaleString('it-IT')}%</td><td>${euro(riga.importoMaturato)}</td></tr>`).join('')}</tbody></table>
<h3>Aggiornamenti contrattuali</h3>
${dati.contratto.aggiornamenti.length ? '<table><thead><tr><th>N.</th><th>Data</th><th>Variante</th><th>Lavorazione</th><th>Tipo</th><th>Importo</th></tr></thead><tbody>' + dati.contratto.aggiornamenti.map((r,i) => '<tr><td>'+(i+1)+'</td><td>'+html(data(r.data))+(r.approvataIl ? '<br><small>Approvata: '+html(data(r.approvataIl))+'</small>' : '')+'</td><td>'+html(r.variante)+'</td><td class="descrizione">'+html(r.descrizione)+'</td><td>'+html(r.tipo)+'</td><td>'+(r.importo >= 0 ? '+' : '-')+euro(Math.abs(r.importo))+'</td></tr>').join('')+'</tbody></table>' : '<p>Nessun aggiornamento contrattuale approvato.</p>'}
<section class="riepilogo"><p>Contratto originario: <strong>${euro(contrattoOriginario)}</strong></p><p>Incrementi approvati: <strong>${euro(incrementi)}</strong></p><p>Riduzioni approvate: <strong>${euro(riduzioni)}</strong></p><p>Contratto aggiornato: <strong>${euro(contrattoAggiornato)}</strong></p><p>Maturato SAL: <strong>${euro(totaleMaturato)}</strong></p><p>Residuo contrattuale aggiornato: <strong>${euro(residuo)}</strong></p></section>
<section class="riepilogo"><p>Totale contrattuale: <strong>${euro(dati.preventivoContrattuale.importo)}</strong></p><p>Totale righe SAL: <strong>${euro(totaleRighe)}</strong></p><p>Totale maturato: <strong>${euro(totaleMaturato)}</strong></p><p>Residuo lavori: <strong>${euro(residuo)}</strong></p><p>Acconti ricevuti: <strong>${euro(dati.accontiRicevuti)}</strong></p><p>A detrarre d’acconto ${detrazionePercentuale.toLocaleString('it-IT')}%: <strong>${euro(detrazioneAcconto)}</strong></p><p>Imponibile SAL: <strong>${euro(imponibile)}</strong></p><p>IVA ${ivaPercentuale.toLocaleString('it-IT')}%: <strong>${euro(iva)}</strong></p><p>TOTALE DA RICHIEDERE: <strong>${euro(daRichiedere)}</strong></p></section>
<p>Eventuale saldo/trattenuta finale da liquidare al collaudo secondo gli accordi contrattuali.</p>
<div class="firme"><div>Impresa<div class="firma">____________________</div></div><div>Committente<div class="firma">____________________</div></div></div>
</body></html>`
}
