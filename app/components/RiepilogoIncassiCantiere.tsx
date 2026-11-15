'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

type Situazione = {
  acconti_netto: number; acconti_da_verificare: number; acconti_economia: number
  fatture: number | null; pagamenti: number; attribuiti: number; non_attribuiti: number
  residuo: number | null; fatture_da_verificare: number
}

export default function RiepilogoIncassiCantiere({ cantiere, contratto, sal, varianti, formatMoney }: {
  cantiere: string; contratto: number | null; sal: number; varianti: number | null; formatMoney: (n: number) => string
}) {
  const [lettura, setLettura] = useState<{ cantiere: string; dati: Situazione | null } | null>(null)
  useEffect(() => {
    let attivo = true
    let ultimo = 0
    async function aggiorna() {
      const richiesta = ++ultimo
      try {
        const { data, error } = await supabase.rpc('riepilogo_incassi_lordi_cantiere', { p_cantiere: cantiere })
        if (attivo && richiesta === ultimo) setLettura({ cantiere, dati: error ? null : data as Situazione })
      } catch {
        if (attivo && richiesta === ultimo) setLettura({ cantiere, dati: null })
      }
    }
    void aggiorna()
    window.addEventListener('artecna-incassi-lordi-aggiornati', aggiorna)
    return () => {
      attivo = false
      window.removeEventListener('artecna-incassi-lordi-aggiornati', aggiorna)
    }
  }, [cantiere])

  const dati = lettura?.cantiere === cantiere ? lettura.dati : null
  const denaro = (n?: number | null) => n == null || !Number.isFinite(n) ? 'Non determinabile' : formatMoney(n)
  const residuoNetto = dati && dati.acconti_da_verificare === 0 && contratto !== null
    ? contratto - dati.acconti_netto : null
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: 12 }}>
    <section aria-labelledby="contratto-netto-cantiere">
      <h4 id="contratto-netto-cantiere">Contabilità contrattuale · IVA esclusa</h4>
      <dl>
        <dt>Contratto netto aggiornato</dt><dd>{denaro(contratto)}</dd>
        <dt>Varianti approvate</dt><dd>{denaro(varianti)}</dd>
        <dt>SAL maturato</dt><dd>{denaro(sal)}</dd>
        <dt>Acconti netti imputati</dt><dd>{denaro(dati?.acconti_netto)}</dd>
        <dt>Residuo contrattuale netto verificabile</dt><dd>{denaro(residuoNetto)}</dd>
      </dl>
      {dati && <p>{dati.acconti_da_verificare} acconti da verificare · {dati.acconti_economia} per lavori in economia</p>}
    </section>
    <section aria-labelledby="finanza-lorda-cantiere">
      <h4 id="finanza-lorda-cantiere">Situazione finanziaria · IVA inclusa</h4>
      <dl>
        <dt>Totale fatture emesse</dt><dd>{denaro(dati?.fatture)}</dd>
        <dt>Pagamenti lordi confermati</dt><dd>{denaro(dati?.pagamenti)}</dd>
        <dt>Quote attribuite</dt><dd>{denaro(dati?.attribuiti)}</dd>
        <dt>Pagamenti ancora da attribuire</dt><dd>{denaro(dati?.non_attribuiti)}</dd>
        <dt>Residuo finanziario verificabile</dt><dd>{denaro(dati?.residuo)}</dd>
      </dl>
      {dati && <p>{dati.fatture_da_verificare} documenti con saldo da verificare</p>}
    </section>
  </div>
}
