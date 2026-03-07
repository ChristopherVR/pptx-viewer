import type React from "react";

// ---------------------------------------------------------------------------
// Option arrays for fill / stroke properties
// ---------------------------------------------------------------------------

export const COMPOUND_LINE_OPTIONS = [
  { value: "sng", label: "Single" },
  { value: "dbl", label: "Double" },
  { value: "thickThin", label: "Thick-Thin" },
  { value: "thinThick", label: "Thin-Thick" },
  { value: "tri", label: "Triple" },
];

export const LINE_JOIN_OPTIONS = [
  { value: "round", label: "Round" },
  { value: "bevel", label: "Bevel" },
  { value: "miter", label: "Miter" },
];

export const LINE_CAP_OPTIONS = [
  { value: "flat", label: "Flat" },
  { value: "rnd", label: "Round" },
  { value: "sq", label: "Square" },
];

export const FILL_MODE_OPTIONS = [
  { value: "solid", label: "Solid" },
  { value: "gradient", label: "Gradient" },
  { value: "pattern", label: "Pattern" },
  { value: "image", label: "Image" },
  { value: "none", label: "None" },
];

export const PATTERN_PRESET_OPTIONS = [
  { value: "pct5", label: "5%" },
  { value: "pct10", label: "10%" },
  { value: "pct20", label: "20%" },
  { value: "pct25", label: "25%" },
  { value: "pct30", label: "30%" },
  { value: "pct40", label: "40%" },
  { value: "pct50", label: "50%" },
  { value: "pct60", label: "60%" },
  { value: "pct70", label: "70%" },
  { value: "pct75", label: "75%" },
  { value: "pct80", label: "80%" },
  { value: "pct90", label: "90%" },
  { value: "horz", label: "Horizontal" },
  { value: "vert", label: "Vertical" },
  { value: "ltHorz", label: "Light Horizontal" },
  { value: "ltVert", label: "Light Vertical" },
  { value: "dkHorz", label: "Dark Horizontal" },
  { value: "dkVert", label: "Dark Vertical" },
  { value: "narHorz", label: "Narrow Horizontal" },
  { value: "narVert", label: "Narrow Vertical" },
  { value: "wdHorz", label: "Wide Horizontal" },
  { value: "wdVert", label: "Wide Vertical" },
  { value: "dashHorz", label: "Dashed Horizontal" },
  { value: "dashVert", label: "Dashed Vertical" },
  { value: "cross", label: "Cross" },
  { value: "dnDiag", label: "Down Diagonal" },
  { value: "upDiag", label: "Up Diagonal" },
  { value: "ltDnDiag", label: "Light Down Diagonal" },
  { value: "ltUpDiag", label: "Light Up Diagonal" },
  { value: "dkDnDiag", label: "Dark Down Diagonal" },
  { value: "dkUpDiag", label: "Dark Up Diagonal" },
  { value: "wdDnDiag", label: "Wide Down Diagonal" },
  { value: "wdUpDiag", label: "Wide Up Diagonal" },
  { value: "dashDnDiag", label: "Dashed Down Diagonal" },
  { value: "dashUpDiag", label: "Dashed Up Diagonal" },
  { value: "diagCross", label: "Diagonal Cross" },
  { value: "smCheck", label: "Small Check" },
  { value: "lgCheck", label: "Large Check" },
  { value: "smGrid", label: "Small Grid" },
  { value: "lgGrid", label: "Large Grid" },
  { value: "dotGrid", label: "Dot Grid" },
  { value: "smConfetti", label: "Small Confetti" },
  { value: "lgConfetti", label: "Large Confetti" },
  { value: "horzBrick", label: "Horizontal Brick" },
  { value: "diagBrick", label: "Diagonal Brick" },
  { value: "solidDmnd", label: "Solid Diamond" },
  { value: "openDmnd", label: "Open Diamond" },
  { value: "dotDmnd", label: "Dotted Diamond" },
  { value: "plaid", label: "Plaid" },
  { value: "sphere", label: "Sphere" },
  { value: "weave", label: "Weave" },
  { value: "divot", label: "Divot" },
  { value: "shingle", label: "Shingle" },
  { value: "wave", label: "Wave" },
  { value: "trellis", label: "Trellis" },
  { value: "zigZag", label: "Zig Zag" },
];

export const GRADIENT_TYPE_OPTIONS = [
  { value: "linear", label: "Linear" },
  { value: "radial", label: "Radial" },
];

export const IMAGE_MODE_OPTIONS = [
  { value: "stretch", label: "Stretch" },
  { value: "tile", label: "Tile" },
];

/**
 * Generate preview style for compound line types.
 * Shows a horizontal line with the appropriate visual appearance.
 */
export function getCompoundLinePreviewStyle(type: string): React.CSSProperties {
  const baseColor = "#6b7280"; // gray-500

  switch (type) {
    case "sng":
      return {
        borderTop: `2px solid ${baseColor}`,
        width: "100%",
      };

    case "dbl": {
      const lineWidth = 2;
      const gap = 2;
      return {
        position: "relative" as const,
        height: `${lineWidth * 2 + gap}px`,
        width: "100%",
        boxShadow: `inset 0 ${lineWidth + gap}px 0 ${-lineWidth}px ${baseColor}, inset 0 ${-(lineWidth + gap)}px 0 ${-lineWidth}px ${baseColor}`,
      };
    }

    case "thickThin": {
      const thickWidth = 3;
      const thinWidth = 1;
      const gap = 1;
      return {
        position: "relative" as const,
        height: `${thickWidth + thinWidth + gap}px`,
        width: "100%",
        boxShadow: `inset 0 ${thickWidth / 2 + gap}px 0 ${-thickWidth}px ${baseColor}, inset 0 ${-(thickWidth / 2 + gap + thinWidth)}px 0 ${-thinWidth}px ${baseColor}`,
      };
    }

    case "thinThick": {
      const thinWidth = 1;
      const thickWidth = 3;
      const gap = 1;
      return {
        position: "relative" as const,
        height: `${thinWidth + thickWidth + gap}px`,
        width: "100%",
        boxShadow: `inset 0 ${thickWidth / 2 + gap}px 0 ${-thinWidth}px ${baseColor}, inset 0 ${-(thickWidth / 2 + gap + thinWidth)}px 0 ${-thickWidth}px ${baseColor}`,
      };
    }

    case "tri": {
      const lineWidth = 1;
      const gap = 1;
      const offset1 = lineWidth + gap;
      const offset2 = (lineWidth + gap) * 2;
      return {
        position: "relative" as const,
        height: `${lineWidth * 3 + gap * 2}px`,
        width: "100%",
        boxShadow: `inset 0 0 0 ${-lineWidth}px ${baseColor}, inset 0 ${offset1}px 0 ${-lineWidth}px ${baseColor}, inset 0 ${-offset2}px 0 ${-lineWidth}px ${baseColor}`,
      };
    }

    default:
      return {};
  }
}
