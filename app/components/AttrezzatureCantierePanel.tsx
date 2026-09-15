'use client'

import { useId, useState, type ComponentProps } from 'react'
import AttrezzatureCaricatePanel from './AttrezzatureCaricatePanel'
import { acquistiAttrezzatureDisponibili, suggerimentiAttrezzature, type RigaAttrezzaturaFatturaStorico } from '../utils/suggerimentiAttrezzature'
import { ultimoPrezzoMateriale, type Fattura } from '../utils/suggerimentiMateriali'

type Props = {
  cantiere: { id: string; nome: string }
  fattureFornitori: Fattura[]
  righeAttrezzatureFatture: RigaAttrezzaturaFatturaStorico[]
  panelProps: ComponentProps<typeof AttrezzatureCaricatePanel>
}

const normalizza = (valore: unknown) => String(valore || '').trim().replace(/\s+/g, ' ')
const chiave = (valore: unknown) => normalizza(valore).toLocaleLowerCase('it-IT')

export default function AttrezzatureCantierePanel({ cantiere, panelProps: p, fattureFornitori, righeAttrezzatureFatture }: Props) {
  const [attrezzatura, setAttrezzatura] = useState('')
  const [fornitore, setFornitore] = useState('')
  const elencoId = useId()
  const { attrezzature: descrizioni, fornitori } = suggerimentiAttrezzature(
    p.attrezziCantiere, fattureFornitori, righeAttrezzatureFatture,
  )
  const acquisti = acquistiAttrezzatureDisponibili(fattureFornitori, righeAttrezzatureFatture)
  const cambiaDescrizione = (descrizione: string) => {
    if (!p.form) return
    p.form.setDescrizione(descrizione)
    if (descrizione.trim().toLocaleLowerCase('it-IT') === p.form.descrizione.trim().toLocaleLowerCase('it-IT')) return
    const prezzo = ultimoPrezzoMateriale(descrizione, acquisti)
    if (prezzo !== undefined) p.form.setPrezzo(String(prezzo))
  }
  const attrezzatureDelCantiere = p.attrezziCantiere.filter((a) => a.cantiere === cantiere.nome)
  const attrezzatureFiltrate = attrezzatureDelCantiere.filter((a) =>
    chiave(a.descrizione).includes(chiave(attrezzatura)) && chiave(a.fornitore).includes(chiave(fornitore))
  )

  return (
    <section aria-label="Attrezzature del cantiere" style={{ padding: 20, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff', minWidth: 0 }}>
      <h4 style={{ margin: '0 0 16px', fontSize: 18 }}>Attrezzature del cantiere</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
        {[
          { id: 'attrezzatura', titolo: 'Attrezzatura', valore: attrezzatura, imposta: setAttrezzatura, valori: descrizioni },
          { id: 'fornitore', titolo: 'Fornitore', valore: fornitore, imposta: setFornitore, valori: fornitori },
        ].map((filtro) => (
          <label key={filtro.id} style={{ display: 'grid', gap: 6, flex: '1 1 220px', minWidth: 0 }}>
            {filtro.titolo}
            <input type="text" list={elencoId + filtro.id} value={filtro.valore}
              onChange={(e) => filtro.imposta(e.target.value)} placeholder="Digita o seleziona..." autoComplete="off"
              style={{ ...p.inputStyle, width: '100%', minWidth: 0, boxSizing: 'border-box' }} />
            <datalist id={elencoId + filtro.id}>
              {filtro.valori.filter((nome) => chiave(nome).includes(chiave(filtro.valore)))
                .map((nome) => <option key={nome} value={nome} />)}
            </datalist>
          </label>
        ))}
        <button type="button" onClick={() => { setAttrezzatura(''); setFornitore('') }} style={p.buttonSecondary}>Reset</button>
      </div>
      <AttrezzatureCaricatePanel {...p} contestuale
        form={p.form ? { ...p.form, setDescrizione: cambiaDescrizione } : undefined}
        suggerimentiDescrizione={descrizioni}
        cantiereScheda={cantiere.nome}
        attrezziCantiere={attrezzatureFiltrate}
        totaleAttrezzature={attrezzatureDelCantiere.reduce((tot, a) => tot + Number(a.totale || 0), 0)}
      />
      <p style={{ color: '#64748b', fontSize: 13 }}>Il totale attrezzature comprende tutte le attrezzature del cantiere, indipendentemente dai filtri.</p>
    </section>
  )
}
