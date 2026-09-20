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
      .select('id,data,created_at')
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

    return NextResponse.json({
      data: dataRapportino,
      presente: Boolean(rapportino),
      rapportino: rapportino
        ? {
            id: rapportino.id,
            data: rapportino.data,
            created_at: rapportino.created_at,
          }
        : null,
    })
  } catch (error) {
    console.error('Errore richiesta stato rapportino:', error)

    return NextResponse.json(
      { error: 'Richiesta non valida' },
      { status: 400 }
    )
  }
}