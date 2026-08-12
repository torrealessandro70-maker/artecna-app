"use client";

import type { CSSProperties } from "react";
import {
  getPropertiesForType,
} from "@/app/engines/cad/property-engine";
import PropertyRenderer from "./PropertyRenderer";

type TextPropertiesToolbarProps = {
  testo: string;

  dimensione: string;
  onCambiaDimensione: (
    valore: string,
  ) => void;
  onApplicaDimensione: () => void;

  font: string;
  onCambiaFont: (
    valore: string,
  ) => void;

  grassetto: boolean;
  onToggleGrassetto: () => void;

  corsivo: boolean;
  onToggleCorsivo: () => void;

  buttonStyle: CSSProperties;
};

export default function TextPropertiesToolbar({
  testo,
  dimensione,
  onCambiaDimensione,
  onApplicaDimensione,
  font,
  onCambiaFont,
  grassetto,
  onToggleGrassetto,
  corsivo,
  onToggleCorsivo,
  buttonStyle,
}: TextPropertiesToolbarProps) {
  const proprietaTesto =
    getPropertiesForType("text")

const proprietaTestoRuntime =
  proprietaTesto.map((property) => {
    if (property.id === "fontSize") {
      return {
        ...property,
        value: dimensione,
        onChange: (value: unknown) => {
          onCambiaDimensione(
            String(value ?? ""),
          )
        },
      }
    }

    return property
  })
const renderer =
  <PropertyRenderer
    properties={proprietaTestoRuntime}
  />
 return (
  <div
    data-property-count={
      proprietaTesto.length
    }
    style={{
      display: "contents",
    }}
  >
<div
  style={{
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  }}
>
  {renderer}
</div>

      <span>|</span>
      <span>Testo</span>

      <span>|</span>
      <span>{testo || "---"}</span>

      <span>|</span>
      <span>Dim.:</span>

      <input
        type="number"
        min="6"
        max="200"
        step="1"
        value={dimensione}
        onChange={(event) =>
          onCambiaDimensione(event.target.value)
        }
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            onApplicaDimensione();
          }
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

      <span>px</span>

      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onApplicaDimensione();
        }}
        style={{
          ...buttonStyle,
          height: 26,
          minHeight: 26,
          padding: "2px 8px",
          fontSize: 12,
        }}
      >
        Applica
      </button>
<span>|</span>

<span>Font:</span>

<select
  value={font}
  onChange={(event) => {
    onCambiaFont(event.target.value);
  }}
  style={{
    height: 26,
    border: "1px solid #cbd5e1",
    borderRadius: 5,
    padding: "2px 6px",
    fontSize: 13,
  }}
>
  <option value="Arial">Arial</option>
  <option value="Calibri">Calibri</option>
  <option value="Roboto">Roboto</option>
  <option value="Times New Roman">
    Times New Roman
  </option>
  <option value="Courier New">
    Courier New
  </option>
</select>

<button
  type="button"
  aria-pressed={grassetto}
  title="Grassetto"
  onClick={(event) => {
    event.preventDefault();
    event.stopPropagation();
    onToggleGrassetto();
  }}
  style={{
    ...buttonStyle,
    width: 28,
    minWidth: 28,
    height: 26,
    minHeight: 26,
    padding: 0,
    fontSize: 14,
    fontWeight: 800,
    background: grassetto
      ? "#dbeafe"
      : buttonStyle.background,
    boxShadow: grassetto
      ? "0 0 0 2px #2563eb"
      : "none",
  }}
>
  B
</button>

<button
  type="button"
  aria-pressed={corsivo}
  title="Corsivo"
  onClick={(event) => {
    event.preventDefault();
    event.stopPropagation();
    onToggleCorsivo();
  }}
  style={{
    ...buttonStyle,
    width: 28,
    minWidth: 28,
    height: 26,
    minHeight: 26,
    padding: 0,
    fontSize: 14,
    fontStyle: "italic",
    background: corsivo
      ? "#dbeafe"
      : buttonStyle.background,
    boxShadow: corsivo
      ? "0 0 0 2px #2563eb"
      : "none",
  }}
>
  I
</button>
     </div>
  );
}