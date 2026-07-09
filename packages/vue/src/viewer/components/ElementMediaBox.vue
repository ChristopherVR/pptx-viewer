<script setup lang="ts">
/**
 * ElementMediaBox: the `media` branch of `ElementRenderer`, extracted to keep
 * the dispatcher thin. Plays a `<video>`/`<audio>` when a source is available,
 * else a poster `<img>`, else a placeholder. On the interactive (edit) canvas
 * controls are suppressed + pointer-events off so clicks select/move the
 * element; preview/present play normally.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { startMediaAutoplay } from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { getContainerStyle, getImageSrc } from '../composables/element-style';

const props = defineProps<{
	element: PptxElement;
	mediaDataUrls: Map<string, string>;
	zIndex: number;
	interactive?: boolean;
	/**
	 * True only on the live presentation stage: the media element should then
	 * begin playing on its own (as PowerPoint does when a slide with media
	 * becomes active), rather than waiting for a manual click.
	 */
	presenting?: boolean;
}>();

const { t } = useI18n();

/** The live `<video>`/`<audio>` node (only one is mounted at a time). */
const mediaEl = ref<HTMLVideoElement | HTMLAudioElement | null>(null);

const trimStartMs = computed(() =>
	props.element.type === 'media' ? props.element.trimStartMs : undefined,
);

/**
 * Autoplay on the presentation stage: start playback once the element is
 * mounted and `presenting` is on; pause again if the stage is torn down or the
 * element leaves present mode. Delegates the `.play()` + blocked-autoplay
 * handling to the shared helper so all three bindings behave identically.
 */
watch(
	[mediaEl, () => props.presenting, () => trimStartMs.value],
	([el, presenting]) => {
		if (!el) {
			return;
		}
		if (presenting) {
			void nextTick(() => startMediaAutoplay(el, { trimStartMs: trimStartMs.value }));
		} else if (!el.paused) {
			el.pause();
		}
	},
	{ immediate: true },
);

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
			ref="mediaEl"
			:src="mediaSrc"
			:controls="!interactive"
			preload="metadata"
			playsinline
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
			ref="mediaEl"
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
		<div v-else class="pptx-vue-placeholder">{{ t('pptx.elementType.media') }}</div>
	</div>
</template>
