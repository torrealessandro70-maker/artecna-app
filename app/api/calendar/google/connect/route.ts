import { NextResponse } from 'next/server'

const GOOGLE_AUTHORIZATION_URL =
  'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_CALENDAR_EVENTS_SCOPE =
  'https://www.googleapis.com/auth/calendar.events'
const OAUTH_STATE_COOKIE = 'artecna_google_calendar_oauth_state'
const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60

export async function GET() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      {
        error:
          'Configurazione Google Calendar incompleta: GOOGLE_CLIENT_ID e GOOGLE_REDIRECT_URI sono obbligatorie.',
      },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store' },
      }
    )
  }

  const state = crypto.randomUUID()
  const authorizationUrl = new URL(GOOGLE_AUTHORIZATION_URL)

  authorizationUrl.searchParams.set('response_type', 'code')
  authorizationUrl.searchParams.set('access_type', 'offline')
  authorizationUrl.searchParams.set('prompt', 'consent')
  authorizationUrl.searchParams.set('scope', GOOGLE_CALENDAR_EVENTS_SCOPE)
  authorizationUrl.searchParams.set('redirect_uri', redirectUri)
  authorizationUrl.searchParams.set('client_id', clientId)
  authorizationUrl.searchParams.set('state', state)

  const response = NextResponse.redirect(authorizationUrl)
  response.headers.set('Cache-Control', 'no-store')
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/calendar/google',
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  })

  return response
}
