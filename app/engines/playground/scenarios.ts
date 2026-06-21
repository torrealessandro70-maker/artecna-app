import type { EnginePlaygroundScenario } from './types'

export const playgroundScenarios: EnginePlaygroundScenario[] = [
  {
    id: 'fine-bagno',
    title: 'Fine bagno',
    userInput:
      "Oggi abbiamo finito il bagno. C'erano Marco e Salvo. Domani dobbiamo montare i sanitari e ordinare il silicone.",
    expectedSignals: ['bagno', 'Marco', 'Salvo', 'sanitari', 'silicone'],
  },
  {
    id: 'consegna-materiale',
    title: 'Consegna materiale',
    userInput:
      'È arrivato il materiale per il cantiere. Ci sono colla, rasante e piastrelle. Domani iniziamo la posa.',
    expectedSignals: ['materiale', 'colla', 'rasante', 'piastrelle', 'posa'],
  },
]
