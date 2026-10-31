'use client'

import { CostiFornitoriVista, useCostiFornitori } from './CostiFornitoriRettificati'
import { deltaRettifiche, rettificheCompatibiliConBase } from '../engines/fatture/note-credito'
import { useEffect, useState, type ComponentProps } from 'react'
import EconomiaGraficiPanel from './EconomiaGraficiPanel'
import FiltroPeriodoEconomia from './FiltroPeriodoEconomia'
import RiepilogoCostiEconomiaPanel from './RiepilogoCostiEconomiaPanel'
import SalDettagliatoPanel from './SalDettagliatoPanel'
import AccontiEconomiaPanel from './AccontiEconomiaPanel'
import VariantiCantierePanel from './VariantiCantierePanel'
import ScomposizioneContrattuale from './ScomposizioneContrattuale'
import ManodoperaEconomiaDettaglio from './ManodoperaEconomiaDettaglio'
import { leggiScomposizioneVarianti, leggiCostoQuoteFattura, leggiMaterialiDaContabilizzare, aggiungiCostoQuote, type ScomposizioneVarianti, type MaterialiOperativi } from '../engines/economia/riepilogoEconomico'

type EconomiaSezione = 'riepilogo' | 'costi' | 'sal' | 'rapportini'
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
  const [aggiornamentoKpi, setAggiornamentoKpi] = useState(0)
  const preventivoId = p.contrattoBase?.preventivoId
  const importoBase = p.contrattoBase?.importo
  const supabase = p.sal.supabase
  const [varianti, setVarianti] = useState<{
    cantiereId: string
    preventivoId: string
    importoBase: number
    supabase: typeof supabase
    delta: number | null
    scomposizione: ScomposizioneVarianti | null
    materialiOperativi?: MaterialiOperativi | null
  } | null>(null)
  const da = p.periodo.economiaDataDa, a = p.periodo.economiaDataA
  const rettifiche = useCostiFornitori(supabase, cantiere.id, da, a)
  const [quoteFattura, setQuoteFattura] = useState<{ cantiereId: string; da: string; a: string; client: typeof supabase; costo: number | null } | null>(null)

  useEffect(() => {
    let obsoleta = false
    setQuoteFattura(null)
    void leggiCostoQuoteFattura(supabase, cantiere.id, da, a).then(
      costo => { if (!obsoleta) setQuoteFattura({ cantiereId: cantiere.id, da, a, client: supabase, costo }) },
      () => { if (!obsoleta) setQuoteFattura({ cantiereId: cantiere.id, da, a, client: supabase, costo: null }) },
    )
    return () => { obsoleta = true }
  }, [supabase, cantiere.id, da, a, aggiornamentoKpi, economiaSezione])

  useEffect(() => {
    let obsoleta = false
    setVarianti(null)
    if (!preventivoId || importoBase === undefined || !Number.isFinite(importoBase)) return
    const carica = async () => {
      let delta: number | null = null
      let scomposizione: ScomposizioneVarianti | null = null
      let materialiOperativi: MaterialiOperativi | null = null
      try {
        scomposizione = await leggiScomposizioneVarianti(supabase, cantiere.id, preventivoId)
        scomposizione = { ...scomposizione, cantiereNome: cantiere.nome }
        delta = scomposizione.totale
      } catch {
        delta = null
      }
      if (scomposizione) {
        try { materialiOperativi = await leggiMaterialiDaContabilizzare(supabase, cantiere.id, scomposizione) }
        catch { /* Elenco operativo indisponibile: nessun impatto sul valore contrattuale. */ }
      }
      if (!obsoleta) {
        setVarianti({ cantiereId: cantiere.id, preventivoId, importoBase, supabase, delta, scomposizione, materialiOperativi })
      }
    }
    void carica()
    return () => { obsoleta = true }
  }, [cantiere.id, cantiere.nome, preventivoId, importoBase, supabase, aggiornamentoKpi])

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
  const costoFattura = quoteFattura?.cantiereId === cantiere.id && quoteFattura.da === da && quoteFattura.a === a && quoteFattura.client === supabase ? quoteFattura.costo : null
  const baseCoerente = rettifiche.dati ? rettificheCompatibiliConBase(rettifiche.dati, p.costi.materialiCantiere.filter(m => m.cantiere === cantiere.nome).map(m => m.id)) : false
  const deltaCredito = rettifiche.dati && baseCoerente ? deltaRettifiche(rettifiche.dati) : null
  const costiIntegrati = costoFattura === null || deltaCredito === null ? null : aggiungiCostoQuote(p.riepilogo.totaleMaterialiEconomia, p.riepilogo.totaleCostiCantiere, costoFattura + deltaCredito)
  const costoMateriali = costiIntegrati?.materiali ?? null
  const costiTotali = costiIntegrati?.costi ?? null
  const utileAggiornato = contrattoAggiornato !== null
    && costiTotali !== null ? contrattoAggiornato - costiTotali : null
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
    ['Varianti ordinarie approvate', variantiCorrenti?.scomposizione?.ordinarie ?? null],
    ['Manodopera Economia approvata', variantiCorrenti?.scomposizione?.manodopera ?? null],
    ['Materiali Economia approvati', variantiCorrenti?.scomposizione?.materiali ?? null],
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
  const kpi: [string, number | null][] = [
    ['Costi totali', costiTotali],
    ['Manodopera', p.riepilogo.totaleManodoperaCantiere],
    ['Materiali', costoMateriali],
    ['Attrezzature', p.riepilogo.totaleAttrezziEconomia],
  ]
  return (
    <section aria-label="Economia del cantiere" style={{ padding: 20, border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff', minWidth: 0 }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 22 }}>Economia del cantiere</h3>
      <CostiFornitoriVista dati={rettifiche.dati} errore={rettifiche.errore} />
      {rettifiche.dati && !baseCoerente && <p role="alert">Fonte originaria non compresa nella base legacy del Cantiere: totale generale non disponibile. Il riepilogo documentale mostra le quote verificate e le rettifiche.</p>}
      <nav aria-label="Sezioni economia" style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, marginBottom: 20, borderBottom: '1px solid #e2e8f0' }}>
        {([['riepilogo', 'Riepilogo'], ['costi', 'Costi'], ['sal', 'SAL e acconti'], ['rapportini', 'Rapportini']] as const).map(([sezione, label]) => (
          <button key={sezione} type="button" aria-pressed={economiaSezione === sezione} onClick={() => setEconomiaSezione(sezione)}
            style={{ minHeight: 44, padding: '10px 16px', borderRadius: 8, whiteSpace: 'nowrap', cursor: 'pointer', border: '1px solid #cbd5e1', background: economiaSezione === sezione ? '#0f172a' : '#fff', color: economiaSezione === sezione ? '#fff' : '#334155' }}>
            {label}
          </button>
        ))}
      </nav>
      {economiaSezione === 'rapportini' && <VariantiCantierePanel
        key={cantiere.id} cantiereId={cantiere.id} economiaRapportini
        onApprovazione={() => setAggiornamentoKpi(v => v + 1)}
        stampaContesto={{ nome: cantiere.nome, contrattoBase: importoBase ?? null, preventivoId: preventivoId ?? null }} />}
      {economiaSezione === 'riepilogo' && <section aria-label="Riepilogo economico">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
          <h4 style={{ gridColumn: '1 / -1', margin: '0' }}>Contratto</h4>
          {kpiContrattuali.map(([label, value]) => <article key={label} style={{ padding: 14, border: '1px solid #e2e8f0', borderRadius: 10 }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>{label}</div>
            {value === null
              ? <span role={erroreContratto ? 'alert' : 'status'}>{statoContratto}</span>
              : <strong style={{ fontSize: 20 }}>{label === 'Varianti approvate' && value > 0 ? '+' : ''}{p.riepilogo.formatMoney(value)}</strong>}
          </article>)}
          <h4 style={{ gridColumn: '1 / -1', margin: '0' }}>Costi aziendali</h4>
          {kpi.map(([label, value]) => <article key={label} style={{ padding: 14, border: '1px solid #e2e8f0', borderRadius: 10 }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>{label}</div>
            {value === null ? <span role="status">Costi fattura non disponibili</span> : <strong style={{ fontSize: 20 }}>{p.riepilogo.formatMoney(value)}</strong>}
          </article>)}
          <h4 style={{ gridColumn: '1 / -1', margin: '0' }}>Redditività</h4>
          <article style={{ padding: 14, border: '1px solid #e2e8f0', borderRadius: 10 }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>Utile</div>
            {utileAggiornato === null
              ? <span role={erroreContratto ? 'alert' : 'status'}>{costiTotali === null ? 'Costi fattura non disponibili' : statoContratto}</span>
              : <strong style={{ fontSize: 20 }}>{p.riepilogo.formatMoney(utileAggiornato)}</strong>}
          </article>
          <article style={{ padding: 14, border: '1px solid #e2e8f0', borderRadius: 10 }}>
            <div style={{ fontSize: 13, color: '#64748b' }}>Margine</div>
            {margineAggiornato === null
              ? <span role={erroreContratto ? 'alert' : 'status'}>{costiTotali === null ? 'Costi fattura non disponibili' : statoContratto}</span>
              : <strong style={{ fontSize: 20 }}>{margineAggiornato.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</strong>}
          </article>
        </div>
        <section aria-label="Aggiornamenti contrattuali"><h4>Aggiornamenti contrattuali approvati</h4>
          <ScomposizioneContrattuale valori={variantiCorrenti?.scomposizione ?? null} operativi={variantiCorrenti?.materialiOperativi ?? null} formatMoney={p.riepilogo.formatMoney} />
          <p>La scomposizione è già compresa nelle Varianti approvate e non si somma nuovamente al contratto.</p>
        </section>
        {preventivoId && <ManodoperaEconomiaDettaglio key={`${cantiere.id}:${preventivoId}:${aggiornamentoKpi}`} client={supabase} cantiereId={cantiere.id} contrattoId={preventivoId} cantiereNome={cantiere.nome} />}
        <div className="economia-cantiere-grafici">
          {costoMateriali !== null && costoMateriali < 0 && <p>Nel periodo il costo materiali è negativo per le rettifiche: consultare il dettaglio firmato anziché il grafico di ripartizione.</p>}
          {contrattoAggiornato !== null && utileAggiornato !== null && margineAggiornato !== null && costoMateriali !== null && costoMateriali >= 0 && <EconomiaGraficiPanel {...p.riepilogo} cantiereScheda={cantiere.nome}
            preventivoCantiere={contrattoAggiornato}
            totaleMaterialiEconomia={costoMateriali}
            totaleCostiCantiere={costiTotali}
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
        <SalDettagliatoPanel {...p.sal} scomposizioneEconomiaApprovata={variantiCorrenti?.scomposizione ?? null} contestuale cantiereContestuale={cantiere} cantiereScheda={cantiere.nome} />
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
