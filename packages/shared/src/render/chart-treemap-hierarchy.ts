import type { PptxChartData, PptxChartParentLabelLayout, PptxChartSeries } from 'pptx-viewer-core';

import { dataLabelFontOverride, resolveDataLabelTextStyle } from './chart-data-label-text';
import type { TreemapBox } from './chart-treemap-squarify';
import { squarify } from './chart-treemap-squarify';
import type { SvgRect, SvgText } from './chart-view-model';
import { paletteColor } from './chart-view-model';

interface TreemapNode {
	label: string;
	weight: number;
	children?: TreemapNode[];
	seriesIndex?: number;
	pointIndex?: number;
	colorIndex: number;
	parentLabelLayout: PptxChartParentLabelLayout;
}

export type TreemapPrimitive = SvgRect | SvgText;

function normalizedLevels(
	levels: ReadonlyArray<ReadonlyArray<string>>,
	pointCount: number,
): string[][] {
	return levels.map((level) => {
		let previous = '';
		return Array.from({ length: pointCount }, (_, index) => {
			const label = level[index]?.trim() ?? '';
			if (label) {
				previous = label;
			}
			return label || previous;
		});
	});
}

function findOrAddParent(
	children: TreemapNode[],
	label: string,
	colorIndex: number,
	parentLabelLayout: PptxChartParentLabelLayout,
): TreemapNode {
	const existing = children.find((child) => child.children && child.label === label);
	if (existing) {
		return existing;
	}
	const parent: TreemapNode = {
		label,
		weight: 0,
		children: [],
		colorIndex,
		parentLabelLayout,
	};
	children.push(parent);
	return parent;
}

function buildSeriesHierarchy(
	series: PptxChartSeries,
	seriesIndex: number,
	categoryLabels: ReadonlyArray<string>,
	categoryLevels: ReadonlyArray<ReadonlyArray<string>> | undefined,
	colorStride: number,
): TreemapNode[] {
	const pointCount = series.values.length;
	const levels = normalizedLevels(categoryLevels ?? [], pointCount);
	const layout = series.treemapOptions?.parentLabelLayout ?? 'banner';
	const roots: TreemapNode[] = [];
	for (let pointIndex = 0; pointIndex < pointCount; pointIndex++) {
		let children = roots;
		for (let levelIndex = levels.length - 1; levelIndex >= 1; levelIndex--) {
			const label = levels[levelIndex][pointIndex] || `Group ${levelIndex}`;
			children = findOrAddParent(children, label, pointIndex, layout).children!;
		}
		children.push({
			label: levels[0]?.[pointIndex] || categoryLabels[pointIndex] || String(pointIndex + 1),
			weight: Math.abs(series.values[pointIndex] ?? 0),
			seriesIndex,
			pointIndex,
			colorIndex: seriesIndex * colorStride + pointIndex,
			parentLabelLayout: layout,
		});
	}
	return roots;
}

function aggregate(node: TreemapNode): number {
	if (node.children) {
		node.weight = node.children.reduce((sum, child) => sum + aggregate(child), 0);
	}
	return node.weight;
}

/** Propagate a single colour index from a top-level branch down to every one of its leaves. */
function propagateColor(node: TreemapNode, colorIndex: number): void {
	node.colorIndex = colorIndex;
	if (node.children) {
		for (const child of node.children) {
			propagateColor(child, colorIndex);
		}
	}
}

