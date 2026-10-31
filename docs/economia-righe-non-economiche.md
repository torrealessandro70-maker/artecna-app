# Righe non economiche nelle Raccolte

Decisione esplicita, riservata al titolare attivo owner del Cantiere, per soli materiali con prezzo cliente zero e Raccolta ancora bozza/senza ponte. Nessuna euristica basata su descrizione, posizione XML o zero. Non viene mai inventato un prezzo.

Metadati aggiuntivi in economia_righe.dettagli_analitici.proposta_non_economica: versione 1, esclusa, motivo obbligatorio (10–1000 caratteri), storico append-only con utente JWT, timestamp server e revisione precedente. UUID/raccolta/provenienza restano quelli della riga immutata. Nessuna nuova tabella, colonna, FK o backfill. Nessun dato precedente viene escluso automaticamente.

La RPC classifica_riga_non_economica(uuid,uuid,boolean,text,bigint) blocca contesto/owner/Raccolta/riga, controlla revisione, stato e valore zero, rifiuta TD04, conserva lo snapshot fattura, aggiorna solo il metadato dedicato e i timestamp, incrementa la revisione una volta. Le funzioni di prezzo/costo originali non trasformano il costo in prezzo. Il ripristino è un secondo evento, non una cancellazione: lo zero torna bloccante. Prezzo non modificabile finché la riga è esclusa. Nessuna modifica a fattura, XML, quantità, categoria, Cantiere, assegnazioni o KPI interni.

UI nella stessa riga materiali, accanto al prezzo cliente: Escludi dalla proposta — riga non economica; richiede motivo e checkbox di conferma. Dopo risposta verificata rilegge Raccolta/totale/precheck. Mostra stato, motivo e storico. Ripristina inclusione disponibile solo in bozza. Conflitti/esiti incerti richiedono rilettura, nessun retry automatico.

Contratto nuovo: numero_registrazioni identifica tutte le sorgenti; numero_incluse e numero_escluse sono separati. Lo snapshot contiene tutte le registrazioni con flag esclusa_proposta; le lavorazioni si generano soltanto per le incluse. numero_riga della lavorazione è progressivo denso; indice_voce_sorgente continua a puntare alla posizione originale nello snapshot completo. Totale esattamente uguale alla somma delle incluse; count/sum e confronto di ogni lavorazione con lo snapshot certificati. Tutte escluse: proposta vuota vietata.

Esempio solo sintetico: 72 sorgenti → 71 incluse + 1 esclusa → 71 lavorazioni, totale 2612,04. Il riuso è idempotente; snapshot commerciali v1 precedenti restano validi e non riscritti. Il vecchio writer rifiuta metadati nuovi anziché ignorarli. I controlli di proposta e lo storico rimangono attivi.

SQL candidato separato 20261031_economia_righe_non_economiche.sql: quattro funzioni nuove, sette funzioni postgres sostituite, un trigger. Nessun SET ROLE/cambio owner/grant temporaneo/policy nuova. I sette owner e corpi baseline sono prerequisiti fail-fast. Migrazione SOLO PREPARATA, richiede futuro precheck/autorizzazione; nessuna pubblicazione o modifica Production inclusa. Non riapplicare o modificare la precedente migrazione prezzo cliente.
