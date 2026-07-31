<script setup lang="ts">
/**
 * ViewerCanvasOverlays: everything painted OVER the slide inside the scaled
 * stage (grid, comment markers, guides, snap lines, marquee, ink capture, AI
 * rings, motion path, selection chrome, the inline text editor and the two
 * collaboration overlays).
 *
 * Rendered into `SlideCanvas`'s default slot, so every child here shares the
 * stage's CSS `transform`: they render RAW SLIDE-SPACE coordinates and must
 * never multiply by the zoom themselves. The ones that do take a `scale` need
 * it to size handles/strokes in screen pixels, not to position anything.
 *
 * Order is load-bearing: later siblings paint on top, and the selection chrome
 * has to sit above the content overlays but below the inline editor.
 */
import type { PptxComment, PptxElement, PptxSlide, TextStyle } from 'pptx-viewer-core';
import type { PptxAiConfig } from 'pptx-viewer-shared/ai';

import type { AiPanelController } from '../composables/ai/useAiPanelController';
import type { UseCollaborationWiringResult } from '../composables/useCollaborationWiring';
import type { UseElementDragResult } from '../composables/useElementDrag';
import type { UseInkDrawingResult } from '../composables/useInkDrawing';
import type { UseInlineEditingResult } from '../composables/useInlineEditing';
import type { UseInspectorWiringResult } from '../composables/useInspectorWiring';
import type { MarqueeRect } from '../composables/useMarqueeSelection';
import type { CanvasSize } from '../types';
import AiChangeOverlay from './ai/AiChangeOverlay.vue';
import AiFocusHighlightOverlay from './ai/AiFocusHighlightOverlay.vue';
import CanvasGuides from './CanvasGuides.vue';
import CollaborationCursors from './CollaborationCursors.vue';
import CommentMarkersOverlay from './CommentMarkersOverlay.vue';
import DrawingOverlay from './DrawingOverlay.vue';
import GridOverlay from './GridOverlay.vue';
import InlineTextEditor from './InlineTextEditor.vue';
import MarqueeOverlay from './MarqueeOverlay.vue';
import MotionPathOverlay from './MotionPathOverlay.vue';
import RemoteSelectionOverlay from './RemoteSelectionOverlay.vue';
import type { DrawingTool } from './ribbon/ribbon-types';
import SelectionOverlay from './SelectionOverlay.vue';
import SnapLinesOverlay from './SnapLinesOverlay.vue';

defineProps<{
	canEdit: boolean;
	/** True while the slideshow overlay is up: every editing affordance hides. */
	presenting: boolean;
	canvasSize: CanvasSize;
	/** `fitScale x userZoom`; only handle/stroke sizing may use it. */
	effectiveZoom: number;
	activeSlide: PptxSlide | undefined;
	activeSlideIndex: number;
	selectedElements: PptxElement[];
	selectedElementIds: string[];
	/** Rubber-band rectangle, or null when no band is being dragged. */
	marquee: MarqueeRect | null;
	activeComments: PptxComment[];
	onCommentMarkerClick: (id: string) => void;
	showGrid: boolean;
	/**
	 * View > Guides hides the OVERLAY only: the guides array itself is
	 * untouched, so snapping to a guide and the save round-trip still see every
	 * guide the deck carries.
	 */
	showGuides: boolean;
	drag: UseElementDragResult;
	inlineEdit: UseInlineEditingResult;
	inspector: UseInspectorWiringResult;
	collaboration: UseCollaborationWiringResult;
	spellCheckEnabled: boolean;
	/** Draw tab: pointer events are captured only while a tool is armed. */
	drawingActive: boolean;
	activeTool: DrawingTool;
	drawingColor: string;
	drawingWidth: number;
	onStroke: UseInkDrawingResult['addInkStroke'];
	onErase: UseInkDrawingResult['eraseInkAt'];
	/** AI assistant config; the focus/change overlays are gated behind it. */
	ai?: PptxAiConfig;
	aiPanel: AiPanelController;
	onRequestEdit: (id: string) => void;
	onFormat: (patch: Partial<TextStyle>) => void;
}>();
</script>

