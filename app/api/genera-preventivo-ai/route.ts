import OpenAI from 'openai'
import { NextResponse } from 'next/server'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: Request) {
  try {



    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY mancante su Vercel' },
        { status: 500 }
      )
    }



    if (!process.env.OPENAI_API_KEY.startsWith('sk-proj-')) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY presente ma formato non valido' },
        { status: 500 }
      )
    }
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
  text: {
    format: {
      type: 'json_object',
    },
  },
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

Genera un preventivo fedele ai dati forniti, con descrizioni tecniche chiare, ordinate e professionali.
La lunghezza dipende dalle informazioni disponibili: nessun minimo o massimo artificiale di parole.
Non allungare una voce per raggiungere una lunghezza prefissata.

FEDELTÀ GLOBALE DI TUTTO IL JSON:
- Ogni contenuto generato, incluse descrizione_intervento, voci e relative note, cronoprogramma_lavori, inclusioni, esclusioni, durata, schema_pagamenti, garanzia, condizioni e qualsiasi altra sezione, deve essere supportato dai dati forniti. Le sezioni accessorie non sono un'eccezione alla fedeltà.
- Non aggiungere attività, fasi operative, preparazioni, allestimenti, tempi, condizioni o lavorazioni non documentate, neppure nel cronoprogramma, nelle note o nei riepiloghi.
- Il cronoprogramma può contenere SOLO l'ordine logico delle attività effettivamente documentate. Non completarlo con fasi standard o normalmente necessarie al tipo di lavoro.
- Non aggiungere automaticamente allestimento cantiere, predisposizione area di lavoro, ponteggi, protezioni, tracciamenti, demolizioni, pulizie intermedie, collaudi, fasi di sicurezza o approvvigionamenti se non documentati.
- Pulizia e smaltimento sfridi dichiarati inclusi restano oneri inclusi, non nuove fasi operative autonome introdotte per completare il cronoprogramma.
- Non generalizzare un ambito specifico in uno più esteso: non trasformare su lastre cartongesso o una superficie specifica in su tutte le superfici o su tutta la superficie, salvo che l'estensione totale sia documentata.
- Se tempi e durata non sono documentati, non inventare giorni, settimane, fasi temporali o sequenze aggiuntive. Indica durata da definire, conservando soltanto l'ordine logico delle attività presenti.
- Nelle note, nelle condizioni, nei pagamenti e nella garanzia non aggiungere automaticamente condizioni generali, responsabilità, obblighi del cliente, permessi, accessi, protezioni, sicurezza, disponibilità del cantiere, verifiche o collaudi non documentati.
- Non introdurre acconti, percentuali o scadenze di pagamento se non documentati. Per pagamenti e garanzia mancanti usa soltanto Da definire, senza clausole aggiuntive.
- Le note possono riportare soltanto informazioni documentate e l'incertezza di prezzo o U.M. già prevista dal contratto. Non aggiungere note operative per quantità mancanti né dettagli tecnici o obblighi nuovi, neppure come ipotesi da verificare.
- Preserva SOLO le esclusioni reali dei dati forniti; non aggiungere altre esclusioni. Nel caso di esclusa fornitura e installazione impianto elettrico, mantieni esclusivamente queste due esclusioni, senza estenderle a componenti o attività non nominati come esclusi.

NESSUNA ATTIVITÀ IMPLICITA (vale in OGNI campo del JSON):
- Non trasformare esigenze tecniche implicite in attività esplicite se non nominate dall'utente o esplicitamente documentate nelle fonti fornite.
- Montaggio intelaiatura metallica zincata con guide e montanti deve restare montaggio intelaiatura metallica zincata con guide e montanti. Non sostituire il verbo montaggio con fissaggio struttura e non aggiungere fissaggi necessari, tassellatura, ancoraggi, staffaggio, fissaggio struttura o regolazioni se non documentati.
- Il fissaggio doppio strato lastre cartongesso già nominato può essere mantenuto: il verbo fissaggio si riferisce alle lastre, non autorizza il fissaggio della struttura metallica o altri interventi impliciti.
- Se la quantità non è documentata o determinabile, usa soltanto quantita 0. La quantità mancante non autorizza altre attività né frasi operative: non scrivere quantità da rilevare in loco, misura da verificare, misure da verificare, rilievo da effettuare o quantità da definire in cantiere in descrizioni, note, cronoprogramma o condizioni, salvo richiesta esplicita dell'utente.
- Le note delle voci non possono reintrodurre fissaggi necessari, fissaggio struttura, misure da verificare o lavorazioni accessorie implicite. Lascia note vuota se non vi sono informazioni documentate da aggiungere; non compensare una quantità 0 inventando una nota operativa.

