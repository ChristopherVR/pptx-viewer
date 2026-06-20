<script setup lang="ts">
import type { PptxElement, ZoomPptxElement } from 'pptx-viewer-core';
import { isZoomElement } from 'pptx-viewer-core';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

import { getContainerStyle } from '../composables/element-style';

/**
 * ZoomRenderer - Vue port of the React `ZoomElementRenderer`, static
 * viewer-first subset.
 *
 * Renders a Slide-Zoom / Section-Zoom tile (`ZoomPptxElement`): the element's
 * own preview thumbnail (`imageData`) when available, otherwise a fallback tile
 * showing the target slide number. A small "Slide Zoom" / "Section Zoom" badge
 * is drawn in the corner.
 *
 * Navigation (click-to-jump in presentation mode) and live target-slide preview
 * rendering are NOT ported; this is a static link tile only (see PORTING.md).
 * The `slides` array is not threaded through, so the fallback uses the target
 * slide index rather than the real target background.
 */
const props = defineProps<{
	element: PptxElement;
	mediaDataUrls?: Map<string, string>;
	zIndex: number;
}>();

const containerStyle = computed<CSSProperties>(() =>
	getContainerStyle(props.element, props.zIndex),
);

const zoom = computed<ZoomPptxElement | undefined>(() =>
	isZoomElement(props.element) ? props.element : undefined,
);

const previewSrc = computed<string | undefined>(() => zoom.value?.imageData);

const targetSlideIndex = computed(() => zoom.value?.targetSlideIndex ?? 0);
const zoomType = computed<'slide' | 'section'>(() => zoom.value?.zoomType ?? 'slide');
const targetSectionId = computed<string | undefined>(() => zoom.value?.targetSectionId);

const badgeText = computed(() => (zoomType.value === 'section' ? 'Section Zoom' : 'Slide Zoom'));
const slideLabel = computed(() => `Slide ${targetSlideIndex.value + 1}`);

const ariaLabel = computed(() => {
	const base = `Zoom to slide ${targetSlideIndex.value + 1}`;
	if (zoomType.value === 'section' && targetSectionId.value) {
		return `${base} (section: ${targetSectionId.value})`;
	}
	return base;
});
</script>

<template>
	<div
		class="pptx-vue-element pptx-vue-zoom"
		:style="containerStyle"
		:data-element-id="element.id"
		:data-zoom-type="zoomType"
		:data-zoom-target="targetSlideIndex"
		:aria-label="ariaLabel"
	>
		<div class="pptx-vue-zoom-tile">
			<img
				v-if="previewSrc"
				:src="previewSrc"
				:alt="`Preview of slide ${targetSlideIndex + 1}`"
				class="pptx-vue-zoom-img"
				draggable="false"
			/>
			<div v-else class="pptx-vue-zoom-thumbnail">
				<div class="pptx-vue-zoom-slide-label">{{ slideLabel }}</div>
				<div v-if="targetSectionId" class="pptx-vue-zoom-section-label">{{ targetSectionId }}</div>
			</div>

			<div class="pptx-vue-zoom-badge">{{ badgeText }}</div>
		</div>
	</div>
</template>

<style scoped>
.pptx-vue-zoom-tile {
	position: relative;
	width: 100%;
	height: 100%;
	overflow: hidden;
	border-radius: 4px;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.pptx-vue-zoom-img {
	width: 100%;
	height: 100%;
	object-fit: contain;
	pointer-events: none;
	user-select: none;
	display: block;
}

.pptx-vue-zoom-thumbnail {
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	background-color: #f0f0f0;
	border: 1px solid rgba(0, 0, 0, 0.1);
	box-sizing: border-box;
}

.pptx-vue-zoom-slide-label {
	font-size: 14px;
	font-weight: 600;
	color: rgba(0, 0, 0, 0.5);
	margin-bottom: 4px;
}

.pptx-vue-zoom-section-label {
	font-size: 10px;
	color: rgba(0, 0, 0, 0.4);
}

.pptx-vue-zoom-badge {
	position: absolute;
	bottom: 4px;
	right: 4px;
	font-size: 9px;
	padding: 1px 4px;
	border-radius: 2px;
	background-color: rgba(0, 0, 0, 0.5);
	color: #fff;
	pointer-events: none;
	line-height: 1.4;
}
</style>
