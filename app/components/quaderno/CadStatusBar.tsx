type CadStatusBarProps = {
  zoom: number;
  snapAttivo: boolean;
  gridAttivo: boolean;
  orthoAttivo: boolean;
  polarAttivo: boolean;
  layerAttivo: string;
  scala: string;
};

export default function CadStatusBar({
  zoom,
  snapAttivo,
  gridAttivo,
  orthoAttivo,
  polarAttivo,
  layerAttivo,
  scala,
}: CadStatusBarProps) {
  return (
    <div
      style={{
        width: "100%",
        minHeight: 34,
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
        padding: "6px 10px",
        borderTop: "1px solid #cbd5e1",
        background: "#f8fafc",
        color: "#334155",
        fontSize: 12,
        boxSizing: "border-box",
      }}
    >
      <span>X: 0</span>
      <span>Y: 0</span>

      <span>Zoom {Math.round(zoom * 100)}%</span>

      <strong>SNAP {snapAttivo ? "ON" : "OFF"}</strong>

      <strong>GRID {gridAttivo ? "ON" : "OFF"}</strong>

      <strong>ORTHO {orthoAttivo ? "ON" : "OFF"}</strong>

      <strong>POLAR {polarAttivo ? "ON" : "OFF"}</strong>

      <span>
        Layer: <strong>{layerAttivo}</strong>
      </span>

      <span>
        Scala: <strong>{scala}</strong>
      </span>
    </div>
  );
}