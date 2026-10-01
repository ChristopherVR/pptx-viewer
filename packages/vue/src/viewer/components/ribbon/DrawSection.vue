<script setup lang="ts">
import type { RibbonDrawRequestEvent } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { injectRecentColors } from '../../composables/recent-colors-context';
import type { DrawingTool } from './ribbon-types';

const props = withDefaults(
	defineProps<{
		activeTool: DrawingTool;
		drawingColor: string;
		drawingWidth: number;
		canEdit?: boolean;
		onSetActiveTool: (tool: DrawingTool) => void;
		onSetDrawingColor: (color: string) => void;
		onSetDrawingWidth: (width: number) => void;
	}>(),
	{ canEdit: true },
);
const { t } = useI18n();
const recent = injectRecentColors();
const state = computed(() => ({
	tool: props.activeTool,
	color: props.drawingColor,
	width: props.drawingWidth,
	editable: props.canEdit !== false,
	recentColors: recent?.recent?.value ?? [],
	translate: t,
}));
function request(event: RibbonDrawRequestEvent): void {
	if (props.canEdit === false) {
		return;
	}
	const intent = event.detail;
	switch (intent.kind) {
		case 'tool':
			props.onSetActiveTool(intent.value);
			break;
		case 'width':
			props.onSetDrawingWidth(intent.value);
			break;
		case 'color':
			props.onSetDrawingColor(intent.value);
			if (intent.committed) {
				recent?.push(intent.value);
			}
	}
}
</script>

<template>
	<pptx-ui-ribbon-draw :state.prop="state" @draw-request="request" />
</template>