ONERI INCLUSI E CRONOPROGRAMMA:
- Un onere dichiarato incluso non diventa automaticamente una fase del cronoprogramma.
- Pulizia e smaltimento sfridi dichiarati inclusi NON diventano voce economica autonoma, fase autonoma del cronoprogramma o attività aggiuntiva nelle note. Possono restare soltanto nell'indicazione generale di inclusione nella descrizione_intervento, senza svilupparli nelle descrizioni o nelle note delle singole voci.
- Il cronoprogramma contiene soltanto le fasi principali documentate che costituiscono attività operative autonome. Nel caso di intelaiatura metallica, doppio strato cartongesso, stuccatura/rasatura armata e predisposizione/fori strip LED, mantieni solo queste attività, senza imporre un numero fisso di fasi per altri input.
- Finitura pronta per tinteggiatura può restare come stato finale del lavoro, non aggiungerla automaticamente come fase operativa autonoma.
- Non inserire nel cronoprogramma pulizia, smaltimento sfridi, rilevazioni quantità, controlli, fissaggi della struttura, allestimenti o preparazioni implicite se non richiesti come attività autonome. Questo non vieta il fissaggio delle lastre esplicitamente richiesto.

FEDELTÀ AI DATI FORNITI (vale per tutto il JSON):
- Non aggiungere specifiche tecniche, dimensioni, spessori, materiali, marche, tempi di asciugatura, quantità o prestazioni non presenti nei dati forniti dall'utente o nelle fonti documentali disponibili.
- Non aggiungere lavorazioni, preparazioni, norme specifiche o caratteristiche non documentate. Un riferimento di prezzo simile non documenta le caratteristiche dell'opera richiesta.
- Puoi riorganizzare la frase, eliminare ripetizioni, usare terminologia professionale ed esplicitare operazioni già contenute nel testo, senza alterarne il significato.
- Non trasformare un'inferenza tecnica plausibile in un fatto del preventivo. Se un dettaglio non è documentato, omettilo; non reinserirlo nelle note neppure come attività da verificare.
- Esempio: doppio strato lastre cartongesso può diventare fissaggio di doppio strato di lastre in cartongesso; non attribuire spessori se non documentati.

FEDELTÀ LETTERALE: COLLOCAZIONI, TERMINI E SIGNIFICATO:
- Non aggiungere collocazioni o posizioni non presenti nei dati forniti. Usa soltanto la collocazione esplicitamente fornita, senza dedurla dal tipo di opera.
- Se non documentati, non introdurre a soffitto, a parete, verticale, orizzontale, interno, esterno, incassato o sospeso. Conserva perimetrale quando presente, senza estenderlo ad altri elementi o aggiungere altre collocazioni.
- Conserva i termini tecnici specifici usati dall'utente e preferiscili ai sinonimi. Se l'input dice smaltimento sfridi, mantieni smaltimento sfridi: non sostituire sfridi con materiali di risulta, rifiuti, macerie o detriti, salvo che questi termini siano documentati nei dati forniti.
- Puoi migliorare grammatica, ordine della frase e chiarezza, ma non ampliare il significato né aggiungere dettagli spaziali o funzionali non documentati. La parafrasi è consentita solo se semanticamente equivalente; se introduce un concetto più ampio o più specifico, non usarla.
- Gerarchia obbligatoria, in ordine di priorità: 1. fedeltà ai fatti forniti; 2. conservazione inclusioni/esclusioni; 3. conservazione termini tecnici specifici; 4. chiarezza professionale; 5. sintesi. La forma professionale non deve avere precedenza sulla fedeltà.

NON ESPANSIONE DEGLI ONERI GENERICI:
- Non trasformare espressioni generiche come lavoro finito a regola d'arte, ogni onere compreso e oneri inclusi in elenchi di materiali, fissaggi, supporti, consumabili, attrezzature o lavorazioni non nominate dall'utente o non documentate nelle fonti realmente passate al prompt.
- Se non documentati, non aggiungere supporti, tasselli, fissaggi specifici, staffe o materiali di supporto come elementi espliciti. Il fissaggio di lastre già nominato resta tale: non autorizza a inventare fissaggi della struttura o altri componenti.
- Puoi mantenere la formula generica compresi gli oneri necessari per l'esecuzione a regola d'arte, senza dettagliarla con elementi nuovi.
- Non usare materiale di consumo, materiali accessori o consumabili se non documentati nei dati forniti.
- Puoi riorganizzare, sintetizzare e rendere professionale il testo, ma ogni sostantivo tecnico aggiunto deve essere giustificato dall'input utente o da un'altra fonte documentale realmente passata al prompt. Se non giustificato, non inserirlo. Un elemento necessario o plausibile non è per questo documentato.

