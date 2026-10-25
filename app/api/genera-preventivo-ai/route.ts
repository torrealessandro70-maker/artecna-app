import { creaRichiestaPreventivoAi } from '../../engines/preventivo-generation/richiesta'
import { generaIntegrativo } from '../../engines/preventivo-generation/server'
import OpenAI from 'openai'
import { NextResponse } from 'next/server'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: Request) {
  try {



    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY mancante su Vercel' },
        { status: 500 }
      )
    }



    if (!process.env.OPENAI_API_KEY.startsWith('sk-proj-')) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY presente ma formato non valido' },
        { status: 500 }
      )
    }
   const body = await req.json()
   if (body?.tipo === 'integrativo') return generaIntegrativo(req, body)
   const {
  sopralluogo,
  foto,
  prezzi_riferimento,
} = body
    const response = await openai.responses.create(creaRichiestaPreventivoAi({ sopralluogo, foto, prezzi_riferimento }))


    let testo = response.output_text || '{}'

testo = testo
  .replace(/```json/g, '')
  .replace(/```/g, '')
  .trim()

const jsonStart = testo.indexOf('{')
const jsonEnd = testo.lastIndexOf('}')

if (jsonStart >= 0 && jsonEnd >= 0) {
  testo = testo.slice(jsonStart, jsonEnd + 1)
}

return NextResponse.json(JSON.parse(testo))
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          (error instanceof Error ? error.message : '') ||
          'Errore generazione preventivo AI',
      },
      { status: 500 }
    )
  }
}
