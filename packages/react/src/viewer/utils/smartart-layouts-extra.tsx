/**
 * Additional SmartArt layout renderers for expanded layout support.
 *
 * stepDownProcess, alternatingFlow, descendingProcess, pictureAccentList,
 * verticalBlockList, groupedList, pyramidList, horizontalPictureList,
 * accentProcess, verticalChevronList.
 */
import React from "react";

import type {
  PptxElement,
  PptxSmartArtNode,
  SmartArtStyle,
} from "pptx-viewer-core";
import {
  colour,
  nodeOpacity,
  styleShadow,
  styleStroke,
  truncate,
} from "./smartart-helpers";

// ── Step-Down Process ───────────────────────────────────────────────────────

/** stepDownProcess — diagonal descending steps. */
export function renderStepDownProcess(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const w = element.width;
  const h = element.height;
  const pad = 8;
  const usableW = w - pad * 2;
  const usableH = h - pad * 2;
  const stepW = usableW / nodes.length;
  const stepH = usableH / nodes.length;
  const boxW = stepW * 0.85;
  const boxH = stepH * 0.6;
  const shadow = styleShadow(style);
  const sw = styleStroke(style);

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ filter: shadow }}
    >
      {nodes.map((node, i) => {
        const x = pad + i * stepW;
        const y = pad + i * stepH;
        const fontSize = Math.max(7, Math.min(10, boxW * 0.1));

        return (
          <g key={`${element.id}-stepdown-${node.id}-${i}`}>
            {/* Connector to next step */}
            {i < nodes.length - 1 && (
              <line
                x1={x + boxW}
                y1={y + boxH / 2}
                x2={x + stepW}
                y2={y + stepH + boxH / 2}
                stroke="#94a3b8"
                strokeWidth={1.5}
                opacity={0.5}
              />
            )}
            <rect
              x={x}
              y={y}
              width={boxW}
              height={boxH}
              rx={5}
              fill={colour(i, palette)}
              opacity={nodeOpacity(i, nodes.length, style)}
              stroke={sw > 0 ? "rgba(255,255,255,0.3)" : "none"}
              strokeWidth={sw}
            />
            <text
              x={x + boxW / 2}
              y={y + boxH / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={fontSize}
              className="pointer-events-none"
            >
              {truncate(node.text, 20)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Alternating Flow ────────────────────────────────────────────────────────

/** alternatingFlow — nodes alternate left/right of a central spine. */
export function renderAlternatingFlow(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const w = element.width;
  const h = element.height;
  const pad = 8;
  const usableH = h - pad * 2;
  const rowH = usableH / nodes.length;
  const halfW = (w - pad * 2) / 2;
  const boxW = halfW * 0.8;
  const boxH = Math.min(rowH * 0.7, 40);
  const centerX = w / 2;
  const shadow = styleShadow(style);
  const sw = styleStroke(style);

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ filter: shadow }}
    >
      {/* Central spine */}
      <line
        x1={centerX}
        y1={pad}
        x2={centerX}
        y2={h - pad}
        stroke="#94a3b8"
        strokeWidth={2}
        opacity={0.3}
      />
      {nodes.map((node, i) => {
        const isLeft = i % 2 === 0;
        const y = pad + i * rowH + (rowH - boxH) / 2;
        const x = isLeft ? centerX - boxW - 12 : centerX + 12;
        const fontSize = Math.max(7, Math.min(10, boxW * 0.1));

        return (
          <g key={`${element.id}-altflow-${node.id}-${i}`}>
            {/* Connector to spine */}
            <line
              x1={isLeft ? x + boxW : x}
              y1={y + boxH / 2}
              x2={centerX}
              y2={y + boxH / 2}
              stroke={colour(i, palette)}
              strokeWidth={1.5}
              opacity={0.5}
            />
            <circle
              cx={centerX}
              cy={y + boxH / 2}
              r={3}
              fill={colour(i, palette)}
              opacity={0.8}
            />
            <rect
              x={x}
              y={y}
              width={boxW}
              height={boxH}
              rx={5}
              fill={colour(i, palette)}
              opacity={nodeOpacity(i, nodes.length, style)}
              stroke={sw > 0 ? "rgba(255,255,255,0.3)" : "none"}
              strokeWidth={sw}
            />
            <text
              x={x + boxW / 2}
              y={y + boxH / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={fontSize}
              className="pointer-events-none"
            >
              {truncate(node.text, 20)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Descending Process ──────────────────────────────────────────────────────

/** descendingProcess — top-to-bottom with progressively narrower boxes. */
export function renderDescendingProcess(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const w = element.width;
  const h = element.height;
  const pad = 8;
  const gap = 4;
  const usableH = h - pad * 2;
  const maxW = w - pad * 2;
  const itemH = (usableH - gap * (nodes.length - 1)) / nodes.length;
  const shadow = styleShadow(style);
  const sw = styleStroke(style);

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ filter: shadow }}
    >
      {nodes.map((node, i) => {
        const widthFraction = 1 - (i / Math.max(nodes.length, 1)) * 0.5;
        const bw = maxW * widthFraction;
        const x = (w - bw) / 2;
        const y = pad + i * (itemH + gap);
        const fontSize = Math.max(7, Math.min(11, itemH * 0.4));

        return (
          <g key={`${element.id}-desc-${node.id}-${i}`}>
            {/* Down arrow connector */}
            {i < nodes.length - 1 && (
              <>
                <line
                  x1={w / 2}
                  y1={y + itemH}
                  x2={w / 2}
                  y2={y + itemH + gap}
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  opacity={0.5}
                />
                <polygon
                  points={`${w / 2 - 3},${y + itemH + gap - 4} ${w / 2},${y + itemH + gap} ${w / 2 + 3},${y + itemH + gap - 4}`}
                  fill="#94a3b8"
                  opacity={0.5}
                />
              </>
            )}
            <rect
              x={x}
              y={y}
              width={bw}
              height={itemH}
              rx={5}
              fill={colour(i, palette)}
              opacity={nodeOpacity(i, nodes.length, style)}
              stroke={sw > 0 ? "rgba(255,255,255,0.3)" : "none"}
              strokeWidth={sw}
            />
            <text
              x={w / 2}
              y={y + itemH / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={fontSize}
              className="pointer-events-none"
            >
              {truncate(node.text, 30)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Picture Accent List ─────────────────────────────────────────────────────

/** pictureAccentList — list with accent circles and text boxes. */
export function renderPictureAccentList(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const w = element.width;
  const h = element.height;
  const pad = 8;
  const gap = 6;
  const usableH = h - pad * 2;
  const usableW = w - pad * 2;
  const itemH = (usableH - gap * (nodes.length - 1)) / nodes.length;
  const circleR = Math.min(itemH * 0.38, 18);
  const textX = pad + circleR * 2 + 12;
  const textW = usableW - circleR * 2 - 16;
  const shadow = styleShadow(style);
  const sw = styleStroke(style);

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ filter: shadow }}
    >
      {nodes.map((node, i) => {
        const y = pad + i * (itemH + gap);
        const cy = y + itemH / 2;
        const col = colour(i, palette);
        const fontSize = Math.max(7, Math.min(11, itemH * 0.35));

        return (
          <g key={`${element.id}-picacc-${node.id}-${i}`}>
            {/* Accent circle */}
            <circle
              cx={pad + circleR}
              cy={cy}
              r={circleR}
              fill={col}
              opacity={nodeOpacity(i, nodes.length, style)}
            />
            <text
              x={pad + circleR}
              y={cy}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={Math.max(7, circleR * 0.7)}
              fontWeight="bold"
              className="pointer-events-none"
            >
              {i + 1}
            </text>
            {/* Text box */}
            <rect
              x={textX}
              y={y + 2}
              width={textW}
              height={itemH - 4}
              rx={4}
              fill={col}
              opacity={0.12}
              stroke={col}
              strokeWidth={sw > 0 ? sw : 1}
              strokeOpacity={0.3}
            />
            <text
              x={textX + 8}
              y={cy}
              textAnchor="start"
              dominantBaseline="central"
              fill={col}
              fontSize={fontSize}
              className="pointer-events-none"
            >
              {truncate(node.text, 40)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Vertical Block List ─────────────────────────────────────────────────────

/** verticalBlockList — numbered header bars with body text. */
export function renderVerticalBlockList(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const w = element.width;
  const h = element.height;
  const pad = 8;
  const gap = 4;
  const usableH = h - pad * 2;
  const usableW = w - pad * 2;
  const itemH = (usableH - gap * (nodes.length - 1)) / nodes.length;
  const headerW = usableW * 0.22;
  const bodyW = usableW - headerW - 4;
  const shadow = styleShadow(style);
  const sw = styleStroke(style);

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ filter: shadow }}
    >
      {nodes.map((node, i) => {
        const y = pad + i * (itemH + gap);
        const col = colour(i, palette);
        const fontSize = Math.max(7, Math.min(11, itemH * 0.35));

        return (
          <g key={`${element.id}-vblk-${node.id}-${i}`}>
            {/* Header bar */}
            <rect
              x={pad}
              y={y}
              width={headerW}
              height={itemH}
              rx={3}
              fill={col}
              opacity={nodeOpacity(i, nodes.length, style)}
              stroke={sw > 0 ? "rgba(255,255,255,0.3)" : "none"}
              strokeWidth={sw}
            />
            <text
              x={pad + headerW / 2}
              y={y + itemH / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={Math.max(8, itemH * 0.4)}
              fontWeight="bold"
              className="pointer-events-none"
            >
              {i + 1}
            </text>
            {/* Body block */}
            <rect
              x={pad + headerW + 4}
              y={y}
              width={bodyW}
              height={itemH}
              rx={3}
              fill={col}
              opacity={0.1}
              stroke={col}
              strokeWidth={1}
              strokeOpacity={0.3}
            />
            <text
              x={pad + headerW + 12}
              y={y + itemH / 2}
              textAnchor="start"
              dominantBaseline="central"
              fill={col}
              fontSize={fontSize}
              className="pointer-events-none"
            >
              {truncate(node.text, 40)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Grouped List ────────────────────────────────────────────────────────────

/** groupedList — items grouped into columns with a header. */
export function renderGroupedList(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const w = element.width;
  const h = element.height;
  const pad = 8;
  const gap = 8;
  const shadow = styleShadow(style);
  const sw = styleStroke(style);

  // Split nodes into groups of 2 or 3
  const groupSize = nodes.length <= 4 ? 2 : 3;
  const groups: PptxSmartArtNode[][] = [];
  for (let i = 0; i < nodes.length; i += groupSize) {
    groups.push(nodes.slice(i, i + groupSize));
  }

  const usableW = w - pad * 2;
  const groupW = (usableW - gap * (groups.length - 1)) / groups.length;
  const usableH = h - pad * 2;
  const headerH = usableH * 0.18;

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ filter: shadow }}
    >
      {groups.map((group, gi) => {
        const gx = pad + gi * (groupW + gap);
        const col = colour(gi, palette);
        const subItemGap = 3;
        const subItemH =
          (usableH - headerH - 4 - subItemGap * (group.length - 1)) /
          group.length;

        return (
          <g key={`${element.id}-grp-${gi}`}>
            {/* Group header */}
            <rect
              x={gx}
              y={pad}
              width={groupW}
              height={headerH}
              rx={4}
              fill={col}
              opacity={nodeOpacity(gi, groups.length, style)}
              stroke={sw > 0 ? "rgba(255,255,255,0.3)" : "none"}
              strokeWidth={sw}
            />
            <text
              x={gx + groupW / 2}
              y={pad + headerH / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={Math.max(7, Math.min(10, groupW * 0.08))}
              fontWeight="bold"
              className="pointer-events-none"
            >
              {`Group ${gi + 1}`}
            </text>
            {/* Sub items */}
            {group.map((node, si) => {
              const sy = pad + headerH + 4 + si * (subItemH + subItemGap);
              const fontSize = Math.max(7, Math.min(10, subItemH * 0.35));

              return (
                <g key={`${element.id}-grp-${gi}-item-${node.id}-${si}`}>
                  <rect
                    x={gx + 4}
                    y={sy}
                    width={groupW - 8}
                    height={subItemH}
                    rx={3}
                    fill={col}
                    opacity={0.15}
                    stroke={col}
                    strokeWidth={1}
                    strokeOpacity={0.3}
                  />
                  <text
                    x={gx + groupW / 2}
                    y={sy + subItemH / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={col}
                    fontSize={fontSize}
                    className="pointer-events-none"
                  >
                    {truncate(node.text, 20)}
                  </text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

// ── Pyramid List ────────────────────────────────────────────────────────────

/** pyramidList — pyramid segments on left with text callouts on right. */
export function renderPyramidList(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const w = element.width;
  const h = element.height;
  const pad = 8;
  const gap = 4;
  const usableH = h - pad * 2;
  const pyramidW = w * 0.35;
  const labelStartX = pyramidW + pad + 16;
  const labelW = w - labelStartX - pad;
  const bandH = (usableH - gap * (nodes.length - 1)) / nodes.length;
  const shadow = styleShadow(style);

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ filter: shadow }}
    >
      {nodes.map((node, i) => {
        const y = pad + i * (bandH + gap);
        const col = colour(i, palette);
        const topFrac = 0.3 + (i / Math.max(nodes.length - 1, 1)) * 0.7;
        const segW = pyramidW * topFrac;
        const segX = pad + (pyramidW - segW) / 2;
        const fontSize = Math.max(7, Math.min(11, bandH * 0.35));

        return (
          <g key={`${element.id}-pyrlist-${node.id}-${i}`}>
            {/* Pyramid segment */}
            <rect
              x={segX}
              y={y}
              width={segW}
              height={bandH}
              rx={2}
              fill={col}
              opacity={nodeOpacity(i, nodes.length, style)}
            />
            {/* Connector line */}
            <line
              x1={segX + segW}
              y1={y + bandH / 2}
              x2={labelStartX - 4}
              y2={y + bandH / 2}
              stroke={col}
              strokeWidth={1}
              opacity={0.5}
              strokeDasharray="3,2"
            />
            {/* Text label */}
            <rect
              x={labelStartX}
              y={y + 2}
              width={labelW}
              height={bandH - 4}
              rx={3}
              fill={col}
              opacity={0.1}
              stroke={col}
              strokeWidth={1}
              strokeOpacity={0.25}
            />
            <text
              x={labelStartX + 8}
              y={y + bandH / 2}
              textAnchor="start"
              dominantBaseline="central"
              fill={col}
              fontSize={fontSize}
              className="pointer-events-none"
            >
              {truncate(node.text, 30)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Horizontal Picture List ─────────────────────────────────────────────────

/** horizontalPictureList — row of circles with text labels below. */
export function renderHorizontalPictureList(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const w = element.width;
  const h = element.height;
  const pad = 8;
  const gap = 8;
  const usableW = w - pad * 2;
  const colW = (usableW - gap * (nodes.length - 1)) / nodes.length;
  const usableH = h - pad * 2;
  const circleR = Math.min(colW * 0.38, usableH * 0.28);
  const shadow = styleShadow(style);
  const sw = styleStroke(style);

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ filter: shadow }}
    >
      {nodes.map((node, i) => {
        const cx = pad + i * (colW + gap) + colW / 2;
        const cy = pad + circleR + 4;
        const col = colour(i, palette);
        const labelY = cy + circleR + 10;
        const fontSize = Math.max(7, Math.min(10, colW * 0.1));

        return (
          <g key={`${element.id}-hpic-${node.id}-${i}`}>
            {/* Circle placeholder */}
            <circle
              cx={cx}
              cy={cy}
              r={circleR}
              fill={col}
              opacity={nodeOpacity(i, nodes.length, style)}
              stroke={sw > 0 ? "rgba(255,255,255,0.3)" : "none"}
              strokeWidth={sw}
            />
            <text
              x={cx}
              y={cy}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={Math.max(8, circleR * 0.5)}
              fontWeight="bold"
              className="pointer-events-none"
            >
              {i + 1}
            </text>
            {/* Text label below */}
            <text
              x={cx}
              y={labelY}
              textAnchor="middle"
              dominantBaseline="hanging"
              fill={col}
              fontSize={fontSize}
              className="pointer-events-none"
            >
              {truncate(node.text, 15)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Accent Process ──────────────────────────────────────────────────────────

/** accentProcess — process with accent circles behind boxes. */
export function renderAccentProcess(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const w = element.width;
  const h = element.height;
  const pad = 8;
  const arrowGap = 16;
  const usableW = w - pad * 2;
  const nodeW = (usableW - arrowGap * (nodes.length - 1)) / nodes.length;
  const nodeH = h * 0.45;
  const yMid = h / 2;
  const circleR = Math.min(nodeW, nodeH) * 0.55;
  const shadow = styleShadow(style);
  const sw = styleStroke(style);

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ filter: shadow }}
    >
      {nodes.map((node, i) => {
        const x = pad + i * (nodeW + arrowGap);
        const cx = x + nodeW / 2;
        const col = colour(i, palette);
        const fontSize = Math.max(7, Math.min(11, nodeW * 0.1));

        return (
          <g key={`${element.id}-accproc-${node.id}-${i}`}>
            {/* Accent circle */}
            <circle
              cx={cx}
              cy={yMid}
              r={circleR}
              fill={col}
              opacity={0.15}
            />
            {/* Main box */}
            <rect
              x={x}
              y={yMid - nodeH / 2}
              width={nodeW}
              height={nodeH}
              rx={5}
              fill={col}
              opacity={nodeOpacity(i, nodes.length, style)}
              stroke={sw > 0 ? "rgba(255,255,255,0.3)" : "none"}
              strokeWidth={sw}
            />
            <text
              x={cx}
              y={yMid}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={fontSize}
              className="pointer-events-none"
            >
              {truncate(node.text, 20)}
            </text>
            {/* Arrow connector */}
            {i < nodes.length - 1 && (
              <>
                <line
                  x1={x + nodeW + 2}
                  y1={yMid}
                  x2={x + nodeW + arrowGap - 2}
                  y2={yMid}
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  opacity={0.5}
                />
                <polygon
                  points={`${x + nodeW + arrowGap - 6},${yMid - 3} ${x + nodeW + arrowGap - 2},${yMid} ${x + nodeW + arrowGap - 6},${yMid + 3}`}
                  fill="#94a3b8"
                  opacity={0.5}
                />
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Vertical Chevron List ───────────────────────────────────────────────────

/** verticalChevronList — vertically stacked chevron arrows. */
export function renderVerticalChevronList(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const w = element.width;
  const h = element.height;
  const pad = 8;
  const gap = 2;
  const usableW = w - pad * 2;
  const usableH = h - pad * 2;
  const itemH = (usableH - gap * (nodes.length - 1)) / nodes.length;
  const chevDepth = Math.min(12, itemH * 0.3);
  const shadow = styleShadow(style);
  const sw = styleStroke(style);

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ filter: shadow }}
    >
      {nodes.map((node, i) => {
        const x = pad;
        const y = pad + i * (itemH + gap);
        const col = colour(i, palette);
        const fontSize = Math.max(7, Math.min(11, itemH * 0.4));
        const isFirst = i === 0;
        const isLast = i === nodes.length - 1;

        // Vertical chevron: flat top, pointed bottom
        const points = isFirst
          ? [
              `${x},${y}`,
              `${x + usableW},${y}`,
              `${x + usableW},${y + itemH - chevDepth}`,
              `${x + usableW / 2},${y + itemH}`,
              `${x},${y + itemH - chevDepth}`,
            ].join(" ")
          : isLast
            ? [
                `${x},${y + chevDepth}`,
                `${x + usableW / 2},${y}`,
                `${x + usableW},${y + chevDepth}`,
                `${x + usableW},${y + itemH}`,
                `${x},${y + itemH}`,
              ].join(" ")
            : [
                `${x},${y + chevDepth}`,
                `${x + usableW / 2},${y}`,
                `${x + usableW},${y + chevDepth}`,
                `${x + usableW},${y + itemH - chevDepth}`,
                `${x + usableW / 2},${y + itemH}`,
                `${x},${y + itemH - chevDepth}`,
              ].join(" ");

        return (
          <g key={`${element.id}-vchev-${node.id}-${i}`}>
            <polygon
              points={points}
              fill={col}
              opacity={nodeOpacity(i, nodes.length, style)}
              stroke={sw > 0 ? "rgba(255,255,255,0.3)" : "none"}
              strokeWidth={sw}
            />
            <text
              x={x + usableW / 2}
              y={y + itemH / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize={fontSize}
              className="pointer-events-none"
            >
              {truncate(node.text, 30)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
