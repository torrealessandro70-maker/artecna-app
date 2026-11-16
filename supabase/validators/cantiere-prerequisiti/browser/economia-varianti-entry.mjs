import React from 'react'
import { createRoot } from 'react-dom/client'
import EconomiaModule from '../../../../app/components/EconomiaCantierePanel.tsx'
import { supabase } from '../../../../lib/supabaseClient'

const cantiere = { id: new URLSearchParams(location.search).get('cantiere'), nome: 'Cantiere sintetico' }
const modo = new URLSearchParams(location.search).get('mode')
const report = (name, detail = '') => fetch('/phase?name=' + name + '&detail=' + encodeURIComponent(detail))
window.addEventListener('error', e => void report('js-error', e.message))

const EconomiaCantierePanel = EconomiaModule.default ?? EconomiaModule
createRoot(document.getElementById('fixture')).render(React.createElement(EconomiaCantierePanel, {
  cantiere,
  panelProps: {
    contrattoBase: { preventivoId: 'P', importo: 1000 },
    periodo: { economiaDataDa: '', economiaDataA: '' },
    sal: { supabase, salLavorazioni: [] },
    acconti: { statoAcconti: 'caricato', accontiCantiere: [] },
    costi: { materialiCantiere: [] },
    riepilogo: {
      formatMoney: n => String(n), totaleManodoperaCantiere: 0,
      totaleCostiCantiere: 0, totaleAttrezziEconomia: 0, totaleMaterialiEconomia: 0,
    },
  },
}))

async function verifica() {
  let caricamentoVisto = false
  for (let i = 0; i < 250; i++) {
    const pannello = document.querySelector('[aria-label="Scomposizione aggiornamenti contrattuali"]')
    if (pannello) {
      pannello.closest('details').open = true
      const valori = Object.fromEntries([...pannello.querySelectorAll('dt')].map(el =>
        [el.textContent, el.nextElementSibling.textContent]))
      const kpi = [...document.querySelectorAll('article')].some(el => el.textContent === 'Contratto aggiornato1300')
      if (valori['Voci generiche Economia'] !== '30' || valori['Manodopera Economia'] !== '270' ||
          valori['Materiali Economia'] !== '0' || valori['Totale aggiornamenti contrattuali'] !== '300' || !kpi)
        throw Error('Scomposizione o contratto aggiornato divergenti')
      const stampa = [...pannello.querySelectorAll('button')].find(el => el.textContent === 'Stampa materiali Economia')
      if (!stampa) throw Error('Controllo stampa assente')
      if (pannello.textContent.includes('Caricamento materiali da contabilizzare')) {
        if (!stampa.disabled || pannello.textContent.includes('Materiali da contabilizzare (0)'))
          throw Error('Caricamento mostrato come esito verificato')
        caricamentoVisto = true
      }
      if (modo === 'economia-errore' && pannello.textContent.includes('raccolta Economia non verificabile · errore RPC')) {
        if (!stampa.disabled || !caricamentoVisto) throw Error('Stampa disponibile o caricamento assente dopo errore RPC')
        return
      }
      if (modo !== 'economia-errore' && pannello.textContent.includes('Materiali da contabilizzare (0)')) {
        if (stampa.disabled || !caricamentoVisto) throw Error('Zero verificato o caricamento assente')
        return
      }
    }
    await new Promise(resolve => setTimeout(resolve, 30))
  }
  throw Error('Il pannello non ha caricato la scomposizione delle varianti')
}
verifica().then(() => report('pass', 'Sei varianti, contratto 1300, generiche 30, esclusione a zero'),
  err => report('fail', err.message))
