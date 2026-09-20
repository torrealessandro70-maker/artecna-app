import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const pin = String(body?.pin || '').trim()

    if (!pin) {
      return NextResponse.json(
        { error: 'Inserisci il PIN' },
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

    const { data: operai, error: erroreOperaio } = await supabase
      .from('operai')
      .select('id,nome,stato')
      .eq('pin', pin)
      .limit(2)

    if (erroreOperaio) {
      console.error(
        'Errore accesso rapportino - operaio:',
        erroreOperaio.message
      )

      return NextResponse.json(
        { error: 'Accesso non disponibile' },
        { status: 500 }
      )
    }

    if (!operai || operai.length !== 1) {
      return NextResponse.json(
        { error: 'PIN non valido' },
        { status: 401 }
      )
    }

    const operaio = operai[0]

    if (operaio.stato === 'sospeso') {
      return NextResponse.json(
        { error: 'Operaio non abilitato' },
        { status: 403 }
      )
    }

    const { data: cantieri, error: erroreCantieri } = await supabase
      .from('cantieri')
      .select('id,nome,lavori_conclusi')
      .or('lavori_conclusi.is.null,lavori_conclusi.eq.false')
      .order('nome')

    if (erroreCantieri) {
      console.error(
        'Errore accesso rapportino - cantieri:',
        erroreCantieri.message
      )

      return NextResponse.json(
        { error: 'Cantieri non disponibili' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      operaio: {
        id: operaio.id,
        nome: operaio.nome,
      },
      cantieri: (cantieri || []).map((cantiere) => ({
        id: cantiere.id,
        nome: cantiere.nome,
      })),
    })
  } catch (error) {
    console.error('Errore accesso portale rapportini:', error)

    return NextResponse.json(
      { error: 'Richiesta non valida' },
      { status: 400 }
    )
  }
}