
import type { CSSProperties } from 'react'

import SalForm from './SalForm'
import PreventivoLavorazioniForm from './PreventivoLavorazioniForm'
import PreventiviCaricatiList from './PreventiviCaricatiList'
import ConfrontoPdfSalPanel from './ConfrontoPdfSalPanel'
import PulisciPreventivoSalButton from './PulisciPreventivoSalButton'
import SalSummaryCards from './SalSummaryCards'
import SalTable from './SalTable'

type Props = {
  cardStyle: CSSProperties
  cantieri: any[]
  salCantiere: string
  setSalCantiere: (v: string) => void

  salDescrizione: string
  setSalDescrizione: (v: string) => void
  salImportoPrevisto: string
  setSalImportoPrevisto: (v: string) => void
  salPercentuale: string
  setSalPercentuale: (v: string) => void
  salNote: string
  setSalNote: (v: string) => void

  salvaSalLavorazione: () => void | Promise<void>

  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties

  supabase: any

  caricaSalLavorazioni: () => Promise<void>
  caricaPreventivoLavorazioni: () => Promise<void>
  caricaEconomia: () => Promise<void>
  caricaCantieri: () => Promise<void>

  prevDescrizione: string
  setPrevDescrizione: (v: string) => void
  prevQuantita: string
  setPrevQuantita: (v: string) => void
  prevPrezzoUnitario: string
  setPrevPrezzoUnitario: (v: string) => void
  prevUnita: string
  setPrevUnita: (v: string) => void
  prevImporto: string
  setPrevImporto: (v: string) => void

  salvaLavorazionePreventivo: () => void | Promise<void>

  preventivi: any[]
  preventivoLavorazioni: any[]

  cantiereScheda: string

  formatMoney: (n: number) => string
  parseImporto: (v: any) => number
  analizzaRigheDocumento: (testo: string) => any[]

  mostraConfrontoPdfSal: boolean
  setMostraConfrontoPdfSal: (v: boolean) => void

 lavorazioneEditId: number | null
setLavorazioneEditId: (v: number | null) => void

  lavorazioneEditDescrizione: string
  setLavorazioneEditDescrizione: (v: string) => void

  lavorazioneEditImporto: string
  setLavorazioneEditImporto: (v: string) => void

  salLavorazioni: any[]
  accontiCantiere: any[]

  excelTable: CSSProperties
  excelTh: CSSProperties
  excelTd: CSSProperties

  eliminaSalLavorazione: (s: any) => void | Promise<void>
}

