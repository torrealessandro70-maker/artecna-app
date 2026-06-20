import * as documentIntelligence from '../document-intelligence'
import * as fascicle from '../fascicle'

export const engineRegistry = {
  documentIntelligence,
  fascicle,
  knowledge: null,
  workflow: null,
  blueprint: null,
  decision: null,
  communication: null,
  analytics: null,
  identity: null,
  time: null,
} as const
