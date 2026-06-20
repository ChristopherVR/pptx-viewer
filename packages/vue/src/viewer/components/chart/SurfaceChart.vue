<script setup lang="ts">
import type { PptxChartData } from 'pptx-viewer-core';
import type { PlotLayout, ValueRange } from 'pptx-viewer-shared';
import { computed } from 'vue';

/**
 * SurfaceChart: Vue port of the isometric SVG surface renderer from
 * `packages/react/src/viewer/utils/chart-surface-treemap.tsx`.
 *
 * Renders both `surface` and `surface3D` chart types as an isometric/2.5D
 * SVG mesh of filled parallelogram quads, colour-banded by data value.
 * Emits a `<g>` group meant to sit INSIDE the parent chart `<svg>`.
 *
 * For grids with at least 2 series × 2 categories, draws an isometric
 * projection (painter's algorithm, back-to-front). For degenerate grids
 * (single series or single category), falls back to a flat 2-D colour-mapped
 * heat grid.
 */

const props = defineProps<{
	chartData: PptxChartData;
	layout: PlotLayout;
	range: ValueRange;
	categories: ReadonlyArray<string>;
}>();

// ── Isometric projection constants ────────────────────────────────

/** cos(30°) used for isometric X projection. */
const ISO_COS30 = Math.cos(Math.PI / 6);
/** sin(30°) used for isometric Y projection. */
const ISO_SIN30 = Math.sin(Math.PI / 6);

/**
 * Map a normalised value t ∈ [0, 1] to the surface colour ramp:
 * blue at min → green at midpoint → red at max.
 */
function surfaceColor(t: number): string {
	const r = Math.round(30 + 200 * t);
	const g = Math.round(80 + 100 * (1 - Math.abs(t - 0.5) * 2));
	const b = Math.round(200 * (1 - t) + 30);
	return `rgb(${r},${g},${b})`;
}

/** Darken a surfaceColor-derived rgb() string by a factor (0 = black, 1 = unchanged). */
function darkenSurfaceColor(t: number, factor: number): string {
	const r = Math.round((30 + 200 * t) * factor);
	const g = Math.round((80 + 100 * (1 - Math.abs(t - 0.5) * 2)) * factor);
	const b = Math.round((200 * (1 - t) + 30) * factor);
	return `rgb(${r},${g},${b})`;
}

// ── Isometric mesh ────────────────────────────────────────────────

interface IsoQuad {
	points: string;
	fill: string;
	stroke: string;
}

const isoQuads = computed<IsoQuad[]>(() => {
	const data = props.chartData;
	const l = props.layout;
	const range = props.range;
	const catCount = Math.max(props.categories.length, 1);
	const seriesCount = data.series.length;

	// Need at least 2×2 grid vertices (i.e. 1×1 cell minimum) for isometric.
	// With < 2 series or < 2 categories the flat renderer is used instead.
	if (seriesCount < 2 || catCount < 2) {
		return [];
	}

	const cols = catCount - 1; // cell columns
	const rows = seriesCount - 1; // cell rows

	/** Normalised [0..1] value at grid vertex (row, col). */
	const normValue = (r: number, c: number): number => {
		const ri = Math.min(r, seriesCount - 1);
		const ci = Math.min(c, catCount - 1);
		const val = data.series[ri]?.values[ci] ?? 0;
		return range.span > 0 ? (val - range.min) / range.span : 0;
	};

	/** Project 3-D isometric (x, y, z) → 2-D screen coords. */
	const project = (x: number, y: number, z: number): { sx: number; sy: number } => ({
		sx: (x - y) * ISO_COS30,
		sy: (x + y) * ISO_SIN30 - z,
	});

	// Determine cell size to fit the projection in the plot area.
	const gridSpan = cols + rows;
	const cellByWidth = (l.plotWidth * 0.9) / (gridSpan * ISO_COS30);
	const cellByHeight = (l.plotHeight * 0.65) / (gridSpan * ISO_SIN30);
	const cellSize = Math.min(cellByWidth, cellByHeight);

	// Z (height) headroom: 30% of plot height for value displacement.
	const zScale = range.span > 0 ? l.plotHeight * 0.3 : 0;

	// Compute all vertex screen positions so we can centre the projection.
	const allPts: Array<{ sx: number; sy: number }> = [];
	for (let r = 0; r <= rows; r++) {
		for (let c = 0; c <= cols; c++) {
			const nv = normValue(r, c);
			allPts.push(project(c * cellSize, r * cellSize, nv * zScale));
		}
	}
	const minSX = Math.min(...allPts.map((p) => p.sx));
	const maxSX = Math.max(...allPts.map((p) => p.sx));
	const minSY = Math.min(...allPts.map((p) => p.sy));
	const maxSY = Math.max(...allPts.map((p) => p.sy));
	const projW = maxSX - minSX;
	const projH = maxSY - minSY;

	// Translation to centre projected grid inside the plot area.
	const offsetX = l.plotLeft + l.plotWidth / 2 - (minSX + projW / 2);
	const offsetY = l.plotTop + l.plotHeight / 2 - (minSY + projH / 2);

	// Sort cells back-to-front (painter's algorithm): higher depth = closer to viewer.
	const cells: Array<{ row: number; col: number; depth: number }> = [];
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			cells.push({ row: r, col: c, depth: r + c });
		}
	}
	cells.sort((a, b) => a.depth - b.depth);

	const quads: IsoQuad[] = [];
	for (const { row, col } of cells) {
		// Four corners of this cell in grid space (col, row order for isometric X/Y).
		const corners: Array<[number, number]> = [
			[col, row],
			[col + 1, row],
			[col + 1, row + 1],
			[col, row + 1],
		];

		const verts = corners.map(([c, r]) => {
			const nv = normValue(r, c);
			const { sx, sy } = project(c * cellSize, r * cellSize, nv * zScale);
			return `${(sx + offsetX).toFixed(2)},${(sy + offsetY).toFixed(2)}`;
		});

		// Average normalised value of the four corners for colour mapping.
		const avgT =
			(normValue(row, col) +
				normValue(row, col + 1) +
				normValue(row + 1, col + 1) +
				normValue(row + 1, col)) /
			4;

		const pointsStr = verts.join(' ');
		quads.push({
			points: pointsStr,
			fill: surfaceColor(avgT),
			stroke: darkenSurfaceColor(avgT, 0.6),
		});
	}

	return quads;
});

