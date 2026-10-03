import { NextResponse } from 'next/server'
import { ErroreServizioRapportini, salvaRapportinoConPrestazioni } from '../../../engines/rapportini/servizioRapportini.server'

// Unico endpoint HTTP strutturato, condiviso da desktop e mobile futuri.
export async function POST(req: Request) {
  try {
    const result = await salvaRapportinoConPrestazioni(req, await req.json())
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof ErroreServizioRapportini ? error.message : 'Richiesta non valida' },
      { status: error instanceof ErroreServizioRapportini ? error.status : 400, headers: { 'Cache-Control': 'no-store' } })
  }
}
