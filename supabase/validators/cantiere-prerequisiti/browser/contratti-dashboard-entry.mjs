import React, { useEffect, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import HomeModule from '../../../../app/components/HomeDashboardPanel.tsx'
import ImpresaModule from '../../../../app/components/HomeEconomiaGeneraleCard.tsx'
import SchedaModule from '../../../../app/components/CantieriSchedaPanel.tsx'
import { calcolaGestione, chiaveContratto, contrattoAggiornato, creaLettoreContratti, totaleContratti } from '../../../../app/engines/economia/contrattiAggiornati.ts'
import { supabase } from '../../../../lib/supabaseClient'

const Home = HomeModule.default ?? HomeModule
const Impresa = ImpresaModule.default ?? ImpresaModule
const Scheda = SchedaModule.default ?? SchedaModule
const cantiere = { id: new URLSearchParams(location.search).get('cantiere'), nome: 'TESTA ANTONINO sintetico' }
const base = { preventivoId: 'P', importo: 31438.4 }
const richiesta = { cantiereId: cantiere.id, preventivoId: base.preventivoId }
const lettore = creaLettoreContratti(supabase)
const formatMoney = n => Number(n).toFixed(2)
const aggiornamento = () => lettore.invalida(cantiere.id)
const report = (name, detail = '') => fetch('/phase?name=' + name + '&detail=' + encodeURIComponent(detail))
window.addEventListener('error', e => void report('js-error', e.error?.stack || e.message))
const noop = () => {}
const ui = { cardStyle: {}, buttonSecondary: {}, buttonPrimary: {} }

function Fixture() {
  const lettura = useSyncExternalStore(lettore.iscriviti, lettore.snapshot).get(chiaveContratto(richiesta))
  useEffect(() => { lettore.sincronizza([richiesta]) }, [])
  const contratto = contrattoAggiornato(base, lettura)
  const costi = 6690.36
  const costiVista = { costoTotale: costi, costoManodopera: 0, costoMateriali: costi, costoAttrezzi: 0 }
  const statoCantiere = { ...cantiere, ...costiVista, contratto, ...calcolaGestione(contratto.aggiornato, costi) }
  const h = React.createElement
  const riepilogo = h(Impresa, { client: supabase, cardStyle: {}, materialiBaseIds: ['M'],
    totalePreventiviImpresa: totaleContratti([statoCantiere]), totaleCostiImpresa: costi,
    statoContratti: contratto.messaggio, formatMoney })
  const economiaPanelProps = {
    contrattoBase: base, letturaCondivisa: { stato: lettura, invalida: aggiornamento }, materialiBaseIds: ['M'],
    periodo: { economiaDataDa: '', economiaDataA: '' }, sal: { supabase, salLavorazioni: [] },
    acconti: { statoAcconti: 'caricato', accontiCantiere: [] }, costi: { materialiCantiere: [] },
    riepilogo: { formatMoney, totaleCostiCantiere: costi, totaleManodoperaCantiere: 0,
      totaleAttrezziEconomia: 0, totaleMaterialiEconomia: costi },
  }
  return h(React.Fragment, null,
    h('button', { id: 'simula-approvazione', onClick: aggiornamento }, 'Simula invalidazione dopo approvazione'),
    h('section', { id: 'home' }, h(Home, { ...ui, classificaCantieri: [statoCantiere], cantieriConclusi: [], formatMoney, riepilogo })),
    h('section', { id: 'scheda' }, h(Scheda, { ...ui, cantiereSelezionatoDaId: cantiere, cantiereNomeVisualizzato: cantiere.nome,
      cantieri: [cantiere], rapportini: [], rapportinoFormProps: ui,
      fotoCantiere: [], fotoDaCaricare: [], fotoCantiereSelezionate: [], setFotoCantiereSelezionate: noop,
      formatMoney, statoCantiere, onCambioStatoVariante: aggiornamento, economiaPanelProps })))
}
createRoot(document.getElementById('fixture')).render(React.createElement(Fixture))

async function wait(predicato, messaggio) {
  for (let i = 0; i < 250; i++) {
    if (predicato()) return
    await new Promise(resolve => setTimeout(resolve, 30))
  }
  throw Error(messaggio)
}
async function verifica() {
  const testo = id => document.getElementById(id)?.innerText ?? ''
  await wait(() => testo('home').includes('39290.39') && testo('scheda').includes('39290.39') &&
    testo('home').includes('32700.03') && testo('scheda').includes('32600.03'),
  'Home e Panoramica senza contratto comune o rettifica coerente')
  document.getElementById('simula-approvazione').click()
  await wait(() => testo('home').includes('39517.85') && testo('scheda').includes('39517.85'),
    'Le viste non si aggiornano dopo invalidazione')
  const pulsante = [...document.querySelectorAll('#scheda button')].find(x => x.textContent === 'Economia')
  if (!pulsante) throw Error('Ingresso Economia mancante')
  pulsante.click()
  await wait(() => testo('scheda').includes('39517.85') && testo('scheda').includes('32927.49'),
    'Economia non riusa il contratto aggiornato o i costi rettificati')
}
verifica().then(() => report('pass', 'Home, Panoramica ed Economia coerenti con lettura condivisa e rettifiche'),
  err => report('fail', err.message))
