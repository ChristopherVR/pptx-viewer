<script setup lang="ts">
/**
 * ElementImageBox: the picture/image branch of `ElementRenderer`, extracted to
 * keep the dispatcher thin. Renders an `<img>` under the shared fill/crop fit
 * with the computed CSS filter + any SVG `<filter>` defs for duotone/artistic
 * effects.
 */
import type { PptxElement, PptxImageEffects } from 'pptx-viewer-core';
import {
	getComputedImageStyle,
	getImageColorWashStyle,
	getImageFitStyle,
	getImageOverflow,
} from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

import { getContainerStyle, getImageSrc } from '../composables/element-style';
import { useColorChangeImage } from '../composables/use-color-change-image';
import type { ClrChangeEffect } from '../composables/use-color-change-image';

const props = defineProps<{
	element: PptxElement;
	mediaDataUrls: Map<string, string>;
	zIndex: number;
	interactive?: boolean;
	/** Emit the data-pptx-element marker even when not interactive (template layer). */
	marked?: boolean;
}>();

// The clip is load-bearing, not cosmetic: a cropped picture is rendered by
// scaling the source up and translating the cropped-away part out of the frame,
// so without it the discarded region paints over its neighbours.
const containerStyle = computed<CSSProperties>(() => ({
	...getContainerStyle(props.element, props.zIndex),
	overflow: getImageOverflow(props.element),
}));
const imageFitStyle = computed<CSSProperties>(
	() => getImageFitStyle(props.element) as CSSProperties,
);
const imageSrc = computed(() => getImageSrc(props.element, props.mediaDataUrls));
const imageFx = computed(() => getComputedImageStyle(props.element));
const colorWash = computed(() => {
	const effects = (props.element as { imageEffects?: PptxImageEffects }).imageEffects;
	return getImageColorWashStyle(effects?.colorWash);
});

// The `<a:clrChange>` chroma-key effect, if present (with a valid `clrFrom`).
const clrChange = computed<ClrChangeEffect | undefined>(() => {
	const effects = (props.element as { imageEffects?: PptxImageEffects }).imageEffects;
	const effect = effects?.clrChange;
	return effect?.clrFrom ? effect : undefined;
});

// Recoloured source (offscreen-canvas pixel swap); falls back to the original
// `imageSrc` while processing, on failure, or when no clrChange is present.
const { displaySrc } = useColorChangeImage({ src: imageSrc, clrChange });
</script>

<template>
	<div
		class="pptx-vue-element pptx-vue-image"
		:style="containerStyle"
		:data-element-id="element.id"
		:data-pptx-element="interactive || marked ? 'true' : undefined"
	>
		<!-- SVG <filter> defs for duotone / advanced-alpha / artistic image effects. -->
		<svg
			v-for="f in imageFx.svgFilters"
			:key="f.id"
			width="0"
			height="0"
			aria-hidden="true"
			style="position: absolute; width: 0; height: 0; overflow: hidden"
		>
			<defs>
				<filter :id="f.id" color-interpolation-filters="sRGB" v-html="f.markup" />
			</defs>
		</svg>
		<img
			v-if="imageSrc"
			:src="displaySrc ?? imageSrc"
			alt=""
			:style="{
				...imageFitStyle,
				display: 'block',
				filter: imageFx.filter,
				opacity: imageFx.opacity,
			}"
		/>
		<div
			v-if="colorWash"
			class="pptx-vue-image-color-wash"
			:style="{
				position: 'absolute',
				inset: '0',
				pointerEvents: 'none',
				backgroundColor: colorWash.backgroundColor,
				opacity: colorWash.opacity,
			}"
		/>
	</div>
</template>
