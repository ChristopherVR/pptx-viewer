/**
 * React projector for the framework-agnostic chart view-model engine.
 *
 * `pptx-viewer-shared`'s `buildChartViewModel` projects a chart `PptxElement`
 * into a `ChartViewModel` of pure `SvgPrimitive` descriptors. This module maps
 * that descriptor list to React SVG JSX, mirroring the Angular
 * `ChartRendererComponent` template, so React, Vue and Angular share one
 * geometry/layout/data engine and only the markup emission stays per-framework.
 *
 * Colour preservation: the shared engine resolves series colours from
 * `chartData.colorPalette` (falling back to its own Office-accent default).
 * React historically resolves colours via the style-id-aware tailwind palette
 * (`getChartStylePalette`). To keep React's colours unchanged while aligning
 * only the geometry, `buildReactChartViewModel` resolves React's palette and
 * injects it as `colorPalette` before invoking the shared builder.
 *
 * @module chart-view-model-render
 */
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';
import { buildChartViewModel, chartPartToAttrs, getChartStylePalette } from 'pptx-viewer-shared';
import type {
	ChartPartRef,
	ChartViewModel,
	SvgCircle,
	SvgLine,
	SvgPath,
	SvgPolygon,
	SvgPolyline,
	SvgPrimitive,
	SvgRect,
	SvgText,
} from 'pptx-viewer-shared';
import React from 'react';

const LEGEND_ITEM_WIDTH = 80;

/**
 * `data-chart-*` hit-testing attributes for a tagged data-mark primitive.
 * Always emitted (they are inert without pointer events); `ChartElementView`
 * activates them in edit mode via CSS + event delegation.
 */
function partAttrs(part: ChartPartRef | undefined): Record<string, string> | undefined {
	return part ? chartPartToAttrs(part) : undefined;
}

/**
 * Resolve the colour palette React uses for a chart, mirroring the precedence
 * of `seriesColor(series, i, styleId, colorPalette)` in `chart-helpers.ts`:
 * an explicit parsed `colorPalette` wins, otherwise the style-id tailwind
 * palette (which itself falls back to `DEFAULT_CHART_PALETTE`).
 */
export function resolveReactPalette(chartData: PptxChartData): string[] {
	if (chartData.colorPalette && chartData.colorPalette.length > 0) {
		return chartData.colorPalette;
	}
	return [...getChartStylePalette(chartData.style?.styleId)];
}

/**
 * Build the shared `ChartViewModel` for a chart element using React's resolved
 * palette. The element's `chartData.colorPalette` is overlaid (non-destructively)
 * with React's palette so the shared engine's `seriesColor`/`paletteColor`
 * produce React's historical colours; only geometry aligns across frameworks.
 */
export function buildReactChartViewModel(element: PptxElement): ChartViewModel {
	if (element.type !== 'chart' || !element.chartData) {
		return buildChartViewModel(element);
	}
	const palette = resolveReactPalette(element.chartData);
	const themedElement: PptxElement = {
		...element,
		chartData: { ...element.chartData, colorPalette: palette },
	};
	return buildChartViewModel(themedElement);
}

function renderPrimitive(prim: SvgPrimitive, key: string): React.ReactNode {
	switch (prim.kind) {
		case 'rect': {
			const r = prim as SvgRect;
			return (
				<rect
					key={key}
					x={r.x}
					y={r.y}
					width={r.w}
					height={r.h}
					fill={r.fill}
					rx={r.rx ?? 0}
					opacity={r.opacity ?? 1}
					{...partAttrs(r.part)}
				/>
			);
		}
		case 'path': {
			const p = prim as SvgPath;
			return (
				<path
					key={key}
					d={p.d}
					fill={p.fill}
					stroke={p.stroke ?? 'none'}
					strokeWidth={p.strokeWidth ?? 0}
					fillOpacity={p.opacity ?? 1}
					{...partAttrs(p.part)}
				/>
			);
		}
		case 'polyline': {
			const p = prim as SvgPolyline;
			return (
				<polyline
					key={key}
					points={p.points}
					stroke={p.stroke}
					strokeWidth={p.strokeWidth}
					fill={p.fill}
					opacity={p.opacity ?? 1}
					{...partAttrs(p.part)}
				/>
			);
		}
		case 'circle': {
			const c = prim as SvgCircle;
			return (
				<circle
					key={key}
					cx={c.cx}
					cy={c.cy}
					r={c.r}
					fill={c.fill}
					opacity={c.opacity ?? 1}
					{...partAttrs(c.part)}
				/>
			);
		}
		case 'line': {
			const l = prim as SvgLine;
			return (
				<line
					key={key}
					x1={l.x1}
					y1={l.y1}
					x2={l.x2}
					y2={l.y2}
					stroke={l.stroke}
					strokeWidth={l.strokeWidth}
					strokeDasharray={l.dashArray}
					opacity={l.opacity ?? 1}
				/>
			);
		}
		case 'polygon': {
			const p = prim as SvgPolygon;
			return (
				<polygon
					key={key}
					points={p.points}
					fill={p.fill}
					stroke={p.stroke}
					strokeWidth={p.strokeWidth}
					opacity={p.opacity ?? 1}
					strokeDasharray={p.dashArray}
					{...partAttrs(p.part)}
				/>
			);
		}
		case 'text': {
			const t = prim as SvgText;
			return (
				<text
					key={key}
					x={t.x}
					y={t.y}
					textAnchor={t.textAnchor}
					fontSize={t.fontSize}
					fill={t.fill}
					fontWeight={t.fontWeight ?? 'normal'}
					dominantBaseline={
						t.dominantBaseline as React.SVGProps<SVGTextElement>['dominantBaseline']
					}
					opacity={t.opacity ?? 1}
					transform={t.transform}
				>
					{t.text}
				</text>
			);
		}
		default:
			return null;
	}
}

