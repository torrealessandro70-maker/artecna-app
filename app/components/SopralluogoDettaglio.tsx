'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import SopralluogoDettaglioHeader from './SopralluogoDettaglioHeader'
import SopralluogoFirmaCliente from './SopralluogoFirmaCliente'
import SopralluogoAppunti from './SopralluogoAppunti'
import SopralluogoFotoGallery from './SopralluogoFotoGallery'
import SopralluogoAzioniPreventivo from './SopralluogoAzioniPreventivo'
import DocumentIntelligencePanel from './DocumentIntelligencePanel'


type Props = {
  [key: string]: any
}

type SezioneFascicolo =
  | 'informazioni'
  | 'quaderno'
  | 'documenti'
  | 'galleria'
  | 'ai'
  | 'azioni'

const sezioni: Array<{ id: SezioneFascicolo; etichetta: string }> = [
  { id: 'informazioni', etichetta: 'Informazioni' },
  { id: 'quaderno', etichetta: 'Quaderno' },
  { id: 'documenti', etichetta: 'Documenti' },
  { id: 'galleria', etichetta: 'Galleria' },
  { id: 'ai', etichetta: 'AI' },
  { id: 'azioni', etichetta: 'Azioni' },
]
export default function SopralluogoDettaglio(props: Props) {
  const { sopralluogoAperto, buttonPrimary, buttonSecondary, supabase } = props
  const [sezioneAttiva, setSezioneAttiva] = useState<SezioneFascicolo>('informazioni')
useEffect(() => {
  if (!sopralluogoAperto?.id) return

  const salvata = localStorage.getItem(
    `artecna:sopralluogo:${sopralluogoAperto.id}:sezione`
  )

 if (
  salvata === 'informazioni' ||
  salvata === 'quaderno' ||
  salvata === 'documenti' ||
  salvata === 'galleria' ||
  salvata === 'ai' ||
  salvata === 'azioni'
)
{
    setSezioneAttiva(salvata)
  } else {
    setSezioneAttiva('informazioni')
  }
}, [sopralluogoAperto?.id])
  if (!sopralluogoAperto) return null

  const fotoDelSopralluogo = props.fotoSopralluoghi.filter(
    (foto: any) => foto.sopralluogo_id === sopralluogoAperto.id
  )
  const fotoCollegate = fotoDelSopralluogo.filter((foto: any) =>
    (foto.tag || '').split(',').map((tag: string) => tag.trim()).includes('smart-note')
  )

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Fascicolo sopralluogo ${sopralluogoAperto.cliente || ''}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        background: 'rgba(15,23,42,0.55)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 1040,
          maxHeight: '92vh',
          overflow: 'auto',
          borderRadius: 16,
          background: '#fff',
          boxShadow: '0 24px 70px rgba(15, 23, 42, 0.28)',
        }}
      >
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 20,
            borderBottom: '1px solid #e2e8f0',
            background: 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '16px 20px 8px',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#64748b', fontSize: 12, fontWeight: 700 }}>
                FASCICOLO SOPRALLUOGO
              </div>
              <h2 style={{ margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {sopralluogoAperto.cliente || 'Sopralluogo'}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
               props.setSopralluogoAperto(null)
              }}
              aria-label="Chiudi fascicolo"
              style={{
                ...buttonSecondary,
                width: 44,
                height: 44,
                padding: 0,
                flex: '0 0 44px',
                borderRadius: '50%',
                fontSize: 22,
              }}
            >
              ×
            </button>
          </div>

          <nav
            aria-label="Sezioni del fascicolo"
            style={{ display: 'flex', overflowX: 'auto', padding: '0 12px' }}
          >
            {sezioni.map((sezione) => (
              <button
                key={sezione.id}
                type="button"
                onClick={() => {
  setSezioneAttiva(sezione.id)

  if (sopralluogoAperto?.id) {
    localStorage.setItem(
      `artecna:sopralluogo:${sopralluogoAperto.id}:sezione`,
      sezione.id
    )
  }
}}
                aria-current={sezioneAttiva === sezione.id ? 'page' : undefined}
                style={stileScheda(sezioneAttiva === sezione.id)}
              >
                {sezione.etichetta}
              </button>
            ))}
          </nav>
        </header>

        <main style={{ padding: 20 }}>
          <section
            aria-label="Informazioni sopralluogo"
            style={{ display: sezioneAttiva === 'informazioni' ? 'block' : 'none' }}
          >
              <SopralluogoDettaglioHeader
                sopralluogoAperto={sopralluogoAperto}
                setSopralluogoAperto={props.setSopralluogoAperto}
                setSopralluogoModificaId={props.setSopralluogoModificaId}
                setClienteSopralluogo={props.setClienteSopralluogo}
                setTelefonoSopralluogo={props.setTelefonoSopralluogo}
                setIndirizzoSopralluogo={props.setIndirizzoSopralluogo}
                setDataSopralluogo={props.setDataSopralluogo}
                setOraSopralluogo={props.setOraSopralluogo}
                setTipoLavoroSopralluogo={props.setTipoLavoroSopralluogo}
                setNoteSopralluogo={props.setNoteSopralluogo}
                setPromemoriaSopralluogo={props.setPromemoriaSopralluogo}
                setGeolocalizzazioneSopralluogo={props.setGeolocalizzazioneSopralluogo}
                coloreStatoSopralluogo={props.coloreStatoSopralluogo}
                buttonPrimary={buttonPrimary}
                buttonSecondary={buttonSecondary}
                integrato
              />
              <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid #e2e8f0' }}>
                <SopralluogoFirmaCliente
                  sopralluogoAperto={sopralluogoAperto}
                  firmaRef={props.firmaRef}
                  mostraFirmaCliente={props.mostraFirmaCliente}
                  setMostraFirmaCliente={props.setMostraFirmaCliente}
                  altezzaFirma={props.altezzaFirma}
                  setAltezzaFirma={props.setAltezzaFirma}
                  coloreFirma={props.coloreFirma}
                  spessoreFirma={props.spessoreFirma}
                  setFirmaCliente={props.setFirmaCliente}
                  supabase={supabase}
                  buttonPrimary={buttonPrimary}
                  buttonSecondary={buttonSecondary}
                />
              </div>
          </section>

          <section
            aria-label="Quaderno del sopralluogo"
            style={{ display: sezioneAttiva === 'quaderno' ? 'block' : 'none' }}
          >
              <SopralluogoAppunti
                mostraAppuntiSopralluogo={props.mostraAppuntiSopralluogo}
                setMostraAppuntiSopralluogo={props.setMostraAppuntiSopralluogo}
                sopralluogoAperto={sopralluogoAperto}
                supabase={supabase}
                buttonPrimary={buttonPrimary}
                buttonSecondary={buttonSecondary}
                integrato
                fotoGalleria={props.fotoSopralluoghi}
                onApriGalleria={() => setSezioneAttiva('galleria')}
              />
          </section>
