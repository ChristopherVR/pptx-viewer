/**
 * smart-art-preview-geometry.ts: pure preview-thumbnail geometry for the
 * "Insert SmartArt" gallery, ported from the React `SmartArtPreviews.tsx`
 * thumbnails. Kept framework-free so the Angular preview component is a thin SVG
 * shell driven by these view-models and the geometry is unit-testable in plain
 * vitest.
 *
 * Each layout resolves to one of a small set of preview "kinds"; a kind expands
 * to a list of SVG primitive view-models (rect / circle / polygon / line) drawn
 * inside a `0 0 60 40` viewBox.
 *
 * @module angular-viewer/smart-art-preview-geometry
 */

import type { SmartArtLayout } from 'pptx-viewer-core';

/** The four-colour palette the React previews use. */
export const PREVIEW_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#eab308'] as const;

/** A rounded-rect preview primitive. */
export interface PreviewRect {
	kind: 'rect';
	x: number;
	y: number;
	width: number;
	height: number;
	rx: number;
	fill: string;
	opacity: number;
}

/** A circle preview primitive. */
export interface PreviewCircle {
	kind: 'circle';
	cx: number;
	cy: number;
	r: number;
	fill: string;
	opacity: number;
}

/** A polygon preview primitive (chevron arrows). */
export interface PreviewPolygon {
	kind: 'polygon';
	points: string;
	fill: string;
	opacity: number;
}

/** A connector line preview primitive (hierarchy / radial spokes). */
export interface PreviewLine {
	kind: 'line';
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	opacity: number;
}

/** Union of every preview primitive. */
export type PreviewShape = PreviewRect | PreviewCircle | PreviewPolygon | PreviewLine;

/** Resolver categories mirroring the React `getPreviewForLayout` switch. */
export type PreviewKind =
	| 'blockList'
	| 'chevron'
	| 'cycle'
	| 'radial'
	| 'hierarchy'
	| 'venn'
	| 'generic';

/** Map a layout to its preview kind (mirrors React `getPreviewForLayout`). */
export function previewKindForLayout(layout: SmartArtLayout): PreviewKind {
	switch (layout) {
		case 'basicBlockList':
		case 'stackedList':
		case 'tableList':
		case 'horizontalBulletList':
			return 'blockList';
		case 'basicChevronProcess':
		case 'segmentedProcess':
		case 'continuousBlockProcess':
		case 'upwardArrow':
			return 'chevron';
		case 'basicCycle':
		case 'basicPie':
			return 'cycle';
		case 'basicRadial':
		case 'convergingRadial':
			return 'radial';
		case 'hierarchy':
			return 'hierarchy';
		case 'basicVenn':
		case 'linearVenn':
			return 'venn';
		default:
			return 'generic';
	}
}

function blockList(): PreviewShape[] {
	return [0, 1, 2].map((i) => ({
		kind: 'rect',
		x: 4,
		y: 3 + i * 12,
		width: 52,
		height: 10,
		rx: 2,
		fill: PREVIEW_COLORS[i],
		opacity: 0.85,
	}));
}

function chevron(): PreviewShape[] {
	return [0, 1, 2].map((i) => {
		const x = 2 + i * 19;
		const lead = i > 0 ? x + 4 : x;
		return {
			kind: 'polygon',
			points: `${x},10 ${x + 14},10 ${x + 18},20 ${x + 14},30 ${x},30 ${lead},20`,
			fill: PREVIEW_COLORS[i],
			opacity: 0.85,
		};
	});
}

function cycle(): PreviewShape[] {
	return [0, 1, 2, 3].map((i) => {
		const angle = (i / 4) * Math.PI * 2 - Math.PI / 2;
		return {
			kind: 'circle',
			cx: 30 + 13 * Math.cos(angle),
			cy: 20 + 10 * Math.sin(angle),
			r: 6,
			fill: PREVIEW_COLORS[i],
			opacity: 0.85,
		};
	});
}

function radial(): PreviewShape[] {
	const shapes: PreviewShape[] = [
		{ kind: 'circle', cx: 30, cy: 20, r: 7, fill: PREVIEW_COLORS[0], opacity: 0.85 },
	];
	for (let i = 0; i < 3; i++) {
		const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
		const cx = 30 + 15 * Math.cos(angle);
		const cy = 20 + 12 * Math.sin(angle);
		shapes.push({ kind: 'line', x1: 30, y1: 20, x2: cx, y2: cy, opacity: 0.5 });
		shapes.push({ kind: 'circle', cx, cy, r: 5, fill: PREVIEW_COLORS[i + 1], opacity: 0.85 });
	}
	return shapes;
}

function hierarchy(): PreviewShape[] {
	return [
		{
			kind: 'rect',
			x: 20,
			y: 3,
			width: 20,
			height: 10,
			rx: 2,
			fill: PREVIEW_COLORS[0],
			opacity: 0.85,
		},
		{ kind: 'line', x1: 30, y1: 13, x2: 30, y2: 18, opacity: 1 },
		{ kind: 'line', x1: 15, y1: 18, x2: 45, y2: 18, opacity: 1 },
		{
			kind: 'rect',
			x: 4,
			y: 20,
			width: 18,
			height: 10,
			rx: 2,
			fill: PREVIEW_COLORS[1],
			opacity: 0.85,
		},
		{
			kind: 'rect',
			x: 38,
			y: 20,
			width: 18,
			height: 10,
			rx: 2,
			fill: PREVIEW_COLORS[2],
			opacity: 0.85,
		},
		{ kind: 'line', x1: 15, y1: 18, x2: 15, y2: 20, opacity: 1 },
		{ kind: 'line', x1: 45, y1: 18, x2: 45, y2: 20, opacity: 1 },
	];
}

function venn(): PreviewShape[] {
	return [
		{ kind: 'circle', cx: 22, cy: 20, r: 14, fill: PREVIEW_COLORS[0], opacity: 0.3 },
		{ kind: 'circle', cx: 38, cy: 20, r: 14, fill: PREVIEW_COLORS[1], opacity: 0.3 },
		{ kind: 'circle', cx: 30, cy: 10, r: 14, fill: PREVIEW_COLORS[2], opacity: 0.3 },
	];
}

function generic(): PreviewShape[] {
	return [0, 1, 2].map((i) => ({
		kind: 'rect',
		x: 4 + i * 18,
		y: 8,
		width: 16,
		height: 24,
		rx: 3,
		fill: PREVIEW_COLORS[i],
		opacity: 0.85,
	}));
}

/** Build the preview primitives for a layout. */
export function previewShapesForLayout(layout: SmartArtLayout): PreviewShape[] {
	switch (previewKindForLayout(layout)) {
		case 'blockList':
			return blockList();
		case 'chevron':
			return chevron();
		case 'cycle':
			return cycle();
		case 'radial':
			return radial();
		case 'hierarchy':
			return hierarchy();
		case 'venn':
			return venn();
		default:
			return generic();
	}
}
