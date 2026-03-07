import React from "react";

import type { SmartArtLayout } from "pptx-viewer-core";

// ── Palette ──────────────────────────────────────────────────────────────────

const PREVIEW_COLORS = ["#3b82f6", "#22c55e", "#f97316", "#eab308"];

// ── Individual preview thumbnails ────────────────────────────────────────────

function PreviewBlockList(): React.ReactElement {
  return (
    <svg viewBox="0 0 60 40" className="w-full h-full">
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={4}
          y={3 + i * 12}
          width={52}
          height={10}
          rx={2}
          fill={PREVIEW_COLORS[i]}
          opacity={0.85}
        />
      ))}
    </svg>
  );
}

function PreviewChevronProcess(): React.ReactElement {
  return (
    <svg viewBox="0 0 60 40" className="w-full h-full">
      {[0, 1, 2].map((i) => {
        const x = 2 + i * 19;
        const points = `${x},10 ${x + 14},10 ${x + 18},20 ${x + 14},30 ${x},30 ${i > 0 ? x + 4 : x},20`;
        return (
          <polygon
            key={i}
            points={points}
            fill={PREVIEW_COLORS[i]}
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
}

function PreviewCycle(): React.ReactElement {
  return (
    <svg viewBox="0 0 60 40" className="w-full h-full">
      {[0, 1, 2, 3].map((i) => {
        const angle = (i / 4) * Math.PI * 2 - Math.PI / 2;
        const cx = 30 + 13 * Math.cos(angle);
        const cy = 20 + 10 * Math.sin(angle);
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={6}
            fill={PREVIEW_COLORS[i]}
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
}

function PreviewHierarchy(): React.ReactElement {
  return (
    <svg viewBox="0 0 60 40" className="w-full h-full">
      <rect
        x={20}
        y={3}
        width={20}
        height={10}
        rx={2}
        fill={PREVIEW_COLORS[0]}
        opacity={0.85}
      />
      <line x1={30} y1={13} x2={30} y2={18} stroke="#94a3b8" strokeWidth={1} />
      <line x1={15} y1={18} x2={45} y2={18} stroke="#94a3b8" strokeWidth={1} />
      <rect
        x={4}
        y={20}
        width={18}
        height={10}
        rx={2}
        fill={PREVIEW_COLORS[1]}
        opacity={0.85}
      />
      <rect
        x={38}
        y={20}
        width={18}
        height={10}
        rx={2}
        fill={PREVIEW_COLORS[2]}
        opacity={0.85}
      />
      <line x1={15} y1={18} x2={15} y2={20} stroke="#94a3b8" strokeWidth={1} />
      <line x1={45} y1={18} x2={45} y2={20} stroke="#94a3b8" strokeWidth={1} />
    </svg>
  );
}

function PreviewVenn(): React.ReactElement {
  return (
    <svg viewBox="0 0 60 40" className="w-full h-full">
      <circle cx={22} cy={20} r={14} fill={PREVIEW_COLORS[0]} opacity={0.3} />
      <circle cx={38} cy={20} r={14} fill={PREVIEW_COLORS[1]} opacity={0.3} />
      <circle cx={30} cy={10} r={14} fill={PREVIEW_COLORS[2]} opacity={0.3} />
    </svg>
  );
}

function PreviewRadial(): React.ReactElement {
  return (
    <svg viewBox="0 0 60 40" className="w-full h-full">
      <circle cx={30} cy={20} r={7} fill={PREVIEW_COLORS[0]} opacity={0.85} />
      {[0, 1, 2].map((i) => {
        const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
        const cx = 30 + 15 * Math.cos(angle);
        const cy = 20 + 12 * Math.sin(angle);
        return (
          <React.Fragment key={i}>
            <line
              x1={30}
              y1={20}
              x2={cx}
              y2={cy}
              stroke="#94a3b8"
              strokeWidth={1}
              opacity={0.5}
            />
            <circle
              cx={cx}
              cy={cy}
              r={5}
              fill={PREVIEW_COLORS[i + 1]}
              opacity={0.85}
            />
          </React.Fragment>
        );
      })}
    </svg>
  );
}

function PreviewGeneric(): React.ReactElement {
  return (
    <svg viewBox="0 0 60 40" className="w-full h-full">
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={4 + i * 18}
          y={8}
          width={16}
          height={24}
          rx={3}
          fill={PREVIEW_COLORS[i]}
          opacity={0.85}
        />
      ))}
    </svg>
  );
}

// ── Resolver ─────────────────────────────────────────────────────────────────

export function getPreviewForLayout(
  layout: SmartArtLayout,
): React.ReactElement {
  switch (layout) {
    case "basicBlockList":
    case "stackedList":
    case "tableList":
    case "horizontalBulletList":
      return <PreviewBlockList />;
    case "basicChevronProcess":
    case "segmentedProcess":
    case "continuousBlockProcess":
    case "upwardArrow":
      return <PreviewChevronProcess />;
    case "basicCycle":
    case "basicPie":
      return <PreviewCycle />;
    case "basicRadial":
    case "convergingRadial":
      return <PreviewRadial />;
    case "hierarchy":
      return <PreviewHierarchy />;
    case "basicVenn":
    case "linearVenn":
      return <PreviewVenn />;
    default:
      return <PreviewGeneric />;
  }
}
