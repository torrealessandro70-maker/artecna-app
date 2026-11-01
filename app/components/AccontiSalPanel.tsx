'use client'

import type { CSSProperties } from 'react'
import { accontiCaricati, messaggioAcconti, type StatoAcconti } from '../engines/economia/accontiCantiere'

type Props = {
  totaleAccontiCantiere: number | null
  residuoDaIncassare: number | null
  statoAcconti: StatoAcconti
  authDisponibile: boolean
  mostraAcconti: boolean
  buttonSecondary: CSSProperties
  formatMoney: (value: number) => string
  onGestisci: () => void | Promise<void>
}

export default function AccontiSalPanel({
  totaleAccontiCantiere,
  residuoDaIncassare,
  statoAcconti,
  authDisponibile,
  mostraAcconti,
  buttonSecondary,
  formatMoney,
  onGestisci,
}: Props) {
  return (
    <div style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
      <strong>Acconti ricevuti:</strong>{' '}
      {accontiCaricati(statoAcconti) && totaleAccontiCantiere !== null
        ? formatMoney(totaleAccontiCantiere)
        : <span role={statoAcconti === 'errore' ? 'alert' : 'status'}>{messaggioAcconti(statoAcconti)}</span>}

      <button
        type="button"
        aria-expanded={mostraAcconti && accontiCaricati(statoAcconti)}
        disabled={!authDisponibile || statoAcconti === 'caricamento'}
        onClick={onGestisci}
        style={{ ...buttonSecondary, marginLeft: 10 }}
      >
        {statoAcconti === 'errore' ? 'Ricarica acconti' : mostraAcconti && accontiCaricati(statoAcconti) ? 'Nascondi' : 'Gestisci acconti'}
      </button>

      {!authDisponibile && <p role="status">Lettura disponibile dopo la verifica della sessione.</p>}
      {residuoDaIncassare !== null && accontiCaricati(statoAcconti) && <div style={{ marginTop: 10 }}>
        <strong>Residuo da incassare:</strong>{' '}
        <span
          style={{
            color:
              residuoDaIncassare > 0
                ? 'red'
                : residuoDaIncassare === 0
                ? 'green'
                : '#f59e0b',
            fontWeight: 700,
          }}
        >
          {formatMoney(residuoDaIncassare)}
        </span>
      </div>}
    </div>
  )
}
