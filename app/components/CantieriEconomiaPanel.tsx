'use client'

import { useState, type CSSProperties } from 'react'
import EconomiaGraficiPanel from './EconomiaGraficiPanel'
import EconomiaSelezioneCantierePanel from './EconomiaSelezioneCantierePanel'
import DashboardEconomiaPanel from './DashboardEconomiaPanel'
import PreventiviEconomiaPanel from './PreventiviEconomiaPanel'
import SalDettagliatoPanel from './SalDettagliatoPanel'
import FiltroPeriodoEconomia from './FiltroPeriodoEconomia'
import AccontiEconomiaPanel from './AccontiEconomiaPanel'
import RiepilogoCostiEconomiaPanel from './RiepilogoCostiEconomiaPanel'
import UploadPreventivoBox from './UploadPreventivoBox'
import CantieriAnalisiDocumentoPanel from './CantieriAnalisiDocumentoPanel'
import FotoCantiereFascicoloPanel from './FotoCantiereFascicoloPanel'

type Props = any

type SchedaFascicolo =
  | 'dashboard'
  | 'lavorazioni'
  | 'costi'
  | 'documenti'
  | 'foto'
  | 'ai'
  | 'azioni'

const schede: Array<{ id: SchedaFascicolo; etichetta: string }> = [
  { id: 'dashboard', etichetta: '📊 Dashboard' },
  { id: 'lavorazioni', etichetta: '📋 Lavorazioni / SAL' },
  { id: 'costi', etichetta: '💰 Costi' },
  { id: 'documenti', etichetta: '📄 Documenti' },
  { id: 'foto', etichetta: '📷 Foto' },
  { id: 'ai', etichetta: '🤖 AI' },
  { id: 'azioni', etichetta: '⚙ Azioni' },
]

