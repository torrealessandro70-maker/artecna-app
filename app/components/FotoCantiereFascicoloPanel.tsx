'use client'

import FotoCantiereToolbar from './FotoCantiereToolbar'
import FotoCantiereCamera from './FotoCantiereCamera'
import FotoCantiereForm from './FotoCantiereForm'
import FotoCantiereFiltri from './FotoCantiereFiltri'
import FotoCantiereGallery from './FotoCantiereGallery'
import FotoCantiereAnteprime from './FotoCantiereAnteprime'
import FotoCantiereCategoriaModal from './FotoCantiereCategoriaModal'

type Props = Parameters<typeof FotoCantiereToolbar>[0] &
  Parameters<typeof FotoCantiereCamera>[0] &
  Parameters<typeof FotoCantiereForm>[0] &
  Parameters<typeof FotoCantiereFiltri>[0] &
  Parameters<typeof FotoCantiereGallery>[0] &
  Parameters<typeof FotoCantiereAnteprime>[0] &
  Parameters<typeof FotoCantiereCategoriaModal>[0] & {
    geolocalizzazioneFoto?: string
  }

export default function FotoCantiereFascicoloPanel(props: Props) {
  const p = props
  const totaleFoto = p.fotoCantiere.filter(
    (foto) => foto.cantiere === p.cantiereScheda
  ).length

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>Galleria cantiere</h3>
        <div style={{ marginTop: 4, color: '#64748b', fontSize: 13 }}>
          {totaleFoto} foto salvate per questo cantiere
        </div>
      </div>

      <FotoCantiereToolbar
        caricaFotoDaInput={p.caricaFotoDaInput}
        cameraFotoCantiereAttiva={p.cameraFotoCantiereAttiva}
        setCameraFotoCantiereAttiva={p.setCameraFotoCantiereAttiva}
        rilevaPosizioneFoto={p.rilevaPosizioneFoto}
        fotoDaCaricare={p.fotoDaCaricare}
        categoriaFoto={p.categoriaFoto}
        setCategoriaFotoDaSalvare={p.setCategoriaFotoDaSalvare}
        setPopupCategoriaFotoCantiere={p.setPopupCategoriaFotoCantiere}
        esportaPdfFotoCantiere={p.esportaPdfFotoCantiere}
        buttonPrimary={p.buttonPrimary}
        buttonSecondary={p.buttonSecondary}
      />

      <FotoCantiereCamera
        cameraFotoCantiereAttiva={p.cameraFotoCantiereAttiva}
        cameraFotoCantiereFullscreen={p.cameraFotoCantiereFullscreen}
        setCameraFotoCantiereFullscreen={p.setCameraFotoCantiereFullscreen}
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

      <FotoCantiereFiltri
        filtroFotoCantiere={p.filtroFotoCantiere}
        setFiltroFotoCantiere={p.setFiltroFotoCantiere}
        fotoCantiereSelezionate={p.fotoCantiereSelezionate}
        setFotoCantiereSelezionate={p.setFotoCantiereSelezionate}
        categoriaFotoMultipla={p.categoriaFotoMultipla}
        setCategoriaFotoMultipla={p.setCategoriaFotoMultipla}
        aggiornaCategoriaFotoSelezionate={p.aggiornaCategoriaFotoSelezionate}
        buttonPrimary={p.buttonPrimary}
        buttonSecondary={p.buttonSecondary}
      />

      <FotoCantiereGallery
        fotoCantiere={p.fotoCantiere}
        setFotoCantiere={p.setFotoCantiere}
        cantiereScheda={p.cantiereScheda}
        filtroFotoCantiere={p.filtroFotoCantiere}
        fotoCantiereSelezionate={p.fotoCantiereSelezionate}
        setFotoCantiereSelezionate={p.setFotoCantiereSelezionate}
        setFotoFullscreen={p.setFotoFullscreen}
        supabase={p.supabase}
        caricaFotoCantiere={p.caricaFotoCantiere}
        eliminaFotoCantiere={p.eliminaFotoCantiere}
        buttonSecondary={p.buttonSecondary}
      />

      {p.geolocalizzazioneFoto && (
        <div style={{ marginBottom: 10, fontSize: 13, color: '#475569' }}>
          Posizione: {p.geolocalizzazioneFoto}
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
        setPopupCategoriaFotoCantiere={p.setPopupCategoriaFotoCantiere}
        setCategoriaFoto={p.setCategoriaFoto}
        salvaFotoCantiere={p.salvaFotoCantiere}
        buttonPrimary={p.buttonPrimary}
        buttonSecondary={p.buttonSecondary}
      />
    </div>
  )
}