function renderText(t: SvgText, key: string): React.ReactNode {
	return (
		<text
			key={key}
			x={t.x}
			y={t.y}
			textAnchor={t.textAnchor}
			fontSize={t.fontSize}
			fill={t.fill}
			fontWeight={t.fontWeight ?? 'normal'}
			dominantBaseline={t.dominantBaseline as React.SVGProps<SVGTextElement>['dominantBaseline']}
			opacity={t.opacity ?? 1}
			transform={t.transform}
		>
			{t.text}
		</text>
	);
}

/**
 * Project a `ChartViewModel` to React SVG JSX. The wrapping `<svg>` keeps
 * React's idiomatic full-bleed, non-interactive styling and the slate
 * background tint used across the React chart renderers.
 *
 * `preserveAspectRatio` defaults to `none` (cartesian charts stretch to fill
 * the element box). Square chart kinds (pie / doughnut / radar) pass
 * `xMidYMid meet` so they stay circular regardless of the element's aspect.
 *
 * Secondary value axis: `secondaryGridlines` / `secondaryAxisLabels` are
 * rendered explicitly (dashed right-side gridlines + right-anchored labels).
 * Overlays (trendlines / error bars / axis titles) and the data-table block are
 * already appended to `vm.primitives` by the shared cartesian builder, so they
 * flow through the `vm.primitives` switch below; `vm.overlays` / `vm.dataTable`
 * are surfaced on the view-model only for projectors that want to segregate them.
 */
export function renderChartViewModel(
	elementId: string,
	vm: ChartViewModel,
	preserveAspectRatio: 'none' | 'xMidYMid meet' = 'none',
): React.ReactNode {
	const isVerticalLegend = vm.legendAnchor === 'start';
	return (
		<svg
			className='w-full h-full pointer-events-none'
			viewBox={`0 0 ${vm.svgWidth} ${vm.svgHeight}`}
			preserveAspectRatio={preserveAspectRatio}
		>
			<rect x={0} y={0} width={vm.svgWidth} height={vm.svgHeight} fill='#0f172a11' />

			{vm.title && (
				<text
					x={vm.titleX}
					y={vm.titleY}
					textAnchor='middle'
					fontSize={12}
					fontWeight={600}
					fill='#1e293b'
					data-chart-part='title'
				>
					{vm.title}
				</text>
			)}

			{vm.gridlines.map((gl, i) => (
				<line
					key={`${elementId}-gl-${i}`}
					x1={gl.x1}
					y1={gl.y1}
					x2={gl.x2}
					y2={gl.y2}
					stroke={gl.stroke}
					strokeWidth={gl.strokeWidth}
				/>
			))}

			{(vm.secondaryGridlines ?? []).map((gl, i) => (
				<line
					key={`${elementId}-sgl-${i}`}
					x1={gl.x1}
					y1={gl.y1}
					x2={gl.x2}
					y2={gl.y2}
					stroke={gl.stroke}
					strokeWidth={gl.strokeWidth}
					strokeDasharray={gl.dashArray}
					opacity={gl.opacity ?? 1}
				/>
			))}

			{vm.axisLabels.map((lbl, i) => renderText(lbl, `${elementId}-al-${i}`))}

			{(vm.secondaryAxisLabels ?? []).map((lbl, i) => renderText(lbl, `${elementId}-sal-${i}`))}

			{vm.zeroLine && (
				<line
					x1={vm.zeroLine.x1}
					y1={vm.zeroLine.y1}
					x2={vm.zeroLine.x2}
					y2={vm.zeroLine.y2}
					stroke={vm.zeroLine.stroke}
					strokeWidth={vm.zeroLine.strokeWidth}
				/>
			)}

			{vm.categoryLabels.map((lbl, i) => renderText(lbl, `${elementId}-cl-${i}`))}

			{vm.primitives.map((prim, i) => renderPrimitive(prim, `${elementId}-p-${i}`))}

			{vm.dataLabels.map((dl, i) => renderText(dl, `${elementId}-dl-${i}`))}

			{vm.legend.map((entry, i) => {
				const x = isVerticalLegend
					? vm.legendX
					: vm.legendX - (vm.legend.length * LEGEND_ITEM_WIDTH) / 2 + i * LEGEND_ITEM_WIDTH;
				const y = isVerticalLegend ? vm.legendY + i * 14 : vm.legendY;
				return (
					<g key={`${elementId}-lg-${i}`} transform={`translate(${x.toFixed(1)},${y.toFixed(1)})`}>
						<rect x={0} y={-7} width={10} height={10} rx={2} fill={entry.color} />
						<text x={13} y={3} fontSize={9} fill='#475569'>
							{entry.label}
						</text>
					</g>
				);
			})}
		</svg>
	);
}
