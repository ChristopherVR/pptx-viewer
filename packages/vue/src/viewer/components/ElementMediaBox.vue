<script setup lang="ts">
/**
 * ElementMediaBox: the `media` branch of `ElementRenderer`, extracted to keep
 * the dispatcher thin. Plays a `<video>`/`<audio>` when a source is available,
 * else a poster `<img>`, else a placeholder. On the interactive (edit) canvas
 * controls are suppressed + pointer-events off so clicks select/move the
 * element; preview/present play normally.
 */
import type { PptxElement } from 'pptx-viewer-core';
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
/** Playable source (mediaData URL or resolved mediaPath). */
const mediaSrc = computed(() => {
	const el = props.element;
	if (el.type !== 'media') {
		return undefined;
	}
	return el.mediaData ?? (el.mediaPath ? props.mediaDataUrls.get(el.mediaPath) : undefined);
});
const mediaKind = computed(() =>
	props.element.type === 'media' ? props.element.mediaType : undefined,
);
</script>

<template>
	<div
		class="pptx-vue-element pptx-vue-media"
		:style="containerStyle"
		:data-element-id="element.id"
		:data-pptx-element="interactive ? 'true' : undefined"
	>
		<video
			v-if="mediaSrc && mediaKind === 'video'"
			:src="mediaSrc"
			:controls="!interactive"
			preload="metadata"
			:style="{
				width: '100%',
				height: '100%',
				objectFit: 'contain',
				display: 'block',
				pointerEvents: interactive ? 'none' : 'auto',
			}"
		/>
		<audio
			v-else-if="mediaSrc && mediaKind === 'audio'"
			:src="mediaSrc"
			controls
			:style="{ width: '100%', pointerEvents: interactive ? 'none' : 'auto' }"
		/>
		<img
			v-else-if="imageSrc"
			:src="imageSrc"
			alt=""
			style="width: 100%; height: 100%; object-fit: contain; display: block"
		/>
		<div v-else class="pptx-vue-placeholder">Media</div>
	</div>
</template>