export default function SalDettagliatoPanel({
  cardStyle,
  cantieri,
  salCantiere,
  setSalCantiere,

  salDescrizione,
  setSalDescrizione,
  salImportoPrevisto,
  setSalImportoPrevisto,
  salPercentuale,
  setSalPercentuale,
  salNote,
  setSalNote,

  salvaSalLavorazione,

  buttonPrimary,
  buttonSecondary,

  supabase,

  caricaSalLavorazioni,
  caricaPreventivoLavorazioni,
  caricaEconomia,
  caricaCantieri,

  prevDescrizione,
  setPrevDescrizione,
  prevQuantita,
  setPrevQuantita,
  prevPrezzoUnitario,
  setPrevPrezzoUnitario,
  prevUnita,
  setPrevUnita,
  prevImporto,
  setPrevImporto,

  salvaLavorazionePreventivo,

  preventivi,
  preventivoLavorazioni,

  cantiereScheda,

  formatMoney,
  parseImporto,
  analizzaRigheDocumento,

  mostraConfrontoPdfSal,
  setMostraConfrontoPdfSal,

  lavorazioneEditId,
  setLavorazioneEditId,

  lavorazioneEditDescrizione,
  setLavorazioneEditDescrizione,

  lavorazioneEditImporto,
  setLavorazioneEditImporto,

  salLavorazioni,
  accontiCantiere,

  excelTable,
  excelTh,
  excelTd,

  eliminaSalLavorazione,
}: Props) {
  return (





<div style={cardStyle}>
  <h2>📊 SAL dettagliato</h2>

  <p style={{ color: '#64748b', marginTop: 0 }}>
    Gestisci lo stato avanzamento lavori per singola lavorazione.
  </p>

  <div
    style={{
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
      marginBottom: 18,
    }}
  >
    <select
      value={salCantiere}
      onChange={(e) => setSalCantiere(e.target.value)}
      style={{ padding: 8, width: 220 }}
    >
      <option value="">Seleziona cantiere</option>
      {cantieri.map((c, i) => (
        <option key={c.id || i} value={c.nome}>
          {c.nome}
        </option>
      ))}
    </select>

  <SalForm
  salDescrizione={salDescrizione}
  setSalDescrizione={setSalDescrizione}
  salImportoPrevisto={salImportoPrevisto}
  setSalImportoPrevisto={setSalImportoPrevisto}
  salPercentuale={salPercentuale}
  setSalPercentuale={setSalPercentuale}
  salNote={salNote}
  setSalNote={setSalNote}
  onSalva={salvaSalLavorazione}
  buttonPrimary={buttonPrimary}
/>

    <button
      onClick={async () => {
        if (!salCantiere) {
          alert('Seleziona prima un cantiere')
          return
        }

        const { data: righePreventivo, error: erroreCaricamento } =
          await supabase
            .from('preventivo_lavorazioni')
            .select('*')
            .eq('cantiere', salCantiere)

        if (erroreCaricamento) {
          alert(
            'Errore caricamento lavorazioni preventivo: ' +
              erroreCaricamento.message
          )
          return
        }

        if (!righePreventivo || righePreventivo.length === 0) {
          alert('Nessuna lavorazione preventivo trovata per questo cantiere')
          return
        }

        const lavorazioniDaInserire = righePreventivo.map((r: any) => ({
          cantiere: salCantiere,
          descrizione: r.descrizione,
          importo_previsto: Number(r.importo_previsto || 0),
          percentuale: 0,
          importo_maturato: 0,
          completata: false,
          note: 'Importata da preventivo',
          data_aggiornamento: new Date().toISOString().slice(0, 10),
        }))

        const { error } = await supabase
          .from('sal_lavorazioni')
          .insert(lavorazioniDaInserire)

        if (error) {
          alert('Errore importazione nel SAL: ' + error.message)
          return
        }

        await caricaSalLavorazioni()

        alert('Lavorazioni importate nel SAL')
      }}
      style={buttonSecondary}
    >
      Importa lavorazioni preventivo nel SAL
    </button>
  </div>

  <div
    style={{
      marginTop: 20,
      marginBottom: 20,
      padding: 14,
      border: '1px solid #ddd',
      borderRadius: 10,
      background: '#fff',
    }}
  >
    <h3 style={{ marginTop: 0 }}>📋 Lavorazioni preventivo</h3>

    <div
      style={{
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
      }}
    >
      <PreventivoLavorazioniForm
  prevDescrizione={prevDescrizione}
  setPrevDescrizione={setPrevDescrizione}
  prevQuantita={prevQuantita}
  setPrevQuantita={setPrevQuantita}
  prevPrezzoUnitario={prevPrezzoUnitario}
  setPrevPrezzoUnitario={setPrevPrezzoUnitario}
  prevUnita={prevUnita}
  setPrevUnita={setPrevUnita}
  prevImporto={prevImporto}
  setPrevImporto={setPrevImporto}
  onSalva={salvaLavorazionePreventivo}
  buttonPrimary={buttonPrimary}
/>

    </div>
  </div>
{salCantiere && (() => {
  const totalePreventiviPdf = preventivi
   .filter((p) => p.cantiere === cantiereScheda)
    .reduce((tot, p) => tot + Number(p.importo_totale || 0), 0)

  const totaleLavorazioniPreventivo = preventivoLavorazioni
    .filter((p) => p.cantiere === salCantiere)
    .reduce((tot, p) => tot + Number(p.importo_previsto || 0), 0)

  const differenza = totalePreventiviPdf - totaleLavorazioniPreventivo

  return (
    <div
      style={{
        marginTop: 15,
        padding: 12,
        border: '2px solid #0f172a',
        borderRadius: 8,
        background: '#f8fafc',
      }}
    >
      <strong>📊 Controllo importazione preventivo</strong>

      <div style={{ marginTop: 8 }}>
        Totale preventivi caricati: € {formatMoney(totalePreventiviPdf)}
      </div>

      <div>
        Totale lavorazioni preventivo/SAL: € {formatMoney(totaleLavorazioniPreventivo)}
      </div>




<div style={{ marginTop: 16 }}>
  <strong style={{ fontSize: 18 }}>
    📋 Lavorazioni preventivo caricate
  </strong>

  <div
  style={{
    marginTop: 12,
   background: '#fff',
    border: '1px solid #cbd5e1',
    borderRadius: 10,
    padding: 18,
boxShadow: '0 2px 10px rgba(0,0,0,0.08)',

    width: '100%',
    minWidth: 360,
    maxWidth: '100%',

    height: 520,
    minHeight: 260,
    maxHeight: '80vh',

    overflow: 'auto',
    resize: 'both',
  }}
>
    {preventivoLavorazioni.filter(
      (p) => p.cantiere === salCantiere
    ).length === 0 ? (
      <div
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: 20,
        }}
      >
        Nessuna lavorazione caricata.
      </div>
    ) : (
      preventivoLavorazioni
        .filter((p) => p.cantiere === salCantiere)
        .map((p, i) => (
          <div
            key={p.id || i}
            style={{
              background: '#fff',
              marginBottom: 18,
              padding: '22px 26px',
              borderRadius: 4,
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              border: '1px solid #e5e7eb',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 12,
                right: 12,
                display: 'flex',
                gap: 8,
              }}
            >
              <button
                onClick={async () => {
                  const conferma = confirm(
                    'Eliminare questa lavorazione?'
                  )

                  if (!conferma) return

                  const { error } = await supabase
                    .from('preventivo_lavorazioni')
                    .delete()
                    .eq('id', p.id)

                  if (error) {
                    alert(
                      'Errore eliminazione: ' + error.message
                    )
                    return
                  }

                  await caricaPreventivoLavorazioni()

                  alert('Lavorazione eliminata')
                }}
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '6px 10px',
                  cursor: 'pointer',
                }}
              >
                Elimina
              </button>
            </div>

            <div
              style={{
                fontSize: 13,
                color: '#64748b',
                marginBottom: 8,
              }}
            >
              Riga #{i + 1}
            </div>

            <div
              style={{
                fontSize: 20,
                fontWeight: 400,
                marginBottom: 10,
                lineHeight: 1.3,
              }}
            >
             {String(p.descrizione || '')
  .replace(/\s+/g, ' ')
  .trim()}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '120px 120px 120px 1fr',
                gap: 12,
                marginTop: 18,
                fontSize: 18,
              }}
            >
              <div>
                <strong>UM</strong>
                <br />
                {p.unita_misura || '-'}
              </div>

              <div>
                <strong>Qtà</strong>
                <br />
                {p.quantita || '-'}
              </div>

              <div>
                <strong>Prezzo</strong>
                <br />
                €
                {formatMoney(
                  Number(p.prezzo_unitario || 0)
                )}
              </div>

              <div>
                <strong>Totale</strong>
                <br />
                <span
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                  }}
                >
                  €
                  {formatMoney(
                    Number(p.importo_previsto || 0)
                  )}
                </span>
              </div>
            </div>
          </div>
        ))
    )}
  </div>
