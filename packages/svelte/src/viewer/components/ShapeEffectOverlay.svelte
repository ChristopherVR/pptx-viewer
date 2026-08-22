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
	 *  4. A per-sub-path FILL overlay, for a multi-sub-path preset (`smileyFace`'s
	 *     open eyes, `actionButtonBlank`'s darkened bevel well) whose sub-paths
	 *     cannot share one CSS `background-color`: `element-style.ts` drops the
	 *     container fill for these (via shared `suppressesCssFill`) so this
	 *     layered SVG paints it instead, each sub-path with its own resolved fill.
	 *
	 * Renders nothing when the element has no fill overlay and no soft edge.
	 */
	import { hasShapeProperties } from 'pptx-viewer-core';
	import {
		buildStrokeOutline,
		buildSubpathFillOverlay,
		getComputedEffectStyle,
		getSoftEdgeSvgFilter,
		buildHollowHitOutline,
		strokeOutlineViewBox,
	} from 'pptx-viewer-shared';

	import type { ElementRendererProps } from './props';

	const { element }: ElementRendererProps = $props();

	/**
	 * Per-sub-path fill overlay for a multi-sub-path preset or custom geometry,
	 * or `undefined` when a single merged fill is correct (the ordinary case).
	 */
	const subpathFill = $derived(buildSubpathFillOverlay(element));

	/** `viewBox` for the sub-path fill overlay, in its own coordinate space. */
	const subpathFillViewBox = $derived(
		subpathFill ? `0 0 ${subpathFill.viewBoxWidth} ${subpathFill.viewBoxHeight}` : undefined,
	);

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

	/**
	 * Transparent outline hit band for an unfilled, textless shape. Its container
	 * is `pointer-events: none` so clicks fall through to whatever it is drawn
	 * over; this opts the OUTLINE back in (same trick as connector-hit-target).
	 */
	const hollowHit = $derived(buildHollowHitOutline(element));
</script>

{#if subpathFill}
	<svg
		class="pptx-svelte-subpath-fill"
		aria-hidden="true"
		viewBox={subpathFillViewBox}
		preserveAspectRatio="none"
		style="position:absolute;inset:0;width:100%;height:100%"
	>
		{#each subpathFill.paints as paint, idx (idx)}
			<path d={paint.d} fill={paint.fill} stroke="none" />
		{/each}
	</svg>
{/if}
{#if softEdge}
	<svg width="0" height="0" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">
		<defs>{@html softEdge.filterMarkup}</defs>
	</svg>
{/if}

{#if hollowHit}
	<svg
		aria-hidden="true"
		viewBox={outlineViewBox}
		preserveAspectRatio="none"
		style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none"
	>
		<path
			d={hollowHit.d}
			fill="none"
			stroke="transparent"
			stroke-width={hollowHit.strokeWidth}
			style="pointer-events:stroke"
		/>
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
