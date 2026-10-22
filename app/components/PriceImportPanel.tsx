'use client'

import { useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import { usePriceImport } from '../hooks/usePriceImport'
import { applicablePriceRow } from '../engines/price-import/preview'

type Props = {
  supabase: SupabaseClient
}

export default function PriceImportPanel({
  supabase,
}: Props) {
  const {
    manodoperaPersistente,
    preview,
    result,
    isReading,
    isImporting,
    error,
    handleFileChange,
    importPreview,
    editRow,
    selectRows,
  } = usePriceImport({
    supabase,
  })
  const [search,setSearch]=useState('')
  const [page,setPage]=useState(0)
  const filtered=preview?.rows.map((row,index)=>({row,index})).filter(({row})=>`${row.codice} ${row.descrizione}`.toLocaleLowerCase('it-IT').includes(search.toLocaleLowerCase('it-IT'))) || []
  const currentPage=Math.min(page,Math.max(0,Math.ceil(filtered.length/30)-1))
  const selectedCount=preview?.rows.filter(r=>r.selezionata&&applicablePriceRow(r)).length||0

  return (
    <section
      style={{
        display: 'grid',
        gap: 16,
        padding: 18,
        border: '1px solid #dbe3ee',
        borderRadius: 18,
        background: '#ffffff',
      }}
    >
      <div>
        <div
          style={{
            fontSize: 20,
            fontWeight: 900,
          }}
        >
          ⚙️ Importa Prezzario
        </div>

        <div
          style={{
            marginTop: 4,
            color: '#64748b',
            lineHeight: 1.5,
          }}
        >
          Carica un prezzario regionale PDF compatibile, Excel o CSV e verifica anno e dati prima
          dell’importazione nella Knowledge Base ARTECNA.
        </div>
      </div>

      <label
        style={{
          display: 'inline-flex',
          width: 'fit-content',
          alignItems: 'center',
          gap: 8,
          padding: '11px 16px',
          borderRadius: 12,
          background: '#0f172a',
          color: '#ffffff',
          fontWeight: 800,
          cursor: isReading ? 'wait' : 'pointer',
          opacity: isReading ? 0.65 : 1,
        }}
      >
        📥 {isReading ? 'Analisi in corso...' : 'Carica prezzario'}

        <input
          type="file"
          accept=".xlsx,.xls,.csv,.pdf"
          disabled={isReading || isImporting}
          onChange={handleFileChange}
          aria-label="Carica prezzario"
          style={{
            display: 'none',
          }}
        />
      </label>
      {error && (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background: '#fef2f2',
            color: '#b91c1c',
            fontWeight: 700,
          }}
        >
          {error}
        </div>
      )}

      {preview && (
        <div
          style={{
            display: 'grid',
            gap: 16,
          }}
        >
          <div
            style={{
              padding: 14,
              borderRadius: 14,
              background: '#f8fafc',
            }}
          >
            <div
              style={{
                fontWeight: 900,
              }}
            >
              Anteprima importazione
            </div>

            <div
              style={{
                marginTop: 5,
                color: '#475569',
              }}
            >
              File: {preview.fileName}
            </div>
            {preview.prezzario && <div aria-label="Prezzario rilevato">
              <div>Prezzario rilevato: {preview.prezzario.regione} {preview.prezzario.anno}</div>
              <div>Fonte: {preview.prezzario.versione} · {preview.prezzario.fonte}</div>
              <div>Anno: {preview.prezzario.anno} · Versione: {preview.prezzario.versione}</div>
              <div>Prefisso codici: {preview.prezzario.prefissoCodice || 'Assente nel documento: codici originali preservati'}</div>
              <div>Righe estratte: {preview.totalRows}</div>
            </div>}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(140px, 1fr))',
              gap: 10,
            }}
          >
            <SummaryCard
              label="Righe trovate"
              value={preview.totalRows}
            />

            <SummaryCard
              label="Valide"
              value={preview.validRows}
            />

            <SummaryCard
              label="Warning"
              value={preview.warningRows}
            />

            <SummaryCard
              label="Errori"
              value={preview.errorRows}
            />
          </div>

