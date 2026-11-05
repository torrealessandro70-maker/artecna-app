'use client'

import { useMemo, useRef, useState, type ReactNode } from 'react'
import VistaOperativa from './VistaOperativa'
import { mappaPreventiviElenco, totalePreventivoElenco, confrontaPreventiviElenco } from '../utils/cantiereElenco'

type Props = {
  renderModificaCantiere?: (cantiere: Props['cantieri'][number]) => ReactNode
  cantieri: any[]
  preventivi: any[]
  ricercaCantiere: string
  setRicercaCantiere: (v: string) => void
  setNomeCantiere: (v: string) => void
  preventivoCantiereInput: string
  setPreventivoCantiereInput: (v: string) => void
  aggiungiCantiere: () => void
  mostraCantieriConclusi: boolean
  setMostraCantieriConclusi: (v: boolean) => void
  ordinaCantieriCampo: string
  ordinaCantieriDirezione: string
  cambiaOrdinamentoCantieri: (
  campo: 'nome' | 'preventivo' | 'inizio' | 'fine' | 'concluso'
) => void
  setCantiereScheda: (v: string) => void
  setCantiereIdScheda: (v: string) => void
  setSottoSezioneCantieri: (v: string) => void
  eliminaCantiere: (nome: string, idCantiereCancellato: string) => void
  formatMoney: (n: number) => string
  cardStyle: any
  excelTable: any
  excelTh: any
  excelTd: any
  buttonPrimary: any
  buttonSecondary: any
}

