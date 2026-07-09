import type { PptxElement, PptxChartData } from 'pptx-viewer-core';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React from 'react';

import { formatAxisValue } from './chart-helpers';
import { buildReactChartViewModel, renderChartViewModel } from './chart-view-model-render';

/**
 * Render a box-and-whisker chart.
 *
 * Geometry, layout and palette now flow through the framework-agnostic
 * `buildBoxWhiskerViewModel` engine in `pptx-viewer-shared` (dispatched by
 * `buildChartViewModel` on `chartType === 'boxWhisker'`). React's style-id
 * palette is threaded in via `buildReactChartViewModel`. The `chartData` /
 * `categoryLabels` parameters are retained for `chart.tsx` dispatcher signature
 * stability; the shared builder derives its own category labels.
 */
export function renderBoxWhiskerChart(
	element: PptxElement,
	_chartData: PptxChartData,
	_categoryLabels: ReadonlyArray<string>,
): React.ReactNode {
	return renderChartViewModel(element.id, buildReactChartViewModel(element));
}

/**
 * Render a histogram chart: contiguous bars with no gaps.
 *
 * Geometry, layout and palette now flow through the framework-agnostic
 * `buildHistogramViewModel` engine in `pptx-viewer-shared` (dispatched by
 * `buildChartViewModel` on `chartType === 'histogram'`). React's style-id palette
 * is threaded in via `buildReactChartViewModel`.
 */
export function renderHistogramChart(
	element: PptxElement,
	_chartData: PptxChartData,
	_categoryLabels: ReadonlyArray<string>,
): React.ReactNode {
	return renderChartViewModel(element.id, buildReactChartViewModel(element));
}