<section
  aria-label="Documenti del sopralluogo"
  style={{ display: sezioneAttiva === 'documenti' ? 'block' : 'none' }}
>
  {props.documentIntelligence ? (
    <>
      <DocumentIntelligencePanel
        titolo="Documenti del sopralluogo"
        {...props.documentIntelligence}
      />

      {props.documentIntelligence?.vociAnalizzate?.length > 0 && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            border: '1px solid #bbf7d0',
            borderRadius: 12,
            background: '#f0fdf4',
          }}
        >
          <strong>Documento pronto per il preventivo</strong>

          <p style={{ marginTop: 6, color: '#166534' }}>
            Sono state rilevate {props.documentIntelligence.vociAnalizzate.length} voci.
            Puoi usare queste informazioni per generare il preventivo.
          </p>

          <button
            type="button"
            onClick={() =>
  props.generaPreventivoDaDocumentoAnalizzato(sopralluogoAperto)
}
            style={buttonPrimary}
          >
            💰 Genera preventivo da documento
          </button>
        </div>
      )}
    </>
  ) : (
    <div style={{ padding: 16, border: '1px solid #e2e8f0', borderRadius: 12 }}>
      Document Intelligence non disponibile.
    </div>
  )}
</section>

          <section
            aria-label="Galleria fotografica"
            style={{ display: sezioneAttiva === 'galleria' ? 'block' : 'none' }}
          >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  flexWrap: 'wrap',
                  marginBottom: 16,
                }}
              >
                <div>
                  <h3 style={{ margin: 0 }}>Galleria fotografica</h3>
                  <div style={{ marginTop: 4, color: '#64748b', fontSize: 13 }}>
                    {fotoDelSopralluogo.length} foto, {fotoCollegate.length} collegate al Quaderno
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => props.setPopupFotoSopralluogo(true)}
                    style={buttonPrimary}
                  >
                    + Aggiungi foto
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      props.setMostraGestioneFotoSopralluogo(
                        !props.mostraGestioneFotoSopralluogo
                      )
                      props.setFotoSopralluogoSelezionate([])
                    }}
                    style={buttonSecondary}
                  >
                    {props.mostraGestioneFotoSopralluogo ? 'Fine' : 'Gestisci'}
                  </button>
                </div>
              </div>

              <SopralluogoFotoGallery
                sopralluogoAperto={sopralluogoAperto}
                fotoSopralluoghi={props.fotoSopralluoghi}
                setFotoSopralluoghi={props.setFotoSopralluoghi}
                setFotoFullscreen={props.setFotoFullscreen}
                modalitaGestione={props.mostraGestioneFotoSopralluogo}
                fotoSelezionate={props.fotoSopralluogoSelezionate}
                setFotoSelezionate={props.setFotoSopralluogoSelezionate}
                caricaFotoSopralluoghi={props.caricaFotoSopralluoghi}
                supabase={supabase}
              />
          </section>

          <section
            aria-label="AI del sopralluogo"
            style={{ display: sezioneAttiva === 'ai' ? 'block' : 'none' }}
          >
              <h3 style={{ marginTop: 0 }}>AI</h3>
              <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                <article style={{ padding: 16, border: '1px solid #ddd6fe', borderRadius: 12, background: '#faf5ff' }}>
                  <strong>AI Osservatore</strong>
                  <p style={{ marginBottom: 0, color: '#475569' }}>
                    Analizza testo, checklist, disegno e le foto collegate dalla Galleria. Si usa nel Quaderno.
                  </p>
                </article>
                <article style={{ padding: 16, border: '1px solid #dbeafe', borderRadius: 12, background: '#eff6ff' }}>
                  <strong>Preventivo AI</strong>
                  <p style={{ marginBottom: 0, color: '#475569' }}>
                    {props.preventivoAiGenerato
                      ? 'È disponibile un preventivo AI generato per questo fascicolo.'
                      : 'La generazione del preventivo AI è disponibile nel menu Azioni.'}
                  </p>
                </article>
              </div>
          </section>

          <section
            aria-label="Azioni del sopralluogo"
            style={{ display: sezioneAttiva === 'azioni' ? 'block' : 'none' }}
          >
              <h3 style={{ marginTop: 0 }}>Azioni</h3>
              <p style={{ color: '#64748b' }}>
                Esporta, condividi o trasforma il fascicolo quando è pronto.
              </p>
              <SopralluogoAzioniPreventivo
                sopralluogoAperto={sopralluogoAperto}
                preventivoAiGenerato={props.preventivoAiGenerato}
                generaPreventivoAiDaSopralluogo={props.generaPreventivoAiDaSopralluogo}
                generaPreventivoDaSopralluogo={props.generaPreventivoDaSopralluogo}
                apriPreventivoAiGeneratoInModifica={props.apriPreventivoAiGeneratoInModifica}
                convertiSopralluogoInCantiere={props.convertiSopralluogoInCantiere}
                generaPdfSopralluogo={props.generaPdfSopralluogo}
                buttonPrimary={buttonPrimary}
              />
          </section>
        </main>
      </div>
    </div>
  )
}
