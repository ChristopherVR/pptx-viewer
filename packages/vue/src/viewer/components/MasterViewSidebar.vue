<script setup lang="ts">
/**
 * MasterViewSidebar - the master-view navigation sidebar.
 *
 * Vue port of the React `MasterViewSidebar.tsx`. A three-tab sidebar (slide
 * masters / notes master / handout master) with a collapse button. The active
 * tab swaps the body between {@link SlideMastersList}, {@link NotesMasterPanel},
 * and {@link HandoutMasterPanel}.
 *
 * Presentational only: all selection/state is owned by the host and surfaced
 * via emits (React passed equivalent `onX` callbacks).
 *
 * Props : `{ slideMasters, activeMasterIndex, activeLayoutIndex, canvasSize,
 *            mediaDataUrls, masterViewTab, notesMaster, handoutMaster,
 *            handoutSlidesPerPage }`
 * Emits : `select-master: [index]`, `select-layout: [masterIndex, layoutIndex]`,
 *          `collapse: []`, `tab-change: [tab]`,
 *          `handout-slides-per-page-change: [count]`
 */
import type {
	PptxSlideMaster,
	PptxNotesMaster,
	PptxHandoutMaster,
	MasterViewTab,
} from 'pptx-viewer-core';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import type { CanvasSize } from '../types';
import HandoutMasterPanel from './HandoutMasterPanel.vue';
import NotesMasterPanel from './NotesMasterPanel.vue';
import SlideMastersList from './SlideMastersList.vue';

defineProps<{
	slideMasters: PptxSlideMaster[];
	activeMasterIndex: number;
	activeLayoutIndex: number | null;
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
	masterViewTab: MasterViewTab;
	notesMaster: PptxNotesMaster | undefined;
	handoutMaster: PptxHandoutMaster | undefined;
	handoutSlidesPerPage: number;
	/** Background of the selected slide master or layout (Slides tab). */
	slidesBackground?: string | undefined;
	canEdit?: boolean;
}>();

const emit = defineEmits<{
	'select-master': [index: number];
	'select-layout': [masterIndex: number, layoutIndex: number];
	collapse: [];
	'tab-change': [tab: MasterViewTab];
	'handout-slides-per-page-change': [count: number];
	'notes-background-change': [color: string];
	'handout-background-change': [color: string];
	'slides-background-change': [color: string];
}>();

const { t } = useI18n();

const TABS = computed<{ key: MasterViewTab; label: string }[]>(() => [
	{ key: 'slides', label: t('pptx.sections.slides') },
	{ key: 'notes', label: t('pptx.notes.title') },
	{ key: 'handout', label: t('pptx.masterView.tabHandout') },
]);

const TITLES = computed<Record<MasterViewTab, string>>(() => ({
	slides: t('pptx.masterView.slideMastersTitle'),
	notes: t('pptx.masterView.notesMasterTitle'),
	handout: t('pptx.masterView.handoutMasterTitle'),
}));
</script>

