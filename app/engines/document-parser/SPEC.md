# Document Parser Engine

## Missione

Il Document Parser Engine ha il solo compito di trasformare un documento
strutturato in dati strutturati.

Non interpreta.

Non sintetizza.

Non utilizza AI.

---

## Regole fondamentali

Una riga del documento = una riga di ARTECNA.

Il documento originale non viene mai modificato.

Ogni riga mantiene sempre il rawText originale.

Le informazioni non riconosciute vengono segnalate come warning,
mai eliminate.

---

## Input supportati

- Excel (.xlsx)
- Excel (.xls)
- PDF con testo
- PDF OCR
- immagini (fase successiva)

---

## Output

ParsedDocument

↓

DocumentRow[]

---

## Compiti del Parser

- leggere le righe
- individuare colonne
- riconoscere quantità
- riconoscere unità di misura
- riconoscere prezzi
- mantenere il testo originale

---

## Compiti NON del Parser

- generare preventivi
- interpretare il significato delle lavorazioni
- accorpare descrizioni
- correggere quantità
- modificare prezzi
- utilizzare AI

---

## Gli Engine successivi utilizzeranno il risultato del Parser.

Preventivo Engine

Decision Engine

Construction Knowledge Engine

Document Intelligence