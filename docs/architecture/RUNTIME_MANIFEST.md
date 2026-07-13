\# Runtime Manifest



\## Kernel



Coordina il Runtime.



\---



\## Event Engine



Produce Runtime Event.



\---



\## Event Bus



Distribuisce Runtime Event.



\---



\## Context Engine



Produce:



context\_updated



Ascolta:



photo\_added



document\_uploaded



note\_created



audio\_recorded



\---



\## Decision Engine



Produce:



decision\_ready



Ascolta:



context\_updated



\---



\## Workflow Engine



Produce:



workflow\_completed



Ascolta:



decision\_ready



\---



\## Action Engine



Produce:



action\_executed



Ascolta:



action\_confirmed



\---



\## Runtime Inspector



Osserva tutto.



Non modifica nulla.