function renderNodes(
	nodes: TreemapNode[],
	box: TreemapBox,
	chartData: PptxChartData,
	primitives: TreemapPrimitive[],
): void {
	const colorPalette = chartData.colorPalette;
	for (const [node, allocation] of squarify(nodes, box)) {
		const cell = {
			x: allocation.x + 1,
			y: allocation.y + 1,
			w: Math.max(allocation.w - 2, 1),
			h: Math.max(allocation.h - 2, 1),
		};
		if (node.children) {
			const showParent = node.parentLabelLayout !== 'none' && cell.w > 28 && cell.h > 16;
			if (showParent) {
				primitives.push({
					kind: 'text',
					x: cell.x + 4,
					y: cell.y + 11,
					text: node.label,
					fontSize: 10,
					fill: '#303030',
					textAnchor: 'start',
					fontWeight: 'bold',
				});
			}
			const bannerHeight = showParent && node.parentLabelLayout === 'banner' ? 16 : 0;
			renderNodes(
				node.children,
				{ ...cell, y: cell.y + bannerHeight, h: Math.max(cell.h - bannerHeight, 1) },
				chartData,
				primitives,
			);
			continue;
		}
		primitives.push({
			kind: 'rect',
			...cell,
			fill: paletteColor(node.colorIndex, colorPalette),
			rx: 2,
			opacity: 0.85,
			part: {
				role: 'dataPoint',
				seriesIndex: node.seriesIndex!,
				pointIndex: node.pointIndex!,
			},
		});
		if (cell.w > 30 && cell.h > 14) {
			const leafSeries = chartData.series[node.seriesIndex!];
			primitives.push({
				kind: 'text',
				x: cell.x + cell.w / 2,
				y: cell.y + cell.h / 2,
				text: node.label,
				fontSize: Math.min(10, cell.h * 0.3),
				fill: '#ffffff',
				textAnchor: 'middle',
				fontWeight: 'bold',
				dominantBaseline: 'central',
				...(leafSeries
					? dataLabelFontOverride(
							resolveDataLabelTextStyle(chartData, leafSeries, node.pointIndex!),
						)
					: {}),
			});
		}
	}
}

/**
 * The top-level branch labels a treemap's legend should show, in the same
 * order `buildHierarchicalTreemapPrimitives` assigns colour indexes to its
 * roots: one label per authored `c:ser`/`cx:series` when there is more than
 * one, else one per unique top ChartEx category level, else (a flat,
 * non-hierarchical treemap) one per leaf category. A legend built from
 * anything else would show swatches that do not match what a leaf's fill
 * colour actually is.
 */
export function treemapBranchLabels(
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
): string[] {
	if (chartData.series.length > 1) {
		return chartData.series.map((series) => series.name);
	}
	const levels = chartData.categoryLevels;
	if (levels && levels.length > 1) {
		const pointCount = chartData.series[0]?.values.length ?? categoryLabels.length;
		const topLevel = normalizedLevels(levels, pointCount).at(-1) ?? [];
		const seen: string[] = [];
		for (const label of topLevel) {
			if (!seen.includes(label)) {
				seen.push(label);
			}
		}
		return seen;
	}
	return [...categoryLabels];
}

/** Build nested treemap rectangles from ChartEx leaf-first category levels. */
export function buildHierarchicalTreemapPrimitives(
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
	box: TreemapBox,
): TreemapPrimitive[] {
	// Only used to keep each node's initial colorIndex distinct while the tree
	// is being built; propagateColor (below) overwrites every one of them with
	// its top-level branch's colour before rendering, so this stride never
	// actually reaches the renderer.
	const colorStride = Math.max(
		categoryLabels.length,
		...chartData.series.map((s) => s.values.length),
		1,
	);
	let roots = chartData.series.flatMap((series, seriesIndex) =>
		buildSeriesHierarchy(
			series,
			seriesIndex,
			categoryLabels,
			chartData.categoryLevels,
			colorStride,
		),
	);
	if (chartData.series.length > 1) {
		roots = chartData.series.map((series, seriesIndex) => ({
			label: series.name,
			weight: 0,
			children: buildSeriesHierarchy(
				series,
				seriesIndex,
				categoryLabels,
				chartData.categoryLevels,
				colorStride,
			),
			colorIndex: seriesIndex * colorStride,
			parentLabelLayout: series.treemapOptions?.parentLabelLayout ?? 'banner',
		}));
	}
	for (const root of roots) {
		aggregate(root);
	}
	// One colour per TOP-LEVEL branch, propagated to every one of its leaves
	// (COM-verified against charts-com.pptx slide 28 / chartEx3.xml: every
	// leaf under "Branch 1" paints the same colour as "Branch 1"'s legend
	// swatch). A flat, non-hierarchical treemap has one leaf per root, so
	// this is equivalent to the previous per-category colour there.
	roots.forEach((root, index) => propagateColor(root, index));
	const primitives: TreemapPrimitive[] = [];
	renderNodes(roots, box, chartData, primitives);
	return primitives;
}