</div>

      <div
        style={{
          marginTop: 8,
          fontWeight: 700,
          color: Math.abs(differenza) > 1 ? '#b91c1c' : '#15803d',
        }}
      >
        Differenza: € {formatMoney(differenza)}
      </div>

      {Math.abs(differenza) > 1 && (
        <div style={{ marginTop: 8, color: '#92400e' }}>
          ⚠️ Il totale delle lavorazioni non coincide con il totale del preventivo.
          Potrebbero mancare alcune voci oppure alcune righe sono state lette male.
        </div>
      )}

<PreventiviCaricatiList
  preventivi={preventivi}
  salCantiere={salCantiere}
  formatMoney={formatMoney}
  onElimina={async (p) => {
    const conferma = confirm('Eliminare questo preventivo caricato?')
    if (!conferma) return

    if (p.file_path) {
      await supabase.storage
        .from('preventivi')
        .remove([p.file_path])
    }

    const { error } = await supabase
      .from('preventivi_cantiere')
      .delete()
      .eq('id', p.id)

    if (error) {
      alert('Errore eliminazione preventivo: ' + error.message)
      return
    }

    await caricaEconomia()
    alert('Preventivo eliminato')
  }}
/>

<ConfrontoPdfSalPanel
  mostraConfrontoPdfSal={mostraConfrontoPdfSal}
  setMostraConfrontoPdfSal={setMostraConfrontoPdfSal}
  salCantiere={salCantiere}
  preventivi={preventivi}
  preventivoLavorazioni={preventivoLavorazioni}
  supabase={supabase}
  formatMoney={formatMoney}
  parseImporto={parseImporto}
  analizzaRigheDocumento={analizzaRigheDocumento}
  caricaPreventivoLavorazioni={caricaPreventivoLavorazioni}
  lavorazioneEditId={lavorazioneEditId}
  setLavorazioneEditId={setLavorazioneEditId}
  lavorazioneEditDescrizione={lavorazioneEditDescrizione}
  setLavorazioneEditDescrizione={setLavorazioneEditDescrizione}
  lavorazioneEditImporto={lavorazioneEditImporto}
  setLavorazioneEditImporto={setLavorazioneEditImporto}
  buttonSecondary={buttonSecondary}
