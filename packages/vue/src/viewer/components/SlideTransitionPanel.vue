<script setup lang="ts">
import type { PptxSlide, PptxSlideTransition, PptxTransitionType } from 'pptx-viewer-core';
import { schemaLabel, SLIDE_TRANSITION_LABEL_KEYS } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

/**
 * SlideTransitionPanel - lets the user pick the transition effect and duration
 * for the current slide.
 *
 * It reads the slide's existing `transition` field to prefill the controls and
 * emits a fully-formed {@link PptxSlideTransition} (or `undefined` to clear it,
 * i.e. the "None" option). The host is responsible for applying the emitted
 * value to the active slide in a history-aware way.
 */
const props = defineProps<{ slide: PptxSlide | undefined }>();

const emit = defineEmits<{
	update: [transition: PptxSlideTransition | undefined];
}>();

const { t } = useI18n();

/**
 * The complete set of transition effects from the core `PptxTransitionType`
 * union. `"none"` is part of the union and doubles as the "clear transition"
 * option, so it is excluded from the effect list and surfaced separately.
 */
const TRANSITION_TYPES: readonly PptxTransitionType[] = [
	'cut',
	'fade',
	'push',
	'wipe',
	'split',
	'randomBar',
	'blinds',
	'checker',
	'circle',
	'comb',
	'cover',
	'diamond',
	'dissolve',
	'plus',
	'pull',
	'random',
	'strips',
	'uncover',
	'wedge',
	'wheel',
	'zoom',
	'newsflash',
	'morph',
	'conveyor',
	'doors',
	'ferris',
	'flash',
	'flythrough',
	'gallery',
	'glitter',
	'honeycomb',
	'pan',
	'prism',
	'reveal',
	'ripple',
	'shred',
	'switch',
	'vortex',
	'warp',
	'wheelReverse',
	'window',
	'cube',
	'flip',
	'rotate',
	'box',
	'orbit',
];

/** Sentinel `<option>` value representing "no transition" (clears the field). */
const NONE_VALUE = '__none__';

/** Default transition duration (ms) applied when an effect is first chosen. */
const DEFAULT_DURATION_MS = 1000;

/**
 * Spell a `p:transition` child-element name for display.
 *
 * The option VALUE stays the wire token that is emitted on the update, and
 * `TRANSITION_TYPES` above is untouched, so the select still offers exactly the
 * same effects; only the text is translated.
 * `SLIDE_TRANSITION_LABEL_KEYS` covers the whole `PptxTransitionType` union,
 * which is deliberately wider than this panel's list, so adding an effect here
 * later needs no second edit. `t` is an overloaded generic, hence the lambda.
 */
function transitionLabel(type: PptxTransitionType): string {
	return schemaLabel(SLIDE_TRANSITION_LABEL_KEYS, type, (key: string) => t(key));
}

const current = computed<PptxSlideTransition | undefined>(() => props.slide?.transition);

/** The `<select>` value: `NONE_VALUE` when there is no transition (or `"none"`). */
const selectedType = computed<string>(() => {
	const type = current.value?.type;
	if (!type || type === 'none') {
		return NONE_VALUE;
	}
	return type;
});

/** Duration shown in the number input, in milliseconds. */
const durationMs = computed<number>(() => current.value?.durationMs ?? DEFAULT_DURATION_MS);

/** Duration controls are meaningless without an active effect. */
const hasTransition = computed<boolean>(() => selectedType.value !== NONE_VALUE);

function onTypeChange(event: Event): void {
	const value = (event.target as HTMLSelectElement).value;
	if (value === NONE_VALUE) {
		emit('update', undefined);
		return;
	}
	// `value` is constrained to `TRANSITION_TYPES` by the rendered options.
	const type = value as PptxTransitionType;
	const next: PptxSlideTransition = {
		...current.value,
		type,
		durationMs: current.value?.durationMs ?? DEFAULT_DURATION_MS,
	};
	emit('update', next);
}

function onDurationChange(event: Event): void {
	const raw = Number.parseInt((event.target as HTMLInputElement).value, 10);
	const ms = Number.isFinite(raw) && raw >= 0 ? raw : 0;
	const existing = current.value;
	// Editing duration with no active effect is a no-op; there is nothing to update.
	if (!existing || existing.type === 'none') {
		return;
	}
	emit('update', { ...existing, durationMs: ms });
}
</script>

<template>
	<div class="pptx-vue-transition-panel flex flex-col gap-2.5 p-2.5 text-xs text-foreground">
		<label class="pptx-vue-transition-panel__field flex flex-col gap-1">
			<span class="pptx-vue-transition-panel__label font-medium text-muted-foreground">{{
				t('pptx.transition.label')
			}}</span>
			<!--
			 The explicit `aria-label` is load-bearing, not decoration. A `<select>`
			 nested inside its `<label>` takes the WHOLE label element's text as its
			 accessible label, and that text includes every option: this control
			 announced itself as "Transition None Cut Fade ... Rotate ..." and, since
			 one effect is called Rotate, a running show matched a "rotate" affordance
			 that was never on screen. Angular's transition card labels its select the
			 same way; this is the binding that had drifted.
			-->
			<select
				class="pptx-vue-transition-panel__select rounded border border-border bg-popover px-1.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
				:value="selectedType"
				:aria-label="t('pptx.transition.label')"
				data-testid="transition-type"
				@change="onTypeChange"
			>
				<option :value="NONE_VALUE">{{ t('pptx.transition.none') }}</option>
				<option v-for="type in TRANSITION_TYPES" :key="type" :value="type">
					{{ transitionLabel(type) }}
				</option>
			</select>
		</label>

		<label class="pptx-vue-transition-panel__field flex flex-col gap-1">
			<span class="pptx-vue-transition-panel__label font-medium text-muted-foreground">{{
				t('pptx.transition.duration')
			}}</span>
			<input
				class="pptx-vue-transition-panel__duration rounded border border-border bg-popover px-1.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
				type="number"
				min="0"
				step="100"
				:value="durationMs"
				:disabled="!hasTransition"
				:aria-label="t('pptx.transition.duration')"
				data-testid="transition-duration"
				@change="onDurationChange"
			/>
		</label>
	</div>
</template>
