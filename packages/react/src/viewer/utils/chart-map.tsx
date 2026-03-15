import React from "react";

import type { PptxElement, PptxChartData } from "pptx-viewer-core";
import { formatAxisValue } from "./chart-helpers";

// ── Region code matching ─────────────────────────────────────────

/**
 * Mapping from common category labels (country names, ISO codes, etc.)
 * to our internal region keys.  Case-insensitive lookup.
 */
const REGION_ALIAS_MAP: Record<string, string> = {
  // United States
  us: "US",
  usa: "US",
  "united states": "US",
  "united states of america": "US",
  // Canada
  ca: "CA",
  can: "CA",
  canada: "CA",
  // Brazil
  br: "BR",
  bra: "BR",
  brazil: "BR",
  // United Kingdom
  gb: "GB",
  gbr: "GB",
  uk: "GB",
  "united kingdom": "GB",
  // France
  fr: "FR",
  fra: "FR",
  france: "FR",
  // Germany
  de: "DE",
  deu: "DE",
  germany: "DE",
  // Italy
  it: "IT",
  ita: "IT",
  italy: "IT",
  // Spain
  es: "ES",
  esp: "ES",
  spain: "ES",
  // Russia
  ru: "RU",
  rus: "RU",
  russia: "RU",
  // China
  cn: "CN",
  chn: "CN",
  china: "CN",
  // India
  in: "IN",
  ind: "IN",
  india: "IN",
  // Japan
  jp: "JP",
  jpn: "JP",
  japan: "JP",
  // South Korea
  kr: "KR",
  kor: "KR",
  "south korea": "KR",
  korea: "KR",
  // Australia
  au: "AU",
  aus: "AU",
  australia: "AU",
  // Mexico
  mx: "MX",
  mex: "MX",
  mexico: "MX",
  // Indonesia
  id: "ID",
  idn: "ID",
  indonesia: "ID",
  // Turkey
  tr: "TR",
  tur: "TR",
  turkey: "TR",
  // Saudi Arabia
  sa: "SA",
  sau: "SA",
  "saudi arabia": "SA",
  // South Africa
  za: "ZA",
  zaf: "ZA",
  "south africa": "ZA",
  // Argentina
  ar: "AR",
  arg: "AR",
  argentina: "AR",
  // Nigeria
  ng: "NG",
  nga: "NG",
  nigeria: "NG",
  // Egypt
  eg: "EG",
  egy: "EG",
  egypt: "EG",
};

/**
 * Resolve a category label to a region key.
 * Returns undefined if no match found.
 */
export function resolveRegionCode(label: string): string | undefined {
  const normalized = label.trim().toLowerCase();
  return REGION_ALIAS_MAP[normalized];
}

// ── Color scale ──────────────────────────────────────────────────

/**
 * Interpolate between two hex colors by ratio t in [0, 1].
 */
