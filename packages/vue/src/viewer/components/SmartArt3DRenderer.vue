<script setup lang="ts">
/**
 * SmartArt3DRenderer - Vue Three.js SmartArt renderer.
 *
 * Builds the pure 3D model from the shared layout engine (no `three` import),
 * then lazily imports the vanilla scene runtime from
 * `pptx-viewer-shared/smartart-3d` and mounts it on a canvas. `three` is an
 * optional peer dependency: when it is missing, the diagram has no geometry, or
 * the scene errors, the component transparently falls back to the SVG
 * `SmartArtRenderer`.
 *
 * When the host provides a SmartArtNodeEditKey injection (edit mode), an
 * invisible SmartArtHitTestWrapper overlay is stacked over the 3D canvas.
 * Double-clicking it walks up from the click target to the nearest
 * `[data-node-id]` SVG group, projects its screen rect into container-local
 * coordinates, and opens an inline textarea editor for that node. Commits flow
 * through the same injection context the 2D renderer uses (undo/redo + save).
 */
import type {
	PptxElement,
	PptxSmartArtChrome,
	SmartArtColorScheme,
	SmartArtStyle,
} from 'pptx-viewer-core';
import {
	buildSmartArt3DModel,
	collectCoherent3DOffNodeIds,
	computeSmartArtElementLayout,
	shouldCommitSmartArtNodeText,
} from 'pptx-viewer-shared';
import type { SmartArt3DModel, TextStyleAnimationDescriptor } from 'pptx-viewer-shared';
import { computed, nextTick, ref, toRef } from 'vue';
import type { CSSProperties } from 'vue';
import { useI18n } from 'vue-i18n';

import { getContainerStyle } from '../composables/element-style';
import { inlineEditorRect, useSmartArtInlineEditState } from '../composables/smartart-inline-edit';
import { injectSmartArtNodeEdit } from '../composables/smartart-node-edit';
import { useSmartArt3DScene } from '../composables/useSmartArt3DScene';
import SmartArtHitTestWrapper from './SmartArtHitTestWrapper.vue';
import SmartArtRenderer from './SmartArtRenderer.vue';

const props = defineProps<{
	element: PptxElement;
	mediaDataUrls?: Map<string, string>;
	zIndex: number;
	/**
	 * Active font-style emphasis override (Bold Flash, Bold Reveal, Underline,
	 * Change Font Style/Size), applied to every node caption via the mounted
	 * handle's `setTextStyle`. The parent `ElementRenderer`'s DOM CSS override
	 * (`buildTextStyleOverrideCss`) cannot reach a canvas-texture caption, so
	 * this scene-native path is the only one that reaches it; the fallback
	 * SVG `SmartArtRenderer` below still takes the CSS override directly.
	 */
	textStyle?: TextStyleAnimationDescriptor;
	/** Forwarded to the fallback SVG `SmartArtRenderer` (see `textStyle` above). */
	textStyleOverrideCss?: string;
}>();

const { t } = useI18n();

const PALETTES: Record<SmartArtColorScheme, string[]> = {
	colorful1: ['#3b82f6', '#22c55e', '#f97316', '#eab308', '#a855f7', '#ec4899'],
	colorful2: ['#6366f1', '#14b8a6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
	colorful3: ['#0ea5e9', '#84cc16', '#f43e5e', '#a855f7', '#f97316', '#10b981'],
	monochromatic1: ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#2563eb', '#1d4ed8'],
	monochromatic2: ['#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#4f46e5', '#4338ca'],
};

const smartArtData = computed(() =>
	props.element.type === 'smartArt' ? props.element.smartArtData : undefined,
);

const palette = computed<string[]>(() => {
	const data = smartArtData.value;
	const ctFills = data?.colorTransform?.fillColors;
	if (ctFills && ctFills.length > 0) {
		return ctFills;
	}
	return PALETTES[data?.colorScheme ?? 'colorful1'] ?? PALETTES.colorful1;
});

const style = computed<SmartArtStyle>(() => smartArtData.value?.style ?? 'flat');
const chrome = computed<PptxSmartArtChrome | undefined>(() => smartArtData.value?.chrome);

const model = computed<SmartArt3DModel | null>(() => {
	const data = smartArtData.value;
	if (!data || data.nodes.length === 0) {
		return null;
	}
	const layout = computeSmartArtElementLayout(
		data,
		data.nodes,
		{ width: props.element.width, height: props.element.height },
		palette.value,
		style.value,
		props.element.id,
	);
	return buildSmartArt3DModel(layout, {
		background: chrome.value?.backgroundColor,
		spatial: true,
		coherent3DOffNodeIds: collectCoherent3DOffNodeIds(data.nodes),
	});
});

const canvasRef = ref<HTMLCanvasElement | null>(null);
const containerRef = ref<HTMLElement | null>(null);
const editorEl = ref<HTMLTextAreaElement | null>(null);

/** Opt-in interactive WebGL scene; falls back to the SVG renderer when it cannot mount. */
const { useFallback } = useSmartArt3DScene({
	canvas: canvasRef,
	model: () => model.value,
	width: () => props.element.width,
	height: () => props.element.height,
	textStyle: toRef(props, 'textStyle'),
});

const containerStyle = computed<CSSProperties>(() =>
	getContainerStyle(props.element, props.zIndex),
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
		v-if="useFallback"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
		:text-style-override-css="textStyleOverrideCss"
	/>
	<div
		v-else
		ref="containerRef"
		class="pptx-vue-element pptx-vue-smartart-3d"
		:style="containerStyle"
		:data-element-id="element.id"
	>
		<canvas ref="canvasRef" class="pptx-vue-smartart-3d-canvas" />

		<template v-if="canEdit">
			<!-- Invisible SVG overlay: data-node-id groups are pointer-events hit targets -->
			<div class="pptx-vue-smartart-3d-hittest" @dblclick.stop="onOverlayDblClick">
				<SmartArtHitTestWrapper :element="element" :zIndex="0" />
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
.pptx-vue-smartart-3d-canvas {
	width: 100%;
	height: 100%;
	display: block;
}

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
