<script lang="ts">
	/**
	 * ImageBox: the picture/image branch of `ElementRenderer` (port of Vue's
	 * `ElementImageBox`). Renders an `<img>` (object-fit contain) with the
	 * shared computed CSS filter + any SVG `<filter>` defs for duotone /
	 * artistic image effects.
	 */
	import { getComputedImageStyle } from 'pptx-viewer-shared';

	import { getContainerStyle, getImageSrc, styleToString } from '../style';
	import type { ElementRendererProps } from './props';

	const { element, mediaDataUrls, zIndex }: ElementRendererProps = $props();

	const containerStyle = $derived(styleToString(getContainerStyle(element, zIndex)));
	const imageSrc = $derived(getImageSrc(element, mediaDataUrls));
	const imageFx = $derived(getComputedImageStyle(element));
	const imgStyle = $derived(
		styleToString({
			width: '100%',
			height: '100%',
			objectFit: 'contain',
			display: 'block',
			...(imageFx.filter ? { filter: imageFx.filter } : {}),
			...(imageFx.opacity !== undefined ? { opacity: imageFx.opacity } : {}),
		}),
	);
</script>

<div class="pptx-svelte-element pptx-svelte-image" style={containerStyle} data-element-id={element.id}>
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
	{#if imageSrc}
		<img src={imageSrc} alt="" style={imgStyle} />
	{/if}
</div>
