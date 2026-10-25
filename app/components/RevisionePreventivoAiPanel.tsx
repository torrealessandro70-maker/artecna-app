'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import PriceResolutionSummary from './PriceResolutionSummary'
import { modificaVoceDiagnostica, esitoDiagnosticaVoce } from '../engines/price-resolution/diagnostica-voce'
import PrezzoWebVoce from './PrezzoWebVoce'
import AnalisiPrezzoVoce, { chiaveAnalisiVoce } from './AnalisiPrezzoVoce'
import { applicaAnalisiPrezzo } from '../engines/price-resolution/ai-price-analyst'
import type { EsitoWeb } from '../engines/price-resolution/web-fallback'
import { applicaPrezzoWeb, puoSalvarePrezzoInMemoria } from '../engines/price-resolution/web-fallback'
import type { PriceKnowledgeItem } from '../engines/price-resolution/types'
import type { ContrattoContext, OperazioneIntegrativa } from '../engines/preventivo-generation/contesto'
import {
  formatConfidence,
  getConfidenceBadge,
} from '../engines/confidence'

type EsitoCalcolo =
  | { valore: number; errore?: never }
  | { valore?: never; errore: string }

function calcolaEspressione(input: string): EsitoCalcolo {
  const formula = input.replace(/,/g, '.').replace(/\s+/g, '')
  if (!formula) return { errore: 'Inserisci un calcolo' }
  if (!/^[0-9.+\-*/()]+$/.test(formula)) {
    return { errore: 'Sono ammessi solo numeri e operatori + - * /' }
  }

  let posizione = 0

  const leggiNumero = (): number => {
    const inizio = posizione
    while (/[0-9.]/.test(formula[posizione] || '')) posizione += 1
    const testo = formula.slice(inizio, posizione)
    if (!testo || (testo.match(/\./g) || []).length > 1) {
      throw new Error('Numero non valido')
    }
    const numero = Number(testo)
    if (!Number.isFinite(numero)) throw new Error('Numero non valido')
    return numero
  }

  const leggiFattore = (): number => {
    if (formula[posizione] === '+') {
      posizione += 1
      return leggiFattore()
    }
    if (formula[posizione] === '-') {
      posizione += 1
      return -leggiFattore()
    }
    if (formula[posizione] === '(') {
      posizione += 1
      const valore = leggiEspressione()
      if (formula[posizione] !== ')') throw new Error('Parentesi non chiusa')
      posizione += 1
      return valore
    }
    return leggiNumero()
  }

  const leggiTermine = (): number => {
    let valore = leggiFattore()
    while (formula[posizione] === '*' || formula[posizione] === '/') {
      const operatore = formula[posizione]
      posizione += 1
      const operando = leggiFattore()
      if (operatore === '/' && operando === 0) throw new Error('Divisione per zero')
      valore = operatore === '*' ? valore * operando : valore / operando
    }
    return valore
  }

  function leggiEspressione(): number {
    let valore = leggiTermine()
    while (formula[posizione] === '+' || formula[posizione] === '-') {
      const operatore = formula[posizione]
      posizione += 1
      const operando = leggiTermine()
      valore = operatore === '+' ? valore + operando : valore - operando
    }
    return valore
  }

  try {
    const valore = leggiEspressione()
    if (posizione !== formula.length || !Number.isFinite(valore)) {
      return { errore: 'Formula non valida' }
    }
    return { valore: Number(valore.toFixed(6)) }
  } catch (errore) {
    return {
      errore: errore instanceof Error ? errore.message : 'Formula non valida',
    }
  }
}

