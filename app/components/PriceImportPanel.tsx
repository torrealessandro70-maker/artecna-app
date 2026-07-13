'use client'

import type { SupabaseClient } from '@supabase/supabase-js'

import { usePriceImport } from '../hooks/usePriceImport'

type Props = {
  supabase: SupabaseClient
}

export default function PriceImportPanel({
  supabase,
}: Props) {
  const {
    preview,
    result,
    isReading,
    isImporting,
    error,
    handleFileChange,
    importPreview,
  } = usePriceImport({
    supabase,
  })

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
          Carica un prezzario Excel e verifica i dati prima
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
        📥 {isReading ? 'Analisi in corso...' : 'Carica Excel'}

        <input
          type="file"
          accept=".xlsx,.xls"
          disabled={isReading || isImporting}
          onChange={handleFileChange}
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
    preview.validRows + preview.warningRows === 0
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
      preview.validRows + preview.warningRows === 0
        ? 0.6
        : 1,
  }}
>
  {isImporting
    ? '⏳ Importazione in corso...'
    : '📚 Importa nella Knowledge Base'}
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

            {preview.rows.slice(0, 30).map((row, index) => (
              <div
                key={`${row.rowNumber}-${row.codice}-${index}`}
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
                    {row.codice || 'Codice non disponibile'}
                  </div>

                  <StatusBadge status={row.status} />
                </div>

                <div
                  style={{
                    color: '#334155',
                    lineHeight: 1.45,
                  }}
                >
                  {row.descrizione ||
                    'Descrizione non disponibile'}
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
                    {row.unitaMisura || '-'}
                  </span>

                  <span>
                    <strong>Prezzo:</strong>{' '}
                    {row.prezzo !== null
                      ? `${row.prezzo.toLocaleString('it-IT', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} €`
                      : 'Non disponibile'}
                  </span>

                  <span>
                    <strong>Riga Excel:</strong>{' '}
                    {row.rowNumber}
                  </span>
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
                Visualizzate le prime 30 di{' '}
                {preview.totalRows} righe.
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