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
	import { hasShapeProperties, isImageLikeElement } from 'pptx-viewer-core';
	import {
		buildStrokeOutline,
		buildSubpathFillOverlay,
		getComputedEffectStyle,
		getComputedFillStyle,
		getImageFitStyle,
		getSoftEdgeSvgFilter,
		buildHollowHitOutline,
		strokeOutlineViewBox,
	} from 'pptx-viewer-shared';
	import type { CssStyleMap } from 'pptx-viewer-shared';

	import { getImageSrc, styleToString } from '../style';
	import type { ElementRendererProps } from './props';

	const { element, mediaDataUrls }: ElementRendererProps = $props();

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

	/**
	 * `a:reflection` mirrored-sibling wrapper style, or `undefined` when the
	 * element has no reflection. Cross-browser (unlike the `-webkit-box-reflect`
	 * `element-style.ts` used to set, which Firefox never implemented): see
	 * shared's `getReflectionWrapperStyle`.
	 */
	const reflection = $derived(getComputedEffectStyle(element).reflection);

	/** The wrapper style above, serialised to an inline CSS string. */
	const reflectionStyle = $derived(
		reflection ? styleToString(reflection as unknown as CssStyleMap) : undefined,
	);

	/**
	 * The reflection's mirrored CONTENT: a picture's actual photo (a cloned
	 * `<img>`, since a picture's pixels are never expressed as CSS background)
	 * for a picture/image element, or the resolved fill for everything else.
	 * `a:grpFill` children reflect as transparent: the enclosing group's fill is
	 * not threaded into this overlay.
	 */
	const reflectionImgSrc = $derived(
		reflection && isImageLikeElement(element) ? getImageSrc(element, mediaDataUrls) : undefined,
	);
	const reflectionImgFitStyle = $derived(
		styleToString({ width: '100%', height: '100%', ...getImageFitStyle(element) }),
	);
	const reflectionFill = $derived(
		reflection && !isImageLikeElement(element) ? getComputedFillStyle(element) : undefined,
	);
	const reflectionFillStyle = $derived(
		reflectionFill
			? styleToString({
					width: '100%',
					height: '100%',
					...(reflectionFill.backgroundColor ? { backgroundColor: reflectionFill.backgroundColor } : {}),
					...(reflectionFill.backgroundImage ? { backgroundImage: reflectionFill.backgroundImage } : {}),
					...(reflectionFill.backgroundSize ? { backgroundSize: reflectionFill.backgroundSize } : {}),
					...(reflectionFill.backgroundPosition
						? { backgroundPosition: reflectionFill.backgroundPosition }
						: {}),
					...(reflectionFill.backgroundRepeat
						? { backgroundRepeat: reflectionFill.backgroundRepeat }
						: {}),
				})
			: undefined,
	);
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
				{:else if strokeOutline.paint.kind === 'rectPath'}
					<pattern id={strokeOutline.paint.id} patternUnits="objectBoundingBox" width="1" height="1">
						<image href={strokeOutline.paint.href} x="0" y="0" width="1" height="1" preserveAspectRatio="none" />
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
{#if reflectionStyle}
	<div class="pptx-svelte-reflection" aria-hidden="true" style={reflectionStyle}>
		{#if reflectionImgSrc}
			<img src={reflectionImgSrc} alt="" draggable="false" style={reflectionImgFitStyle} />
		{:else if reflectionFillStyle}
			<div style={reflectionFillStyle}></div>
		{/if}
	</div>
{/if}
