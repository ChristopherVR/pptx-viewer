<script setup lang="ts">
import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties, hasTextProperties } from 'pptx-viewer-core';
import { computed } from 'vue';

import ArrangePanel from './ArrangePanel.vue';
import EffectsPanel from './EffectsPanel.vue';
import FillPanel from './FillPanel.vue';
import StrokePanel from './StrokePanel.vue';
import TextPanel from './TextPanel.vue';

/**
 * InspectorPane — the right-hand property inspector for the editor.
 *
 * Composes the per-concern property panels (arrange / fill / stroke / text /
 * effects) for the currently-selected element and relays each panel's `update`
 * patch upward. The host applies the patch via `useEditorOperations.updateElement`.
 *
 * Each panel follows the same contract: `props { element }`, `emits update(patch)`
 * where `patch` is a shallow `Partial<PptxElement>` (nested style objects are
 * emitted pre-merged by the panel).
 */
const props = defineProps<{ element: PptxElement }>();
const emit = defineEmits<{ update: [patch: Partial<PptxElement>] }>();

const isShape = computed(() => hasShapeProperties(props.element));
const isText = computed(() => hasTextProperties(props.element));

function relay(patch: Partial<PptxElement>): void {
	emit('update', patch);
}
</script>

<template>
	<aside class="pptx-vue-inspector" aria-label="Properties">
		<div class="pptx-vue-inspector-section">
			<h3 class="pptx-vue-inspector-title">Arrange</h3>
			<ArrangePanel :element="element" @update="relay" />
		</div>

		<div v-if="isText" class="pptx-vue-inspector-section">
			<h3 class="pptx-vue-inspector-title">Text</h3>
			<TextPanel :element="element" @update="relay" />
		</div>

		<div v-if="isShape" class="pptx-vue-inspector-section">
			<h3 class="pptx-vue-inspector-title">Fill</h3>
			<FillPanel :element="element" @update="relay" />
		</div>

		<div v-if="isShape" class="pptx-vue-inspector-section">
			<h3 class="pptx-vue-inspector-title">Line</h3>
			<StrokePanel :element="element" @update="relay" />
		</div>

		<div v-if="isShape" class="pptx-vue-inspector-section">
			<h3 class="pptx-vue-inspector-title">Effects</h3>
			<EffectsPanel :element="element" @update="relay" />
		</div>
	</aside>
</template>

<style scoped>
.pptx-vue-inspector {
	width: 240px;
	flex: 0 0 240px;
	overflow-y: auto;
	border-left: 1px solid var(--pptx-border, #d0d0d0);
	background: var(--pptx-panel-bg, #fafafa);
	padding: 0.5rem 0.75rem 2rem;
	box-sizing: border-box;
}
.pptx-vue-inspector-section {
	padding: 0.5rem 0;
	border-bottom: 1px solid var(--pptx-border, #e4e4e4);
}
.pptx-vue-inspector-title {
	margin: 0 0 0.5rem;
	font-size: 0.72rem;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: var(--pptx-muted, #777);
}
</style>
