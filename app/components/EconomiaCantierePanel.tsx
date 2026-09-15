'use client'

import { useState, type ComponentProps } from 'react'
import EconomiaGraficiPanel from './EconomiaGraficiPanel'
import FiltroPeriodoEconomia from './FiltroPeriodoEconomia'
import RiepilogoCostiEconomiaPanel from './RiepilogoCostiEconomiaPanel'
import SalDettagliatoPanel from './SalDettagliatoPanel'
import AccontiEconomiaPanel from './AccontiEconomiaPanel'

type EconomiaSezione = 'riepilogo' | 'costi' | 'sal'
type Riepilogo = {
  preventivoCantiere: number
  totaleManodoperaCantiere: number
  totaleMaterialiEconomia: number
  totaleAttrezziEconomia: number
  totaleCostiCantiere: number
  totaleAccontiCantiere: number
  residuoDaIncassare: number
  utileCantiere: number
  margineCantiere: string
  formatMoney: (n: number) => string
}
export type EconomiaPanelProps = {
  riepilogo: Riepilogo
  periodo: ComponentProps<typeof FiltroPeriodoEconomia>
  costi: Omit<ComponentProps<typeof RiepilogoCostiEconomiaPanel>, 'cantiereScheda'>
  sal: Omit<ComponentProps<typeof SalDettagliatoPanel>, 'contestuale' | 'cantiereContestuale' | 'cantiereScheda'>
  acconti: Omit<ComponentProps<typeof AccontiEconomiaPanel>, 'cantiereScheda'>
}
type Props = {
  cantiere: { id: string; nome: string }
  panelProps: EconomiaPanelProps
}

export default function EconomiaCantierePanel({ cantiere, panelProps: p }: Props) {
  const [economiaSezione, setEconomiaSezione] = useState<EconomiaSezione>('riepilogo')
  const apriCosto = (setter: (v: boolean) => void) => (visibile: boolean) => {
    setter(visibile)
    if (visibile) setEconomiaSezione('costi')
  }
  const kpi: [string, number][] = [
    ['Preventivo', p.riepilogo.preventivoCantiere],
    ['Costi totali', p.riepilogo.totaleCostiCantiere],
    ['Manodopera', p.riepilogo.totaleManodoperaCantiere],
    ['Materiali', p.riepilogo.totaleMaterialiEconomia],
    ['Attrezzature', p.riepilogo.totaleAttrezziEconomia],
    ['Acconti', p.riepilogo.totaleAccontiCantiere],
    ['Residuo da incassare', p.riepilogo.residuoDaIncassare],
    ['Utile', p.riepilogo.utileCantiere],
  ]
  return (
    <section aria-label="Economia del cantiere" style={{ padding: 20, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff', minWidth: 0 }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 22 }}>Economia del cantiere</h3>
      <nav aria-label="Sezioni economia" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, marginBottom: 20, borderBottom: '1px solid #e2e8f0' }}>
        {([['riepilogo', 'Riepilogo'], ['costi', 'Costi'], ['sal', 'SAL e acconti']] as const).map(([sezione, label]) => (
          <button key={sezione} type="button" aria-pressed={economiaSezione === sezione} onClick={() => setEconomiaSezione(sezione)}
            style={{ minHeight: 44, padding: '10px 16px', borderRadius: 8, whiteSpace: 'nowrap', cursor: 'pointer', border: '1px solid #cbd5e1', background: economiaSezione === sezione ? '#0f172a' : '#fff', color: economiaSezione === sezione ? '#fff' : '#334155' }}>
            {label}
          </button>
        ))}
      </nav>
      {economiaSezione === 'riepilogo' && <section aria-label="Riepilogo economico">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
          {kpi.map(([label, value]) => <article key={label} style={{ padding: 14, border: '1px solid #e2e8f0', borderRadius: 10 }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>{label}</div>
            <strong style={{ fontSize: 20 }}>{p.riepilogo.formatMoney(Number(value || 0))}</strong>
          </article>)}
          <article style={{ padding: 14, border: '1px solid #e2e8f0', borderRadius: 10 }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>Margine</div>
            <strong style={{ fontSize: 20 }}>{Number(p.riepilogo.margineCantiere || 0).toFixed(1)}%</strong>
          </article>
        </div>
        <div className="economia-cantiere-grafici">
          <EconomiaGraficiPanel {...p.riepilogo} cantiereScheda={cantiere.nome}
            setMostraDettaglioManodopera={apriCosto(p.costi.setMostraDettaglioManodopera)}
            setMostraDettaglioMateriali={apriCosto(p.costi.setMostraDettaglioMateriali)}
            setMostraDettaglioAttrezzi={apriCosto(p.costi.setMostraAttrezziCantiere)} />
        </div>
      </section>}
      {economiaSezione === 'costi' && <section aria-label="Costi del cantiere" style={{ minWidth: 0, overflowX: 'auto' }}>
        <FiltroPeriodoEconomia {...p.periodo} />
        <RiepilogoCostiEconomiaPanel {...p.costi} cantiereScheda={cantiere.nome} />
      </section>}
      {economiaSezione === 'sal' && <section aria-label="SAL e acconti" style={{ display: 'grid', gap: 20, minWidth: 0, overflowX: 'auto' }}>
        <div className="economia-cantiere-acconti" style={{ minWidth: 0, overflowX: 'auto' }}>
          <AccontiEconomiaPanel {...p.acconti} cantiereScheda={cantiere.nome} />
        </div>
        <SalDettagliatoPanel {...p.sal} contestuale cantiereContestuale={cantiere} cantiereScheda={cantiere.nome} />
      </section>}
      <style>{`
        .economia-cantiere-acconti button { min-height: 44px; }
        .economia-cantiere-grafici > div > div { min-width: 0; }
        @media (max-width: 760px) {
          .economia-cantiere-grafici > div { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>
    </section>
  )
}
