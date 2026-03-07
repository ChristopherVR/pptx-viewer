import React from "react";

// ---------------------------------------------------------------------------
// SVG Mini-Thumbnails for SmartArt layouts
// ---------------------------------------------------------------------------

export function ProcessThumb(): React.ReactElement {
  return (
    <svg viewBox="0 0 48 32" className="w-full h-full">
      <rect
        x="2"
        y="10"
        width="10"
        height="12"
        rx="2"
        fill="currentColor"
        opacity={0.7}
      />
      <path
        d="M14 16 L17 16"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity={0.5}
      />
      <rect
        x="19"
        y="10"
        width="10"
        height="12"
        rx="2"
        fill="currentColor"
        opacity={0.7}
      />
      <path
        d="M31 16 L34 16"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity={0.5}
      />
      <rect
        x="36"
        y="10"
        width="10"
        height="12"
        rx="2"
        fill="currentColor"
        opacity={0.7}
      />
    </svg>
  );
}

export function HierarchyThumb(): React.ReactElement {
  return (
    <svg viewBox="0 0 48 32" className="w-full h-full">
      <rect
        x="17"
        y="2"
        width="14"
        height="8"
        rx="2"
        fill="currentColor"
        opacity={0.7}
      />
      <path
        d="M24 10 L12 18 M24 10 L36 18"
        stroke="currentColor"
        strokeWidth="1"
        opacity={0.5}
      />
      <rect
        x="4"
        y="18"
        width="14"
        height="8"
        rx="2"
        fill="currentColor"
        opacity={0.7}
      />
      <rect
        x="30"
        y="18"
        width="14"
        height="8"
        rx="2"
        fill="currentColor"
        opacity={0.7}
      />
    </svg>
  );
}

export function CycleThumb(): React.ReactElement {
  return (
    <svg viewBox="0 0 48 32" className="w-full h-full">
      <circle cx="24" cy="5" r="4" fill="currentColor" opacity={0.7} />
      <circle cx="37" cy="20" r="4" fill="currentColor" opacity={0.7} />
      <circle cx="11" cy="20" r="4" fill="currentColor" opacity={0.7} />
      <path
        d="M28 6 L34 17 M33 23 L14 23 M14 18 L20 7"
        stroke="currentColor"
        strokeWidth="1"
        opacity={0.4}
        fill="none"
      />
    </svg>
  );
}

export function MatrixThumb(): React.ReactElement {
  return (
    <svg viewBox="0 0 48 32" className="w-full h-full">
      <rect
        x="4"
        y="3"
        width="18"
        height="11"
        rx="2"
        fill="currentColor"
        opacity={0.7}
      />
      <rect
        x="26"
        y="3"
        width="18"
        height="11"
        rx="2"
        fill="currentColor"
        opacity={0.7}
      />
      <rect
        x="4"
        y="18"
        width="18"
        height="11"
        rx="2"
        fill="currentColor"
        opacity={0.7}
      />
      <rect
        x="26"
        y="18"
        width="18"
        height="11"
        rx="2"
        fill="currentColor"
        opacity={0.7}
      />
    </svg>
  );
}

export function PyramidThumb(): React.ReactElement {
  return (
    <svg viewBox="0 0 48 32" className="w-full h-full">
      <rect
        x="16"
        y="2"
        width="16"
        height="8"
        rx="2"
        fill="currentColor"
        opacity={0.7}
      />
      <rect
        x="10"
        y="12"
        width="28"
        height="8"
        rx="2"
        fill="currentColor"
        opacity={0.7}
      />
      <rect
        x="4"
        y="22"
        width="40"
        height="8"
        rx="2"
        fill="currentColor"
        opacity={0.7}
      />
    </svg>
  );
}

export function ListThumb(): React.ReactElement {
  return (
    <svg viewBox="0 0 48 32" className="w-full h-full">
      <rect
        x="4"
        y="3"
        width="40"
        height="7"
        rx="2"
        fill="currentColor"
        opacity={0.7}
      />
      <rect
        x="4"
        y="13"
        width="40"
        height="7"
        rx="2"
        fill="currentColor"
        opacity={0.7}
      />
      <rect
        x="4"
        y="23"
        width="40"
        height="7"
        rx="2"
        fill="currentColor"
        opacity={0.7}
      />
    </svg>
  );
}

export const THUMB_COMPONENTS: Record<string, () => React.ReactElement> = {
  process: ProcessThumb,
  hierarchy: HierarchyThumb,
  cycle: CycleThumb,
  matrix: MatrixThumb,
  pyramid: PyramidThumb,
  list: ListThumb,
};
