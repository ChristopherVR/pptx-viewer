<script setup lang="ts">
import type { PptxChartData } from 'pptx-viewer-core';
import type { PlotLayout } from 'pptx-viewer-shared';
import {
	formatAxisValue,
	normalizeValue,
	resolveRegionCode,
	sequentialColorScale,
} from 'pptx-viewer-shared';
import { computed } from 'vue';

/**
 * RegionMapChart: Vue port of React `chart-map.tsx` choropleth map renderer.
 * Rendered inside the parent chart `<svg>` as a `<g>` group.
 * Uses a 1000x500 coordinate system for region outlines and scales them
 * to fit the available layout area.
 *
 * The region-alias lookup (`resolveRegionCode`), sequential colour scale
 * (`sequentialColorScale`) and `normalizeValue` were consolidated into
 * `pptx-viewer-shared` (`render/chart-waterfall-map.ts`) and are imported here
 * rather than redefined locally.
 */
const props = defineProps<{
	chartData: PptxChartData;
	layout: PlotLayout;
	categories: ReadonlyArray<string>;
}>();

// ── SVG path data ─────────────────────────────────────────────────
// Simplified world region outlines on a 1000x500 coordinate system.

interface RegionDef {
	code: string;
	name: string;
	path: string;
	labelXY: [number, number];
}

const WORLD_REGIONS: RegionDef[] = [
	// North America
	{
		code: 'US',
		name: 'United States',
		path: 'M130,160 L250,155 265,170 270,190 260,210 230,215 200,220 170,215 145,205 130,195Z M280,175 L295,165 310,170 310,185 295,195 280,190Z',
		labelXY: [200, 190],
	},
	{
		code: 'CA',
		name: 'Canada',
		path: 'M120,90 L280,85 290,100 295,130 280,150 250,155 200,155 160,155 130,155 115,140 110,115Z',
		labelXY: [200, 125],
	},
	{
		code: 'MX',
		name: 'Mexico',
		path: 'M145,215 L200,220 210,235 200,255 185,265 165,260 150,245 140,230Z',
		labelXY: [175, 240],
	},
	// South America
	{
		code: 'BR',
		name: 'Brazil',
		path: 'M270,300 L310,280 335,290 340,320 330,355 310,370 285,365 265,345 260,320Z',
		labelXY: [300, 330],
	},
	{
		code: 'AR',
		name: 'Argentina',
		path: 'M260,370 L280,365 290,380 285,410 275,435 260,445 250,425 248,395Z',
		labelXY: [268, 410],
	},
	// Europe
	{
		code: 'GB',
		name: 'United Kingdom',
		path: 'M440,120 L448,110 455,115 455,135 448,142 440,138Z',
		labelXY: [448, 128],
	},
	{
		code: 'FR',
		name: 'France',
		path: 'M450,145 L470,140 480,150 478,168 465,175 450,170 445,158Z',
		labelXY: [463, 158],
	},
	{
		code: 'DE',
		name: 'Germany',
		path: 'M478,125 L498,120 505,130 502,148 490,152 478,148 475,138Z',
		labelXY: [490, 138],
	},
	{
		code: 'IT',
		name: 'Italy',
		path: 'M490,155 L498,152 505,162 500,180 492,190 488,178 486,165Z',
		labelXY: [495, 172],
	},
	{
		code: 'ES',
		name: 'Spain',
		path: 'M432,168 L460,165 465,175 460,188 442,192 430,185 428,175Z',
		labelXY: [448, 180],
	},
	// Russia spans Europe/Asia
	{
		code: 'RU',
		name: 'Russia',
		path: 'M510,60 L780,50 830,70 840,100 820,120 750,115 700,105 650,100 580,105 530,110 510,100 505,80Z',
		labelXY: [670, 85],
	},
	{
		code: 'TR',
		name: 'Turkey',
		path: 'M530,165 L570,160 585,170 580,182 555,185 530,180Z',
		labelXY: [558, 175],
	},
	// Africa
	{
		code: 'EG',
		name: 'Egypt',
		path: 'M530,200 L555,195 565,205 560,225 545,230 530,222Z',
		labelXY: [548, 215],
	},
	{
		code: 'NG',
		name: 'Nigeria',
		path: 'M475,275 L500,270 510,280 505,298 490,302 475,295Z',
		labelXY: [492, 288],
	},
	{
		code: 'ZA',
		name: 'South Africa',
		path: 'M520,380 L545,370 560,380 555,400 540,410 520,405 515,392Z',
		labelXY: [538, 392],
	},
	// Middle East
	{
		code: 'SA',
		name: 'Saudi Arabia',
		path: 'M565,220 L600,210 615,225 610,250 590,258 570,250 560,238Z',
		labelXY: [590, 238],
	},
	// Asia
	{
		code: 'IN',
		name: 'India',
		path: 'M640,210 L665,195 685,210 688,240 678,268 660,278 645,265 635,240Z',
		labelXY: [662, 240],
	},
	{
		code: 'CN',
		name: 'China',
		path: 'M700,120 L775,115 800,130 805,160 790,180 760,185 730,180 710,168 695,150 690,135Z',
		labelXY: [750, 155],
	},
	{
		code: 'JP',
		name: 'Japan',
		path: 'M835,145 L845,135 852,140 850,158 842,165 835,160Z',
		labelXY: [843, 152],
	},
	{
		code: 'KR',
		name: 'South Korea',
		path: 'M815,158 L825,152 830,160 827,170 818,172 813,165Z',
		labelXY: [822, 163],
	},
	{
		code: 'ID',
		name: 'Indonesia',
		path: 'M740,295 L780,288 810,292 830,298 825,310 790,312 755,308 740,305Z',
		labelXY: [785, 302],
	},
	// Oceania
	{
		code: 'AU',
		name: 'Australia',
		path: 'M790,350 L850,340 880,355 885,385 870,405 840,410 810,400 790,380Z',
		labelXY: [838, 378],
	},
];

