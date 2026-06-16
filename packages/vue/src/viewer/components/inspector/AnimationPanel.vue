<script setup lang="ts">
import type {
	AnimationPresetInfo,
	PptxAnimationPreset,
	PptxAnimationTrigger,
	PptxElement,
	PptxElementAnimation,
} from 'pptx-viewer-core';
import {
	EMPHASIS_PRESETS,
	ENTRANCE_PRESETS,
	EXIT_PRESETS,
	getAnimationPresetInfo,
	ooxmlToPresetName,
} from 'pptx-viewer-core';
import { computed, ref } from 'vue';

/**
 * Resolve an editor catalog id (e.g. `entr.10`) to the real `PptxAnimationPreset`
 * string-union value (e.g. `fadeIn`) via core's `ooxmlToPresetName`, so animations
 * added here map to the right keyframe in presentation playback. Falls back to the
 * catalog id when core has no mapping (rare presets).
 */
function catalogIdToPreset(catalogId: string): PptxAnimationPreset {
	const dot = catalogId.indexOf('.');
	const cls = dot > 0 ? catalogId.slice(0, dot) : '';
	const num = dot > 0 ? Number(catalogId.slice(dot + 1)) : Number.NaN;
	if ((cls === 'entr' || cls === 'exit' || cls === 'emph') && Number.isFinite(num)) {
		const name = ooxmlToPresetName({ presetClass: cls, presetId: num });
		if (name) {
			return name as PptxAnimationPreset;
		}
	}
	return catalogId as PptxAnimationPreset;
}

/**
 * AnimationPanel — Vue inspector panel for an element's animation list.
 *
 * Mirrors the uniform inspector-panel contract used by the other
 * `components/inspector/` panels: it receives the selected {@link PptxElement}
 * and emits a shallow `update` patch that the host merges via
 * `ops.updateElement(id, patch)`.
 *
 * The animation model is the core {@link PptxElementAnimation}: a flat record
 * carrying an optional `entrance` / `exit` / `emphasis` preset plus timing and
 * a {@link PptxAnimationTrigger}. The preset selects are populated from the
 * core catalogs ({@link ENTRANCE_PRESETS}, {@link EMPHASIS_PRESETS},
 * {@link EXIT_PRESETS}) and a chosen catalog entry is turned into a
 * {@link PptxElementAnimation} via {@link getAnimationPresetInfo} for its
 * default duration.
 */
/**
 * Element augmented with the optional animation list. The core
 * {@link PptxElementAnimation} array is stored against the slide in the core
 * model, but the inspector-panel contract is element-scoped: the panel reads
 * the element's animations and emits a shallow `{ animations }` patch that the
 * host merges via `ops.updateElement(id, patch)`. The `animations` field type
 * mirrors the core array exactly.
 */
type AnimatableElement = PptxElement & { animations?: PptxElementAnimation[] };

const props = defineProps<{
	element: AnimatableElement;
}>();

const emit = defineEmits<{
	update: [patch: Partial<AnimatableElement>];
}>();

// ── Category → core preset catalog ──

type AnimationUiCategory = 'entrance' | 'emphasis' | 'exit';

const CATEGORY_OPTIONS: ReadonlyArray<{ value: AnimationUiCategory; label: string }> = [
	{ value: 'entrance', label: 'Entrance' },
	{ value: 'emphasis', label: 'Emphasis' },
	{ value: 'exit', label: 'Exit' },
];

const PRESETS_BY_CATEGORY: Readonly<Record<AnimationUiCategory, AnimationPresetInfo[]>> = {
	entrance: ENTRANCE_PRESETS,
	emphasis: EMPHASIS_PRESETS,
	exit: EXIT_PRESETS,
};

// Real `PptxAnimationTrigger` values for the supported "Start" options.
const TRIGGER_OPTIONS: ReadonlyArray<{ value: PptxAnimationTrigger; label: string }> = [
	{ value: 'onClick', label: 'On click' },
	{ value: 'withPrevious', label: 'With previous' },
	{ value: 'afterPrevious', label: 'After previous' },
];

// ── Current animations ──

const currentAnimations = computed<PptxElementAnimation[]>(() => props.element.animations ?? []);

function presetLabel(anim: PptxElementAnimation): string {
	const presetId = anim.entrance ?? anim.emphasis ?? anim.exit;
	if (!presetId) {
		return 'Animation';
	}
	const info = getAnimationPresetInfo(presetId);
	return info?.label ?? presetId;
}

function triggerLabel(trigger: PptxAnimationTrigger | undefined): string {
	return TRIGGER_OPTIONS.find((o) => o.value === trigger)?.label ?? 'On click';
}

// ── Add-animation form state ──

const category = ref<AnimationUiCategory>('entrance');
const presetId = ref<string>(ENTRANCE_PRESETS[0]?.presetId ?? '');
const trigger = ref<PptxAnimationTrigger>('onClick');

const presetChoices = computed<AnimationPresetInfo[]>(() => PRESETS_BY_CATEGORY[category.value]);

