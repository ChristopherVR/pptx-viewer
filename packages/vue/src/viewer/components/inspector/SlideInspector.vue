<script setup lang="ts">
/**
 * SlideInspector: the slide-level property inspector, shown in the right pane
 * when no element is selected (mirrors React's inspector, which swaps element
 * panels for slide properties). Hosts the slide Background section (React's
 * `SlideBackgroundPanel`, non-template part) and the Slide Transition section.
 *
 * Reuses the existing `SlideTransitionPanel` (type + duration), adds the
 * direction / orientation / spokes controls (parity with React's
 * `SlideTransitionSection`, driven by the core `TRANSITION_VALID_DIRECTIONS`
 * table), and the advance-on-click toggle. The slide-size / theme-override
 * sections from React are still deferred (deeper wiring).
 */
import type { PptxSlide, PptxSlideTransition, PptxTransitionType } from 'pptx-viewer-core';
import { TRANSITION_VALID_DIRECTIONS } from 'pptx-viewer-core';
import { computed } from 'vue';

import SlideTransitionPanel from '../SlideTransitionPanel.vue';
import DirectionPicker from './DirectionPicker.vue';
import SlideBackgroundPanel from './SlideBackgroundPanel.vue';

/** Transition types that pick a horz/vert orientation instead of a direction. */
const ORIENTATION_TYPES: ReadonlySet<PptxTransitionType> = new Set([
	'blinds',
	'checker',
	'comb',
	'randomBar',
]);

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

const transitionType = computed<PptxTransitionType>(
	() => (props.slide?.transition?.type as PptxTransitionType) ?? 'none',
);
const validDirections = computed<readonly string[]>(
	() => TRANSITION_VALID_DIRECTIONS[transitionType.value] ?? [],
);
const usesOrientation = computed(() => ORIENTATION_TYPES.has(transitionType.value));
const showDirection = computed(
	() => hasTransition.value && validDirections.value.length > 0 && !usesOrientation.value,
);
const isWheel = computed(() => transitionType.value === 'wheel');
const orient = computed(() => props.slide?.transition?.orient ?? 'horz');
const spokes = computed(() => props.slide?.transition?.spokes ?? 4);

/** Merge a partial transition patch into the current transition and commit. */
function patchTransition(updates: Partial<PptxSlideTransition>): void {
	const current = props.slide?.transition;
	if (!current) {
		return;
	}
	emit('transition-update', { ...current, ...updates });
}

function onSpokesInput(e: Event): void {
	const value = Number((e.target as HTMLInputElement).value);
	if (!Number.isFinite(value)) {
		return;
	}
	patchTransition({ spokes: Math.max(1, Math.min(8, Math.round(value))) });
}

function onAdvanceChange(e: Event): void {
	patchTransition({ advanceOnClick: (e.target as HTMLInputElement).checked });
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

			<div v-if="showDirection" class="mt-2 space-y-1 px-2.5">
				<span class="text-xs text-muted-foreground">Direction</span>
				<DirectionPicker
					:directions="validDirections"
					:value="slide?.transition?.direction"
					@change="(dir) => patchTransition({ direction: dir })"
				/>
			</div>

			<div v-if="hasTransition && usesOrientation" class="mt-2 space-y-1 px-2.5">
				<span class="text-xs text-muted-foreground">Orientation</span>
				<div class="flex gap-1">
					<button
						v-for="o in ['horz', 'vert'] as const"
						:key="o"
						type="button"
						class="rounded border px-2 py-1 text-xs"
						:class="
							orient === o
								? 'border-primary bg-primary text-white'
								: 'border-border bg-muted hover:bg-accent'
						"
						:aria-pressed="orient === o"
						@click="patchTransition({ orient: o })"
					>
						{{ o === 'horz' ? 'Horizontal' : 'Vertical' }}
					</button>
				</div>
			</div>

			<label v-if="isWheel" class="mt-2 flex flex-col gap-1 px-2.5">
				<span class="text-xs text-muted-foreground">Spokes</span>
				<input
					type="number"
					min="1"
					max="8"
					:value="spokes"
					data-testid="transition-spokes"
					class="w-16 rounded border border-border bg-muted px-2 py-1 text-xs"
					@input="onSpokesInput"
				/>
			</label>

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
