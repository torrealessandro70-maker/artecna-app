import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: Request) {
  try {
    const { testo, cantieri, operai, modello } = await req.json()

    const modelloUsato = modello || 'gpt-4.1-mini'

    const completion = await openai.chat.completions.create({
      model: modelloUsato,
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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey)

      const { error: erroreUtilizzoAi } = await supabase
        .from('utilizzo_ai')
        .insert([
          {
            tipo: 'rapportino',
            modello: modelloUsato,
            token_input: completion.usage?.prompt_tokens || 0,
            token_output: completion.usage?.completion_tokens || 0,
            costo_stimato: 0,
          },
        ])

      if (erroreUtilizzoAi) {
        console.error(
          'Errore salvataggio utilizzo AI:',
          erroreUtilizzoAi.message
        )
      }
    } else {
      console.error('Variabili Supabase mancanti per utilizzo_ai')
    }

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