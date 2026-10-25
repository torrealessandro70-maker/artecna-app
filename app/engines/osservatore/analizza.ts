import type OpenAI from 'openai'

export const MODELLO_OSSERVATORE = 'gpt-4.1-mini'
export type AllegatoAudio = { url: string; nome: string }
export type InputOsservatore = { titolo?: string; testo?: string; checklist?: unknown[]; immagini?: string[]; audio?: AllegatoAudio[]; disegni?: Array<{ strumento?: string }>; contesto?: { cliente?: string; indirizzo?: string; tipo_lavoro?: string } }

/** Shared existing observer: same prompt, model, caps, transcription and JSON parser. */
export async function analizzaNotaOsservatore(input: InputOsservatore, openai: Pick<OpenAI, 'audio' | 'responses'>, fetcher: typeof fetch = fetch): Promise<unknown> {
    const {
      titolo,
      testo,
      checklist = [],
      immagini = [],
      audio = [],
      disegni = [],
      contesto = {},
    } = input

    const trascrizioni: string[] = []

    for (const registrazione of (audio as AllegatoAudio[]).slice(0, 3)) {
      try {
        const response = await fetcher(registrazione.url)
        if (!response.ok) continue

        const blob = await response.blob()
        const file = new File(
          [blob],
          registrazione.nome || 'nota-vocale.webm',
          { type: blob.type || 'audio/webm' }
        )
        const trascrizione = await openai.audio.transcriptions.create({
          file,
          model: 'whisper-1',
          language: 'it',
        })

        if (trascrizione.text) trascrizioni.push(trascrizione.text)
      } catch {
        // Una registrazione illeggibile non deve bloccare l'analisi della nota.
      }
    }

    const riepilogoDisegni = (disegni as Array<{ strumento?: string }>).reduce(
      (conteggio: Record<string, number>, segno) => {
        const tipo = segno.strumento || 'segno'
        conteggio[tipo] = (conteggio[tipo] || 0) + 1
        return conteggio
      },
      {}
    )

    const contenutiImmagini = (immagini as string[])
      .slice(0, 8)
      .map((url) => ({
        type: 'input_image' as const,
        image_url: url,
        detail: 'auto' as const,
      }))

    const response = await openai.responses.create({
      model: MODELLO_OSSERVATORE,
      text: { format: { type: 'json_object' } },
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `Sei l'assistente tecnico osservatore di ARTECNA, impresa edile italiana.

Analizza la nota di sopralluogo senza riscriverla e senza sostituirti al tecnico. Collega testo, checklist, fotografie, trascrizioni vocali e presenza di annotazioni grafiche. Formula ipotesi prudenti, indica verifiche concrete da svolgere e segnala le informazioni mancanti. Non dichiarare mai una diagnosi certa partendo soltanto dalle fotografie.

CONTESTO
Cliente: ${contesto.cliente || ''}
Indirizzo: ${contesto.indirizzo || ''}
Tipo lavoro: ${contesto.tipo_lavoro || ''}

NOTA
Titolo: ${titolo || ''}
Testo: ${testo || ''}
Checklist: ${JSON.stringify(checklist)}
Trascrizioni audio: ${trascrizioni.join('\n') || 'nessuna'}
Annotazioni grafiche: ${JSON.stringify(riepilogoDisegni)}

Rispondi esclusivamente con JSON valido in italiano:
{
  "sintesi": "osservazione sintetica",
  "ipotesi": ["possibile causa, espressa con prudenza"],
  "verifiche": ["controllo tecnico concreto da eseguire"],
  "domande": ["informazione utile ancora mancante"],
  "avvertenza": "Valutazione preliminare da confermare con verifica tecnica in sito."
}`,
            },
            ...contenutiImmagini,
          ],
        },
      ],
    })

    const testoRisposta = response.output_text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim()

    return JSON.parse(testoRisposta) as unknown
}
