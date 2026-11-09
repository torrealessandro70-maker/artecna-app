'use client'
import FotoRapportinoQueueV1 from './FotoRapportinoQueueV1'
import { creaTrasportoHttpFotoV1 } from '../engines/rapportini/trasportoHttpFotoV1'
import type { ContestoFoto } from '../engines/rapportini/fotoRapportinoV1'
const trasporto = creaTrasportoHttpFotoV1('/api/rapportino/foto')
/** Il wrapper portale conserva identità operaio e trasporto cookie esistenti. */
export default function FotoRapportinoMobileV1({ operaioId, contesto, disabled }: {
  operaioId: string; contesto: ContestoFoto; disabled: boolean
}) {
  return <FotoRapportinoQueueV1 identita={{ canale: 'portale', soggettoId: operaioId }}
    contesto={contesto} disabled={disabled} trasporto={trasporto} />
}
