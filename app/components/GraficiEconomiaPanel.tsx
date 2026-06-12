'use client'

import type { CSSProperties, Dispatch, SetStateAction } from 'react'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts'

type Props = {
  graficoCantieriAperto: boolean
  setGraficoCantieriAperto: Dispatch<SetStateAction<boolean>>

  graficoTotaliAperto: boolean
  setGraficoTotaliAperto: Dispatch<SetStateAction<boolean>>

  cantieri: any[]
  accontiCantiere: any[]

  calcoloEconomiaCantiere: (nomeCantiere: string) => any
  formatMoney: (valore: any) => string

  buttonSecondary: CSSProperties
}

export default function GraficiEconomiaPanel({
  graficoCantieriAperto,
  setGraficoCantieriAperto,
  graficoTotaliAperto,
  setGraficoTotaliAperto,
  cantieri,
  accontiCantiere,
  calcoloEconomiaCantiere,
  formatMoney,
  buttonSecondary,
}: Props) {
  return (
    <>
      <button
        onClick={() => setGraficoCantieriAperto(!graficoCantieriAperto)}
        style={{
          ...buttonSecondary,
          marginTop: 30,
          marginBottom: 10,
        }}
      >
        {graficoCantieriAperto
          ? '🔽 Nascondi grafico cantieri'
          : '📈 Mostra grafico cantieri'}
      </button>

      {graficoCantieriAperto && (
        <>
          <h3 style={{ marginTop: 10 }}>📈 Bilancio grafico per cantiere</h3>

          <div
            style={{
              width: '100%',
              height: 420,
              minHeight: 420,
              border: '1px solid #cbd5e1',
              borderRadius: 12,
              padding: 12,
              background: '#fff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            <ResponsiveContainer width="100%" height={380}>
              <BarChart
                data={cantieri.map((c) => {
                  const nomeCantiere = String(c.nome || '')
                  const economia = calcoloEconomiaCantiere(nomeCantiere)
                  const preventivo = economia.preventivo

                  const incassato = accontiCantiere
                    .filter((a) => a.cantiere === c.nome)
                    .reduce((tot, a) => tot + Number(a.importo || 0), 0)

                  const daIncassare = preventivo - incassato
                  const costi = economia.costoTotale
                  const utile = incassato - costi

                  return {
                    nome: c.nome,
                    preventivo,
                    incassato,
                    daIncassare,
                    costi,
                    utile,
                  }
                })}
              >
                <XAxis dataKey="nome" />
                <YAxis />
                <Tooltip formatter={(value) => formatMoney(Number(value || 0))} />
                <Legend />

                <Bar dataKey="preventivo" name="Preventivo" fill="#2563eb" />
                <Bar dataKey="incassato" name="Incassato" fill="#16a34a" />
                <Bar
                  dataKey="daIncassare"
                  name="Da incassare"
                  fill="#f59e0b"
                />
                <Bar dataKey="costi" name="Costi" fill="#dc2626" />
                <Bar dataKey="utile" name="Utile" fill="#7c3aed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <button
        onClick={() => setGraficoTotaliAperto(!graficoTotaliAperto)}
        style={{
          ...buttonSecondary,
          marginTop: 30,
          marginBottom: 10,
        }}
      >
        {graficoTotaliAperto
          ? '🔽 Nascondi Grafico Totali economia generale'
          : '📈 Grafico Totali economia generale'}
      </button>

      {graficoTotaliAperto && (
        <>
          <h3 style={{ marginTop: 10 }}>💶 Totali economia generale</h3>

          <div
            style={{
              width: '100%',
              height: 420,
              minHeight: 420,
              border: '1px solid #cbd5e1',
              borderRadius: 12,
              padding: 12,
              background: '#fff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            <ResponsiveContainer width="100%" height={380}>
              <BarChart
                data={[
                  {
                    nome: 'Totali impresa',

                    preventivo: cantieri.reduce(
                      (tot, c) =>
                        tot +
                        Number(
                          calcoloEconomiaCantiere(String(c.nome || ''))
                            .preventivo || 0
                        ),
                      0
                    ),

                    incassato: accontiCantiere.reduce(
                      (tot, a) => tot + Number(a.importo || 0),
                      0
                    ),

                    daIncassare:
                      cantieri.reduce(
                        (tot, c) =>
                          tot +
                          Number(
                            calcoloEconomiaCantiere(String(c.nome || ''))
                              .preventivo || 0
                          ),
                        0
                      ) -
                      accontiCantiere.reduce(
                        (tot, a) => tot + Number(a.importo || 0),
                        0
                      ),

                    costi: cantieri.reduce(
                      (tot, c) =>
                        tot +
                        Number(
                          calcoloEconomiaCantiere(String(c.nome || ''))
                            .costoTotale || 0
                        ),
                      0
                    ),

                    utile:
                      accontiCantiere.reduce(
                        (tot, a) => tot + Number(a.importo || 0),
                        0
                      ) -
                      cantieri.reduce(
                        (tot, c) =>
                          tot +
                          Number(
                            calcoloEconomiaCantiere(String(c.nome || ''))
                              .costoTotale || 0
                          ),
                        0
                      ),
                  },
                ]}
              >
                <XAxis dataKey="nome" />
                <YAxis />
                <Tooltip formatter={(value) => formatMoney(Number(value || 0))} />
                <Legend />

                <Bar dataKey="preventivo" name="Preventivo" fill="#2563eb" />
                <Bar dataKey="incassato" name="Incassato" fill="#16a34a" />
                <Bar
                  dataKey="daIncassare"
                  name="Da incassare"
                  fill="#f59e0b"
                />
                <Bar dataKey="costi" name="Costi" fill="#dc2626" />
                <Bar dataKey="utile" name="Utile" fill="#7c3aed" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </>
  )
}