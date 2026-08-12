import OpenAI from 'openai'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY

    if (!apiKey) {
      console.error(
        'OPENAI_API_KEY non configurata sul server',
      )

      return NextResponse.json(
        {
          error:
            'Servizio AI non configurato: manca OPENAI_API_KEY',
        },
        { status: 500 },
      )
    }

    const body = await req.json()

    const descrizione =
      typeof body?.descrizione === 'string'
        ? body.descrizione.trim()
        : ''

    if (!descrizione) {
      return NextResponse.json(
        {
          error:
            'La descrizione della voce è obbligatoria',
        },
        { status: 400 },
      )
    }

    const openai = new OpenAI({
      apiKey,
    })

    const response =
      await openai.responses.create({
        model: 'gpt-4.1-mini',

        input: `
Sei un preventivista edile italiano.

Riscrivi questa voce in stile:
- capitolato tecnico
- Prezzario Regione Sicilia
- linguaggio professionale italiano

NON essere breve.
NON usare inglese.
NON aggiungere spiegazioni.

Rispondi SOLO con JSON valido:

{
  "descrizione": "...",
  "prezzo_unitario": 0
}

Voce:
${descrizione}
`,
      })

    const testo = (
      response.output_text || '{}'
    )
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim()

    let risultato: {
      descrizione?: string
      prezzo_unitario?: number
    }

    try {
      risultato = JSON.parse(testo)
    } catch {
      console.error(
        'Risposta AI non valida:',
        testo,
      )

      return NextResponse.json(
        {
          error:
            'La risposta AI non contiene un JSON valido',
        },
        { status: 502 },
      )
    }

    return NextResponse.json({
      descrizione:
        risultato.descrizione ||
        descrizione,

      prezzo_unitario:
        typeof risultato.prezzo_unitario ===
        'number'
          ? risultato.prezzo_unitario
          : 0,
    })
  } catch (error) {
    const messaggio =
      error instanceof Error
        ? error.message
        : 'Errore miglioramento voce'

    console.error(
      'Errore API migliora-voce-ai:',
      error,
    )

    return NextResponse.json(
      {
        error: messaggio,
      },
      { status: 500 },
    )
  }
}