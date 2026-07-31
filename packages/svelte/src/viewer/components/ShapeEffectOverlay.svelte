<script lang="ts">
	/**
	 * ShapeEffectOverlay: paints the two shape-effect extras that need their own
	 * DOM nodes (the shape's CSS `filter`/`box-shadow`/blend already ride on the
	 * shape `<div>` from `element-style.ts`). Svelte port of Vue's
	 * `ShapeEffectOverlay.vue`:
	 *
	 *  1. A DAG fill-overlay tint layer (`ComputedEffectStyle.fillOverlay`): an
	 *     absolutely-positioned, blended `<div>` painted over the element rather
	 *     than blending the whole element (which would also tint text/children).
	 *  2. The soft-edge feather `<filter>` (`a:softEdge`): the shape's CSS `filter`
	 *     already carries a `url(#soft-edge-<id>)` reference (emitted by shared
	 *     `getEffectFilterCss`); this injects the matching `<filter>` markup into a
	 *     hidden, zero-size `<svg><defs>` so that reference resolves, mirroring how
	 *     `DuotoneFilterDefs` injects the duotone filter.
	 *
	 * Renders nothing when the element has no fill overlay and no soft edge.
	 */
	import { hasShapeProperties } from 'pptx-viewer-core';
	import {
		buildGradientStrokeOutline,
		getComputedEffectStyle,
		getSoftEdgeSvgFilter,
		svgGradientFillRef,
	} from 'pptx-viewer-shared';

	import type { ElementRendererProps } from './props';

	const { element }: ElementRendererProps = $props();

	/** DAG fill-overlay tint (colour + blend mode), when present. */
	const fillOverlay = $derived(getComputedEffectStyle(element).fillOverlay);

	/** Absolutely-positioned tint-layer style, painted over the element box. */
	const fillOverlayStyle = $derived(
		fillOverlay
			? `position:absolute;inset:0;background:${fillOverlay.color};mix-blend-mode:${fillOverlay.blendMode};pointer-events:none`
			: undefined,
	);

	/** Soft-edge `<filter>` definition for this element, when a soft edge applies. */
	const softEdge = $derived(
		hasShapeProperties(element)
			? getSoftEdgeSvgFilter(element.shapeStyle, element.id)
			: undefined,
	);

	/**
	 * Stroked SVG outline for a gradient `a:ln`. A CSS border takes one colour
	 * only, so a gradient outline is painted here instead, following the shape's
	 * own geometry; `element-style.ts` drops the border for these shapes.
	 */
	const strokeOutline = $derived(buildGradientStrokeOutline(element));
	const outlineViewBox = $derived(
		`0 0 ${Math.max(element.width, 1)} ${Math.max(element.height, 1)}`,
	);
</script>

{#if softEdge}
	<svg width="0" height="0" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">
		<defs>{@html softEdge.filterMarkup}</defs>
	</svg>
{/if}
{#if fillOverlayStyle}
	<div class="pptx-svelte-fill-overlay" aria-hidden="true" style={fillOverlayStyle}></div>
{/if}
{#if strokeOutline}
	<svg
		class="pptx-svelte-gradient-outline"
		aria-hidden="true"
		viewBox={outlineViewBox}
		preserveAspectRatio="none"
		style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none"
	>
		<defs>
			{#if strokeOutline.gradient.kind === 'radial'}
				<radialGradient
					id={strokeOutline.gradient.id}
					cx={strokeOutline.gradient.cx}
					cy={strokeOutline.gradient.cy}
					r={strokeOutline.gradient.r}
				>
					{#each strokeOutline.gradient.stops as stop, idx (idx)}
						<stop offset={stop.offset} stop-color={stop.color} stop-opacity={stop.opacity} />
					{/each}
				</radialGradient>
			{:else}
				<linearGradient
					id={strokeOutline.gradient.id}
					x1={strokeOutline.gradient.x1}
					y1={strokeOutline.gradient.y1}
					x2={strokeOutline.gradient.x2}
					y2={strokeOutline.gradient.y2}
				>
					{#each strokeOutline.gradient.stops as stop, idx (idx)}
						<stop offset={stop.offset} stop-color={stop.color} stop-opacity={stop.opacity} />
					{/each}
				</linearGradient>
			{/if}
		</defs>
		<path
			d={strokeOutline.d}
			fill="none"
			stroke={svgGradientFillRef(strokeOutline.gradient)}
			stroke-width={strokeOutline.strokeWidth}
			stroke-dasharray={strokeOutline.dashArray}
			stroke-linecap={strokeOutline.lineCap}
			stroke-linejoin={strokeOutline.lineJoin}
		/>
	</svg>
{/if}
