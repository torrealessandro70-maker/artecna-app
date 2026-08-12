export type CadAreaPoint = {
  x: number;
  y: number;
};

export type CadAreaState = {
  points: CadAreaPoint[];
  cursorPoint: CadAreaPoint | null;
  closed: boolean;
nearFirstPoint: boolean;
};


