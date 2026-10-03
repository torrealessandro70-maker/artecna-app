import { NextResponse } from 'next/server'
import { ErroreServizioRapportini, leggiVariantiRapportinoPortale, verificaOrigineRapportino } from '../../../engines/rapportini/servizioRapportini.server'

export async function POST(req: Request) {
  try {
    verificaOrigineRapportino(req)
    const body = await req.json()
    const varianti = await leggiVariantiRapportinoPortale(req, String(body?.cantiere_id || ''))
    return NextResponse.json({ varianti }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof ErroreServizioRapportini ? error.message : 'Richiesta non valida' },
      { status: error instanceof ErroreServizioRapportini ? error.status : 400, headers: { 'Cache-Control': 'no-store' } })
  }
}
