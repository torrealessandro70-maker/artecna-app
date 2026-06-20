
'use client'

import SelectCantiere from './SelectCantiere'
import DocumentIntelligencePanel from './DocumentIntelligencePanel'

export default function CantieriAnalisiDocumentoPanel(props: any) {
  const p = props

  return (
    <div style={p.integrato ? undefined : p.cardStyle}>
      <h2>{p.integrato ? 'Analizza documento tecnico' : 'Analisi documento cantiere'}</h2>

      {!p.integrato && (
        <div style={{ marginBottom: 20 }}>
          <strong>Seleziona cantiere</strong>

          <div style={{ marginTop: 10 }}>
            <SelectCantiere
              cantieri={p.cantieri}
              value={p.cantiereAnalisiDocumento || ''}
              onChange={p.setCantiereAnalisiDocumento}
              inputStyle={{
                padding: 8,
                width: 260,
                marginBottom: 15,
              }}
              buttonSecondary={p.buttonSecondary}
            />
          </div>
        </div>
      )}

      <DocumentIntelligencePanel
        titolo="Seleziona documento da analizzare"
        fileAnalisiDocumento={p.fileAnalisiDocumento}
        nomeFileAnalisiDocumento={p.nomeFileAnalisiDocumento}
        testoEstrattoDocumento={p.testoEstrattoDocumento}
        importoRilevatoDocumento={p.importoRilevatoDocumento}
        vociAnalizzate={p.vociAnalizzate || []}
        caricaFileAnalisiDocumento={p.caricaFileAnalisiDocumento}
        inputStyle={p.inputStyle}
      />
    </div>
  )
}
