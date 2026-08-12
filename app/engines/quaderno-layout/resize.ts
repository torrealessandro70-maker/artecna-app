import type {
  BackgroundTransform,
  ResizeHandle,
} from './types'

const MIN_SIZE = 40

export const resizeBackground = (
  transform: BackgroundTransform,
  handle: ResizeHandle,
  deltaX: number,
  deltaY: number,
): BackgroundTransform => {
  switch (handle) {
    case 'right':
      return {
        ...transform,
        width: Math.max(
          MIN_SIZE,
          transform.width + deltaX,
        ),
      }

    case 'left': {
      const nuovaWidth = Math.max(
        MIN_SIZE,
        transform.width - deltaX,
      )

      const deltaApplicato =
        transform.width - nuovaWidth

      return {
        ...transform,
        x: transform.x + deltaApplicato,
        width: nuovaWidth,
      }
    }

    case 'bottom':
      return {
        ...transform,
        height: Math.max(
          MIN_SIZE,
          transform.height + deltaY,
        ),
      }

    case 'top': {
      const nuovaHeight = Math.max(
        MIN_SIZE,
        transform.height - deltaY,
      )

      const deltaApplicato =
        transform.height - nuovaHeight

      return {
        ...transform,
        y: transform.y + deltaApplicato,
        height: nuovaHeight,
      }
    }

    case 'bottom-right':
      return {
        ...transform,
        width: Math.max(
          MIN_SIZE,
          transform.width + deltaX,
        ),
        height: Math.max(
          MIN_SIZE,
          transform.height + deltaY,
        ),
      }

    case 'bottom-left': {
      const nuovaWidth = Math.max(
        MIN_SIZE,
        transform.width - deltaX,
      )

      const deltaApplicato =
        transform.width - nuovaWidth

      return {
        ...transform,
        x: transform.x + deltaApplicato,
        width: nuovaWidth,
        height: Math.max(
          MIN_SIZE,
          transform.height + deltaY,
        ),
      }
    }

    case 'top-right': {
      const nuovaHeight = Math.max(
        MIN_SIZE,
        transform.height - deltaY,
      )

      const deltaApplicato =
        transform.height - nuovaHeight

      return {
        ...transform,
        y: transform.y + deltaApplicato,
        width: Math.max(
          MIN_SIZE,
          transform.width + deltaX,
        ),
        height: nuovaHeight,
      }
    }

    case 'top-left': {
      const nuovaWidth = Math.max(
        MIN_SIZE,
        transform.width - deltaX,
      )

      const nuovaHeight = Math.max(
        MIN_SIZE,
        transform.height - deltaY,
      )

      const deltaXApplicato =
        transform.width - nuovaWidth

      const deltaYApplicato =
        transform.height - nuovaHeight

      return {
        ...transform,
        x: transform.x + deltaXApplicato,
        y: transform.y + deltaYApplicato,
        width: nuovaWidth,
        height: nuovaHeight,
      }
    }

    default:
      return transform
  }
}