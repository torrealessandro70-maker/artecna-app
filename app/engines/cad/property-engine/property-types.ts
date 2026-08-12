export type CadPropertyType =
  | "text"
  | "line"
  | "rectangle"
  | "circle"
  | "image"
  | "dimension"
  | "symbol";

export interface CadPropertyDescriptor {
  id: string;

  label: string;

  type:
    | "text"
    | "number"
    | "boolean"
    | "color"
    | "select";

  value?: unknown;

  options?: {
    label: string;
    value: string;
  }[];

  onChange?: (
    value: unknown,
  ) => void;
}