<template>
	<!-- Dot grid overlay (View > Grid): sits over content, under selection -->
	<GridOverlay :canvas-size="canvasSize" :visible="showGrid && !presenting" />

	<!-- Numbered comment markers (click to open the comments panel) -->
	<CommentMarkersOverlay
		v-if="canEdit && !presenting && activeComments.length > 0"
		:comments="activeComments"
		:canvas-size="canvasSize"
		@marker-click="onCommentMarkerClick"
	/>

	<!-- Draggable H/V alignment guides (View > Guides) -->
	<CanvasGuides
		v-if="canEdit && !presenting"
		:guides="showGuides ? drag.guides.value : []"
		:scale="effectiveZoom"
		@move="drag.onMoveGuide"
		@remove="drag.onRemoveGuide"
	/>

	<!-- Transient snap-to-shape alignment lines (during drag) -->
	<SnapLinesOverlay v-if="drag.snapLines.value.length > 0" :snap-lines="drag.snapLines.value" />

	<!-- Rubber-band selection rectangle (drag across empty canvas) -->
	<MarqueeOverlay :rect="marquee" />

	<!-- Ink capture (Draw tab) -->
	<DrawingOverlay
		v-if="canEdit"
		:canvas-size="canvasSize"
		:active="drawingActive"
		:tool="activeTool"
		:color="drawingColor"
		:width="drawingWidth"
		:scale="effectiveZoom"
		@stroke="onStroke"
		@erase="onErase"
	/>

	<!-- AI focus rings (picks + live-tool "AI is working here") -->
	<AiFocusHighlightOverlay
		v-if="ai && aiPanel.canvasHighlights.value.length > 0"
		:highlights="aiPanel.canvasHighlights.value"
		:elements="activeSlide?.elements ?? []"
		:active-slide-index="activeSlideIndex"
	/>

	<!-- AI change animation (watch the applied edit land on the canvas) -->
	<AiChangeOverlay
		v-if="ai && aiPanel.changeBatch.value"
		:batch="aiPanel.changeBatch.value"
		:active-slide-index="activeSlideIndex"
	/>

	<!-- Motion path (Animations tab): dashed route + draggable end point -->
	<MotionPathOverlay
		v-if="
			canEdit &&
			!presenting &&
			inspector.inspectorElement.value &&
			inspector.selectedMotionPath.value
		"
		:element="inspector.inspectorElement.value"
		:path="inspector.selectedMotionPath.value"
		:canvas-size="canvasSize"
		:scale="effectiveZoom"
		:can-edit="canEdit"
		@change-path="inspector.onMotionPathChange"
	/>

	<SelectionOverlay
		v-if="canEdit && !inlineEdit.inlineEditingElementId.value && !presenting"
		:elements="selectedElements"
		:selected-ids="selectedElementIds"
		:zoom="effectiveZoom"
		@transform-start="drag.onTransformStart"
		@transform="drag.onTransform"
		@transform-end="drag.onTransformEnd"
		@adjust-start="drag.onAdjustStart"
		@adjust="drag.onAdjust"
		@adjust-end="drag.onAdjustEnd"
		@request-edit="(p) => onRequestEdit(p.id)"
	/>

	<InlineTextEditor
		v-if="canEdit && inlineEdit.inlineEditingElement.value"
		:element="inlineEdit.inlineEditingElement.value"
		:spell-check="spellCheckEnabled"
		@change="inlineEdit.updateInlineText"
		@commit="inlineEdit.commitInlineEdit"
		@cancel="inlineEdit.cancelInlineEdit"
		@format="onFormat"
	/>

	<CollaborationCursors
		v-if="collaboration.collabActive.value"
		:cursors="collaboration.collab.cursors.value"
	/>
	<RemoteSelectionOverlay
		v-if="collaboration.collabActive.value"
		:presences="collaboration.collab.remotePresences.value"
		:elements="activeSlide?.elements ?? []"
		:active-slide-index="activeSlideIndex"
	/>
</template>
