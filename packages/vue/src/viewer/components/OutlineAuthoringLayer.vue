<script setup lang="ts">
/**
 * OutlineAuthoringLayer: stage-level host of the Edit Points overlay and the
 * Freeform: Shape / Curve drawing overlay (Vue port of React's
 * `canvas/OutlineAuthoringLayer.tsx`). Reads the viewer's
 * `OutlineAuthoringStore`, and leaves Edit Points when its shape disappears
 * (deleted, slide changed) or becomes locked.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import { canEditElementPoints } from 'pptx-viewer-shared';
import { computed, watch } from 'vue';

import { useOutlineAuthoring } from '../composables/useOutlineAuthoring';
import { useResolvedCustomization } from '../composables/useViewerCustomization';
import type { CanvasSize } from '../types';
import EditPointsOverlay from './EditPointsOverlay.vue';
import FreeformToolOverlay from './FreeformToolOverlay.vue';

const props = defineProps<{
	activeSlide: PptxSlide | undefined;
	canvasSize: CanvasSize;
	scale: number;
}>();

const store = useOutlineAuthoring();
const customization = useResolvedCustomization();

const element = computed(() => {
	const id = store?.editPointsElementId.value;
	return id ? props.activeSlide?.elements.find((candidate) => candidate.id === id) : undefined;
});
const editable = computed(() => Boolean(element.value && canEditElementPoints(element.value)));

watch(
	[() => store?.editPointsElementId.value, editable],
	([id, ok]) => {
		if (id && !ok) {
			store?.exitEditPoints();
		}
	},
	{ immediate: true },
);
</script>

<template>
	<template v-if="store">
		<FreeformToolOverlay
			v-if="store.activeFreeformTool.value"
			:tool="store.activeFreeformTool.value"
			:canvas-size="canvasSize"
			:scale="scale"
			:on-commit="store.commitFreeform"
			:on-cancel="() => store?.armFreeformTool(null)"
		/>
		<EditPointsOverlay
			v-else-if="element && editable"
			:element="element"
			:canvas-size="canvasSize"
			:scale="scale"
			:hidden-commands="customization.hiddenEditPointsCommands"
			:on-commit="store.commitEditPoints"
			:on-exit="store.exitEditPoints"
		/>
	</template>
</template>
