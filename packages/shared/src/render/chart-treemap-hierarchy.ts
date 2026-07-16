import type { PptxChartData, PptxChartParentLabelLayout, PptxChartSeries } from 'pptx-viewer-core';

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

interface TreemapBox {
	x: number;
	y: number;
	w: number;
	h: number;
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

function splitNodes(nodes: TreemapNode[], box: TreemapBox): Array<[TreemapNode, TreemapBox]> {
	const sorted = [...nodes].sort((a, b) => b.weight - a.weight);
	const total = sorted.reduce((sum, node) => sum + node.weight, 0);
	const fallback = total === 0 ? sorted.length : total;
	let remaining = fallback;
	let current = { ...box };
	return sorted.map((node) => {
		const weight = total === 0 ? 1 : node.weight;
		const fraction = remaining > 0 ? weight / remaining : 0;
		const splitWidth = current.w >= current.h;
		const allocated: TreemapBox = splitWidth
			? { ...current, w: current.w * fraction }
			: { ...current, h: current.h * fraction };
		if (splitWidth) {
			current = { ...current, x: current.x + allocated.w, w: current.w - allocated.w };
		} else {
			current = { ...current, y: current.y + allocated.h, h: current.h - allocated.h };
		}
		remaining -= weight;
		return [node, allocated];
	});
}

function renderNodes(
	nodes: TreemapNode[],
	box: TreemapBox,
	colorPalette: readonly string[] | undefined,
	primitives: TreemapPrimitive[],
): void {
	for (const [node, allocation] of splitNodes(nodes, box)) {
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
				colorPalette,
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
			});
		}
	}
}

/** Build nested treemap rectangles from ChartEx leaf-first category levels. */
export function buildHierarchicalTreemapPrimitives(
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
	box: TreemapBox,
): TreemapPrimitive[] {
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
	const primitives: TreemapPrimitive[] = [];
	renderNodes(roots, box, chartData.colorPalette, primitives);
	return primitives;
}