export default function CantieriElencoPanel({
  cantieri,
  renderModificaCantiere,
  preventivi,
  ricercaCantiere,
  setRicercaCantiere,
  setNomeCantiere,
  preventivoCantiereInput,
  setPreventivoCantiereInput,
  aggiungiCantiere,
  mostraCantieriConclusi,
  setMostraCantieriConclusi,
  ordinaCantieriCampo,
  ordinaCantieriDirezione,
  cambiaOrdinamentoCantieri,
  setCantiereScheda,
  setCantiereIdScheda,
  setSottoSezioneCantieri,
  eliminaCantiere,
  formatMoney,
  cardStyle,
  excelTable,
  excelTh,
  excelTd,
  buttonPrimary,
  buttonSecondary,
}: Props) {
  const [mostraNuovo, setMostraNuovo] = useState(false)
  const aperturaRef = useRef<HTMLButtonElement>(null)
  const preventiviPerCantiere = useMemo(() => mappaPreventiviElenco(preventivi), [preventivi])
  return (
    <div style={{ ...cardStyle, minWidth: 0 }}>
      <h2>Elenco cantieri</h2>
      <style>{`@container elenco-cantieri (max-width: 900px) {
        .elenco-cantieri-tabella thead { display: none; }
        .elenco-cantieri-tabella, .elenco-cantieri-tabella tbody, .elenco-cantieri-tabella tr, .elenco-cantieri-tabella td { display: block; width: 100%; min-width: 0 !important; box-sizing: border-box; }
        .elenco-cantieri-tabella td { white-space: normal !important; overflow-wrap: anywhere; }
        .elenco-cantieri-tabella td::before { display: block; font-weight: 700; }
        .elenco-cantieri-tabella td:nth-child(1)::before { content: 'Nome'; }
        .elenco-cantieri-tabella td:nth-child(2)::before { content: 'Preventivo'; }
        .elenco-cantieri-tabella td:nth-child(3)::before { content: 'Inizio'; }
        .elenco-cantieri-tabella td:nth-child(4)::before { content: 'Fine'; }
        .elenco-cantieri-tabella td:nth-child(5)::before { content: 'Concluso'; }
        .elenco-cantieri-tabella td:nth-child(6)::before { content: 'Azioni'; }
        .elenco-cantieri-tabella td > div { flex-wrap: wrap; }
      }`}</style>

      <button type="button" ref={aperturaRef} onClick={() => setMostraNuovo(true)} style={buttonPrimary}>Nuovo cantiere</button>
      <input aria-label="Cerca cantiere" placeholder="Cerca cantiere..." value={ricercaCantiere || ''}
        onChange={(e) => { setRicercaCantiere(e.target.value); setNomeCantiere(e.target.value) }}
        style={{ display: 'block', padding: 8, margin: '12px 0', width: 220, maxWidth: '100%', boxSizing: 'border-box' }} />
      {mostraNuovo && <VistaOperativa titolo="Nuovo cantiere" etichettaRitorno="← Torna ai cantieri"
        onChiudi={() => setMostraNuovo(false)} ritornoFocusRef={aperturaRef}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 15 }}>
        <input
          placeholder="Nome cantiere"
          value={ricercaCantiere || ''}
          onChange={(e) => {
            setRicercaCantiere(e.target.value)
            setNomeCantiere(e.target.value)
          }}
          style={{ padding: 8, width: 220, maxWidth: '100%', boxSizing: 'border-box' }}
        />

        <input
          placeholder="Preventivo €"
          value={preventivoCantiereInput || ''}
          onChange={(e) => setPreventivoCantiereInput(e.target.value)}
          style={{ padding: 8, width: 140, maxWidth: '100%', boxSizing: 'border-box' }}
        />

        <button onClick={aggiungiCantiere} style={buttonPrimary}>
          Aggiungi
        </button>
      </div>

      </VistaOperativa>}

      <div style={{ marginBottom: 12 }}>
        <button
          onClick={() =>
            setMostraCantieriConclusi(!mostraCantieriConclusi)
          }
          style={buttonSecondary}
        >
          {mostraCantieriConclusi
            ? 'Nascondi cantieri conclusi'
            : `Mostra cantieri conclusi (${
                cantieri.filter((c) => c.lavori_conclusi).length
              })`}
        </button>
      </div>

      {cantieri.length === 0 ? (
        <p>Nessun cantiere presente</p>
      ) : (
        <div
          style={{
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            overflow: 'auto', containerType: 'inline-size', containerName: 'elenco-cantieri', minWidth: 0,
            background: '#fff',
          }}
        >
          <h3 style={{ padding: 12, margin: 0 }}>
            🏗️ Registro cantieri
          </h3>

          <table className="elenco-cantieri-tabella"
            style={{
              ...excelTable,
              width: '100%',
              tableLayout: 'auto',
            }}
          >
            <thead>
              <tr>
                <th
                  style={excelTh}
                  onClick={() => cambiaOrdinamentoCantieri('nome')}
                >
                  Nome ↕
                </th>
                <th
                  style={excelTh}
                  onClick={() => cambiaOrdinamentoCantieri('preventivo')}
                >
                  Preventivo ↕
                </th>
                <th
                  style={excelTh}
                  onClick={() => cambiaOrdinamentoCantieri('inizio')}
                >
                  Inizio ↕
                </th>
                <th
                  style={excelTh}
                  onClick={() => cambiaOrdinamentoCantieri('fine')}
                >
                  Fine ↕
                </th>
                <th
                  style={excelTh}
                  onClick={() => cambiaOrdinamentoCantieri('concluso')}
                >
                  Concluso ↕
                </th>
                <th style={excelTh}>Azioni</th>
              </tr>
            </thead>

            <tbody>
              {[
                ...cantieri.filter(
                  (c) =>
                    !c.lavori_conclusi &&
                    String(c.nome || '')
                      .toLowerCase()
                      .includes(ricercaCantiere.toLowerCase())
                ),
                ...(mostraCantieriConclusi
                  ? cantieri.filter(
                      (c) =>
                        c.lavori_conclusi &&
                        String(c.nome || '')
                          .toLowerCase()
                          .includes(ricercaCantiere.toLowerCase())
                    )
                  : []),
              ]
                .sort((a, b) => {
                  let valoreA: any = ''
                  let valoreB: any = ''

                  if (ordinaCantieriCampo === 'nome') {
                    valoreA = a.nome || ''
                    valoreB = b.nome || ''
                  }

                  if (ordinaCantieriCampo === 'preventivo') {
                    return confrontaPreventiviElenco(a, b, preventiviPerCantiere, ordinaCantieriDirezione)
                  }

                  if (ordinaCantieriCampo === 'inizio') {
                    valoreA = a.data_inizio_lavori || ''
                    valoreB = b.data_inizio_lavori || ''
                  }

                  if (ordinaCantieriCampo === 'fine') {
                    valoreA = a.data_fine_lavori || ''
                    valoreB = b.data_fine_lavori || ''
                  }

                  if (ordinaCantieriCampo === 'concluso') {
                    valoreA = a.lavori_conclusi ? 1 : 0
                    valoreB = b.lavori_conclusi ? 1 : 0
                  }

                  if (typeof valoreA === 'number') {
                    return ordinaCantieriDirezione === 'asc'
                      ? valoreA - valoreB
                      : valoreB - valoreA
                  }

                  return ordinaCantieriDirezione === 'asc'
                    ? String(valoreA).localeCompare(String(valoreB))
                    : String(valoreB).localeCompare(String(valoreA))
                })
                .map((c, i) => (
                  <tr key={c.id || i}>
                    <td style={excelTd}>
                      {ricercaCantiere &&
                      c.nome
                        ?.toLowerCase()
                        .includes(ricercaCantiere.toLowerCase()) ? (
                        <>
                          {c.nome
                            .split(new RegExp(`(${ricercaCantiere})`, 'gi'))
                            .map((parte: string, idx: number) =>
                              parte.toLowerCase() ===
                              ricercaCantiere.toLowerCase() ? (
                                <mark
                                  key={idx}
                                  style={{
                                    background: '#fde047',
                                    padding: '0 2px',
                                    borderRadius: 3,
                                  }}
                                >
                                  {parte}
                                </mark>
                              ) : (
                                parte
                              )
                            )}
                        </>
                      ) : (
                        c.nome
                      )}
                    </td>

                    <td style={excelTd}>
                      {totalePreventivoElenco(c, preventiviPerCantiere) === undefined
                        ? 'Contrattuale da verificare'
                        : totalePreventivoElenco(c, preventiviPerCantiere) === null
                        ? 'Da selezionare'
                        : formatMoney(totalePreventivoElenco(c, preventiviPerCantiere)!)}
                    </td>

                    <td style={excelTd}>{c.data_inizio_lavori || '-'}</td>

                    <td style={excelTd}>{c.data_fine_lavori || '-'}</td>

                    <td style={excelTd}>
                      {c.lavori_conclusi ? 'Sì' : 'No'}
                    </td>

                    <td style={excelTd}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {renderModificaCantiere?.(c)}
                       <button
         onClick={() => {
             setCantiereIdScheda(String(c.id || ''))
             setCantiereScheda(String(c.nome || ''))
             setSottoSezioneCantieri('scheda')
        }}
         style={buttonSecondary}
          >
        ✔
		       </button>

                        <button
                          onClick={() => eliminaCantiere(
                            String(c.nome || ''),
                            String(c.id || '')
                          )}
                          style={{
                            background: '#dc2626',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 6,
                            padding: '8px 10px',
                            cursor: 'pointer',
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
