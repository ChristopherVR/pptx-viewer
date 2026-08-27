<script setup lang="ts">
import { GripVertical } from 'lucide-vue-next';
import type {
	PptxAnimationTimelineAnchor,
	PptxElement,
	PptxElementAnimation,
} from 'pptx-viewer-core';
import type { AnimationTimelineRow } from 'pptx-viewer-shared';
import {
	applyAnimationTimelineOrder,
	buildAnimationTimelineBars,
	buildAnimationTimelineRows,
	reorderAnimationTimelineRows,
} from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { animationElementLabel, animationPresetLabel } from './animation-panel-model';
import { previewVueAnimation, stopVueAnimationPreview } from './animation-preview-player';

const props = withDefaults(
	defineProps<{
		animations: readonly PptxElementAnimation[];
		elements: readonly PptxElement[];
		/** Read-only anchors for the deck's own effect groups; see {@link PptxAnimationTimelineAnchor}. */
		animationTimelineAnchors?: readonly PptxAnimationTimelineAnchor[];
		selectedElementId: string;
	}>(),
	{ animationTimelineAnchors: () => [] },
);
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
// Merges the editor's own animations with the deck's read-only native anchors
// into one full-sequence drag-and-drop timeline.
const rows = computed(() =>
	buildAnimationTimelineRows(props.animations, props.animationTimelineAnchors),
);
const bars = computed(() => buildAnimationTimelineBars(props.animations));
const animationByElementId = computed(
	() => new Map(props.animations.map((animation) => [animation.elementId, animation])),
);

function barFor(animation: PptxElementAnimation): { leftPercent: number; widthPercent: number } {
	const bar = bars.value.find((candidate) => candidate.elementId === animation.elementId);
	return bar ?? { leftPercent: 0, widthPercent: 0 };
}

function label(animation: PptxElementAnimation): string {
	return animationElementLabel(
		props.elements.find((element) => element.id === animation.elementId),
		animation.elementId,
	);
}

function nativeRowLabel(row: Extract<AnimationTimelineRow, { kind: 'native' }>): string {
	return row.targetIds
		.map((id) =>
			animationElementLabel(
				props.elements.find((element) => element.id === id),
				id,
			),
		)
		.join(', ');
}

function dragStart(index: number, event: DragEvent): void {
	// Only an editor-authored row may be a drag SOURCE: the deck's own effect
	// groups are read-only, though they remain valid drop targets.
	if (rows.value[index]?.kind !== 'editor') {
		return;
	}
	dragIndex.value = index;
	event.dataTransfer?.setData('text/plain', String(index));
}
function dragOver(index: number, event: DragEvent): void {
	event.preventDefault();
	dragOverIndex.value = index;
}
function drop(index: number, event: DragEvent): void {
	event.preventDefault();
	const sourceIndex = dragIndex.value;
	if (sourceIndex !== undefined) {
		const sourceRow = rows.value[sourceIndex];
		if (sourceRow?.kind === 'editor') {
			const nextRows = reorderAnimationTimelineRows(rows.value, sourceRow.key, index);
			emit('reorder', applyAnimationTimelineOrder(props.animations, nextRows));
		}
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
		v-if="rows.length"
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
					left: `${barFor(animation).leftPercent}%`,
					width: `${barFor(animation).widthPercent}%`,
				}"
			/>
		</div>
		<div class="max-h-40 space-y-0.5 overflow-y-auto">
			<template v-for="(row, index) in rows" :key="row.key">
				<div
					v-if="row.kind === 'native'"
					class="flex items-center gap-1 rounded border border-border bg-muted/20 px-1 py-0.5 text-[10px] italic text-muted-foreground/70"
					:class="{ 'border-t-2': dragOverIndex === index }"
					:title="t('pptx.animation.nativeEffectHint')"
					@dragover="dragOver(index, $event)"
					@drop="drop(index, $event)"
				>
					<span class="h-3 w-3 shrink-0" /><span class="w-4 shrink-0 text-muted-foreground/70"
						>{{ index + 1 }}.</span
					><span class="min-w-0 flex-1 truncate"
						>{{ t('pptx.animation.nativeEffect') }}: {{ nativeRowLabel(row) }}</span
					>
				</div>
				<div
					v-else-if="animationByElementId.get(row.elementId)"
					draggable="true"
					class="flex cursor-grab items-center gap-1 rounded border px-1 py-0.5 text-[10px]"
					:class="[
						row.elementId === selectedElementId
							? 'border-primary bg-primary/20'
							: 'border-border bg-muted/50',
						dragOverIndex === index ? 'border-t-2' : '',
					]"
					@dragstart="dragStart(index, $event)"
					@dragover="dragOver(index, $event)"
					@drop="drop(index, $event)"
					@dragend="clearDrag"
					@mouseenter="previewVueAnimation(animationByElementId.get(row.elementId)!)"
					@mouseleave="stopVueAnimationPreview"
				>
					<GripVertical class="h-3 w-3 shrink-0 text-muted-foreground/50" aria-hidden="true" /><span
						class="w-4 shrink-0 text-muted-foreground"
						>{{ index + 1 }}.</span
					><span class="min-w-0 flex-1 truncate">{{
						label(animationByElementId.get(row.elementId)!)
					}}</span
					><span class="text-muted-foreground">{{
						presetLabel(animationByElementId.get(row.elementId)!)
					}}</span>
				</div>
			</template>
		</div>
	</section>
</template>
