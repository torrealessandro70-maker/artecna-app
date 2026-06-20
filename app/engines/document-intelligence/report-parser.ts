export interface ReportNarrationContext {
  cantiere?: string
  data?: string
  operaiDisponibili?: string[]
  materialiDisponibili?: string[]
}

export interface ParsedReport {
  confidence: number
  cantiere?: string
  data?: string
  operai: any[]
  materiali: any[]
  lavorazioni: string[]
  note: string
  warnings: string[]
}

/**
 * Flusso futuro:
 *
 * Speech
 *   v
 * Speech To Text
 *   v
 * Report Parser
 *   v
 * Document Intelligence
 *   v
 * Engine Registry
 *   v
 * Rapportino
 *   v
 * Database
 */
export function parseReportNarration(
  narration: string,
  context: ReportNarrationContext
): ParsedReport {
  // Il contesto verra utilizzato quando il parser reale sara collegato.
  void context

  return {
    confidence: 0,
    note: narration,
    operai: [],
    materiali: [],
    lavorazioni: [],
    warnings: ['Parser AI non ancora collegato'],
  }
}
