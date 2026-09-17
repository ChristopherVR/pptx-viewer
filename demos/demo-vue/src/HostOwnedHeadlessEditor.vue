<script setup lang="ts">
import {
	CollaborationCursors,
	InlineTextEditor,
	RemoteSelectionOverlay,
	SelectionOverlay,
	SlideCanvas,
	useCollaboration,
	useEditorHistory,
	useEditorOperations,
	useElementDrag,
	useInlineEditing,
	useLoadContent,
} from 'pptx-vue-viewer/viewer';
import type {
	CollaborationShellState,
	UseCollaborationResult,
	UseInlineEditingResult,
} from 'pptx-vue-viewer/viewer';
import { computed, onBeforeUnmount, ref, watch } from 'vue';

import type { HostOwnedDemo } from '../../shared/host-owned-collaboration';

const props = defineProps<{ host: HostOwnedDemo }>();
const root = ref<HTMLElement>();
const canvas = ref<InstanceType<typeof SlideCanvas>>();
const scale = ref(1);
const current = ref(0);
const loadVersion = ref(0);
const content = useLoadContent(() => props.host.source, {
	getPendingInlineEdit: () => {
		if (!shellState.value.canEdit) {
			return undefined;
		}
		const snapshot = edit.readInlineSnapshot();
		return snapshot && ops.activeSlide.value
			? { snapshot, target: { slideId: ops.activeSlide.value.id } }
			: undefined;
	},
	onContentApplied: () => {
		loadVersion.value++;
	},
});
const { slides, canvasSize, mediaDataUrls, templateElementsBySlideId } = content;
const history = useEditorHistory(slides);
const ops = useEditorOperations({
	slides,
	activeSlideIndex: current,
	pushHistory: history.pushHistory,
	templateElementsBySlideId,
});
const collaboration: UseCollaborationResult = useCollaboration({
	slides,
	collaboration: () => props.host.config,
	canEdit: () => props.host.editable,
	sourcePending: content.loading,
	sourceError: () => Boolean(content.error.value || content.isEncrypted.value),
	onRemoteSlides: (next) => {
		slides.value = next;
	},
	loadVersion,
	getLoadOrigin: () => 'bootstrap',
	canvasWidth: computed(() => canvasSize.value.width),
	canvasHeight: computed(() => canvasSize.value.height),
	serialize: () => content.getContent(),
});
const { shellState, remotePresences, cursors } = collaboration;
const edit: UseInlineEditingResult = useInlineEditing({
	canEdit: () => shellState.value.canEdit,
	findActiveElement: (id) => ops.activeSlide.value?.elements.find((element) => element.id === id),
	ops,
	livePatcher: () => collaboration.livePatcher,
	activeSlide: () => ops.activeSlide.value,
});
const { inlineEditingElement, inlineEditingElementId } = edit;
const drag = useElementDrag({
	findActiveElement: (id) => ops.activeSlide.value?.elements.find((element) => element.id === id),
	pushHistory: history.pushHistory,
	effectiveZoom: computed(() => scale.value),
	activeTemplateElements: computed(
		() => templateElementsBySlideId.value[ops.activeSlide.value?.id ?? ''] ?? [],
	),
	activeSlide: ops.activeSlide,
	activeSlideIndex: current,
	slides,
	templateElementsBySlideId,
	canvasSize,
	enterInlineEdit: (id) => {
		if (shellState.value.canEdit) {
			edit.enterInlineEdit(id);
		}
	},
});
onBeforeUnmount(() => drag.cancelElementDrag());
watch(
	() => shellState.value.canEdit,
	(allowed) => {
		// Retire the accepted local draft before its static render replaces the DOM.
		if (!allowed) {
			drag.cancelElementDrag();
			edit.commitInlineEdit();
		}
	},
	{ flush: 'sync' },
);
watch(current, (index) => {
	edit.commitInlineEdit();
	collaboration.setActiveSlide(index);
});
watch(ops.selectedElementIds, (ids) => collaboration.setSelection(ids));
const activeSlide = ops.activeSlide;
const statusText = computed(() => {
	const state: CollaborationShellState = shellState.value;
	return `${state.status} · ${state.connectedCount} connected · ${state.canEdit ? 'Editable' : 'Read only'}`;
});

