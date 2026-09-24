/**
 * World-space types of the right-angle-axes 3D bar chart layout
 * (`chart-3d-oblique-layout.ts`).
 *
 * @module chart-3d-oblique-types
 */
import type { PptxBar3DShape } from 'pptx-viewer-core';

import type { ObliqueLabel } from './chart-3d-oblique-labels';

/** One bar as a world-space box. */
export interface ObliqueBar {
	x: number;
	y: number;
	z: number;
	/** Extent along world X / Y / Z. */
	w: number;
	h: number;
	d: number;
	color: string;
	seriesIndex: number;
	categoryIndex: number;
	value: number;
	/** Resolved `c:shape` (per-series `c:ser/c:shape`, else the chart's). */
	shape: PptxBar3DShape;
	/** Cross-section radius at the bar's baseline / value end, as a fraction of the full footprint. */
	taper: ObliqueTaper;
}

/** How a shaped bar narrows along the value axis (1 = full footprint, 0 = a point). */
export interface ObliqueTaper {
	bottom: number;
	top: number;
}

/** A gridline segment in world space. */
export interface ObliqueGridline {
	from: readonly [number, number, number];
	to: readonly [number, number, number];
}

export interface ObliqueChartLayout {
	horizontal: boolean;
	grouping: 'clustered' | 'stacked' | 'percentStacked' | 'standard';
	/** Chart px of world (0, 0, 0): the front-bottom-left corner of the floor. */
	origin: { x: number; y: number };
	/** Screen shift per world unit of depth: `(sin rotY, -sin rotX)`. */
	shear: { x: number; y: number };
	box: { w: number; h: number; d: number };
	range: { min: number; max: number; majorUnit: number };
	/** Chart px per value unit along the value axis. */
	valueScale: number;
	bars: ObliqueBar[];
	gridlines: ObliqueGridline[];
	labels: ObliqueLabel[];
}
