<script setup lang="ts">
/**
 * SmartArt3DRenderer - Vue 3D SmartArt view on the shared `<pptx-three-view>`.
 *
 * The spec (`resolveSmartArtThreeViewSpec`) and the whole scene live in
 * `pptx-viewer-shared`; this SFC only slots the SVG `SmartArtRenderer` in as
 * the element's fallback (shown while the scene loads, and kept when `three`
 * is missing or the scene fails) and, in edit mode, layers the inline
 * node-text editor on top. When no spec applies (the diagram has nothing to
 * draw) it renders the plain SVG `SmartArtRenderer`. Mirrors React's
 * `SmartArt3DView.tsx`.
 *
 * When the host provides a SmartArtNodeEditKey injection (edit mode), an
 * invisible SmartArtHitTestWrapper overlay is stacked over the scene.
 * Double-clicking it walks up from the click target to the nearest
 * `[data-node-id]` SVG group, projects its screen rect into container-local
 * coordinates, and opens an inline textarea editor for that node. Commits flow
 * through the same injection context the 2D renderer uses (undo/redo + save).
 */
import type { PptxElement } from 'pptx-viewer-core';
import {
	elementInLocalFrame,
	resolveSmartArtThreeViewSpec,
	shouldCommitSmartArtNodeText,
} from 'pptx-viewer-shared';
import type { TextStyleAnimationDescriptor } from 'pptx-viewer-shared';
import { computed, nextTick, ref } from 'vue';
import type { CSSProperties } from 'vue';
import { useI18n } from 'vue-i18n';

import { useElementHitTargetStyle } from '../composables/element-hit-target';
import { getContainerStyle } from '../composables/element-style';
import { useRendering3DFlags } from '../composables/rendering-3d-flags';
import { inlineEditorRect, useSmartArtInlineEditState } from '../composables/smartart-inline-edit';
import { injectSmartArtNodeEdit } from '../composables/smartart-node-edit';
import SmartArtHitTestWrapper from './SmartArtHitTestWrapper.vue';
import SmartArtRenderer from './SmartArtRenderer.vue';
import ThreeView from './ThreeView';

const props = defineProps<{
	element: PptxElement;
	mediaDataUrls?: Map<string, string>;
	zIndex: number;
	/** True only on the main editable canvas; see `hitTargetStyle`. */
	interactive?: boolean;
	/** True only on the live presentation stage; see `hitTargetStyle`. */
	presenting?: boolean;
	/**
	 * Active font-style emphasis override (Bold Flash, Bold Reveal, Underline,
	 * Change Font Style/Size), applied to every node caption by the scene. The
	 * parent `ElementRenderer`'s DOM CSS override (`buildTextStyleOverrideCss`)
	 * cannot reach a canvas-texture caption; the SVG fallback still takes the
	 * CSS override directly.
	 */
	textStyle?: TextStyleAnimationDescriptor;
	/** Forwarded to the fallback SVG `SmartArtRenderer` (see `textStyle` above). */
	textStyleOverrideCss?: string;
}>();

const { t } = useI18n();

const smartArtData = computed(() =>
	props.element.type === 'smartArt' ? props.element.smartArtData : undefined,
);

const flags = useRendering3DFlags();
const spec = computed(() => resolveSmartArtThreeViewSpec(props.element, flags.value.smartArt3D));

/** The element in the container's own frame, for the slotted fallback and hit-test copies. */
const localElement = computed(() => elementInLocalFrame(props.element));

const containerRef = ref<HTMLElement | null>(null);
const editorEl = ref<HTMLTextAreaElement | null>(null);

const containerStyle = computed<CSSProperties>(() =>
	getContainerStyle(props.element, props.zIndex),
);

/**
 * Interaction-only affordance for a degenerate (sub-MIN_ELEMENT_SIZE) 3D
 * SmartArt scene: see `ElementRenderer`'s `hitTargetStyle` doc comment (issue
 * #285). Never rendered while presenting.
 */
const hitTargetStyle = useElementHitTargetStyle(
	() => props.element,
	() => props.interactive,
	() => props.presenting,
);

// ── Inline editing (injection-based, mirrors SmartArtRenderer.vue) ──────────

const nodeEdit = injectSmartArtNodeEdit();
const canEdit = computed(() => Boolean(nodeEdit?.canEdit()));

const editState = useSmartArtInlineEditState();

/** Walk up from an event target to find the nearest element with data-node-id. */
function findNodeEl(target: EventTarget | null): Element | null {
	let el = target instanceof Element ? target : null;
	while (el) {
		if (el.hasAttribute('data-node-id')) {
			return el;
		}
		el = el.parentElement;
	}
	return null;
}

