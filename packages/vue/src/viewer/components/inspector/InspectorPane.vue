<script setup lang="ts">
import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties, hasTextProperties, isImageLikeElement } from 'pptx-viewer-core';
import { computed } from 'vue';

import AnimationPanel from './AnimationPanel.vue';
import ArrangePanel from './ArrangePanel.vue';
import ChartPanel from './ChartPanel.vue';
import EffectsPanel from './EffectsPanel.vue';
import FillPanel from './FillPanel.vue';
import ImagePanel from './ImagePanel.vue';
import StrokePanel from './StrokePanel.vue';
import TablePanel from './TablePanel.vue';
import TextPanel from './TextPanel.vue';

/**
 * InspectorPane: the right-hand property inspector for the editor.
 *
 * Composes the per-concern property panels (arrange / fill / stroke / text /
 * effects) for the currently-selected element and relays each panel's `update`
 * patch upward. The host applies the patch via `useEditorOperations.updateElement`.
 *
 * Each panel follows the same contract: `props { element }`, `emits update(patch)`
 * where `patch` is a shallow `Partial<PptxElement>` (nested style objects are
 * emitted pre-merged by the panel).
 */
const props = defineProps<{ element: PptxElement; mobile?: boolean }>();
const emit = defineEmits<{ update: [patch: Partial<PptxElement>] }>();

const isShape = computed(() => hasShapeProperties(props.element));
const isText = computed(() => hasTextProperties(props.element));
const isImage = computed(() => isImageLikeElement(props.element));
const isTable = computed(() => props.element.type === 'table');
const isChart = computed(() => props.element.type === 'chart');

function relay(patch: Partial<PptxElement>): void {
	emit('update', patch);
}
</script>

<template>
	<aside
		class="pptx-vue-inspector overflow-y-auto bg-card box-border px-3 pb-8 text-xs text-foreground"
		:class="mobile ? 'w-full pt-1' : 'w-60 flex-[0_0_15rem] border-l border-border pt-2'"
		aria-label="Properties"
	>
		<div class="pptx-vue-inspector-section py-2 border-b border-border">
			<h3
				class="pptx-vue-inspector-title mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
			>
				Arrange
			</h3>
			<ArrangePanel :element="element" @update="relay" />
		</div>

		<div v-if="isText" class="pptx-vue-inspector-section py-2 border-b border-border">
			<h3
				class="pptx-vue-inspector-title mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
			>
				Text
			</h3>
			<TextPanel :element="element" @update="relay" />
		</div>

		<div v-if="isImage" class="pptx-vue-inspector-section py-2 border-b border-border">
			<h3
				class="pptx-vue-inspector-title mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
			>
				Image
			</h3>
			<ImagePanel :element="element" @update="relay" />
		</div>

		<div v-if="isTable" class="pptx-vue-inspector-section py-2 border-b border-border">
			<h3
				class="pptx-vue-inspector-title mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
			>
				Table
			</h3>
			<TablePanel :element="element" @update="relay" />
		</div>

		<div v-if="isChart" class="pptx-vue-inspector-section py-2 border-b border-border">
			<h3
				class="pptx-vue-inspector-title mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
			>
				Chart
			</h3>
			<ChartPanel :element="element" @update="relay" />
		</div>

		<div class="pptx-vue-inspector-section py-2 border-b border-border">
			<h3
				class="pptx-vue-inspector-title mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
			>
				Animations
			</h3>
			<AnimationPanel :element="element" @update="relay" />
		</div>

		<div v-if="isShape" class="pptx-vue-inspector-section py-2 border-b border-border">
			<h3
				class="pptx-vue-inspector-title mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
			>
				Fill
			</h3>
			<FillPanel :element="element" @update="relay" />
		</div>

		<div v-if="isShape" class="pptx-vue-inspector-section py-2 border-b border-border">
			<h3
				class="pptx-vue-inspector-title mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
			>
				Line
			</h3>
			<StrokePanel :element="element" @update="relay" />
		</div>

		<div v-if="isShape" class="pptx-vue-inspector-section py-2 border-b border-border">
			<h3
				class="pptx-vue-inspector-title mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
			>
				Effects
			</h3>
			<EffectsPanel :element="element" @update="relay" />
		</div>
	</aside>
</template>
