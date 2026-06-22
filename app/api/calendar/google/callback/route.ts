import { type NextRequest, NextResponse } from 'next/server'

const OAUTH_STATE_COOKIE = 'artecna_google_calendar_oauth_state'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

type JsonResponseBody = Record<string, string | number | boolean>

type GoogleTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
  error?: string
  error_description?: string
}

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

const jsonResponse = (body: JsonResponseBody, status: number) =>
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

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    return jsonResponse(
      {
        error:
          'Configurazione Google Calendar incompleta: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI sono obbligatorie.',
      },
      500
    )
  }

  let tokenResponse: Response

  try {
    tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
      cache: 'no-store',
    })
  } catch {
    return jsonResponse(
      { error: 'Impossibile contattare il servizio OAuth di Google.' },
      502
    )
  }

  let tokenData: GoogleTokenResponse

  try {
    tokenData = (await tokenResponse.json()) as GoogleTokenResponse
  } catch {
    return jsonResponse(
      { error: 'Risposta OAuth Google non valida o non leggibile.' },
      502
    )
  }

  if (!tokenResponse.ok || !tokenData.access_token) {
    return jsonResponse(
      {
        error: 'Scambio token Google Calendar non riuscito.',
        google_error: tokenData.error || 'oauth_token_exchange_failed',
      },
      tokenResponse.status >= 400 && tokenResponse.status < 500 ? 400 : 502
    )
  }

  // I token sono letti soltanto dalla risposta in memoria e non vengono
  // restituiti, loggati o usati per creare eventi in questo step.
  const expiresIn =
    typeof tokenData.expires_in === 'number' ? tokenData.expires_in : 0

  // TODO
  // Persistenza token nello step successivo.
  return jsonResponse(
    {
      connected: true,
      provider: 'google',
      expires_in: expiresIn,
    },
    200
  )
}
