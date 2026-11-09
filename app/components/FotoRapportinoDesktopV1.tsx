'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import FotoRapportinoQueueV1 from './FotoRapportinoQueueV1'
import { creaTrasportoHttpFotoV1, ErroreHttpFotoV1 } from '../engines/rapportini/trasportoHttpFotoV1'
import { validaUUIDAllegato } from '../engines/rapportini/contrattoAllegati'
import type { ContestoFoto } from '../engines/rapportini/fotoRapportinoV1'

export default function FotoRapportinoDesktopV1({ contesto, disabled, onBusyChange }: {
  contesto: ContestoFoto; disabled: boolean; onBusyChange: (busy: boolean) => void
}) {
  const [soggetto, setSoggetto] = useState<string | null>(null)
  useEffect(() => {
    let active = true, revision = 0
    const subscription = supabase.auth.onAuthStateChange((_event, session) => {
      revision += 1
      if (active) setSoggetto(session?.user.id ?? null)
    })
    void supabase.auth.getSession().then(({ data, error }) => {
      if (active && revision === 0) setSoggetto(error ? null : data.session?.user.id ?? null)
    }).catch(() => { if (active && revision === 0) setSoggetto(null) })
    return () => { active = false; subscription.data.subscription.unsubscribe() }
  }, [])
  const trasporto = useMemo(() => soggetto ? creaTrasportoHttpFotoV1('/api/rapportino/foto', fetch, async () => {
    const { data, error } = await supabase.auth.getSession()
    // Una coda dell'utente A non può inviare con il JWT dell'utente B dopo cambio sessione.
    if (error || !data.session || data.session.user.id !== soggetto) throw new ErroreHttpFotoV1(401, 'identita')
    return data.session.access_token
  }) : null, [soggetto])
  if (!soggetto || !trasporto) return <p role="status">Foto: sessione Desktop autenticata necessaria.</p>
  return <FotoRapportinoQueueV1 key={soggetto} identita={{ canale: 'desktop', soggettoId: validaUUIDAllegato(soggetto) }}
    contesto={contesto} disabled={disabled} trasporto={trasporto} onBusyChange={onBusyChange} />
}
