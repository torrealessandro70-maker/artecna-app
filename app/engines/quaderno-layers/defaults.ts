import type { QuadernoLayer } from './types'

export const DEFAULT_QUADERNO_LAYERS: QuadernoLayer[] = [
  {
    id: 'background',
    name: 'Sfondo',
    visible: true,
    locked: false,
    selectable: true,
    order: 0,
  },
  {
    id: 'images',
    name: 'Immagini',
    visible: true,
    locked: false,
    selectable: true,
    order: 1,
  },
  {
    id: 'drawing',
    name: 'Disegni',
    visible: true,
    locked: false,
    selectable: true,
    order: 2,
  },
  {
    id: 'pins',
    name: 'Pin',
    visible: true,
    locked: false,
    selectable: true,
    order: 3,
  },
]