'use client'

import type { CSSProperties } from 'react'

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
  return (
    <div style={{ padding: 40 }}>
      <h1>ARTECNA</h1>
      <h2>Login</h2>

      <input
        style={inputStyle}
        placeholder="Email"
        value={emailLogin}
        onChange={(e) => setEmailLogin(e.target.value)}
      />

      <div style={{ position: 'relative' }}>
        <input
          style={inputStyle}
          type={mostraPassword ? 'text' : 'password'}
          placeholder="Password"
          value={passwordLogin}
          onChange={(e) => setPasswordLogin(e.target.value)}
        />

        <span
          onClick={() => setMostraPassword(!mostraPassword)}
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            cursor: 'pointer',
            fontSize: 14,
            color: '#64748b',
          }}
        >
          {mostraPassword ? '🙈' : '👁️'}
        </span>
      </div>

      <button style={buttonPrimary} onClick={login}>
        Accedi
      </button>

      <button style={{ ...buttonSecondary, marginLeft: 10 }} onClick={registrati}>
        Registrati
      </button>
    </div>
  )
}