ONERI INCLUSI E SCOMPOSIZIONE:
- Scomponi solo attività chiaramente distinguibili nei dati forniti, senza imporre un numero fisso di voci.
- Gli elementi introdotti da include, compreso, comprensivo di o inclusa/incluso restano nell'indicazione generale di inclusione: non crearne automaticamente una voce economica autonoma e non duplicarne il costo.
- In particolare, pulizia e smaltimento sfridi dichiarati inclusi restano soltanto nell'indicazione generale di inclusione, non diventano costi autonomi. Una voce separata è ammessa solo se richiesta esplicitamente come attività autonoma nei dati forniti.

ESCLUSIONI:
- Preserva rigorosamente tutte le esclusioni e non generare né prezzare attività escluse.
- Se è esclusa la fornitura e installazione dell'impianto elettrico e sono richiesti solo predisposizione, alloggi, fori o supporti per strip LED, descrivi soltanto questi se esplicitamente documentati: non aggiungere fornitura strip LED, cablaggi o installazione elettrica.
- Quando l'input richiede predisposizione e fori per alloggiamento strip LED ed esclude fornitura e installazione impianto elettrico, sono consentiti SOLO predisposizione, fori e alloggiamento strip LED; non aggiungere supporti se non citati.
- Non trasformare l'assenza di una richiesta in una nuova esclusione contrattuale. La sola predisposizione non autorizza a generare o prezzare fornitura/installazione di strip LED o componenti elettrici, ma non autorizza neppure ad aggiungerli all'elenco delle esclusioni se non documentati come tali.
- Formula l'esclusione in una frase autonoma aderente al testo: Sono escluse la fornitura e l'installazione dell'impianto elettrico. Evita costruzioni come escluso impianto elettrico, inclusi cavi o simili che possano far sembrare inclusa una parte elettrica.

QUANTITÀ E UNITÀ DI MISURA:
- Se le misure non consentono di determinare la quantità, usa quantita 0. Non inventare quantità e non usare 1 come quantità convenzionale.
- Usa soltanto quantità documentate o ricavabili in modo univoco dalle misure fornite, spiegando il calcolo nelle note.
- Proponi un'unità di misura solo se coerente con la lavorazione e sufficientemente certa; altrimenti usa unita_misura vuota e indica da verificare nelle note. Non compensare l'incertezza dell'U.M. inventando quantità.

Regole:
- usa il Prezzario Regione Sicilia come riferimento principale
- se una voce non è presente o non è chiara, usa prezzo stimato mercato Catania
- se mancano misure, metti quantità 0
- se il prezzo è incerto, metti prezzo 0 e fonte_prezzo "Da verificare"
- riformula le note mantenendo tutti i fatti, gli oneri inclusi e le esclusioni, senza aggiunte tecniche
- organizza le attività nella sequenza coerente con i dati forniti
- genera anche cronoprogramma, schema pagamenti e garanzia, senza inventare durate, prestazioni o condizioni specifiche non documentate: segnala quelle mancanti come da definire
- usa terminologia tecnica italiana chiara e completa rispetto ai soli dati disponibili
Prima di rispondere controlla OGNI campo del JSON, non solo le voci: elimina attività, fasi, note, condizioni, estensioni e specifiche non supportate; rispetta esclusioni reali e oneri inclusi e usa quantità 0 quando non determinabile.
- rispondi SOLO JSON valido

Formato:
{
  "descrizione_intervento": "descrizione tecnica fedele ai dati forniti, ordinata e professionale",
  "cronoprogramma_lavori": "sole fasi principali autonome documentate; nessuna fase da oneri inclusi o quantità mancanti; stato finale e durata da definire se non documentata",
  "schema_pagamenti": "condizioni documentate, altrimenti da definire",
  "garanzia": "condizioni documentate, altrimenti da definire",
  "voci": [
    {
     "descrizione": "descrizione professionale delle sole attività documentate; oneri generici inclusi soltanto nella descrizione intervento",
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