type Props = {
  integrativo?: ContrattoContext
  confermaInCorso?: boolean
  messaggioAi: string
  descrizionePreventivoAi: string
  setDescrizionePreventivoAi: (v: string) => void

  vociPreventivoAi: any[]
  setVociPreventivoAi: (v: any[]) => void
  vociPreventivoAiOriginali: any[]

  prezziRiferimento: readonly PriceKnowledgeItem[]
  memoriaRiferimento: readonly PriceKnowledgeItem[]
  calcolaMediaPrezziSimili: (descrizione: string, unitaMisura?: string) => number | null
  verificaPrezzoAnomalo: (descrizione: string, prezzo: number, unitaMisura?: string) => string

  formatMoney: (v: any) => string
  miglioraVocePreventivoAi: (index: number) => void | Promise<void>
  salvaInMemoriaPrezzi: (voce: any) => void | Promise<void>
  generaExcelDefinitivoPreventivoAi: () => void | Promise<void>
salvaRevisionePreventivoAi: () => void | Promise<void>

  preventivoRegistroCantiere: string
  setMostraRevisionePreventivoAi: (v: boolean) => void

  excelTable: CSSProperties
  excelTh: CSSProperties
  excelTd: CSSProperties
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

export default function RevisionePreventivoAiPanel({
  integrativo,
  confermaInCorso = false,
  messaggioAi,
  descrizionePreventivoAi,
  setDescrizionePreventivoAi,
  vociPreventivoAi,
  setVociPreventivoAi,
  vociPreventivoAiOriginali,
  prezziRiferimento,
  memoriaRiferimento,
  calcolaMediaPrezziSimili,
  verificaPrezzoAnomalo,
  formatMoney,
  miglioraVocePreventivoAi,
  salvaInMemoriaPrezzi,
  generaExcelDefinitivoPreventivoAi,
salvaRevisionePreventivoAi,
  preventivoRegistroCantiere,
  setMostraRevisionePreventivoAi,
  excelTable,
  excelTh,
  excelTd,
  buttonPrimary,
  buttonSecondary,
}: Props) {
  const [calcolatrice, setCalcolatrice] = useState<{
    indice: number
    formula: string
  } | null>(null)
  const formulaRef = useRef<HTMLInputElement>(null)
  const [webPerVoce, setWebPerVoce] = useState<Record<string, EsitoWeb | null>>({})
  const indiceCalcolatrice = calcolatrice?.indice


useEffect(() => {
  const onKeyDown = (event: KeyboardEvent) => {
    const isCtrl = event.ctrlKey || event.metaKey

    if (!isCtrl) return

    if (event.key.toLowerCase() === 'z' && !event.shiftKey) {
      event.preventDefault()
      annullaModifica()
      return
    }

    if (
      event.key.toLowerCase() === 'y' ||
      (event.key.toLowerCase() === 'z' && event.shiftKey)
    ) {
      event.preventDefault()
      ripristinaModifica()
    }
  }

  window.addEventListener('keydown', onKeyDown)

  return () => {
    window.removeEventListener('keydown', onKeyDown)
  }
}, [])

  useEffect(() => {
    if (indiceCalcolatrice === undefined) return
    formulaRef.current?.focus()
    formulaRef.current?.select()
  }, [indiceCalcolatrice])

  const undoStackRef = useRef<any[][]>([])
  const redoStackRef = useRef<any[][]>([])
  const vociCorrentiRef = useRef<any[]>(vociPreventivoAi)

  const clonaVoci = (voci: any[]) =>
    JSON.parse(JSON.stringify(voci)) as any[]

  useEffect(() => {
    vociCorrentiRef.current = vociPreventivoAi
  }, [vociPreventivoAi])

  const aggiornaVociConCronologia = (nuoveVoci: any[]) => {
    undoStackRef.current.push(clonaVoci(vociCorrentiRef.current))

    if (undoStackRef.current.length > 100) {
      undoStackRef.current.shift()
    }

    redoStackRef.current = []

    const copiaNuoveVoci = clonaVoci(nuoveVoci).map((v, i) => {
      if (!integrativo) return v
      const keys = ['descrizione','unita_misura','quantita','prezzo_unitario','operazione','riferimento_preventivo_lavorazione_id']
      return keys.some(k => v[k] !== vociCorrentiRef.current[i]?.[k]) ? { ...v, revisione_confermata: false, da_verificare: true } : v
    })
    vociCorrentiRef.current = copiaNuoveVoci
    setVociPreventivoAi(copiaNuoveVoci)
  }

  const annullaModifica = () => {
    const statoPrecedente = undoStackRef.current.pop()
    if (!statoPrecedente) return

    redoStackRef.current.push(clonaVoci(vociCorrentiRef.current))

    const copiaStatoPrecedente = clonaVoci(statoPrecedente)
    vociCorrentiRef.current = copiaStatoPrecedente
    setVociPreventivoAi(copiaStatoPrecedente)
  }

  const ripristinaModifica = () => {
    const statoSuccessivo = redoStackRef.current.pop()
    if (!statoSuccessivo) return

    undoStackRef.current.push(clonaVoci(vociCorrentiRef.current))

    const copiaStatoSuccessivo = clonaVoci(statoSuccessivo)
    vociCorrentiRef.current = copiaStatoSuccessivo
    setVociPreventivoAi(copiaStatoSuccessivo)
  }

   const subTotale = vociPreventivoAi.reduce(
    (tot, voce) =>
      tot +
      Number(voce.quantita || 0) *
        Number(voce.prezzo_unitario || 0),
    0
  )

  const priceResolutionStatistics = vociPreventivoAi.reduce((stats, voce) => {
    stats[esitoDiagnosticaVoce(voce)] += 1
    return stats
  }, { resolved: 0, review: 0, unresolved: 0, modified: 0 })

  const mostraPriceResolutionSummary = vociPreventivoAi.length > 0

  const esitoCalcolo = calcolatrice
    ? calcolaEspressione(calcolatrice.formula)
    : null

  const apriCalcolatrice = (indice: number) => {
    setCalcolatrice({
      indice,
      formula: String(vociPreventivoAi[indice]?.quantita ?? 0),
    })
  }

  const applicaCalcolo = () => {
    if (!calcolatrice || esitoCalcolo?.valore === undefined) return
    const nuove = vociPreventivoAi.map((voce, indice) =>
      indice === calcolatrice.indice
        ? { ...voce, quantita: esitoCalcolo.valore }
        : voce
    )
    aggiornaVociConCronologia(nuove)
    setCalcolatrice(null)
  }

 const spostaVoce = (indice: number, direzione: -1 | 1) => {
  const destinazione = indice + direzione

  if (
    destinazione < 0 ||
    destinazione >= vociPreventivoAi.length
  ) {
    return
  }

  const nuove = [...vociPreventivoAi]

  ;[nuove[indice], nuove[destinazione]] = [
    nuove[destinazione],
    nuove[indice],
  ]

  aggiornaVociConCronologia(nuove)
}

   return (
    <div
      style={{
        marginTop: 20,
        padding: 16,
        border: '1px solid #cbd5e1',
        borderRadius: 12,
        background: '#fff',
      }}
    >
      <h3
        style={{
          fontSize: 28,
          marginBottom: 20,
        }}
      >
        {integrativo ? 'Revisione Preventivo Integrativo — delta della Variante' : 'Revisione preventivo AI'}
      </h3>

      {mostraPriceResolutionSummary && (
        <div style={{ marginBottom: 16 }}>
          <PriceResolutionSummary
            statistics={priceResolutionStatistics}
          />
        </div>
      )}

           {messaggioAi && (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            border: '1px solid #bfdbfe',
            borderRadius: 10,
            background: '#eff6ff',
            color: '#1e3a8a',
            fontWeight: 700,
          }}
        >
          {messaggioAi}
        </div>
      )}

      <textarea
        value={descrizionePreventivoAi}
        onChange={(e) => setDescrizionePreventivoAi(e.target.value)}
        style={{
          width: '100%',
          minHeight: 140,
          padding: 14,
          marginBottom: 15,
          fontSize: 18,
        }}
      />

      <div
        style={{
          marginBottom: 16,
          padding: 14,
          border: '1px solid #cbd5e1',
          borderRadius: 10,
          background: '#f8fafc',
        }}
      >
        <strong style={{ fontSize: 20 }}>
          Memoria prezzi ARTECNA
        </strong>

        <div style={{ marginTop: 10, fontSize: 15, color: '#475569' }}>
          La memoria prezzi confronta le lavorazioni del preventivo con i prezzi
          reali già usati da ARTECNA a Catania.
        </div>

        {vociPreventivoAi.length === 0 ? (
          <div style={{ marginTop: 10 }}>
            Nessuna voce disponibile da confrontare.
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            {vociPreventivoAi.map((voce, index) => {
              const media = calcolaMediaPrezziSimili(
                voce.descrizione || '', voce.unita_misura
              )

              const avviso = verificaPrezzoAnomalo(
                voce.descrizione || '',
                Number(voce.prezzo_unitario || 0), voce.unita_misura
              )

              return (
                <div
                  key={chiaveAnalisiVoce(voce,index,vociPreventivoAi)}
                  style={{
                    marginBottom: 10,
                    padding: 10,
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    background: '#fff',
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    {voce.descrizione || 'Voce senza descrizione'}
                  </div>

                  <div style={{ marginTop: 6 }}>
                    Prezzo voce:{' '}
                    <strong>
                      {formatMoney(Number(voce.prezzo_unitario || 0))}
                    </strong>
                  </div>

                  <div>
                    Media ARTECNA/Catania:{' '}
                    <strong>
                      {media ? formatMoney(media) : 'Nessun dato sufficiente'}
                    </strong>
                  </div>

                  <div
                    style={{
                      marginTop: 6,
                      fontWeight: 700,
                      color: avviso.includes('âš ï¸')
                        ? '#b45309'
                        : '#166534',
                    }}
                  >
                    {avviso || 'Nessun confronto disponibile'}
                  </div>

                  {voce.priceResolution?.manodoperaSic24 && <p style={{ fontSize: 12 }}>
                    Fonte: SIC24 · Prezzo completo: {voce.priceResolution.manodoperaSic24.prezzoCompleto} €/{voce.priceResolution.manodoperaSic24.unitaMisura}<br />
                    Incidenza manodopera: {voce.priceResolution.manodoperaSic24.percentualeManodopera}% · Quota manodopera: {voce.priceResolution.manodoperaSic24.prezzoManodopera} €/{voce.priceResolution.manodoperaSic24.unitaMisura}<br />
                    Metodo: {voce.priceResolution.manodoperaSic24.metodo}. Nessuna maggiorazione.
                  </p>}
                  {(!integrativo || voce.operazione === 'nuova') && (!voce.priceResolution?.matched || voce.priceResolution?.strategy === 'similarity') && <AnalisiPrezzoVoce
                    descrizione={voce.descrizione || ''} um={voce.unita_misura || ''} quantita={Number(voce.quantita || 0)} prezzo={Number(voce.prezzo_unitario || 0)}
                    prezzi={prezziRiferimento} memoria={memoriaRiferimento} webVerificato={webPerVoce[JSON.stringify([voce.descrizione,voce.unita_misura])]}
                    onUsa={(input,result)=>aggiornaVociConCronologia(vociCorrentiRef.current.map((v,i)=>i===index?applicaAnalisiPrezzo(v,input,result):v))} />}
                  {(!integrativo || voce.operazione === 'nuova') && !voce.priceResolution?.matched && <PrezzoWebVoce descrizione={voce.descrizione || ''} um={voce.unita_misura || ''} prezzi={prezziRiferimento} memoria={memoriaRiferimento}
                    onVerificato={result=>setWebPerVoce(correnti=>({...correnti,[JSON.stringify([voce.descrizione,voce.unita_misura])]:result}))}
                    onInterno={r => aggiornaVociConCronologia(vociCorrentiRef.current.map((v,i)=>i===index?{...v,...r,priceResolutionInvalidated:false}:v))}
                    onUsa={r => aggiornaVociConCronologia(vociCorrentiRef.current.map((v,i)=>i===index?applicaPrezzoWeb(v,r):v))} />}
                  {voce.webPriceApplied && voce.fonte_prezzo !== 'Prezzo manuale' && !voce.priceResolutionInvalidated && <div><p>Origine: Web — Prezzo da verificare. Nessuna maggiorazione automatica.</p>
                    <label><input type="checkbox" checked={voce.webMemoryConfirmed === true} onChange={e=>{
                      if(e.target.checked && !window.confirm('Confermare questo prezzo Web come riferimento da salvare nella memoria ARTECNA?'))return
                      aggiornaVociConCronologia(vociCorrentiRef.current.map((v,i)=>i===index?{...v,webMemoryConfirmed:e.target.checked}:v))
                    }} /> Conferma esplicita per salvare il prezzo Web in memoria ARTECNA</label></div>}
                  {media && (
  <button
    onClick={() => {
      const nuove = vociPreventivoAi.map((voce, i) =>
        i === index
          ? {
              ...voce,
              prezzo_unitario: Number(media.toFixed(2)),
            }
          : voce
      )

      aggiornaVociConCronologia(nuove)
    }}
    style={{
      ...buttonSecondary,
      marginTop: 8,
      backgroundColor: '#0f766e',
      color: '#fff',
    }}
  >
    Usa media memoria prezzi
  </button>
)}

                </div>
              )
            })}
          </div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 14,
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={annullaModifica}
          title="Annulla ultima modifica — Ctrl+Z"
          style={{
            ...buttonSecondary,
            minWidth: 120,
          }}
        >
          Annulla
        </button>

        <button
          type="button"
          onClick={ripristinaModifica}
          title="Ripristina modifica — Ctrl+Y"
          style={{
            ...buttonSecondary,
            minWidth: 120,
          }}
        >
          Ripristina
        </button>

        <span
          style={{
            fontSize: 14,
            color: '#64748b',
          }}
        >
          Scorciatoie: Ctrl+Z / Ctrl+Y
        </span>
      </div>


      <table
        style={{
          ...excelTable,
          width: '100%',
          fontSize: 18,
        }}
      >
        <thead>
          <tr>
            <th style={excelTh}>Descrizione</th>
            <th style={excelTh}>UM</th>
            <th style={excelTh}>Q.tà</th>
            <th style={excelTh}>Prezzo</th>
            <th style={excelTh}>Totale</th>
            <th style={excelTh}>Azioni</th>
          </tr>
        </thead>

        <tbody>
          {vociPreventivoAi.map((voce, index) => {
            const totale =
  Number(voce.quantita || 0) *
  Number(voce.prezzo_unitario || 0)

console.log('CALCOLO VOCE PREVENTIVO', {
  index,
  descrizione: voce.descrizione,
  quantitaOriginale: voce.quantita,
  quantitaNumero: Number(voce.quantita || 0),
  prezzoOriginale: voce.prezzo_unitario,
  prezzoNumero: Number(voce.prezzo_unitario || 0),
  totale,
})
console.log("PRICE RESOLUTION", voce.priceResolution)

const confidencePercent =
  Number(voce.priceResolution?.confidence || 0) * 100

const confidenceBadge =
  getConfidenceBadge(confidencePercent)

return (
  <tr key={index}>

               <td style={excelTd}>
  {integrativo && <fieldset aria-label={`Operazione voce ${index + 1}`}>
    <label>Tipo operazione<select value={voce.operazione || 'nuova'} onChange={e => {
      const operazione = e.target.value as OperazioneIntegrativa
      aggiornaVociConCronologia(vociPreventivoAi.map((v, i) => i === index ? { ...v, operazione,
        riferimento_preventivo_lavorazione_id: operazione === 'nuova' ? null : v.riferimento_preventivo_lavorazione_id,
        quantita: ['riduzione','eliminazione'].includes(operazione) ? -Math.abs(v.quantita) : Math.abs(v.quantita) } : v))
    }}><option value="nuova">Nuova</option><option value="aumento">Aumento</option><option value="riduzione">Riduzione</option><option value="eliminazione">Eliminazione del residuo</option></select></label>
    <label>Voce contrattuale<select disabled={voce.operazione === 'nuova'} value={voce.riferimento_preventivo_lavorazione_id ?? ''} onChange={e => {
      const ref = integrativo.voci.find(r => r.id === e.target.value)
      aggiornaVociConCronologia(vociPreventivoAi.map((v, i) => i === index ? { ...v, riferimento_preventivo_lavorazione_id: ref?.id ?? null,
        ...(ref ? { prezzo_unitario: ref.prezzo_unitario, unita_misura: ref.unita_misura, fonte_prezzo: 'Prezzo contratto',
          ...(v.operazione === 'eliminazione' ? { quantita: -(ref.quantita_riducibile ?? 0) } : {}) } : {}) } : v))
    }}><option value="">Da verificare — nessun riferimento certo</option>{integrativo.voci.map(r => <option key={r.id} value={r.id}>{r.id} — {r.descrizione}</option>)}</select></label>
    <p>Delta economico: {formatMoney(totale)} · Origine prezzo: {voce.fonte_prezzo || 'Da verificare'} · Confidenza: {confidencePercent.toFixed(0)}%</p>
    {voce.da_verificare && <p role="status">Da verificare</p>}
    <label><input type="checkbox" checked={voce.revisione_confermata === true} onChange={e => aggiornaVociConCronologia(vociPreventivoAi.map((v, i) => i === index ? { ...v, revisione_confermata: e.target.checked, da_verificare: !e.target.checked } : v))} /> Ho verificato operazione, riferimento, quantità e prezzo</label>
  </fieldset>}
  <textarea
    value={voce.descrizione || ''}
    onChange={(e) => {
     const nuove = vociPreventivoAi.map((voce, i) =>
  i === index
    ? modificaVoceDiagnostica(voce, 'descrizione', e.target.value)
    : voce
)

aggiornaVociConCronologia(nuove)
    }}
    style={{
      width: '100%',
      minHeight: 90,
      fontSize: 17,
      padding: 10,
    }}
  />

  {!voce.priceResolution && <p role="status" style={{ color: '#92400e', fontWeight: 600 }}>
    {voce.fonte_prezzo === 'Prezzo manuale' ? 'Prezzo manuale — da rivalutare' : voce.priceResolutionInvalidated ? 'Prezzo da rivalutare — voce modificata dopo la risoluzione' : 'Diagnostica non disponibile — prezzo da verificare'}
  </p>}
  {voce.priceResolution && (
    <div
      style={{
        marginTop: 8,
        padding: 10,
        borderRadius: 8,
        background:
          voce.priceResolution.matched
            ? '#f0fdf4'
            : '#fef2f2',
        border:
          voce.priceResolution.matched
            ? '1px solid #86efac'
            : '1px solid #fca5a5',
        fontSize: 14,
        lineHeight: 1.5,
      }}
    >

      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 8,
          padding: '5px 9px',
          borderRadius: 999,
          background: `${confidenceBadge.color}18`,
          color: confidenceBadge.color,
          fontWeight: 800,
        }}
      >
        <span>{confidenceBadge.icon}</span>
        <span>{confidenceBadge.label}</span>
        <span>
          {formatConfidence(confidencePercent)}
        </span>
      </div>
      <div>
        <strong>Strategia dell’esito salvato:</strong>{' '}
        {voce.priceResolution.strategy}
      </div>

      <div>
        <strong>Affidabilità:</strong>{' '}
        {Math.round(
          Number(voce.priceResolution.confidence || 0) * 100,
        )}
        %
      </div>

      {voce.priceResolution.codiceRisolto && (
        <div>
          <strong>Codice trovato:</strong>{' '}
          {voce.priceResolution.codiceRisolto}
        </div>
      )}

      {voce.priceResolution.prezzoUnitarioRisolto !== undefined && (
        <div>
          <strong>Prezzo risolto:</strong>{' '}
          {formatMoney(
            voce.priceResolution.prezzoUnitarioRisolto,
          )}
        </div>
      )}

      {Array.isArray(voce.priceResolution.reasons) &&
        voce.priceResolution.reasons.length > 0 && (
          <div>
            <strong>Motivo:</strong>{' '}
            {voce.priceResolution.reasons.join(' ')}
          </div>
        )}

      {!voce.priceResolution.matched && (
        <div
          style={{
            marginTop: 6,
            fontWeight: 700,
            color: '#b91c1c',
          }}
        >
          Nessuna corrispondenza trovata
        </div>
      )}
    </div>
  )}
</td>

                <td style={excelTd}>
                  <input
                    value={voce.unita_misura || ''}
                    disabled={!!integrativo && voce.operazione !== 'nuova'}
                    onChange={(e) => {
                     const nuove = vociPreventivoAi.map((voce, i) =>
  i === index
    ? modificaVoceDiagnostica(voce, 'unita_misura', e.target.value)
    : voce
)

aggiornaVociConCronologia(nuove)
                    }}
                    style={{ width: 80 }}
                  />
                </td>

                <td
                  style={{ ...excelTd, cursor: 'pointer' }}
                  onClick={() => apriCalcolatrice(index)}
                  title="Tocca per aprire la calcolatrice"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="number"
                      value={voce.quantita || 0}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(e) => {
                        const nuove = [...vociPreventivoAi]
                        nuove[index] = {
                          ...nuove[index],
                          quantita: Number(e.target.value),
                        }
                        aggiornaVociConCronologia(nuove)
                      }}
                      aria-label={`Quantità voce ${index + 1}`}
                      style={{ width: 80, minHeight: 44 }}
                    />
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        apriCalcolatrice(index)
                      }}
                      aria-label={`Calcola quantità voce ${index + 1}`}
                      style={{
                        width: 44,
                        height: 44,
                        border: '1px solid #94a3b8',
                        borderRadius: 8,
                        background: '#f8fafc',
                        fontSize: 20,
                        cursor: 'pointer',
                      }}
                    >
                      ÷
                    </button>
                  </div>
                </td>

                <td style={excelTd}>
                  <input
                    type="number"
                    value={voce.prezzo_unitario || 0}
                      disabled={!!integrativo && voce.operazione !== 'nuova'}
                    onChange={(e) => {
                     const nuove = vociPreventivoAi.map((voce, i) =>
  i === index
    ? modificaVoceDiagnostica(voce, 'prezzo_unitario', Number(e.target.value))
    : voce
)

aggiornaVociConCronologia(nuove)
                    }}
                    style={{ width: 100 }}
                  />
                </td>

                <td style={excelTd}>{formatMoney(totale)}</td>

                <td style={excelTd}>
                  <div
                    style={{
                      display: 'flex',
                      gap: 6,
                      alignItems: 'center',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => spostaVoce(index, -1)}
                      disabled={index === 0}
                      aria-label={`Sposta in alto la voce ${index + 1}`}
                      style={{
                        width: 44,
                        height: 44,
                        border: '1px solid #94a3b8',
                        borderRadius: 6,
                        background: '#fff',
                        fontSize: 20,
                        cursor: index === 0 ? 'default' : 'pointer',
                        opacity: index === 0 ? 0.4 : 1,
                      }}
                    >
                      ↑
                    </button>

                    <button
                      type="button"
                      onClick={() => spostaVoce(index, 1)}
                      disabled={index === vociPreventivoAi.length - 1}
                      aria-label={`Sposta in basso la voce ${index + 1}`}
                      style={{
                        width: 44,
                        height: 44,
                        border: '1px solid #94a3b8',
                        borderRadius: 6,
                        background: '#fff',
                        fontSize: 20,
                        cursor:
                          index === vociPreventivoAi.length - 1
                            ? 'default'
                            : 'pointer',
                        opacity: index === vociPreventivoAi.length - 1 ? 0.4 : 1,
                      }}
                    >
                      ↓
                    </button>

                    <button
                      type="button"
                      onClick={() => miglioraVocePreventivoAi(index)}
                      style={{
                        background: '#f59e0b',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 10px',
                        cursor: 'pointer',
                      }}
                    >
                      Migliora testo
                    </button>

                    <button
                      type="button"
                     onClick={() =>
  aggiornaVociConCronologia(
    vociPreventivoAi.filter((_, i) => i !== index)
  )
}
                      style={{
                        background: '#dc2626',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 10px',
                        cursor: 'pointer',
                      }}
                    >
                      Elimina
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div
        style={{
          marginTop: 12,
          padding: 12,
          border: '1px solid #cbd5e1',
          borderRadius: 8,
          background: '#f8fafc',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        <span>Sub totale preventivo</span>
        <span>{formatMoney(subTotale)}</span>
      </div>

      <div style={{ marginTop: 15, display: 'flex', gap: 10 }}>
        <button
          onClick={() =>
           aggiornaVociConCronologia([
  ...vociPreventivoAi,
  {
    descrizione: '',
    unita_misura: 'a corpo',
    quantita: 1,
    prezzo_unitario: 0,
    ...(integrativo ? { operazione: 'nuova', riferimento_preventivo_lavorazione_id: null, da_verificare: true, revisione_confermata: false } : {}),
  },
])
          }
          style={buttonSecondary}
        >
          + Aggiungi voce
        </button>

        <button
          onClick={() => {
           aggiornaVociConCronologia(
  JSON.parse(JSON.stringify(vociPreventivoAiOriginali))
)

            alert('Versione originale ripristinata')
          }}
          style={{
            ...buttonSecondary,
            backgroundColor: '#64748b',
            color: '#fff',
          }}
        >
          Ripristina originale
        </button>

       <button
  disabled={confermaInCorso}
  onClick={async () => {
    await salvaRevisionePreventivoAi()
  }}
  style={{
    ...buttonPrimary,
    backgroundColor: '#16a34a',
  }}
>
  {integrativo ? 'Conferma Preventivo Integrativo e lavorazioni nella bozza' : 'Salva revisione'}
</button>

{!integrativo && <button
  onClick={async () => {
    for (const voce of vociPreventivoAi) {
      if (!puoSalvarePrezzoInMemoria(voce)) continue
      await salvaInMemoriaPrezzi({
        descrizione: voce.descrizione || '',
        categoria: 'preventivo AI',
        unita_misura: voce.unita_misura || '',
        quantita: Number(voce.quantita || 0),
        prezzo_unitario: Number(voce.prezzo_unitario || 0),
        prezzo_totale:
          Number(voce.quantita || 0) *
          Number(voce.prezzo_unitario || 0),
        cantiere: preventivoRegistroCantiere || '',
        fonte: voce.webPriceApplied ? 'Web confermato dall’utente' : 'preventivo AI approvato',
        note: voce.webPriceApplied ? JSON.stringify({ area: voce.webPrice.area, data_ricerca: voce.webPrice.data_ricerca, fonti: voce.webPrice.fonti.map((f: {url:string})=>f.url) }) : undefined,
        provincia: 'Catania',
      })
    }

    await generaExcelDefinitivoPreventivoAi()
  }}
  style={{
    ...buttonPrimary,
    backgroundColor: '#2563eb',
  }}
>
  Genera Excel definitivo
</button>}
        <button
          onClick={() => setMostraRevisionePreventivoAi(false)}
          style={buttonSecondary}
        >
          Chiudi revisione
        </button>
      </div>

      {calcolatrice && (
        <div
          role="presentation"
          onClick={() => setCalcolatrice(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 12000,
            display: 'grid',
            placeItems: 'center',
            padding: 20,
            background: 'rgba(15,23,42,0.45)',
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="titolo-calcolatrice-quantita"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(100%, 420px)',
              padding: 20,
              borderRadius: 16,
              background: '#fff',
              boxShadow: '0 20px 60px rgba(15,23,42,0.3)',
            }}
          >
            <h4 id="titolo-calcolatrice-quantita" style={{ margin: 0, fontSize: 22 }}>
              Calcola quantità
            </h4>
            <div style={{ marginTop: 8, color: '#64748b' }}>
              Valore attuale:{' '}
              <strong>{vociPreventivoAi[calcolatrice.indice]?.quantita ?? 0}</strong>
            </div>

            <label style={{ display: 'block', marginTop: 16, fontWeight: 700 }}>
              Formula
              <input
                ref={formulaRef}
                value={calcolatrice.formula}
                inputMode="text"
                autoComplete="off"
                spellCheck={false}
                placeholder="Esempio: 2.4*3"
                onChange={(event) =>
                  setCalcolatrice((corrente) =>
                    corrente ? { ...corrente, formula: event.target.value } : null
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && esitoCalcolo?.valore !== undefined) {
                    event.preventDefault()
                    applicaCalcolo()
                  }
                  if (event.key === 'Escape') setCalcolatrice(null)
                }}
                style={{
                  width: '100%',
                  minHeight: 54,
                  marginTop: 7,
                  padding: '12px 14px',
                  border: '2px solid #94a3b8',
                  borderRadius: 10,
                  fontSize: 21,
                }}
              />
            </label>

            <div
              aria-live="polite"
              style={{
                minHeight: 58,
                marginTop: 14,
                padding: 12,
                borderRadius: 10,
                background: esitoCalcolo?.errore ? '#fef2f2' : '#f0fdf4',
                color: esitoCalcolo?.errore ? '#991b1b' : '#166534',
              }}
            >
              {esitoCalcolo?.errore ? (
                esitoCalcolo.errore
              ) : (
                <>
                  Risultato:{' '}
                  <strong style={{ fontSize: 22 }}>{esitoCalcolo?.valore}</strong>
                </>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
                marginTop: 18,
              }}
            >
              <button
                type="button"
                onClick={() => setCalcolatrice(null)}
                style={{ ...buttonSecondary, minHeight: 50, padding: '11px 18px' }}
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={applicaCalcolo}
                disabled={esitoCalcolo?.valore === undefined}
                style={{
                  ...buttonPrimary,
                  minHeight: 50,
                  padding: '11px 20px',
                  opacity: esitoCalcolo?.valore === undefined ? 0.5 : 1,
                }}
              >
                Applica
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