function onCategoryChange(): void {
	// Reset the preset to the first entry of the newly chosen catalog.
	presetId.value = presetChoices.value[0]?.presetId ?? '';
}

/**
 * Build a {@link PptxElementAnimation} from the chosen catalog preset, placing
 * the preset id into the field matching its category and pulling the default
 * duration from the core catalog via {@link getAnimationPresetInfo}.
 */
function buildAnimation(): PptxElementAnimation | undefined {
	const info = getAnimationPresetInfo(presetId.value);
	if (!info) {
		return undefined;
	}
	// Convert the catalog id (e.g. `entr.10`) to the real `PptxAnimationPreset`
	// string (e.g. `fadeIn`) so the choice maps to the right playback keyframe.
	const preset = catalogIdToPreset(info.presetId);
	const base: PptxElementAnimation = {
		elementId: props.element.id,
		durationMs: info.defaultDurationMs,
		order: currentAnimations.value.length,
		trigger: trigger.value,
	};
	switch (category.value) {
		case 'entrance':
			return { ...base, entrance: preset };
		case 'emphasis':
			return { ...base, emphasis: preset };
		case 'exit':
			return { ...base, exit: preset };
	}
}

function addAnimation(): void {
	const next = buildAnimation();
	if (!next) {
		return;
	}
	emit('update', { animations: [...currentAnimations.value, next] });
}

function removeAnimation(index: number): void {
	const next = currentAnimations.value.filter((_, i) => i !== index);
	emit('update', { animations: next });
}
</script>

<template>
	<div
		class="pptx-vue-anim-panel flex flex-col gap-2 rounded-md border border-border bg-card p-2 text-xs"
	>
		<div class="pptx-vue-anim-heading text-[11px] uppercase tracking-wide text-muted-foreground">
			Animations
		</div>

		<ul
			v-if="currentAnimations.length > 0"
			class="pptx-vue-anim-list flex flex-col gap-1 m-0 p-0 list-none"
		>
			<li
				v-for="(anim, index) in currentAnimations"
				:key="index"
				class="pptx-vue-anim-row flex items-center gap-2 rounded border border-border bg-muted px-1.5 py-1"
			>
				<span
					class="pptx-vue-anim-name flex-1 font-medium overflow-hidden text-ellipsis whitespace-nowrap"
				>
					{{ presetLabel(anim) }}
				</span>
				<span class="pptx-vue-anim-trigger text-muted-foreground">{{
					triggerLabel(anim.trigger)
				}}</span>
				<button
					type="button"
					class="pptx-vue-anim-remove inline-flex items-center justify-center w-5 h-5 p-0 rounded border-none bg-transparent text-muted-foreground text-base leading-none cursor-pointer transition-colors hover:bg-destructive/10 hover:text-destructive"
					:aria-label="`Remove ${presetLabel(anim)}`"
					title="Remove animation"
					@click="removeAnimation(index)"
				>
					×
				</button>
			</li>
		</ul>
		<p v-else class="pptx-vue-anim-empty text-muted-foreground">No animations</p>

		<div class="pptx-vue-anim-add flex flex-col gap-1.5 pt-2 border-t border-border">
			<div
				class="pptx-vue-anim-add-title text-[11px] uppercase tracking-wide text-muted-foreground"
			>
				Add animation
			</div>

			<label class="pptx-vue-anim-field flex flex-col gap-1">
				<span class="pptx-vue-anim-label text-muted-foreground">Category</span>
				<select
					v-model="category"
					class="pptx-vue-anim-select w-full bg-muted border border-border rounded px-2 py-1"
					aria-label="Animation category"
					@change="onCategoryChange"
				>
					<option v-for="opt in CATEGORY_OPTIONS" :key="opt.value" :value="opt.value">
						{{ opt.label }}
					</option>
				</select>
			</label>

			<label class="pptx-vue-anim-field flex flex-col gap-1">
				<span class="pptx-vue-anim-label text-muted-foreground">Effect</span>
				<select
					v-model="presetId"
					class="pptx-vue-anim-select w-full bg-muted border border-border rounded px-2 py-1"
					aria-label="Animation preset"
				>
					<option v-for="preset in presetChoices" :key="preset.presetId" :value="preset.presetId">
						{{ preset.label }}
					</option>
				</select>
			</label>

			<label class="pptx-vue-anim-field flex flex-col gap-1">
				<span class="pptx-vue-anim-label text-muted-foreground">Start</span>
				<select
					v-model="trigger"
					class="pptx-vue-anim-select w-full bg-muted border border-border rounded px-2 py-1"
					aria-label="Animation trigger"
				>
					<option v-for="opt in TRIGGER_OPTIONS" :key="opt.value" :value="opt.value">
						{{ opt.label }}
					</option>
				</select>
			</label>

			<button
				type="button"
				class="pptx-vue-anim-add-btn rounded bg-primary text-white px-2 py-1.5 transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
				:disabled="!presetId"
				@click="addAnimation"
			>
				Add animation
			</button>
		</div>
	</div>
</template>
