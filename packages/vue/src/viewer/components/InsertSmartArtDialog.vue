<script setup lang="ts">
import type {
	PptxElement,
	PptxSmartArtNode,
	SmartArtLayout,
	SmartArtPptxElement,
} from 'pptx-viewer-core';
import { computed, ref, watch } from 'vue';

import ModalDialog from './ModalDialog.vue';
import type { SmartArtCategory } from './smart-art-presets';
import { CATEGORIES, PRESETS } from './smart-art-presets';
import SmartArtPreviews from './SmartArtPreviews.vue';

/**
 * InsertSmartArtDialog — gallery + node-text entry for inserting a SmartArt
 * graphic.
 *
 * Vue port of the React `InsertSmartArtDialog.tsx`. Built on
 * {@link ModalDialog}, it shows a category sidebar + a thumbnail gallery
 * (`SmartArtPreviews.vue`). Picking a preset seeds an editable textarea with one
 * node per line (the preset's `defaultItems`); the user can add/remove/edit
 * lines before inserting.
 *
 * On insert it builds a fully-formed core {@link SmartArtPptxElement} (so
 * `SmartArtRenderer.vue` can render it directly, with no further core call —
 * there is no `createSmartArtElement` factory in core, so the literal is built
 * here exactly as the React `handleInsertSmartArt` handler does) and emits it
 * via the `insert` event. The host routes the payload to `ops.addElement`.
 */
const props = defineProps<{
	/** Whether the dialog is open. */
	open: boolean;
}>();

const emit = defineEmits<{
	/** Emitted with a ready-to-add SmartArt element. */
	(e: 'insert', element: PptxElement): void;
	/** Emitted when the dialog should close without inserting. */
	(e: 'close'): void;
}>();

const activeCategory = ref<SmartArtCategory>('list');
const selectedLayout = ref<SmartArtLayout | null>(null);
/** Newline-separated node texts for the currently selected preset. */
const nodeText = ref('');

const filteredPresets = computed(() => PRESETS.filter((p) => p.category === activeCategory.value));

/** Parsed, trimmed, non-empty node lines from the textarea. */
const nodeItems = computed(() =>
	nodeText.value
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0),
);

const canInsert = computed(() => selectedLayout.value !== null && nodeItems.value.length > 0);

/** Re-seed local state whenever the dialog (re)opens. */
watch(
	() => props.open,
	(isOpen) => {
		if (isOpen) {
			activeCategory.value = 'list';
			selectedLayout.value = null;
			nodeText.value = '';
		}
	},
	{ immediate: true },
);

function selectCategory(cat: SmartArtCategory): void {
	activeCategory.value = cat;
	selectedLayout.value = null;
	nodeText.value = '';
}

function selectLayout(layout: SmartArtLayout): void {
	selectedLayout.value = layout;
	const preset = PRESETS.find((p) => p.layout === layout);
	nodeText.value = preset ? preset.defaultItems.join('\n') : '';
}

/** Best-effort unique id, mirroring the core element-factory style. */
function newId(prefix: string): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return `${prefix}-${crypto.randomUUID()}`;
	}
	return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Build a renderable SmartArt element for the given layout + node texts.
 * Mirrors the React `handleInsertSmartArt`: hierarchy layouts parent every node
 * after the first under the root; all others stay flat.
 */
function buildSmartArtElement(layout: SmartArtLayout, items: string[]): SmartArtPptxElement {
	const nodeIds = items.map((_, i) => newId(`node-${i}`));
	const nodes: PptxSmartArtNode[] = items.map((text, i) => {
		const node: PptxSmartArtNode = { id: nodeIds[i]!, text };
		if (layout === 'hierarchy' && i > 0) {
			node.parentId = nodeIds[0];
		}
		return node;
	});
	return {
		id: newId('smartart'),
		type: 'smartArt',
		x: 100,
		y: 120,
		width: 600,
		height: 340,
		smartArtData: {
			layout,
			colorScheme: 'colorful1',
			style: 'flat',
			nodes,
		},
	};
}

function insert(): void {
	if (selectedLayout.value === null || nodeItems.value.length === 0) {
		return;
	}
	emit('insert', buildSmartArtElement(selectedLayout.value, nodeItems.value));
	emit('close');
}

function close(): void {
	emit('close');
}
</script>

