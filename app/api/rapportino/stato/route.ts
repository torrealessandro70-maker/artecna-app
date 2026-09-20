import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const cantiereId = String(body?.cantiereId || '').trim()
const dataRichiesta = String(body?.data || '').trim()

    if (!cantiereId) {
      return NextResponse.json(
        { error: 'Cantiere non valido' },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Configurazione Supabase non disponibile' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const oggi = new Date().toISOString().slice(0, 10)
const dataRapportino = dataRichiesta || oggi

    const { data, error } = await supabase
      .from('rapportini')
      .select(
  'id,data,created_at,note,operai,ore,materiali,quantita_materiali'
)
      .eq('cantiere_id', cantiereId)
      .eq('data', dataRapportino)
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      console.error(
        'Errore controllo stato rapportino:',
        error.message
      )

      return NextResponse.json(
        { error: 'Stato rapportino non disponibile' },
        { status: 500 }
      )
    }

    const rapportino = data?.[0] || null
let timbrature: Array<{
  operaio_nome: string
  ora_entrata?: string | null
  ora_uscita?: string | null
}> = []

if (rapportino) {
  const { data: timbratureData, error: erroreTimbrature } =
    await supabase
      .from('timbrature')
      .select('operaio_nome,ora_entrata,ora_uscita')
      .eq('cantiere_id', cantiereId)
      .eq('data', dataRapportino)
      .eq('stato', 'da rapportino')

  if (erroreTimbrature) {
    console.error(
      'Errore caricamento timbrature rapportino:',
      erroreTimbrature.message
    )

    return NextResponse.json(
      { error: 'Timbrature rapportino non disponibili' },
      { status: 500 }
    )
  }

  timbrature = timbratureData || []
}

    return NextResponse.json({
  data: dataRapportino,
  presente: Boolean(rapportino),
  rapportino: rapportino
    ? {
        id: rapportino.id,
        data: rapportino.data,
        created_at: rapportino.created_at,
        note: rapportino.note || '',
        operai: rapportino.operai || '',
        ore: rapportino.ore || '',
        materiali: rapportino.materiali || '',
        quantita_materiali: rapportino.quantita_materiali || '',
      }
    : null,

  timbrature,
})
  } catch (error) {
    console.error('Errore richiesta stato rapportino:', error)

    return NextResponse.json(
      { error: 'Richiesta non valida' },
      { status: 400 }
    )
  }
}