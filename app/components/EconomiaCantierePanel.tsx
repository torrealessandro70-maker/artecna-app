'use client'

import { useEffect, useState, type ComponentProps } from 'react'
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
  contrattoBase: { preventivoId: string; importo: number } | null
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
  const preventivoId = p.contrattoBase?.preventivoId
  const importoBase = p.contrattoBase?.importo
  const supabase = p.sal.supabase
  const [varianti, setVarianti] = useState<{
    cantiereId: string
    preventivoId: string
    importoBase: number
    supabase: typeof supabase
    delta: number | null
  } | null>(null)

  useEffect(() => {
    let obsoleta = false
    setVarianti(null)
    if (!preventivoId || importoBase === undefined || !Number.isFinite(importoBase)) return
    const carica = async () => {
      let delta: number | null = null
      try {
        const { data, error } = await supabase.rpc(
          'leggi_varianti_cantiere', { p_cantiere_id: cantiere.id },
        )
        if (error || !Array.isArray(data)) throw new Error('Varianti non disponibili')
        delta = data
          .filter(v => v.stato === 'approvata' && v.preventivo_contrattuale_id === preventivoId)
          .reduce((tot, v) => {
            const importo = Number(v.importo_delta_approvato)
            if (v.importo_delta_approvato == null || !Number.isFinite(importo)) {
              throw new Error('Importo variante non disponibile')
            }
            return tot + importo
          }, 0)
        if (!Number.isFinite(delta)) delta = null
      } catch {
        delta = null
      }
      if (!obsoleta) {
        setVarianti({ cantiereId: cantiere.id, preventivoId, importoBase, supabase, delta })
      }
    }
    void carica()
    return () => { obsoleta = true }
  }, [cantiere.id, preventivoId, importoBase, supabase])

  const contrattoValido = Boolean(preventivoId) && importoBase !== undefined && Number.isFinite(importoBase)
  const variantiCorrenti = varianti?.cantiereId === cantiere.id
    && varianti.preventivoId === preventivoId
    && varianti.importoBase === importoBase
    && varianti.supabase === supabase ? varianti : null
  const erroreContratto = !contrattoValido
    ? 'Contratto base non disponibile.'
    : variantiCorrenti?.delta === null
      ? 'Impossibile caricare le varianti approvate. Riaprire il pannello per riprovare.'
      : null
  const statoContratto = erroreContratto || 'Caricamento varianti…'
  const deltaVariantiApprovate = contrattoValido ? variantiCorrenti?.delta ?? null : null
  const contrattoAggiornato = deltaVariantiApprovate !== null && importoBase !== undefined
    ? importoBase + deltaVariantiApprovate : null
  const utileAggiornato = contrattoAggiornato !== null
    ? contrattoAggiornato - p.riepilogo.totaleCostiCantiere : null
  const margineAggiornato = contrattoAggiornato !== null && utileAggiornato !== null
    ? contrattoAggiornato !== 0 ? (utileAggiornato / contrattoAggiornato) * 100 : 0
    : null
  const accontiCumulativi = p.sal.accontiCantiere
    .filter(a => a.cantiere === cantiere.nome)
    .reduce((tot, a) => tot + Number(a.importo || 0), 0)
  const salMaturato = p.sal.salLavorazioni
    .filter(s => s.cantiere === cantiere.nome)
    .reduce((tot, s) => tot + Number(s.importo_maturato || 0), 0)
  const daRichiedere = salMaturato - accontiCumulativi
  const residuoContrattuale = contrattoAggiornato !== null
    ? contrattoAggiornato - accontiCumulativi : null
  const kpiContrattuali: [string, number | null][] = [
    ['Contratto base', contrattoAggiornato !== null ? importoBase! : null],
    ['Varianti approvate', deltaVariantiApprovate],
    ['Contratto aggiornato', contrattoAggiornato],
    ['SAL maturato', salMaturato],
    ['Acconti ricevuti', accontiCumulativi],
    ['Da richiedere', daRichiedere],
    ['Residuo contrattuale da incassare', residuoContrattuale],
  ]
  const apriCosto = (setter: (v: boolean) => void) => (visibile: boolean) => {
    setter(visibile)
    if (visibile) setEconomiaSezione('costi')
  }
  const kpi: [string, number][] = [
    ['Costi totali', p.riepilogo.totaleCostiCantiere],
    ['Manodopera', p.riepilogo.totaleManodoperaCantiere],
    ['Materiali', p.riepilogo.totaleMaterialiEconomia],
    ['Attrezzature', p.riepilogo.totaleAttrezziEconomia],
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
          {kpiContrattuali.map(([label, value]) => <article key={label} style={{ padding: 14, border: '1px solid #e2e8f0', borderRadius: 10 }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>{label}</div>
            {value === null
              ? <span role={erroreContratto ? 'alert' : 'status'}>{statoContratto}</span>
              : <strong style={{ fontSize: 20 }}>{label === 'Varianti approvate' && value > 0 ? '+' : ''}{p.riepilogo.formatMoney(value)}</strong>}
          </article>)}
          {kpi.map(([label, value]) => <article key={label} style={{ padding: 14, border: '1px solid #e2e8f0', borderRadius: 10 }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>{label}</div>
            <strong style={{ fontSize: 20 }}>{p.riepilogo.formatMoney(Number(value || 0))}</strong>
          </article>)}
          <article style={{ padding: 14, border: '1px solid #e2e8f0', borderRadius: 10 }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>Utile</div>
            {utileAggiornato === null
              ? <span role={erroreContratto ? 'alert' : 'status'}>{statoContratto}</span>
              : <strong style={{ fontSize: 20 }}>{p.riepilogo.formatMoney(utileAggiornato)}</strong>}
          </article>
          <article style={{ padding: 14, border: '1px solid #e2e8f0', borderRadius: 10 }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>Margine</div>
            {margineAggiornato === null
              ? <span role={erroreContratto ? 'alert' : 'status'}>{statoContratto}</span>
              : <strong style={{ fontSize: 20 }}>{margineAggiornato.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</strong>}
          </article>
        </div>
        <div className="economia-cantiere-grafici">
          {contrattoAggiornato !== null && utileAggiornato !== null && margineAggiornato !== null && <EconomiaGraficiPanel {...p.riepilogo} cantiereScheda={cantiere.nome}
            preventivoCantiere={contrattoAggiornato}
            totaleAccontiCantiere={accontiCumulativi}
            residuoDaIncassare={residuoContrattuale}
            utileCantiere={utileAggiornato}
            margineCantiere={margineAggiornato.toFixed(1)}
            setMostraDettaglioManodopera={apriCosto(p.costi.setMostraDettaglioManodopera)}
            setMostraDettaglioMateriali={apriCosto(p.costi.setMostraDettaglioMateriali)}
            setMostraDettaglioAttrezzi={apriCosto(p.costi.setMostraAttrezziCantiere)} />}
        </div>
      </section>}
      {economiaSezione === 'costi' && <section aria-label="Costi del cantiere" style={{ minWidth: 0, overflowX: 'auto' }}>
        <FiltroPeriodoEconomia {...p.periodo} />
        <RiepilogoCostiEconomiaPanel {...p.costi} cantiereScheda={cantiere.nome} />
      </section>}
      {economiaSezione === 'sal' && <section aria-label="SAL e acconti" style={{ display: 'grid', gap: 20, minWidth: 0, overflowX: 'auto' }}>
        <div className="economia-cantiere-acconti" style={{ minWidth: 0, overflowX: 'auto' }}>
          {residuoContrattuale === null
            ? <p role={erroreContratto ? 'alert' : 'status'}>{statoContratto}</p>
            : <AccontiEconomiaPanel {...p.acconti} cantiereScheda={cantiere.nome}
                totaleAccontiCantiere={accontiCumulativi}
                residuoDaIncassare={residuoContrattuale} />}
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
