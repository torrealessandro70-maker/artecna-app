import { registerBehavior } from './registry'

import { lineBehavior } from './line.behavior'
import { freehandBehavior } from './freehand.behavior'
import { pinBehavior } from './pin.behavior'
import { imageBehavior } from './image.behavior'
import { dimensionBehavior } from './dimension.behavior'

let initialized = false

export const registerDefaultBehaviors = (): void => {
  if (initialized) {
    return
  }

  registerBehavior(lineBehavior)
registerBehavior(freehandBehavior)
registerBehavior(pinBehavior)
registerBehavior(imageBehavior)
registerBehavior(dimensionBehavior)

  initialized = true
}