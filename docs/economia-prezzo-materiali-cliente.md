# Prezzo fatturabile dei materiali Economia

## Separazione contabile

`economia_righe.prezzo_unitario`, la quantità e lo snapshot
`dettagli_analitici.fattura` rimangono originali. Il campo prezzo è usato anche
dalle quote TD04: sovrascriverlo altererebbe una base di costo.

La scelta cliente è separata in `dettagli_analitici.cliente_materiale`:

- `versione: 1`, `prezzo` positivo con massimo sei decimali;
- `storico` append-only: prezzo, precedente, utente JWT, timestamp server,
  revisione precedente della Raccolta.

Non ci sono nuove tabelle, colonne, FK, backfill o copie dei documenti. Senza
override rimane il valore già utilizzato dal percorso precedente; non viene
creato alcun prezzo cliente automatico. L'editor parte vuoto e non suggerisce
costi o maggiorazioni. I costi continuano a usare i reader e snapshot originali.

## RPC

- `valorizza_materiale_economia(uuid,uuid,numeric,bigint)`: Raccolta, riga,
  nuovo prezzo e revisione attesa; verifica utente/owner e stato bozza, blocca
  contesto/Raccolta/riga, modifica solo metadati cliente e timestamp della riga,
  incrementa una sola revisione. Nessun retry automatico.
- `leggi_raccolta_economia_cliente(uuid)` e
  `leggi_raccolte_economia_cliente(uuid)`: stesso controllo di contesto dei
  reader precedenti; restituiscono quantità/prezzi commerciali e totali.
  Il dettaglio espone anche `prezzo_unitario_origine` distinto dal prezzo cliente.
- `usa_raccolta_economia_cliente_in_variante(uuid,bigint)`: estensione
  deterministica del ponte, senza AI/importazione aggiuntiva. Riusa lo stesso
  modello Raccolta/sorgente/lavorazioni e relativi indici univoci. Congela i prezzi
  cliente nello snapshot, verifica conteggio e somma prima del completamento.

Le nuove RPC sono SECURITY DEFINER postgres, EXECUTE solo authenticated e guard
aziendale esplicito. Nessun cambio di owner/ruolo o privilegio dell'installatore.
Il lettore legacy non è richiamato internamente dalla nuova RPC: non si assume
che postgres abbia EXECUTE sulle funzioni possedute da altri ruoli.

Il ponte e i reader legacy restano intatti. I due helper postgres modificati sono
`proteggi_ponte_economia` e `materiali_economia_stato`. Il primo ammette il nuovo
contesto solo con certificazione puntuale dello snapshot cliente; il secondo
evita di aggiornare lo stato della fattura per un cambiamento esclusivamente
commerciale. Il vecchio ponte rifiuta un'acquisizione contenente override cliente,
per evitare che un client obsoleto congeli il costo al posto del prezzo scelto.

## UI e stato

Nella tabella materiali: “Modifica prezzo fatturabile · riga N”, costo/valore
originario in sola lettura, nuovo prezzo, totale, Salva e Annulla. Salvataggio
solo esplicito. Dopo risposta verificata si rilegge la Raccolta, aggiornando totale
e precheck. Il componente si rinnova anche alla rilettura della stessa revisione,
così un esito incerto non autorizza reinvii prima della verifica server.

Una Raccolta congelata non è modificabile. La rimozione dello storico cliente è
vietata: questo percorso non offre cancellazione o aggiramenti del cleanup.
Le protezioni TD04 restano invariate e possono rifiutare modifiche di metadati
su una quota già rettificata. Non si modificano fatture, XML o assegnazioni.

## Rilascio

La migrazione è solo candidata locale. Serve un precheck Production separato su
ownership, corpi baseline, collisioni della chiave JSON, privilegi e compatibilità
dei guard. Applicare il DB prima della pubblicazione; non pubblicare il codice
come se le nuove RPC fossero già presenti. Nessuna modifica reale della riga 67
o della Raccolta n. 5 è inclusa nei test: le fixture sono sintetiche.
