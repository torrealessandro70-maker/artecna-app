'use client'

import { useState, type CSSProperties, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'

type Props = {
  emailLogin: string
  passwordLogin: string
  mostraPassword: boolean
  inputStyle: CSSProperties
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
  setEmailLogin: (value: string) => void
  setPasswordLogin: (value: string) => void
  setMostraPassword: (value: boolean) => void
  login: () => void
  registrati: () => void
}

export default function LoginForm({
  emailLogin,
  passwordLogin,
  mostraPassword,
  inputStyle,
  buttonPrimary,
  buttonSecondary,
  setEmailLogin,
  setPasswordLogin,
  setMostraPassword,
  login,
  registrati,
}: Props) {
  const [recuperoPassword, setRecuperoPassword] = useState(false)
  const [emailRecupero, setEmailRecupero] = useState('')
  const [invioRecupero, setInvioRecupero] = useState(false)
  const [messaggioRecupero, setMessaggioRecupero] = useState('')
  const [erroreRecupero, setErroreRecupero] = useState('')

  const apriRecuperoPassword = () => {
    setEmailRecupero(emailLogin)
    setMessaggioRecupero('')
    setErroreRecupero('')
    setRecuperoPassword(true)
  }

  const tornaAlLogin = () => {
    setRecuperoPassword(false)
    setMessaggioRecupero('')
    setErroreRecupero('')
  }

  const inviaRecuperoPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const email = emailRecupero.trim()

    if (!email) {
      setErroreRecupero('Inserisci il tuo indirizzo email.')
      return
    }

    setInvioRecupero(true)
    setErroreRecupero('')
    setMessaggioRecupero('')

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) {
        setErroreRecupero('Non è stato possibile inviare il link. Riprova tra poco.')
        return
      }

      setMessaggioRecupero(
        'Se l’email è registrata, riceverai un link per reimpostare la password.'
      )
    } catch {
      setErroreRecupero('Non è stato possibile inviare il link. Riprova tra poco.')
    } finally {
      setInvioRecupero(false)
    }
  }

  const stileCampo: CSSProperties = {
    ...inputStyle,
    width: '100%',
    minHeight: 56,
    margin: 0,
    padding: '14px 16px',
    border: '1px solid #cbd5e1',
    borderRadius: 12,
    background: '#fff',
    color: '#0f172a',
    fontSize: 17,
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        background:
          'linear-gradient(145deg, #e2e8f0 0%, #f8fafc 48%, #dbeafe 100%)',
      }}
    >
      <section
        aria-labelledby="titolo-login"
        style={{
          width: '100%',
          maxWidth: 460,
          padding: '34px 28px',
          border: '1px solid rgba(148,163,184,0.35)',
          borderRadius: 22,
          background: 'rgba(255,255,255,0.96)',
          boxShadow: '0 24px 65px rgba(15,23,42,0.16)',
        }}
      >
        <header style={{ marginBottom: 28, textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-grid',
              placeItems: 'center',
              width: 58,
              height: 58,
              marginBottom: 14,
              borderRadius: 16,
              background: '#0f172a',
              color: '#fff',
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: 1,
            }}
            aria-hidden="true"
          >
            AO
          </div>
          <h1 id="titolo-login" style={{ margin: 0, color: '#0f172a', fontSize: 31 }}>
            ARTECNA OS
          </h1>
          <p style={{ margin: '7px 0 0', color: '#64748b', fontSize: 15 }}>
            Sistema operativo per imprese edili
          </p>
        </header>

        {recuperoPassword ? (
          <form onSubmit={(event) => void inviaRecuperoPassword(event)}>
            <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>Recupera password</h2>
            <p style={{ margin: '0 0 18px', color: '#64748b', lineHeight: 1.5 }}>
              Inserisci l’email associata al tuo account.
            </p>

            <label style={{ display: 'grid', gap: 7, fontWeight: 700 }}>
              Email
              <input
                type="email"
                value={emailRecupero}
                onChange={(event) => setEmailRecupero(event.target.value)}
                autoComplete="email"
                autoFocus
                required
                style={stileCampo}
              />
            </label>

            {messaggioRecupero && (
              <div
                role="status"
                style={{
                  marginTop: 16,
                  padding: 12,
                  border: '1px solid #86efac',
                  borderRadius: 10,
                  background: '#f0fdf4',
                  color: '#166534',
                  lineHeight: 1.45,
                }}
              >
                {messaggioRecupero}
              </div>
            )}

            {erroreRecupero && (
              <div
                role="alert"
                style={{
                  marginTop: 16,
                  padding: 12,
                  border: '1px solid #fecaca',
                  borderRadius: 10,
                  background: '#fef2f2',
                  color: '#991b1b',
                }}
              >
                {erroreRecupero}
              </div>
            )}

            <button
              type="submit"
              disabled={invioRecupero}
              style={{
                ...buttonPrimary,
                width: '100%',
                minHeight: 56,
                marginTop: 18,
                padding: '13px 18px',
                borderRadius: 12,
                fontSize: 17,
                fontWeight: 800,
                opacity: invioRecupero ? 0.65 : 1,
              }}
            >
              {invioRecupero ? 'Invio in corso...' : 'Invia link di recupero'}
            </button>

            <button
              type="button"
              onClick={tornaAlLogin}
              style={{
                ...buttonSecondary,
                width: '100%',
                minHeight: 52,
                marginTop: 10,
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              Torna al login
            </button>
          </form>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              login()
            }}
          >
            <div style={{ display: 'grid', gap: 16 }}>
              <label style={{ display: 'grid', gap: 7, fontWeight: 700 }}>
                Email
                <input
                  type="email"
                  value={emailLogin}
                  onChange={(event) => setEmailLogin(event.target.value)}
                  autoComplete="email"
                  required
                  style={stileCampo}
                />
              </label>

              <label style={{ display: 'grid', gap: 7, fontWeight: 700 }}>
                Password
                <div style={{ position: 'relative' }}>
                  <input
                    type={mostraPassword ? 'text' : 'password'}
                    value={passwordLogin}
                    onChange={(event) => setPasswordLogin(event.target.value)}
                    autoComplete="current-password"
                    required
                    style={{ ...stileCampo, paddingRight: 62 }}
                  />
                  <button
                    type="button"
                    onClick={() => setMostraPassword(!mostraPassword)}
                    aria-label={mostraPassword ? 'Nascondi password' : 'Mostra password'}
                    style={{
                      position: 'absolute',
                      top: '50%',
                      right: 6,
                      width: 46,
                      height: 46,
                      transform: 'translateY(-50%)',
                      border: 0,
                      borderRadius: 10,
                      background: 'transparent',
                      color: '#475569',
                      fontSize: 20,
                      cursor: 'pointer',
                    }}
                  >
                    {mostraPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </label>
            </div>

            <button
              type="button"
              onClick={apriRecuperoPassword}
              style={{
                display: 'block',
                margin: '12px 0 0 auto',
                padding: '8px 2px',
                border: 0,
                background: 'transparent',
                color: '#2563eb',
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Password dimenticata?
            </button>

            <button
              type="submit"
              style={{
                ...buttonPrimary,
                width: '100%',
                minHeight: 56,
                marginTop: 12,
                padding: '13px 18px',
                borderRadius: 12,
                fontSize: 17,
                fontWeight: 800,
              }}
            >
              Accedi
            </button>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                margin: '18px 0',
                color: '#94a3b8',
                fontSize: 13,
              }}
            >
              <span style={{ height: 1, flex: 1, background: '#e2e8f0' }} />
              oppure
              <span style={{ height: 1, flex: 1, background: '#e2e8f0' }} />
            </div>

            <button
              type="button"
              onClick={registrati}
              style={{
                ...buttonSecondary,
                width: '100%',
                minHeight: 54,
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 700,
              }}
            >
              Registrati
            </button>
          </form>
        )}
      </section>
    </main>
  )
}
