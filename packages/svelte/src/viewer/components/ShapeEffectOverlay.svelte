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
	 *  2. A stroked SVG OUTLINE, for the two cases a CSS `border` cannot paint: a
	 *     gradient / pattern line (`a:ln/a:gradFill`, `a:ln/a:pattFill`), which a
	 *     border renders as one flat colour, and a stroke-only ("open") preset
	 *     such as `line` or `arc`, which has no box to put a border on.
	 *  3. The soft-edge feather `<filter>` (`a:softEdge`): the shape's CSS `filter`
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
		strokeOutlineViewBox,
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
	 * Stroked SVG outline, for the two cases a CSS border cannot paint: a
	 * gradient / pattern `a:ln` (a border takes one flat colour only) and a
	 * stroke-only ("open") preset such as `line` or `arc` (which has no box to
	 * put a border on). Follows the shape's own geometry; `element-style.ts`
	 * drops the border for these shapes.
	 */
	const strokeOutline = $derived(buildStrokeOutline(element));
	/** viewBox in the element's PAINTED box, which the path data is authored in. */
	const outlineViewBox = $derived(strokeOutlineViewBox(element));
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
		{#if strokeOutline.paint}
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
		{/if}
		{#each strokeOutline.strands as strand, idx (idx)}
			<path
				d={strokeOutline.d}
				fill="none"
				stroke={strokeOutline.stroke}
				stroke-width={strand.strokeWidth}
				stroke-dasharray={strokeOutline.dashArray}
				stroke-linecap={strokeOutline.lineCap}
				stroke-linejoin={strokeOutline.lineJoin}
				style={strand.offset !== 0 ? `transform:translate(0, ${strand.offset}px)` : undefined}
			/>
		{/each}
	</svg>
{/if}
