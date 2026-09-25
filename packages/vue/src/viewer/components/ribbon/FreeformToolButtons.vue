<script setup lang="ts">
/**
 * FreeformToolButtons: Insert > Shapes' click-to-place drawing tools
 * (Freeform: Shape, Curve). Vue port of React's
 * `toolbar/FreeformToolButtons.tsx`. A press arms the tool (press again to
 * disarm); the drawing itself happens on the stage overlay. Hosts can hide
 * either through `hiddenDrawingTools`. Renders nothing outside a viewer (no
 * outline-authoring store provided).
 */
import { PenTool, Spline } from 'lucide-vue-next';
import type { FreeformToolKind } from 'pptx-viewer-shared';
import {
	FREEFORM_TOOL_IDS,
	FREEFORM_TOOL_LABEL_KEYS,
	isDrawingToolVisible,
} from 'pptx-viewer-shared';
import { computed } from 'vue';
import type { Component } from 'vue';
import { useI18n } from 'vue-i18n';

import { useOutlineAuthoring } from '../../composables/useOutlineAuthoring';
import { useResolvedCustomization } from '../../composables/useViewerCustomization';
import { ic, pill } from './ribbon-constants';

defineProps<{ canEdit: boolean }>();

const ICONS: Record<FreeformToolKind, Component> = { freeformShape: PenTool, curve: Spline };

const { t } = useI18n();
const store = useOutlineAuthoring();
const customization = useResolvedCustomization();
const tools = computed(() =>
	store ? FREEFORM_TOOL_IDS.filter((tool) => isDrawingToolVisible(customization.value, tool)) : [],
);

function toggle(tool: FreeformToolKind): void {
	store?.armFreeformTool(store.activeFreeformTool.value === tool ? null : tool);
}
</script>

<template>
	<button
		v-for="tool in tools"
		:key="tool"
		type="button"
		:disabled="!canEdit"
		:aria-pressed="store?.activeFreeformTool.value === tool"
		:data-pptx-drawing-tool="tool"
		:class="[pill, store?.activeFreeformTool.value === tool ? 'bg-primary/15 text-primary' : '']"
		:title="t(FREEFORM_TOOL_LABEL_KEYS[tool])"
		@click="toggle(tool)"
	>
		<component :is="ICONS[tool]" :class="ic" />
		{{ t(FREEFORM_TOOL_LABEL_KEYS[tool]) }}
	</button>
</template>
