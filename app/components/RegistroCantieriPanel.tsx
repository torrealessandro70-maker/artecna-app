'use client'

import { useState, type CSSProperties } from 'react'
import VistaOperativa from './VistaOperativa'

type Props = {
  soloAzioni?: boolean
  cantieri: any[]
  registroCerca: string
  formatMoney: (v: any) => string

  ordinaRegistro: (...args: any[]) => void
  ordinaCantieriCampo: string
  ordinaCantieriDirezione: 'asc' | 'desc'
  setOrdinaCantieriCampo: (v: any) => void
  setOrdinaCantieriDirezione: (v: any) => void

  cantiereRegistroEdit: string | null

  cantiereRegistroNome: string
  setCantiereRegistroNome: (v: string) => void

  cantiereRegistroPreventivo: string
  setCantiereRegistroPreventivo: (v: string) => void

  cantiereRegistroInizio: string
  setCantiereRegistroInizio: (v: string) => void

  cantiereRegistroFine: string
  setCantiereRegistroFine: (v: string) => void

  cantiereRegistroConcluso: boolean
  setCantiereRegistroConcluso: (v: boolean) => void

  salvaModificaRegistroCantiere: (id: any) => void | Promise<void>
  annullaModificaRegistroCantiere: () => void
  preparaModificaRegistroCantiere: (c: any) => void
  eliminaCantiere: (nome: string, idCantiereCancellato: string) => void | Promise<void>

  excelBox: CSSProperties
  excelToolbar: CSSProperties
  excelTable: CSSProperties
  excelTh: CSSProperties
  excelTd: CSSProperties
  excelInput: CSSProperties

  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

export default function RegistroCantieriPanel({
  cantieri,
  soloAzioni = false,
  registroCerca,
  formatMoney,
  ordinaRegistro,
  ordinaCantieriCampo,
  ordinaCantieriDirezione,
  setOrdinaCantieriCampo,
  setOrdinaCantieriDirezione,
  cantiereRegistroEdit,
  cantiereRegistroNome,
  setCantiereRegistroNome,
  cantiereRegistroPreventivo,
  setCantiereRegistroPreventivo,
  cantiereRegistroInizio,
  setCantiereRegistroInizio,
  cantiereRegistroFine,
  setCantiereRegistroFine,
  cantiereRegistroConcluso,
  setCantiereRegistroConcluso,
  salvaModificaRegistroCantiere,
  annullaModificaRegistroCantiere,
  preparaModificaRegistroCantiere,
  eliminaCantiere,
  excelBox,
  excelToolbar,
  excelTable,
  excelTh,
  excelTd,
  excelInput,
  buttonPrimary,
  buttonSecondary,
}: Props) {
  const [mostraModifica, setMostraModifica] = useState(false)
  const cantieriFiltrati = [...cantieri]
    .filter((c) =>
      String(c.nome || '')
        .toLowerCase()
        .includes(registroCerca.toLowerCase())
    )
    .sort((a, b) => {
      const valoreA = (a as any)[ordinaCantieriCampo] || ''
      const valoreB = (b as any)[ordinaCantieriCampo] || ''

      if (typeof valoreA === 'number') {
        return ordinaCantieriDirezione === 'asc'
          ? valoreA - valoreB
          : valoreB - valoreA
      }

      return ordinaCantieriDirezione === 'asc'
        ? String(valoreA).localeCompare(String(valoreB))
        : String(valoreB).localeCompare(String(valoreA))
    })

  const stileRegistro = (<style>{`.registro-cantieri-tabella input { box-sizing: border-box; max-width: 100%; min-width: 0; }
                    @container registro-cantieri (max-width: 900px) {
                      .registro-cantieri-tabella thead { display: none; }
                      .registro-cantieri-tabella, .registro-cantieri-tabella tbody, .registro-cantieri-tabella tr, .registro-cantieri-tabella td { display: block; width: 100%; min-width: 0; box-sizing: border-box; }
                      .registro-cantieri-tabella td::before { display: block; font-weight: 600; margin-bottom: 4px; }
                      .registro-cantieri-tabella td:nth-child(1)::before { content: 'Nome'; }
                      .registro-cantieri-tabella td:nth-child(2)::before { content: 'Preventivo'; }
                      .registro-cantieri-tabella td:nth-child(3)::before { content: 'Inizio'; }
                      .registro-cantieri-tabella td:nth-child(4)::before { content: 'Fine'; }
                      .registro-cantieri-tabella td:nth-child(5)::before { content: 'Concluso'; }
                    }`}</style>)
  const righeRegistro = cantieriFiltrati.map((c, i) => {
              const azioneModifica = (                      <button
                        onClick={() => { preparaModificaRegistroCantiere(c); setMostraModifica(true) }}
                        style={buttonSecondary}
                      >
                        ✏️
                      </button>)
              const riga = <tr
                key={c.id || i}
                style={{
                  backgroundColor:
                    mostraModifica && cantiereRegistroEdit === c.id ? '#eff6ff' : '#fff',
                }}
              >
                <td style={excelTd}>
                  {mostraModifica && cantiereRegistroEdit === c.id ? (
                    <input
                      value={cantiereRegistroNome}
                      onChange={(e) =>
                        setCantiereRegistroNome(e.target.value)
                      }
                      style={excelInput}
                    />
                  ) : (
                    c.nome || '-'
                  )}
                </td>

                <td style={excelTd}>
                  {mostraModifica && cantiereRegistroEdit === c.id ? (
                    <input
                      value={cantiereRegistroPreventivo}
                      onChange={(e) =>
                        setCantiereRegistroPreventivo(e.target.value)
                      }
                      style={excelInput}
                    />
                  ) : (
                    formatMoney(Number(c.preventivo || 0))
                  )}
                </td>

                <td style={excelTd}>
                  {mostraModifica && cantiereRegistroEdit === c.id ? (
                    <input
                      type="date"
                      value={cantiereRegistroInizio}
                      onChange={(e) =>
                        setCantiereRegistroInizio(e.target.value)
                      }
                      style={excelInput}
                    />
                  ) : (
                    c.data_inizio_lavori || '-'
                  )}
                </td>

                <td style={excelTd}>
                  {mostraModifica && cantiereRegistroEdit === c.id ? (
                    <input
                      type="date"
                      value={cantiereRegistroFine}
                      onChange={(e) =>
                        setCantiereRegistroFine(e.target.value)
                      }
                      style={excelInput}
                    />
                  ) : (
                    c.data_fine_lavori || '-'
                  )}
                </td>

                <td style={excelTd}>
                  {mostraModifica && cantiereRegistroEdit === c.id ? (
                    <input
                      type="checkbox"
                      checked={cantiereRegistroConcluso}
                      onChange={(e) =>
                        setCantiereRegistroConcluso(e.target.checked)
                      }
                    />
                  ) : c.lavori_conclusi ? (
                    'Sì'
                  ) : (
                    'No'
                  )}
                </td>

                <td style={excelTd}>
                  {mostraModifica && cantiereRegistroEdit === c.id ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => salvaModificaRegistroCantiere(c.id)}
                        style={buttonPrimary}
                      >
                        💾
                      </button>

                      <button
                        onClick={annullaModificaRegistroCantiere}
                        style={buttonSecondary}
                      >
                        ❌
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      {azioneModifica}

                      <button
                        onClick={() => eliminaCantiere(
                          String(c.nome || ''),
                          String(c.id || '')
                        )}
                        style={{
                          ...buttonSecondary,
                          backgroundColor: '#dc2626',
                          color: '#fff',
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </td>
              </tr>
              return mostraModifica && cantiereRegistroEdit === c.id ? (
                <VistaOperativa key={c.id || i} titolo="Modifica cantiere" contesto={c.nome}
                  etichettaRitorno="← Torna al cantiere" onChiudi={() => setMostraModifica(false)}>
                  <div className="modifica-cantiere-focus" style={{ width: '100%', minWidth: 0, containerType: 'inline-size', containerName: 'registro-cantieri' }}>
                    <table className="registro-cantieri-tabella" style={{ ...excelTable, width: '100%' }}><thead><tr>
                      {['Nome', 'Preventivo', 'Inizio', 'Fine', 'Concluso', 'Azioni'].map(t => <th key={t} style={excelTh}>{t}</th>)}
                    </tr></thead><tbody>{riga}</tbody></table>
                  </div>

                </VistaOperativa>
              ) : soloAzioni ? <span key={c.id || i}>{azioneModifica}</span> : riga
            })
  if (soloAzioni) return <div style={{ minWidth: 0 }}>{stileRegistro}{righeRegistro}</div>

  return (
    <div style={excelBox}>
                  {stileRegistro}
      <div style={excelToolbar}>
        <strong>🏗️ Registro cantieri</strong>
      </div>

      <div style={{ containerType: 'inline-size', containerName: 'registro-cantieri', minWidth: 0 }}>
        <table className="registro-cantieri-tabella" style={excelTable}>
          <thead>
            <tr>
              <th
                style={{ ...excelTh, cursor: 'pointer' }}
                onClick={() =>
                  ordinaRegistro(
                    'nome',
                    setOrdinaCantieriCampo,
                    setOrdinaCantieriDirezione,
                    ordinaCantieriCampo
                  )
                }
              >
                Nome ↕
              </th>

              <th
                style={{ ...excelTh, cursor: 'pointer' }}
                onClick={() =>
                  ordinaRegistro(
                    'preventivo',
                    setOrdinaCantieriCampo,
                    setOrdinaCantieriDirezione,
                    ordinaCantieriCampo
                  )
                }
              >
                Preventivo ↕
              </th>

              <th
                style={{ ...excelTh, cursor: 'pointer' }}
                onClick={() =>
                  ordinaRegistro(
                    'data_inizio_lavori',
                    setOrdinaCantieriCampo,
                    setOrdinaCantieriDirezione,
                    ordinaCantieriCampo
                  )
                }
              >
                Inizio ↕
              </th>

              <th
                style={{ ...excelTh, cursor: 'pointer' }}
                onClick={() =>
                  ordinaRegistro(
                    'data_fine_lavori',
                    setOrdinaCantieriCampo,
                    setOrdinaCantieriDirezione,
                    ordinaCantieriCampo
                  )
                }
              >
                Fine ↕
              </th>

              <th
                style={{ ...excelTh, cursor: 'pointer' }}
                onClick={() =>
                  ordinaRegistro(
                    'lavori_conclusi',
                    setOrdinaCantieriCampo,
                    setOrdinaCantieriDirezione,
                    ordinaCantieriCampo
                  )
                }
              >
                Concluso ↕
              </th>

              <th style={excelTh}>Azioni</th>
            </tr>
          </thead>

          <tbody>
            {righeRegistro}
          </tbody>
        </table>
      </div>
    </div>
  )
}