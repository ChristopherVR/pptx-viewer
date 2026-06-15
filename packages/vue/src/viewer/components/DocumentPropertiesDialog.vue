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
		<div class="pptx-vue-docprops">
			<div class="pptx-vue-docprops-tabs" role="tablist">
				<button
					v-for="tab in TABS"
					:key="tab.id"
					type="button"
					role="tab"
					:aria-selected="activeTab === tab.id"
					class="pptx-vue-docprops-tab"
					:class="{ 'pptx-vue-docprops-tab-active': activeTab === tab.id }"
					@click="activeTab = tab.id"
				>
					{{ tab.label }}
				</button>
			</div>

			<div class="pptx-vue-docprops-body">
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
			<button type="button" class="pptx-vue-docprops-btn" @click="emit('close')">Cancel</button>
			<button
				type="button"
				class="pptx-vue-docprops-btn pptx-vue-docprops-btn-primary"
				:disabled="!isDirty"
				@click="handleSave"
			>
				Save
			</button>
		</template>
	</ModalDialog>
</template>

<style scoped>
.pptx-vue-docprops {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
	min-width: 360px;
}

.pptx-vue-docprops-tabs {
	display: flex;
	gap: 0.25rem;
	border-bottom: 1px solid var(--pptx-vue-border, #2a2a2a);
}

.pptx-vue-docprops-tab {
	padding: 0.375rem 0.75rem;
	border: none;
	background: transparent;
	color: var(--pptx-vue-muted-foreground, #9a9a9a);
	font-size: 0.75rem;
	font-weight: 500;
	cursor: pointer;
	border-bottom: 2px solid transparent;
}

.pptx-vue-docprops-tab:hover {
	color: var(--pptx-vue-foreground, #e5e5e5);
}

.pptx-vue-docprops-tab-active {
	color: var(--pptx-vue-primary, #6366f1);
	border-bottom-color: var(--pptx-vue-primary, #6366f1);
}

.pptx-vue-docprops-body {
	min-height: 280px;
}

.pptx-vue-docprops-btn {
	padding: 0.375rem 0.75rem;
	border: none;
	border-radius: 0.375rem;
	background: var(--pptx-vue-muted, #2a2a2a);
	color: var(--pptx-vue-foreground, #e5e5e5);
	font-size: 0.75rem;
	cursor: pointer;
}

.pptx-vue-docprops-btn-primary {
	background: var(--pptx-vue-primary, #6366f1);
	color: var(--pptx-vue-primary-foreground, #fff);
}

.pptx-vue-docprops-btn-primary:disabled {
	opacity: 0.4;
	cursor: not-allowed;
}
</style>
