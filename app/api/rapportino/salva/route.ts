import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildPhotoRecordsWithStorage } from '../../../engines/photo-storage/photo-manager'
type OperaioRapportinoInput = {
  id: string
  nome: string
  ora_inizio?: string
  ora_fine?: string
  pausa_minuti?: number
  ore?: number
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const cantiereId = String(body?.cantiereId || '').trim()
const rapportinoId = String(body?.rapportinoId || '').trim()
    const data = String(body?.data || '').trim()
    const note = String(body?.note || '').trim()
    const materiali = String(body?.materiali || '').trim()
    const quantitaMateriali = String(
      body?.quantitaMateriali || ''
    ).trim()

    const operai = Array.isArray(body?.operai)
      ? (body.operai as OperaioRapportinoInput[])
      : []
const foto = Array.isArray(body?.foto)
  ? body.foto.filter(
      (item: unknown): item is string =>
        typeof item === 'string' && item.startsWith('data:image/')
    )
  : []

    if (!cantiereId || !data) {
      return NextResponse.json(
        { error: 'Cantiere e data sono obbligatori' },
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

    const { data: cantieri, error: erroreCantiere } = await supabase
      .from('cantieri')
      .select('id,nome')
      .eq('id', cantiereId)
      .limit(2)

    if (erroreCantiere) {
      console.error(
        'Errore salvataggio rapportino - cantiere:',
        erroreCantiere.message
      )

      return NextResponse.json(
        { error: 'Cantiere non disponibile' },
        { status: 500 }
      )
    }

    if (!cantieri || cantieri.length !== 1) {
      return NextResponse.json(
        { error: 'Cantiere non valido' },
        { status: 400 }
      )
    }

    const cantiere = cantieri[0]

    if (rapportinoId) {
  const { data: rapportinoDaModificare, error: erroreVerifica } =
    await supabase
      .from('rapportini')
      .select('id,cantiere_id')
      .eq('id', rapportinoId)
      .eq('cantiere_id', cantiere.id)
      .maybeSingle()

  if (erroreVerifica) {
    console.error(
      'Errore verifica rapportino da modificare:',
      erroreVerifica.message
    )

    return NextResponse.json(
      { error: 'Impossibile verificare il rapportino da modificare' },
      { status: 500 }
    )
  }

  if (!rapportinoDaModificare) {
    return NextResponse.json(
      { error: 'Rapportino da modificare non valido' },
      { status: 404 }
    )
  }
} else {
  const { data: rapportiniEsistenti, error: erroreControllo } =
    await supabase
      .from('rapportini')
      .select('id')
      .eq('cantiere_id', cantiere.id)
      .eq('data', data)
      .limit(1)

  if (erroreControllo) {
    console.error(
      'Errore controllo duplicato rapportino:',
      erroreControllo.message
    )

    return NextResponse.json(
      { error: 'Impossibile verificare il rapportino' },
      { status: 500 }
    )
  }

  if (rapportiniEsistenti && rapportiniEsistenti.length > 0) {
    return NextResponse.json(
      { error: 'Rapportino già presente per questa data' },
      { status: 409 }
    )
  }
}
const idsOperai = operai
  .map((operaio) => String(operaio.id || '').trim())
  .filter(Boolean)

let costiOrari = new Map<string, number>()

if (idsOperai.length > 0) {
  const { data: operaiDb, error: erroreOperai } = await supabase
    .from('operai')
    .select('id,costo_orario')
    .in('id', idsOperai)

  if (erroreOperai) {
    console.error(
      'Errore recupero operai rapportino:',
      erroreOperai.message
    )

    return NextResponse.json(
      { error: 'Dati operai non disponibili' },
      { status: 500 }
    )
  }

  costiOrari = new Map(
    (operaiDb || []).map((operaio) => [
      String(operaio.id),
      Number(operaio.costo_orario || 0),
    ])
  )
}

    const operaiValidi = operai.filter(
      (operaio) =>
        operaio.nome &&
        Number(operaio.ore || 0) > 0
    )

    const oreTotali = operaiValidi.reduce(
      (totale, operaio) =>
        totale + Number(operaio.ore || 0),
      0
    )
const costoManodopera = operaiValidi.reduce(
  (totale, operaio) =>
    totale +
    Number(operaio.ore || 0) *
      Number(costiOrari.get(String(operaio.id)) || 0),
  0
)
    const riepilogoOperai = operaiValidi
      .map(
        (operaio) =>
          `${operaio.nome} (` +
          `${operaio.ora_inizio || '-'} / ` +
          `${operaio.ora_fine || '-'} - ` +
          `${Number(operaio.ore || 0)}h)`
      )
      .join(', ')

    const nuovoRapportino = {
      cantiere_id: cantiere.id,
      cantiere: cantiere.nome,
      data,
      ore: String(oreTotali),
      note,
      operai: riepilogoOperai,
      materiali,
      quantita_materiali: quantitaMateriali,
      costo_manodopera: costoManodopera,
    }

   const queryRapportino = rapportinoId
  ? supabase
      .from('rapportini')
      .update(nuovoRapportino)
      .eq('id', rapportinoId)
      .eq('cantiere_id', cantiere.id)
  : supabase
      .from('rapportini')
      .insert([nuovoRapportino])

const { data: rapportinoCreato, error: erroreSalvataggio } =
  await queryRapportino
    .select('id')
    .single()

    if (erroreSalvataggio) {
      console.error(
        'Errore salvataggio rapportino:',
        erroreSalvataggio.message
      )

      return NextResponse.json(
        { error: 'Salvataggio rapportino non riuscito' },
        { status: 500 }
      )
    }
if (rapportinoId) {
  const { error: erroreRimozioneTimbrature } = await supabase
    .from('timbrature')
    .delete()
    .eq('cantiere_id', cantiere.id)
    .eq('data', data)
    .eq('stato', 'da rapportino')

  if (erroreRimozioneTimbrature) {
    console.error(
      'Errore rimozione timbrature rapportino:',
      erroreRimozioneTimbrature.message
    )

    return NextResponse.json(
      {
        error:
          'Rapportino aggiornato, ma aggiornamento timbrature non riuscito',
        rapportinoId: rapportinoCreato.id,
      },
      { status: 500 }
    )
  }
}

if (operaiValidi.length > 0) {
  const timbratureDaSalvare = operaiValidi.map((operaio) => ({
    operaio_nome: operaio.nome,
    cantiere_id: cantiere.id,
    cantiere: cantiere.nome,
    data,
    ora_entrata: operaio.ora_inizio || null,
    ora_uscita: operaio.ora_fine || null,
    stato: 'da rapportino',
  }))

  const { error: erroreTimbrature } = await supabase
    .from('timbrature')
    .insert(timbratureDaSalvare)

  if (erroreTimbrature) {
    console.error(
      'Rapportino salvato ma errore timbrature:',
      erroreTimbrature.message
    )

    return NextResponse.json(
      {
        error:
          'Rapportino salvato, ma inserimento timbrature non riuscito',
        rapportinoId: rapportinoCreato.id,
      },
      { status: 500 }
    )
  }
}

if (foto.length > 0) {
  const risultatoFoto = await buildPhotoRecordsWithStorage(supabase, {
    cantiere: cantiere.nome,
    categoria: 'rapportino',
    dataFoto: data,
    rapportinoId: String(rapportinoCreato.id),
    dataUrls: foto,
    bucket: 'preventivi',
    folder: `rapportini/${String(rapportinoCreato.id)}`,
  })

  if (!risultatoFoto.success) {
    console.error(
      'Rapportino salvato ma errore upload foto:',
      risultatoFoto.error
    )

    return NextResponse.json(
      {
        error: 'Rapportino salvato, ma caricamento foto non riuscito',
        rapportinoId: rapportinoCreato.id,
      },
      { status: 500 }
    )
  }

  const { error: erroreFotoDb } = await supabase
    .from('foto_cantiere')
    .insert(risultatoFoto.photos)

  if (erroreFotoDb) {
    if (risultatoFoto.uploadedPaths.length > 0) {
      await supabase.storage
        .from('preventivi')
        .remove(risultatoFoto.uploadedPaths)
    }

    console.error(
      'Rapportino salvato ma errore registrazione foto:',
      erroreFotoDb.message
    )

    return NextResponse.json(
      {
        error: 'Rapportino salvato, ma registrazione foto non riuscita',
        rapportinoId: rapportinoCreato.id,
      },
      { status: 500 }
    )
  }
}
    return NextResponse.json({
      success: true,
      rapportino: {
        id: rapportinoCreato.id,
        cantiere: cantiere.nome,
        data,
      },
    })
  } catch (error) {
    console.error('Errore richiesta salvataggio rapportino:', error)

    return NextResponse.json(
      { error: 'Richiesta non valida' },
      { status: 400 }
    )
  }
}