'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { StatoAcconti } from '../engines/economia/accontiCantiere'

export function useAccontiCantiere(authPronta: boolean, utenteId: string | null, onLoaded: (rows: Record<string, unknown>[]) => void) {
  const chiave = authPronta ? utenteId : null
  const identita = useMemo(() => ({ utenteId: chiave }), [chiave])
  const corrente = useRef<object | null>(null)
  const [lettura, setLettura] = useState<{ identita: object | null; stato: StatoAcconti }>({ identita: null, stato: 'non_caricato' })
  const richiesta = useRef<{ identita: object; token: object; promessa: Promise<boolean> } | null>(null)

  useEffect(() => {
    corrente.current = identita
    return () => { corrente.current = null }
  }, [identita])

  const carica = useCallback((): Promise<boolean> => {
    if (!chiave) return Promise.resolve(false)
    if (richiesta.current?.identita === identita) return richiesta.current.promessa
    const token = {}
    setLettura({ identita, stato: 'caricamento' })
    const valida = () => corrente.current === identita
    const promessa = (async () => {
      try {
        const righe: Record<string, unknown>[] = []
        // Il totale cumulativo deve includere anche righe oltre il limite REST.
        for (let offset = 0; ; offset += 200) {
          const { data, error } = await supabase.from('acconti_cantiere').select('*')
            .order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 199)
          if (!valida()) return false
          if (error || !Array.isArray(data)) throw Error('Lettura acconti non riuscita')
          righe.push(...data)
          if (data.length < 200) break
        }
        onLoaded(righe)
        setLettura({ identita, stato: righe.length ? 'caricato' : 'vuoto' })
        return true
      } catch {
        if (valida()) setLettura({ identita, stato: 'errore' })
        return false
      } finally {
        if (richiesta.current?.token === token) richiesta.current = null
      }
    })()
    richiesta.current = { identita, token, promessa }
    return promessa
  }, [chiave, identita, onLoaded])

  useEffect(() => {
    onLoaded([])
    if (chiave) void carica()
  }, [chiave, carica, onLoaded])

  return {
    statoAcconti: chiave && lettura.identita === identita ? lettura.stato : 'non_caricato' as StatoAcconti,
    authAccontiDisponibile: Boolean(chiave),
    caricaAcconti: carica,
  }
}
