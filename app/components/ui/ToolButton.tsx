"use client";

import type {
  ButtonHTMLAttributes,
  CSSProperties,
  ReactNode,
} from "react";

import { UI_THEME } from "./theme";

export interface ToolButtonProps
  extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "children"
  > {
  icon: ReactNode;
  label: string;
  active?: boolean;
  compact?: boolean;
}

export default function ToolButton({
  icon,
  label,
  active = false,
  compact = false,
  style,
  disabled = false,
  ...props
}: ToolButtonProps) {
 

  const buttonStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: compact
      ? "center"
      : "flex-start",
    gap: compact ? 0 : 8,

   width: compact
  ? UI_THEME.button.size
  : "100%",
    minWidth: compact
  ? UI_THEME.button.size
  : 0,
    height: UI_THEME.button.size,
    minHeight: UI_THEME.button.size,

    padding: compact
      ? 0
      : "0 10px",

    borderRadius: UI_THEME.radius.lg,
    border: active
  ? `1px solid ${UI_THEME.colors.primary}`
  : `1px solid ${UI_THEME.colors.border}`,

    background: active
  ? UI_THEME.colors.primarySoft
  : UI_THEME.colors.background,

    color: disabled
  ? UI_THEME.colors.disabled
  : UI_THEME.colors.text,

    boxShadow: active
  ? UI_THEME.shadow.active
  : "none",

    cursor: disabled
      ? "not-allowed"
      : "pointer",

    opacity: disabled ? 0.65 : 1,

    transition: "all .15s ease",

    fontSize: UI_THEME.button.font,
    fontWeight: 600,
    lineHeight: 1,
    overflow: "hidden",
    whiteSpace: "nowrap",

    ...style,
  };

  return (
    <button
      {...props}
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      title={props.title ?? label}
      style={buttonStyle}
    >
      <span
        aria-hidden="true"
        style={{
          width: 20,
          height: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          fontSize: UI_THEME.button.icon,
          lineHeight: 1,
        }}
      >
        {icon}
      </span>

      {!compact && (
        <span
          style={{
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </span>
      )}
    </button>
  );
}