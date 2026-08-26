import type { BackgroundTransform } from "@/app/engines/quaderno-layout"

export type ImageNaturalSize = {
  width: number
  height: number
}

export const calculateVisibleImageRect = (
  transform: BackgroundTransform,
  naturalSize: ImageNaturalSize | null,
): BackgroundTransform => {
  if (
    !naturalSize ||
    naturalSize.width <= 0 ||
    naturalSize.height <= 0
  ) {
    return transform
  }

  const imageRatio =
    naturalSize.width /
    naturalSize.height

  const containerRatio =
    transform.width /
    transform.height

  if (imageRatio > containerRatio) {
    const width = transform.width
    const height = width / imageRatio

    return {
      ...transform,
      x: transform.x,
      y:
        transform.y +
        (transform.height - height) / 2,
      width,
      height,
    }
  }

  const height = transform.height
  const width = height * imageRatio

  return {
    ...transform,
    x:
      transform.x +
      (transform.width - width) / 2,
    y: transform.y,
    width,
    height,
  }
}
