import { createProperties } from "./property-utils";

export const textProperties =
  createProperties([
    {
      id: "text",
      label: "Testo",
      type: "text",
    },
    {
      id: "fontFamily",
      label: "Font",
      type: "select",
    },
    {
      id: "fontSize",
      label: "Dimensione",
      type: "number",
    },
    {
      id: "fontWeight",
      label: "Grassetto",
      type: "boolean",
    },
    {
      id: "fontStyle",
      label: "Corsivo",
      type: "boolean",
    },
  ]);