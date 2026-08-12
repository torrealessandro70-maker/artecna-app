import {
  DEFAULT_SNAP_SETTINGS,
  type SnapCandidate,
  type SnapPoint,
  type SnapResult,
  type SnapSettings,
} from "./types";
import { findNearestSnapCandidate } from "./geometry";

export const resolveSnap = (
  pointer: SnapPoint,
  candidates: SnapCandidate[],
  settings: SnapSettings = DEFAULT_SNAP_SETTINGS,
): SnapResult => {
  if (!settings.enabled) {
    return {
      snapped: false,
    };
  }

  const enabledCandidates = candidates.filter((candidate) => {
    switch (candidate.type) {
      case "endpoint":
        return settings.endpoint;

      case "midpoint":
        return settings.midpoint;

      case "intersection":
        return settings.intersection;

      case "vertex":
        return settings.vertex;

      default:
        return false;
    }
  });

  const candidatesWithDistance = enabledCandidates.map((candidate) => ({
    ...candidate,
    distance: Math.hypot(
      candidate.point.x - pointer.x,
      candidate.point.y - pointer.y,
    ),
  }));

  const nearestCandidate = findNearestSnapCandidate(
    candidatesWithDistance,
    settings.tolerance,
  );

  if (!nearestCandidate) {
    return {
      snapped: false,
    };
  }

  return {
    snapped: true,
    candidate: nearestCandidate,
  };
};