<template>
	<ModalDialog :open="open" title="Insert SmartArt" @close="close">
		<div class="pptx-vue-smartart-dialog">
			<!-- Category sidebar -->
			<nav class="pptx-vue-smartart-sidebar" aria-label="SmartArt categories">
				<button
					v-for="cat in CATEGORIES"
					:key="cat.id"
					type="button"
					class="pptx-vue-smartart-cat"
					:class="{ 'pptx-vue-smartart-cat--active': activeCategory === cat.id }"
					@click="selectCategory(cat.id)"
				>
					{{ cat.label }}
				</button>
			</nav>

			<!-- Gallery + node-text entry -->
			<div class="pptx-vue-smartart-main">
				<div class="pptx-vue-smartart-gallery" role="listbox" aria-label="SmartArt layouts">
					<button
						v-for="preset in filteredPresets"
						:key="preset.layout"
						type="button"
						role="option"
						:aria-selected="selectedLayout === preset.layout"
						class="pptx-vue-smartart-tile"
						:class="{ 'pptx-vue-smartart-tile--active': selectedLayout === preset.layout }"
						@click="selectLayout(preset.layout)"
						@dblclick="
							selectLayout(preset.layout);
							insert();
						"
					>
						<span class="pptx-vue-smartart-thumb">
							<SmartArtPreviews :layout="preset.layout" />
						</span>
						<span class="pptx-vue-smartart-tile-label">{{ preset.label }}</span>
					</button>
				</div>

				<label v-if="selectedLayout" class="pptx-vue-smartart-nodes">
					<span class="pptx-vue-smartart-nodes-label">Nodes (one per line)</span>
					<textarea
						v-model="nodeText"
						class="pptx-vue-smartart-textarea"
						rows="5"
						spellcheck="false"
						placeholder="Item 1&#10;Item 2&#10;Item 3"
					/>
				</label>
			</div>
		</div>

		<template #footer>
			<button
				type="button"
				class="pptx-vue-smartart-btn pptx-vue-smartart-btn--secondary"
				@click="close"
			>
				Cancel
			</button>
			<button
				type="button"
				class="pptx-vue-smartart-btn pptx-vue-smartart-btn--primary"
				:disabled="!canInsert"
				@click="insert"
			>
				Insert
			</button>
		</template>
	</ModalDialog>
</template>

<style scoped>
.pptx-vue-smartart-dialog {
	display: flex;
	gap: 12px;
	width: min(78vw, 600px);
	height: min(60vh, 440px);
}

.pptx-vue-smartart-sidebar {
	display: flex;
	flex-direction: column;
	width: 130px;
	flex-shrink: 0;
	border-right: 1px solid var(--pptx-vue-border, #e5e7eb);
	padding-right: 8px;
	gap: 2px;
}

.pptx-vue-smartart-cat {
	text-align: left;
	padding: 6px 10px;
	font-size: 12px;
	color: var(--pptx-vue-foreground, #111827);
	background: transparent;
	border: none;
	border-radius: 4px;
	cursor: pointer;
}

.pptx-vue-smartart-cat:hover {
	background: var(--pptx-vue-muted, #f3f4f6);
}

.pptx-vue-smartart-cat--active {
	color: var(--pptx-vue-primary-foreground, #ffffff);
	background: var(--pptx-vue-primary, #2563eb);
}

.pptx-vue-smartart-cat--active:hover {
	background: var(--pptx-vue-primary, #2563eb);
}

.pptx-vue-smartart-main {
	display: flex;
	flex-direction: column;
	flex: 1;
	min-width: 0;
	gap: 10px;
}

.pptx-vue-smartart-gallery {
	display: grid;
	grid-template-columns: repeat(3, 1fr);
	gap: 8px;
	overflow-y: auto;
	flex: 1;
	padding-right: 4px;
}

.pptx-vue-smartart-tile {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 4px;
	padding: 8px;
	background: transparent;
	border: 1px solid var(--pptx-vue-border, #e5e7eb);
	border-radius: 6px;
	cursor: pointer;
}

.pptx-vue-smartart-tile:hover {
	background: var(--pptx-vue-muted, #f3f4f6);
}

.pptx-vue-smartart-tile--active {
	border-color: var(--pptx-vue-primary, #2563eb);
	background: color-mix(in srgb, var(--pptx-vue-primary, #2563eb) 14%, transparent);
}

.pptx-vue-smartart-thumb {
	width: 64px;
	height: 48px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: var(--pptx-vue-muted, #f3f4f6);
	border-radius: 4px;
}

.pptx-vue-smartart-tile-label {
	font-size: 10px;
	line-height: 1.2;
	text-align: center;
	color: var(--pptx-vue-foreground, #111827);
}

.pptx-vue-smartart-nodes {
	display: flex;
	flex-direction: column;
	gap: 4px;
	flex-shrink: 0;
}

.pptx-vue-smartart-nodes-label {
	font-size: 12px;
	font-weight: 500;
	color: var(--pptx-vue-muted-foreground, #6b7280);
}

.pptx-vue-smartart-textarea {
	width: 100%;
	padding: 8px 10px;
	font-size: 13px;
	font-family: inherit;
	color: var(--pptx-vue-foreground, #111827);
	background: var(--pptx-vue-background, #ffffff);
	border: 1px solid var(--pptx-vue-border, #e5e7eb);
	border-radius: 4px;
	resize: vertical;
	outline: none;
}

.pptx-vue-smartart-textarea:focus {
	border-color: var(--pptx-vue-primary, #2563eb);
	box-shadow: 0 0 0 1px var(--pptx-vue-primary, #2563eb);
}

.pptx-vue-smartart-btn {
	padding: 6px 12px;
	font-size: 12px;
	border-radius: 4px;
	border: 1px solid transparent;
	cursor: pointer;
}

.pptx-vue-smartart-btn--secondary {
	color: var(--pptx-vue-foreground, #111827);
	background: transparent;
	border-color: var(--pptx-vue-border, #e5e7eb);
}

.pptx-vue-smartart-btn--secondary:hover {
	background: var(--pptx-vue-muted, #f3f4f6);
}

.pptx-vue-smartart-btn--primary {
	color: var(--pptx-vue-primary-foreground, #ffffff);
	background: var(--pptx-vue-primary, #2563eb);
}

.pptx-vue-smartart-btn--primary:disabled {
	opacity: 0.45;
	cursor: not-allowed;
}
</style>
