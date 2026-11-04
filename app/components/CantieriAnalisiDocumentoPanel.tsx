
'use client'

import { useRef, useState } from 'react'
import AnalisiDocumentoFocus from './AnalisiDocumentoFocus'
import SelectCantiere from './SelectCantiere'
import DocumentIntelligencePanel from './DocumentIntelligencePanel'

export default function CantieriAnalisiDocumentoPanel(props: any) {
  const p = props
  const [apertaLocale, setApertaLocale] = useState(false)
  const aperturaRef = useRef<HTMLButtonElement | null>(null)
  const aperta = p.analisiAperta ?? apertaLocale
  const setAperta = p.setAnalisiAperta ?? setApertaLocale

  return (
    <div style={p.integrato ? undefined : p.cardStyle}>
      <h2>{p.integrato ? 'Analizza documento tecnico' : 'Analisi documento cantiere'}</h2>

      <button type="button" ref={aperturaRef} style={p.buttonPrimary} onClick={() => setAperta(true)}>Analizza documento</button>
      <AnalisiDocumentoFocus aperta={aperta} onChiudi={() => setAperta(false)}
        contesto={p.cantiereAnalisiDocumento} ritornoFocusRef={aperturaRef}
        occupata={p.progressoAnalisiDocumento?.stato === 'in_corso'}>
      {!p.integrato && (
        <div style={{ marginBottom: 20 }}>
          <strong>Seleziona cantiere</strong>

          <div style={{ marginTop: 10 }}>
            <SelectCantiere
              cantieri={p.cantieri}
              value={p.cantiereAnalisiDocumento || ''}
              onChange={p.setCantiereAnalisiDocumento}
              onChangeId={p.setCantiereIdScheda}
              inputStyle={{
                padding: 8,
                width: '100%',
                maxWidth: 260,
                marginBottom: 15,
              }}
              buttonSecondary={p.buttonSecondary}
            />
          </div>
        </div>
      )}

      <DocumentIntelligencePanel
        titolo="Seleziona documento da analizzare"
        progressoAnalisiDocumento={p.progressoAnalisiDocumento}
        fileAnalisiDocumento={p.fileAnalisiDocumento}
        nomeFileAnalisiDocumento={p.nomeFileAnalisiDocumento}
        testoEstrattoDocumento={p.testoEstrattoDocumento}
        importoRilevatoDocumento={p.importoRilevatoDocumento}
        vociAnalizzate={p.vociAnalizzate || []}
        caricaFileAnalisiDocumento={p.caricaFileAnalisiDocumento}
        inputStyle={p.inputStyle}
      />
      </AnalisiDocumentoFocus>
    </div>
  )
}
