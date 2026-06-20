<script setup lang="ts">
/**
 * ElementImageBox: the picture/image branch of `ElementRenderer`, extracted to
 * keep the dispatcher thin. Renders an `<img>` (object-fit contain) with the
 * computed CSS filter + any SVG `<filter>` defs for duotone/artistic effects.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { getComputedImageStyle } from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

import { getContainerStyle, getImageSrc } from '../composables/element-style';

const props = defineProps<{
	element: PptxElement;
	mediaDataUrls: Map<string, string>;
	zIndex: number;
	interactive?: boolean;
}>();

const containerStyle = computed<CSSProperties>(() =>
	getContainerStyle(props.element, props.zIndex),
);
const imageSrc = computed(() => getImageSrc(props.element, props.mediaDataUrls));
const imageFx = computed(() => getComputedImageStyle(props.element));
</script>

<template>
	<div
		class="pptx-vue-element pptx-vue-image"
		:style="containerStyle"
		:data-element-id="element.id"
		:data-pptx-element="interactive ? 'true' : undefined"
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
			:src="imageSrc"
			alt=""
			:style="{
				width: '100%',
				height: '100%',
				objectFit: 'contain',
				display: 'block',
				filter: imageFx.filter,
				opacity: imageFx.opacity,
			}"
		/>
	</div>
</template>
