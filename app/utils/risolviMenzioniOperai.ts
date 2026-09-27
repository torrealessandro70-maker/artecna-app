import type { MenzioneOperaio } from '../engines/document-intelligence/worker-mentions'
import {
  risolviOperaio,
  type OperaioRisolvibile,
  type RegolaRisoluzioneOperaio,
} from './risolviOperaio'

export type MenzioneOperaioRisolta =
  | {
      stato: 'trovato'
      menzione: MenzioneOperaio
      operaio: OperaioRisolvibile
      regola: RegolaRisoluzioneOperaio
    }
  | {
      stato: 'ambiguo'
      menzione: MenzioneOperaio
      candidati: OperaioRisolvibile[]
    }
  | {
      stato: 'non_trovato'
      menzione: MenzioneOperaio
    }

export function risolviMenzioniOperai(
  menzioni: readonly MenzioneOperaio[],
  anagrafica: readonly OperaioRisolvibile[]
): MenzioneOperaioRisolta[] {
  return menzioni.map((menzione) => ({
    ...risolviOperaio(menzione.testo, anagrafica),
    menzione: { ...menzione },
  }))
}
