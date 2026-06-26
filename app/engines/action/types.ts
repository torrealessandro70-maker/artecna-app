export type ActionRequest = {
  type: string
  label?: string
  target?: string
  payload?: Readonly<Record<string, unknown>>
}

export type ActionResult = {
  success: boolean
  executed: boolean
  reason?: string
  error?: string
  metadata?: Readonly<Record<string, unknown>>
}

export type ActionHandler = {
  type: string
  handle: (action: ActionRequest) => Promise<ActionResult> | ActionResult
}
