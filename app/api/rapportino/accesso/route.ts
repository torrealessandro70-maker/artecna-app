import { NextResponse } from 'next/server'
import { COOKIE_SESSIONE_RAPPORTINO, DURATA_SESSIONE_SECONDI, ErroreServizioRapportini,
  creaSessioneRapportino, verificaOrigineRapportino } from '../../../engines/rapportini/servizioRapportini.server'

export async function POST(req: Request) {
  try {
    verificaOrigineRapportino(req)
    const body = await req.json()
    const { accesso, token } = await creaSessioneRapportino(String(body?.pin || '').trim())
    // Stessa risposta legacy, sessione aggiunta senza modificare la UI.
    const response = NextResponse.json(accesso, { headers: { 'Cache-Control': 'no-store' } })
    response.cookies.set(COOKIE_SESSIONE_RAPPORTINO, token, { httpOnly: true,
      secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api/rapportino',
      maxAge: DURATA_SESSIONE_SECONDI })
    return response
  } catch (error) {
    return NextResponse.json({ error: error instanceof ErroreServizioRapportini ? error.message : 'Richiesta non valida' },
      { status: error instanceof ErroreServizioRapportini ? error.status : 400, headers: { 'Cache-Control': 'no-store' } })
  }
}
