\# Event Bus Engine



\## Visione



L'Event Bus è il punto di comunicazione tra gli Engine di ARTECNA OS.



Gli Engine non si chiamano direttamente.



Pubblicano eventi.



Gli altri Engine potranno reagire agli eventi.



\## V1



La V1 non esegue alcuna logica.



publishEvent() restituisce semplicemente l'evento ricevuto.



Nessun listener.



Nessuna coda.



Nessuna persistenza.



Nessuna UI.



Nessuna query.



Nessun database.



\---



\## Runtime Listener V1



L'Event Bus introduce un sistema di listener.



publishEvent() distribuisce l'evento a tutti i listener registrati tramite dispatchEvent().



Nella V1:



\- nessuna persistenza;

\- nessun listener reale;

\- nessun database;

\- nessuna UI;

\- nessuna elaborazione asincrona.



Serve esclusivamente a definire il contratto del Runtime.

\---



\## Context Listener V1



Il primo listener del Runtime osserva gli eventi `photo\_added`.



Alla ricezione dell'evento invoca automaticamente il Context Engine.



Nella V1:



\- nessuna persistenza;

\- nessuna UI;

\- nessun database;

\- nessuna Decision.



Il listener dimostra il collegamento automatico Event Bus → Context Engine.

