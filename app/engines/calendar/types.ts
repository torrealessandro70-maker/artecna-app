export type CalendarEventDraft = {
  title: string
  date: string
  startTime: string
  endTime?: string
  description?: string
  location?: string
  timeZone?: string
}

export type CalendarProvider =
  | 'google'
  | 'outlook'
  | 'apple_ics'
  | 'internal'

export type CalendarCreateResult = {
  success: boolean
  provider: CalendarProvider
  eventId?: string
  externalUrl?: string
  error?: string
}
