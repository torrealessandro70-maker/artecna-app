// app/components/RegistroRapportiniPanel.tsx

'use client'

import type { CSSProperties } from 'react'

type Props = {
  rapportini: any[]
  registroCerca: string

  ordinaRegistro: (...args: any[]) => void

  ordinaRapportiniCampo: string
  ordinaRapportiniDirezione: 'asc' | 'desc'

  setOrdinaRapportiniCampo: (v: any) => void
  setOrdinaRapportiniDirezione: (v: any) => void

  rapportinoRegistroEdit: string | null

  rapportinoRegistroData: string
  setRapportinoRegistroData: (v: string) => void

  rapportinoRegistroCantiere: string
  setRapportinoRegistroCantiere: (v: string) => void

  rapportinoRegistroOperaio: string
  setRapportinoRegistroOperaio: (v: string) => void

  rapportinoRegistroOre: string
  setRapportinoRegistroOre: (v: string) => void

  rapportinoRegistroDescrizione: string
  setRapportinoRegistroDescrizione: (v: string) => void

  salvaModificaRegistroRapportino: (id: any) => void
  annullaModificaRegistroRapportino: () => void

  preparaModificaRegistroRapportino: (r: any) => void
  eliminaRapportino: (id: any) => void

  excelBox: CSSProperties
  excelToolbar: CSSProperties
  excelTable: CSSProperties
  excelTh: CSSProperties
  excelTd: CSSProperties
  excelInput: CSSProperties

  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

export default function RegistroRapportiniPanel(props: Props) {
  const rapportiniFiltrati = [...props.rapportini]
    .filter(
      (r) =>
        String(r.cantiere || '')
          .toLowerCase()
          .includes(props.registroCerca.toLowerCase()) ||
        String(r.note || '')
          .toLowerCase()
          .includes(props.registroCerca.toLowerCase())
    )
    .sort((a, b) => {
      const valoreA =
        (a as any)[props.ordinaRapportiniCampo] || ''

      const valoreB =
        (b as any)[props.ordinaRapportiniCampo] || ''

      if (typeof valoreA === 'number') {
        return props.ordinaRapportiniDirezione === 'asc'
          ? valoreA - valoreB
          : valoreB - valoreA
      }

      return props.ordinaRapportiniDirezione === 'asc'
        ? String(valoreA).localeCompare(String(valoreB))
        : String(valoreB).localeCompare(String(valoreA))
    })

  return (
    <div style={props.excelBox}>
      <div style={props.excelToolbar}>
        <strong>📝 Registro rapportini</strong>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={props.excelTable}>
          <thead>
            <tr>
              <th
                style={{ ...props.excelTh, cursor: 'pointer' }}
                onClick={() =>
                  props.ordinaRegistro(
                    'data',
                    props.setOrdinaRapportiniCampo,
                    props.setOrdinaRapportiniDirezione,
                    props.ordinaRapportiniCampo
                  )
                }
              >
                Data ↕
              </th>

              <th
                style={{ ...props.excelTh, cursor: 'pointer' }}
                onClick={() =>
                  props.ordinaRegistro(
                    'cantiere',
                    props.setOrdinaRapportiniCampo,
                    props.setOrdinaRapportiniDirezione,
                    props.ordinaRapportiniCampo
                  )
                }
              >
                Cantiere ↕
              </th>

              <th style={props.excelTh}>Operaio ↕</th>
              <th style={props.excelTh}>Ore ↕</th>
              <th style={props.excelTh}>Descrizione ↕</th>
              <th style={props.excelTh}>Azioni</th>
            </tr>
          </thead>

          <tbody>
            {rapportiniFiltrati.map((r, i) => (
              <tr
                key={r.id || i}
                style={{
                  backgroundColor:
                    props.rapportinoRegistroEdit === String(r.id)
                      ? '#eff6ff'
                      : '#fff',
                }}
              >
                {/* INCOLLA QUI TUTTO IL BLOCCO <td>...</td>
                    CHE HAI GIA' NEL FILE ATTUALE */}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}