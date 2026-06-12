'use client'

import type { CSSProperties, Dispatch, SetStateAction } from 'react'
import JSZip from 'jszip'
import { supabase } from '../../lib/supabaseClient'

type Props = {
  cardStyle: CSSProperties
  buttonPrimary: CSSProperties
  buttonSecondary: CSSProperties
  excelTable: CSSProperties
  excelTh: CSSProperties
  excelTd: CSSProperties
  excelBox: CSSProperties

  cantieri: any[]
  fattureFornitori: any[]
  fattureOrdinate: any[]
  righeFatturaDaAssegnare: any[]
  righeFatturaAperta: any[]

  fatturaNomeFile: string
  fatturaFornitore: string
  fatturaPartitaIva: string
  fatturaNumero: string
  fatturaData: string

  cantiereMassivoFattura: string
  categoriaMassivaFattura: string
  filtroFattureFornitore: string
  filtroFattureStato: string
  fatturaApertaId: string | null
  nascondiCantieriConclusiFatture: boolean
  larghezzaDescrizioneFattura: number

  setFatturaFornitore: Dispatch<SetStateAction<string>>
  setFatturaPartitaIva: Dispatch<SetStateAction<string>>
  setFatturaNumero: Dispatch<SetStateAction<string>>
  setFatturaData: Dispatch<SetStateAction<string>>
  setFatturaTotale: Dispatch<SetStateAction<string>>
  setFatturaNomeFile: Dispatch<SetStateAction<string>>
  setFatturaTipoFile: Dispatch<SetStateAction<string>>
  setFatturaTestoOriginale: Dispatch<SetStateAction<string>>

  setRigheFatturaDaAssegnare: Dispatch<SetStateAction<any[]>>
  setRigheFatturaAperta: Dispatch<SetStateAction<any[]>>
  setCantiereMassivoFattura: Dispatch<SetStateAction<string>>
  setCategoriaMassivaFattura: Dispatch<SetStateAction<string>>
  setFatturaApertaId: Dispatch<SetStateAction<string | null>>
  setNascondiCantieriConclusiFatture: Dispatch<SetStateAction<boolean>>
  setLarghezzaDescrizioneFattura: Dispatch<SetStateAction<number>>

  caricaFatturaXml: (file: File) => Promise<void> | void
  caricaFatturaPdf: (file: File) => Promise<void> | void
  caricaFattureFornitori: () => Promise<void> | void
  importaFatturaSilenziosa: (dati: any, righe: any[]) => Promise<any>
  numeroXml: (valore: string) => number
  formatMoney: (valore: any) => string
  salvaFatturaFornitore: () => Promise<void> | void
  ordinaFatture: (campo: string) => void
  apriFatturaFornitore: (id: string) => Promise<void> | void
  eliminaFatturaFornitore: (fattura: any) => Promise<void> | void
  salvaModificheFatturaAperta: () => Promise<void> | void
}

export default function RegistroFattureFornitoriPanel({
  cardStyle,
  buttonPrimary,
  buttonSecondary,
  excelTable,
  excelTh,
  excelTd,
  excelBox,

  cantieri,
  fattureFornitori,
  fattureOrdinate,
  righeFatturaDaAssegnare,
  righeFatturaAperta,

  fatturaNomeFile,
  fatturaFornitore,
  fatturaPartitaIva,
  fatturaNumero,
  fatturaData,

  cantiereMassivoFattura,
  categoriaMassivaFattura,
  filtroFattureFornitore,
  filtroFattureStato,
  fatturaApertaId,
  nascondiCantieriConclusiFatture,
  larghezzaDescrizioneFattura,

  setFatturaFornitore,
  setFatturaPartitaIva,
  setFatturaNumero,
  setFatturaData,
  setFatturaTotale,
  setFatturaNomeFile,
  setFatturaTipoFile,
  setFatturaTestoOriginale,
  setRigheFatturaDaAssegnare,
  setRigheFatturaAperta,
  setCantiereMassivoFattura,
  setCategoriaMassivaFattura,
  setFatturaApertaId,
  setNascondiCantieriConclusiFatture,
  setLarghezzaDescrizioneFattura,

  caricaFatturaXml,
  caricaFatturaPdf,
  caricaFattureFornitori,
  importaFatturaSilenziosa,
  numeroXml,
  formatMoney,
  salvaFatturaFornitore,
  ordinaFatture,
  apriFatturaFornitore,
  eliminaFatturaFornitore,
  salvaModificheFatturaAperta,
}: Props) {
  return (
    <section style={cardStyle}>
      <h2>📄 Fatture fornitori</h2>

      {/* qui incolla TUTTO il contenuto interno del blocco,
          cioè quello che stava dentro:
          {registroTab === 'fatture-fornitori' && ( <section> ... </section> )}
          
          senza la riga iniziale:
          {registroTab === 'fatture-fornitori' && (
          
          e senza la chiusura finale:
          )}
      */}
    </section>
  )
}