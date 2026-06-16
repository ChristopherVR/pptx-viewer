<script setup lang="ts">
import type {
	PptxAppProperties,
	PptxCoreProperties,
	PptxCustomProperty,
	PptxSlide,
} from 'pptx-viewer-core';
import { computed, ref, watch } from 'vue';

import { computeDocumentStatistics } from '../composables/useDocumentStatistics';
import type { DocumentStatistics } from '../composables/useDocumentStatistics';
import DocumentPropertiesCustomTab from './DocumentPropertiesCustomTab.vue';
import DocumentPropertiesGeneralTab from './DocumentPropertiesGeneralTab.vue';
import type { GeneralCoreKey } from './DocumentPropertiesGeneralTab.vue';
import DocumentPropertiesStatisticsTab from './DocumentPropertiesStatisticsTab.vue';
import ModalDialog from './ModalDialog.vue';

type TabId = 'general' | 'statistics' | 'custom';

/**
 * Payload emitted on save. Mirrors the React `onSave(core, custom, app?)`
 * signature, collapsed into a single patch object so the host can apply it in
 * one call. `app` is only present when manager/company changed.
 */
export interface DocumentPropertiesSavePatch {
	/** Full edited core-properties draft. */
	core: PptxCoreProperties;
	/** Full edited custom-properties list. */
	custom: PptxCustomProperty[];
	/** Edited app properties (manager/company) — omitted when unchanged. */
	app?: Pick<PptxAppProperties, 'manager' | 'company'>;
}

/**
 * DocumentPropertiesDialog — the full tabbed Document Properties dialog.
 *
 * Vue port of React's `DocumentPropertiesDialog`, built on `ModalDialog`. Three
 * tabs:
 *  - **General** — editable core metadata (title/subject/author/keywords/
 *    comments/category) plus app-level manager/company.
 *  - **Statistics** — read-only counts computed live from the slide model
 *    (`computeDocumentStatistics`) + timestamps/revision from core properties.
 *  - **Custom** — add/remove/edit user-defined custom properties.
 *
 * Draft state is held locally and re-seeded each time the dialog opens; nothing
 * is committed until the user clicks Save, which emits a single
 * {@link DocumentPropertiesSavePatch}. A dirty check disables no-op saves.
 */
const props = defineProps<{
	/** Whether the dialog is visible. */
	open: boolean;
	/** Parsed document core properties. */
	coreProperties: PptxCoreProperties | undefined;
	/** Parsed custom properties (defaults to empty). */
	customProperties?: PptxCustomProperty[];
	/** Parsed app properties — only manager/company are editable here. */
	appProperties?: PptxAppProperties;
	/** Live slide model, used to compute the Statistics tab. */
	slides: PptxSlide[];
}>();

const emit = defineEmits<{
	/** Fired with the edited properties when the user saves. */
	(e: 'save', patch: DocumentPropertiesSavePatch): void;
	/** Fired when the dialog is dismissed without saving. */
	(e: 'close'): void;
}>();

const TABS: Array<{ id: TabId; label: string }> = [
	{ id: 'general', label: 'General' },
	{ id: 'statistics', label: 'Statistics' },
	{ id: 'custom', label: 'Custom' },
];

const activeTab = ref<TabId>('general');
const draftCore = ref<PptxCoreProperties>({});
const draftCustom = ref<PptxCustomProperty[]>([]);
const draftManager = ref('');
const draftCompany = ref('');

function seedDraft(): void {
	draftCore.value = { ...(props.coreProperties ?? {}) };
	draftCustom.value = (props.customProperties ?? []).map((p) => ({ ...p }));
	draftManager.value = props.appProperties?.manager ?? '';
	draftCompany.value = props.appProperties?.company ?? '';
	activeTab.value = 'general';
}

watch(
	() => props.open,
	(isOpen) => {
		if (isOpen) {
			seedDraft();
		}
	},
	{ immediate: true },
);

const statistics = computed<DocumentStatistics>(() =>
	computeDocumentStatistics(props.slides, props.coreProperties),
);

function updateCore(key: GeneralCoreKey, value: string): void {
	draftCore.value = { ...draftCore.value, [key]: value };
}

function updateCustom(next: PptxCustomProperty[]): void {
	draftCustom.value = next;
}

const isDirty = computed<boolean>(() => {
	const core = props.coreProperties ?? {};
	const coreKeys: GeneralCoreKey[] = [
		'title',
		'subject',
		'creator',
		'keywords',
		'description',
		'category',
	];
	const coreChanged = coreKeys.some((key) => (draftCore.value[key] ?? '') !== (core[key] ?? ''));
	if (coreChanged) {
		return true;
	}

	if (draftManager.value !== (props.appProperties?.manager ?? '')) {
		return true;
	}
	if (draftCompany.value !== (props.appProperties?.company ?? '')) {
		return true;
	}

	const original = props.customProperties ?? [];
	if (draftCustom.value.length !== original.length) {
		return true;
	}
	return draftCustom.value.some(
		(p, i) =>
			p.name !== original[i]?.name ||
			p.value !== original[i]?.value ||
			p.type !== original[i]?.type,
	);
});

function handleSave(): void {
	const appChanged =
		draftManager.value !== (props.appProperties?.manager ?? '') ||
		draftCompany.value !== (props.appProperties?.company ?? '');

	const patch: DocumentPropertiesSavePatch = {
		core: { ...draftCore.value },
		custom: draftCustom.value.map((p) => ({ ...p })),
	};
	if (appChanged) {
		patch.app = { manager: draftManager.value, company: draftCompany.value };
	}
	emit('save', patch);
	emit('close');
}
</script>

<template>
	<ModalDialog :open="open" title="Document properties" @close="emit('close')">
		<div class="pptx-vue-docprops flex min-w-[360px] flex-col gap-3">
			<div class="pptx-vue-docprops-tabs flex border-b border-border/60" role="tablist">
				<button
					v-for="tab in TABS"
					:key="tab.id"
					type="button"
					role="tab"
					:aria-selected="activeTab === tab.id"
					class="pptx-vue-docprops-tab px-4 py-2 text-xs font-medium transition-colors"
					:class="
						activeTab === tab.id
							? 'pptx-vue-docprops-tab-active border-b-2 border-primary text-primary'
							: 'text-muted-foreground hover:text-foreground'
					"
					@click="activeTab = tab.id"
				>
					{{ tab.label }}
				</button>
			</div>

			<div class="pptx-vue-docprops-body min-h-[280px]">
				<DocumentPropertiesGeneralTab
					v-if="activeTab === 'general'"
					:core="draftCore"
					:manager="draftManager"
					:company="draftCompany"
					@update-core="updateCore"
					@update-manager="draftManager = $event"
					@update-company="draftCompany = $event"
				/>
				<DocumentPropertiesStatisticsTab
					v-else-if="activeTab === 'statistics'"
					:statistics="statistics"
				/>
				<DocumentPropertiesCustomTab
					v-else
					:custom-properties="draftCustom"
					@update="updateCustom"
				/>
			</div>
		</div>

		<template #footer>
			<button
				type="button"
				class="pptx-vue-docprops-btn rounded-md border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
				@click="emit('close')"
			>
				Cancel
			</button>
			<button
				type="button"
				class="pptx-vue-docprops-btn pptx-vue-docprops-btn-primary rounded-md border border-transparent bg-primary px-3 py-1.5 text-xs text-primary-foreground transition-colors hover:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-40"
				:disabled="!isDirty"
				@click="handleSave"
			>
				Save
			</button>
		</template>
	</ModalDialog>
</template>
