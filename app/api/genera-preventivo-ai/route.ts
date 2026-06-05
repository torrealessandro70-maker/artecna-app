import OpenAI from 'openai'
import { NextResponse } from 'next/server'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: Request) {
  try {
   const {
  sopralluogo,
  foto,
  prezzi_riferimento,
} = await req.json()
    const contenutiFoto = (foto || [])
      .slice(0, 8)
      .map((f: any) => ({
        type: 'input_image',
        image_url: f.immagine_base64,
      }))

    const noteFoto = (foto || [])
      .map(
        (f: any, i: number) =>
          `Foto ${i + 1}: ${f.nota || 'nessuna nota'}`
      )
      .join('\n')

    const response = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `
Sei un tecnico preventivista edile ARTECNA a Catania.
Prezzi di riferimento ARTECNA:

${JSON.stringify(prezzi_riferimento || [], null, 2)}

Usa questi prezzi come riferimento prioritario.
Se trovi una lavorazione simile:
- usa prezzo coerente
- adatta il testo
- mantieni prezzi realistici per Catania

NON inventare prezzi casuali.
Se non trovi riferimento affidabile:
- usa prezzo_unitario 0
- aggiungi nota "da verificare"
Rispondi SEMPRE e SOLO in italiano.
Non usare mai inglese tecnico o termini inglesi.
La descrizione intervento, le voci, il cronoprogramma,
lo schema pagamenti e la garanzia devono essere scritti
in italiano professionale da impresa edile italiana.

Analizza:
- sopralluogo
- note generali
- foto sopralluogo
- note delle foto

Genera un preventivo tecnico NON copiando le note grezze.
Le voci devono essere scritte in stile capitolato/prezzario regionale, dettagliate e tecniche.

Ogni descrizione deve includere quando pertinente:
- lavorazione completa
- preparazione del supporto
- materiali principali
- modalità di posa o esecuzione
- oneri inclusi
- esclusioni se utili
- riferimento indicativo al Prezzario Regione Sicilia o mercato Catania

Esempio stile corretto:
"Fornitura e posa in opera di guaina cementizia bicomponente elastica impermeabilizzante, applicata su supporto preventivamente pulito e preparato, data in due mani incrociate, compreso primer se necessario, sigillatura punti critici, sfridi, attrezzi e ogni altro onere per dare l'opera finita a regola d'arte."

Non usare descrizioni brevi tipo:
"Applicazione guaina cementizia"




Regole:
- usa il Prezzario Regione Sicilia come riferimento principale
- se una voce non è presente o non è chiara, usa prezzo stimato mercato Catania
- se mancano misure, metti quantità 0
- se il prezzo è incerto, metti prezzo 0 e fonte_prezzo "Da verificare"
- non copiare mai testualmente le note del sopralluogo
- usa le note solo per capire l'intervento
- riscrivi sempre una descrizione tecnica ordinata, professionale e grammaticalmente corretta
- organizza la descrizione con logica tecnica e sequenza delle lavorazioni
- genera anche cronoprogramma, schema pagamenti e garanzia
- ogni voce di capitolato deve essere estesa, tecnica e completa
- ogni voce deve essere tecnica ma compatta, massimo 18-25 parole
- tutte le voci devono avere lo stesso livello di dettaglio
- evita descrizioni troppo lunghe che deformano l'Excel
- usa linguaggio da capitolato, ma sintetico
- ogni descrizione deve contenere lavorazione, materiali, preparazione del supporto, modalità esecutiva, oneri inclusi e opera finita a regola d'arte
- non usare frasi brevi o titoli sintetici
- non riassumere le voci
- scrivi le voci come se fossero tratte da un capitolato/prezzario regionale
- tutte le voci devono avere lo stesso livello di dettaglio tecnico

- se una voce risulta breve, devi riscriverla ampliandola prima di restituire il JSON
- non alternare voci lunghe e voci brevi
- anche demolizioni, zoccolini, fasce, massetti e finiture devono essere descritti in forma 
estesa
- vietato usare inglese nelle risposte
- usare terminologia tecnica italiana
- scrivere come un capitolato italiano professionale
Prima di rispondere controlla ogni voce:
se la descrizione ha meno di 35 parole, riscrivila in modo più completo.
Il JSON finale non deve contenere voci sintetiche.
- rispondi SOLO JSON valido

Formato:
{
  "descrizione_intervento": "descrizione tecnica ordinata e professionale, NON copiata dalle note",
  "cronoprogramma_lavori": "testo sintetico con durata presunta e fasi operative",
  "schema_pagamenti": "Acconto 30% all'avvio lavori, saldo o SAL secondo avanzamento lavori",
  "garanzia": "Garanzia sulle lavorazioni eseguite secondo normativa vigente e corretta posa a regola d'arte",
  "voci": [
    {
     "descrizione": "voce tecnica compatta in stile capitolato, con lavorazione, materiali, preparazione supporto, modalità esecutiva e oneri inclusi",
      "unita_misura": "",
      "quantita": 0,
      "prezzo_unitario": 0,
      "fonte_prezzo": "",
      "note": ""
    }
  ]
}

DATI SOPRALLUOGO:
Cliente: ${sopralluogo?.cliente || ''}
Indirizzo: ${sopralluogo?.indirizzo || ''}
Tipo lavoro: ${sopralluogo?.tipo_lavoro || ''}
Note generali: ${sopralluogo?.note || ''}

NOTE FOTO:
${noteFoto}
`,
            },
            ...contenutiFoto,
          ],
        },
      ],
    })

    let testo = response.output_text || '{}'

testo = testo
  .replace(/```json/g, '')
  .replace(/```/g, '')
  .trim()

const jsonStart = testo.indexOf('{')
const jsonEnd = testo.lastIndexOf('}')

if (jsonStart >= 0 && jsonEnd >= 0) {
  testo = testo.slice(jsonStart, jsonEnd + 1)
}

return NextResponse.json(JSON.parse(testo))
  } catch (error: any) {
    return NextResponse.json(
      {
        error:
          error.message ||
          'Errore generazione preventivo AI',
      },
      { status: 500 }
    )
  }
}