function pick(event: MouseEvent): string | undefined {
	return (
		(event.target as HTMLElement).closest('[data-element-id]')?.getAttribute('data-element-id') ??
		undefined
	);
}
function select(event: PointerEvent): void {
	if (!shellState.value.canEdit || (event.target as HTMLElement).closest('[data-inline-editor]')) {
		return;
	}
	edit.commitInlineEdit();
	const id = pick(event);
	ops.selectedElementIds.value = id ? [id] : [];
	root.value?.focus();
	if (id) {
		event.preventDefault();
		drag.startElementDrag(id, event, false);
	}
}
function openText(event: MouseEvent): void {
	const id = pick(event);
	if (id && shellState.value.canEdit) {
		edit.enterInlineEdit(id);
	}
}
function moveCursor(event: PointerEvent): void {
	const stage = canvas.value?.getStageElement();
	if (!stage) {
		return;
	}
	const rect = stage.getBoundingClientRect();
	collaboration.setCursor(
		(event.clientX - rect.left) / scale.value,
		(event.clientY - rect.top) / scale.value,
	);
}
function onKeydown(event: KeyboardEvent): void {
	if (!shellState.value.canEdit || inlineEditingElementId.value) {
		return;
	}
	const element = activeSlide.value?.elements.find(
		(item) => item.id === ops.selectedElementIds.value[0],
	);
	if (!element || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
		return;
	}
	event.preventDefault();
	ops.moveElement(element.id, {
		x: element.x + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0),
		y: element.y + (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0),
	});
}
defineExpose({
	getContent: async () => {
		edit.commitInlineEdit();
		return content.getContent();
	},
	setScale: (next: number) => {
		scale.value = next;
	},
});
</script>

<template>
	<div ref="root" data-host-custom-shell="vue" class="shell" tabindex="0" @keydown="onKeydown">
		<nav aria-label="Custom slide navigation">
			<button v-for="(_, index) in slides" :key="index" @click="current = index">
				Slide {{ index + 1 }}
			</button>
			<output aria-label="Collaboration status">{{ statusText }}</output>
		</nav>
		<p v-if="content.error.value" role="alert">{{ content.error.value }}</p>
		<SlideCanvas
			ref="canvas"
			:slide="activeSlide"
			:canvas-size="canvasSize"
			:media-data-urls="mediaDataUrls"
			:zoom="scale"
			:template-elements="activeSlide ? templateElementsBySlideId[activeSlide.id] : []"
			:inline-editing-element-id="inlineEditingElementId"
			@pointerdown="select"
			@pointermove="moveCursor"
			@dblclick="openText"
		>
			<SelectionOverlay
				v-if="shellState.canEdit && !inlineEditingElement"
				:elements="activeSlide?.elements ?? []"
				:selected-ids="ops.selectedElementIds.value"
				:zoom="scale"
				@transform-start="drag.onTransformStart"
				@transform="drag.onTransform"
				@transform-end="drag.onTransformEnd"
				@adjust-start="drag.onAdjustStart"
				@adjust="drag.onAdjust"
				@adjust-end="drag.onAdjustEnd"
				@request-edit="({ id }) => edit.enterInlineEdit(id)"
			/>
			<InlineTextEditor
				v-if="shellState.canEdit && inlineEditingElement"
				:key="inlineEditingElement.id"
				:element="inlineEditingElement"
				@change="edit.updateInlineText"
				@commit="edit.commitInlineEdit"
				@cancel="edit.cancelInlineEdit"
				@list-session="edit.onListSession"
			/>
			<RemoteSelectionOverlay
				:presences="remotePresences"
				:elements="activeSlide?.elements ?? []"
				:active-slide-index="current"
			/>
			<CollaborationCursors :cursors="cursors" />
		</SlideCanvas>
	</div>
</template>

<style scoped>
.shell {
	height: 100%;
	display: flex;
	flex-direction: column;
	background: #e2e8f0;
	color: #0f172a;
}
nav {
	display: flex;
	gap: 8px;
	padding: 8px;
}
</style>
