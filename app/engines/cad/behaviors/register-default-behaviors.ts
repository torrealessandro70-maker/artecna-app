import { registerBehavior } from './registry'

import { textBehavior } from './text.behavior'
import { lineBehavior } from './line.behavior'
import { freehandBehavior } from './freehand.behavior'
import { pinBehavior } from './pin.behavior'
import { imageBehavior } from './image.behavior'
import { dimensionBehavior } from './dimension.behavior'
import { areaBehavior } from './area.behavior'
import { rectangleBehavior } from './rectangle.behavior'

let initialized = false

export const registerDefaultBehaviors = (): void => {
  if (initialized) {
    return
  }

  registerBehavior(textBehavior)
  registerBehavior(lineBehavior)
registerBehavior(freehandBehavior)
registerBehavior(pinBehavior)
registerBehavior(imageBehavior)
registerBehavior(dimensionBehavior)
registerBehavior(areaBehavior)
registerBehavior(rectangleBehavior)

  initialized = true
}