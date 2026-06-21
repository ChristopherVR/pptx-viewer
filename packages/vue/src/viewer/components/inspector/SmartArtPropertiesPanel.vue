<script setup lang="ts">
import type {
	PptxElement,
	PptxSmartArtData,
	SmartArtColorScheme,
	SmartArtLayoutType,
	SmartArtStyle,
} from 'pptx-viewer-core';
import { computed } from 'vue';

import {
	SMARTART_COLOR_SCHEMES,
	SMARTART_STYLE_OPTIONS,
	useSmartArtEditing,
} from '../../composables/useSmartArtEditing';
import SmartArtLayoutSwitcher from './SmartArtLayoutSwitcher.vue';

/**
 * SmartArtPropertiesPanel: inspector panel for `smartArt` elements.
 *
 * Vue port of the React `SmartArtPropertiesPanel.tsx`. Provides per-node text
 * editing, add item / add sub-item, remove, promote/demote (Tab/Shift+Tab and
 * buttons), reorder up/down, colour-scheme select, style toggle, and a layout
 * switcher. All logic lives in `useSmartArtEditing` (core ops only); this SFC is
 * thin presentation.
 *
 * Follows the uniform inspector-panel contract: `props { element }`, emits
 * `update` with a shallow `Partial<PptxElement>` patch the host merges via
 * `useEditorOperations.updateElement` (history-tracked, so undo/redo works).
 */
const props = withDefaults(
	defineProps<{
		element: PptxElement;
		canEdit?: boolean;
	}>(),
	{ canEdit: true },
);

const emit = defineEmits<{ update: [patch: Partial<PptxElement>] }>();

const editable = computed(() => props.canEdit !== false);

const smartArtData = computed<PptxSmartArtData>(() => {
	if (props.element.type === 'smartArt' && props.element.smartArtData) {
		return props.element.smartArtData;
	}
	return { nodes: [] } as PptxSmartArtData;
});

const isSmartArt = computed(
	() => props.element.type === 'smartArt' && Boolean(props.element.smartArtData),
);

const editing = useSmartArtEditing({
	smartArtData,
	apply: (patch) => emit('update', patch),
});

const colorSchemes = SMARTART_COLOR_SCHEMES;
const styleOptions = SMARTART_STYLE_OPTIONS;

/** Child-node marker glyph (U+2022 bullet) shown in the text-pane list. */
const bulletGlyph = String.fromCharCode(0x2022);

function onNodeTextInput(event: Event, nodeId: string): void {
	editing.updateNodeText(nodeId, (event.target as HTMLInputElement).value);
}

function onNodeKeyDown(event: KeyboardEvent, nodeId: string): void {
	if (event.key !== 'Tab') {
		return;
	}
	event.preventDefault();
	if (event.shiftKey) {
		editing.promote(nodeId);
	} else {
		editing.demote(nodeId);
	}
}

function onColorSchemeChange(event: Event): void {
	editing.setColorScheme((event.target as HTMLSelectElement).value as SmartArtColorScheme);
}

function onSwitchLayout(layout: SmartArtLayoutType): void {
	editing.switchLayout(layout);
}

function onSetStyle(value: SmartArtStyle): void {
	editing.setStyle(value);
}
</script>

<template>
	<div class="pptx-vue-smartart-panel flex flex-col gap-2 text-xs" data-testid="smartart-panel">
		<p v-if="!isSmartArt" class="text-muted-foreground italic">
			Select a SmartArt graphic to edit its properties.
		</p>

		<template v-else>
			<SmartArtLayoutSwitcher
				:current="editing.currentLayout.value"
				:can-edit="editable"
				@switch="onSwitchLayout"
			/>

			<label class="flex flex-col gap-1 text-[11px]">
				<span class="text-muted-foreground">Colour scheme</span>
				<select
					class="flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
					data-testid="smartart-color-scheme"
					:disabled="!editable"
					:value="editing.colorScheme.value"
					@change="onColorSchemeChange"
				>
					<option v-for="cs in colorSchemes" :key="cs" :value="cs">{{ cs }}</option>
				</select>
			</label>

			<div class="flex flex-col gap-1 text-[11px]">
				<span class="text-muted-foreground">Style</span>
				<div class="flex gap-1">
					<button
						v-for="s in styleOptions"
						:key="s"
						type="button"
						:disabled="!editable"
						:data-testid="`smartart-style-${s}`"
						:aria-pressed="editing.style.value === s"
						class="flex-1 px-2 py-1 text-[10px] rounded border transition-colors"
						:class="
							editing.style.value === s
								? 'border-primary bg-primary/20 text-primary'
								: 'border-border text-muted-foreground hover:bg-muted'
						"
						@click="onSetStyle(s)"
					>
						{{ s }}
					</button>
				</div>
			</div>

			<div class="flex items-center justify-between">
				<span class="text-[11px] text-muted-foreground">
					Text pane ({{ editing.nodes.value.length }})
				</span>
				<button
					type="button"
					:disabled="!editable"
					data-testid="smartart-add-item"
					class="rounded bg-muted hover:bg-accent px-2 py-1 text-[11px] transition-colors"
					@click="editing.addItem()"
				>
					Add item
				</button>
			</div>

			<div class="max-h-52 overflow-y-auto space-y-1 pr-1" data-testid="smartart-node-list">
				<div
					v-for="row in editing.rows.value"
					:key="row.node.id"
					class="rounded border bg-background/60 p-1.5"
					:class="row.isChild ? 'border-border/60 ml-4' : 'border-border'"
					data-testid="smartart-node"
				>
					<div class="flex items-center gap-1">
						<span class="text-[9px] text-muted-foreground w-3 shrink-0">
							{{ row.isChild ? bulletGlyph : `${row.index + 1}` }}
						</span>
						<input
							type="text"
							:disabled="!editable"
							data-testid="smartart-node-text"
							class="flex-1 bg-muted border border-border rounded px-1.5 py-0.5 text-[11px]"
							:value="row.node.text"
							placeholder="Type here"
							@input="onNodeTextInput($event, row.node.id)"
							@keydown="onNodeKeyDown($event, row.node.id)"
						/>
						<div class="flex items-center gap-0.5 shrink-0">
							<button
								type="button"
								:disabled="!editable"
								data-testid="smartart-move-up"
								class="text-[9px] text-muted-foreground hover:text-primary px-1"
								title="Move up"
								@click="editing.moveUp(row.node.id)"
							>
								&uarr;
							</button>
							<button
								type="button"
								:disabled="!editable"
								data-testid="smartart-move-down"
								class="text-[9px] text-muted-foreground hover:text-primary px-1"
								title="Move down"
								@click="editing.moveDown(row.node.id)"
							>
								&darr;
							</button>
							<button
								v-if="!row.isChild"
								type="button"
								:disabled="!editable"
								data-testid="smartart-add-sub"
								class="text-[9px] text-muted-foreground hover:text-primary px-1"
								title="Add sub-item"
								@click="editing.addSubItem(row.node.id)"
							>
								+Sub
							</button>
							<button
								type="button"
								:disabled="!editable || editing.nodes.value.length <= 1"
								data-testid="smartart-remove"
								class="text-[9px] text-muted-foreground hover:text-red-400 px-1"
								title="Remove"
								@click="editing.removeNode(row.node.id)"
							>
								x
							</button>
						</div>
					</div>
				</div>
			</div>

			<p class="text-[9px] text-muted-foreground mt-1">Tab to demote, Shift+Tab to promote.</p>
		</template>
	</div>
</template>
