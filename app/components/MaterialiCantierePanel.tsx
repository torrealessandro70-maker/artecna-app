'use client'

import { useId, useState, type ComponentProps } from 'react'
import MaterialiEconomiaPanel from './MaterialiEconomiaPanel'
import { suggerimentiMateriali, acquistiMaterialiDisponibili, ultimoPrezzoMateriale, type Fattura, type RigaMaterialeFatturaStorico } from '../utils/suggerimentiMateriali'

type Props = {
  cantiere: { id: string; nome: string }
  panelProps: ComponentProps<typeof MaterialiEconomiaPanel>
  fattureFornitori: Fattura[]
  righeMaterialiFatture: RigaMaterialeFatturaStorico[]
}

export default function MaterialiCantierePanel({ cantiere, panelProps: p, fattureFornitori, righeMaterialiFatture }: Props) {
  const [materiale, setMateriale] = useState('')
  const [fornitore, setFornitore] = useState('')
  const elencoId = useId()
  const suggerimenti = suggerimentiMateriali(p.materialiCantiere, fattureFornitori, righeMaterialiFatture)
  const acquisti = acquistiMaterialiDisponibili(fattureFornitori, righeMaterialiFatture)
  const cambiaDescrizione = (descrizione: string) => {
    p.setMaterialeManualeDescrizione(descrizione)
    if (descrizione.trim().toLocaleLowerCase('it-IT') === p.materialeManualeDescrizione.trim().toLocaleLowerCase('it-IT')) return
    const prezzo = ultimoPrezzoMateriale(descrizione, acquisti)
    if (prezzo !== undefined) p.setMaterialeManualePrezzo(String(prezzo))
  }
  const materialiDelCantiere = p.materialiCantiere.filter((m) => m.cantiere === cantiere.nome)
  const materialiFiltrati = materialiDelCantiere.filter((m) =>
    String(m.descrizione || '').toLocaleLowerCase('it-IT').includes(materiale.toLocaleLowerCase('it-IT')) &&
    String(m.fornitore || '').toLocaleLowerCase('it-IT').includes(fornitore.toLocaleLowerCase('it-IT'))
  )

  return (
    <section aria-label="Materiali del cantiere" style={{ padding: 20, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff', minWidth: 0 }}>
      <h4 style={{ margin: '0 0 16px', fontSize: 18 }}>Materiali del cantiere</h4>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 16 }}>
        {[
          { id: 'materiale', titolo: 'Materiale', valore: materiale, imposta: setMateriale, valori: suggerimenti.materiali },
          { id: 'fornitore', titolo: 'Fornitore', valore: fornitore, imposta: setFornitore, valori: suggerimenti.fornitori },
        ].map((filtro) => (
          <label key={filtro.id} style={{ display: 'grid', gap: 6, flex: '1 1 220px', minWidth: 0 }}>
            {filtro.titolo}
            <input type="text" list={elencoId + filtro.id} value={filtro.valore}
              onChange={(e) => filtro.imposta(e.target.value)} placeholder="Digita o seleziona..." autoComplete="off"
              style={{ ...p.inputStyle, width: '100%', minWidth: 0, boxSizing: 'border-box' }} />
            <datalist id={elencoId + filtro.id}>
              {filtro.valori.filter((nome) => nome.toLocaleLowerCase('it-IT').includes(filtro.valore.toLocaleLowerCase('it-IT')))
                .map((nome) => <option key={nome} value={nome} />)}
            </datalist>
          </label>
        ))}
        <button type="button" onClick={() => { setMateriale(''); setFornitore('') }} style={p.buttonSecondary}>Reset</button>
      </div>
      <MaterialiEconomiaPanel {...p} contestuale
        suggerimentiDescrizione={suggerimenti.materiali}
        setMaterialeManualeDescrizione={cambiaDescrizione}
        cantiereScheda={cantiere.nome}
        materialiCantiere={materialiFiltrati}
        economiaDataDa="" economiaDataA="" cercaMaterialeManuale=""
        totaleMaterialiEconomia={materialiDelCantiere.reduce((tot, m) => tot + Number(m.totale || 0), 0)}
      />
      <p style={{ color: '#64748b', fontSize: 13 }}>Il totale materiali comprende tutti i materiali del cantiere, indipendentemente dai filtri.</p>
    </section>
  )
}