// ── Computed geometry ─────────────────────────────────────────────

const svgWidth = computed(() => props.layout.svgWidth);
const svgHeight = computed(() => props.layout.svgHeight);

const categories = computed(() =>
	props.categories.length > 0 ? props.categories : props.chartData.categories,
);

const values = computed<number[]>(() =>
	props.chartData.series.length > 0 ? props.chartData.series[0].values : [],
);

const finiteVals = computed(() => values.value.filter((v) => Number.isFinite(v)));
const minVal = computed(() => (finiteVals.value.length > 0 ? Math.min(...finiteVals.value) : 0));
const maxVal = computed(() => (finiteVals.value.length > 0 ? Math.max(...finiteVals.value) : 1));

interface RegionEntry {
	value: number;
	label: string;
}

const regionValueMap = computed<Map<string, RegionEntry>>(() => {
	const map = new Map<string, RegionEntry>();
	categories.value.forEach((cat, i) => {
		const value = values.value[i] ?? 0;
		const code = resolveRegionCode(cat);
		if (code) {
			map.set(code, { value, label: cat });
		}
	});
	return map;
});

interface UnmatchedRow {
	label: string;
	value: number;
}

const unmatchedRows = computed<UnmatchedRow[]>(() => {
	const rows: UnmatchedRow[] = [];
	categories.value.forEach((cat, i) => {
		const code = resolveRegionCode(cat);
		if (!code) {
			rows.push({ label: cat, value: values.value[i] ?? 0 });
		}
	});
	return rows;
});

// ── Layout dimensions ─────────────────────────────────────────────

const legendHeight = 30;
const fallbackRowH = 14;

const titleH = computed(() => (props.chartData.title ? 22 : 0));

const fallbackTableH = computed(() =>
	unmatchedRows.value.length > 0
		? Math.min(unmatchedRows.value.length + 1, 6) * fallbackRowH + 8
		: 0,
);

const mapAreaH = computed(() =>
	Math.max(svgHeight.value - titleH.value - legendHeight - fallbackTableH.value - 8, 80),
);

const mapScale = computed(() => Math.min((svgWidth.value - 20) / 1000, mapAreaH.value / 500));

const mapOffsetX = computed(() => (svgWidth.value - 1000 * mapScale.value) / 2);
const mapOffsetY = computed(() => titleH.value + 4);

const legendY = computed(() => mapOffsetY.value + mapAreaH.value + 4);
const barW = computed(() => Math.min(svgWidth.value * 0.4, 160));
const barX = computed(() => (svgWidth.value - barW.value) / 2);
const gradId = computed(() => `${props.chartData.series[0]?.name ?? 'map'}-choropleth-grad`);

// ── Region shape data ─────────────────────────────────────────────

interface RegionShape {
	code: string;
	name: string;
	path: string;
	fill: string;
	transform: string;
	titleText: string;
	hasDataLabel: boolean;
	labelX: number;
	labelY: number;
	labelText: string;
	labelFontSize: number;
}

const regionShapes = computed<RegionShape[]>(() => {
	const scale = mapScale.value;
	const offsetX = mapOffsetX.value;
	const offsetY = mapOffsetY.value;
	const min = minVal.value;
	const max = maxVal.value;
	const map = regionValueMap.value;

	return WORLD_REGIONS.map((region) => {
		const entry = map.get(region.code);
		const fill = entry ? sequentialColorScale(normalizeValue(entry.value, min, max)) : '#e2e8f0';
		const titleText = entry ? `${region.name}: ${formatAxisValue(entry.value)}` : region.name;

		return {
			code: region.code,
			name: region.name,
			path: region.path,
			fill,
			transform: `translate(${offsetX},${offsetY}) scale(${scale})`,
			titleText,
			hasDataLabel: entry !== undefined,
			labelX: region.labelXY[0] * scale + offsetX,
			labelY: region.labelXY[1] * scale + offsetY + 4,
			labelText: entry ? formatAxisValue(entry.value) : '',
			labelFontSize: Math.max(6, 7 * scale),
		};
	});
});

