import type { PptxElement } from 'pptx-viewer-core';
import { chartPreserveAspectRatio, resolveChartKind } from 'pptx-viewer-shared';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React from 'react';

import { buildReactChartViewModel, renderChartViewModel } from './chart-view-model-render';

/**
 * Main entry point for chart rendering.
 *
 * EVERY chart kind is projected from the framework-agnostic `buildChartViewModel`
 * engine in `pptx-viewer-shared`. This module decides nothing about geometry; it
 * resolves React's palette (via `buildReactChartViewModel`) and asks shared which
 * aspect-ratio policy the kind wants.
 *
 * Historically waterfall / combo / stock / surface / treemap / regionMap were
 * drawn by private React renderers. They emitted no `data-chart-part`
 * attributes, so on-canvas mark selection did nothing for exactly those kinds
 * while it worked in Angular, Svelte and Vanilla; and two of them were plainly
 * wrong. The waterfall scaled its CUMULATIVE bars against the range of the RAW
 * values, so a rising waterfall left the plot (its total bar was emitted at
 * y=-650.6 with height 1026.6 inside a 420px-tall SVG), and the treemap ignored
 * `c:categoryLevels`, so a hierarchical ChartEx treemap came out flat.
 *
 * Surface came back through here too. React used to paint it as an interactive
 * Three.js scene, which made it the only binding whose surface chart was a
 * `<canvas>`: no marks to select, nothing for the SVG parity harness to compare,
 * and a picture no other viewer drew. The scene controller itself is still in
 * shared (`render/surface-chart-3d-scene.ts`, `mountSurfaceChart3D`), so the
 * capability is intact and a future opt-in can wire it in ALL five bindings the
 * way `smartArt3D` already is.
 */
export function renderChartElement(element: PptxElement): React.ReactNode {
	if (element.type !== 'chart') {
		return (
			<div className='w-full h-full flex items-center justify-center text-[11px] text-white/80 pointer-events-none'>
				{translationsEn['pptx.chart.heading']}
			</div>
		);
	}

	const chartData = element.chartData;
	if (!chartData || chartData.series.length === 0) {
		return (
			<div className='w-full h-full flex items-center justify-center text-[11px] text-white/80 pointer-events-none'>
				{translationsEn['pptx.chart.heading']}
			</div>
		);
	}

	const kind = resolveChartKind(chartData.chartType ?? 'bar');
	return renderChartViewModel(
		element.id,
		buildReactChartViewModel(element),
		chartPreserveAspectRatio(kind),
	);
}
