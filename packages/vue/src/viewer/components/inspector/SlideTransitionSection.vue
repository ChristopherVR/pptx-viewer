<script setup lang="ts">
/**
 * SlideTransitionSection: slide transition editing (type / duration / direction
 * / orientation / spokes / advance-on-click), extracted from the old untabbed
 * `SlideInspector`. Mirrors React's `inspector/SlideTransitionSection.tsx`,
 * which `PresentationPropertiesPanel` renders beside SLIDE SIZE; this one is
 * mounted from the Vue panel in the same slot.
 */
import type { PptxSlide, PptxSlideTransition, PptxTransitionType } from 'pptx-viewer-core';
import { TRANSITION_VALID_DIRECTIONS } from 'pptx-viewer-core';
import { TRANSITION_MORPH_OPTIONS, TRANSITION_ORIENTATION_TYPES } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import SlideTransitionPanel from '../SlideTransitionPanel.vue';
import DirectionPicker from './DirectionPicker.vue';
import TransitionPreview from './TransitionPreview.vue';

const props = defineProps<{ slide: PptxSlide | undefined }>();

const emit = defineEmits<{
	'transition-update': [transition: PptxSlideTransition | undefined];
}>();

const { t } = useI18n();

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
const usesOrientation = computed(() => TRANSITION_ORIENTATION_TYPES.has(transitionType.value));
const showDirection = computed(
	() => hasTransition.value && validDirections.value.length > 0 && !usesOrientation.value,
);
const isWheel = computed(() => transitionType.value === 'wheel');
const isMorph = computed(() => transitionType.value === 'morph');
const orient = computed(() => props.slide?.transition?.orient ?? 'horz');
const spokes = computed(() => props.slide?.transition?.spokes ?? 4);
const morphOption = computed(() => props.slide?.transition?.morphOption ?? 'byObject');

function onMorphOptionChange(e: Event): void {
	patchTransition({
		morphOption: (e.target as HTMLSelectElement).value as PptxSlideTransition['morphOption'],
	});
}

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
	<div>
		<h3
			class="pptx-vue-inspector-title mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
		>
			{{ t('pptx.slideInspector.slideTransition') }}
		</h3>
		<SlideTransitionPanel :slide="slide" @update="(next) => emit('transition-update', next)" />

		<div v-if="showDirection" class="mt-2 space-y-1 px-2.5">
			<span class="text-xs text-muted-foreground">{{ t('pptx.transition.direction') }}</span>
			<DirectionPicker
				:directions="validDirections"
				:value="slide?.transition?.direction"
				@change="(dir) => patchTransition({ direction: dir })"
			/>
		</div>

		<div v-if="hasTransition && usesOrientation" class="mt-2 space-y-1 px-2.5">
			<span class="text-xs text-muted-foreground">{{ t('pptx.transition.orientation') }}</span>
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
					{{
						o === 'horz' ? t('pptx.slideInspector.horizontal') : t('pptx.slideInspector.vertical')
					}}
				</button>
			</div>
		</div>

		<label v-if="isWheel" class="mt-2 flex flex-col gap-1 px-2.5">
			<span class="text-xs text-muted-foreground">{{ t('pptx.transition.spokes') }}</span>
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

		<div v-if="hasTransition && isMorph" class="mt-2 space-y-1 px-2.5">
			<span class="text-xs text-muted-foreground">{{ t('pptx.transition.morphOption') }}</span>
			<select
				class="w-full rounded border border-border bg-muted px-2 py-1 text-xs"
				:value="morphOption"
				:aria-label="t('pptx.transition.morphOption')"
				data-testid="transition-morph-option"
				@change="onMorphOptionChange"
			>
				<option
					v-for="option in TRANSITION_MORPH_OPTIONS"
					:key="option.value"
					:value="option.value"
				>
					{{ t(option.i18nKey) }}
				</option>
			</select>
		</div>

		<label
			v-if="hasTransition"
			class="mt-1 inline-flex items-center gap-2 px-2.5 text-xs text-foreground"
		>
			<input
				type="checkbox"
				data-testid="transition-advance"
				:checked="advanceOnClick"
				@change="onAdvanceChange"
			/>
			{{ t('pptx.transition.advanceOnClick') }}
		</label>

		<div v-if="slide?.transition" class="mt-2 px-2.5">
			<TransitionPreview :transition="slide.transition" />
		</div>
	</div>
</template>
