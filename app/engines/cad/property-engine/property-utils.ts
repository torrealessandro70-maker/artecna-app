import type {
  CadPropertyDescriptor,
  CadPropertyType,
} from "./property-types";

import { textProperties } from "./text-properties";

const propertyRegistry: Record<
  CadPropertyType,
  CadPropertyDescriptor[]
> = {
  text: textProperties,
  line: [],
  rectangle: [],
  circle: [],
  image: [],
  dimension: [],
  symbol: [],
};

export function createProperties(
  properties: CadPropertyDescriptor[],
) {
  return properties;
}

export function getPropertiesForType(
  type: CadPropertyType,
) {
  return propertyRegistry[type];
}