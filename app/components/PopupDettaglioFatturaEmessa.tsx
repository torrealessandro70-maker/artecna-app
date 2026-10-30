'use client'

import { useRef, useState, type CSSProperties } from 'react'
import { uuid, statoCantiereAttribuzioni } from '../engines/contabilita-ditta/attribuzioni'
import { numeroDichiarato, opzioniCantieri, preparaModifiche, type AggiornaFattura, type EsitoModifica, type ModificheFattura, type StatoCantieri } from '../engines/contabilita-ditta/modificaFattura'

type Props = {
  fatturaEmessaAperta: any
  setFatturaEmessaAperta: (v: any) => void

  cantieri: any[]
  statoCantieri: StatoCantieri
  formatMoney: (v: any) => string

  aggiornaFatturaEmessa: AggiornaFattura
  eliminaFatturaEmessa: () => void | Promise<void>

  inputStyle: CSSProperties
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
}

export default function PopupDettaglioFatturaEmessa({
  fatturaEmessaAperta,
  setFatturaEmessaAperta,
  cantieri,
  statoCantieri,
  formatMoney,
  aggiornaFatturaEmessa,
  eliminaFatturaEmessa,
  inputStyle,
  buttonPrimary,
  buttonSecondary,
}: Props) {
  const [scelta, setScelta] = useState<string | undefined>()
  const [importo, setImporto] = useState<string | undefined>()
  const [attesa, setAttesa] = useState(false)
  const invio = useRef(false)
  const [esito, setEsito] = useState<EsitoModifica | null>(null)
  const [avviso, setAvviso] = useState('')
  const [daVerificare, setDaVerificare] = useState<ModificheFattura | null>(null)
  const opzioni = opzioniCantieri(cantieri)
  const contesto = statoCantiereAttribuzioni(fatturaEmessaAperta.cantiere_id)
  const valoreCantiere = scelta ?? (contesto === 'presente' ? fatturaEmessaAperta.cantiere_id : contesto === 'assente' ? '' : '__ignoto__')
  const confermato = esito?.tipo === 'confermato'
  const bloccato = attesa || confermato || daVerificare !== null
  const incassatoDisponibile = numeroDichiarato(fatturaEmessaAperta.importo_incassato) !== null
  const salva = async (recupero = false) => {
    if (invio.current || confermato || (!recupero && daVerificare)) return
    let patch: ModificheFattura
    try {
      patch = recupero && daVerificare ? daVerificare : preparaModifiche(fatturaEmessaAperta, scelta, importo, opzioni, statoCantieri)
      if (!Object.keys(patch).length) { setAvviso('Nessuna modifica da salvare. Nessuna scrittura eseguita.'); return }
    } catch (e) { setAvviso(e instanceof Error ? e.message : 'Dati non validi.'); return }
    invio.current = true; setAttesa(true); setAvviso('')
    try {
      const r = await aggiornaFatturaEmessa(fatturaEmessaAperta.id, patch, recupero)
      setEsito(r)
      if (r.tipo === 'non_confermato' || (recupero && r.tipo === 'errore_server')) setDaVerificare(patch)
      else setDaVerificare(null)
    } catch {
      setEsito({ tipo: 'non_confermato', messaggio: 'Esito non confermato: verifica tramite rilettura, senza ripetere la scrittura.' }); setDaVerificare(patch)
    } finally { invio.current = false; setAttesa(false) }
  }
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Dettaglio fattura emessa"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: 20,
          width: '100%',
          maxWidth: 750,
          maxHeight: '85vh',
          overflow: 'auto',
        }}
      >
        <h3>🧾 Dettaglio fattura emessa</h3>

        <p>
          <strong>Numero:</strong> {fatturaEmessaAperta.numero_fattura}
        </p>

        <p>
          <strong>Data:</strong> {fatturaEmessaAperta.data_fattura}
        </p>

        <p>
          <strong>Cliente:</strong> {fatturaEmessaAperta.cliente}
        </p>

        <div style={{ marginTop: 10 }}>
          <strong>Cantiere collegato</strong>

          <select
            aria-label="Cantiere collegato"
            value={valoreCantiere}
            disabled={bloccato || statoCantieri !== 'pronto' || contesto === 'ignoto'}
            onChange={e => { setScelta(e.target.value); setAvviso(''); setEsito(null) }}
            style={{
              ...inputStyle,
              marginTop: 6,
              width: '100%',
            }}
          >
            <option value="">Nessun cantiere collegato</option>
            {contesto === 'ignoto' && <option value="__ignoto__">Associazione non disponibile — dato ignoto</option>}
            {uuid(valoreCantiere) && !opzioni.some(c => c.id === valoreCantiere) && <option value={valoreCantiere}>Cantiere non disponibile nell’elenco — {valoreCantiere}</option>}
            {opzioni.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id.slice(-8)} — {c.nome || 'Cantiere senza nome'} — {c.id}
              </option>
            ))}
          </select>
          {statoCantieri === 'caricamento' && <p role="status">Caricamento Cantieri: associazione conservata.</p>}
          {statoCantieri === 'errore' && <p role="alert">Elenco Cantieri non disponibile: associazione conservata. Ricaricare i dati prima di cambiarla.</p>}
          {contesto === 'ignoto' && <p>Identificativo Cantiere non disponibile: non viene interpretato come assenza. Ricaricare la fattura.</p>}
          {uuid(valoreCantiere) && <p style={{ overflowWrap: 'anywhere' }}>UUID selezionato: {valoreCantiere}</p>}
          {typeof fatturaEmessaAperta.cantiere === 'string' && fatturaEmessaAperta.cantiere && <p>Descrizione registrata: {confermato ? String(esito.riga.cantiere ?? '') : fatturaEmessaAperta.cantiere}{contesto === 'assente' && !confermato ? ' — testo storico, senza associazione UUID.' : ''}</p>}
        </div>

        <p>
          <strong>Imponibile:</strong>{' '}
          {formatMoney(Number(fatturaEmessaAperta.imponibile || 0))}
        </p>

        <p>
          <strong>IVA:</strong>{' '}
          {formatMoney(Number(fatturaEmessaAperta.iva || 0))}
        </p>

        <p>
          <strong>Totale:</strong>{' '}
          {formatMoney(Number(fatturaEmessaAperta.totale || 0))}
        </p>

        <div style={{ marginTop: 10 }}>
          <strong>Importo incassato</strong>

          <input
            aria-label="Importo incassato"
            type="number"
            step="0.01"
            disabled={bloccato}
            value={importo ?? (incassatoDisponibile ? String(fatturaEmessaAperta.importo_incassato) : '')}
            onChange={e => { setImporto(e.target.value); setAvviso(''); setEsito(null) }}
            style={{
              ...inputStyle,
              marginTop: 6,
              width: '100%',
            }}
          />
          {!incassatoDisponibile && <p>Importo dichiarato mancante o non valido: conservato se non modificato; nessuno zero sostitutivo.</p>}
        </div>

        <p>
          <strong>Stato:</strong> {confermato ? String(esito.riga.stato ?? '') : fatturaEmessaAperta.stato}
        </p>

        {fatturaEmessaAperta.note && (
          <div style={{ marginTop: 12 }}>
            <strong>Note</strong>

            <div
              style={{
                marginTop: 6,
                padding: 10,
                border: '1px solid #ddd',
                borderRadius: 8,
                background: '#f8fafc',
                whiteSpace: 'pre-wrap',
              }}
            >
              {fatturaEmessaAperta.note}
            </div>
          </div>
        )}

        {fatturaEmessaAperta.xml_url && (
          <div style={{ marginTop: 12 }}>
            <a
              href={fatturaEmessaAperta.xml_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...buttonSecondary,
                display: 'inline-block',
                textDecoration: 'none',
              }}
            >
              📄 Apri XML
            </a>
          </div>
        )}

        {fatturaEmessaAperta.pdf_url && (
          <div style={{ marginTop: 12 }}>
            <a
              href={fatturaEmessaAperta.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...buttonPrimary,
                display: 'inline-block',
                textDecoration: 'none',
              }}
            >
              📕 Apri PDF fattura
            </a>
          </div>
        )}

        {attesa && <p role="status">{daVerificare ? 'Rilettura di verifica in corso…' : 'Salvataggio in corso…'}</p>}
        {avviso && <p role="status">{avviso}</p>}
        {esito && (esito.tipo === 'confermato'
          ? <p role="status">Modifiche salvate e confermate.{esito.elencoAggiornato === false ? ' Aggiornamento dell’elenco non riuscito: il salvataggio resta confermato. Aggiorna le letture senza ripetere la scrittura.' : ''}</p>
          : <p role="alert">{esito.messaggio}</p>)}
        {daVerificare && <button disabled={attesa} onClick={() => void salva(true)} style={buttonSecondary}>Verifica esito con rilettura</button>}
        <div
          style={{
            display: 'flex',
            gap: 10,
            marginTop: 16,
          }}
        >
          <button disabled={bloccato} onClick={() => void salva()} style={buttonPrimary}>
            💾 Salva modifiche
          </button>

          <button
            disabled={attesa || daVerificare !== null}
            onClick={eliminaFatturaEmessa}
            style={{
              ...buttonSecondary,
              backgroundColor: '#dc2626',
              color: '#fff',
            }}
          >
            🗑 Elimina
          </button>

          <button
            disabled={attesa}
            onClick={() => setFatturaEmessaAperta(null)}
            style={buttonSecondary}
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  )
}
