'use client'

import type { CSSProperties } from 'react'

type Props = {
  cardStyle: CSSProperties
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
  excelTable: CSSProperties
  excelTh: CSSProperties
  excelTd: CSSProperties

  formatMoney: (v: number) => string
  calcolaOreNumero: (entrata: string, uscita: string) => number
  totaleOreOperaio: (nome: string) => number
  calcolaCostoTimbratura: (t: any) => number
  parseOra: (ora: string) => number | null

  totaleMaturatoOperai: number
  totalePagatoOperai: number
  residuoPagamentiOperai: number
  scadenzaPagamentiOperai: string
  statoScadenzaPagamenti: string
 giorniAllaScadenzaPagamenti: number | null

  costoOperaiPerCantiere: Record<string, number>
  situazioneCantieri: any[]
  cantieri: any[]
  timbrature: any[]
  operaiAnagrafica: any[]
  pagamentiOperai: any[]

  mostraValutazioneFondi: boolean
  setMostraValutazioneFondi: (v: boolean) => void
  mostraCostiPresenze: boolean
  setMostraCostiPresenze: (v: boolean) => void
  mostraRiepilogoOperai: boolean
  setMostraRiepilogoOperai: (v: boolean) => void

  pagamentiDataDa: string
  setPagamentiDataDa: (v: string) => void
  pagamentiDataA: string
  setPagamentiDataA: (v: string) => void

  operaioPagamento: string
  setOperaioPagamento: (v: string) => void
  importoPagamento: string
  setImportoPagamento: (v: string) => void
  dataPagamento: string
  setDataPagamento: (v: string) => void
  metodoPagamento: string
  setMetodoPagamento: (v: string) => void
  notaPagamento: string
  setNotaPagamento: (v: string) => void

  salvaPagamentoOperaio: () => void | Promise<void>
  preparaPagamentoRapidoOperaio: (
    nome: string,
    importo: number,
    tipo: 'saldo' | 'acconto'
  ) => void
}

