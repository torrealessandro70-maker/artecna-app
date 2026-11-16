import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import FormModule from '../../../../app/components/ClassificazioneCantiereForm.tsx'
import HomeModule from '../../../../app/components/HomeDashboardPanel.tsx'
import { gruppoHome, gruppiHome, riepilogoContrattiHome } from '../../../../app/engines/economia/classificazioneCantieri.ts'

const Form = FormModule.default ?? FormModule
const Home = HomeModule.default ?? HomeModule
const h = React.createElement
const id = '30000000-0000-0000-0000-000000000007'
const contract = { stato: 'verificato', aggiornato: 39517.85 }
const report = (name, detail = '') => fetch('/phase?name=' + name + '&detail=' + encodeURIComponent(detail))
window.addEventListener('error', e => void report('js-error', e.error?.stack || e.message))
let requests = 0

function Fixture() {
  const [row, setRow] = useState({ id, nome: 'Cantiere sintetico', contratto: contract, lavori_conclusi: true })
  const dati = riepilogoContrattiHome([row], true)
  return h(React.Fragment, null,
    h(Form, { key: JSON.stringify(row), id: row.id, corrente: row,
      salva: async (selected, prima, destinazione, stato, conferma) => {
        requests++
        if (selected !== id || prima.destinazione_amministrativa || destinazione !== 'cantiere_lavori' ||
            stato !== 'in_corso' || !conferma) throw Error('Richiesta della scheda non valida')
        setRow({ ...row, destinazione_amministrativa: destinazione, fase_lavori: stato, lavori_conclusi: false })
      } }),
    h(Home, { cardStyle: {}, classificaCantieri: [], cantieriConclusi: [], formatMoney: String,
      gruppi: Object.entries(gruppiHome).map(([gruppo, titolo]) => ({ gruppo, titolo, cantieri: gruppoHome(row) === gruppo ? [row] : [] })),
      riepilogo: h('output', null, dati.parziale?.toFixed(2) ?? 'Non determinabile') }))
}

async function wait(check) {
  for (let i = 0; i < 150; i++) {
    if (check()) return
    await new Promise(resolve => setTimeout(resolve, 30))
  }
  throw Error('Attesa interazione classificazione scaduta')
}

async function run() {
  createRoot(document.getElementById('fixture')).render(h(Fixture))
  const save = () => [...document.querySelectorAll('button')].find(b => b.textContent === 'Salva classificazione')
  await wait(() => save() && document.body.innerText.includes('Cantieri da classificare (1)'))
  if (!document.body.innerText.includes('Stato lavori: Concluso')) throw Error('Stato storico concluso perso durante la classificazione')
  const selects = () => document.querySelectorAll('fieldset select')
  function select(element, value) {
    element.value = value
    element.dispatchEvent(new Event('change', { bubbles: true }))
  }
  select(selects()[0], 'cantiere_lavori')
  await wait(() => selects().length === 2)
  select(selects()[1], 'in_corso')
  if (!save().disabled || requests) throw Error('Scrittura senza conferma esplicita')
  document.querySelector('fieldset input[type="checkbox"]').click()
  await wait(() => !save().disabled)
  save().click()
  await wait(() => document.body.innerText.includes('Cantieri in corso (1)') && document.body.innerText.includes('39517.85'))
  if (requests !== 1) throw Error('Richiesta non univoca')
}
run().then(() => report('pass', 'Classificazione esplicita per UUID e aggiornamento Home'),
  error => report('fail', error.message))
