<script setup lang="ts">
/**
 * PictureCropOverlay: the on-canvas crop mode chrome for one picture.
 *
 * A layer over the picture's box in slide coordinates (rendered inside the
 * scaled stage, rotated like the picture, overflow visible) holding the
 * dimmed ghost of the whole image outside the crop frame, the frame outline
 * and the eight black crop handles. Everything it draws comes from the shared
 * `buildCropOverlay` descriptor; the pointer wiring is `useCropOverlayDrag`.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { buildCropOverlay, CROP_HANDLE_ARIA_KEY } from 'pptx-viewer-shared';
import type { CropElementUpdate } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { useCropOverlayDrag } from '../composables/useCropOverlayDrag';

const props = defineProps<{
	element: PptxElement;
	imageSrc: string | undefined;
	zoom: number;
	applyLive: (update: CropElementUpdate) => void;
}>();
const { t } = useI18n();

const overlay = computed(() => buildCropOverlay(props.element, props.zoom));
const rootStyle = computed(() => ({
	position: 'absolute' as const,
	left: `${props.element.x}px`,
	top: `${props.element.y}px`,
	width: `${props.element.width}px`,
	height: `${props.element.height}px`,
	transform: props.element.rotation ? `rotate(${props.element.rotation}deg)` : undefined,
	transformOrigin: 'center',
	overflow: 'visible',
	zIndex: 57,
}));
const box = (b: { left: number; top: number; width: number; height: number }) => ({
	position: 'absolute' as const,
	left: `${b.left}px`,
	top: `${b.top}px`,
	width: `${b.width}px`,
	height: `${b.height}px`,
});
const outline = computed(() => `${1 / (props.zoom > 0 ? props.zoom : 1)}px solid #fff`);
const handleStroke = computed(() => 1 / (props.zoom > 0 ? props.zoom : 1));

const drag = useCropOverlayDrag({
	element: () => props.element,
	zoom: () => props.zoom,
	applyLive: (update) => props.applyLive(update),
});
</script>

<template>
	<div data-pptx-crop-overlay="true" :style="rootStyle">
		<div
			data-pptx-crop-ghost="true"
			:style="{
				...box(overlay.ghost),
				clipPath: overlay.ghost.clipPath,
				opacity: overlay.ghost.opacity,
				cursor: 'move',
			}"
			@pointerdown="drag.onPointerDown($event, null)"
		>
			<img
				v-if="imageSrc"
				:src="imageSrc"
				alt=""
				draggable="false"
				:style="{
					display: 'block',
					width: '100%',
					height: '100%',
					transform: overlay.ghost.transform || undefined,
					pointerEvents: 'none',
				}"
			/>
		</div>
		<div
			data-pptx-crop-frame="true"
			:style="{
				...box(overlay.frame),
				outline,
				boxShadow: '0 0 0 1px rgba(0,0,0,0.35)',
				cursor: 'move',
			}"
			@pointerdown="drag.onPointerDown($event, null)"
		/>
		<div
			v-for="h in overlay.handles"
			:key="h.id"
			role="button"
			:aria-label="t(CROP_HANDLE_ARIA_KEY)"
			:data-pptx-crop-handle="h.id"
			:style="{ ...box(h), cursor: h.cursor, touchAction: 'none' }"
			@pointerdown="drag.onPointerDown($event, h.id)"
		>
			<svg
				:width="h.width"
				:height="h.height"
				:viewBox="`0 0 ${h.width} ${h.height}`"
				style="display: block; overflow: visible"
				aria-hidden="true"
			>
				<path :d="h.path" fill="#000" stroke="#fff" :stroke-width="handleStroke" />
			</svg>
		</div>
	</div>
</template>
