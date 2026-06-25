<script setup lang="ts">
/**
 * SlideInspector: the slide-level property inspector, shown in the right pane
 * when no element is selected (mirrors React's inspector, which swaps element
 * panels for slide properties). Hosts the slide Background section (React's
 * `SlideBackgroundPanel`, non-template part) and the Slide Transition section.
 *
 * Reuses the existing `SlideTransitionPanel` (type + duration) and adds the
 * advance-on-click toggle. Transition direction / orientation / spokes / preview
 * and the slide-size / theme-override sections from React are still deferred (the
 * core direction-constant tables aren't exported yet; size/theme need deeper
 * wiring).
 */
import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import { computed } from 'vue';

import SlideTransitionPanel from '../SlideTransitionPanel.vue';
import SlideBackgroundPanel from './SlideBackgroundPanel.vue';

const props = withDefaults(
	defineProps<{ slide: PptxSlide | undefined; mobile?: boolean; canEdit?: boolean }>(),
	{ canEdit: true },
);

const emit = defineEmits<{
	'transition-update': [transition: PptxSlideTransition | undefined];
	'slide-update': [patch: Partial<PptxSlide>];
}>();

/** A real (non-"none") transition is set on this slide. */
const hasTransition = computed(
	() => Boolean(props.slide?.transition) && props.slide?.transition?.type !== 'none',
);
/** PowerPoint default is advance-on-click unless explicitly disabled. */
const advanceOnClick = computed(() => props.slide?.transition?.advanceOnClick !== false);

function onAdvanceChange(e: Event): void {
	const t = props.slide?.transition;
	if (!t) {
		return;
	}
	emit('transition-update', { ...t, advanceOnClick: (e.target as HTMLInputElement).checked });
}
</script>

<template>
	<aside
		class="pptx-vue-inspector overflow-y-auto bg-card box-border px-3 pb-8 text-xs text-foreground"
		:class="mobile ? 'w-full pt-1' : 'w-60 flex-[0_0_15rem] border-l border-border pt-2'"
		aria-label="Slide properties"
	>
		<div class="pptx-vue-inspector-section py-2 border-b border-border">
			<h3
				class="pptx-vue-inspector-title mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
			>
				Background
			</h3>
			<SlideBackgroundPanel
				:slide="slide"
				:can-edit="canEdit"
				@update="(patch) => emit('slide-update', patch)"
			/>
		</div>

		<div class="pptx-vue-inspector-section py-2 border-b border-border">
			<h3
				class="pptx-vue-inspector-title mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
			>
				Slide Transition
			</h3>
			<SlideTransitionPanel :slide="slide" @update="(t) => emit('transition-update', t)" />
			<label
				v-if="hasTransition"
				class="mt-1 inline-flex items-center gap-2 px-2.5 text-xs text-foreground"
			>
				<input type="checkbox" :checked="advanceOnClick" @change="onAdvanceChange" />
				Advance on click
			</label>
		</div>
	</aside>
</template>
