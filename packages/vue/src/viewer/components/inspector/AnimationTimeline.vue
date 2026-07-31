<script setup lang="ts">
import { GripVertical } from 'lucide-vue-next';
import type { PptxElement, PptxElementAnimation } from 'pptx-viewer-core';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	animationElementLabel,
	animationPresetLabel,
	reorderSlideAnimations,
} from './animation-panel-model';
import { previewVueAnimation, stopVueAnimationPreview } from './animation-preview-player';

const props = defineProps<{
	animations: readonly PptxElementAnimation[];
	elements: readonly PptxElement[];
	selectedElementId: string;
}>();
const emit = defineEmits<{ reorder: [animations: PptxElementAnimation[]] }>();
const { t } = useI18n();
// `t` is an overloaded generic; narrow it to the plain shape shared wants.
function presetLabel(animation: PptxElementAnimation): string {
	return animationPresetLabel(animation, (key: string) => t(key));
}
const dragIndex = ref<number>();
const dragOverIndex = ref<number>();
const sorted = computed(() =>
	[...props.animations].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
);
const totalMs = computed(() =>
	Math.max(1, ...sorted.value.map((a) => (a.delayMs ?? 0) + (a.durationMs ?? 500))),
);

function label(animation: PptxElementAnimation): string {
	return animationElementLabel(
		props.elements.find((element) => element.id === animation.elementId),
		animation.elementId,
	);
}
function dragStart(index: number, event: DragEvent): void {
	dragIndex.value = index;
	event.dataTransfer?.setData('text/plain', String(index));
}
function dragOver(index: number, event: DragEvent): void {
	event.preventDefault();
	dragOverIndex.value = index;
}
function drop(index: number, event: DragEvent): void {
	event.preventDefault();
	if (dragIndex.value !== undefined) {
		emit('reorder', reorderSlideAnimations(props.animations, dragIndex.value, index));
	}
	clearDrag();
}
function clearDrag(): void {
	dragIndex.value = undefined;
	dragOverIndex.value = undefined;
}
</script>

<template>
	<section
		v-if="sorted.length"
		class="space-y-1 border-t border-border pt-2"
		aria-label="Animation timeline"
	>
		<h4 class="m-0 text-[10px] uppercase text-muted-foreground">Timeline</h4>
		<div
			class="relative h-6 overflow-hidden rounded border border-border bg-muted/50"
			aria-hidden="true"
		>
			<span
				v-for="animation in sorted"
				:key="animation.elementId"
				class="absolute bottom-1 top-1 min-w-[2%] rounded bg-green-500/60"
				:class="{ 'ring-1 ring-primary': animation.elementId === selectedElementId }"
				:style="{
					left: `${((animation.delayMs ?? 0) / totalMs) * 100}%`,
					width: `${((animation.durationMs ?? 500) / totalMs) * 100}%`,
				}"
			/>
		</div>
		<div class="max-h-40 space-y-0.5 overflow-y-auto">
			<div
				v-for="(animation, index) in sorted"
				:key="`${animation.elementId}-${index}`"
				draggable="true"
				class="flex cursor-grab items-center gap-1 rounded border px-1 py-0.5 text-[10px]"
				:class="[
					animation.elementId === selectedElementId
						? 'border-primary bg-primary/20'
						: 'border-border bg-muted/50',
					dragOverIndex === index ? 'border-t-2' : '',
				]"
				@dragstart="dragStart(index, $event)"
				@dragover="dragOver(index, $event)"
				@drop="drop(index, $event)"
				@dragend="clearDrag"
				@mouseenter="previewVueAnimation(animation)"
				@mouseleave="stopVueAnimationPreview"
			>
				<GripVertical class="h-3 w-3 shrink-0 text-muted-foreground/50" aria-hidden="true" /><span
					class="w-4 shrink-0 text-muted-foreground"
					>{{ index + 1 }}.</span
				><span class="min-w-0 flex-1 truncate">{{ label(animation) }}</span
				><span class="text-muted-foreground">{{ presetLabel(animation) }}</span>
			</div>
		</div>
	</section>
</template>
