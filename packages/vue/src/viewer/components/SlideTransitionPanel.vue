<script setup lang="ts">
import type { PptxSlide, PptxSlideTransition, PptxTransitionType } from 'pptx-viewer-core';
import { SLIDE_TRANSITION_OPTIONS, TRANSITION_SPEED_OPTIONS } from 'pptx-viewer-shared';
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
 * The complete set of transition effects offered by the Type select, from
 * shared's `SLIDE_TRANSITION_OPTIONS` (the same 47-entry catalogue React
 * offers). `"none"` is part of that catalogue and doubles as the "clear
 * transition" option, so it is excluded from the effect list and surfaced
 * separately.
 */
const TRANSITION_OPTIONS = SLIDE_TRANSITION_OPTIONS.filter((option) => option.value !== 'none');

/** Sentinel `<option>` value representing "no transition" (clears the field). */
const NONE_VALUE = '__none__';

/** Default transition duration (ms) applied when an effect is first chosen. */
const DEFAULT_DURATION_MS = 1000;

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

/** Speed shown in the select: defaults to `fast`, matching the schema default. */
const speed = computed<NonNullable<PptxSlideTransition['speed']>>(
	() => current.value?.speed ?? 'fast',
);

function onSpeedChange(event: Event): void {
	const value = (event.target as HTMLSelectElement).value as NonNullable<
		PptxSlideTransition['speed']
	>;
	const existing = current.value;
	// Editing speed with no active effect is a no-op; there is nothing to update.
	if (!existing || existing.type === 'none') {
		return;
	}
	emit('update', { ...existing, speed: value });
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
				<option v-for="option in TRANSITION_OPTIONS" :key="option.value" :value="option.value">
					{{ t(option.i18nKey) }}
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

		<label class="pptx-vue-transition-panel__field flex flex-col gap-1">
			<span class="pptx-vue-transition-panel__label font-medium text-muted-foreground">{{
				t('pptx.transition.speed')
			}}</span>
			<select
				class="pptx-vue-transition-panel__select rounded border border-border bg-popover px-1.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
				:value="speed"
				:disabled="!hasTransition"
				:aria-label="t('pptx.transition.speed')"
				data-testid="transition-speed"
				@change="onSpeedChange"
			>
				<option
					v-for="option in TRANSITION_SPEED_OPTIONS"
					:key="option.value"
					:value="option.value"
				>
					{{ t(option.i18nKey) }}
				</option>
			</select>
		</label>
	</div>
</template>
