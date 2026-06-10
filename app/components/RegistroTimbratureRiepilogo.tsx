'use client'

type Props = {
  timbratureFiltrateRegistro: any[]
  calcolaOre: (t: any) => number
  calcolaCostoTimbratura: (t: any) => number
  formatMoney: (v: any) => string
}

export default function RegistroTimbratureRiepilogo({
  timbratureFiltrateRegistro,
  calcolaOre,
  calcolaCostoTimbratura,
  formatMoney,
}: Props) {
  const nomiOperai = [
    ...new Set(
      timbratureFiltrateRegistro
        .map((t) => t.operaio_nome)
        .filter(Boolean)
    ),
  ]

  return (
    <div
      style={{
        marginTop: 15,
        padding: 12,
        border: '1px solid #d1d5db',
        borderRadius: 10,
        background: '#fff',
      }}
    >
      <strong>📊 Riepilogo filtro</strong>

      <div style={{ marginTop: 8 }}>
        Timbrature: {timbratureFiltrateRegistro.length}
        <br />
        Operai coinvolti: {nomiOperai.length}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 10,
          marginTop: 12,
        }}
      >
        {nomiOperai.map((nome) => {
          const righeOperaio = timbratureFiltrateRegistro.filter(
            (t) => t.operaio_nome === nome
          )

          const oreTotaliOperaio = righeOperaio.reduce(
            (tot, t) => tot + calcolaOre(t),
            0
          )

          const costoTotaleOperaio = righeOperaio.reduce(
            (tot, t) => tot + calcolaCostoTimbratura(t),
            0
          )

          return (
            <div
              key={nome}
              style={{
                padding: 10,
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                background: '#f8fafc',
              }}
            >
              <strong>👷 {nome}</strong>
              <br />
              Ore: {oreTotaliOperaio.toFixed(2)} h
              <br />
              Costo: {formatMoney(costoTotaleOperaio)}
              <br />
              Presenze: {righeOperaio.length}
            </div>
          )
        })}
      </div>
    </div>
  )
}