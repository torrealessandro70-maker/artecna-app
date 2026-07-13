'use client'

import { useState, type ChangeEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  buildPriceImportPreview,
  upsertPriceImportPreview,
  type PriceImportPreview,
  type PriceImportResult,
} from '../engines/price-import'

type UsePriceImportOptions = {
  supabase: SupabaseClient
}

export const usePriceImport = ({
  supabase,
}: UsePriceImportOptions) => {
  const [preview, setPreview] =
    useState<PriceImportPreview | null>(null)

  const [result, setResult] =
    useState<PriceImportResult | null>(null)

  const [isReading, setIsReading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState('')

  const handleFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setIsReading(true)
    setError('')
    setPreview(null)
    setResult(null)

    try {
      const buffer = await file.arrayBuffer()

      const nextPreview = buildPriceImportPreview({
        fileName: file.name,
        buffer,
        metadata: {
          fonte: 'Regione Sicilia',
          regione: 'Sicilia',
          anno: 2024,
          versione: 'SIC24',
          tipoPrezzo: 'regional_price_list',
        },
      })

      setPreview(nextPreview)
    } catch (cause) {
      console.error(
        'Errore lettura prezzario:',
        cause,
      )

      setError(
        cause instanceof Error
          ? cause.message
          : 'Impossibile leggere il file Excel.',
      )
    } finally {
      setIsReading(false)
      event.target.value = ''
    }
  }

  const importPreview = async () => {
    if (!preview) {
      return
    }

    const righeImportabili = preview.rows.filter(
      (row) => row.status !== 'error',
    ).length

    if (righeImportabili === 0) {
      setError(
        'Non sono presenti righe valide da importare.',
      )
      return
    }

    const conferma = window.confirm(
      `Importare ${righeImportabili.toLocaleString(
        'it-IT',
      )} prezzi nella Knowledge Base ARTECNA?`,
    )

    if (!conferma) {
      return
    }

    setIsImporting(true)
    setError('')
    setResult(null)

    try {
      const nextResult =
        await upsertPriceImportPreview(
          supabase,
          preview,
        )

      setResult(nextResult)

      if (!nextResult.success) {
        setError(
          'Importazione completata con alcuni errori.',
        )
      }
    } catch (cause) {
      console.error(
        'Errore importazione prezzario:',
        cause,
      )

      setError(
        cause instanceof Error
          ? cause.message
          : 'Errore durante l’importazione.',
      )
    } finally {
      setIsImporting(false)
    }
  }

  return {
    preview,
    result,
    isReading,
    isImporting,
    error,
    handleFileChange,
    importPreview,
  }
}