function onOverlayDblClick(e: MouseEvent): void {
	const nodeEl = findNodeEl(e.target);
	const container = containerRef.value;
	if (!nodeEl || !container) {
		return;
	}
	const nodeId = nodeEl.getAttribute('data-node-id');
	if (!nodeId || !nodeEdit) {
		return;
	}
	const data = smartArtData.value;
	if (!data) {
		return;
	}
	const currentText = data.nodes.find((n) => n.id === nodeId)?.text ?? '';
	const rect = inlineEditorRect(nodeEl.getBoundingClientRect(), container.getBoundingClientRect());
	editState.begin(nodeId, currentText, rect);
	void nextTick(() => {
		editorEl.value?.focus();
		editorEl.value?.select();
	});
}

function commitEdit(): void {
	const nodeId = editState.editingNodeId.value;
	const data = smartArtData.value;
	if (
		nodeId &&
		data &&
		nodeEdit &&
		shouldCommitSmartArtNodeText(data, nodeId, editState.draft.value)
	) {
		nodeEdit.commit(props.element.id, nodeId, editState.draft.value);
	}
	editState.cancel();
}
</script>

<template>
	<SmartArtRenderer
		v-if="!spec"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
		:interactive="interactive"
		:presenting="presenting"
		:text-style-override-css="textStyleOverrideCss"
	/>
	<div
		v-else
		ref="containerRef"
		class="pptx-vue-element pptx-vue-smartart-3d"
		:style="containerStyle"
		:data-element-id="element.id"
	>
		<!-- Interaction-only hit-target for a degenerate 3D SmartArt; see `hitTargetStyle`. -->
		<div
			v-if="hitTargetStyle"
			aria-hidden="true"
			data-pptx-hit-target="true"
			:style="hitTargetStyle"
		/>
		<ThreeView :spec="spec" :interactive="canEdit" :text-style="textStyle">
			<SmartArtRenderer
				:element="localElement"
				:media-data-urls="mediaDataUrls"
				:z-index="0"
				:text-style-override-css="textStyleOverrideCss"
			/>
		</ThreeView>

		<template v-if="canEdit">
			<!-- Invisible SVG overlay: data-node-id groups are pointer-events hit targets -->
			<div class="pptx-vue-smartart-3d-hittest" @dblclick.stop="onOverlayDblClick">
				<SmartArtHitTestWrapper :element="localElement" :zIndex="0" />
			</div>

			<!-- Inline node text editor, positioned over the clicked node -->
			<textarea
				v-if="editState.isEditing.value && editState.rect.value"
				ref="editorEl"
				v-model="editState.draft.value"
				class="pptx-vue-smartart-3d-editor"
				spellcheck="false"
				:aria-label="t('pptx.smartArt.editNodeText')"
				:style="{
					left: `${editState.rect.value.left}px`,
					top: `${editState.rect.value.top}px`,
					width: `${editState.rect.value.width}px`,
					height: `${editState.rect.value.height}px`,
				}"
				@mousedown.stop
				@click.stop
				@dblclick.stop
				@blur="commitEdit"
				@keydown.enter.prevent="commitEdit"
				@keydown.esc.prevent="editState.cancel()"
				@keydown.stop
			/>
		</template>
	</div>
</template>

<style scoped>
/* Invisible hit-test overlay: fills the canvas area, captures dblclicks.
   opacity:0 makes it invisible while keeping it in the layout + event flow. */
.pptx-vue-smartart-3d-hittest {
	position: absolute;
	inset: 0;
	opacity: 0;
}

/* Force pointer-events:auto on SmartArt node groups within the hit-test overlay.
   SmartArtRenderer sets pointer-events:none on its <svg> element; groups only
   get pointer-events:auto when editable=true, which is disabled in the wrapper.
   This rule re-enables them so the dblclick target is the <g> element (carrying
   data-node-id) rather than the overlay div, enabling correct node resolution. */
.pptx-vue-smartart-3d-hittest :deep([data-node-id]) {
	pointer-events: auto;
}

.pptx-vue-smartart-3d-editor {
	position: absolute;
	z-index: 20;
	margin: 0;
	padding: 2px;
	box-sizing: border-box;
	border: 1px solid #2563eb;
	border-radius: 3px;
	resize: none;
	overflow: hidden;
	font: inherit;
	font-size: 12px;
	line-height: 1.2;
	text-align: center;
	color: #111;
	background: rgba(255, 255, 255, 0.95);
	outline: none;
	box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}
</style>
