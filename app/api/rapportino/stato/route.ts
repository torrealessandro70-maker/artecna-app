import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ErroreServizioRapportini, verificaOrigineRapportino } from '../../../engines/rapportini/servizioRapportini.server'
import { leggiStatoRapportinoPortale } from '../../../engines/rapportini/servizioLetturaPortale.server'
import type { StatoRapportinoPortale, TimbraturaStatoLegacy } from '../../../engines/rapportini/contrattoLetturaPortale'

const risposta = (body: StatoRapportinoPortale | { error: string }, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export async function POST(req: Request) {
  try {
    verificaOrigineRapportino(req)
    let body
    try { body = await req.json() } catch {
      return risposta({ error: 'Richiesta non valida' }, 400)
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return risposta({ error: 'Richiesta non valida' }, 400)
    }
    // Conserva il fallback esistente soltanto quando la data è omessa/vuota.
    const dataRichiesta = typeof body.data === 'string' ? body.data.trim() : body.data
    const lettura = await leggiStatoRapportinoPortale(req, {
      cantiere_id: body.cantiereId,
      data: dataRichiesta == null || dataRichiesta === '' ? new Date().toISOString().slice(0, 10) : dataRichiesta,
      rapportino_id: body.rapportinoId,
    })
    if (lettura.versione_prestazioni === null) {
      return risposta({ data: lettura.data, presente: false, versione_prestazioni: null, rapportino: null, timbrature: [] })
    }
    if (lettura.versione_prestazioni === 1) {
      return risposta({
        data: lettura.data, presente: true, versione_prestazioni: 1,
        rapportino: { id: lettura.rapportino_id, data: lettura.data },
        strutturato: lettura.dettaglio, timbrature: [],
      })
    }

    // Soltanto V0: il riferimento è deciso dalla RPC, mai da una query legacy.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseKey) return risposta({ error: 'Configurazione Supabase non disponibile' }, 503)
    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data: rapportino, error } = await supabase.from('rapportini')
      .select('id,cantiere_id,data,created_at,note,operai,ore,materiali,quantita_materiali,versione_prestazioni')
      .eq('id', lettura.rapportino_id)
      .eq('cantiere_id', lettura.cantiere_id)
      .eq('data', lettura.data)
      .eq('versione_prestazioni', 0)
      .maybeSingle()
    if (error) return risposta({ error: 'Stato rapportino non disponibile' }, 503)
    if (!rapportino || rapportino.id !== lettura.rapportino_id || rapportino.cantiere_id !== lettura.cantiere_id
      || rapportino.data !== lettura.data || rapportino.versione_prestazioni !== 0) {
      return risposta({ error: 'UUID o contesto Rapportino incoerente: ripeti il controllo' }, 409)
    }
    const { data: timbrature, error: erroreTimbrature } = await supabase.from('timbrature')
      .select('operaio_id,operaio_nome,ora_entrata,ora_uscita')
      .eq('rapportino_id', lettura.rapportino_id)
      .eq('stato', 'da rapportino')
    if (erroreTimbrature) return risposta({ error: 'Timbrature rapportino non disponibili' }, 503)
    return risposta({
      data: lettura.data, presente: true, versione_prestazioni: 0,
      rapportino: {
        id: rapportino.id, data: rapportino.data, created_at: rapportino.created_at ?? null,
        note: rapportino.note || '', operai: rapportino.operai || '', ore: rapportino.ore || '',
        materiali: rapportino.materiali || '', quantita_materiali: rapportino.quantita_materiali || '',
      },
      timbrature: (timbrature || []) as TimbraturaStatoLegacy[],
    })
  } catch (error) {
    if (error instanceof ErroreServizioRapportini) return risposta({ error: error.message }, error.status)
    return risposta({ error: 'Servizio stato Rapportini non disponibile' }, 503)
  }
}
