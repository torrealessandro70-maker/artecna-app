\# Preventivo Engine V2



\## Obiettivo



Il Preventivo Engine trasforma qualunque sorgente in una struttura unica:



PreventivoRevision



La UI non deve sapere se il preventivo arriva da Excel, PDF, OCR, AI, computo, capitolato o inserimento manuale.



\## Principio



Una sola uscita:



\- PreventivoRevision



Un solo editor:



\- Editor Preventivo ARTECNA



\## Sorgenti previste



\- Documento tecnico

\- Excel

\- PDF

\- OCR

\- Capitolato

\- Computo

\- Primus

\- AI

\- Inserimento manuale



\## Regole



\- Nessuna dipendenza da Supabase

\- Nessuna dipendenza dalla UI

\- Nessuna modifica a ENV

\- Nessuna modifica al Login

\- Nessun salvataggio diretto

\- Il motore produce dati, non decide al posto dell'utente



\## Flusso previsto



Documento / AI / Manuale

↓

Adapter

↓

PreventivoRevision

↓

Review Builder

↓

Editor Preventivo ARTECNA

↓

Conferma utente

↓

Salvataggio esistente



\## File



\- types.ts

\- document-adapter.ts

\- ai-adapter.ts

\- review-builder.ts

\- review-actions.ts

\- index.ts

