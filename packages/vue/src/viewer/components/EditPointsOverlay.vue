<script setup lang="ts">
/**
 * EditPointsOverlay: PowerPoint's Edit Points mode for one shape. Vue port of
 * React's `canvas/EditPointsOverlay.tsx`, DOM contract included.
 *
 * Everything that decides behaviour lives in the shared `EditPointsSession`
 * (hit targets, drags, the vertex / segment menu, keyboard, the element patch):
 * this component only draws its view descriptor as SVG over the stage, in the
 * stage's unscaled slide-pixel space, and forwards pointer events to it.
 */
import type { PptxElement } from 'pptx-viewer-core';
import type { EditPointsCommandId, EditPointsElementPatch } from 'pptx-viewer-shared';
import {
	attachOverlayKeyboard,
	EDIT_POINTS_STYLE,
	EDIT_POINTS_TARGET_ATTR,
	EditPointsSession,
	overlayPointerInput,
} from 'pptx-viewer-shared';
import { computed, onBeforeUnmount, ref, shallowRef, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import type { CanvasSize } from '../types';
import EditPointsMenu from './EditPointsMenu.vue';

const props = defineProps<{
	element: PptxElement;
	canvasSize: CanvasSize;
	scale: number;
	hiddenCommands?: ReadonlySet<EditPointsCommandId>;
	onCommit: (elementId: string, patch: EditPointsElementPatch) => void;
	onExit: () => void;
}>();

const { t } = useI18n();
const svgRef = useTemplateRef<SVGSVGElement>('svg');
/** Bumped by the session's `onChange`, so the view recomputes. */
const version = ref(0);
const session = shallowRef<EditPointsSession | null>(null);
let detachKeyboard: (() => void) | null = null;

function createSession(element: PptxElement): void {
	detachKeyboard?.();
	const elementId = element.id;
	const next = new EditPointsSession(element, {
		onCommit: (patch) => props.onCommit(elementId, patch),
		onExit: () => props.onExit(),
		onChange: () => {
			version.value++;
		},
		hiddenCommands: props.hiddenCommands,
	});
	session.value = next;
	detachKeyboard = attachOverlayKeyboard(next);
}

// One session per shape: the element object changes on every commit, which
// the session absorbs through `reconcile`.
watch(
	() => props.element.id,
	() => createSession(props.element),
	{ immediate: true },
);
watch(
	() => props.element,
	(element) => {
		session.value?.reconcile(element);
	},
);
onBeforeUnmount(() => detachKeyboard?.());

const view = computed(() => {
	void version.value;
	return session.value?.view(props.scale) ?? null;
});

function input(event: PointerEvent | MouseEvent) {
	const svg = svgRef.value ?? (event.currentTarget as Element);
	return overlayPointerInput(event, svg, props.canvasSize.width, props.canvasSize.height);
}

function onPointerDown(event: PointerEvent): void {
	event.stopPropagation();
	if (event.button !== 0) {
		return;
	}
	event.preventDefault();
	(event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
	session.value?.pointerDown(input(event));
}
function onPointerMove(event: PointerEvent): void {
	session.value?.pointerMove(input(event));
}
function onPointerUp(event: PointerEvent): void {
	(event.currentTarget as Element | null)?.releasePointerCapture?.(event.pointerId);
	session.value?.pointerUp(input(event));
}
function onContextMenu(event: MouseEvent): void {
	event.preventDefault();
	event.stopPropagation();
	session.value?.contextMenu(input(event));
}
function onRun(id: EditPointsCommandId): void {
	session.value?.runCommand(id);
}
const target = (id: string): Record<string, string> => ({ [EDIT_POINTS_TARGET_ATTR]: id });
const S = EDIT_POINTS_STYLE;
</script>

<template>
	<svg
		v-if="view"
		ref="svg"
		class="absolute left-0 top-0 z-[60]"
		:width="canvasSize.width"
		:height="canvasSize.height"
		role="application"
		:aria-label="t('pptx.editPoints.overlay')"
		data-pptx-edit-points-overlay="true"
		:data-pptx-edit-points-element="element.id"
		style="touch-action: none"
		@pointerdown="onPointerDown"
		@pointermove="onPointerMove"
		@pointerup="onPointerUp"
		@contextmenu="onContextMenu"
		@mousedown.stop
		@click.stop
		@dblclick.stop
	>
		<rect :width="canvasSize.width" :height="canvasSize.height" fill="transparent" />
		<path
			v-for="seg in view.segments"
			:key="seg.target"
			:d="seg.d"
			fill="none"
			stroke="transparent"
			:stroke-width="view.hitStrokeWidth"
			pointer-events="stroke"
			style="cursor: copy"
			v-bind="target(seg.target)"
		/>
		<path
			:d="view.outlineD"
			fill="none"
			:stroke="S.outlineColor"
			:stroke-width="view.outlineWidth"
			pointer-events="none"
		/>
		<g v-for="h in view.handles" :key="h.target">
			<line
				:x1="h.anchorX"
				:y1="h.anchorY"
				:x2="h.x"
				:y2="h.y"
				:stroke="S.handleLineColor"
				:stroke-width="view.outlineWidth"
				pointer-events="none"
			/>
			<rect
				:x="h.x - h.size / 2"
				:y="h.y - h.size / 2"
				:width="h.size"
				:height="h.size"
				:fill="S.handleFill"
				:stroke="S.handleStroke"
				:stroke-width="view.outlineWidth"
				style="cursor: move"
				v-bind="target(h.target)"
			/>
		</g>
		<rect
			v-for="n in view.nodes"
			:key="n.target"
			:x="n.x - n.size / 2"
			:y="n.y - n.size / 2"
			:width="n.size"
			:height="n.size"
			:fill="n.selected ? S.selectedNodeFill : S.nodeFill"
			:stroke="n.selected ? S.selectedNodeStroke : S.nodeStroke"
			:stroke-width="view.outlineWidth"
			style="cursor: move"
			:data-pptx-edit-points-node-type="n.type"
			:data-selected="n.selected ? 'true' : undefined"
			v-bind="target(n.target)"
		/>
	</svg>
	<EditPointsMenu v-if="view?.menu" :menu="view.menu" @run="onRun" />
</template>
