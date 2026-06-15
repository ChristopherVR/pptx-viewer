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
} from 'pptx-viewer-core';
import { computed, ref } from 'vue';

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
	// `PptxAnimationPreset` is a string-literal union; the catalog id is a
	// stable preset key. We mirror the React panel which assigns the chosen
	// preset string into the field via `as PptxAnimationPreset`.
	const preset = info.presetId as PptxAnimationPreset;
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
	<div class="pptx-vue-anim-panel">
		<div class="pptx-vue-anim-heading">Animations</div>

		<ul v-if="currentAnimations.length > 0" class="pptx-vue-anim-list">
			<li v-for="(anim, index) in currentAnimations" :key="index" class="pptx-vue-anim-row">
				<span class="pptx-vue-anim-name">{{ presetLabel(anim) }}</span>
				<span class="pptx-vue-anim-trigger">{{ triggerLabel(anim.trigger) }}</span>
				<button
					type="button"
					class="pptx-vue-anim-remove"
					:aria-label="`Remove ${presetLabel(anim)}`"
					title="Remove animation"
					@click="removeAnimation(index)"
				>
					×
				</button>
			</li>
		</ul>
		<p v-else class="pptx-vue-anim-empty">No animations</p>

		<div class="pptx-vue-anim-add">
			<div class="pptx-vue-anim-add-title">Add animation</div>

			<label class="pptx-vue-anim-field">
				<span class="pptx-vue-anim-label">Category</span>
				<select
					v-model="category"
					class="pptx-vue-anim-select"
					aria-label="Animation category"
					@change="onCategoryChange"
				>
					<option v-for="opt in CATEGORY_OPTIONS" :key="opt.value" :value="opt.value">
						{{ opt.label }}
					</option>
				</select>
			</label>

			<label class="pptx-vue-anim-field">
				<span class="pptx-vue-anim-label">Effect</span>
				<select v-model="presetId" class="pptx-vue-anim-select" aria-label="Animation preset">
					<option v-for="preset in presetChoices" :key="preset.presetId" :value="preset.presetId">
						{{ preset.label }}
					</option>
				</select>
			</label>

			<label class="pptx-vue-anim-field">
				<span class="pptx-vue-anim-label">Start</span>
				<select v-model="trigger" class="pptx-vue-anim-select" aria-label="Animation trigger">
					<option v-for="opt in TRIGGER_OPTIONS" :key="opt.value" :value="opt.value">
						{{ opt.label }}
					</option>
				</select>
			</label>

			<button
				type="button"
				class="pptx-vue-anim-add-btn"
				:disabled="!presetId"
				@click="addAnimation"
			>
				Add animation
			</button>
		</div>
	</div>
</template>

<style scoped>
.pptx-vue-anim-panel {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	padding: 0.5rem;
	border: 1px solid var(--pptx-vue-border, #d4d4d8);
	border-radius: 0.375rem;
	background: var(--pptx-vue-card, #fff);
	font-size: 0.75rem;
}

.pptx-vue-anim-heading {
	font-size: 0.6875rem;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: var(--pptx-vue-muted, #71717a);
}

.pptx-vue-anim-list {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	margin: 0;
	padding: 0;
	list-style: none;
}

.pptx-vue-anim-row {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.25rem 0.375rem;
	border: 1px solid var(--pptx-vue-border, #d4d4d8);
	border-radius: 0.25rem;
	background: var(--pptx-vue-muted-bg, #f4f4f5);
}

.pptx-vue-anim-name {
	flex: 1;
	font-weight: 500;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.pptx-vue-anim-trigger {
	color: var(--pptx-vue-muted, #71717a);
}

.pptx-vue-anim-remove {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 1.25rem;
	height: 1.25rem;
	padding: 0;
	border: none;
	border-radius: 0.25rem;
	background: transparent;
	color: var(--pptx-vue-muted, #71717a);
	font-size: 1rem;
	line-height: 1;
	cursor: pointer;
}

.pptx-vue-anim-remove:hover {
	background: var(--pptx-vue-danger-bg, #fee2e2);
	color: var(--pptx-vue-danger, #dc2626);
}

.pptx-vue-anim-empty {
	margin: 0;
	color: var(--pptx-vue-muted, #71717a);
}

.pptx-vue-anim-add {
	display: flex;
	flex-direction: column;
	gap: 0.375rem;
	padding-top: 0.5rem;
	border-top: 1px solid var(--pptx-vue-border, #d4d4d8);
}

.pptx-vue-anim-add-title {
	font-size: 0.6875rem;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: var(--pptx-vue-muted, #71717a);
}

.pptx-vue-anim-field {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
}

.pptx-vue-anim-label {
	color: var(--pptx-vue-muted, #71717a);
}

.pptx-vue-anim-select {
	width: 100%;
	padding: 0.25rem 0.5rem;
	border: 1px solid var(--pptx-vue-border, #d4d4d8);
	border-radius: 0.25rem;
	background: var(--pptx-vue-muted-bg, #f4f4f5);
	font-size: 0.75rem;
}

.pptx-vue-anim-add-btn {
	padding: 0.375rem 0.5rem;
	border: 1px solid var(--pptx-vue-border, #d4d4d8);
	border-radius: 0.25rem;
	background: var(--pptx-vue-primary, #2563eb);
	color: #fff;
	font-size: 0.75rem;
	cursor: pointer;
}

.pptx-vue-anim-add-btn:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}
</style>