/** Render a geographic map chart fallback as a data table/legend. */
export function renderMapChartFallback(
	element: PptxElement,
	chartData: PptxChartData,
	categoryLabels: ReadonlyArray<string>,
): React.ReactNode {
	const series = chartData.series;
	const categories = categoryLabels.length > 0 ? categoryLabels : chartData.categories;
	const svgWidth = element.width;
	const svgHeight = element.height;

	const rowHeight = Math.min(18, svgHeight / Math.max(categories.length + 2, 3));
	const fontSize = Math.min(10, rowHeight * 0.6);
	const headerY = 30;
	const tableX = 10;
	const colWidth = Math.max((svgWidth - 20) / (series.length + 1), 60);

	const elements: React.ReactNode[] = [];

	// Title
	if (chartData.title) {
		elements.push(
			<text
				key={`${element.id}-map-title`}
				x={svgWidth / 2}
				y={16}
				textAnchor='middle'
				fontSize={12}
				fontWeight={700}
				fill='#334155'
			>
				{chartData.title}
			</text>,
		);
	}

	// Map icon placeholder
	elements.push(
		<text
			key={`${element.id}-map-icon`}
			x={svgWidth / 2}
			y={headerY - 4}
			textAnchor='middle'
			fontSize={8}
			fill='#94a3b8'
		>
			{translationsEn['pptx.chart.geoMapDataView']}
		</text>,
	);

	// Column headers
	elements.push(
		<text
			key={`${element.id}-map-h-cat`}
			x={tableX + 4}
			y={headerY + rowHeight}
			fontSize={fontSize}
			fontWeight={700}
			fill='#1e293b'
		>
			{translationsEn['pptx.chart.regionColumnHeader']}
		</text>,
	);
	series.forEach((s, si) => {
		elements.push(
			<text
				key={`${element.id}-map-h-${si}`}
				x={tableX + colWidth * (si + 1) + 4}
				y={headerY + rowHeight}
				fontSize={fontSize}
				fontWeight={700}
				fill='#1e293b'
			>
				{s.name}
			</text>,
		);
	});

	// Header underline
	elements.push(
		<line
			key={`${element.id}-map-hline`}
			x1={tableX}
			y1={headerY + rowHeight + 4}
			x2={svgWidth - 10}
			y2={headerY + rowHeight + 4}
			stroke='#cbd5e1'
			strokeWidth={1}
		/>,
	);

	// Data rows
	categories.forEach((cat, ci) => {
		const y = headerY + rowHeight * (ci + 2) + 4;
		if (y + rowHeight > svgHeight) {
			return;
		}

		// Alternating row background
		if (ci % 2 === 0) {
			elements.push(
				<rect
					key={`${element.id}-map-bg-${ci}`}
					x={tableX}
					y={y - rowHeight + 4}
					width={svgWidth - 20}
					height={rowHeight}
					fill='#f1f5f9'
					rx={2}
				/>,
			);
		}

		elements.push(
			<text
				key={`${element.id}-map-cat-${ci}`}
				x={tableX + 4}
				y={y}
				fontSize={fontSize}
				fill='#334155'
			>
				{cat}
			</text>,
		);

		series.forEach((s, si) => {
			const val = s.values[ci];
			elements.push(
				<text
					key={`${element.id}-map-v-${ci}-${si}`}
					x={tableX + colWidth * (si + 1) + 4}
					y={y}
					fontSize={fontSize}
					fill='#475569'
				>
					{val !== undefined ? formatAxisValue(val) : '-'}
				</text>,
			);
		});
	});

	// Color legend bar
	if (series.length > 0) {
		const legendY = Math.min(headerY + rowHeight * (categories.length + 3), svgHeight - 20);
		if (legendY < svgHeight - 10) {
			const vals = series[0].values.filter((v) => Number.isFinite(v));
			const minVal = Math.min(...vals, 0);
			const maxVal = Math.max(...vals, 1);
			const barW = Math.min(svgWidth * 0.5, 150);
			const barX = (svgWidth - barW) / 2;

			elements.push(
				<defs key={`${element.id}-map-defs`}>
					<linearGradient id={`${element.id}-map-grad`} x1='0' y1='0' x2='1' y2='0'>
						<stop offset='0%' stopColor='#dbeafe' />
						<stop offset='50%' stopColor='#3b82f6' />
						<stop offset='100%' stopColor='#1e3a5f' />
					</linearGradient>
				</defs>,
				<rect
					key={`${element.id}-map-bar`}
					x={barX}
					y={legendY}
					width={barW}
					height={8}
					rx={4}
					fill={`url(#${element.id}-map-grad)`}
				/>,
				<text
					key={`${element.id}-map-min`}
					x={barX}
					y={legendY + 18}
					fontSize={7}
					fill='#64748b'
					textAnchor='middle'
				>
					{formatAxisValue(minVal)}
				</text>,
				<text
					key={`${element.id}-map-max`}
					x={barX + barW}
					y={legendY + 18}
					fontSize={7}
					fill='#64748b'
					textAnchor='middle'
				>
					{formatAxisValue(maxVal)}
				</text>,
			);
		}
	}

	return (
		<svg
			className='w-full h-full pointer-events-none'
			viewBox={`0 0 ${svgWidth} ${svgHeight}`}
			preserveAspectRatio='none'
		>
			<rect x={0} y={0} width={svgWidth} height={svgHeight} fill='#f8fafc' rx={4} />
			{elements}
		</svg>
	);
}

/**
 * Render a grouped (clustered) bar / column chart.
 *
 * Geometry, layout, chrome (gridlines / axes / category labels / legend),
 * secondary value axis, log / display-unit axes, and overlays (trendlines /
 * error bars / axis titles / data table) all flow through the framework-agnostic
 * `buildChartViewModel` engine in `pptx-viewer-shared` (dispatched on
 * `chartType === 'bar'` / `'column'` with a non-stacked grouping). React's
 * style-id palette is threaded in via `buildReactChartViewModel`, so only colour
 * stays React-specific; geometry is identical across React / Vue / Angular.
 *
 * The `chartData` / `categoryLabels` parameters are retained for `chart.tsx`
 * dispatcher signature stability; the shared builder derives its own.
 */
export function renderDefaultBarChart(
	element: PptxElement,
	_chartData: PptxChartData,
	_categoryLabels: ReadonlyArray<string>,
): React.ReactNode {
	return renderChartViewModel(element.id, buildReactChartViewModel(element));
}
