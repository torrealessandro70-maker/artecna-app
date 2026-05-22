import OpenAI from 'openai'
import { NextResponse } from 'next/server'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: Request) {
  try {
    const { testo, cantieri, operai } = await req.json()

    const completion = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: `
Sei un assistente per un gestionale edile.
Dal testo parlato devi estrarre i campi di un rapportino giornaliero.

Rispondi SOLO in JSON valido con questi campi:
{
  "cantiere": "",
  "data": "",
  "ore": "",
  "note": "",
  "operai": "",
  "materiali": "",
  "costoMateriali": ""
}

Se non trovi un dato, lascia stringa vuota.
Usa solo cantieri presenti nella lista se riconosci il nome.
`,
        },
        {
          role: 'user',
          content: `
Testo parlato:
${testo}

Cantieri disponibili:
${cantieri.join(', ')}

Operai disponibili:
${operai.join(', ')}
`,
        },
      ],
      temperature: 0.2,
    })

    const contenuto = completion.choices[0]?.message?.content || '{}'
    const json = JSON.parse(contenuto)

    return NextResponse.json(json)
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Errore analisi rapportino' },
      { status: 500 }
    )
  }
}