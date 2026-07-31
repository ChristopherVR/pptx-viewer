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
		buildStrokeOutline,
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
	 * Stroked SVG outline for a gradient or pattern `a:ln`. A CSS border takes one
	 * flat colour only, so the outline is painted here instead, following the
	 * shape's own geometry; `element-style.ts` drops the border for these shapes.
	 */
	const strokeOutline = $derived(buildStrokeOutline(element));
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
			{#if strokeOutline.paint.kind === 'pattern'}
				<pattern
					id={strokeOutline.paint.id}
					width={strokeOutline.paint.width}
					height={strokeOutline.paint.height}
					patternUnits="userSpaceOnUse"
				>
					<image
						href={strokeOutline.paint.href}
						width={strokeOutline.paint.width}
						height={strokeOutline.paint.height}
					/>
				</pattern>
			{:else if strokeOutline.paint.kind === 'radial'}
				<radialGradient
					id={strokeOutline.paint.id}
					cx={strokeOutline.paint.cx}
					cy={strokeOutline.paint.cy}
					r={strokeOutline.paint.r}
				>
					{#each strokeOutline.paint.stops as stop, idx (idx)}
						<stop offset={stop.offset} stop-color={stop.color} stop-opacity={stop.opacity} />
					{/each}
				</radialGradient>
			{:else}
				<linearGradient
					id={strokeOutline.paint.id}
					x1={strokeOutline.paint.x1}
					y1={strokeOutline.paint.y1}
					x2={strokeOutline.paint.x2}
					y2={strokeOutline.paint.y2}
				>
					{#each strokeOutline.paint.stops as stop, idx (idx)}
						<stop offset={stop.offset} stop-color={stop.color} stop-opacity={stop.opacity} />
					{/each}
				</linearGradient>
			{/if}
		</defs>
		<path
			d={strokeOutline.d}
			fill="none"
			stroke={svgGradientFillRef(strokeOutline.paint)}
			stroke-width={strokeOutline.strokeWidth}
			stroke-dasharray={strokeOutline.dashArray}
			stroke-linecap={strokeOutline.lineCap}
			stroke-linejoin={strokeOutline.lineJoin}
		/>
	</svg>
{/if}
