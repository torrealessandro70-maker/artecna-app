export type QuadernoLayerId =
  | 'background'
  | 'images'
  | 'drawing'
  | 'pins'
  | `layer-${string}`


export interface QuadernoLayer {
  id: QuadernoLayerId
  name: string
  visible: boolean
  locked: boolean
  selectable: boolean
  order: number
}