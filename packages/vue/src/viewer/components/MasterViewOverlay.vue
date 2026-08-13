<script setup lang="ts">
/**
 * MasterViewOverlay: the View > Master Views modal (slide / notes / handout
 * masters), lifted out of `PowerPointViewer.vue`.
 *
 * Purely presentational: the tab, master and layout selection plus the
 * background / slides-per-page edits all belong to `useMasterViewWiring`,
 * which is handed over whole as `state` rather than being unpacked into a
 * dozen individual props.
 */
import type { PptxHandoutMaster, PptxNotesMaster, PptxSlideMaster } from 'pptx-viewer-core';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { UseMasterViewWiringResult } from '../composables/useMasterViewWiring';
import type { CanvasSize } from '../types';
import HandoutMasterCanvas from './HandoutMasterCanvas.vue';
import MasterViewSidebar from './MasterViewSidebar.vue';
import NotesMasterCanvas from './NotesMasterCanvas.vue';
import type { TransformPayload } from './selection-overlay-geometry';
import SelectionOverlay from './SelectionOverlay.vue';
import SlideStage from './SlideStage.vue';

const props = defineProps<{
	state: UseMasterViewWiringResult;
	slideMasters: PptxSlideMaster[];
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
	notesMaster: PptxNotesMaster | undefined;
	handoutMaster: PptxHandoutMaster | undefined;
	/** Editing affordances are offered only on an editable deck. */
	canEdit?: boolean;
}>();

const { t } = useI18n();

/** The master stage is rendered at a fixed scale; the overlay must match it. */
const MASTER_STAGE_SCALE = 0.75;

/**
 * Selection is local to the overlay: the master parts are not in `slides`, so
 * the deck-wide selection state would resolve every id to nothing.
 */
const selectedIds = ref<string[]>([]);

function onStagePointerDown(event: PointerEvent): void {
	const target = event.target as HTMLElement | null;
	const node = target?.closest?.('[data-element-id]') ?? null;
	const id = node?.getAttribute('data-element-id') ?? null;
	selectedIds.value = id ? [id] : [];
}

/** A drag / resize / rotate on a master or layout shape. */
function onTransform(payload: TransformPayload): void {
	props.state.onMasterViewElementUpdate(payload.id, {
		x: payload.x,
		y: payload.y,
		width: payload.width,
		height: payload.height,
		rotation: payload.rotation,
	});
}

/** The canvas' accessible name follows whichever master the tab is showing. */
function canvasLabel(): string {
	if (props.state.masterViewTab.value === 'notes') {
		return t('pptx.master.notesMasterTitle');
	}
	if (props.state.masterViewTab.value === 'handout') {
		return t('pptx.master.handoutMasterTitle');
	}
	return t('pptx.master.title');
}
</script>

<template>
	<div
		class="pptx-vue-master-overlay"
		role="dialog"
		:aria-label="t('pptx.view.masterViews')"
		@click.self="state.showMasterView.value = false"
	>
		<MasterViewSidebar
			:slide-masters="slideMasters"
			:active-master-index="state.activeMasterIndex.value"
			:active-layout-index="state.activeLayoutIndex.value"
			:canvas-size="canvasSize"
			:media-data-urls="mediaDataUrls"
			:master-view-tab="state.masterViewTab.value"
			:notes-master="notesMaster"
			:handout-master="handoutMaster"
			:handout-slides-per-page="handoutMaster?.slidesPerPage ?? state.handoutSlidesPerPage.value"
			@select-master="state.onSelectMaster"
			@select-layout="state.onSelectLayout"
			@tab-change="state.masterViewTab.value = $event"
			@handout-slides-per-page-change="state.onHandoutSlidesPerPageChange"
			@notes-background-change="state.onNotesMasterBackgroundChange"
			@handout-background-change="state.onHandoutMasterBackgroundChange"
			@collapse="state.showMasterView.value = false"
		/>
		<main class="pptx-vue-master-canvas" role="application" :aria-label="canvasLabel()">
			<NotesMasterCanvas
				v-if="state.masterViewTab.value === 'notes'"
				:notes-master="notesMaster"
				:canvas-size="canvasSize"
			/>
			<HandoutMasterCanvas
				v-else-if="state.masterViewTab.value === 'handout'"
				:handout-master="handoutMaster"
				:canvas-size="canvasSize"
				:slides-per-page="handoutMaster?.slidesPerPage ?? state.handoutSlidesPerPage.value"
			/>
			<div
				v-else-if="state.activeMasterViewSlide.value"
				class="pptx-vue-master-stage"
				:style="{
					width: `${canvasSize.width * MASTER_STAGE_SCALE}px`,
					height: `${canvasSize.height * MASTER_STAGE_SCALE}px`,
				}"
				@pointerdown="onStagePointerDown"
			>
				<SlideStage
					:slide="state.activeMasterViewSlide.value"
					:canvas-size="canvasSize"
					:media-data-urls="mediaDataUrls"
					:scale="MASTER_STAGE_SCALE"
					:interactive="canEdit"
				/>
				<SelectionOverlay
					v-if="canEdit"
					:elements="state.activeMasterViewElements.value"
					:selected-ids="selectedIds"
					:zoom="MASTER_STAGE_SCALE"
					@transform="onTransform"
					@transform-end="onTransform"
				/>
			</div>
		</main>
	</div>
</template>

<style scoped>
/*
 * Moved out of the inline `style` attributes the overlay carried while it lived
 * in `PowerPointViewer.vue`; identical values, just no longer restated on every
 * render.
 */
.pptx-vue-master-overlay {
	position: fixed;
	inset: 0;
	z-index: 1000;
	display: flex;
	justify-content: flex-start;
	background: rgba(0, 0, 0, 0.45);
}

/*
 * The selection overlay positions its handles in scaled slide space, so it has
 * to share an origin with the stage it decorates.
 */
.pptx-vue-master-stage {
	position: relative;
	flex: none;
}

.pptx-vue-master-canvas {
	display: flex;
	flex: 1;
	min-width: 0;
	align-items: center;
	justify-content: center;
	overflow: hidden;
	background: var(--pptx-vue-background, #111827);
}
</style>
