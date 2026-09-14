'use client'

import SelectCantiere from './SelectCantiere'
import FotoCantiereToolbar from './FotoCantiereToolbar'
import FotoCantiereCamera from './FotoCantiereCamera'
import FotoCantiereForm from './FotoCantiereForm'
import FotoCantiereFiltri from './FotoCantiereFiltri'
import FotoCantiereGallery from './FotoCantiereGallery'
import FotoCantiereAnteprime from './FotoCantiereAnteprime'
import FotoCantiereCategoriaModal from './FotoCantiereCategoriaModal'

export default function CantieriSchedaPanel(props: any) {
  const p = props

  return (
    <div style={{ ...p.cardStyle, minWidth: 0, background: '#f8fafc' }}>
      <header
        style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start',
          gap: 24, padding: 24, background: '#fff',
          border: '1px solid #e2e8f0', borderRadius: 16,
          boxShadow: '0 2px 6px rgb(15 23 42 / 3%)',
        }}
      >
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <p style={{ margin: '0 0 12px', color: '#64748b', fontSize: 13 }}>
            Scheda cantiere
          </p>
          {typeof p.cantiereSelezionatoDaId?.lavori_conclusi === 'boolean' && (
            <span style={{
              display: 'inline-block', padding: '4px 10px', borderRadius: 20,
              background: '#f1f5f9', color: '#475569', fontSize: 12,
              fontWeight: 600, marginBottom: 12,
            }}>
              {p.cantiereSelezionatoDaId.lavori_conclusi ? 'Lavori conclusi' : 'Lavori non conclusi'}
            </span>
          )}
          <h2 style={{
            margin: 0, color: '#0f172a', fontSize: 28, lineHeight: 1.2,
            letterSpacing: '-0.02em', overflowWrap: 'anywhere',
          }}>
            {p.cantiereNomeVisualizzato || 'Seleziona un cantiere'}
          </h2>
        </div>

        <div style={{ flex: '0 1 360px', minWidth: 0, width: '100%' }}>
          <p style={{ margin: '0 0 8px', color: '#334155', fontSize: 13, fontWeight: 600 }}>
            Cambia cantiere
          </p>
          <SelectCantiere
            cantieri={p.cantieri}
            value={p.cantiereScheda || ''}
            onChange={p.setCantiereScheda}
            onChangeId={p.setCantiereIdScheda}
            inputStyle={{
              padding: 10, width: '100%', maxWidth: '100%', boxSizing: 'border-box',
              border: '1px solid #94a3b8', borderRadius: 8, background: '#fff',
              color: '#0f172a', marginBottom: 12,
            }}
            buttonSecondary={p.buttonSecondary}
          />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <input
              aria-label="Cerca cantiere"
              placeholder="Cerca cantiere..."
              value={p.ricercaCantiereEconomia}
              onChange={(e) => p.setRicercaCantiereEconomia(e.target.value)}
              style={{ ...p.inputStyle, flex: '1 1 160px', minWidth: 0, width: '100%', boxSizing: 'border-box' }}
            />
            <button
              type="button"
              onClick={() => p.setMostraConclusiEconomia(!p.mostraConclusiEconomia)}
              style={p.buttonSecondary}
            >
              {p.mostraConclusiEconomia ? 'Nascondi conclusi' : 'Mostra conclusi'}
            </button>
          </div>
          {p.cantiereSelezionatoDaId && (
            <details style={{ marginTop: 12, color: '#475569', fontSize: 13 }}>
              <summary style={{ cursor: 'pointer', padding: '8px 0' }}>Altro</summary>
              <button
                type="button"
                onClick={p.modificaNomeCantiereScheda}
                style={p.buttonSecondary}
              >
                Modifica nome
              </button>
            </details>
          )}
        </div>
      </header>

      <nav aria-label="Sezioni cantiere" style={{
        display: 'flex', gap: 4, overflowX: 'auto', maxWidth: '100%',
        marginTop: 20, marginBottom: 24, borderBottom: '1px solid #e2e8f0',
      }}>
        {['Panoramica', 'Lavori', 'Documenti', 'Economia', 'Fascicolo', 'Timeline', 'Analisi AI'].map((sezione) => (
          <span
            key={sezione}
            aria-current={sezione === 'Panoramica' ? 'page' : undefined}
            style={{
              flexShrink: 0, padding: '12px 16px', fontSize: 14,
              fontWeight: sezione === 'Panoramica' ? 600 : 400,
              color: sezione === 'Panoramica' ? '#1d4ed8' : '#64748b',
              borderBottom: sezione === 'Panoramica' ? '2px solid #1d4ed8' : '2px solid transparent',
            }}
          >
            {sezione}
          </span>
        ))}
      </nav>
      {!p.cantiereSelezionatoDaId ? (
        <p>Seleziona un cantiere per vedere i dettagli.</p>
      ) : (
        (() => {
          const dati = p.calcoloEconomiaCantiere(p.cantiereScheda)

          const margine =
            dati.preventivo > 0
              ? ((dati.utileReale / dati.preventivo) * 100).toFixed(1)
              : 0

          return (
            <div>
              <div
                style={{
                  marginTop: 15,
                  padding: 15,
                  border: '1px solid #ddd',
                  borderRadius: 10,
                }}
              >
                <h3 style={{ marginTop: 0 }}>Stato cantiere</h3>

                <p>Preventivo: {p.formatMoney(dati.preventivo)}</p>
                <p>Manodopera: {p.formatMoney(dati.costoManodopera)}</p>
                <p>Fornitori: {p.formatMoney(dati.costoFornitori)}</p>

                <p>
                  <strong>
                    Costo totale: {p.formatMoney(dati.costoTotale)}
                  </strong>
                </p>

                <p>
                  <strong
                    style={{
                      color: dati.utileReale >= 0 ? 'green' : 'red',
                    }}
                  >
                    Utile: {p.formatMoney(dati.utileReale)}
                  </strong>
                </p>

                <p>
                  <strong>Margine: {margine}%</strong>
                </p>
              </div>

              <div style={{ marginTop: 15 }}>
                {dati.utileReale < 0 ? (
                  <strong style={{ color: 'red' }}>
                    🚨 Cantiere in perdita
                  </strong>
                ) : Number(margine) < 10 ? (
                  <strong style={{ color: '#f59e0b' }}>
                    ⚠️ Margine basso
                  </strong>
                ) : (
                  <strong style={{ color: 'green' }}>
                    ✅ Cantiere in utile
                  </strong>
                )}
              </div>

              <div
                style={{
                  marginTop: 20,
                  padding: 15,
                  border: '1px solid #d1d5db',
                  borderRadius: 12,
                  background: '#fff',
                }}
              >
                <FotoCantiereToolbar
                  caricaFotoDaInput={p.caricaFotoDaInput}
                  cameraFotoCantiereAttiva={p.cameraFotoCantiereAttiva}
                  setCameraFotoCantiereAttiva={
                    p.setCameraFotoCantiereAttiva
                  }
                  rilevaPosizioneFoto={p.rilevaPosizioneFoto}
                  fotoDaCaricare={p.fotoDaCaricare}
                  categoriaFoto={p.categoriaFoto}
                  setCategoriaFotoDaSalvare={p.setCategoriaFotoDaSalvare}
                  setPopupCategoriaFotoCantiere={
                    p.setPopupCategoriaFotoCantiere
                  }
                  esportaPdfFotoCantiere={p.esportaPdfFotoCantiere}
                  buttonPrimary={p.buttonPrimary}
                  buttonSecondary={p.buttonSecondary}
                />

                <FotoCantiereCamera
                  cameraFotoCantiereAttiva={p.cameraFotoCantiereAttiva}
                  cameraFotoCantiereFullscreen={
                    p.cameraFotoCantiereFullscreen
                  }
                  setCameraFotoCantiereFullscreen={
                    p.setCameraFotoCantiereFullscreen
                  }
                  webcamFotoCantiereRef={p.webcamFotoCantiereRef}
                  scattaFotoCantiere={p.scattaFotoCantiere}
                />

                <FotoCantiereForm
                  notaFotoCantiere={p.notaFotoCantiere}
                  setNotaFotoCantiere={p.setNotaFotoCantiere}
                  categoriaFoto={p.categoriaFoto}
                  setCategoriaFoto={p.setCategoriaFoto}
                  note={p.note}
                  setNote={p.setNote}
                  avviaDettatura={p.avviaDettatura}
                  buttonSecondary={p.buttonSecondary}
                />

                <div style={{ marginTop: 15 }}>
                  <strong>
                    Foto salvate per questo cantiere:{' '}
                    {
                      p.fotoCantiere.filter(
                        (f: any) => f.cantiere === p.cantiereScheda
                      ).length
                    }
                  </strong>
                </div>

                <FotoCantiereFiltri
                  filtroFotoCantiere={p.filtroFotoCantiere}
                  setFiltroFotoCantiere={p.setFiltroFotoCantiere}
                  fotoCantiereSelezionate={p.fotoCantiereSelezionate}
                  setFotoCantiereSelezionate={
                    p.setFotoCantiereSelezionate
                  }
                  categoriaFotoMultipla={p.categoriaFotoMultipla}
                  setCategoriaFotoMultipla={p.setCategoriaFotoMultipla}
                  aggiornaCategoriaFotoSelezionate={
                    p.aggiornaCategoriaFotoSelezionate
                  }
                  buttonPrimary={p.buttonPrimary}
                  buttonSecondary={p.buttonSecondary}
                />

                <FotoCantiereGallery
                  fotoCantiere={p.fotoCantiere}
                  setFotoCantiere={p.setFotoCantiere}
                  cantiereScheda={p.cantiereScheda}
                  filtroFotoCantiere={p.filtroFotoCantiere}
                  fotoCantiereSelezionate={p.fotoCantiereSelezionate}
                  setFotoCantiereSelezionate={
                    p.setFotoCantiereSelezionate
                  }
                  setFotoFullscreen={p.setFotoFullscreen}
                  supabase={p.supabase}
                  fotoStorageBucket={p.fotoStorageBucket}
                  caricaFotoCantiere={p.caricaFotoCantiere}
                  eliminaFotoCantiere={p.eliminaFotoCantiere}
                  buttonSecondary={p.buttonSecondary}
                />

                {p.geolocalizzazioneFoto && (
                  <div
                    style={{
                      marginBottom: 10,
                      fontSize: 13,
                      color: '#475569',
                    }}
                  >
                    📍 {p.geolocalizzazioneFoto}
                  </div>
                )}

                <FotoCantiereAnteprime
                  fotoDaCaricare={p.fotoDaCaricare}
                  setFotoDaCaricare={p.setFotoDaCaricare}
                />

                <FotoCantiereCategoriaModal
                  popupCategoriaFotoCantiere={p.popupCategoriaFotoCantiere}
                  fotoDaCaricare={p.fotoDaCaricare}
                  categoriaFotoDaSalvare={p.categoriaFotoDaSalvare}
                  setCategoriaFotoDaSalvare={p.setCategoriaFotoDaSalvare}
                  setPopupCategoriaFotoCantiere={
                    p.setPopupCategoriaFotoCantiere
                  }
                  setCategoriaFoto={p.setCategoriaFoto}
                  salvaFotoCantiere={p.salvaFotoCantiere}
                  buttonPrimary={p.buttonPrimary}
                  buttonSecondary={p.buttonSecondary}
                />
              </div>
            </div>
          )
        })()
      )}
    </div>
  )
}
