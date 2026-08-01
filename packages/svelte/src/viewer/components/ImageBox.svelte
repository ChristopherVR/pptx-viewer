<script lang="ts">
	/**
	 * ImageBox: the picture/image branch of `ElementRenderer` (port of Vue's
	 * `ElementImageBox`). Renders an `<img>` under the shared fill/crop fit with
	 * the shared computed CSS filter + any SVG `<filter>` defs for duotone /
	 * artistic image effects.
	 */
	import {
		getComputedImageStyle,
		getImageColorWashStyle,
		getImageFitStyle,
		getImageOverflow,
		resolveColorChangedImageSource,
	} from 'pptx-viewer-shared';

	import { getContainerStyle, getImageSrc, styleToString } from '../style';
	import type { ElementRendererProps } from './props';

	const { element, mediaDataUrls, zIndex, interactive = false }: ElementRendererProps = $props();

	// The clip is load-bearing, not cosmetic: a cropped picture is rendered by
	// scaling the source up and translating the cropped-away part out of the
	// frame, so without it the discarded region paints over its neighbours.
	const containerStyle = $derived(
		styleToString({ ...getContainerStyle(element, zIndex), overflow: getImageOverflow(element) }),
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
	const imgStyle = $derived(
		styleToString({
			...getImageFitStyle(element),
			display: 'block',
			...(imageFx.filter ? { filter: imageFx.filter } : {}),
			...(imageFx.opacity !== undefined ? { opacity: imageFx.opacity } : {}),
		}),
	);
</script>

<div class="pptx-svelte-element pptx-svelte-image" style={containerStyle} data-element-id={element.id} data-pptx-element={interactive ? 'true' : undefined}>
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
	{#if processedSrc}
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
</div>