<button
  type="button"
  onClick={importPreview}
  disabled={
    isImporting ||
    selectedCount === 0
  }
  style={{
    width: 'fit-content',
    padding: '12px 18px',
    border: 'none',
    borderRadius: 12,
    background: '#166534',
    color: '#ffffff',
    fontWeight: 900,
    cursor: isImporting
      ? 'wait'
      : 'pointer',
    opacity:
      isImporting ||
      selectedCount === 0
        ? 0.6
        : 1,
  }}
>
  {isImporting
    ? '⏳ Importazione in corso...'
    : `📚 Importa selezionate nella Knowledge Base (${selectedCount})`}
</button>


{result && (
  <div
    style={{
      display: 'grid',
      gap: 6,
      padding: 14,
      borderRadius: 14,
      background: result.success
        ? '#dcfce7'
        : '#fef3c7',
      color: result.success
        ? '#166534'
        : '#92400e',
    }}
  >
    <div style={{ fontWeight: 900 }}>
      {result.success
        ? '✅ Importazione completata'
        : '⚠️ Importazione completata con errori'}
    </div>

    <div>
      Importate o aggiornate:{' '}
      {(
        result.insertedRows +
        result.updatedRows
      ).toLocaleString('it-IT')}
    </div>

    <div>
      Saltate:{' '}
      {result.skippedRows.toLocaleString('it-IT')}
    </div>

    <div>
      Fallite:{' '}
      {result.failedRows.toLocaleString('it-IT')}
    </div>

    {result.errors.length > 0 && (
      <div style={{ marginTop: 4 }}>
        {result.errors
          .slice(0, 5)
          .map((item, index) => (
            <div key={index}>
              ❌ {item.message}
            </div>
          ))}
      </div>
    )}
  </div>
)}


          <div
            style={{
              display: 'grid',
              gap: 10,
            }}
          >
            <div
              style={{
                fontWeight: 900,
              }}
            >
              Prime lavorazioni riconosciute
            </div>
            <p>{manodoperaPersistente ? 'I valori ufficiali di manodopera vengono salvati solo dopo conferma.' : 'Le colonne manodopera sono informative e non vengono salvate: migration non disponibile.'} I record PDF ambigui restano bloccati.</p>
            <input aria-label="Cerca nel prezzario" placeholder="Cerca codice o descrizione" value={search} onChange={e=>{setSearch(e.target.value);setPage(0)}} />
            <div>
              <button type="button" disabled={isImporting} onClick={()=>selectRows(true)}>Seleziona tutto</button>{' '}
              <button type="button" disabled={isImporting} onClick={()=>selectRows(false)}>Deseleziona tutto</button>
              <span> · {filtered.length} / {preview.totalRows} righe · {selectedCount} selezionate</span>
            </div>
            <div>{(['NUOVA','AGGIORNAMENTO','DUPLICATO','BLOCCATA'] as const).map(label=><span key={label} style={{marginRight:12}}>{label}: {preview.rows.filter(r=>r.classificazione===label).length}</span>)}</div>

            {preview.rows.length === 0 && (
              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  background: '#fff7ed',
                  color: '#9a3412',
                }}
              >
                Nessuna voce di prezzario riconosciuta.
              </div>
            )}

            {filtered.slice(currentPage*30,currentPage*30+30).map(({row,index}) => (
              <div
                key={`${row.rowNumber}-${index}`}
                style={{
                  display: 'grid',
                  gap: 7,
                  padding: 14,
                  border: '1px solid #e2e8f0',
                  borderRadius: 14,
                  background: '#ffffff',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 900,
                      color: '#0f172a',
                    }}
                  >
                    <label><input type="checkbox" aria-label={`Seleziona riga ${index+1}`} checked={!!row.selezionata} disabled={isImporting||!applicablePriceRow(row)} onChange={e=>selectRows(e.target.checked,index)} />{' '}{row.classificazione}</label>
                    <input aria-label={`Codice riga ${index+1}`} disabled={isImporting} value={row.codice} onChange={e=>editRow(index,{codice:e.target.value})} />
                  </div>

                  <StatusBadge status={row.status} />
                </div>

                <div
                  style={{
                    color: '#334155',
                    lineHeight: 1.45,
                  }}
                >
                  <textarea aria-label={`Descrizione riga ${index+1}`} disabled={isImporting} value={row.descrizione} onChange={e=>editRow(index,{descrizione:e.target.value})} style={{width:'100%',minHeight:70}} />
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 14,
                    flexWrap: 'wrap',
                    color: '#475569',
                    fontSize: 14,
                  }}
                >
                  <span>
                    <strong>UM:</strong>{' '}
                    <input aria-label={`U.M. riga ${index+1}`} disabled={isImporting} value={row.unitaMisura} onChange={e=>editRow(index,{unitaMisura:e.target.value})} />
                  </span>

                  <span>
                    <strong>Prezzo:</strong>{' '}
                    <input aria-label={`Prezzo riga ${index+1}`} type="number" min="0" step="any" disabled={isImporting} value={row.prezzo??''} onChange={e=>editRow(index,{prezzo:e.target.value===''?null:Number(e.target.value)})} /> €
                  </span>

                  <span>
                    <strong>Riga:</strong>{' '}
                    {row.rowNumber}
                  </span>
                  <span>Fonte: {row.fonte} · Anno: {row.anno??'Non disponibile'} · Versione: {row.versione||'Non disponibile'}</span>
                  {row.paginaPdf!==undefined&&<span>Pagina PDF: {row.paginaPdf} · % Manodopera: {row.percentualeManodopera?.toLocaleString('it-IT')??'Non disponibile'} · Manodopera €/U.M.: {row.prezzoManodopera?.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})??'Non disponibile'}</span>}
                </div>

                {row.warnings.length > 0 && (
                  <div
                    style={{
                      color: '#a16207',
                      fontSize: 13,
                    }}
                  >
                    ⚠️ {row.warnings.join(' · ')}
                  </div>
                )}

                {row.errors.length > 0 && (
                  <div
                    style={{
                      color: '#b91c1c',
                      fontSize: 13,
                    }}
                  >
                    ❌ {row.errors.join(' · ')}
                  </div>
                )}
              </div>
            ))}

            {preview.rows.length > 30 && (
              <div
                style={{
                  textAlign: 'center',
                  color: '#64748b',
                  fontSize: 13,
                }}
              >
                <button type="button" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Precedenti</button>{' '}
                Pagina {currentPage+1} / {Math.max(1,Math.ceil(filtered.length/30))}{' '}
                <button type="button" disabled={(currentPage+1)*30>=filtered.length} onClick={()=>setPage(currentPage+1)}>Successive</button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

function SummaryCard({
  label,
  value,
}: {
  label: string
  value: number
}) {
  return (
    <div
      style={{
        padding: 13,
        borderRadius: 13,
        background: '#f1f5f9',
      }}
    >
      <div
        style={{
          color: '#64748b',
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 4,
          fontSize: 22,
          fontWeight: 900,
          color: '#0f172a',
        }}
      >
        {value.toLocaleString('it-IT')}
      </div>
    </div>
  )
}

function StatusBadge({
  status,
}: {
  status: 'valid' | 'warning' | 'error'
}) {
  const configurazione = {
    valid: {
      label: '✓ Valida',
      background: '#dcfce7',
      color: '#166534',
    },
    warning: {
      label: '⚠ Warning',
      background: '#fef9c3',
      color: '#854d0e',
    },
    error: {
      label: '✕ Errore',
      background: '#fee2e2',
      color: '#991b1b',
    },
  }[status]

  return (
    <span
      style={{
        padding: '5px 9px',
        borderRadius: 999,
        background: configurazione.background,
        color: configurazione.color,
        fontSize: 12,
        fontWeight: 900,
      }}
    >
      {configurazione.label}
    </span>
  )
}
