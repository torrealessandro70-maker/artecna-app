'use client'

import React from 'react'

export default function FascicoloCockpit() {
  return (
    <div style={{ padding: 20, fontFamily: 'system-ui' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0 }}>🏗 Villa Scirè</h1>
        <div style={{ color: '#64748b' }}>
          Sabato 27 giugno • 07:15
        </div>
      </div>

      {/* Stato */}
      <div
        style={{
          padding: 16,
          borderRadius: 12,
          background: '#f0fdf4',
          border: '1px solid #22c55e',
          marginBottom: 16,
        }}
      >
        <h2 style={{ marginTop: 0 }}>🟢 PUOI INIZIARE</h2>

        <p>
          Il cantiere è pronto.
          <br />
          Puoi iniziare il cartongesso.
          <br />
          Manca solo la documentazione iniziale della cucina.
        </p>

        <button
          style={{
            padding: '10px 16px',
            borderRadius: 8,
            border: 'none',
            background: '#16a34a',
            color: 'white',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          📷 Apri Fotocamera
        </button>
      </div>

      {/* Focus */}
      <div style={{ marginBottom: 16 }}>
        <h3>🎯 Focus</h3>
        <p>Cartongesso piano terra</p>
      </div>

      {/* Attenzione */}
      <div style={{ marginBottom: 16 }}>
        <h3>⚠ Attenzione</h3>

        <ul>
          <li>Foto cucina</li>
          <li>Variante bagno</li>
          <li>Firma cliente</li>
        </ul>
      </div>

      {/* Suggerimenti */}
      <div style={{ marginBottom: 16 }}>
        <h3>🤖 ARTECNA suggerisce</h3>

        <p>
          Completa subito la documentazione iniziale.
        </p>
      </div>

      {/* Oggi */}
      <div style={{ marginBottom: 16 }}>
        <h3>📖 Oggi</h3>

        <div>07:05 Materiale consegnato</div>
        <div>07:18 Operai arrivati</div>
        <div>07:22 Lavorazione iniziata</div>
      </div>

      {/* Prossima azione */}
      <div
        style={{
          padding: 12,
          borderRadius: 10,
          background: '#eff6ff',
          border: '1px solid #3b82f6',
        }}
      >
        <strong>▶ Prossima azione</strong>

        <div>Scatta foto cucina</div>
      </div>
    </div>
  )
}