// ── Fallback table rows ───────────────────────────────────────────

interface FallbackRow {
	index: number;
	label: string;
	valueText: string;
	bgY: number;
	textY: number;
	hasBg: boolean;
	labelX: number;
	valueX: number;
}

const fallbackRows = computed<FallbackRow[]>(() => {
	if (unmatchedRows.value.length === 0) {
		return [];
	}
	const tableY = legendY.value + 26;
	const colW = Math.min((svgWidth.value - 20) / 2, 120);
	const tableX = (svgWidth.value - colW * 2) / 2;
	const maxRows = Math.min(unmatchedRows.value.length, 5);
	const out: FallbackRow[] = [];

	for (let i = 0; i < maxRows; i++) {
		const row = unmatchedRows.value[i];
		const y = tableY + fallbackRowH * (i + 1);
		if (y + fallbackRowH > svgHeight.value) {
			break;
		}
		out.push({
			index: i,
			label: row.label,
			valueText: formatAxisValue(row.value),
			bgY: y - fallbackRowH + 4,
			textY: y,
			hasBg: i % 2 === 0,
			labelX: tableX + 4,
			valueX: tableX + colW + 4,
		});
	}
	return out;
});

const fallbackTableX = computed(() => {
	const colW = Math.min((svgWidth.value - 20) / 2, 120);
	return (svgWidth.value - colW * 2) / 2;
});

const fallbackColW = computed(() => Math.min((svgWidth.value - 20) / 2, 120));

const fallbackMoreY = computed(() => {
	const tableY = legendY.value + 26;
	return tableY + fallbackRowH * 6;
});

const fallbackFontSize = computed(() => Math.min(8, fallbackRowH * 0.7));
const strokeWidth = computed(() => 0.5 / mapScale.value);
</script>

<template>
	<g class="pptx-vue-region-map-chart">
		<!-- Background -->
		<rect :x="0" :y="0" :width="svgWidth" :height="svgHeight" fill="#f8fafc" rx="4" />

		<!-- Title -->
		<text
			v-if="chartData.title"
			:x="svgWidth / 2"
			:y="16"
			text-anchor="middle"
			font-size="12"
			font-weight="700"
			fill="#334155"
		>
			{{ chartData.title }}
		</text>

		<!-- Region shapes -->
		<g v-for="region in regionShapes" :key="`map-g-${region.code}`">
			<path
				:d="region.path"
				:fill="region.fill"
				stroke="#94a3b8"
				:stroke-width="strokeWidth"
				:transform="region.transform"
				opacity="0.9"
			>
				<title>{{ region.titleText }}</title>
			</path>
			<text
				v-if="region.hasDataLabel"
				:x="region.labelX"
				:y="region.labelY"
				text-anchor="middle"
				:font-size="region.labelFontSize"
				font-weight="600"
				fill="#1e293b"
				style="pointer-events: none"
			>
				{{ region.labelText }}
			</text>
		</g>

		<!-- Gradient legend bar -->
		<defs>
			<linearGradient :id="gradId" x1="0" y1="0" x2="1" y2="0">
				<stop offset="0%" stop-color="#dbeafe" />
				<stop offset="50%" stop-color="#3b82f6" />
				<stop offset="100%" stop-color="#1e3a5f" />
			</linearGradient>
		</defs>
		<rect :x="barX" :y="legendY" :width="barW" height="8" rx="4" :fill="`url(#${gradId})`" />
		<text :x="barX" :y="legendY + 18" font-size="7" fill="#64748b" text-anchor="middle">
			{{ formatAxisValue(minVal) }}
		</text>
		<text :x="barX + barW" :y="legendY + 18" font-size="7" fill="#64748b" text-anchor="middle">
			{{ formatAxisValue(maxVal) }}
		</text>

		<!-- Fallback table for unmatched regions -->
		<template v-if="unmatchedRows.length > 0">
			<text :x="svgWidth / 2" :y="legendY + 26" text-anchor="middle" font-size="7" fill="#94a3b8">
				Additional regions (not shown on map)
			</text>
			<template v-for="row in fallbackRows" :key="`ft-row-${row.index}`">
				<rect
					v-if="row.hasBg"
					:x="fallbackTableX"
					:y="row.bgY"
					:width="fallbackColW * 2"
					:height="fallbackRowH"
					fill="#f1f5f9"
					rx="2"
				/>
				<text :x="row.labelX" :y="row.textY" :font-size="fallbackFontSize" fill="#334155">
					{{ row.label }}
				</text>
				<text :x="row.valueX" :y="row.textY" :font-size="fallbackFontSize" fill="#475569">
					{{ row.valueText }}
				</text>
			</template>
			<text
				v-if="unmatchedRows.length > 5"
				:x="svgWidth / 2"
				:y="fallbackMoreY"
				text-anchor="middle"
				font-size="6"
				fill="#94a3b8"
			>
				+{{ unmatchedRows.length - 5 }} more regions
			</text>
		</template>
	</g>
</template>
