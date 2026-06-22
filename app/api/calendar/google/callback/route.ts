import { type NextRequest, NextResponse } from 'next/server'

const OAUTH_STATE_COOKIE = 'artecna_google_calendar_oauth_state'

const clearStateCookie = (response: NextResponse) => {
  response.cookies.set(OAUTH_STATE_COOKIE, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/calendar/google',
    maxAge: 0,
  })

  return response
}

const jsonResponse = (body: Record<string, string>, status: number) =>
  clearStateCookie(
    NextResponse.json(body, {
      status,
      headers: { 'Cache-Control': 'no-store' },
    })
  )

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const oauthError = request.nextUrl.searchParams.get('error')
  const expectedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value

  if (oauthError) {
    return jsonResponse(
      {
        error:
          'Autorizzazione Google Calendar annullata o rifiutata da Google.',
      },
      400
    )
  }

  if (!code) {
    return jsonResponse(
      { error: 'Callback Google Calendar senza codice di autorizzazione.' },
      400
    )
  }

  if (!state || !expectedState || state !== expectedState) {
    return jsonResponse(
      { error: 'Parametro state Google Calendar mancante o non valido.' },
      400
    )
  }

  // Lo scambio del code e il salvataggio sicuro dei token arriveranno in uno
  // step successivo. Il code non viene loggato, scambiato o persistito qui.
  return jsonResponse(
    {
      message:
        'Callback Google Calendar ricevuta. Scambio token non ancora implementato.',
    },
    200
  )
}
