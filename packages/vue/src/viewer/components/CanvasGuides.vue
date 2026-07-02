<script setup lang="ts">
/**
 * CanvasGuides: draggable horizontal/vertical alignment guides (View ▸ H/V
 * Guides). Vue port of React's `CanvasGuides` (CanvasOverlays.tsx).
 *
 * Rendered inside the scaled {@link SlideStage} slot, so guide `position`s are
 * authored slide pixels and the parent's `transform: scale()` handles zoom.
 * Drag converts pointer client coordinates back to slide pixels via the stage's
 * bounding rect (the guide div's `offsetParent`) divided by `scale`. Double-click
 * removes a guide.
 */
import { useI18n } from 'vue-i18n';

import type { Guide } from '../composables/guides';

const { t } = useI18n();

const props = defineProps<{ guides: Guide[]; scale: number }>();

const emit = defineEmits<{
	move: [payload: { id: string; position: number }];
	remove: [id: string];
}>();

let dragId: string | null = null;
let dragAxis: 'h' | 'v' = 'h';

function onPointerDown(e: PointerEvent, guide: Guide): void {
	e.stopPropagation();
	dragId = guide.id;
	dragAxis = guide.axis;
	(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}

function onPointerMove(e: PointerEvent): void {
	if (dragId === null) {
		return;
	}
	// offsetParent is the position:relative SlideStage; its rect is the scaled box.
	const stage = (e.currentTarget as HTMLElement).offsetParent;
	if (!stage) {
		return;
	}
	const rect = stage.getBoundingClientRect();
	const scale = props.scale || 1;
	const position =
		dragAxis === 'h' ? (e.clientY - rect.top) / scale : (e.clientX - rect.left) / scale;
	emit('move', { id: dragId, position });
}

function onPointerUp(e: PointerEvent): void {
	if (dragId === null) {
		return;
	}
	try {
		(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
	} catch {
		// Capture may already be released; ignore.
	}
	dragId = null;
}
</script>

<template>
	<div
		v-for="guide in props.guides"
		:key="guide.id"
		class="absolute z-[49] pointer-events-auto"
		:style="
			guide.axis === 'h'
				? {
						left: '0px',
						right: '0px',
						top: `${guide.position}px`,
						height: '1px',
						backgroundColor: 'rgba(250, 204, 21, 0.9)',
						cursor: 'row-resize',
					}
				: {
						top: '0px',
						bottom: '0px',
						left: `${guide.position}px`,
						width: '1px',
						backgroundColor: 'rgba(250, 204, 21, 0.9)',
						cursor: 'col-resize',
					}
		"
		:title="t('pptx.guides.dragHint')"
		@pointerdown="onPointerDown($event, guide)"
		@pointermove="onPointerMove"
		@pointerup="onPointerUp"
		@dblclick.stop="emit('remove', guide.id)"
	/>
</template>
