<script setup lang="ts">
import type { PptxElement, ZoomPptxElement } from 'pptx-viewer-core';
import { isZoomElement } from 'pptx-viewer-core';
import { buildSummaryZoomView } from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { getContainerStyle } from '../composables/element-style';
import { injectZoomNavigation } from '../composables/zoom-navigation';
import { injectZoomTargetLookup } from '../composables/zoom-target';

/**
 * ZoomRenderer - Vue port of the React `ZoomElementRenderer`.
 *
 * Renders a Slide-Zoom / Section-Zoom tile (`ZoomPptxElement`): the element's
 * own preview thumbnail (`imageData`) when available, otherwise a fallback tile
 * showing the target slide number. A small "Slide Zoom" / "Section Zoom" badge
 * is drawn in the corner.
 *
 * In presentation mode the controller provides a zoom-navigation context, so
 * clicking (or Enter/Space) jumps to the target slide. Outside presentation mode
 * no context is injected and the tile stays a static link, exactly as before.
 * When the viewer provides a zoom-target lookup, the fallback tile mirrors
 * React's `ZoomSlideThumbnail`: the target slide's real background colour, its
 * own slide number and friendly section name (no live mini-rendering). Without a
 * provider it falls back to the target index and section GUID.
 */
const props = defineProps<{
	element: PptxElement;
	mediaDataUrls?: Map<string, string>;
	zIndex: number;
}>();

const { t } = useI18n();

const containerStyle = computed<CSSProperties>(() =>
	getContainerStyle(props.element, props.zIndex),
);

const zoom = computed<ZoomPptxElement | undefined>(() =>
	isZoomElement(props.element) ? props.element : undefined,
);

const previewSrc = computed<string | undefined>(() => zoom.value?.imageData);

const targetSlideIndex = computed(() => zoom.value?.targetSlideIndex ?? 0);
const zoomType = computed<'slide' | 'section' | 'summary'>(() => zoom.value?.zoomType ?? 'slide');
const targetSectionId = computed<string | undefined>(() => zoom.value?.targetSectionId);

const badgeText = computed(() =>
	zoomType.value === 'section' ? t('pptx.zoom.sectionZoom') : t('pptx.zoom.slideZoom'),
);

// Resolve the target slide descriptor (when the viewer provides a lookup) so the
// fallback tile mirrors React's `ZoomSlideThumbnail`: the target slide's real
// background colour, its own slide number and the friendly section name.
const targetLookup = injectZoomTargetLookup();
const targetInfo = computed(() => targetLookup?.(targetSlideIndex.value));
const summaryView = computed(() =>
	zoom.value ? buildSummaryZoomView(zoom.value, targetLookup) : undefined,
);

const thumbnailStyle = computed<CSSProperties>(() => ({
	backgroundColor: targetInfo.value?.backgroundColor ?? '#f0f0f0',
}));
const slideLabel = computed(() =>
	targetInfo.value?.slideNumber !== undefined
		? t('pptx.notes.slideN', { n: targetInfo.value.slideNumber })
		: t('pptx.notes.slideN', { n: targetSlideIndex.value + 1 }),
);
const sectionLabel = computed(() => targetInfo.value?.sectionName ?? targetSectionId.value);

const ariaLabel = computed(() => {
	if (zoomType.value === 'section' && targetSectionId.value) {
		return t('pptx.zoom.ariaLabelSection', {
			number: targetSlideIndex.value + 1,
			section: targetSectionId.value,
		});
	}
	return t('pptx.zoom.ariaLabel', { number: targetSlideIndex.value + 1 });
});

// Present only inside a running presentation; absent (static tile) otherwise.
const zoomNav = injectZoomNavigation();
const interactive = computed(() => Boolean(zoomNav && zoom.value));

function activate(target = targetSlideIndex.value): void {
	if (!zoomNav || !zoom.value) {
		return;
	}
	zoomNav.navigateToZoomTarget(target);
}

function activateSummary(event: Event, target: number): void {
	if (!interactive.value) return;
	event.preventDefault();
	event.stopPropagation();
	activate(target);
}

function onClick(event: MouseEvent): void {
	if (!interactive.value) {
		return;
	}
	// Stop the stage's click-to-advance from also firing.
	event.stopPropagation();
	activate();
}

function onKeydown(event: KeyboardEvent): void {
	if (!interactive.value || (event.key !== 'Enter' && event.key !== ' ')) {
		return;
	}
	event.preventDefault();
	event.stopPropagation();
	activate();
}
</script>

<template>
	<div
		class="pptx-vue-element pptx-vue-zoom"
		:class="{ 'pptx-vue-zoom-interactive': interactive }"
		:style="containerStyle"
		:data-element-id="element.id"
		:data-zoom-type="zoomType"
		:data-zoom-target="targetSlideIndex"
		:aria-label="summaryView?.ariaLabel ?? ariaLabel"
		:role="summaryView ? 'group' : interactive ? 'button' : undefined"
		:tabindex="!summaryView && interactive ? 0 : undefined"
		@click="onClick"
		@keydown="onKeydown"
	>
		<div v-if="summaryView" class="pptx-vue-summary-zoom" :style="summaryView.containerStyle">
			<div
				v-for="tile in summaryView.tiles"
				:key="tile.key"
				class="pptx-vue-summary-zoom-tile"
				:style="{ ...tile.style, backgroundColor: tile.backgroundColor }"
				:data-zoom-target="tile.targetSlideIndex"
				:data-section-id="tile.sectionId"
				:aria-label="tile.ariaLabel"
				:role="interactive ? 'button' : undefined"
				:tabindex="interactive ? 0 : undefined"
				@click="activateSummary($event, tile.targetSlideIndex)"
				@keydown.enter="activateSummary($event, tile.targetSlideIndex)"
				@keydown.space="activateSummary($event, tile.targetSlideIndex)"
			>
				<img v-if="tile.imageSrc" :src="tile.imageSrc" :alt="tile.ariaLabel" draggable="false" />
				<template v-else
					><div>{{ tile.label }}</div>
					<div>{{ tile.slideLabel }}</div></template
				>
			</div>
			<div class="pptx-vue-zoom-badge">Summary Zoom</div>
		</div>
		<div v-else class="pptx-vue-zoom-tile">
			<img
				v-if="previewSrc"
				:src="previewSrc"
				:alt="t('pptx.zoom.slidePreviewAlt', { number: targetSlideIndex + 1 })"
				class="pptx-vue-zoom-img"
				draggable="false"
			/>
			<div v-else class="pptx-vue-zoom-thumbnail" :style="thumbnailStyle">
				<div class="pptx-vue-zoom-slide-label">{{ slideLabel }}</div>
				<div v-if="sectionLabel" class="pptx-vue-zoom-section-label">{{ sectionLabel }}</div>
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

.pptx-vue-summary-zoom-tile {
	overflow: hidden;
	border: 1px solid rgba(0, 0, 0, 0.12);
}

.pptx-vue-summary-zoom-tile img {
	width: 100%;
	height: 100%;
	object-fit: contain;
}

.pptx-vue-zoom-interactive {
	cursor: pointer;
}

.pptx-vue-zoom-interactive:focus-visible {
	outline: 2px solid #2563eb;
	outline-offset: 2px;
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