/>


<PulisciPreventivoSalButton
  salCantiere={salCantiere}
  preventivi={preventivi}
  supabase={supabase}
  caricaCantieri={caricaCantieri}
  caricaEconomia={caricaEconomia}
  caricaPreventivoLavorazioni={caricaPreventivoLavorazioni}
  caricaSalLavorazioni={caricaSalLavorazioni}
/>


    </div>
  )
})()}

  {salCantiere && (
    <>
      {(() => {
        const lavorazioniCantiere = salLavorazioni.filter(
          (s) => s.cantiere === salCantiere
        )

        const totalePrevistoSal = lavorazioniCantiere.reduce(
          (tot, s) => tot + Number(s.importo_previsto || 0),
          0
        )

        const totaleMaturatoSal = lavorazioniCantiere.reduce(
          (tot, s) => tot + Number(s.importo_maturato || 0),
          0
        )

        const totaleAccontiSal = accontiCantiere
  .filter((a) => a.cantiere === salCantiere)
  .reduce(
    (tot, a) => tot + Number(a.importo || 0),
    0
  )
        const daRichiedereSal =
  totaleMaturatoSal - totaleAccontiSal

        const percentualeGlobaleSal =
          totalePrevistoSal > 0
            ? (totaleMaturatoSal / totalePrevistoSal) * 100
            : 0

        let statoSal = 'coperto'

        if (daRichiedereSal > 0) {
          statoSal = 'da_richiedere'
        }

        if (daRichiedereSal > 500) {
          statoSal = 'urgente'
        }

        return (
          <>
           <SalSummaryCards
  totalePrevistoSal={totalePrevistoSal}
  totaleMaturatoSal={totaleMaturatoSal}
  totaleAccontiSal={totaleAccontiSal}
  daRichiedereSal={daRichiedereSal}
  statoSal={statoSal}
  percentualeGlobaleSal={percentualeGlobaleSal}
  formatMoney={formatMoney}
/>
<SalTable
  lavorazioni={lavorazioniCantiere}
  excelTable={excelTable}
  excelTh={excelTh}
  excelTd={excelTd}
  formatMoney={formatMoney}
  onToggleCompletata={async (s, completata) => {
    const nuovaPercentuale = completata
      ? Number(s.percentuale || 0)
      : 0

    const nuovoMaturato = completata
      ? (Number(s.importo_previsto || 0) * nuovaPercentuale) / 100
      : 0

    const { error } = await supabase
      .from('sal_lavorazioni')
      .update({
        completata,
        percentuale: nuovaPercentuale,
        importo_maturato: nuovoMaturato,
        data_aggiornamento: new Date()
          .toISOString()
          .slice(0, 10),
      })
      .eq('id', s.id)

    if (error) {
      alert('Errore aggiornamento SAL: ' + error.message)
      return
    }

    await caricaSalLavorazioni()
  }}
  onUpdateDescrizione={async (s, descrizione) => {
    const { error } = await supabase
      .from('sal_lavorazioni')
      .update({
        descrizione,
      })
      .eq('id', s.id)

    if (!error) {
      await caricaSalLavorazioni()
    }
  }}
  onUpdateImporto={async (s, valore) => {
    const importo = parseImporto(valore)

    const { error } = await supabase
      .from('sal_lavorazioni')
      .update({
        importo_previsto: importo,
      })
      .eq('id', s.id)

    if (!error) {
      await caricaSalLavorazioni()
    }
  }}
  onUpdatePercentuale={async (s, valore) => {
    const percentuale = Number(valore || 0)

    const maturato =
      (Number(s.importo_previsto || 0) * percentuale) / 100

    const { error } = await supabase
      .from('sal_lavorazioni')
      .update({
        percentuale,
        importo_maturato: maturato,
      })
      .eq('id', s.id)

    if (!error) {
      await caricaSalLavorazioni()
    }
  }}
  onElimina={eliminaSalLavorazione}
/>
          </>
        )
      })()}
    </>
  )}
</div>
  )
}
