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
import type {
	PptxElement,
	PptxHandoutMaster,
	PptxNotesMaster,
	PptxSlideMaster,
} from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';
import { masterViewOwnerElementId } from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import type { UseMasterViewCrudResult } from '../composables/useMasterViewCrud';
import type { UseMasterViewWiringResult } from '../composables/useMasterViewWiring';
import type { CanvasSize } from '../types';
import HandoutMasterCanvas from './HandoutMasterCanvas.vue';
import InlineTextEditor from './InlineTextEditor.vue';
import MasterViewSidebar from './MasterViewSidebar.vue';
import NotesMasterCanvas from './NotesMasterCanvas.vue';
import type { TransformPayload } from './selection-overlay-geometry';
import SelectionOverlay from './SelectionOverlay.vue';
import SlideStage from './SlideStage.vue';

const props = defineProps<{
	state: UseMasterViewWiringResult;
	/** Sidebar Insert/Duplicate/Delete/Rename Layout and Slide Master commands. */
	crud: UseMasterViewCrudResult;
	slideMasters: PptxSlideMaster[];
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
	notesMaster: PptxNotesMaster | undefined;
	/**
	 * The deck's `p:notesSz` in pixels. Without it the notes preview falls back
	 * to a 720x960 US-Letter page, so a deck authored on any other notes page
	 * size was drawn at the wrong proportions (React and Angular both pass it).
	 */
	notesCanvasSize: CanvasSize | undefined;
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

/** The shape whose text is being typed into, and the text so far. */
const editingId = ref<string | null>(null);
const editingText = ref('');

const editingElement = computed<PptxElement | undefined>(() =>
	editingId.value
		? props.state.activeMasterViewElements.value.find((element) => element.id === editingId.value)
		: undefined,
);

/**
 * The master-view element under a pointer event, or null when the click landed
 * on the surface.
 *
 * The nearest `[data-element-id]` is not the answer on its own: a group stamps
 * the marker on its children too, so a click inside one resolved to a CHILD id,
 * which the part's top-level shape list does not contain. Selecting it looked
 * fine and then every write silently did nothing - Delete could remove a plain
 * master shape but never a group. The shared rule maps a hit back to the
 * element the part actually owns.
 */
function elementIdAt(event: Event): string | null {
	const target = event.target as HTMLElement | null;
	const hit = target?.closest?.('[data-element-id]')?.getAttribute('data-element-id') ?? null;
	return masterViewOwnerElementId(props.state.activeMasterViewElements.value, hit);
}

function onStagePointerDown(event: PointerEvent): void {
	const id = elementIdAt(event);
	if (editingId.value && id !== editingId.value) {
		commitInlineEdit();
	}
	selectedIds.value = id ? [id] : [];
}

/**
 * Open the inline text editor on one master/layout shape.
 *
 * Reached by double-clicking the shape, the same gesture the ordinary canvas
 * uses and the one svelte, vanilla and angular already offer here, and by the
 * selection overlay's tap-an-already-selected request.
 */
function beginInlineEdit(id: string | null): void {
	if (!props.canEdit || !id) {
		return;
	}
	const element = props.state.activeMasterViewElements.value.find(
		(candidate) => candidate.id === id,
	);
	if (!element || !hasTextProperties(element)) {
		return;
	}
	// An equation's text is the literal "[Equation]" placeholder, so committing
	// it would remap the runs from that and drop the OMML for good.
	if (element.textSegments?.some((segment) => segment.equationXml)) {
		return;
	}
	editingId.value = element.id;
	editingText.value = (element as { text?: string }).text ?? '';
}

function onStageDoubleClick(event: MouseEvent): void {
	beginInlineEdit(elementIdAt(event));
}

function commitInlineEdit(): void {
	const id = editingId.value;
	editingId.value = null;
	if (id) {
		props.state.onMasterViewTextCommit(id, editingText.value);
	}
}

function cancelInlineEdit(): void {
	editingId.value = null;
}

/**
 * Delete removes the selected master/layout shapes. The overlay has to own
 * this: the deck-wide key handler resolves ids against `slides`, where a
 * master part's shapes do not exist.
 */
function onOverlayKeyDown(event: KeyboardEvent): void {
	if (!props.canEdit || editingId.value || selectedIds.value.length === 0) {
		return;
	}
	if (event.key !== 'Delete' && event.key !== 'Backspace') {
		return;
	}
	event.preventDefault();
	props.state.onMasterViewElementDelete(selectedIds.value);
	selectedIds.value = [];
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
		:tabindex="canEdit ? 0 : undefined"
		@click.self="state.showMasterView.value = false"
		@keydown="onOverlayKeyDown"
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
			:slides-background="state.activeMasterViewBackground.value"
			:can-edit="canEdit"
			:crud-actions="crud.actions.value"
			:crud-error="crud.error.value"
			@select-master="state.onSelectMaster"
			@select-layout="state.onSelectLayout"
			@tab-change="state.masterViewTab.value = $event"
			@handout-slides-per-page-change="state.onHandoutSlidesPerPageChange"
			@notes-background-change="state.onNotesMasterBackgroundChange"
			@handout-background-change="state.onHandoutMasterBackgroundChange"
			@slides-background-change="state.onMasterViewBackgroundChange"
			@collapse="state.showMasterView.value = false"
			@crud-run="crud.run($event)"
		/>
		<main class="pptx-vue-master-canvas" role="application" :aria-label="canvasLabel()">
			<NotesMasterCanvas
				v-if="state.masterViewTab.value === 'notes'"
				:notes-master="notesMaster"
				:canvas-size="canvasSize"
				:notes-canvas-size="notesCanvasSize"
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
				@dblclick="onStageDoubleClick"
			>
				<!--
					Both overlays go in the stage's slot, not beside it. They read
					UNSCALED element px and rely on the stage's own `scale()` to line
					up, which is the contract `SlideStage` documents; mounted as
					siblings they were laid out against the scaled-down box and every
					handle sat 1/scale away from the shape it belonged to.
				-->
				<SlideStage
					:slide="state.activeMasterViewSlide.value"
					:canvas-size="canvasSize"
					:media-data-urls="mediaDataUrls"
					:scale="MASTER_STAGE_SCALE"
					:interactive="canEdit"
				>
					<SelectionOverlay
						v-if="canEdit && !editingId"
						:elements="state.activeMasterViewElements.value"
						:selected-ids="selectedIds"
						:zoom="MASTER_STAGE_SCALE"
						@transform="onTransform"
						@transform-end="onTransform"
						@request-edit="(payload) => beginInlineEdit(payload.id)"
					/>
					<InlineTextEditor
						v-if="canEdit && editingElement"
						:element="editingElement"
						@change="editingText = $event"
						@commit="commitInlineEdit"
						@cancel="cancelInlineEdit"
					/>
				</SlideStage>
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
