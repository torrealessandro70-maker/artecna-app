'use client'

import { useState, type ChangeEvent } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  buildPriceImportPreview,
  upsertPriceImportPreview,
  type PriceImportPreview,
  type PriceImportResult,
} from '../engines/price-import'
import { buildPdfPriceImportPreview } from '../engines/price-import/pdf'
import { leggiSupportoManodopera } from '../engines/price-import/manodopera'
import { classifyPricePreview, editPricePreview, selectPricePreview, selectedPricePreview, type ExistingPrice } from '../engines/price-import/preview'

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
  const [manodoperaPersistente, setManodoperaPersistente] = useState(false)
  const [existing,setExisting]=useState<ExistingPrice[]>([])

  const handleFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0]
    const inputElement = event.currentTarget

    if (!file) {
      return
    }

    setIsReading(true)
    setError('')
    setPreview(null)
    setResult(null)
    setManodoperaPersistente(false)

    try {
      const buffer = await file.arrayBuffer()

      const input = {
        fileName: file.name,
        buffer,
        rilevaVersione: true,
        metadata: {
          fonte: 'Regione Sicilia',
          regione: 'Sicilia',
          tipoPrezzo: 'regional_price_list' as const,
        },
      }
      if(!/\.(pdf|xlsx|xls|csv)$/i.test(file.name)) throw Error('Formato non supportato: usare PDF, XLSX, XLS o CSV.')
      const nextPreview = /\.pdf$/i.test(file.name) ? await buildPdfPriceImportPreview(input) : buildPriceImportPreview(input)
      const detected = nextPreview.prezzario
      if (!detected) throw Error('Identità del prezzario non verificata: importazione bloccata.')
      const current: ExistingPrice[]=[]
      for(let offset=0;;offset+=1000) {
        const {data,error}=await supabase.from('prezzi_lavorazioni')
          .select('codice,descrizione,unita_misura,prezzo_unitario,fonte,versione,anno,tipo_prezzo,incidenza_manodopera,prezzo_manodopera')
          .eq('fonte',detected.fonte).eq('versione',detected.versione).order('id').range(offset,offset+999)
        if(error) throw Error(`Confronto prezzario non disponibile: ${error.message}`)
        current.push(...(data||[]))
        if(!data||data.length<1000) break
      }
      setExisting(current)
      setManodoperaPersistente(await leggiSupportoManodopera(supabase).catch(() => false))
      setPreview(classifyPricePreview(nextPreview,current))
    } catch (cause) {
      console.error(
        'Errore lettura prezzario:',
        cause,
      )

      setError(
        cause instanceof Error
          ? cause.message
          : 'Impossibile leggere il prezzario.',
      )
    } finally {
      setIsReading(false)
      inputElement.value = ''
    }
  }

  const importPreview = async () => {
    if (!preview) {
      return
    }

    const selected = selectedPricePreview(preview)
    const righeImportabili = selected.rows.length

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
          selected,
          manodoperaPersistente,
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
    manodoperaPersistente,
    preview,
    result,
    isReading,
    isImporting,
    error,
    handleFileChange,
    importPreview,
    editRow:(index:number,patch:Parameters<typeof editPricePreview>[2])=>setPreview(p=>p?editPricePreview(p,index,patch,existing):p),
    selectRows:(selected:boolean,index?:number)=>setPreview(p=>p?selectPricePreview(p,selected,index):p),
  }
}
