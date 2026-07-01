'use client'

type Props = {
  cliente?: string
  telefono?: string
  indirizzo?: string
  dataSopralluogo?: string
  oraAppuntamento?: string
  tipoLavoro?: string
  note?: string
}

export default function SopralluogoQuickActionBar({
  cliente,
  telefono,
  indirizzo,
  dataSopralluogo,
  oraAppuntamento,
  tipoLavoro,
  note,
}: Props) {
  const telefonoPulito = telefono || ''
  const indirizzoPulito = indirizzo || ''

  const calendarUrl = dataSopralluogo
    ? `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
        `Sopralluogo - ${cliente || 'Cliente'}`
      )}&dates=${String(dataSopralluogo).replace(/-/g, '')}T${String(
        oraAppuntamento || '09:00'
      )
        .slice(0, 5)
        .replace(':', '')}00/${String(dataSopralluogo).replace(/-/g, '')}T${String(
        oraAppuntamento || '10:00'
      )
        .slice(0, 5)
        .replace(':', '')}00&details=${encodeURIComponent(
        `Cliente: ${cliente || ''}\nTelefono: ${telefono || ''}\nTipo lavoro: ${
          tipoLavoro || ''
        }\nNote: ${note || ''}`
      )}&location=${encodeURIComponent(indirizzo || '')}`
    : '#'

  const actionStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minHeight: 72,
    padding: '14px 16px',
    border: '1px solid #e2e8f0',
    borderRadius: 14,
    background: '#ffffff',
    textDecoration: 'none',
    color: '#0f172a',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)',
  }

  const iconStyle: React.CSSProperties = {
    width: 42,
    height: 42,
    borderRadius: 999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    background: '#eff6ff',
  }

  const titleStyle: React.CSSProperties = {
    fontWeight: 800,
    fontSize: 15,
  }

  const subtitleStyle: React.CSSProperties = {
    color: '#475569',
    fontSize: 13,
    marginTop: 3,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 180,
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
        gap: 12,
        marginBottom: 20,
      }}
    >
      <a
        href={telefonoPulito ? `tel:${telefonoPulito}` : '#'}
        onClick={(e) => {
          if (!telefonoPulito) {
            e.preventDefault()
            alert('Telefono non presente nel sopralluogo')
          }
        }}
        style={actionStyle}
      >
        <div style={{ ...iconStyle, background: '#dcfce7' }}>📞</div>
        <div>
          <div style={titleStyle}>Chiama</div>
          <div style={subtitleStyle}>{telefonoPulito || 'Telefono mancante'}</div>
        </div>
      </a>

      <a
        href={telefonoPulito ? `https://wa.me/${telefonoPulito.replace(/\D/g, '')}` : '#'}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          if (!telefonoPulito) {
            e.preventDefault()
            alert('Telefono non presente nel sopralluogo')
          }
        }}
        style={actionStyle}
      >
        <div style={{ ...iconStyle, background: '#dcfce7' }}>💬</div>
        <div>
          <div style={titleStyle}>WhatsApp</div>
          <div style={subtitleStyle}>Messaggio</div>
        </div>
      </a>

      <a
        href={
          indirizzoPulito
            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                indirizzoPulito
              )}`
            : '#'
        }
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          if (!indirizzoPulito) {
            e.preventDefault()
            alert('Indirizzo non presente nel sopralluogo')
          }
        }}
        style={actionStyle}
      >
        <div style={iconStyle}>🗺️</div>
        <div>
          <div style={titleStyle}>Apri mappa</div>
          <div style={subtitleStyle}>{indirizzoPulito || 'Indirizzo mancante'}</div>
        </div>
      </a>

      <a
        href={calendarUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          if (!dataSopralluogo) {
            e.preventDefault()
            alert('Data sopralluogo non presente')
          }
        }}
        style={actionStyle}
      >
        <div style={{ ...iconStyle, background: '#f3e8ff' }}>📅</div>
        <div>
          <div style={titleStyle}>Crea evento</div>
          <div style={subtitleStyle}>Aggiungi al calendario</div>
        </div>
      </a>

      <button
        type="button"
        onClick={() => alert('Promemoria: funzione in arrivo')}
        style={{
          ...actionStyle,
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ ...iconStyle, background: '#ffedd5' }}>🔔</div>
        <div>
          <div style={titleStyle}>Promemoria</div>
          <div style={subtitleStyle}>Imposta promemoria</div>
        </div>
      </button>

      <a
        href={
          indirizzoPulito
            ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                indirizzoPulito
              )}`
            : '#'
        }
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          if (!indirizzoPulito) {
            e.preventDefault()
            alert('Indirizzo non presente nel sopralluogo')
          }
        }}
        style={actionStyle}
      >
        <div style={iconStyle}>🧭</div>
        <div>
          <div style={titleStyle}>Naviga</div>
          <div style={subtitleStyle}>Indicazioni stradali</div>
        </div>
      </a>
    </div>
  )
}