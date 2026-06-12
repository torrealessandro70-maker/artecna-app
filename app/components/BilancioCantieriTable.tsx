'use client'

import type { CSSProperties } from 'react'

type Props = {
  cantieri: any[]
  accontiCantiere: any[]
  fattureEmesse: any[]

  ordineBilancioCampo: string
  ordineBilancioDirezione: 'asc' | 'desc'
  ordinaBilancioCantiere: (campo: string) => void

  calcoloEconomiaCantiere: (nomeCantiere: string) => any
  formatMoney: (valore: any) => string

  excelTable: CSSProperties
  excelTh: CSSProperties
  excelTd: CSSProperties
}

export default function BilancioCantieriTable({
  cantieri,
  accontiCantiere,
  fattureEmesse,
  ordineBilancioCampo,
  ordineBilancioDirezione,
  ordinaBilancioCantiere,
  calcoloEconomiaCantiere,
  formatMoney,
  excelTable,
  excelTh,
  excelTd,
}: Props) {
  return (
    <>
      <h3 style={{ marginTop: 30 }}>📊 Bilancio per cantiere</h3>

      <div
        style={{
          height: 420,
          overflow: 'auto',
          border: '1px solid #cbd5e1',
          borderRadius: 10,
          background: '#fff',
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        <table
          style={{
            ...excelTable,
            tableLayout: 'auto',
            width: 'max-content',
            minWidth: '100%',
          }}
        >
          <thead>
            <tr>
              {[
                ['nome', 'Cantiere'],
                ['preventivo', 'Preventivo'],
                ['incassato', 'Incassato'],
                ['daIncassare', 'Da incassare'],
                ['daFatturare', 'Da fatturare'],
                ['fatturato', 'Fatturato'],
                ['costi', 'Costi'],
                ['utile', 'Utile'],
                ['margine', 'Margine'],
                ['stato', 'Stato'],
              ].map(([campo, label]) => (
                <th
                  key={campo}
                  style={{ ...excelTh, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  onClick={() => ordinaBilancioCantiere(campo)}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {cantieri
              .map((c) => {
                const nomeCantiere = String(c.nome || '')
                const economia = calcoloEconomiaCantiere(nomeCantiere)
                const preventivo = economia.preventivo

                const incassato = accontiCantiere
                  .filter((a) => a.cantiere === nomeCantiere)
                  .reduce((tot, a) => tot + Number(a.importo || 0), 0)

                const fatturato = fattureEmesse
                  .filter((f) => f.cantiere === c.nome)
                  .reduce((tot, f) => tot + Number(f.totale || 0), 0)

                const daIncassare = preventivo - incassato
                const daFatturare = incassato - fatturato
                const costi = economia.costoTotale
                const utile = incassato - costi
                const margine = incassato > 0 ? (utile / incassato) * 100 : 0

                const stato =
                  utile < 0 ? 'perdita' : margine < 10 ? 'attenzione' : 'ok'

                return {
                  id: c.id,
                  nome: c.nome,
                  preventivo,
                  incassato,
                  daIncassare,
                  daFatturare,
                  fatturato,
                  costi,
                  utile,
                  margine,
                  stato,
                }
              })
              .sort((a, b) => {
                const valoreA = a[ordineBilancioCampo as keyof typeof a] ?? ''
                const valoreB = b[ordineBilancioCampo as keyof typeof b] ?? ''

                if (typeof valoreA === 'number' && typeof valoreB === 'number') {
                  return ordineBilancioDirezione === 'asc'
                    ? valoreA - valoreB
                    : valoreB - valoreA
                }

                return ordineBilancioDirezione === 'asc'
                  ? String(valoreA).localeCompare(String(valoreB))
                  : String(valoreB).localeCompare(String(valoreA))
              })
              .map((c) => (
                <tr key={c.id || c.nome}>
                  <td style={excelTd}>{c.nome}</td>
                  <td style={excelTd}>{formatMoney(c.preventivo)}</td>
                  <td style={excelTd}>{formatMoney(c.incassato)}</td>
                  <td style={excelTd}>{formatMoney(c.daIncassare)}</td>

                  <td
                    style={{
                      ...excelTd,
                      color: c.daFatturare > 0 ? '#dc2626' : 'green',
                      fontWeight: 700,
                    }}
                  >
                    {formatMoney(c.daFatturare)}
                  </td>

                  <td style={excelTd}>{formatMoney(c.fatturato)}</td>
                  <td style={excelTd}>{formatMoney(c.costi)}</td>

                  <td
                    style={{
                      ...excelTd,
                      color: c.utile >= 0 ? 'green' : 'red',
                      fontWeight: 700,
                    }}
                  >
                    {formatMoney(c.utile)}
                  </td>

                  <td style={excelTd}>{c.margine.toFixed(1)}%</td>

                  <td
                    style={{
                      ...excelTd,
                      fontWeight: 700,
                      color:
                        c.stato === 'perdita'
                          ? 'red'
                          : c.stato === 'attenzione'
                          ? '#f59e0b'
                          : 'green',
                    }}
                  >
                    {c.stato === 'perdita'
                      ? '🚨 Perdita'
                      : c.stato === 'attenzione'
                      ? '⚠️ Basso margine'
                      : '✅ Utile'}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  )
}