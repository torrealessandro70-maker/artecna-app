'use client'

type Props = {
  mostraFotoPreventivoSopralluogo: boolean
  sopralluogoAperto: any
  fotoSopralluoghi: any[]
}

export default function SopralluogoFotoPreventivo({
  mostraFotoPreventivoSopralluogo,
  sopralluogoAperto,
  fotoSopralluoghi,
}: Props) {
  if (!mostraFotoPreventivoSopralluogo) return null

  const fotoPreventivo = fotoSopralluoghi.filter(
    (f) =>
      f.sopralluogo_id === sopralluogoAperto?.id &&
      f.includi_preventivo
  )

  return (
    <div style={{ marginTop: 20 }}>
      <h4>🖼 Foto da usare nel preventivo</h4>

      {fotoPreventivo.length === 0 ? (
        <p>Nessuna foto selezionata per il preventivo</p>
      ) : (
        <div>
          {fotoPreventivo.map((foto, i) => (
            <div
              key={foto.id || i}
              style={{
                display: 'inline-block',
                width: 180,
                marginRight: 12,
                marginBottom: 12,
                border: '1px solid #ddd',
                borderRadius: 12,
                overflow: 'hidden',
                background: '#fff',
                verticalAlign: 'top',
              }}
            >
              <img
                src={foto.immagine_base64}
                alt="Foto preventivo"
                style={{
                  width: '100%',
                  height: 140,
                  objectFit: 'cover',
                }}
              />

              <div
                style={{
                  padding: 8,
                  fontSize: 12,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {foto.nota || 'Foto selezionata'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}