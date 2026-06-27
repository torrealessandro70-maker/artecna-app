export type RuntimeState =
  | 'created'
  | 'event_received'
  | 'context_updated'
  | 'decision_ready'
  | 'waiting_user'
  | 'completed'