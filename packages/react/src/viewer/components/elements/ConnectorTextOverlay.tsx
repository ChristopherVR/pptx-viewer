import type { TextStyle } from "pptx-viewer-core";

export interface ConnectorTextOverlayProps {
  connectorText: string;
  connectorTextSegments: ReadonlyArray<{
    text: string;
    style?: {
      fontFamily?: string;
      fontSize?: number;
      color?: string;
      bold?: boolean;
      italic?: boolean;
      underline?: boolean;
    };
  }>;
  connectorTextStyle?: TextStyle;
}

export function ConnectorTextOverlay({
  connectorText,
  connectorTextSegments,
  connectorTextStyle,
}: ConnectorTextOverlayProps) {
  if (
    !connectorText ||
    !connectorTextSegments ||
    connectorTextSegments.length === 0
  ) {
    return null;
  }
  return (
    <div
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      style={{
        pointerEvents: "none",
        textAlign: (connectorTextStyle?.align === "justLow" || connectorTextStyle?.align === "dist" || connectorTextStyle?.align === "thaiDist" ? "justify" : connectorTextStyle?.align) ?? "center",
      }}
    >
      <div
        className="px-1"
        style={{
          fontFamily: connectorTextStyle?.fontFamily ?? "inherit",
          fontSize: connectorTextStyle?.fontSize
            ? `${connectorTextStyle.fontSize}pt`
            : "10pt",
          color: connectorTextStyle?.color ?? "#000000",
          fontWeight: connectorTextStyle?.bold ? "bold" : "normal",
          fontStyle: connectorTextStyle?.italic ? "italic" : "normal",
          textDecoration: connectorTextStyle?.underline ? "underline" : "none",
          whiteSpace: "pre-wrap",
          lineHeight: 1.2,
          maxWidth: "100%",
        }}
      >
        {connectorTextSegments.map((seg, idx) => (
          <span
            key={idx}
            style={{
              fontFamily:
                seg.style?.fontFamily ??
                connectorTextStyle?.fontFamily ??
                "inherit",
              fontSize: seg.style?.fontSize
                ? `${seg.style.fontSize}pt`
                : undefined,
              color: seg.style?.color ?? connectorTextStyle?.color ?? "#000000",
              fontWeight: seg.style?.bold
                ? "bold"
                : connectorTextStyle?.bold
                  ? "bold"
                  : "normal",
              fontStyle: seg.style?.italic
                ? "italic"
                : connectorTextStyle?.italic
                  ? "italic"
                  : "normal",
              textDecoration: seg.style?.underline ? "underline" : "none",
            }}
          >
            {seg.text}
          </span>
        ))}
      </div>
    </div>
  );
}
