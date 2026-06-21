# ARTECNA Kernel V1

## Missione

Il Kernel coordina lo stato operativo condiviso e gli eventi prodotti dagli
Engine di ARTECNA OS, mantenendo contratti semplici e tipizzati.

## Cosa fa

- crea lo stato iniziale del sistema;
- registra gli Engine disponibili;
- conserva il `WorkspaceContext` corrente;
- pubblica eventi immutabili nel nuovo stato del Kernel.

## Cosa non fa

Il Kernel non contiene logica di interfaccia, non prende decisioni di dominio,
non chiama Supabase e non esegue operazioni di persistenza.

## Relazione con WorkspaceContext

Il `WorkspaceContext` rappresenta l'area di lavoro attiva. Il Kernel ne conserva
la versione corrente e pubblica un evento `workspace.updated` quando viene
aggiornata.

## Relazione con gli Engine

Gli Engine possono essere registrati nel Kernel e comunicare cambiamenti
attraverso eventi tipizzati. Il Kernel coordina questi eventi senza incorporare
le responsabilita specifiche dei singoli Engine.

## Regola fondamentale

Il Kernel non scrive nel database.
