export type QuadernoPageFormat =
  | 'A4'
  | 'A3'

export type QuadernoPageOrientation =
  | 'portrait'
  | 'landscape'

export type QuadernoPageLayout = {
  format: QuadernoPageFormat
  orientation: QuadernoPageOrientation
  width: number
  height: number
  margin: number
}
