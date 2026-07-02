<script setup lang="ts">
import { Eye, EyeOff, GripVertical } from 'lucide-vue-next';
import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement } from 'pptx-viewer-core';
import { computed, ref } from 'vue';

/**
 * SelectionPane: lists every element on the active slide with visibility
 * toggles and drag-to-reorder (z-order). Vue port of the React
 * `SelectionPane.tsx`. The pane is presentational: it emits `select`,
 * `toggle-visibility`, and `reorder`; the host routes those through the
 * history-tracked editor operations so they undo/redo like any other edit.
 */
const props = defineProps<{
	elements: PptxElement[];
	selectedIds: string[];
	canEdit: boolean;
}>();

const emit = defineEmits<{
	select: [id: string];
	'toggle-visibility': [id: string];
	reorder: [payload: { from: number; to: number }];
	close: [];
}>();

const TYPE_LABELS: Record<string, string> = {
	text: 'Text Box',
	shape: 'Shape',
	connector: 'Connector',
	image: 'Image',
	picture: 'Picture',
	chart: 'Chart',
	table: 'Table',
	smartArt: 'SmartArt',
	media: 'Media',
	group: 'Group',
	ink: 'Ink',
	ole: 'Object',
	unknown: 'Object',
};

function displayName(element: PptxElement, index: number): string {
	if (hasTextProperties(element) && element.text && element.text.trim().length > 0) {
		return element.text.trim().slice(0, 32);
	}
	return `${TYPE_LABELS[element.type] ?? 'Object'} ${index + 1}`;
}

// Top-most element first (reverse of paint order), matching PowerPoint.
const rows = computed(() =>
	props.elements
		.map((element, index) => ({ element, index }))
		.slice()
		.reverse(),
);

const dragIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);

function onDragStart(index: number): void {
	dragIndex.value = index;
}

function onDragOver(event: DragEvent, index: number): void {
	event.preventDefault();
	if (dragIndex.value !== null && dragIndex.value !== index) {
		dragOverIndex.value = index;
	}
}

function onDrop(targetIndex: number): void {
	const from = dragIndex.value;
	dragIndex.value = null;
	dragOverIndex.value = null;
	if (from === null || from === targetIndex) {
		return;
	}
	emit('reorder', { from, to: targetIndex });
}
</script>

<template>
	<div class="flex h-full w-56 flex-col border-l border-border bg-popover">
		<div class="flex items-center justify-between border-b border-border px-3 py-2">
			<span class="text-xs font-medium text-foreground">Selection</span>
			<button
				type="button"
				class="text-xs text-muted-foreground hover:text-foreground"
				title="Close"
				@click="emit('close')"
			>
				&times;
			</button>
		</div>
		<div class="flex-1 overflow-y-auto py-1">
			<div v-if="rows.length === 0" class="px-3 py-4 text-xs italic text-muted-foreground">
				No objects on this slide.
			</div>
			<div
				v-for="{ element, index } in rows"
				v-else
				:key="element.id"
				:draggable="props.canEdit"
				class="flex cursor-pointer items-center gap-1.5 px-2 py-1 text-xs transition-colors"
				:class="[
					props.selectedIds.includes(element.id)
						? 'bg-primary/30 text-primary'
						: 'text-foreground hover:bg-muted',
					dragOverIndex === index ? 'border-t-2 border-primary' : '',
				]"
				@click="emit('select', element.id)"
				@dragstart="onDragStart(index)"
				@dragover="onDragOver($event, index)"
				@drop="onDrop(index)"
				@dragend="
					dragIndex = null;
					dragOverIndex = null;
				"
			>
				<GripVertical
					v-if="props.canEdit"
					class="h-3 w-3 flex-shrink-0 cursor-grab text-muted-foreground"
				/>
				<span class="flex-1 truncate">{{ displayName(element, index) }}</span>
				<button
					type="button"
					class="flex-shrink-0 text-muted-foreground hover:text-foreground"
					:title="element.hidden ? 'Show' : 'Hide'"
					@click.stop="emit('toggle-visibility', element.id)"
				>
					<EyeOff v-if="element.hidden" class="h-3.5 w-3.5" />
					<Eye v-else class="h-3.5 w-3.5 opacity-50" />
				</button>
			</div>
		</div>
	</div>
</template>
