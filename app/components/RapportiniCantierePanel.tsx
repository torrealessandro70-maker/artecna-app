'use client'

import { useEffect, useRef, useState, type ComponentProps } from 'react'
import type { Cantiere, Rapportino } from '../types'
import RapportinoForm from './RapportinoForm'
import RapportiniTable from './RapportiniTable'

type Props = {
  cantiere: Cantiere
  rapportini: Rapportino[]
  formProps: Omit<ComponentProps<typeof RapportinoForm>, 'onClose'>
  resetFormRapportino: () => void
  preparaModificaRapportino: (rapportino: Rapportino) => void
  eliminaRapportino: (id?: string) => void | Promise<void>
  generaPdfRapportinoFotografico: (rapportino: Rapportino) => void | Promise<void>
}

export default function RapportiniCantierePanel({
  cantiere, rapportini, formProps, resetFormRapportino, preparaModificaRapportino,
  eliminaRapportino, generaPdfRapportinoFotografico,
}: Props) {
  const [mostraForm, setMostraForm] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)
  const rapportiniCantiere = cantiere.id && cantiere.nome
    ? rapportini.filter((r) => r.cantiere === cantiere.nome)
        .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))
    : []

  useEffect(() => {
    if (mostraForm) formRef.current?.focus()
  }, [mostraForm])

  return (
    <section aria-label="Rapportini del cantiere" style={{ border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 18 }}>
        <h4 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Rapportini del cantiere</h4>
        <button type="button" style={{ ...formProps.buttonPrimary, minHeight: 44 }} onClick={() => {
          resetFormRapportino()
          formProps.setCantiereRapporto(cantiere.nome)
          setMostraForm(true)
        }}>
          + Aggiungi rapportino
        </button>
      </div>
      {mostraForm && (
        <div ref={formRef} tabIndex={-1} style={{ padding: '0 18px 18px' }}>
          <RapportinoForm {...formProps} onClose={() => setMostraForm(false)} />
        </div>
      )}
      {rapportiniCantiere.length === 0 ? (
        <p style={{ padding: '0 18px 18px', color: '#64748b' }}>Nessun rapportino registrato per questo cantiere.</p>
      ) : (
        <RapportiniTable
          rapportini={rapportiniCantiere}
          mostraCantiere={false}
          fotoCantiere={formProps.fotoCantiere}
          setFotoRapportinoAperte={formProps.setFotoRapportinoAperte}
          onModifica={(rapportino) => {
            preparaModificaRapportino(rapportino)
            setMostraForm(true)
            formRef.current?.focus()
          }}
          eliminaRapportino={eliminaRapportino}
          generaPdfRapportinoFotografico={generaPdfRapportinoFotografico}
        />
      )}
    </section>
  )
}
