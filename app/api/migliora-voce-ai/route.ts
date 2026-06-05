import OpenAI from 'openai'
import { NextResponse } from 'next/server'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: Request) {
  try {
    const { descrizione } = await req.json()

    const response = await openai.responses.create({
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

Rispondi SOLO JSON valido:

{
  "descrizione": "...",
  "prezzo_unitario": 0
}

Voce:
${descrizione}
`,
    })

    let testo = response.output_text || '{}'

    testo = testo
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim()

    return NextResponse.json(JSON.parse(testo))
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error.message ||
          'Errore miglioramento voce',
      },
      { status: 500 }
    )
  }
}