export default function CantieriEconomiaPanel(props: Props) {
  const p = props
  const [schedaAttiva, setSchedaAttiva] =
    useState<SchedaFascicolo>('dashboard')

  const margine = Number(p.margineCantiere || 0)
  const stato =
    p.utileCantiere < 0
      ? {
          titolo: 'Cantiere in perdita',
          dettaglio: 'I costi hanno superato il valore del preventivo.',
          colore: '#b91c1c',
          sfondo: '#fef2f2',
          bordo: '#fecaca',
        }
      : margine < 10
        ? {
            titolo: 'Margine basso',
            dettaglio: 'Il cantiere è in utile, ma il margine richiede attenzione.',
            colore: '#92400e',
            sfondo: '#fffbeb',
            bordo: '#fde68a',
          }
        : {
            titolo: 'Cantiere in utile',
            dettaglio: 'Costi e margine sono sotto controllo.',
            colore: '#166534',
            sfondo: '#f0fdf4',
            bordo: '#bbf7d0',
          }

  const stileScheda = (attiva: boolean): CSSProperties => ({
    minHeight: 44,
    padding: '10px 14px',
    border: 0,
    borderBottom: attiva ? '3px solid #2563eb' : '3px solid transparent',
    background: 'transparent',
    color: attiva ? '#1d4ed8' : '#475569',
    fontWeight: attiva ? 800 : 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  })

  const stileKpi = (enfasi = false): CSSProperties => ({
    padding: 14,
    border: enfasi ? `2px solid ${stato.bordo}` : '1px solid #e2e8f0',
    borderRadius: 12,
    background: enfasi ? stato.sfondo : '#fff',
    minWidth: 0,
  })

  return (
    <div style={{ ...p.cardStyle, padding: 0, overflow: 'hidden' }}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          borderBottom: '1px solid #e2e8f0',
          background: 'rgba(255,255,255,0.97)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div style={{ padding: '18px 20px 10px' }}>
          <div style={{ color: '#64748b', fontSize: 12, fontWeight: 800 }}>
            FASCICOLO CANTIERE
          </div>
          <h2 style={{ margin: '3px 0 14px' }}>
            {p.cantiereScheda || 'Seleziona un cantiere'}
          </h2>
          <EconomiaSelezioneCantierePanel
            cantieri={p.cantieri}
            cantiereScheda={p.cantiereScheda}
            setCantiereScheda={p.setCantiereScheda}
            ricercaCantiereEconomia={p.ricercaCantiereEconomia}
            setRicercaCantiereEconomia={p.setRicercaCantiereEconomia}
            mostraConclusiEconomia={p.mostraConclusiEconomia}
            setMostraConclusiEconomia={p.setMostraConclusiEconomia}
            inputStyle={p.inputStyle}
            buttonSecondary={p.buttonSecondary}
          />
        </div>

        {p.cantiereScheda && (
          <nav
            aria-label="Sezioni del fascicolo cantiere"
            style={{ display: 'flex', overflowX: 'auto', padding: '0 10px' }}
          >
            {schede.map((scheda) => (
              <button
                key={scheda.id}
                type="button"
                onClick={() => setSchedaAttiva(scheda.id)}
                aria-current={schedaAttiva === scheda.id ? 'page' : undefined}
                style={stileScheda(schedaAttiva === scheda.id)}
              >
                {scheda.etichetta}
              </button>
            ))}
          </nav>
        )}
      </header>

      <div style={{ padding: 20 }}>
        {!p.cantiereScheda ? (
          <div
            style={{
              padding: 24,
              border: '1px dashed #cbd5e1',
              borderRadius: 12,
              color: '#64748b',
              textAlign: 'center',
            }}
          >
            Seleziona un cantiere per aprire il fascicolo.
          </div>
        ) : (
          <>
            {schedaAttiva === 'dashboard' && (
              <section aria-label="Dashboard del cantiere">
                <div
                  style={{
                    padding: 16,
                    border: `2px solid ${stato.bordo}`,
                    borderRadius: 14,
                    background: stato.sfondo,
                    color: stato.colore,
                    marginBottom: 16,
                  }}
                >
                  <strong style={{ fontSize: 21 }}>{stato.titolo}</strong>
                  <div style={{ marginTop: 4, fontWeight: 600 }}>{stato.dettaglio}</div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: 10,
                  }}
                >
                  {[
                    ['Preventivo', p.preventivoCantiere],
                    ['Costi totali', p.totaleCostiCantiere],
                    ['Manodopera', p.totaleManodoperaCantiere],
                    ['Materiali', p.totaleMaterialiEconomia],
                    ['Attrezzature', p.totaleAttrezziEconomia],
                    ['Acconti', p.totaleAccontiCantiere],
                    ['Residuo da incassare', p.residuoDaIncassare],
                    ['Utile', p.utileCantiere],
                  ].map(([etichetta, valore]) => (
                    <article key={String(etichetta)} style={stileKpi(etichetta === 'Utile')}>
                      <div style={{ color: '#64748b', fontSize: 12, fontWeight: 700 }}>
                        {etichetta}
                      </div>
                      <strong
                        style={{
                          display: 'block',
                          marginTop: 5,
                          fontSize: 20,
                          color: etichetta === 'Utile' ? stato.colore : '#0f172a',
                        }}
                      >
                        {p.formatMoney(Number(valore || 0))}
                      </strong>
                    </article>
                  ))}
                  <article style={stileKpi(true)}>
                    <div style={{ color: '#64748b', fontSize: 12, fontWeight: 700 }}>
                      Margine
                    </div>
                    <strong style={{ display: 'block', marginTop: 5, fontSize: 20, color: stato.colore }}>
                      {margine.toFixed(1)}%
                    </strong>
                  </article>
                </div>

                <details style={{ marginTop: 20 }}>
                  <summary style={{ cursor: 'pointer', color: '#475569', fontWeight: 800 }}>
                    Vedi grafici economici
                  </summary>
                  <div style={{ marginTop: 14 }}>
                    <EconomiaGraficiPanel
                      {...p}
                      setMostraDettaglioManodopera={(visibile: boolean) => {
                        p.setMostraDettaglioManodopera(visibile)
                        if (visibile) setSchedaAttiva('costi')
                      }}
                      setMostraDettaglioMateriali={(visibile: boolean) => {
                        p.setMostraDettaglioMateriali(visibile)
                        if (visibile) setSchedaAttiva('costi')
                      }}
                      setMostraDettaglioAttrezzi={(visibile: boolean) => {
                        p.setMostraDettaglioAttrezzi(visibile)
                        if (visibile) setSchedaAttiva('costi')
                      }}
                    />
                  </div>
                </details>
              </section>
            )}

            {schedaAttiva === 'lavorazioni' && (
              <section aria-label="Lavorazioni e SAL">
                <SalDettagliatoPanel {...p} />
                <div style={{ marginTop: 18 }}>
                  <AccontiEconomiaPanel {...p} />
                </div>
              </section>
            )}

            {schedaAttiva === 'costi' && (
              <section aria-label="Costi del cantiere">
                <FiltroPeriodoEconomia {...p} />
                <RiepilogoCostiEconomiaPanel {...p} />
              </section>
            )}

            {schedaAttiva === 'documenti' && (
              <section aria-label="Documenti del cantiere">
                <div
                  onDragOver={(evento) => {
                    evento.preventDefault()
                    p.setDragAttivo(true)
                  }}
                  onDragLeave={() => p.setDragAttivo(false)}
                  onDrop={async (evento) => {
                    evento.preventDefault()
                    p.setDragAttivo(false)
                    const file = evento.dataTransfer.files?.[0]
                    if (file) await p.caricaFilePreventivo(file)
                  }}
                  style={{
                    padding: 20,
                    border: p.dragAttivo ? '2px solid #2563eb' : '2px dashed #cbd5e1',
                    borderRadius: 12,
                    background: p.dragAttivo ? '#eff6ff' : '#f8fafc',
                    marginBottom: 18,
                    textAlign: 'center',
                  }}
                >
                  <UploadPreventivoBox
                    cantiereScheda={p.cantiereScheda}
                    handleUploadPreventivo={p.handleUploadPreventivo}
                  />
                </div>
                <PreventiviEconomiaPanel {...p} />
                <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid #e2e8f0' }}>
                  <CantieriAnalisiDocumentoPanel
                    {...p}
                    integrato
                    cantiereAnalisiDocumento={p.cantiereScheda}
                    setCantiereAnalisiDocumento={p.setCantiereScheda}
                  />
                </div>
              </section>
            )}

            {schedaAttiva === 'foto' && (
              <section aria-label="Foto del cantiere">
                <FotoCantiereFascicoloPanel {...p} />
              </section>
            )}

            {schedaAttiva === 'ai' && (
              <section aria-label="AI del cantiere">
                <h3 style={{ marginTop: 0 }}>AI e revisione preventivo</h3>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                    gap: 12,
                  }}
                >
                  <article style={{ padding: 16, border: '1px solid #ddd6fe', borderRadius: 12, background: '#faf5ff' }}>
                    <strong>Analisi documento</strong>
                    <p style={{ color: '#475569' }}>
                      Estrai testo, importi e voci dai documenti del cantiere.
                    </p>
                    <button type="button" onClick={() => setSchedaAttiva('documenti')} style={p.buttonPrimary}>
                      Apri analisi documento
                    </button>
                  </article>
                  <article style={{ padding: 16, border: '1px solid #dbeafe', borderRadius: 12, background: '#eff6ff' }}>
                    <strong>Revisione preventivo AI</strong>
                    <p style={{ color: '#475569' }}>
                      La revisione completa resta nel Registro preventivi, con lo stesso flusso già in uso.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        p.setRegistroTab('preventivi')
                        p.setSezioneAttiva('registro')
                      }}
                      style={p.buttonPrimary}
                    >
                      Apri Revisione AI
                    </button>
                  </article>
                </div>
              </section>
            )}

            {schedaAttiva === 'azioni' && (
              <section aria-label="Azioni del cantiere">
                <h3 style={{ marginTop: 0 }}>Azioni operative</h3>
                <p style={{ color: '#64748b' }}>
                  Aggiorna il fascicolo o modifica date e stato del cantiere.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
                  <button
                    type="button"
                    onClick={async () => {
                      await p.caricaEconomia()
                      await p.caricaCantieri()
                    }}
                    style={p.buttonPrimary}
                  >
                    Aggiorna dati
                  </button>
                  <button type="button" onClick={() => setSchedaAttiva('documenti')} style={p.buttonSecondary}>
                    Importa preventivo
                  </button>
                  <button type="button" onClick={p.esportaPdfFotoCantiere} style={p.buttonSecondary}>
                    Esporta PDF foto
                  </button>
                </div>
                <DashboardEconomiaPanel {...p} />
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
