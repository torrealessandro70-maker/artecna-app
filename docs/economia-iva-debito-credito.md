# Economia generale: IVA documentale e liquidazione

Base: 422bd36aa9ca705a00b72876b31712a92d248f1f.

Il riepilogo IVA usa lo stesso selettore mese/trimestre/anno/intervallo di RiepilogoDittaVista ed è collocato sopra la tabella generale, dopo il pannello Incassi/Fatturazione. Il periodo IVA è esplicitamente la data documento; non coincide necessariamente con il periodo degli incassi.

## Fonti e perimetro

- Riutilizzo di leggiFontiDitta/leggiFonte: sessione corrente, RLS esistente, pagine da 500 e conteggi/identità verificati. Nessuna nuova RPC, tabella, migrazione o autorizzazione.
- XML registrato: tutti i DatiRiepilogo, valuta EUR, identità e aritmetica al centesimo verificate. Nessun download automatico di allegati.
- TD04: rettifica documentale con segno negativo applicato una sola volta. Le rettifiche fiscali di liquidazione rimangono separate.
- Emesse manuali: aliquota esplicita e base riconciliate con il totale, sempre Limitato. PDF/OCR e importi ambigui non producono IVA ricostruita.
- Duplicati e documenti incoerenti sono esclusi, con motivazione. Tipi fiscali speciali non supportati non producono importi presunti.
- Split payment e differita/cassa restano imposte esposte documentali con copertura limitata; nessuna inferenza di esigibilità o detraibilità. Reverse charge e regimi speciali non alimentano automaticamente la liquidazione.

## Posizione documentale

La differenza è IVA emesse meno IVA ricevute, in centesimi interi. Debito/credito/pareggio sono classificati soltanto con entrambe le quote Disponibile. Copertura Limitato, parziale, errore, esclusioni o data mancante comportano posizione Non determinabile; gli eventuali valori parziali restano chiaramente subtotali. Disponibile si riferisce alla fotografia autorizzata caricata: non certifica l'assenza di documenti esterni non importati.

Mesi e subtotali trimestrali non vengono sommati tra loro. Il progressivo parte dall'inizio del periodo; una lacuna interrompe il progressivo verificabile. Nessuna somma con acconti o incassi, nessuna detrazione dal saldo contrattuale.

## Limiti fiscali dimostrati dal codice locale

Le letture correnti non espongono registri validati di esigibilità/detraibilità, pro rata, crediti precedenti, rettifiche per periodo, compensazioni o liquidazioni ufficiali. documentiFiscali.ts espone F24 come metadati di PDF (nome, data, percorso, revisione), non come quietanze strutturate con importi/codici tributo/esiti. Le scadenze sono registrazioni manuali e non attestano la liquidazione.

Per questo IVA esigibile, detraibile, rettifiche fiscali, credito precedente, versamenti/compensazioni, interessi trimestrali, risultato di liquidazione e credito residuo sono Non determinabile. La vista dettaglio specifica le fonti necessarie per ciascuno. Nessuna aliquota o regola fiscale viene presunta. Una futura estensione richiederà fonti validate e un contratto dati separato.

## Consultazione

Dettaglio in VistaOperativa, ripristino del focus, prospetto mensile/trimestrale, filtro tutti/inclusi/esclusi/da verificare. Collegamento HTTPS all'originale se già disponibile; altrimenti apertura del registro emesse/ricevute, senza preselezione garantita della singola fattura. Scadenziario esistente aperto soltanto su azione esplicita, senza compilare importi o generare F24.

Nessuna verifica o modifica dei dati Production è stata effettuata per questo lavoro. I test usano fixture sintetiche. La navigazione multipagina Incassi rimane fuori dal perimetro e non viene dichiarata collaudata.

## Verifiche locali

- 89 test unitari/UI GREEN: XML, arrotondamento al centesimo, TD04, duplicati, copia manuale/XML e manuale con cliente rinominato, fonti mancanti/parziali, periodi e progressivi, filtri, apertura/ritorno da VistaOperativa, navigazione senza writer.
- 45 verifiche PostgreSQL native GREEN su letture riservate, accessi negati, RLS, owner/ACL e conservazione delle fixture. Il runtime locale rilevato è PostgreSQL 18.6: queste nuove esecuzioni non attestano PostgreSQL 17.6. Il primo avvio nel sandbox è fallito durante initdb per rinomina WAL negata; ripetizione sul solo cluster temporaneo 127.0.0.1 GREEN, cluster chiuso dal fixture.
- TypeScript e lint differenziale GREEN sui file interessati; build Next.js 15.5.29 GREEN, 26/26 pagine, ExitCode 0, completata prima del commit. Esiti definitivi e impronte dei file nel rapporto locale .run/iva-verifica/rapporto-finale.json.
- Build con chiave OpenAI sintetica limitata al processo e guardia fetch che rifiuta Supabase/OpenAI. Nessun file ENV copiato o modificato.
- Il pacchetto Next.js 15.5.29 installato non contiene node_modules/next/dist/docs: consultata la guida ufficiale v15 sui Client Components, https://nextjs.org/docs/15/app/getting-started/server-and-client-components. Si riusano i componenti client e VistaOperativa esistenti.

Nessuna pubblicazione o smoke autenticato Production della nuova IVA è stato eseguito. Qualsiasi pubblicazione resta uno STEP successivo esplicitamente autorizzato.
