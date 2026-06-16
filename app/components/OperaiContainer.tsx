'use client'

import OperaiAnagraficaPanel from './OperaiAnagraficaPanel'
import OperaiTimbraturePanel from './OperaiTimbraturePanel'
import OperaiPresenzeContainer from './OperaiPresenzeContainer'

type Props = any

export default function OperaiContainer(props: Props) {
  const p = props

  return (
    <>
      {/* ================= OPERAI - ANAGRAFICA ================= */}
      {(
        p.pagineAperte.includes('operai-anagrafica') ||
        (!p.modalitaMulti &&
          p.sezioneAttiva === 'operai' &&
          p.sottoSezioneOperai === 'anagrafica')
      ) && (
        <OperaiAnagraficaPanel
          cardStyle={p.cardStyle}
          operaioInModifica={p.operaioInModifica}
          annullaModificaOperaio={p.annullaModificaOperaio}
          salvaModificaOperaio={p.salvaModificaOperaio}
          nomeOperaioModifica={p.nomeOperaioModifica}
          setNomeOperaioModifica={p.setNomeOperaioModifica}
          telefonoOperaioModifica={p.telefonoOperaioModifica}
          setTelefonoOperaioModifica={p.setTelefonoOperaioModifica}
          qualificaOperaioModifica={p.qualificaOperaioModifica}
          setQualificaOperaioModifica={p.setQualificaOperaioModifica}
          pinOperaioModifica={p.pinOperaioModifica}
          setPinOperaioModifica={p.setPinOperaioModifica}
          costoOrarioOperaioModifica={p.costoOrarioOperaioModifica}
          setCostoOrarioOperaioModifica={p.setCostoOrarioOperaioModifica}
          statoOperaioModifica={p.statoOperaioModifica}
          setStatoOperaioModifica={p.setStatoOperaioModifica}
          notaOperaioModifica={p.notaOperaioModifica}
          setNotaOperaioModifica={p.setNotaOperaioModifica}
          nomeOperaio={p.nomeOperaio}
          setNomeOperaio={p.setNomeOperaio}
          telefonoOperaio={p.telefonoOperaio}
          setTelefonoOperaio={p.setTelefonoOperaio}
          qualificaOperaio={p.qualificaOperaio}
          setQualificaOperaio={p.setQualificaOperaio}
          pinOperaio={p.pinOperaio}
          setPinOperaio={p.setPinOperaio}
          costoOrarioOperaio={p.costoOrarioOperaio}
          setCostoOrarioOperaio={p.setCostoOrarioOperaio}
          aggiungiOperaio={p.aggiungiOperaio}
          operaiFiltrati={p.operaiFiltrati}
          badgeStyle={p.badgeStyle}
          formatMoney={p.formatMoney}
          preparaModificaOperaio={p.preparaModificaOperaio}
          cambiaStatoOperaio={p.cambiaStatoOperaio}
          eliminaOperaio={p.eliminaOperaio}
          buttonPrimary={p.buttonPrimary}
          buttonSecondary={p.buttonSecondary}
        />
      )}
    </>
  )
}