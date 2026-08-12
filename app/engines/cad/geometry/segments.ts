import type { SegnoNota } from "@/app/components/note/types";

export type GeometrySegment = {
  entityId: string;
  edgeIndex: number;

  start: {
    x: number;
    y: number;
  };

  end: {
    x: number;
    y: number;
  };
};
export function getGeometrySegments(
  segno: SegnoNota,
): GeometrySegment[] {
  switch (segno.strumento) {
    case "linea": {
      if (segno.punti.length < 2) {
        return [];
      }

      return [
        {
          entityId: segno.id,
          edgeIndex: 0,
          start: segno.punti[0],
          end: segno.punti[1],
        },
      ];
    }

    case "rettangolo": {
      if (segno.punti.length < 2) {
        return [];
      }

      const p1 = segno.punti[0];
      const p2 = segno.punti[1];

      const a = {
        x: Math.min(p1.x, p2.x),
        y: Math.min(p1.y, p2.y),
      };

      const c = {
        x: Math.max(p1.x, p2.x),
        y: Math.max(p1.y, p2.y),
      };

      const b = {
        x: c.x,
        y: a.y,
      };

      const d = {
        x: a.x,
        y: c.y,
      };

      return [
        {
          entityId: segno.id,
          edgeIndex: 0,
          start: a,
          end: b,
        },
        {
          entityId: segno.id,
          edgeIndex: 1,
          start: b,
          end: c,
        },
        {
          entityId: segno.id,
          edgeIndex: 2,
          start: c,
          end: d,
        },
        {
          entityId: segno.id,
          edgeIndex: 3,
          start: d,
          end: a,
        },
      ];
    }

    default:
      return [];
  }
}