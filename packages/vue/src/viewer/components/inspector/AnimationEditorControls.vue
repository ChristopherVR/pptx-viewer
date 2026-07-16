<script setup lang="ts">
import type {
	PptxAnimationDirection,
	PptxAnimationRepeatMode,
	PptxAnimationSequence,
	PptxAnimationTimingCurve,
	PptxAnimationTrigger,
	PptxElement,
	PptxElementAnimation,
} from 'pptx-viewer-core';
import { useI18n } from 'vue-i18n';

import { animationElementLabel, animationPresetLabel } from './animation-panel-model';

const props = defineProps<{
	animation: PptxElementAnimation;
	elements: readonly PptxElement[];
}>();
const emit = defineEmits<{
	patch: [patch: Partial<PptxElementAnimation>];
	remove: [];
	preview: [];
}>();
const { t } = useI18n();

const triggers: readonly PptxAnimationTrigger[] = [
	'onClick',
	'withPrevious',
	'afterPrevious',
	'afterDelay',
	'onHover',
	'onShapeClick',
];
const directions: readonly PptxAnimationDirection[] = [
	'fromLeft',
	'fromRight',
	'fromTop',
	'fromBottom',
	'fromTopLeft',
	'fromTopRight',
	'fromBottomLeft',
	'fromBottomRight',
];
const sequences: readonly PptxAnimationSequence[] = ['asOne', 'byParagraph', 'byWord', 'byLetter'];
const curves: readonly PptxAnimationTimingCurve[] = ['ease', 'ease-in', 'ease-out', 'linear'];

function value(event: Event): string {
	return (event.target as HTMLInputElement | HTMLSelectElement).value;
}
function numberValue(event: Event): number {
	return Number(value(event));
}
function label(element: PptxElement): string {
	return animationElementLabel(element, element.id);
}
</script>

<template>
	<div
		class="pptx-vue-anim-row rounded border border-border bg-muted p-2 space-y-2"
		data-animation-editor
	>
		<div class="flex items-center gap-1">
			<strong class="flex-1 truncate">{{ animationPresetLabel(animation) }}</strong>
			<button type="button" class="text-primary" @click="emit('preview')">
				{{ t('pptx.animation.preview') }}
			</button>
			<button
				type="button"
				class="pptx-vue-anim-remove"
				:aria-label="t('pptx.animation.remove')"
				@click="emit('remove')"
			>
				×
			</button>
		</div>
		<div class="grid grid-cols-2 gap-2">
			<label
				>Duration
				<input
					aria-label="Animation duration"
					type="number"
					min="100"
					max="10000"
					step="50"
					:value="animation.durationMs ?? 500"
					@change="emit('patch', { durationMs: numberValue($event) })"
				/>
			</label>
			<label
				>Delay
				<input
					aria-label="Animation delay"
					type="number"
					min="0"
					max="10000"
					step="50"
					:value="animation.delayMs ?? 0"
					@change="emit('patch', { delayMs: numberValue($event) })"
				/>
			</label>
		</div>
		<label
			>Direction
			<select
				aria-label="Animation direction"
				:value="animation.direction ?? 'fromLeft'"
				@change="emit('patch', { direction: value($event) as PptxAnimationDirection })"
			>
				<option v-for="item in directions" :key="item" :value="item">{{ item }}</option>
			</select>
		</label>
		<label
			>Sequence
			<select
				aria-label="Animation sequence"
				:value="animation.sequence ?? 'asOne'"
				@change="emit('patch', { sequence: value($event) as PptxAnimationSequence })"
			>
				<option v-for="item in sequences" :key="item" :value="item">{{ item }}</option>
			</select>
		</label>
		<label
			>Trigger
			<select
				aria-label="Animation trigger"
				:value="animation.trigger ?? 'onClick'"
				@change="
					emit('patch', {
						trigger: value($event) as PptxAnimationTrigger,
						triggerShapeId: value($event) === 'onShapeClick' ? animation.triggerShapeId : undefined,
					})
				"
			>
				<option v-for="item in triggers" :key="item" :value="item">
					{{ t(`pptx.animation.trigger.${item}`) }}
				</option>
			</select>
		</label>
		<label v-if="animation.trigger === 'onShapeClick'"
			>Trigger shape
			<select
				aria-label="Animation trigger shape"
				:value="animation.triggerShapeId ?? ''"
				@change="emit('patch', { triggerShapeId: value($event) || undefined })"
			>
				<option value="">{{ t('pptx.animation.trigger.selectShape') }}</option>
				<option
					v-for="element in elements.filter((item) => item.id !== animation.elementId)"
					:key="element.id"
					:value="element.id"
				>
					{{ label(element) }}
				</option>
			</select>
		</label>
		<label
			>Timing curve
			<select
				aria-label="Animation timing curve"
				:value="animation.timingCurve ?? 'ease'"
				@change="emit('patch', { timingCurve: value($event) as PptxAnimationTimingCurve })"
			>
				<option v-for="item in curves" :key="item" :value="item">{{ item }}</option>
			</select>
		</label>
		<div class="grid grid-cols-2 gap-2">
			<label
				>Repeat count
				<input
					aria-label="Animation repeat count"
					type="number"
					min="1"
					max="100"
					:value="animation.repeatCount ?? 1"
					@change="emit('patch', { repeatCount: numberValue($event) })"
				/>
			</label>
			<label
				>Repeat until
				<select
					aria-label="Animation repeat mode"
					:value="animation.repeatMode ?? 'none'"
					@change="
						emit('patch', {
							repeatMode:
								value($event) === 'none' ? undefined : (value($event) as PptxAnimationRepeatMode),
						})
					"
				>
					<option value="none">None</option>
					<option value="untilNextClick">Next click</option>
					<option value="untilEndOfSlide">End of slide</option>
				</select>
			</label>
		</div>
	</div>
</template>

<style scoped>
label {
	display: grid;
	gap: 3px;
	color: var(--muted-foreground);
}
input,
select {
	box-sizing: border-box;
	width: 100%;
	border: 1px solid var(--border);
	border-radius: 3px;
	background: var(--muted);
	color: inherit;
	padding: 4px 6px;
}
button {
	border: 0;
	background: transparent;
	color: inherit;
	cursor: pointer;
	font-size: 10px;
}
</style>
