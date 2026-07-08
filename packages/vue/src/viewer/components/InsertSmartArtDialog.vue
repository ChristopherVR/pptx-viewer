<script setup lang="ts">
import type { PptxElement, SmartArtLayout, SmartArtPptxElement } from 'pptx-viewer-core';
import { buildSmartArtPresetData } from 'pptx-viewer-shared';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import ModalDialog from './ModalDialog.vue';
import type { SmartArtCategory } from './smart-art-presets';
import { CATEGORIES, PRESETS } from './smart-art-presets';
import SmartArtPreviews from './SmartArtPreviews.vue';

/**
 * InsertSmartArtDialog: gallery + node-text entry for inserting a SmartArt
 * graphic.
 *
 * Vue port of the React `InsertSmartArtDialog.tsx`. Built on
 * {@link ModalDialog}, it shows a category sidebar + a thumbnail gallery
 * (`SmartArtPreviews.vue`). Picking a preset seeds an editable textarea with one
 * node per line (the preset's `defaultItems`); the user can add/remove/edit
 * lines before inserting.
 *
 * On insert it builds a fully-formed core {@link SmartArtPptxElement} (so
 * `SmartArtRenderer.vue` can render it directly, with no further core call;
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

const { t } = useI18n();

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
	return {
		id: newId('smartart'),
		type: 'smartArt',
		x: 100,
		y: 120,
		width: 600,
		height: 340,
		smartArtData: buildSmartArtPresetData(layout, items, (i) => newId(`node-${i}`)),
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
	<ModalDialog :open="open" :title="t('pptx.smartArt.insertTitle')" @close="close">
		<div
			class="pptx-vue-smartart-dialog flex h-[min(60vh,440px)] w-[min(78vw,600px)] gap-3 max-md:h-[min(60dvh,440px)] max-md:w-full"
		>
			<!-- Category sidebar -->
			<nav
				class="pptx-vue-smartart-sidebar flex w-[130px] flex-shrink-0 flex-col gap-0.5 border-r border-border pr-2"
				:aria-label="t('pptx.smartArt.categoriesLabel')"
			>
				<button
					v-for="cat in CATEGORIES"
					:key="cat.id"
					type="button"
					class="pptx-vue-smartart-cat rounded px-2.5 py-1.5 text-left text-xs transition-colors"
					:class="
						activeCategory === cat.id
							? 'pptx-vue-smartart-cat--active bg-primary text-primary-foreground'
							: 'text-foreground hover:bg-muted'
					"
					@click="selectCategory(cat.id)"
				>
					{{ t(cat.labelKey) }}
				</button>
			</nav>

			<!-- Gallery + node-text entry -->
			<div class="pptx-vue-smartart-main flex min-w-0 flex-1 flex-col gap-2.5">
				<div
					class="pptx-vue-smartart-gallery grid flex-1 grid-cols-3 gap-2 overflow-y-auto pr-1"
					role="listbox"
					:aria-label="t('pptx.smartArt.layoutsLabel')"
				>
					<button
						v-for="preset in filteredPresets"
						:key="preset.layout"
						type="button"
						role="option"
						:aria-selected="selectedLayout === preset.layout"
						class="pptx-vue-smartart-tile flex flex-col items-center gap-1 rounded-md border p-2 transition-colors"
						:class="
							selectedLayout === preset.layout
								? 'pptx-vue-smartart-tile--active border-primary bg-primary/20'
								: 'border-border hover:bg-muted/50'
						"
						@click="selectLayout(preset.layout)"
						@dblclick="
							selectLayout(preset.layout);
							insert();
						"
					>
						<span
							class="pptx-vue-smartart-thumb flex h-12 w-16 items-center justify-center rounded bg-muted"
						>
							<SmartArtPreviews :layout="preset.layout" />
						</span>
						<span
							class="pptx-vue-smartart-tile-label text-center text-[10px] leading-tight text-foreground"
							>{{ t(preset.labelKey) }}</span
						>
					</button>
				</div>

				<label
					v-if="selectedLayout"
					class="pptx-vue-smartart-nodes flex flex-shrink-0 flex-col gap-1"
				>
					<span class="pptx-vue-smartart-nodes-label text-xs font-medium text-muted-foreground">{{
						t('pptx.smartArt.nodesLabel')
					}}</span>
					<textarea
						v-model="nodeText"
						class="pptx-vue-smartart-textarea w-full resize-y rounded border border-border bg-background px-2.5 py-2 text-[13px] text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
						rows="5"
						spellcheck="false"
						:placeholder="t('pptx.smartArt.nodesPlaceholder')"
					/>
				</label>
			</div>
		</div>

		<template #footer>
			<button
				type="button"
				class="pptx-vue-smartart-btn pptx-vue-smartart-btn--secondary rounded border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
				@click="close"
			>
				{{ t('pptx.share.cancel') }}
			</button>
			<button
				type="button"
				class="pptx-vue-smartart-btn pptx-vue-smartart-btn--primary rounded border border-transparent bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-colors hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-45"
				:disabled="!canInsert"
				@click="insert"
			>
				{{ t('pptx.smartArt.insert') }}
			</button>
		</template>
	</ModalDialog>
</template>
