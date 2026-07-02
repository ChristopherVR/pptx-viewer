<script setup lang="ts">
import type {
	PptxElement,
	PptxSmartArtData,
	PptxSmartArtNodeStyle,
	SmartArtColorScheme,
	SmartArtLayoutType,
	SmartArtStyle,
} from 'pptx-viewer-core';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import {
	SMARTART_COLOR_SCHEMES,
	SMARTART_STYLE_OPTIONS,
	useSmartArtEditing,
} from '../../composables/useSmartArtEditing';
import SmartArtLayoutSwitcher from './SmartArtLayoutSwitcher.vue';
import SmartArtNodeRow from './SmartArtNodeRow.vue';

/**
 * SmartArtPropertiesPanel: inspector panel for `smartArt` elements.
 *
 * Vue port of the React `SmartArtPropertiesPanel.tsx`. Provides per-node text
 * editing, keyboard structural edits (Enter inserts a sibling, Backspace/Delete
 * removes an empty node, Tab/Shift+Tab demote/promote), focus management after a
 * structural edit, add item / add sub-item, remove, reorder, colour-scheme,
 * style, a layout switcher, per-node visual overrides (fill / font / bold /
 * italic), layout node-count bounds, and read-only awareness of non-tree
 * connections. All logic lives in `useSmartArtEditing` (core ops only); this SFC
 * is thin presentation.
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

const { t } = useI18n();

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

const addDisabled = computed(() => !editable.value || !editing.canAdd.value);

function onColorSchemeChange(event: Event): void {
	editing.setColorScheme((event.target as HTMLSelectElement).value as SmartArtColorScheme);
}

function onSwitchLayout(layout: SmartArtLayoutType): void {
	editing.switchLayout(layout);
}

function onSetStyle(value: SmartArtStyle): void {
	editing.setStyle(value);
}

function onSetNodeStyle(nodeId: string, style: Partial<PptxSmartArtNodeStyle>): void {
	editing.setNodeStyle(nodeId, style);
}

function onRegisterInput(nodeId: string, el: HTMLInputElement | null): void {
	editing.setInputEl(nodeId, el);
}
</script>

<template>
	<div
		class="pptx-vue-smartart-panel flex flex-col gap-2 text-xs"
		data-testid="smartart-panel"
		role="group"
		:aria-label="t('pptx.smartart.title')"
	>
		<p v-if="!isSmartArt" class="text-muted-foreground italic">
			{{ t('pptx.smartArt.selectPrompt') }}
		</p>

		<template v-else>
			<SmartArtLayoutSwitcher
				:current="editing.currentLayout.value"
				:can-edit="editable"
				@switch="onSwitchLayout"
			/>

			<label class="flex flex-col gap-1 text-[11px]">
				<span class="text-muted-foreground">{{ t('pptx.smartart.colorScheme') }}</span>
				<select
					class="flex-1 bg-muted border border-border rounded px-1.5 py-0.5 w-full"
					data-testid="smartart-color-scheme"
					:aria-label="t('pptx.smartart.colorScheme')"
					:disabled="!editable"
					:value="editing.colorScheme.value"
					@change="onColorSchemeChange"
				>
					<option v-for="cs in colorSchemes" :key="cs" :value="cs">{{ cs }}</option>
				</select>
			</label>

			<div class="flex flex-col gap-1 text-[11px]">
				<span class="text-muted-foreground">{{ t('pptx.smartart.style') }}</span>
				<div class="flex gap-1" role="group" :aria-label="t('pptx.smartart.style')">
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
					{{ t('pptx.smartart.textPane') }} ({{ editing.nodes.value.length }})
				</span>
				<button
					type="button"
					:disabled="addDisabled"
					data-testid="smartart-add-item"
					class="rounded bg-muted hover:bg-accent px-2 py-1 text-[11px] transition-colors disabled:opacity-40"
					:title="addDisabled ? editing.boundsHint.value : undefined"
					@click="editing.addItem()"
				>
					{{ t('pptx.smartart.addItem') }}
				</button>
			</div>

			<div
				v-if="editing.boundsHint.value"
				class="text-[9px] text-muted-foreground"
				role="note"
				data-testid="smartart-bounds-hint"
			>
				{{ editing.boundsHint.value }}
			</div>

			<div
				class="max-h-52 overflow-y-auto space-y-1 pr-1"
				data-testid="smartart-node-list"
				role="list"
			>
				<SmartArtNodeRow
					v-for="row in editing.rows.value"
					:key="row.node.id"
					:node="row.node"
					:display-index="row.displayIndex"
					:is-child="row.isChild"
					:can-edit="editable"
					:remove-disabled="row.removeDisabled"
					:move-up-disabled="row.moveUpDisabled"
					:move-down-disabled="row.moveDownDisabled"
					@change-text="editing.updateNodeText"
					@keydown-node="editing.onNodeKeyDown"
					@set-style="onSetNodeStyle"
					@add-sub-item="editing.addSubItem"
					@move-up="editing.moveUp"
					@move-down="editing.moveDown"
					@remove="editing.removeNode"
					@register-input="onRegisterInput"
				/>
			</div>

			<div
				v-if="editing.extraConnections.value > 0"
				class="text-[9px] text-muted-foreground"
				role="note"
				data-testid="smartart-extra-connections"
			>
				{{ t('pptx.smartart.extraConnections', { count: editing.extraConnections.value }) }}
			</div>

			<p class="text-[9px] text-muted-foreground mt-1">
				{{ t('pptx.smartart.tabHint') }}
			</p>
		</template>
	</div>
</template>
