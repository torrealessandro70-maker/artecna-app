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
    <div style={p.cardStyle}>
      <h2>Scheda cantiere</h2>

      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        <input
          placeholder="Cerca cantiere..."
          value={p.ricercaCantiereEconomia}
          onChange={(e) => p.setRicercaCantiereEconomia(e.target.value)}
          style={p.inputStyle}
        />

        <button
          onClick={() =>
            p.setMostraConclusiEconomia(!p.mostraConclusiEconomia)
          }
          style={p.buttonSecondary}
        >
          {p.mostraConclusiEconomia ? 'Nascondi conclusi' : 'Mostra conclusi'}
        </button>
      </div>

      <SelectCantiere
        cantieri={p.cantieri}
        value={p.cantiereScheda || ''}
        onChange={p.setCantiereScheda}
        inputStyle={{
          padding: 8,
          width: 260,
          marginBottom: 15,
        }}
        buttonSecondary={p.buttonSecondary}
      />

      {!p.cantiereScheda ? (
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
              <h3>{p.cantiereScheda}</h3>

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