export default function PagamentiOperaiPanel({
  cardStyle,
  buttonPrimary,
  buttonSecondary,
  excelTable,
  excelTh,
  excelTd,

  formatMoney,
  calcolaOreNumero,
  totaleOreOperaio,
  calcolaCostoTimbratura,
  parseOra,

  totaleMaturatoOperai,
  totalePagatoOperai,
  residuoPagamentiOperai,
  scadenzaPagamentiOperai,
  statoScadenzaPagamenti,
  giorniAllaScadenzaPagamenti,

  costoOperaiPerCantiere,
  situazioneCantieri,
  cantieri,
  timbrature,
  operaiAnagrafica,
  pagamentiOperai,

  mostraValutazioneFondi,
  setMostraValutazioneFondi,
  mostraCostiPresenze,
  setMostraCostiPresenze,
  mostraRiepilogoOperai,
  setMostraRiepilogoOperai,

  pagamentiDataDa,
  setPagamentiDataDa,
  pagamentiDataA,
  setPagamentiDataA,

  operaioPagamento,
  setOperaioPagamento,
  importoPagamento,
  setImportoPagamento,
  dataPagamento,
  setDataPagamento,
  metodoPagamento,
  setMetodoPagamento,
  notaPagamento,
  setNotaPagamento,

  salvaPagamentoOperaio,
  preparaPagamentoRapidoOperaio,
}: Props) {
  return (
  <div style={cardStyle}>
    <h2>Pagamenti operai</h2>

    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 12,
        marginBottom: 20,
      }}
    >
      <div style={{ padding: 14, borderRadius: 10, background: '#fff', border: '1px solid #ddd' }}>
        <div style={{ color: '#666', marginBottom: 6 }}>Totale maturato</div>
        <strong style={{ fontSize: 20 }}>{formatMoney(totaleMaturatoOperai)}</strong>
      </div>

      <div style={{ padding: 14, borderRadius: 10, background: '#fff', border: '1px solid #ddd' }}>
        <div style={{ color: '#666', marginBottom: 6 }}>Totale pagato</div>
        <strong style={{ fontSize: 20, color: 'green' }}>{formatMoney(totalePagatoOperai)}</strong>
      </div>

      <div
        style={{
          padding: 14,
          borderRadius: 10,
          background: residuoPagamentiOperai > 0 ? '#fef2f2' : '#f0fdf4',
          border: '1px solid #ddd',
        }}
      >
        <div style={{ color: '#666', marginBottom: 6 }}>Residuo da pagare</div>
        <strong style={{ fontSize: 20, color: residuoPagamentiOperai > 0 ? 'red' : 'green' }}>
          {formatMoney(residuoPagamentiOperai)}
        </strong>
      </div>

      <div
        style={{
          padding: 14,
          borderRadius: 10,
          background:
            statoScadenzaPagamenti === 'scaduto'
              ? '#fee2e2'
              : statoScadenzaPagamenti === 'attenzione'
              ? '#fef3c7'
              : '#f0fdf4',
          border: '1px solid #ddd',
        }}
      >
        <div style={{ color: '#666', marginBottom: 6 }}>Prossima scadenza</div>
        <strong style={{ fontSize: 18 }}>{scadenzaPagamentiOperai || '-'}</strong>

        <div style={{ marginTop: 6 }}>
          {statoScadenzaPagamenti === 'scaduto' && '🚨 Scaduta'}
          {statoScadenzaPagamenti === 'attenzione' &&
            `⚠️ Mancano ${giorniAllaScadenzaPagamenti} giorni`}
          {statoScadenzaPagamenti === 'ok' &&
            `✅ Mancano ${giorniAllaScadenzaPagamenti} giorni`}
        </div>
      </div>
    </div>

    <h3 style={{ marginTop: 25 }}>Ripartizione costi operai per cantiere</h3>

    {Object.keys(costoOperaiPerCantiere).length === 0 ? (
      <p>Nessun costo presente.</p>
    ) : (
      <div style={{ display: 'grid', gap: 10 }}>
        {Object.entries(costoOperaiPerCantiere).map(([cantiere, totale]) => (
          <div
            key={cantiere}
            style={{
              padding: 14,
              borderRadius: 10,
              background: '#fff',
              border: '1px solid #ddd',
            }}
          >
            <strong>{String(cantiere)}</strong>

            <div style={{ marginTop: 6 }}>Costo operai maturato:</div>

            <strong style={{ fontSize: 20, color: '#dc2626' }}>
              {formatMoney(Number(totale || 0))}
            </strong>
          </div>
        ))}
      </div>
    )}

    <div
      style={{
        marginTop: 30,
        marginBottom: 12,
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}
    >
      <button
        onClick={() => setMostraValutazioneFondi(!mostraValutazioneFondi)}
        style={buttonSecondary}
      >
        {mostraValutazioneFondi
          ? 'Nascondi valutazione fondi'
          : 'Mostra valutazione fondi'}
      </button>

      <button
        onClick={() => setMostraCostiPresenze(!mostraCostiPresenze)}
        style={buttonSecondary}
      >
        📊 Costi e presenze
      </button>
    </div>

    {mostraCostiPresenze && (
      <div
        style={{
          marginTop: 15,
          padding: 15,
          border: '1px solid #cbd5e1',
          borderRadius: 10,
          background: '#f8fafc',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 15,
          }}
        >
          <h3 style={{ margin: 0 }}>📊 Costi e presenze operai</h3>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <div style={cardStyle}>
            <strong>Ore totali registrate</strong>

            <div style={{ fontSize: 24, marginTop: 8 }}>
              {timbrature
                .reduce(
                  (tot, t) =>
                    tot + calcolaOreNumero(t.ora_entrata, t.ora_uscita),
                  0
                )
                .toFixed(1)}{' '}
              h
            </div>
          </div>

          <div style={cardStyle}>
            <strong>Costo totale manodopera</strong>

            <div style={{ fontSize: 24, marginTop: 8 }}>
              {formatMoney(
                operaiAnagrafica.reduce(
                  (tot, o) =>
                    tot +
                    totaleOreOperaio(o.nome) * Number(o.costo_orario || 0),
                  0
                )
              )}
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={excelTable}>
            <thead>
              <tr>
                <th style={excelTh}>Operaio</th>
                <th style={excelTh}>Ore totali</th>
                <th style={excelTh}>Costo orario</th>
                <th style={excelTh}>Costo totale</th>
                <th style={excelTh}>Pagato</th>
                <th style={excelTh}>Residuo</th>
              </tr>
            </thead>

            <tbody>
              {operaiAnagrafica.map((o, i) => {
                const ore = totaleOreOperaio(o.nome)
                const costoOrario = Number(o.costo_orario || 0)
                const totale = ore * costoOrario

                const pagato = pagamentiOperai
                  .filter((p) => p.operaio_nome === o.nome)
                  .reduce((tot, p) => tot + Number(p.importo || 0), 0)

                const residuo = totale - pagato

                return (
                  <tr key={o.id || i}>
                    <td style={excelTd}>{o.nome}</td>
                    <td style={excelTd}>{ore.toFixed(1)} h</td>
                    <td style={excelTd}>{formatMoney(costoOrario)}</td>
                    <td style={excelTd}>{formatMoney(totale)}</td>
                    <td style={excelTd}>{formatMoney(pagato)}</td>
                    <td
                      style={{
                        ...excelTd,
                        fontWeight: 700,
                        color: residuo > 0 ? '#dc2626' : '#16a34a',
                      }}
                    >
                      {formatMoney(residuo)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )}

    {mostraValutazioneFondi && (
      <>
        {situazioneCantieri.length === 0 ? (
          <p>Nessun cantiere presente.</p>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {situazioneCantieri.map((c) => (
              <div
                key={c.nome}
                style={{
                  padding: 14,
                  borderRadius: 10,
                  background:
                    c.stato === 'critico'
                      ? '#fee2e2'
                      : c.stato === 'attenzione'
                      ? '#fef3c7'
                      : '#f0fdf4',
                  border:
                    c.stato === 'critico'
                      ? '2px solid #dc2626'
                      : c.stato === 'attenzione'
                      ? '2px solid #f59e0b'
                      : '1px solid #bbf7d0',
                }}
              >
                <strong>{c.nome}</strong>

                <div style={{ marginTop: 8 }}>
                  Acconti ricevuti: <strong>{formatMoney(c.acconti)}</strong>
                </div>

                <div>
                  Operai maturati: <strong>{formatMoney(c.costoOperai)}</strong>
                </div>

                <div>
                  Materiali: <strong>{formatMoney(c.costoMateriali)}</strong>
                </div>

                <div>
                  Attrezzi/noli: <strong>{formatMoney(c.costoAttrezzi)}</strong>
                </div>

                <div style={{ marginTop: 8 }}>
                  Costi totali: <strong>{formatMoney(c.costiTotali)}</strong>
                </div>

                <div style={{ marginTop: 8 }}>
                  Saldo reale cantiere:{' '}
                  <strong style={{ color: c.saldo < 0 ? 'red' : 'green' }}>
                    {formatMoney(c.saldo)}
                  </strong>
                </div>

                <div style={{ marginTop: 8, fontWeight: 700 }}>
                  {c.stato === 'critico' &&
                    '🚨 Cantiere scoperto: attenzione ai pagamenti'}
                  {c.stato === 'attenzione' && '⚠️ Margine di sicurezza basso'}
                  {c.stato === 'ok' && '✅ Cantiere coperto'}
                </div>

                <div
                  style={{
                    marginTop: 12,
                    padding: 10,
                    borderRadius: 8,
                    background: '#ffffff',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  <strong>🧠 Stima costi mancanti</strong>

                  <div style={{ marginTop: 6 }}>
                    Preventivo: <strong>{formatMoney(c.preventivo)}</strong>
                  </div>

                  <div>
                    Materiali stimati:{' '}
                    <strong>{formatMoney(c.stimaMateriali)}</strong>
                  </div>

                  <div>
                    Manodopera stimata:{' '}
                    <strong>{formatMoney(c.stimaManodopera)}</strong>
                  </div>

                  <div>
                    Costi stimati totali:{' '}
                    <strong>{formatMoney(c.stimaCostiTotali)}</strong>
                  </div>

                  <div>
                    Costi ancora da prevedere:{' '}
                    <strong
                      style={{
                        color: c.differenzaCosti > 0 ? '#dc2626' : 'green',
                      }}
                    >
                      {formatMoney(c.differenzaCosti)}
                    </strong>
                  </div>

                  <div style={{ marginTop: 6 }}>
                    Utile stimato:{' '}
                    <strong style={{ color: c.utileStimato < 0 ? 'red' : 'green' }}>
                      {formatMoney(c.utileStimato)}
                    </strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    )}

    <div style={{ marginBottom: 14, marginTop: 25 }}>
      <h3 style={{ margin: 0 }}>Pagamenti operai</h3>
      <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>
        Registra acconti, saldi e movimenti pagati agli operai
      </p>
    </div>

    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 15 }}>
      <input
        type="date"
        value={pagamentiDataDa || ''}
        onChange={(e) => setPagamentiDataDa(e.target.value)}
        style={{ padding: 8 }}
      />

      <input
        type="date"
        value={pagamentiDataA || ''}
        onChange={(e) => setPagamentiDataA(e.target.value)}
        style={{ padding: 8 }}
      />
    </div>

    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 15 }}>
      <select
        value={operaioPagamento || ''}
        onChange={(e) => setOperaioPagamento(e.target.value)}
        style={{ padding: 8, width: 220 }}
      >
        <option value="">Seleziona operaio</option>
        {operaiAnagrafica.map((o, i) => (
          <option key={o.id || i} value={o.nome}>
            {o.nome}
          </option>
        ))}
      </select>

      <input
        placeholder="Importo €"
        value={importoPagamento || ''}
        onChange={(e) => setImportoPagamento(e.target.value)}
        style={{ padding: 8, width: 130 }}
      />

      <input
        type="date"
        value={dataPagamento || ''}
        onChange={(e) => setDataPagamento(e.target.value)}
        style={{ padding: 8 }}
      />

      <input
        placeholder="Metodo"
        value={metodoPagamento || ''}
        onChange={(e) => setMetodoPagamento(e.target.value)}
        style={{ padding: 8, width: 140 }}
      />

      <input
        placeholder="Nota"
        value={notaPagamento || ''}
        onChange={(e) => setNotaPagamento(e.target.value)}
        style={{ padding: 8, width: 220 }}
      />

      <button onClick={salvaPagamentoOperaio} style={buttonPrimary}>
        Salva pagamento
      </button>
    </div>

    <div
      style={{
        marginTop: 20,
        marginBottom: 12,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
      }}
    >
      <h3 style={{ margin: 0 }}>Prepara un pagamento</h3>


      <button
        onClick={() => setMostraRiepilogoOperai(!mostraRiepilogoOperai)}
        style={buttonSecondary}
      >
        {mostraRiepilogoOperai ? 'Nascondi riepilogo' : 'Mostra riepilogo'}
      </button>
    </div>

    {mostraRiepilogoOperai && (
      <div style={{ display: 'grid', gap: 10 }}>
        {operaiAnagrafica.map((o, i) => {
          const timbratureOperaioPeriodo = timbrature.filter((t) => {
            if (t.operaio_nome !== o.nome) return false
            if (pagamentiDataDa && t.data < pagamentiDataDa) return false
            if (pagamentiDataA && t.data > pagamentiDataA) return false
            return true
          })

          const costoMaturato = timbratureOperaioPeriodo.reduce(
            (tot, t) => tot + calcolaCostoTimbratura(t),
            0
          )

          const totaleOrePeriodo = timbratureOperaioPeriodo.reduce((tot, t) => {
            const entrata = parseOra(t.ora_entrata)
            const uscita = parseOra(t.ora_uscita)

            if (entrata === null || uscita === null || uscita < entrata) return tot

            return tot + (uscita - entrata) / 60
          }, 0)

          const pagamentiOperaioPeriodo = pagamentiOperai.filter((p) => {
            if (p.operaio_nome !== o.nome) return false
            if (pagamentiDataDa && (p.data_pagamento || '') < pagamentiDataDa)
              return false
            if (pagamentiDataA && (p.data_pagamento || '') > pagamentiDataA)
              return false
            return true
          })

          const pagato = pagamentiOperaioPeriodo.reduce(
            (tot, p) => tot + Number(p.importo || 0),
            0
          )

          const residuo = costoMaturato - pagato

          return (
            <div
              key={o.id || i}
              style={{
                padding: 12,
                border: '1px solid #ddd',
                borderRadius: 8,
                background: '#fff',
              }}
            >
              <strong>{o.nome}</strong>
              <br />
              Ore lavorate: {totaleOrePeriodo.toFixed(2)}
              <br />
              Costo maturato: {formatMoney(costoMaturato)}
              <br />
              Pagato: {formatMoney(pagato)}
              <br />
              <strong style={{ color: residuo > 0 ? 'red' : 'green' }}>
                Residuo: {formatMoney(residuo)}
              </strong>

              <div
                style={{
                  marginTop: 10,
                  display: 'flex',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                <button
                  onClick={() =>
                    preparaPagamentoRapidoOperaio(
                      o.nome,
                      Math.max(residuo, 0),
                      'saldo'
                    )
                  }
                  disabled={residuo <= 0}
                  style={{
                    ...buttonPrimary,
                    opacity: residuo <= 0 ? 0.55 : 1,
                    cursor: residuo <= 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  💳 Prepara saldo
                </button>

                <button
                  onClick={() =>
                    preparaPagamentoRapidoOperaio(o.nome, 0, 'acconto')
                  }
                  style={buttonSecondary}
                >
                  ➕ Prepara acconto
                </button>
              </div>

              <div style={{ marginTop: 10 }}>
                <strong>Costi maturati per cantiere:</strong>

                {cantieri.map((c) => {
                  const timbratureOperaioCantiere =
                    timbratureOperaioPeriodo.filter((t) => t.cantiere === c.nome)

                  const costoCantiere = timbratureOperaioCantiere.reduce(
                    (tot, t) => tot + calcolaCostoTimbratura(t),
                    0
                  )

                  const oreCantiere = timbratureOperaioCantiere.reduce(
                    (tot, t) => {
                      const entrata = parseOra(t.ora_entrata)
                      const uscita = parseOra(t.ora_uscita)

                      if (
                        entrata === null ||
                        uscita === null ||
                        uscita < entrata
                      )
                        return tot

                      return tot + (uscita - entrata) / 60
                    },
                    0
                  )

                  if (costoCantiere <= 0) return null

                  return (
                    <div
                      key={c.nome}
                      style={{
                        marginTop: 6,
                        padding: 8,
                        border: '1px solid #e5e7eb',
                        borderRadius: 8,
                        background: '#f8fafc',
                      }}
                    >
                      <strong>{c.nome}</strong>
                      <br />
                      Ore: {oreCantiere.toFixed(2)}
                      <br />
                      Costo maturato: {formatMoney(costoCantiere)}
                    </div>
                  )
                })}
              </div>

              <div style={{ marginTop: 10 }}>
                <strong>Storico pagamenti:</strong>

                {pagamentiOperaioPeriodo.length === 0 ? (
                  <div style={{ color: '#666', marginTop: 4 }}>
                    Nessun pagamento registrato
                  </div>
                ) : (
                  <ul style={{ marginTop: 6 }}>
                    {pagamentiOperaioPeriodo.map((p, idx) => (
                      <li key={p.id || idx}>
                        {p.data_pagamento || '-'} —{' '}
                        {formatMoney(Number(p.importo || 0))}
                        {p.metodo ? ` — ${p.metodo}` : ''}
                        {p.nota ? ` — ${p.nota}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )}
  </div>
  )
}