// ── Flat fallback (single series or single category) ──────────────

interface FlatCell {
	x: number;
	y: number;
	width: number;
	height: number;
	fill: string;
}

const flatCells = computed<FlatCell[]>(() => {
	const data = props.chartData;
	const l = props.layout;
	const range = props.range;
	const catCount = Math.max(props.categories.length, 1);
	const seriesCount = data.series.length;

	// Only used when the grid is too small for isometric.
	if (seriesCount >= 2 && catCount >= 2) {
		return [];
	}
	if (seriesCount === 0) {
		return [];
	}

	const cellW = l.plotWidth / Math.max(catCount, 1);
	const cellH = l.plotHeight / Math.max(seriesCount, 1);
	const cells: FlatCell[] = [];

	for (let si = 0; si < seriesCount; si++) {
		for (let ci = 0; ci < catCount; ci++) {
			const val = data.series[si]?.values[ci] ?? 0;
			const t = range.span > 0 ? (val - range.min) / range.span : 0;
			cells.push({
				x: l.plotLeft + ci * cellW,
				y: l.plotTop + si * cellH,
				width: cellW + 0.5,
				height: cellH + 0.5,
				fill: surfaceColor(t),
			});
		}
	}
	return cells;
});

const isFlat = computed(
	() =>
		props.chartData.series.length === 0 ||
		props.chartData.series.length < 2 ||
		Math.max(props.categories.length, 1) < 2,
);
</script>

<template>
	<g class="pptx-vue-surface-chart">
		<!-- Isometric mesh (≥2 series × ≥2 categories) -->
		<template v-if="!isFlat">
			<!-- Face fill quads -->
			<polygon
				v-for="(q, i) in isoQuads"
				:key="`surf-face-${i}`"
				:points="q.points"
				:fill="q.fill"
				opacity="0.9"
			/>
			<!-- Wireframe edge overlays for depth perception -->
			<polygon
				v-for="(q, i) in isoQuads"
				:key="`surf-edge-${i}`"
				:points="q.points"
				fill="none"
				:stroke="q.stroke"
				stroke-width="0.5"
				opacity="0.7"
			/>
		</template>

		<!-- Flat colour-mapped heat grid (degenerate / single-series) -->
		<template v-else>
			<rect
				v-for="(c, i) in flatCells"
				:key="`surf-flat-${i}`"
				:x="c.x"
				:y="c.y"
				:width="c.width"
				:height="c.height"
				:fill="c.fill"
				opacity="0.85"
			/>
		</template>
	</g>
</template>
