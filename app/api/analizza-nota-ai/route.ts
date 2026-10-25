import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { analizzaNotaOsservatore } from '../../engines/osservatore/analizza'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY mancante' },
        { status: 500 }
      )
    }

    return NextResponse.json(await analizzaNotaOsservatore(await req.json(), openai))
  } catch (error) {
    const messaggio =
      error instanceof Error ? error.message : 'Analisi nota non riuscita'
    return NextResponse.json({ error: messaggio }, { status: 500 })
  }
}
