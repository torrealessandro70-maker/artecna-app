'use client'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts'

export default function EconomiaGraficiPanel(props: any) {
  const p = props

  if (!p.cantiereScheda) return null

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 15,
        marginBottom: 20,
      }}
    >
      <div
        style={{
          height: 260,
          background: '#fff',
          border: '1px solid #ddd',
          borderRadius: 12,
          padding: 10,
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={[
              { nome: 'Preventivo', valore: p.preventivoCantiere },
              { nome: 'Costi', valore: p.totaleCostiCantiere },
              { nome: 'Acconti', valore: p.totaleAccontiCantiere },
              { nome: 'Residuo', valore: p.residuoDaIncassare },
              { nome: 'Utile', valore: p.utileCantiere },
            ]}
            barCategoryGap="40%"
            barGap={4}
          >
            <XAxis dataKey="nome" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="valore" barSize={30} radius={[6, 6, 0, 0]}>
              {[0, 1, 2, 3, 4].map((_, index) => {
                const colori = [
                  '#3b82f6',
                  '#ef4444',
                  '#06b6d4',
                  '#f59e0b',
                  '#22c55e',
                ]

                return <Cell key={index} fill={colori[index]} />
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div
        style={{
          height: 260,
          background: '#fff',
          border: '1px solid #ddd',
          borderRadius: 12,
          padding: 10,
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={[
                {
                  nome: 'Manodopera',
                  valore: p.totaleManodoperaCantiere || 0,
                },
                {
                  nome: 'Materiali',
                  valore: p.totaleMaterialiEconomia || 0,
                },
                {
                  nome: 'Attrezzi',
                  valore: p.totaleAttrezziEconomia || 0,
                },
              ]}
              dataKey="valore"
              nameKey="nome"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={3}
              label={({ percent }) =>
                `${((percent || 0) * 100).toFixed(0)}%`
              }
              labelLine={false}
              onClick={(data: any) => {
                if (data?.nome === 'Manodopera') {
                  p.setMostraDettaglioManodopera(true)
                  p.setMostraDettaglioMateriali(false)
                  p.setMostraDettaglioAttrezzi(false)
                }

                if (data?.nome === 'Materiali') {
                  p.setMostraDettaglioMateriali(true)
                  p.setMostraDettaglioManodopera(false)
                  p.setMostraDettaglioAttrezzi(false)
                }

                if (data?.nome === 'Attrezzi') {
                  p.setMostraDettaglioAttrezzi(true)
                  p.setMostraDettaglioManodopera(false)
                  p.setMostraDettaglioMateriali(false)
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              <Cell fill="#ef4444" />
              <Cell fill="#f59e0b" />
              <Cell fill="#3b82f6" />
            </Pie>

            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}