import {
  getBehavior,
  registerDefaultBehaviors,
} from "../behaviors";
import {
  isCadLineEntity,
  type CadEntity,
} from "../entities";
import { midpointBetweenPoints } from "./geometry";
import type { SnapCandidate } from "./types";

export const buildSnapCandidates = (
  entities: CadEntity[],
): SnapCandidate[] => {
  registerDefaultBehaviors();

  const candidates: SnapCandidate[] = [];

  entities.forEach((entity) => {
    if (
      entity.visible === false ||
      entity.locked ||
      entity.selectable === false
    ) {
      return;
    }

    const behavior = getBehavior(entity.type);
    const gripPoints =
      behavior?.getGripPoints?.(entity as never);

    if (gripPoints && gripPoints.length > 0) {
      gripPoints.forEach((point) => {
        candidates.push({
          type: "endpoint",
          point: {
            x: point.x,
            y: point.y,
          },
          distance: Number.POSITIVE_INFINITY,
          entityId: entity.id,
          layerId: entity.layerId,
        });
      });
    }

    if (isCadLineEntity(entity)) {
      const midpoint = midpointBetweenPoints(
        entity.start,
        entity.end,
      );

      candidates.push({
        type: "midpoint",
        point: midpoint,
        distance: Number.POSITIVE_INFINITY,
        entityId: entity.id,
        layerId: entity.layerId,
      });
    }
  });

  return candidates;
};
