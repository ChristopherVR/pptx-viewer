<script lang="ts">
	/**
	 * ImageBox: the picture/image branch of `ElementRenderer` (port of Vue's
	 * `ElementImageBox`). Renders an `<img>` under the shared fill/crop fit with
	 * the shared computed CSS filter + any SVG `<filter>` defs for duotone /
	 * artistic image effects.
	 */
	import { isImageLikeElement } from 'pptx-viewer-core';
	import {
		getCachedNativeImageSize,
		getComputedImageStyle,
		getCropShapeClipPath,
		getImageColorWashStyle,
		getImageFillCounterTransform,
		getImageFitStyle,
		getImageOverflow,
		getImageTilingStyle,
		probeNativeImageSize,
		resolveColorChangedImageSource,
		resolveShapeGeometry,
		shouldRenderHitTarget,
	} from 'pptx-viewer-shared';
	import type { NativeImageSize } from 'pptx-viewer-shared';

	import { getContainerStyle, getElementHitTargetStyle, getImageSrc, styleToString } from '../style';
	import type { ElementRendererProps } from './props';
	import ShapeEffectOverlay from './ShapeEffectOverlay.svelte';

	const {
		element,
		mediaDataUrls,
		zIndex,
		interactive = false,
		marked = false,
		editable = false,
		presenting = false,
	}: ElementRendererProps = $props();
	/**
	 * Interaction-only hit target for a degenerate (sub-MIN_ELEMENT_SIZE)
	 * picture; see `ElementRenderer`'s identical `hitTarget` doc (issue #285).
	 */
	const hitTarget = $derived(
		shouldRenderHitTarget(editable, presenting) ? getElementHitTargetStyle(element) : undefined,
	);

	/**
	 * The mask the picture's own shape geometry (`p:spPr/a:prstGeom` /
	 * `a:custGeom`) imposes on the stationary container: `border-radius` for
	 * the roundRect family and ellipse presets, a rescaled `clip-path` for
	 * custGeom and other silhouettes. `undefined` for effectively rectangular
	 * pictures, where the frame's overflow clipping already expresses the
	 * geometry. Kept off the `<img>`, whose source-crop transform would scale
	 * and shift a pixel-space clip.
	 */
	const geometryBorderRadius = $derived.by(() => {
		if (!isImageLikeElement(element)) {
			return undefined;
		}
		const geometry = resolveShapeGeometry(element);
		return geometry.kind === 'borderRadius' ? geometry.radius : undefined;
	});
	const geometryClipPath = $derived.by(() => {
		if (!isImageLikeElement(element)) {
			return undefined;
		}
		const geometry = resolveShapeGeometry(element);
		return geometry.kind === 'clipPath' ? geometry.clipPath : undefined;
	});

	// "Crop to Shape" (`element.cropShape`, the picture-format gallery, distinct
	// from `<a:srcRect>` rectangular cropping below): a CSS `clip-path` on the
	// stationary container. Shared's `getCropShapeClipPath` routes through the
	// same adjustment-aware preset cascade every shape uses, so `roundedRect` and
	// `star` render with their real geometry instead of a fixed approximation.
	// Svelte had no crop-to-shape support at all before this. The picture's own
	// shape geometry outranks it; the crop shape is the fallback.
	const cropShapeClip = $derived(
		isImageLikeElement(element)
			? getCropShapeClipPath(element.cropShape, element.width, element.height)
			: undefined,
	);

	// The clip is load-bearing, not cosmetic: a cropped picture is rendered by
	// scaling the source up and translating the cropped-away part out of the
	// frame, so without it the discarded region paints over its neighbours.
	const resolvedClip = $derived(geometryClipPath ?? cropShapeClip);
	const containerStyle = $derived(
		styleToString({
			...getContainerStyle(element, zIndex),
			overflow: getImageOverflow(element),
			...(geometryBorderRadius ? { borderRadius: geometryBorderRadius } : {}),
			...(resolvedClip ? { clipPath: resolvedClip } : {}),
		}),
	);
	const imageSrc = $derived(getImageSrc(element, mediaDataUrls));
	const imageEffects = $derived(
		element.type === 'image' || element.type === 'picture' ? element.imageEffects : undefined,
	);
	const imageFx = $derived(getComputedImageStyle(element));
	const colorWash = $derived(getImageColorWashStyle(imageEffects?.colorWash));
	let processedSrc = $state<string | undefined>();
	let colorChangeRequest = 0;
	$effect(() => {
		const src = imageSrc;
		const clrChange = imageEffects?.clrChange;
		const request = ++colorChangeRequest;
		processedSrc = src;
		if (src && clrChange) {
			void resolveColorChangedImageSource(src, clrChange).then((resolved) => {
				if (request === colorChangeRequest) {
					processedSrc = resolved;
				}
				return undefined;
			});
		}
	});
	// The picture's native (unscaled) pixel size, probed asynchronously and
	// cached (see `pptx-viewer-shared`'s `image-native-size`). `a:tile/@sx`/
	// `@sy` (ECMA-376 §20.1.8.58) is a percentage of THIS, not of the
	// container, so `tiling` below re-derives with an absolute-pixel size once
	// it resolves; until then it falls back to the container-relative percent.
	let nativeSize = $state<NativeImageSize | undefined>();
	$effect(() => {
		const src = imageSrc;
		const cached = getCachedNativeImageSize(src);
		if (cached) {
			nativeSize = cached;
			return;
		}
		nativeSize = undefined;
		if (!src) {
			return;
		}
		void probeNativeImageSize(src).then((size) => {
			if (size && src === imageSrc) {
				nativeSize = size;
			}
			return undefined;
		});
	});
	// `a:blipFill/a:tile`: a repeating TEXTURE, which an `<img>` cannot express,
	// so the picture paints as a repeating background layer instead. `undefined`
	// for a normal (untiled) picture, which keeps the `<img>` branch.
	const tiling = $derived(getImageTilingStyle(element, nativeSize));
	const tileStyle = $derived(
		tiling
			? styleToString({
					...tiling,
					...(imageFx.filter ? { filter: imageFx.filter } : {}),
					...(imageFx.opacity !== undefined ? { opacity: imageFx.opacity } : {}),
				})
			: '',
	);
	// `a:blipFill/@rotWithShape="0"`: keep the picture's pixels upright/fixed to
	// the page frame while `containerStyle`'s clip-path still carries the
	// shape's own rotate/flip. `undefined` (no-op) in the overwhelming majority
	// of cases; see `getImageFillCounterTransform`.
	const imageFitStyle = $derived(getImageFitStyle(element));
	const fillCounterTransform = $derived(
		getImageFillCounterTransform(element, Boolean(imageFitStyle.transform)),
	);
	const imgStyle = $derived(
		styleToString({
			...imageFitStyle,
			display: 'block',
			...(imageFx.filter ? { filter: imageFx.filter } : {}),
			...(imageFx.opacity !== undefined ? { opacity: imageFx.opacity } : {}),
			...(fillCounterTransform
				? { transform: fillCounterTransform, transformOrigin: 'center' }
				: {}),
		}),
	);
