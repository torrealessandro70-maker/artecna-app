\# ARTECNA OS — Runtime Event Model V1



\## Visione



Gli Engine non comunicano direttamente.



Gli Engine comunicano esclusivamente tramite Runtime Event.



Ogni evento rappresenta un fatto già avvenuto.



Mai un'intenzione.



Mai un comando.



\---



\# Principi



Un evento descrive qualcosa che è successo.



Esempi:



✅ photo\_added



✅ document\_uploaded



✅ context\_updated



❌ create\_report



❌ analyze\_photo



I comandi appartengono agli Engine.



Gli eventi appartengono al Runtime.



\---



\# Event Lifecycle



Photo



↓



photo\_added



↓



Context Engine



↓



context\_updated



↓



Decision Engine



↓



decision\_ready



↓



Action Engine



↓



action\_requested



↓



User



↓



action\_confirmed



↓



Action Engine



↓



action\_executed



↓



workflow\_completed



\---



\# Eventi Foundation



photo\_added



Origine:



Event Engine



Listener:



Context Listener



\---



context\_updated



Origine:



Context Engine



Listener:



Decision Listener



\---



decision\_ready



Origine:



Decision Engine



Listener:



Workflow Runtime



\---



action\_requested



Origine:



Workflow Runtime



Listener:



UI



\---



action\_confirmed



Origine:



UI



Listener:



Action Engine



\---



action\_executed



Origine:



Action Engine



Listener:



Workflow Runtime



\---



workflow\_completed



Origine:



Workflow Runtime



Listener:



Runtime Inspector



\---



\# Regola fondamentale



Ogni Runtime Event:



\- descrive un fatto;

\- è immutabile;

\- può essere ascoltato da più Listener;

\- non modifica direttamente il database;

\- non esegue azioni.



Gli Engine reagiscono agli eventi.



Mai il contrario.



\---



Versione



Runtime Event Model V1

