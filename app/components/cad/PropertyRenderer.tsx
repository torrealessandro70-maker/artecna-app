"use client";

import type {
  CadPropertyDescriptor,
} from "@/app/engines/cad/property-engine";

type PropertyRendererProps = {
  properties: CadPropertyDescriptor[];
};

export default function PropertyRenderer({
  properties,
}: PropertyRendererProps) {
  return (
    <>
      {properties.map((property) => {
        if (property.type === "number") {
          return (
            <label
              key={property.id}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>{property.label}:</span>

              <input
                type="number"
                value={
                  typeof property.value === "number" ||
                  typeof property.value === "string"
                    ? property.value
                    : ""
                }
                onChange={(event) => {
                  property.onChange?.(
                    event.target.value,
                  )
                }}
                style={{
                  width: 64,
                  height: 24,
                  padding: "2px 6px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 5,
                  textAlign: "center",
                  fontSize: 13,
                }}
              />
            </label>
          )
        }

       return null
      })}
    </>
  )
}