<template>
	<aside class="pptx-vue-master-sidebar" :aria-label="t('pptx.view.masterViews')">
		<div class="pptx-vue-master-sidebar__header">
			<span class="pptx-vue-master-sidebar__title">{{ TITLES[masterViewTab] }}</span>
			<button
				type="button"
				class="pptx-vue-master-sidebar__collapse"
				:title="t('pptx.masterView.collapse')"
				:aria-label="t('pptx.masterView.collapse')"
				data-testid="master-collapse"
				@click="emit('collapse')"
			>
				&laquo;
			</button>
		</div>

		<div class="pptx-vue-master-sidebar__tabs" role="tablist">
			<button
				v-for="tab in TABS"
				:key="tab.key"
				type="button"
				role="tab"
				class="pptx-vue-master-sidebar__tab"
				:class="{ 'pptx-vue-master-sidebar__tab--active': masterViewTab === tab.key }"
				:aria-selected="masterViewTab === tab.key"
				:data-testid="`master-tab-${tab.key}`"
				@click="emit('tab-change', tab.key)"
			>
				{{ tab.label }}
			</button>
		</div>

		<div class="pptx-vue-master-sidebar__body">
			<!--
				Format Background for the selected master or layout. PowerPoint
				writes an explicit `p:bgPr` here, deliberately replacing a themed
				`p:bgRef`; the shared rule decides which part it lands on.
			-->
			<section v-if="masterViewTab === 'slides' && canEdit" class="pptx-vue-master-sidebar__card">
				<div class="pptx-vue-master-sidebar__card-label">
					{{ t('pptx.master.notesMasterBackground') }}
				</div>
				<input
					type="color"
					class="pptx-vue-master-sidebar__swatch"
					:aria-label="t('pptx.master.backgroundColorLabel')"
					data-testid="master-slides-bg-swatch"
					:value="slidesBackground ?? '#ffffff'"
					@input="emit('slides-background-change', ($event.target as HTMLInputElement).value)"
				/>
			</section>

			<SlideMastersList
				v-if="masterViewTab === 'slides'"
				:slide-masters="slideMasters"
				:active-master-index="activeMasterIndex"
				:active-layout-index="activeLayoutIndex"
				:canvas-size="canvasSize"
				:media-data-urls="mediaDataUrls"
				@select-master="(index) => emit('select-master', index)"
				@select-layout="
					(masterIndex, layoutIndex) => emit('select-layout', masterIndex, layoutIndex)
				"
			/>

			<NotesMasterPanel
				v-else-if="masterViewTab === 'notes'"
				:notes-master="notesMaster"
				@background-change="(color) => emit('notes-background-change', color)"
			/>

			<HandoutMasterPanel
				v-else
				:handout-master="handoutMaster"
				:slides-per-page="handoutSlidesPerPage"
				@slides-per-page-change="(count) => emit('handout-slides-per-page-change', count)"
				@background-change="(color) => emit('handout-background-change', color)"
			/>
		</div>
	</aside>
</template>

<style scoped>
.pptx-vue-master-sidebar {
	display: flex;
	flex-direction: column;
	width: 224px;
	height: 100%;
	border-right: 1px solid var(--pptx-vue-border, #e5e7eb);
	background: var(--pptx-vue-background, #ffffff);
}

.pptx-vue-master-sidebar__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 8px 12px;
}

.pptx-vue-master-sidebar__title {
	font-size: 11px;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: var(--pptx-vue-muted-foreground, #6b7280);
}

.pptx-vue-master-sidebar__collapse {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 22px;
	height: 22px;
	padding: 0;
	border: none;
	border-radius: 4px;
	background: transparent;
	color: var(--pptx-vue-muted-foreground, #6b7280);
	cursor: pointer;
	font-size: 14px;
	line-height: 1;
}

.pptx-vue-master-sidebar__collapse:hover {
	background: var(--pptx-vue-muted, #f3f4f6);
	color: var(--pptx-vue-foreground, #111827);
}

.pptx-vue-master-sidebar__tabs {
	display: flex;
	padding: 0 4px;
	border-bottom: 1px solid var(--pptx-vue-border, #e5e7eb);
}

.pptx-vue-master-sidebar__tab {
	flex: 1;
	padding: 6px 4px;
	border: none;
	border-bottom: 2px solid transparent;
	background: transparent;
	color: var(--pptx-vue-muted-foreground, #6b7280);
	font-size: 10px;
	font-weight: 500;
	cursor: pointer;
	transition:
		color 0.15s ease,
		border-color 0.15s ease;
}

.pptx-vue-master-sidebar__tab:hover {
	color: var(--pptx-vue-foreground, #111827);
}

.pptx-vue-master-sidebar__tab--active {
	border-bottom-color: #f59e0b;
	color: #f59e0b;
}

.pptx-vue-master-sidebar__body {
	flex: 1;
	overflow-y: auto;
	padding: 4px 6px 8px;
}

.pptx-vue-master-sidebar__card {
	display: flex;
	flex-direction: column;
	gap: 6px;
	margin-bottom: 8px;
	padding: 8px;
	border: 1px solid var(--pptx-vue-border, #e5e7eb);
	border-radius: 6px;
}

.pptx-vue-master-sidebar__card-label {
	font-size: 11px;
	color: var(--pptx-vue-muted-foreground, #6b7280);
}

.pptx-vue-master-sidebar__swatch {
	width: 100%;
	height: 28px;
	padding: 0;
	border: 1px solid var(--pptx-vue-border, #e5e7eb);
	border-radius: 4px;
	background: transparent;
	cursor: pointer;
}
</style>