function lerpColor(a: string, b: string, t: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const parse = (hex: string) => {
    const h = hex.replace("#", "");
    return [
      parseInt(h.substring(0, 2), 16),
      parseInt(h.substring(2, 4), 16),
      parseInt(h.substring(4, 6), 16),
    ];
  };
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const r = clamp(r1 + (r2 - r1) * t);
  const g = clamp(g1 + (g2 - g1) * t);
  const bl = clamp(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}

/**
 * Sequential 3-stop color scale: light (#dbeafe) -> mid (#3b82f6) -> dark (#1e3a5f).
 * Returns a hex color for a normalised value t in [0, 1].
 */
export function sequentialColorScale(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  if (clamped <= 0.5) {
    return lerpColor("#dbeafe", "#3b82f6", clamped * 2);
  }
  return lerpColor("#3b82f6", "#1e3a5f", (clamped - 0.5) * 2);
}

/**
 * Compute the normalised [0, 1] value for a data point given a min/max range.
 */
export function normalizeValue(
  value: number,
  min: number,
  max: number,
): number {
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}

// ── Simplified SVG paths ─────────────────────────────────────────
// Each path is drawn on a 1000 x 500 viewBox (equirectangular-ish).
// Coordinates are approximate centroids / simplified outlines.

export interface RegionDef {
  code: string;
  name: string;
  /** SVG path d attribute (simplified outline) */
  path: string;
  /** Label anchor point [x, y] */
  labelXY: [number, number];
}

/**
 * Simplified world region outlines.
 * Paths are rough approximations suitable for a choropleth overview,
 * drawn on a 1000x500 coordinate system.
 */
export const WORLD_REGIONS: RegionDef[] = [
  // North America
  {
    code: "US",
    name: "United States",
    path: "M130,160 L250,155 265,170 270,190 260,210 230,215 200,220 170,215 145,205 130,195Z M280,175 L295,165 310,170 310,185 295,195 280,190Z",
    labelXY: [200, 190],
  },
  {
    code: "CA",
    name: "Canada",
    path: "M120,90 L280,85 290,100 295,130 280,150 250,155 200,155 160,155 130,155 115,140 110,115Z",
    labelXY: [200, 125],
  },
  {
    code: "MX",
    name: "Mexico",
    path: "M145,215 L200,220 210,235 200,255 185,265 165,260 150,245 140,230Z",
    labelXY: [175, 240],
  },
  // South America
  {
    code: "BR",
    name: "Brazil",
    path: "M270,300 L310,280 335,290 340,320 330,355 310,370 285,365 265,345 260,320Z",
    labelXY: [300, 330],
  },
  {
    code: "AR",
    name: "Argentina",
    path: "M260,370 L280,365 290,380 285,410 275,435 260,445 250,425 248,395Z",
    labelXY: [268, 410],
  },
  // Europe
  {
    code: "GB",
    name: "United Kingdom",
    path: "M440,120 L448,110 455,115 455,135 448,142 440,138Z",
    labelXY: [448, 128],
  },
  {
    code: "FR",
    name: "France",
    path: "M450,145 L470,140 480,150 478,168 465,175 450,170 445,158Z",
    labelXY: [463, 158],
  },
  {
    code: "DE",
    name: "Germany",
    path: "M478,125 L498,120 505,130 502,148 490,152 478,148 475,138Z",
    labelXY: [490, 138],
  },
  {
    code: "IT",
    name: "Italy",
    path: "M490,155 L498,152 505,162 500,180 492,190 488,178 486,165Z",
    labelXY: [495, 172],
  },
  {
    code: "ES",
    name: "Spain",
    path: "M432,168 L460,165 465,175 460,188 442,192 430,185 428,175Z",
    labelXY: [448, 180],
  },
  // Russia spans Europe/Asia
  {
    code: "RU",
    name: "Russia",
    path: "M510,60 L780,50 830,70 840,100 820,120 750,115 700,105 650,100 580,105 530,110 510,100 505,80Z",
    labelXY: [670, 85],
  },
  {
    code: "TR",
    name: "Turkey",
    path: "M530,165 L570,160 585,170 580,182 555,185 530,180Z",
    labelXY: [558, 175],
  },
  // Africa
  {
    code: "EG",
    name: "Egypt",
    path: "M530,200 L555,195 565,205 560,225 545,230 530,222Z",
    labelXY: [548, 215],
  },
  {
    code: "NG",
    name: "Nigeria",
    path: "M475,275 L500,270 510,280 505,298 490,302 475,295Z",
    labelXY: [492, 288],
  },
  {
    code: "ZA",
    name: "South Africa",
    path: "M520,380 L545,370 560,380 555,400 540,410 520,405 515,392Z",
    labelXY: [538, 392],
  },
  // Middle East
  {
    code: "SA",
    name: "Saudi Arabia",
    path: "M565,220 L600,210 615,225 610,250 590,258 570,250 560,238Z",
    labelXY: [590, 238],
  },
  // Asia
  {
    code: "IN",
    name: "India",
    path: "M640,210 L665,195 685,210 688,240 678,268 660,278 645,265 635,240Z",
    labelXY: [662, 240],
  },
  {
    code: "CN",
    name: "China",
    path: "M700,120 L775,115 800,130 805,160 790,180 760,185 730,180 710,168 695,150 690,135Z",
    labelXY: [750, 155],
  },
  {
    code: "JP",
    name: "Japan",
    path: "M835,145 L845,135 852,140 850,158 842,165 835,160Z",
    labelXY: [843, 152],
  },
  {
    code: "KR",
    name: "South Korea",
    path: "M815,158 L825,152 830,160 827,170 818,172 813,165Z",
    labelXY: [822, 163],
  },
  {
    code: "ID",
    name: "Indonesia",
    path: "M740,295 L780,288 810,292 830,298 825,310 790,312 755,308 740,305Z",
    labelXY: [785, 302],
  },
  // Oceania
  {
    code: "AU",
    name: "Australia",
    path: "M790,350 L850,340 880,355 885,385 870,405 840,410 810,400 790,380Z",
    labelXY: [838, 378],
  },
];

// ── Map chart renderer ───────────────────────────────────────────

/**
 * Render a geographic map chart as an SVG choropleth.
 * Maps data categories to known world regions, colors them by value,
 * and falls back to a data table row for unrecognised regions.
 */
export function renderMapChart(
  element: PptxElement,
  chartData: PptxChartData,
  categoryLabels: ReadonlyArray<string>,
): React.ReactNode {
  const svgWidth = element.width;
  const svgHeight = element.height;
  const categories =
    categoryLabels.length > 0 ? categoryLabels : chartData.categories;
  const series = chartData.series;

  // Use first series for choropleth colouring
  const values = series.length > 0 ? series[0].values : [];
  const finiteVals = values.filter((v) => Number.isFinite(v));
  const minVal = finiteVals.length > 0 ? Math.min(...finiteVals) : 0;
  const maxVal = finiteVals.length > 0 ? Math.max(...finiteVals) : 1;

  // Build lookup: regionCode -> { value, label }
  const regionValueMap = new Map<
    string,
    { value: number; label: string }
  >();
  const unmatchedRows: Array<{ label: string; value: number }> = [];

  categories.forEach((cat, i) => {
    const value = values[i] ?? 0;
    const code = resolveRegionCode(cat);
    if (code) {
      regionValueMap.set(code, { value, label: cat });
    } else {
      unmatchedRows.push({ label: cat, value });
    }
  });

  // ── Map area dimensions ────────────────────────────────────────
  // Reserve bottom area for legend + fallback table
  const legendHeight = 30;
  const fallbackRowH = 14;
  const fallbackTableH =
    unmatchedRows.length > 0
      ? Math.min(unmatchedRows.length + 1, 6) * fallbackRowH + 8
      : 0;
  const titleH = chartData.title ? 22 : 0;
  const mapAreaH = Math.max(
    svgHeight - titleH - legendHeight - fallbackTableH - 8,
    80,
  );

  // Scale the 1000x500 viewBox into the available space
  const mapScale = Math.min(
    (svgWidth - 20) / 1000,
    mapAreaH / 500,
  );
  const mapOffsetX = (svgWidth - 1000 * mapScale) / 2;
  const mapOffsetY = titleH + 4;

  const elements: React.ReactNode[] = [];

  // ── Title ──────────────────────────────────────────────────────
  if (chartData.title) {
    elements.push(
      <text
        key={`${element.id}-map-title`}
        x={svgWidth / 2}
        y={16}
        textAnchor="middle"
        fontSize={12}
        fontWeight={700}
        fill="#334155"
      >
        {chartData.title}
      </text>,
    );
  }

  // ── Region shapes ──────────────────────────────────────────────
  WORLD_REGIONS.forEach((region) => {
    const entry = regionValueMap.get(region.code);
    let fill = "#e2e8f0"; // default: neutral grey for regions without data
    let dataLabel: React.ReactNode = null;

    if (entry) {
      const t = normalizeValue(entry.value, minVal, maxVal);
      fill = sequentialColorScale(t);
      // Inline data label
      dataLabel = (
        <text
          key={`${element.id}-map-dl-${region.code}`}
          x={region.labelXY[0] * mapScale + mapOffsetX}
          y={region.labelXY[1] * mapScale + mapOffsetY + 4}
          textAnchor="middle"
          fontSize={Math.max(6, 7 * mapScale)}
          fontWeight={600}
          fill="#1e293b"
          style={{ pointerEvents: "none" }}
        >
          {formatAxisValue(entry.value)}
        </text>
      );
    }

    elements.push(
      <g key={`${element.id}-map-g-${region.code}`}>
        <path
          d={region.path}
          fill={fill}
          stroke="#94a3b8"
          strokeWidth={0.5 / mapScale}
          transform={`translate(${mapOffsetX},${mapOffsetY}) scale(${mapScale})`}
          opacity={0.9}
        >
          <title>
            {region.name}
            {entry ? `: ${formatAxisValue(entry.value)}` : ""}
          </title>
        </path>
        {dataLabel}
      </g>,
    );
  });

  // ── Color legend bar ───────────────────────────────────────────
  const legendY = mapOffsetY + mapAreaH + 4;
  const barW = Math.min(svgWidth * 0.4, 160);
  const barX = (svgWidth - barW) / 2;
  const gradId = `${element.id}-map-choropleth-grad`;

  elements.push(
    <defs key={`${element.id}-map-defs`}>
      <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#dbeafe" />
        <stop offset="50%" stopColor="#3b82f6" />
        <stop offset="100%" stopColor="#1e3a5f" />
      </linearGradient>
    </defs>,
    <rect
      key={`${element.id}-map-legend-bar`}
      x={barX}
      y={legendY}
      width={barW}
      height={8}
      rx={4}
      fill={`url(#${gradId})`}
    />,
    <text
      key={`${element.id}-map-legend-min`}
      x={barX}
      y={legendY + 18}
      fontSize={7}
      fill="#64748b"
      textAnchor="middle"
    >
      {formatAxisValue(minVal)}
    </text>,
    <text
      key={`${element.id}-map-legend-max`}
      x={barX + barW}
      y={legendY + 18}
      fontSize={7}
      fill="#64748b"
      textAnchor="middle"
    >
      {formatAxisValue(maxVal)}
    </text>,
  );

  // ── Fallback table for unmatched regions ───────────────────────
  if (unmatchedRows.length > 0) {
    const tableY = legendY + 26;
    const fontSize = Math.min(8, fallbackRowH * 0.7);
    const colW = Math.min((svgWidth - 20) / 2, 120);
    const tableX = (svgWidth - colW * 2) / 2;

    elements.push(
      <text
        key={`${element.id}-map-ft-hdr`}
        x={svgWidth / 2}
        y={tableY}
        textAnchor="middle"
        fontSize={7}
        fill="#94a3b8"
      >
        Additional regions (not shown on map)
      </text>,
    );

    const maxRows = Math.min(unmatchedRows.length, 5);
    for (let i = 0; i < maxRows; i++) {
      const row = unmatchedRows[i];
      const y = tableY + fallbackRowH * (i + 1);
      if (y + fallbackRowH > svgHeight) break;

      if (i % 2 === 0) {
        elements.push(
          <rect
            key={`${element.id}-map-ft-bg-${i}`}
            x={tableX}
            y={y - fallbackRowH + 4}
            width={colW * 2}
            height={fallbackRowH}
            fill="#f1f5f9"
            rx={2}
          />,
        );
      }
      elements.push(
        <text
          key={`${element.id}-map-ft-lbl-${i}`}
          x={tableX + 4}
          y={y}
          fontSize={fontSize}
          fill="#334155"
        >
          {row.label}
        </text>,
        <text
          key={`${element.id}-map-ft-val-${i}`}
          x={tableX + colW + 4}
          y={y}
          fontSize={fontSize}
          fill="#475569"
        >
          {formatAxisValue(row.value)}
        </text>,
      );
    }

    if (unmatchedRows.length > 5) {
      const moreY = tableY + fallbackRowH * 6;
      elements.push(
        <text
          key={`${element.id}-map-ft-more`}
          x={svgWidth / 2}
          y={moreY}
          textAnchor="middle"
          fontSize={6}
          fill="#94a3b8"
        >
          +{unmatchedRows.length - 5} more regions
        </text>,
      );
    }
  }

  return (
    <svg
      className="w-full h-full pointer-events-none"
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`Geographic map chart${chartData.title ? `: ${chartData.title}` : ""}`}
    >
      <rect
        x={0}
        y={0}
        width={svgWidth}
        height={svgHeight}
        fill="#f8fafc"
        rx={4}
      />
      {elements}
    </svg>
  );
}