</script>

<div class="pptx-svelte-element pptx-svelte-image" style={containerStyle} data-element-id={element.id} data-pptx-element={interactive || marked ? 'true' : undefined}>
	<!-- Interaction-only hit target for a degenerate picture; see `hitTarget`. -->
	{#if hitTarget}
		<div aria-hidden="true" data-pptx-hit-target="true" style={styleToString(hitTarget)}></div>
	{/if}
	<!-- SVG <filter> defs for duotone / advanced-alpha / artistic image effects. -->
	{#each imageFx.svgFilters as f (f.id)}
		<svg width="0" height="0" aria-hidden="true" style="position: absolute; width: 0; height: 0; overflow: hidden">
			<defs>
				<filter id={f.id} color-interpolation-filters="sRGB">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- shared-generated primitive markup -->
					{@html f.markup}
				</filter>
			</defs>
		</svg>
	{/each}
	{#if tiling}
		<div class="pptx-svelte-image-tile" style={tileStyle}></div>
	{:else if processedSrc}
		<img src={processedSrc} alt="" style={imgStyle} />
		{#if colorWash}
			<div
				class="pptx-svelte-image-color-wash"
				style={styleToString({
					position: 'absolute',
					inset: '0',
					pointerEvents: 'none',
					backgroundColor: colorWash.backgroundColor,
					opacity: colorWash.opacity,
				})}
			></div>
		{/if}
	{/if}
	<!-- DAG fill-overlay tint + a:reflection mirror. This never rendered at
	     all before: ElementRenderer only ever mounted ShapeEffectOverlay on
	     its text/shape branch, so a reflected picture rendered nothing extra
	     despite ShapeEffectOverlay itself supporting pictures. -->
	<ShapeEffectOverlay {element} {mediaDataUrls} {zIndex} />
</div>
