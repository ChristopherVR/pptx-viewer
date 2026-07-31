<script setup lang="ts">
import type {
	AnimationPresetInfo,
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
import { applyMotionPathPreset, clearMotionPath, motionPathFor } from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { AnimationCategory } from './animation-panel-model';
import { createElementAnimation, patchElementAnimation } from './animation-panel-model';
import { previewVueAnimation } from './animation-preview-player';
import AnimationEditorControls from './AnimationEditorControls.vue';
import AnimationTimeline from './AnimationTimeline.vue';
import MotionPathRow from './MotionPathRow.vue';

type AnimatableElement = PptxElement & { animations?: PptxElementAnimation[] };
const props = withDefaults(
	defineProps<{
		element: AnimatableElement;
		slideElements?: readonly PptxElement[];
		slideAnimations?: readonly PptxElementAnimation[];
		canEdit?: boolean;
	}>(),
	{ slideElements: () => [], slideAnimations: () => [], canEdit: true },
);
const emit = defineEmits<{
	update: [patch: Partial<AnimatableElement>];
	updateSlideAnimations: [animations: PptxElementAnimation[]];
}>();
const { t } = useI18n();
const currentAnimations = computed(() => props.element.animations ?? []);
const category = ref<AnimationCategory>('entrance');
const presetId = ref(ENTRANCE_PRESETS[0]?.presetId ?? '');
const trigger = ref<PptxAnimationTrigger>('onClick');

const categories: readonly { value: AnimationCategory; labelKey: string }[] = [
	{ value: 'entrance', labelKey: 'pptx.animation.entrance' },
	{ value: 'emphasis', labelKey: 'pptx.animation.emphasis' },
	{ value: 'exit', labelKey: 'pptx.animation.exit' },
];
const presets: Readonly<Record<AnimationCategory, AnimationPresetInfo[]>> = {
	entrance: ENTRANCE_PRESETS,
	emphasis: EMPHASIS_PRESETS,
	exit: EXIT_PRESETS,
};
const triggerOptions: readonly PptxAnimationTrigger[] = [
	'onClick',
	'withPrevious',
	'afterPrevious',
	'afterDelay',
	'onHover',
	'onShapeClick',
];
const presetChoices = computed(() => presets[category.value]);
const timelineAnimations = computed(() =>
	props.slideAnimations.length ? props.slideAnimations : currentAnimations.value,
);

function changeCategory(): void {
	presetId.value = presetChoices.value[0]?.presetId ?? '';
}
function addAnimation(): void {
	const info = getAnimationPresetInfo(presetId.value);
	if (!info) {
		return;
	}
	const next = createElementAnimation(
		props.element.id,
		category.value,
		info,
		timelineAnimations.value.length,
	);
	emit('update', { animations: [...currentAnimations.value, { ...next, trigger: trigger.value }] });
}
function patchAnimation(index: number, patch: Partial<PptxElementAnimation>): void {
	emit('update', { animations: patchElementAnimation(currentAnimations.value, index, patch) });
}
function removeAnimation(index: number): void {
	emit('update', { animations: currentAnimations.value.filter((_, current) => current !== index) });
}

// A motion path lives on the SLIDE's animation list (keyed by element id), the
// same list the canvas overlay and the ribbon gallery write, so the row reads
// and commits there rather than through the element-scoped `update` patch.
const motionPath = computed(() => motionPathFor(props.slideAnimations, props.element.id));

function changeMotionPath(pathPresetId: string): void {
	if (!props.canEdit) {
		return;
	}
	// `custom` is the read-only marker for a hand-dragged path; selecting it
	// again is a no-op rather than a reset to some catalogue entry.
	if (pathPresetId === 'custom') {
		return;
	}
	emit(
		'updateSlideAnimations',
		pathPresetId === 'none'
			? clearMotionPath(props.slideAnimations, props.element.id)
			: applyMotionPathPreset(props.slideAnimations, props.element.id, pathPresetId),
	);
}
</script>

<template>
	<div class="flex flex-col gap-2 rounded-md border border-border bg-card p-2 text-xs">
		<div class="text-[11px] uppercase tracking-wide text-muted-foreground">
			{{ t('pptx.animation.title') }}
		</div>
		<div v-if="currentAnimations.length" class="space-y-2">
			<AnimationEditorControls
				v-for="(animation, index) in currentAnimations"
				:key="`${animation.elementId}-${index}`"
				:animation="animation"
				:elements="slideElements"
				@patch="patchAnimation(index, $event)"
				@remove="removeAnimation(index)"
				@preview="previewVueAnimation(animation)"
			/>
		</div>
		<p v-else class="text-muted-foreground">{{ t('pptx.animation.noAnimations') }}</p>

		<!-- Motion path: geometry, not a preset, so it gets its own row -->
		<MotionPathRow :motion-path="motionPath" :can-edit="canEdit" @change="changeMotionPath" />

		<AnimationTimeline
			:animations="timelineAnimations"
			:elements="slideElements"
			:selected-element-id="element.id"
			@reorder="emit('updateSlideAnimations', $event)"
		/>

		<div class="flex flex-col gap-1.5 border-t border-border pt-2">
			<div class="text-[11px] uppercase text-muted-foreground">
				{{ t('pptx.animation.addAnimation') }}
			</div>
			<label
				>{{ t('pptx.animation.category') }}
				<select v-model="category" aria-label="Animation category" @change="changeCategory">
					<option v-for="option in categories" :key="option.value" :value="option.value">
						{{ t(option.labelKey) }}
					</option>
				</select>
			</label>
			<label
				>{{ t('pptx.animation.effect') }}
				<select v-model="presetId" aria-label="Animation preset">
					<option v-for="preset in presetChoices" :key="preset.presetId" :value="preset.presetId">
						{{ preset.label }}
					</option>
				</select>
			</label>
			<label
				>{{ t('pptx.animation.start') }}
				<select v-model="trigger" aria-label="Animation trigger">
					<option v-for="item in triggerOptions" :key="item" :value="item">
						{{ t(`pptx.animation.trigger.${item}`) }}
					</option>
				</select>
			</label>
			<button
				type="button"
				class="pptx-vue-anim-add-btn rounded bg-primary px-2 py-1.5 text-white disabled:opacity-50"
				:disabled="!presetId"
				@click="addAnimation"
			>
				{{ t('pptx.animation.addAnimation') }}
			</button>
		</div>
	</div>
</template>

<style scoped>
label {
	display: grid;
	gap: 3px;
	color: var(--muted-foreground);
}
select {
	box-sizing: border-box;
	width: 100%;
	border: 1px solid var(--border);
	border-radius: 3px;
	background: var(--muted);
	color: inherit;
	padding: 4px 6px;
}
</style>
