<script setup lang="ts">
/**
 * PowerPointViewer: Vue port of the React `PowerPointViewer.tsx`.
 *
 * Top-level orchestrator that loads `.pptx` bytes and renders the slides with
 * navigation and zoom. This is the viewer-first milestone of the port: the
 * React component additionally composes a full editor (toolbar, inspector
 * panels, dialogs, presentation mode, collaboration, export). The roadmap and
 * per-area status live in `packages/vue/PORTING.md`.
 *
 * Conventions vs. React:
 *  - `forwardRef` handle  → `defineExpose` ({@link PowerPointViewerExpose}).
 *  - function-prop callbacks → emits ({@link PowerPointViewerEmits}).
 *  - `theme` context      → `provideViewerTheme` + `useThemeStyle`.
 */
import {
	applyThemeToData,
	cloneElement,
	createEditorId,
	createGroupElement,
	createShapeElement,
	createTextElement,
	hasTextProperties,
} from 'pptx-viewer-core';
import type {
	MasterViewTab,
	PptxAnimationPreset,
	PptxData,
	PptxElement,
	PptxElementAnimation,
	PptxHeaderFooter,
	PptxSaveFormat,
	PptxSlide,
	PptxSlideTransition,
	PptxThemeColorScheme,
	PptxThemeFontScheme,
	PptxThemePreset,
	TextStyle,
} from 'pptx-viewer-core';
import type { AlignEdge } from 'pptx-viewer-shared';
import { alignElements, applyDragDelta, openPptxFile } from 'pptx-viewer-shared';
import { computed, nextTick, provide, ref, toRef, watch } from 'vue';

import { provideViewerTheme, useThemeStyle } from '../theme';
import AccessibilityPanel from './components/AccessibilityPanel.vue';
import BroadcastDialog from './components/BroadcastDialog.vue';
import CanvasGuides from './components/CanvasGuides.vue';
import CollaborationCursors from './components/CollaborationCursors.vue';
import CollaborationStatusIndicator from './components/CollaborationStatusIndicator.vue';
import CommentsPanel from './components/CommentsPanel.vue';
import ComparePanel from './components/ComparePanel.vue';
import ContextMenu from './components/ContextMenu.vue';
import type { ContextMenuItem } from './components/ContextMenu.vue';
import CustomShowsPanel from './components/CustomShowsPanel.vue';
import DocumentPropertiesDialog from './components/DocumentPropertiesDialog.vue';
import type { DocumentPropertiesSavePatch } from './components/DocumentPropertiesDialog.vue';
import DrawingOverlay from './components/DrawingOverlay.vue';
import type { ShapePreset } from './components/EditorToolbar.vue';
import EquationEditorDialog from './components/EquationEditorDialog.vue';
import FindReplaceBar from './components/FindReplaceBar.vue';
import FollowModeBar from './components/FollowModeBar.vue';
import GridOverlay from './components/GridOverlay.vue';
import HeaderFooterPanel from './components/HeaderFooterPanel.vue';
import HyperlinkDialog from './components/HyperlinkDialog.vue';
import InlineTextEditor from './components/InlineTextEditor.vue';
import InsertSmartArtDialog from './components/InsertSmartArtDialog.vue';
import InspectorPane from './components/inspector/InspectorPane.vue';
import SlideInspector from './components/inspector/SlideInspector.vue';
import ThemeEditorPanel from './components/inspector/ThemeEditorPanel.vue';
import MasterViewSidebar from './components/MasterViewSidebar.vue';
import MobileBottomBar from './components/MobileBottomBar.vue';
import MobileSheet from './components/MobileSheet.vue';
import ModalDialog from './components/ModalDialog.vue';
import NotesPanel from './components/NotesPanel.vue';
import PresentationMode from './components/PresentationMode.vue';
import PrintDialog from './components/PrintDialog.vue';
import RemoteSelectionOverlay from './components/RemoteSelectionOverlay.vue';
import type {
	DrawingTool,
	RibbonProps,
	SupportedShapeType,
	ToolbarSection,
	ViewerMode,
} from './components/ribbon/ribbon-types';
import RibbonToolbar from './components/ribbon/RibbonToolbar.vue';
import SectionList from './components/SectionList.vue';
import SelectionOverlay from './components/SelectionOverlay.vue';
import SettingsDialog from './components/SettingsDialog.vue';
import ShareDialog from './components/ShareDialog.vue';
import ShortcutPanel from './components/ShortcutPanel.vue';
import SignaturesPanel from './components/SignaturesPanel.vue';
import SlideCanvas from './components/SlideCanvas.vue';
import SlideSorter from './components/SlideSorter.vue';
import SlidesPaneSidebar from './components/SlidesPaneSidebar.vue';
import SlideStage from './components/SlideStage.vue';
import SnapLinesOverlay from './components/SnapLinesOverlay.vue';
import StatusBar from './components/StatusBar.vue';
import ThemeGallery from './components/ThemeGallery.vue';
import VersionHistoryPanel from './components/VersionHistoryPanel.vue';
import { DEFAULT_VIEWER_SETTINGS } from './components/viewer-settings';
import type { ViewerSettings } from './components/viewer-settings';
import { buildActionButtonElement } from './composables/action-buttons';
import { applyAnimationPreset, removeElementAnimation } from './composables/element-animation';
import type { AnimationGroup } from './composables/element-animation';
import {
	applyFormatToElement,
	copyFormatFromElement,
	hasCopyableFormat,
} from './composables/format-painter';
import type { CopiedFormat } from './composables/format-painter';
import { createGuide, moveGuide, removeGuide } from './composables/guides';
import type { Guide } from './composables/guides';
import { remapTextToSegments } from './composables/remap-text';
import { compareSlides } from './composables/slide-compare';
import type { CompareResult } from './composables/slide-compare';
import { snapBox } from './composables/snap';
import { computeSnapToShape } from './composables/snap-shape';
import { TableThemeKey } from './composables/table-theme';
import { useAccessibility } from './composables/useAccessibility';
import { useAutosave } from './composables/useAutosave';
import { useCollaboration } from './composables/useCollaboration';
import { useComments } from './composables/useComments';
import { useCustomShows } from './composables/useCustomShows';
import { useEditorHistory } from './composables/useEditorHistory';
import { useEditorOperations } from './composables/useEditorOperations';
import { useEmbeddedFonts } from './composables/useEmbeddedFonts';
import { useExport } from './composables/useExport';
import { useFindReplace } from './composables/useFindReplace';
import { useIsMobile } from './composables/useIsMobile';
import { useKeyboardShortcuts } from './composables/useKeyboardShortcuts';
import { useLoadContent } from './composables/useLoadContent';
import { useMediaExport } from './composables/useMediaExport';
import { usePrint } from './composables/usePrint';
import { useSectionOperations } from './composables/useSectionOperations';
import { useSignatures } from './composables/useSignatures';
import { useSlideOperations } from './composables/useSlideOperations';
import { useVersionHistory } from './composables/useVersionHistory';
import type {
	CollaborationConfig,
	PowerPointViewerEmits,
	PowerPointViewerExpose,
	PowerPointViewerProps,
} from './types';

/** Geometry patch emitted by the selection overlay during a drag/resize/rotate. */
interface TransformPayload {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
}

const props = withDefaults(defineProps<PowerPointViewerProps>(), {
	canEdit: false,
});
const emit = defineEmits<PowerPointViewerEmits>();

// ── Theme ─────────────────────────────────────────────────────────────
const theme = toRef(props, 'theme');
provideViewerTheme(theme);
const themeStyle = useThemeStyle(theme);

// ── Load + parse content ──────────────────────────────────────────────
// `internalContent` lets the built-in File ▸ Open picker swap the deck in place
// without a host round-trip. It is cleared whenever the host supplies a fresh
// `content` prop so external reloads always win.
const internalContent = ref<Uint8Array | ArrayBuffer | null>(null);
watch(
	() => props.content,
	() => {
		internalContent.value = null;
	},
);
const activeContent = computed(() => internalContent.value ?? props.content);

// File ▸ Open: host override (`onOpenFile` prop) takes precedence; otherwise a
// built-in native picker loads the chosen presentation in place.
function handleOpenFile(): void {
	if (props.onOpenFile) {
		props.onOpenFile();
		return;
	}
	void (async () => {
		const picked = await openPptxFile();
		if (picked) {
			internalContent.value = new Uint8Array(picked.buffer);
		}
	})();
}

const {
	slides,
	canvasSize,
	mediaDataUrls,
	loading,
	error,
	isEncrypted,
	coreProperties,
	customProperties,
	appProperties,
	embeddedFonts,
	signatures,
	tableStyleMap,
	slideMasters,
	layoutOptions,
	sections,
	customShows,
	headerFooter,
	notesMaster,
	handoutMaster,
	theme: pptxTheme,
	themeColorMap,
	handler,
	getContent,
	saveAs,
} = useLoadContent(() => activeContent.value);

// Expose the presentation colour scheme + parsed table-style map to table
// cells (banded/header colour resolution by table-style GUID) via
// provide/inject, avoiding theme prop-threading through the hot
// SlideStage → ElementRenderer chain.
provide(TableThemeKey, () => ({
	colorScheme: pptxTheme.value?.colorScheme,
	tableStyleMap: tableStyleMap.value,
}));

// Inject embedded fonts as @font-face (side effect; auto-cleaned on unmount).
useEmbeddedFonts(embeddedFonts);

// ── Navigation ────────────────────────────────────────────────────────
const activeSlideIndex = ref(0);
const slideCount = computed(() => slides.value.length);
const activeSlide = computed(() => slides.value[activeSlideIndex.value]);

// Reset view state only when a NEW document is loaded, keyed off the `content`
// input, not `slides`. Editing reassigns `slides.value` (so watching it here
// would wrongly clear the selection + undo history on every edit); the input
// changes only on a real load.
watch(activeContent, () => {
	activeSlideIndex.value = 0;
	selectedElementIds.value = [];
	history.clearHistory();
});
watch(activeSlideIndex, (index) => {
	emit('active-slide-change', index);
	selectedElementIds.value = [];
});

function goTo(index: number): void {
	if (index < 0 || index >= slideCount.value) {
		return;
	}
	activeSlideIndex.value = index;
}
const goPrev = () => goTo(activeSlideIndex.value - 1);
const goNext = () => goTo(activeSlideIndex.value + 1);

// ── Touch swipe navigation (view mode only) ───────────────────────────
// On touch devices a horizontal swipe across the slide area changes slides.
// In edit mode the same gesture must drive element drag/resize, so swipe
// navigation is disabled while `canEdit` so it never hijacks an edit gesture.
const SWIPE_THRESHOLD = 50;
const touchStart = ref<{ x: number; y: number } | null>(null);

function onMainTouchStart(event: TouchEvent): void {
	if (props.canEdit) {
		touchStart.value = null;
		return;
	}
	const touch = event.changedTouches[0];
	touchStart.value = touch ? { x: touch.clientX, y: touch.clientY } : null;
}

function onMainTouchEnd(event: TouchEvent): void {
	const start = touchStart.value;
	touchStart.value = null;
	if (!start) {
		return;
	}
	const touch = event.changedTouches[0];
	if (!touch) {
		return;
	}
	const dx = touch.clientX - start.x;
	const dy = touch.clientY - start.y;
	// Require a predominantly-horizontal gesture past the threshold.
	if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) {
		return;
	}
	if (dx < 0) {
		goNext();
	} else {
		goPrev();
	}
}

// ── Zoom ──────────────────────────────────────────────────────────────
const zoom = ref(1);
const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 3;
const zoomIn = () => {
	zoom.value = Math.min(ZOOM_MAX, Number((zoom.value + ZOOM_STEP).toFixed(2)));
};
const zoomOut = () => {
	zoom.value = Math.max(ZOOM_MIN, Number((zoom.value - ZOOM_STEP).toFixed(2)));
};
const zoomReset = () => {
	zoom.value = 1;
};
const zoomPercent = computed(() => Math.round(zoom.value * 100));

// Fit-to-viewport scale (≤ 1) reported by SlideCanvas's ResizeObserver, so the
// whole slide is visible by default instead of overflowing small/mobile
// viewports. Folded into the effective scale as `fitScale × userZoom`, matching
// the React and Angular viewers (where "100%" means "fit to viewport").
const fitScale = ref(1);
// Effective on-screen scale = fit-to-viewport × the user's zoom. All scaled
// rendering and pointer→slide coordinate math must use `effectiveZoom`.
const effectiveZoom = computed(() => fitScale.value * zoom.value);

// ── Thumbnail previews ────────────────────────────────────────────────
const THUMB_WIDTH = 104; // px - matches the thumbnail rail content width

// ── Editing: selection, history, operations ───────────────────────────
// Composed unconditionally (cheap); the toolbar/overlay/handlers only act when
// `props.canEdit` is true. `slides` is the writable `ShallowRef` from
// `useLoadContent`, and `getContent` serialises it, so edits flow to export.
const selectedElementIds = ref<string[]>([]);
const history = useEditorHistory(slides);
const ops = useEditorOperations({
	slides,
	activeSlideIndex,
	pushHistory: history.pushHistory,
	selectedElementIds,
});
const hasSelection = computed(() => selectedElementIds.value.length > 0);
const selectedElements = computed<PptxElement[]>(() => {
	const elements = activeSlide.value?.elements ?? [];
	const ids = new Set(selectedElementIds.value);
	return elements.filter((el) => ids.has(el.id));
});

function selectElement(id: string, additive: boolean): void {
	if (additive) {
		selectedElementIds.value = selectedElementIds.value.includes(id)
			? selectedElementIds.value.filter((x) => x !== id)
			: [...selectedElementIds.value, id];
	} else {
		selectedElementIds.value = [id];
	}
}
function clearSelection(): void {
	selectedElementIds.value = [];
}

// ── Format painter ────────────────────────────────────────────────────
// Arm by copying the selected element's format; the next element click applies
// it. Escape or an empty-canvas click cancels (mirrors React's painter).
const formatPainterActive = ref(false);
const copiedFormat = ref<CopiedFormat | null>(null);
const canActivateFormatPainter = computed(
	() => selectedElements.value.length === 1 && hasCopyableFormat(selectedElements.value[0]),
);
function toggleFormatPainter(): void {
	if (formatPainterActive.value) {
		cancelFormatPainter();
		return;
	}
	const source = selectedElements.value[0];
	if (!source || !hasCopyableFormat(source)) {
		return;
	}
	copiedFormat.value = copyFormatFromElement(source);
	formatPainterActive.value = true;
}
function cancelFormatPainter(): void {
	formatPainterActive.value = false;
	copiedFormat.value = null;
}
/** Escape: disarm the painter first, otherwise clear the selection. */
function onEscape(): void {
	if (inlineEditingElementId.value) {
		cancelInlineEdit();
		return;
	}
	if (formatPainterActive.value) {
		cancelFormatPainter();
		return;
	}
	clearSelection();
}

// ── Inline text editing ───────────────────────────────────────────────
// Entered by tapping an already-selected element (SelectionOverlay emits
// `requestEdit`). Commits on blur, on selecting another element, or on an
// empty-canvas tap; the typed text is remapped back onto the rich segments.
const inlineEditingElementId = ref<string | null>(null);
const inlineEditingText = ref('');
const inlineEditingElement = computed<PptxElement | undefined>(() =>
	inlineEditingElementId.value
		? activeSlide.value?.elements.find((e) => e.id === inlineEditingElementId.value)
		: undefined,
);
function enterInlineEdit(id: string): void {
	const el = activeSlide.value?.elements.find((e) => e.id === id);
	if (!el) {
		return;
	}
	inlineEditingElementId.value = id;
	inlineEditingText.value = (el as { text?: string }).text ?? '';
}
function commitInlineEdit(): void {
	const id = inlineEditingElementId.value;
	if (!id) {
		return;
	}
	const el = activeSlide.value?.elements.find((e) => e.id === id) as
		| (PptxElement & { textSegments?: unknown; textStyle?: unknown })
		| undefined;
	const text = inlineEditingText.value;
	inlineEditingElementId.value = null;
	if (el) {
		const segments = remapTextToSegments(
			text,
			(el.textSegments as Parameters<typeof remapTextToSegments>[1]) ?? undefined,
			(el.textStyle as Parameters<typeof remapTextToSegments>[2]) ?? undefined,
		);
		ops.updateElement(id, { text, textSegments: segments } as Partial<PptxElement>);
	}
}
function cancelInlineEdit(): void {
	inlineEditingElementId.value = null;
}
/** Apply the copied format to a target element (shape/text style only). */
function applyFormatToTarget(id: string): void {
	const format = copiedFormat.value;
	const target = activeSlide.value?.elements.find((e) => e.id === id);
	if (!format || !target) {
		return;
	}
	const updated = applyFormatToElement(target, format) as unknown as Record<string, unknown>;
	const patch: Record<string, unknown> = {};
	if (format.shapeStyle && updated.shapeStyle !== undefined) {
		patch.shapeStyle = updated.shapeStyle;
	}
	if (format.textStyle && updated.textStyle !== undefined) {
		patch.textStyle = updated.textStyle;
	}
	if (Object.keys(patch).length > 0) {
		ops.updateElement(id, patch as Partial<PptxElement>);
	}
}

/** Click-to-select via event delegation (elements render `data-element-id`). */
function onCanvasPointerDown(event: PointerEvent): void {
	if (!props.canEdit) {
		return;
	}
	const target = event.target as HTMLElement | null;
	const host = target?.closest('[data-element-id]') as HTMLElement | null;
	const id = host?.dataset.elementId;
	// While inline-editing, a tap elsewhere (another element or empty canvas)
	// commits the pending edit first (the typed text must be kept).
	if (inlineEditingElementId.value && id !== inlineEditingElementId.value) {
		commitInlineEdit();
	}
	// Format painter intercepts the next click: apply to a target element, then
	// disarm; an empty-canvas click just disarms.
	if (formatPainterActive.value) {
		if (id) {
			applyFormatToTarget(id);
		}
		cancelFormatPainter();
		return;
	}
	const additive = event.shiftKey || event.ctrlKey || event.metaKey;
	if (id) {
		const wasSelected =
			!additive && selectedElementIds.value.length === 1 && selectedElementIds.value[0] === id;
		if (!wasSelected) {
			selectElement(id, additive);
		}
		// Drive move (drag) + inline-edit entry from the element itself. A tap
		// without drag on an already-selected element enters inline edit.
		if (!additive) {
			startElementDrag(id, event, wasSelected);
		}
	} else {
		clearSelection();
	}
}

// ── Element drag-to-move + tap-to-edit (driven from the element) ──────
interface ElementDragState {
	id: string;
	startClientX: number;
	startClientY: number;
	startBox: { x: number; y: number; width: number; height: number; rotation: number };
	moved: boolean;
	wasSelected: boolean;
}
let elementDrag: ElementDragState | null = null;
function startElementDrag(id: string, event: PointerEvent, wasSelected: boolean): void {
	const el = activeSlide.value?.elements.find((e) => e.id === id);
	if (!el) {
		return;
	}
	elementDrag = {
		id,
		startClientX: event.clientX,
		startClientY: event.clientY,
		startBox: { x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation ?? 0 },
		moved: false,
		wasSelected,
	};
	window.addEventListener('pointermove', onElementDragMove);
	window.addEventListener('pointerup', onElementDragUp);
	window.addEventListener('pointercancel', onElementDragUp);
}
function onElementDragMove(event: PointerEvent): void {
	const drag = elementDrag;
	if (!drag) {
		return;
	}
	const dx = event.clientX - drag.startClientX;
	const dy = event.clientY - drag.startClientY;
	if (!drag.moved && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
		drag.moved = true;
		history.pushHistory();
	}
	if (!drag.moved) {
		return;
	}
	const box = applyDragDelta(drag.startBox, dx, dy, effectiveZoom.value);
	let nextX = box.x;
	let nextY = box.y;
	// Snap to other shapes' edges/centres (+ user guides), with visual snap lines.
	if (snapToShape.value && !box.rotation) {
		const siblings = (activeSlide.value?.elements ?? []).map((el) => ({
			id: el.id,
			x: el.x,
			y: el.y,
			width: el.width,
			height: el.height,
		}));
		const result = computeSnapToShape(
			box.x,
			box.y,
			box.width,
			box.height,
			siblings,
			new Set([drag.id]),
			guides.value,
		);
		nextX = result.x;
		nextY = result.y;
		snapLines.value = result.lines.map((line) => ({
			axis: line.axis === 'v' ? 'x' : 'y',
			position: line.position,
		}));
	} else if (snapLines.value.length > 0) {
		snapLines.value = [];
	}
	patchActiveElementGeometry({
		id: drag.id,
		x: nextX,
		y: nextY,
		width: box.width,
		height: box.height,
		rotation: box.rotation ?? 0,
	});
}
function onElementDragUp(): void {
	const drag = elementDrag;
	elementDrag = null;
	if (snapLines.value.length > 0) {
		snapLines.value = [];
	}
	window.removeEventListener('pointermove', onElementDragMove);
	window.removeEventListener('pointerup', onElementDragUp);
	window.removeEventListener('pointercancel', onElementDragUp);
	// A tap (no drag) on an already-selected element enters inline edit.
	if (drag && !drag.moved && drag.wasSelected) {
		enterInlineEdit(drag.id);
	}
}

/** Patch one element's geometry on the active slide WITHOUT a history entry. */
function patchActiveElementGeometry(payload: TransformPayload): void {
	const index = activeSlideIndex.value;
	const slide = slides.value[index];
	if (!slide) {
		return;
	}
	// Snap-to-grid (View tab): round position + size to the grid. Skipped while
	// rotating (rounding a rotated box's x/y fights the rotation).
	const useSnap = snapToGrid.value && !payload.rotation;
	const { x, y, width, height } = useSnap
		? snapBox(payload, GRID_SIZE)
		: { x: payload.x, y: payload.y, width: payload.width, height: payload.height };
	const nextElements = slide.elements.map((el) =>
		el.id === payload.id
			? {
					...el,
					x,
					y,
					width,
					height,
					rotation: payload.rotation,
				}
			: el,
	);
	const nextSlides = slides.value.slice();
	nextSlides[index] = { ...slide, elements: nextElements };
	slides.value = nextSlides;
}

// One history entry per gesture: snapshot on start, live-patch (no history)
// during the drag and on commit.
function onTransformStart(): void {
	history.pushHistory();
}
function onTransform(payload: TransformPayload): void {
	patchActiveElementGeometry(payload);
}
function onTransformEnd(payload: TransformPayload): void {
	patchActiveElementGeometry(payload);
}

/** Patch an element's round-rect corner-radius adjustment WITHOUT a history entry. */
function patchActiveElementAdjustment(id: string, value: number): void {
	const index = activeSlideIndex.value;
	const slide = slides.value[index];
	if (!slide) {
		return;
	}
	const nextElements = slide.elements.map((el) =>
		el.id === id
			? ({
					...el,
					shapeAdjustments: {
						...(el as { shapeAdjustments?: Record<string, number> }).shapeAdjustments,
						adj: value,
					},
				} as PptxElement)
			: el,
	);
	const nextSlides = slides.value.slice();
	nextSlides[index] = { ...slide, elements: nextElements };
	slides.value = nextSlides;
}
function onAdjustStart(): void {
	history.pushHistory();
}
function onAdjust(payload: { id: string; value: number }): void {
	patchActiveElementAdjustment(payload.id, payload.value);
}
function onAdjustEnd(payload: { id: string; value: number }): void {
	patchActiveElementAdjustment(payload.id, payload.value);
}

/** Centre a newly-created element (default box) on the slide. */
function centreNewElement(el: PptxElement, width: number, height: number): void {
	el.width = width;
	el.height = height;
	el.x = Math.max(0, Math.round((canvasSize.value.width - width) / 2));
	el.y = Math.max(0, Math.round((canvasSize.value.height - height) / 2));
}

function addText(): void {
	const el = createTextElement('Text');
	centreNewElement(el, 320, 80);
	ops.addElement(el);
	selectedElementIds.value = [el.id];
}
function addShape(preset: ShapePreset): void {
	const el = createShapeElement(preset);
	centreNewElement(el, 240, 160);
	ops.addElement(el);
	selectedElementIds.value = [el.id];
}

/** Insert a default 3×3 table, centred on the slide (mirrors React's handleAddTable). */
function addTable(): void {
	const rows = 3;
	const cols = 3;
	const el = {
		id: createEditorId('table'),
		type: 'table',
		x: 0,
		y: 0,
		width: 600,
		height: 250,
		tableData: {
			rows: Array.from({ length: rows }, () => ({
				cells: Array.from({ length: cols }, () => ({ text: '', style: {} })),
			})),
			columnWidths: Array.from({ length: cols }, () => 1 / cols),
		},
	} as unknown as PptxElement;
	centreNewElement(el, 600, 250);
	ops.addElement(el);
	selectedElementIds.value = [el.id];
}

// ── Image picker (Insert tab) ──
const imageInputRef = ref<HTMLInputElement | null>(null);
function openImagePicker(): void {
	imageInputRef.value?.click();
}
function onImageFileSelected(e: Event): void {
	const input = e.target as HTMLInputElement;
	const file = input.files?.[0];
	input.value = '';
	if (!file) {
		return;
	}
	const reader = new FileReader();
	reader.onload = () => {
		const dataUrl = typeof reader.result === 'string' ? reader.result : '';
		if (!dataUrl) {
			return;
		}
		// Size the picture to ~60% of the slide width, preserving aspect ratio.
		const probe = new Image();
		probe.onload = () => {
			const maxW = Math.round(canvasSize.value.width * 0.6);
			const ratio = probe.width / Math.max(1, probe.height);
			const width = Math.min(maxW, probe.width || maxW);
			const height = Math.max(1, Math.round(width / (ratio || 1)));
			const el = {
				id: createEditorId('image'),
				type: 'image',
				x: 0,
				y: 0,
				width,
				height,
				imageData: dataUrl,
			} as unknown as PptxElement;
			centreNewElement(el, width, height);
			ops.addElement(el);
			selectedElementIds.value = [el.id];
		};
		probe.src = dataUrl;
	};
	reader.readAsDataURL(file);
}

// ── Media picker (Insert tab): audio / video ──
const mediaInputRef = ref<HTMLInputElement | null>(null);
function openMediaPicker(): void {
	mediaInputRef.value?.click();
}
function onMediaFileSelected(e: Event): void {
	const input = e.target as HTMLInputElement;
	const file = input.files?.[0];
	input.value = '';
	if (!file) {
		return;
	}
	const mediaType: 'audio' | 'video' | null = file.type.startsWith('audio/')
		? 'audio'
		: file.type.startsWith('video/')
			? 'video'
			: null;
	if (!mediaType) {
		return;
	}
	const reader = new FileReader();
	reader.onload = () => {
		const dataUrl = typeof reader.result === 'string' ? reader.result : '';
		if (!dataUrl) {
			return;
		}
		const insert = (width: number, height: number): void => {
			const el = {
				id: createEditorId('media'),
				type: 'media',
				mediaType,
				mediaMimeType: file.type || undefined,
				mediaData: dataUrl,
				x: 0,
				y: 0,
				width,
				height,
			} as unknown as PptxElement;
			centreNewElement(el, width, height);
			ops.addElement(el);
			selectedElementIds.value = [el.id];
		};
		// Audio: fixed control-bar box. Video: probe intrinsic size, cap at 640×360.
		if (mediaType === 'audio') {
			insert(420, 64);
			return;
		}
		const probe = document.createElement('video');
		probe.preload = 'metadata';
		probe.onloadedmetadata = () => {
			const maxW = 640;
			const maxH = 360;
			let w = probe.videoWidth || maxW;
			let h = probe.videoHeight || maxH;
			if (w > maxW || h > maxH) {
				const scale = Math.min(maxW / w, maxH / h);
				w = Math.round(w * scale);
				h = Math.round(h * scale);
			}
			insert(w, h);
		};
		probe.onerror = () => insert(640, 360);
		probe.src = dataUrl;
	};
	reader.readAsDataURL(file);
}

/** Insert an OOXML action button (Insert ▸ Action), centred + selected. */
function addActionButton(shapeType: string): void {
	const el = buildActionButtonElement(shapeType, createEditorId('action'));
	if (!el) {
		return;
	}
	centreNewElement(el, 120, 50);
	ops.addElement(el);
	selectedElementIds.value = [el.id];
}

/**
 * Insert a new slide based on a chosen layout (New-Slide gallery). The draft
 * carries `layoutPath` so placeholders render immediately; the handler then
 * walks the layout XML to populate background/placeholders (mirrors React's
 * `handleInsertSlideFromLayout`).
 */
async function insertSlideFromLayout(layoutPath: string, layoutName?: string): Promise<void> {
	const insertAt = activeSlideIndex.value + 1;
	history.pushHistory();
	const draft = {
		id: createEditorId('slide'),
		rId: '',
		slideNumber: slides.value.length + 1,
		elements: [],
		layoutPath,
		...(layoutName ? { layoutName } : {}),
	} as unknown as PptxSlide;
	const next = slides.value.slice();
	next.splice(insertAt, 0, draft);
	slides.value = next;
	activeSlideIndex.value = insertAt;
	const h = handler.value;
	if (!h) {
		return;
	}
	// Returns the single updated slide (layout metadata/placeholders applied).
	const updated = await h.applyLayoutToSlide(insertAt, layoutPath, slides.value).catch(() => null);
	if (updated && updated.id === draft.id && slides.value[insertAt]?.id === draft.id) {
		const merged = slides.value.slice();
		merged[insertAt] = updated;
		slides.value = merged;
	}
}
function deleteSelected(): void {
	for (const id of [...selectedElementIds.value]) {
		ops.removeElement(id);
	}
	clearSelection();
}
function duplicateSelected(): void {
	const next: string[] = [];
	for (const id of [...selectedElementIds.value]) {
		const newId = ops.duplicateElement(id);
		if (newId) {
			next.push(newId);
		}
	}
	if (next.length > 0) {
		selectedElementIds.value = next;
	}
}
function bringForward(): void {
	for (const id of [...selectedElementIds.value]) {
		ops.bringForward(id);
	}
}

// Inspector targets a single selected element; multi-select hides it.
const inspectorElement = computed<PptxElement | undefined>(() =>
	selectedElements.value.length === 1 ? selectedElements.value[0] : undefined,
);
// Animations are stored on the slide (`slide.animations`, keyed by `elementId`),
// not on the element; surface this element's animations to the inspector by
// augmenting the element object the panels receive.
const inspectorElementForPanels = computed<PptxElement | undefined>(() => {
	const el = inspectorElement.value;
	if (!el) {
		return undefined;
	}
	const animations = (activeSlide.value?.animations ?? []).filter((a) => a.elementId === el.id);
	return { ...el, animations } as unknown as PptxElement;
});
function onInspectorUpdate(patch: Partial<PptxElement>): void {
	const el = inspectorElement.value;
	if (!el) {
		return;
	}
	// An `animations` patch belongs on the slide, not the element.
	if ('animations' in patch) {
		const { animations, ...rest } = patch as Partial<PptxElement> & {
			animations?: PptxSlide['animations'];
		};
		writeElementAnimations(el.id, animations ?? []);
		if (Object.keys(rest).length > 0) {
			ops.updateElement(el.id, rest);
		}
		return;
	}
	ops.updateElement(el.id, patch);
}
function writeElementAnimations(elementId: string, animations: PptxSlide['animations']): void {
	const index = activeSlideIndex.value;
	const slide = slides.value[index];
	if (!slide) {
		return;
	}
	history.pushHistory();
	const others = (slide.animations ?? []).filter((a) => a.elementId !== elementId);
	const nextSlides = slides.value.slice();
	nextSlides[index] = { ...slide, animations: [...others, ...(animations ?? [])] };
	slides.value = nextSlides;
}

// ── Slide operations (add / duplicate / delete / reorder) ─────────────
const slideOps = useSlideOperations({
	slides,
	activeSlideIndex,
	pushHistory: history.pushHistory,
});

// ── Clipboard (in-memory element copy/cut/paste) ──────────────────────
const clipboard = ref<PptxElement | null>(null);
const hasClipboard = computed(() => clipboard.value !== null);
function copyElement(id: string): void {
	const el = activeSlide.value?.elements.find((e) => e.id === id);
	if (el) {
		clipboard.value = cloneElement(el);
	}
}
function cutElement(id: string): void {
	copyElement(id);
	ops.removeElement(id);
	selectedElementIds.value = selectedElementIds.value.filter((x) => x !== id);
}
function pasteElement(): void {
	if (!clipboard.value) {
		return;
	}
	const copy = cloneElement(clipboard.value);
	copy.id = createEditorId('el');
	copy.x = (copy.x ?? 0) + 16;
	copy.y = (copy.y ?? 0) + 16;
	ops.addElement(copy);
	selectedElementIds.value = [copy.id];
}

// ── Presentation (slideshow) mode ─────────────────────────────────────
const presenting = ref(false);
function startPresenting(): void {
	presenting.value = true;
}
function onPresentClose(): void {
	presenting.value = false;
}
function onPresentSlideChange(index: number): void {
	activeSlideIndex.value = index;
}

// ── Element context menu ──────────────────────────────────────────────
const contextMenu = ref<{ open: boolean; x: number; y: number; elementId: string | null }>({
	open: false,
	x: 0,
	y: 0,
	elementId: null,
});
const contextItems = computed<ContextMenuItem[]>(() => [
	{ id: 'cut', label: 'Cut' },
	{ id: 'copy', label: 'Copy' },
	{ id: 'paste', label: 'Paste', disabled: !hasClipboard.value },
	{ id: 'sep1', label: '', separator: true },
	{ id: 'duplicate', label: 'Duplicate' },
	{ id: 'delete', label: 'Delete' },
	{ id: 'sep2', label: '', separator: true },
	{ id: 'bring-forward', label: 'Bring forward' },
	{ id: 'send-backward', label: 'Send backward' },
	{ id: 'sep3', label: '', separator: true },
	{ id: 'group', label: 'Group', disabled: !canGroup.value },
	{ id: 'ungroup', label: 'Ungroup', disabled: !canUngroup.value },
	{ id: 'sep4', label: '', separator: true },
	{ id: 'hyperlink', label: 'Hyperlink…' },
]);
function onCanvasContextMenu(event: MouseEvent): void {
	if (!props.canEdit) {
		return;
	}
	const host = (event.target as HTMLElement | null)?.closest(
		'[data-element-id]',
	) as HTMLElement | null;
	const id = host?.dataset.elementId;
	if (!id) {
		return;
	}
	event.preventDefault();
	if (!selectedElementIds.value.includes(id)) {
		selectedElementIds.value = [id];
	}
	contextMenu.value = { open: true, x: event.clientX, y: event.clientY, elementId: id };
}
function onContextSelect(actionId: string): void {
	const target = contextMenu.value.elementId;
	if (!target) {
		return;
	}
	switch (actionId) {
		case 'cut':
			cutElement(target);
			break;
		case 'copy':
			copyElement(target);
			break;
		case 'paste':
			pasteElement();
			break;
		case 'duplicate':
			ops.duplicateElement(target);
			break;
		case 'delete':
			ops.removeElement(target);
			selectedElementIds.value = selectedElementIds.value.filter((x) => x !== target);
			break;
		case 'bring-forward':
			ops.bringForward(target);
			break;
		case 'send-backward':
			ops.sendBackward(target);
			break;
		case 'group':
			onGroup();
			break;
		case 'ungroup':
			onUngroup();
			break;
		case 'hyperlink':
			openHyperlinkDialog(target);
			break;
	}
}

// ── Hyperlink dialog ──────────────────────────────────────────────────
const hyperlinkOpen = ref(false);
const hyperlinkTarget = ref<PptxElement | null>(null);
function openHyperlinkDialog(id: string): void {
	const el = activeSlide.value?.elements.find((e) => e.id === id);
	if (el) {
		hyperlinkTarget.value = el;
		hyperlinkOpen.value = true;
	}
}
function onHyperlinkSave(patch: Partial<PptxElement>): void {
	if (hyperlinkTarget.value) {
		ops.updateElement(hyperlinkTarget.value.id, patch);
	}
	hyperlinkOpen.value = false;
}

// ── Find & replace ────────────────────────────────────────────────────
const findOpen = ref(false);
const find = useFindReplace({
	slides,
	activeSlideIndex,
	pushHistory: history.pushHistory,
});

// ── Export (PNG / PDF) ────────────────────────────────────────────────
// An off-screen stage renders one slide at a time at scale 1; `rasterizeSlide`
// drives it and snapshots it with `html2canvas-pro`.
const exportStageRef = ref<HTMLElement | null>(null);
const exportIndex = ref(0);
const exportSlide = computed(() => slides.value[exportIndex.value]);

async function rasterizeSlide(index: number): Promise<HTMLCanvasElement> {
	exportIndex.value = index;
	await nextTick();
	await new Promise<void>((resolve) => {
		requestAnimationFrame(() => resolve());
	});
	const stageEl = exportStageRef.value?.querySelector('.pptx-vue-stage') as HTMLElement | null;
	if (!stageEl) {
		throw new Error('Export stage not ready');
	}
	const { default: html2canvas } = await import('html2canvas-pro');
	return html2canvas(stageEl, {
		backgroundColor: '#ffffff',
		scale: 2,
		width: canvasSize.value.width,
		height: canvasSize.value.height,
		logging: false,
	});
}

const exporter = useExport({ slides, canvasSize, rasterizeSlide });
const mediaExport = useMediaExport({ slideCount, rasterizeSlide });
const isExporting = computed(() => exporter.exporting.value || mediaExport.exporting.value);
function onExportPng(): void {
	void exporter.exportSlidePng(activeSlideIndex.value);
}
function onExportPdf(): void {
	void exporter.exportPdf();
}
function onExportGif(): void {
	void mediaExport.exportGif();
}
function onExportWebm(): void {
	void mediaExport.exportWebm();
}

/** Serialise to a chosen OpenXML format and trigger a browser download. */
async function downloadAs(format: PptxSaveFormat): Promise<void> {
	try {
		const bytes = await saveAs(format);
		const blob = new Blob([bytes as unknown as BlobPart], {
			type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		});
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = `presentation.${format}`;
		document.body.appendChild(anchor);
		anchor.click();
		anchor.remove();
		setTimeout(() => URL.revokeObjectURL(url), 200);
	} catch (err) {
		console.error(`[PowerPointViewer] Save as .${format} failed:`, err);
	}
}

/** Copy the active slide to the clipboard as a PNG image (File menu). */
async function onCopySlideAsImage(): Promise<void> {
	try {
		const canvas = await rasterizeSlide(activeSlideIndex.value);
		const blob = await new Promise<Blob | null>((resolve) => {
			canvas.toBlob((b) => resolve(b), 'image/png');
		});
		if (blob && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
			await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
		}
	} catch (err) {
		console.error('[PowerPointViewer] Copy slide as image failed:', err);
	}
}

// ── Print (dialog + rasterised print window) ──────────────────────────
// Reuses the same off-screen `rasterizeSlide` the export path drives.
const printer = usePrint({ slides, activeSlideIndex, rasterizeSlide });

// ── Slide sorter (grid overview + drag reorder) ───────────────────────
const showSorter = ref(false);
function onSorterSelect(index: number): void {
	goTo(index);
	showSorter.value = false;
}
function onSorterReorder(from: number, to: number): void {
	slideOps.moveSlide(from, to);
}

// ── Accessibility checker ─────────────────────────────────────────────
const showA11y = ref(false);
const a11y = useAccessibility(slides);

// ── Speaker notes ─────────────────────────────────────────────────────
function onNotesUpdate(notes: string): void {
	const index = activeSlideIndex.value;
	const slide = slides.value[index];
	if (!slide) {
		return;
	}
	history.pushHistory();
	const nextSlides = slides.value.slice();
	nextSlides[index] = { ...slide, notes };
	slides.value = nextSlides;
}

// ── Slide transition ──────────────────────────────────────────────────
/** Toggle the hidden flag on the slide at `index` (from the rail context menu). */
function toggleSlideHidden(index: number): void {
	const slide = slides.value[index];
	if (!slide) {
		return;
	}
	history.pushHistory();
	const nextSlides = slides.value.slice();
	nextSlides[index] = { ...slide, hidden: !slide.hidden };
	slides.value = nextSlides;
}

/** Apply a transition (or clear it) on the active slide, from the SlideInspector. */
function applySlideTransition(transition: PptxSlideTransition | undefined): void {
	const index = activeSlideIndex.value;
	const slide = slides.value[index];
	if (!slide) {
		return;
	}
	history.pushHistory();
	const nextSlides = slides.value.slice();
	nextSlides[index] = { ...slide, transition };
	slides.value = nextSlides;
}

/** Merge a partial transition patch into the active slide (Transitions ribbon). */
function onTransitionChange(updates: Partial<PptxSlideTransition>): void {
	const current = (activeSlide.value?.transition ?? {}) as PptxSlideTransition;
	applySlideTransition({ ...current, ...updates });
}

/** Copy the active slide's transition onto every slide (Apply To All). */
function onApplyTransitionToAll(): void {
	const transition = activeSlide.value?.transition;
	history.pushHistory();
	slides.value = slides.value.map((slide) => ({ ...slide, transition }));
}

/** Replace the active slide's animation list (history-aware). */
function writeActiveSlideAnimations(animations: PptxElementAnimation[]): void {
	const index = activeSlideIndex.value;
	const slide = slides.value[index];
	if (!slide) {
		return;
	}
	history.pushHistory();
	const nextSlides = slides.value.slice();
	nextSlides[index] = { ...slide, animations };
	slides.value = nextSlides;
}

/** Apply an entrance/emphasis/exit preset to the selected element (Animations tab). */
function onAddAnimation(preset: string, group: AnimationGroup): void {
	const el = selectedElements.value[0];
	const slide = activeSlide.value;
	if (!el || !slide) {
		return;
	}
	writeActiveSlideAnimations(
		applyAnimationPreset(slide.animations ?? [], el.id, group, preset as PptxAnimationPreset),
	);
}

/** Remove the selected element's animation entry (Animations tab). */
function onRemoveAnimation(): void {
	const el = selectedElements.value[0];
	const slide = activeSlide.value;
	if (!el || !slide) {
		return;
	}
	writeActiveSlideAnimations(removeElementAnimation(slide.animations ?? [], el.id));
}

// ── Align / group ─────────────────────────────────────────────────────
const canGroup = computed(() => selectedElements.value.length >= 2);
const canUngroup = computed(
	() => selectedElements.value.length === 1 && selectedElements.value[0]?.type === 'group',
);

/** Apply a {id → {x?,y?}} position map to the active slide as one history entry. */
function applyPositionMap(map: Map<string, { x?: number; y?: number }>): void {
	if (map.size === 0) {
		return;
	}
	const index = activeSlideIndex.value;
	const slide = slides.value[index];
	if (!slide) {
		return;
	}
	history.pushHistory();
	const nextElements = slide.elements.map((el) => {
		const pos = map.get(el.id);
		if (!pos) {
			return el;
		}
		return {
			...el,
			...(pos.x === undefined ? {} : { x: pos.x }),
			...(pos.y === undefined ? {} : { y: pos.y }),
		};
	});
	const nextSlides = slides.value.slice();
	nextSlides[index] = { ...slide, elements: nextElements };
	slides.value = nextSlides;
}
function onAlign(edge: AlignEdge): void {
	applyPositionMap(alignElements(selectedElements.value, edge));
}
function onGroup(): void {
	const sel = selectedElements.value;
	const index = activeSlideIndex.value;
	const slide = slides.value[index];
	if (sel.length < 2 || !slide) {
		return;
	}
	const minX = Math.min(...sel.map((e) => e.x));
	const minY = Math.min(...sel.map((e) => e.y));
	const maxX = Math.max(...sel.map((e) => e.x + e.width));
	const maxY = Math.max(...sel.map((e) => e.y + e.height));
	// Children store coordinates relative to the group's top-left.
	const children = sel.map((e) => ({ ...e, x: e.x - minX, y: e.y - minY }));
	const group = createGroupElement(children, {
		x: minX,
		y: minY,
		width: maxX - minX,
		height: maxY - minY,
	});
	history.pushHistory();
	const selIds = new Set(sel.map((e) => e.id));
	const nextSlides = slides.value.slice();
	nextSlides[index] = {
		...slide,
		elements: [...slide.elements.filter((e) => !selIds.has(e.id)), group],
	};
	slides.value = nextSlides;
	selectedElementIds.value = [group.id];
}
function onUngroup(): void {
	const g = selectedElements.value[0];
	const index = activeSlideIndex.value;
	const slide = slides.value[index];
	if (!g || g.type !== 'group' || !slide) {
		return;
	}
	// Re-absolutise children (inverse of the group-relative offset).
	const restored = (g.children ?? []).map((c) => ({ ...c, x: c.x + g.x, y: c.y + g.y }));
	history.pushHistory();
	const nextSlides = slides.value.slice();
	nextSlides[index] = {
		...slide,
		elements: slide.elements.flatMap((e) => (e.id === g.id ? restored : [e])),
	};
	slides.value = nextSlides;
	selectedElementIds.value = restored.map((c) => c.id);
}

// ── Autosave ──────────────────────────────────────────────────────────
const autosaveEnabled = computed(() => props.canEdit && (props.autosave ?? false));
const autosave = useAutosave({
	slides,
	enabled: autosaveEnabled,
	intervalMs: props.autosaveIntervalMs ?? 2000,
	onSave: async () => {
		const bytes = await getContent();
		emit('autosave', bytes);
		// Snapshot a restorable version on each autosave.
		versionHistory.capture('Autosave', Date.now());
	},
});

// ── Comments ──────────────────────────────────────────────────────────
const showComments = ref(false);
const activeComments = computed(() => activeSlide.value?.comments ?? []);
const authorNameRef = computed(() => props.authorName ?? 'You');
const commentsApi = useComments({
	comments: activeComments,
	activeSlideIndex,
	authorName: authorNameRef,
});
/** Commit a new comment array for the active slide (history-aware). */
function commitComments(next: ReturnType<typeof commentsApi.addComment>): void {
	if (!next) {
		return;
	}
	const index = activeSlideIndex.value;
	const slide = slides.value[index];
	if (!slide) {
		return;
	}
	history.pushHistory();
	const nextSlides = slides.value.slice();
	nextSlides[index] = { ...slide, comments: next };
	slides.value = nextSlides;
}

// ── Collaboration (Yjs) ───────────────────────────────────────────────
const collabCanvasWidth = computed(() => canvasSize.value.width);
const collabCanvasHeight = computed(() => canvasSize.value.height);
const collab = useCollaboration({
	slides,
	onRemoteSlides: (remote) => {
		slides.value = remote;
	},
	userColor: props.collaboration?.userColor,
	canvasWidth: collabCanvasWidth,
	canvasHeight: collabCanvasHeight,
});
const shareOpen = ref(false);
const collabActive = collab.active;

// Publish local selection + active slide to peers; follow a peer's active slide.
watch(selectedElementIds, (ids) => {
	if (collab.active.value) {
		collab.setSelection(ids);
	}
});
watch(activeSlideIndex, (index) => {
	if (collab.active.value) {
		collab.setActiveSlide(index);
	}
});
watch(collab.followedSlideIndex, (index) => {
	if (index !== null) {
		goTo(index);
	}
});
// Viewers in a one-way broadcast auto-follow the broadcaster's active slide.
watch(collab.broadcasterSlideIndex, (index) => {
	if (index !== null && collab.followedClientId.value === null) {
		goTo(index);
	}
});

function onShareStart(config: CollaborationConfig): void {
	// Two-way collaboration: peers edit together (default role).
	const collaboratorConfig: CollaborationConfig = { role: 'collaborator', ...config };
	void collab.start(collaboratorConfig);
	emit('start-collaboration', collaboratorConfig);
	shareOpen.value = false;
}
function onShareStop(): void {
	collab.stop();
	emit('stop-collaboration');
	shareOpen.value = false;
}
/** Publish the local cursor in slide coordinates while collaborating. */
function onCollabPointerMove(event: PointerEvent): void {
	if (!collab.active.value) {
		return;
	}
	const stage = (event.currentTarget as HTMLElement | null)?.querySelector('.pptx-vue-stage');
	if (!stage) {
		return;
	}
	const rect = stage.getBoundingClientRect();
	collab.setCursor(
		(event.clientX - rect.left) / effectiveZoom.value,
		(event.clientY - rect.top) / effectiveZoom.value,
	);
}

// ── Digital signatures ────────────────────────────────────────────────
const showSignatures = ref(false);
const signaturesApi = useSignatures(signatures);

// ── Broadcast ─────────────────────────────────────────────────────────
const broadcastOpen = ref(false);
const broadcastConfig = ref<{ roomId: string; serverUrl: string } | null>(null);
const broadcastViewerUrl = computed(() => {
	if (!broadcastConfig.value || typeof window === 'undefined') {
		return '';
	}
	const { roomId, serverUrl } = broadcastConfig.value;
	const base = `${window.location.origin}${window.location.pathname}`;
	return `${base}?broadcast=${encodeURIComponent(roomId)}&server=${encodeURIComponent(serverUrl)}`;
});
function onBroadcastStart(config: { roomId: string; serverUrl: string }): void {
	broadcastConfig.value = config;
	// One-way broadcast: the presenter owns navigation; viewers auto-follow via
	// `broadcasterSlideIndex`. The presenter joins with the `owner` role.
	const broadcastSession: CollaborationConfig = {
		...config,
		userName: props.authorName ?? 'Presenter',
		role: 'owner',
	};
	void collab.start(broadcastSession);
	emit('start-collaboration', broadcastSession);
	broadcastOpen.value = false;
}
function onBroadcastStop(): void {
	broadcastConfig.value = null;
	collab.stop();
	emit('stop-collaboration');
	broadcastOpen.value = false;
}

// ── Responsive / mobile chrome ────────────────────────────────────────
const { isMobile } = useIsMobile();
const mobileNotesOpen = ref(false);
/** Mobile-only bottom sheets for panels that are right-rail sidebars on desktop. */
const mobileInspectorOpen = ref(false);
const mobileCommentsOpen = ref(false);

/** Open one mobile sheet at a time so they don't stack over each other. */
function openMobileSheet(which: 'format' | 'comments' | 'notes'): void {
	mobileInspectorOpen.value = which === 'format';
	mobileCommentsOpen.value = which === 'comments';
	mobileNotesOpen.value = which === 'notes';
}
function present(): void {
	presenting.value = true;
}

// ── Document properties dialog ────────────────────────────────────────
const propertiesOpen = ref(false);
function onPropertiesSave(patch: DocumentPropertiesSavePatch): void {
	// Persist the edited core / custom / app properties; `getContent` forwards
	// all three to `handler.save`, so they round-trip into the saved `.pptx`.
	coreProperties.value = { ...coreProperties.value, ...patch.core };
	customProperties.value = patch.custom;
	if (patch.app) {
		appProperties.value = { ...appProperties.value, ...patch.app };
	}
	propertiesOpen.value = false;
}

// ── Master view (slide / notes / handout masters) ─────────────────────
const showMasterView = ref(false);
const masterViewTab = ref<MasterViewTab>('slides');
const activeMasterIndex = ref(0);
const activeLayoutIndex = ref<number | null>(null);
const handoutSlidesPerPage = ref(6);
function onSelectMaster(index: number): void {
	activeMasterIndex.value = index;
	activeLayoutIndex.value = null;
}
function onSelectLayout(masterIndex: number, layoutIndex: number): void {
	activeMasterIndex.value = masterIndex;
	activeLayoutIndex.value = layoutIndex;
}

// ── Header / footer dialog ────────────────────────────────────────────
const showHeaderFooter = ref(false);
function onHeaderFooterUpdate(next: PptxHeaderFooter): void {
	headerFooter.value = next;
	showHeaderFooter.value = false;
}

// ── Sections (group the slide rail) ───────────────────────────────────
const sectionOps = useSectionOperations({
	sections,
	slides,
	activeSlideIndex,
	pushHistory: history.pushHistory,
});
const hasSections = computed(() => sections.value.length > 0);

// ── Custom shows ──────────────────────────────────────────────────────
const showCustomShows = ref(false);
const activeCustomShowId = ref<string | null>(null);
const customShowOps = useCustomShows({
	customShows,
	slides,
	activeSlideIndex,
	pushHistory: history.pushHistory,
});
function onCreateCustomShow(name: string): void {
	activeCustomShowId.value = customShowOps.createCustomShow(name);
}
function onDeleteCustomShow(showId: string): void {
	customShowOps.deleteCustomShow(showId);
	if (activeCustomShowId.value === showId) {
		activeCustomShowId.value = null;
	}
}

/** The active slide's relationship id (custom shows reference slides by rId). */
const activeSlideRId = computed(() => (activeSlide.value as { rId?: string } | undefined)?.rId);
/** Whether the active slide is part of the active custom show (ribbon toggle state). */
const isCurrentSlideInActiveShow = computed(() => {
	const id = activeCustomShowId.value;
	const rId = activeSlideRId.value;
	if (id === null || rId === undefined) {
		return false;
	}
	return customShows.value.find((s) => s.id === id)?.slideRIds.includes(rId) ?? false;
});
/** Rename the active custom show (Slide Show ribbon). */
function onRenameActiveCustomShow(): void {
	const id = activeCustomShowId.value;
	if (id === null) {
		return;
	}
	const show = customShows.value.find((s) => s.id === id);
	const next = window.prompt('Rename custom show', show?.name ?? '')?.trim();
	if (next) {
		customShowOps.renameCustomShow(id, next);
	}
}
/** Delete the active custom show after confirmation (Slide Show ribbon). */
function onDeleteActiveCustomShow(): void {
	const id = activeCustomShowId.value;
	if (id === null) {
		return;
	}
	const show = customShows.value.find((s) => s.id === id);
	if (window.confirm(`Delete custom show "${show?.name ?? ''}"?`)) {
		onDeleteCustomShow(id);
	}
}
/** Add/remove the active slide from the active custom show (Slide Show ribbon). */
function onToggleCurrentSlideInActiveShow(): void {
	const id = activeCustomShowId.value;
	const rId = activeSlideRId.value;
	if (id === null || rId === undefined) {
		return;
	}
	customShowOps.toggleSlideInShow(id, rId);
}

// ── Version history + compare ─────────────────────────────────────────
// Snapshots accrue on each autosave (see the autosave `onSave` below).
const versionHistory = useVersionHistory({ slides, pushHistory: history.pushHistory });
const showVersionHistory = ref(false);
const compareResult = ref<CompareResult | null>(null);
const compareVersionId = ref<string | null>(null);
const showCompare = computed(() => compareResult.value !== null);
function onVersionRestore(id: string): void {
	versionHistory.restore(id);
	showVersionHistory.value = false;
}
function onVersionDelete(id: string): void {
	versionHistory.remove(id);
}
function onVersionCompare(id: string): void {
	const version = versionHistory.versions.value.find((v) => v.id === id);
	if (!version) {
		return;
	}
	compareVersionId.value = id;
	compareResult.value = compareSlides(version.slides, slides.value);
}
function onCompareClose(): void {
	compareResult.value = null;
	compareVersionId.value = null;
}
function onCompareAcceptAll(): void {
	if (compareVersionId.value) {
		versionHistory.restore(compareVersionId.value);
	}
	onCompareClose();
	showVersionHistory.value = false;
}

// ── Insert SmartArt / equation ────────────────────────────────────────
const showInsertSmartArt = ref(false);
const showEquationEditor = ref(false);
function onInsertElement(element: PptxElement): void {
	ops.addElement(element);
	selectedElementIds.value = [element.id];
	showInsertSmartArt.value = false;
	showEquationEditor.value = false;
}

// ── Viewer settings ───────────────────────────────────────────────────
const showSettings = ref(false);
const viewerSettings = ref<ViewerSettings>({ ...DEFAULT_VIEWER_SETTINGS });
function onSettingsUpdate(next: ViewerSettings): void {
	viewerSettings.value = next;
}
function sendBackward(): void {
	for (const id of [...selectedElementIds.value]) {
		ops.sendBackward(id);
	}
}

// ── Keyboard shortcuts ────────────────────────────────────────────────
// A config-driven registry (mirrors React `useKeyboardShortcuts`) replaces the
// old ad-hoc Ctrl+Z/Y/Delete handling. Find (Ctrl+F) and the shortcut-help
// overlay (Ctrl+/) are handled in `onEditorKeydown` before delegating.
const showShortcuts = ref(false);

/** Select every element on the active slide. */
function selectAllElements(): void {
	selectedElementIds.value = (activeSlide.value?.elements ?? []).map((e) => e.id);
}
/** Copy the first selected element to the in-memory clipboard. */
function copySelected(): void {
	const id = selectedElementIds.value[0];
	if (id) {
		copyElement(id);
	}
}
/** Cut the first selected element to the in-memory clipboard. */
function cutSelected(): void {
	const id = selectedElementIds.value[0];
	if (id) {
		cutElement(id);
	}
}
/** Nudge every selected element by (dx, dy) px as one history entry. */
function nudgeSelected(dx: number, dy: number): void {
	if (selectedElementIds.value.length === 0) {
		return;
	}
	const index = activeSlideIndex.value;
	const slide = slides.value[index];
	if (!slide) {
		return;
	}
	const ids = new Set(selectedElementIds.value);
	history.pushHistory();
	const nextElements = slide.elements.map((el) =>
		ids.has(el.id) ? { ...el, x: el.x + dx, y: el.y + dy } : el,
	);
	const nextSlides = slides.value.slice();
	nextSlides[index] = { ...slide, elements: nextElements };
	slides.value = nextSlides;
}

const shortcuts = useKeyboardShortcuts({
	actions: {
		undo: history.undo,
		redo: history.redo,
		copy: copySelected,
		cut: cutSelected,
		paste: pasteElement,
		duplicate: duplicateSelected,
		delete: deleteSelected,
		selectAll: selectAllElements,
		nudge: nudgeSelected,
		prevSlide: goPrev,
		nextSlide: goNext,
		escape: onEscape,
	},
	canEdit: () => props.canEdit,
	hasSelection,
	isPresenting: presenting,
});

/** Root keydown: Find / shortcut-help first, then the shortcut registry. */
function onEditorKeydown(event: KeyboardEvent): void {
	const mod = event.ctrlKey || event.metaKey;
	if (props.canEdit && mod && event.key.toLowerCase() === 'f') {
		event.preventDefault();
		findOpen.value = !findOpen.value;
		return;
	}
	if (mod && event.key === '/') {
		event.preventDefault();
		showShortcuts.value = !showShortcuts.value;
		return;
	}
	shortcuts.handleKeyDown(event);
}

// ── Office-style ribbon wiring (RibbonToolbar ← React Toolbar.tsx) ────────
// The desktop chrome is the full Office ribbon. This block adapts the host's
// existing state + handlers to the `RibbonProps` contract. Capabilities the
// host does not yet expose (drawing tools, grid/ruler/snap, theme gallery,
// flip, action buttons, layout gallery) are wired as no-ops for now; the
// ribbon renders faithfully and the core actions are live.
const toolbarSection = ref<ToolbarSection>('home');
const newShapeType = ref<SupportedShapeType>('rect');
const activeTool = ref<DrawingTool>('select');
const drawingColor = ref('#000000');
const drawingWidth = ref(2);
const inspectorOpen = ref(true);
/** Left slides-rail collapse (Quick-Access sidebar toggle). */
const sidebarCollapsed = ref(false);
const overflowOpen = ref(false);
/** Status-bar Notes toggle: expands/collapses the desktop notes panel. */
const notesExpanded = ref(true);
/** View-tab canvas aids: dot grid overlay + snap-to-grid during drag/resize. */
const showGrid = ref(false);
const snapToGrid = ref(false);
/** View ▸ Rulers: horizontal/vertical rulers along the slide edges. */
const showRulers = ref(false);
/** View ▸ Spell: draw the browser's native spell-check squiggles while editing. */
const spellCheckEnabled = ref(true);
/** View ▸ Snap to Shape: snap dragged elements to other elements' edges/centres. */
const snapToShape = ref(false);
/** Transient red snap-alignment lines shown during a snap-to-shape drag. */
const snapLines = ref<Array<{ axis: 'x' | 'y'; position: number }>>([]);
/** View ▸ H/V Guides: draggable alignment guides (authored slide px). */
const guides = ref<Guide[]>([]);
/** Add a centred horizontal/vertical guide (View ▸ H/V Guide buttons). */
function addGuide(axis: 'h' | 'v'): void {
	guides.value = [...guides.value, createGuide(createEditorId('guide'), axis, canvasSize.value)];
}
/** Drag a guide to a new (clamped) position. */
function onMoveGuide(payload: { id: string; position: number }): void {
	guides.value = moveGuide(guides.value, payload.id, payload.position, canvasSize.value);
}
/** Double-click removes a guide. */
function onRemoveGuide(id: string): void {
	guides.value = removeGuide(guides.value, id);
}
/** Grid spacing in px (matches React's GRID_SIZE). */
const GRID_SIZE = 8;
/** Design ▸ Themes gallery overlay. */
const themeGalleryOpen = ref(false);

/** A pen/highlighter/eraser tool is armed (Draw tab) → ink capture is active. */
const drawingActive = computed(
	() => props.canEdit && !presenting.value && activeTool.value !== 'select',
);
/** Turn a captured stroke into an `ink` element (no select, keep drawing). */
function addInkStroke(payload: {
	points: Array<{ x: number; y: number }>;
	color: string;
	width: number;
	tool: string;
}): void {
	const pts = payload.points;
	if (pts.length < 2) {
		return;
	}
	const isHl = payload.tool === 'highlighter';
	const strokeW = isHl ? payload.width * 3 : payload.width;
	const pad = Math.max(2, strokeW);
	const xs = pts.map((p) => p.x);
	const ys = pts.map((p) => p.y);
	const minX = Math.min(...xs) - pad;
	const minY = Math.min(...ys) - pad;
	const maxX = Math.max(...xs) + pad;
	const maxY = Math.max(...ys) + pad;
	const d = `M ${pts.map((p) => `${(p.x - minX).toFixed(1)} ${(p.y - minY).toFixed(1)}`).join(' L ')}`;
	const el = {
		id: createEditorId('ink'),
		type: 'ink',
		x: minX,
		y: minY,
		width: maxX - minX,
		height: maxY - minY,
		inkPaths: [d],
		inkColors: [payload.color],
		inkWidths: [strokeW],
		inkOpacities: [isHl ? 0.4 : 1],
		inkTool: payload.tool,
	} as unknown as PptxElement;
	ops.addElement(el);
	selectedElementIds.value = [];
}
/** Eraser: remove the top-most ink element whose box contains the point. */
function eraseInkAt(point: { x: number; y: number }): void {
	const slide = activeSlide.value;
	if (!slide) {
		return;
	}
	for (let i = slide.elements.length - 1; i >= 0; i--) {
		const el = slide.elements[i];
		if (
			el.type === 'ink' &&
			point.x >= el.x &&
			point.x <= el.x + el.width &&
			point.y >= el.y &&
			point.y <= el.y + el.height
		) {
			ops.removeElement(el.id);
			return;
		}
	}
}
/** Design ▸ Theme editor overlay. */
const themeEditorOpen = ref(false);

/**
 * Re-theme the whole deck via core's pure `applyThemeToData` (re-resolves slide
 * colours against the new scheme) and write the new slides/theme/colour-map back
 * (history-aware). The active colour scheme is provided to tables via
 * `pptxTheme`, so banding updates too.
 */
function applyTheme(
	colorScheme: PptxThemeColorScheme,
	fontScheme: PptxThemeFontScheme | undefined,
	name: string,
): void {
	history.pushHistory();
	const result = applyThemeToData(
		{
			slides: slides.value,
			theme: pptxTheme.value,
			themeColorMap: themeColorMap.value,
		} as unknown as PptxData,
		colorScheme,
		fontScheme,
		name,
	);
	slides.value = result.slides;
	pptxTheme.value = result.theme;
	themeColorMap.value = result.themeColorMap;
}
/** Apply a built-in theme preset (Design ▸ Themes gallery). */
function applyThemePreset(preset: PptxThemePreset): void {
	applyTheme(preset.colorScheme, preset.fontScheme, preset.name);
	themeGalleryOpen.value = false;
}
/** Apply edited theme colours/fonts/name (Design ▸ Edit theme). */
function applyThemeEdit(payload: {
	colorScheme: PptxThemeColorScheme;
	fontScheme: PptxThemeFontScheme;
	name: string;
}): void {
	applyTheme(payload.colorScheme, payload.fontScheme, payload.name);
	themeEditorOpen.value = false;
}

const ribbonMode = computed<ViewerMode>(() =>
	presenting.value
		? 'present'
		: showMasterView.value
			? 'master'
			: props.canEdit
				? 'edit'
				: 'preview',
);

const RIBBON_ALIGN: Record<string, AlignEdge> = {
	left: 'left',
	center: 'centerH',
	right: 'right',
	top: 'top',
	middle: 'middle',
	bottom: 'bottom',
};

/** Narrow a ribbon `SupportedShapeType` to the EditorToolbar's `ShapePreset`. */
function toShapePreset(t: SupportedShapeType): ShapePreset {
	return t === 'ellipse' || t === 'roundRect' || t === 'triangle' ? t : 'rect';
}

/** Apply a character/paragraph style patch to the selected text element. */
function ribbonUpdateTextStyle(updates: Partial<TextStyle>): void {
	const id = selectedElementIds.value[0];
	if (!id) {
		return;
	}
	const el = activeSlide.value?.elements.find((e) => e.id === id);
	if (!el || !hasTextProperties(el)) {
		return;
	}
	const textStyle = { ...el.textStyle, ...updates };
	const segments =
		el.textSegments && el.textSegments.length > 0
			? el.textSegments.map((s) => ({ ...s, style: { ...s.style, ...updates } }))
			: undefined;
	ops.updateElement(
		id,
		(segments ? { textStyle, textSegments: segments } : { textStyle }) as Partial<PptxElement>,
	);
}

/** Flip the selected elements horizontally / vertically as one history entry. */
function ribbonFlip(direction: 'horizontal' | 'vertical'): void {
	const ids = new Set(selectedElementIds.value);
	const index = activeSlideIndex.value;
	const slide = slides.value[index];
	if (ids.size === 0 || !slide) {
		return;
	}
	history.pushHistory();
	const nextElements = slide.elements.map((el) => {
		if (!ids.has(el.id)) {
			return el;
		}
		return direction === 'horizontal'
			? { ...el, flipHorizontal: !el.flipHorizontal }
			: { ...el, flipVertical: !el.flipVertical };
	});
	const nextSlides = slides.value.slice();
	nextSlides[index] = { ...slide, elements: nextElements };
	slides.value = nextSlides;
}

/** Move the first selected element to the front/back of the slide z-order. */
function ribbonMoveToEdge(dir: string): void {
	const id = selectedElementIds.value[0];
	const slide = activeSlide.value;
	if (!id || !slide) {
		return;
	}
	const toFront = dir === 'front' || dir === 'forward' || dir === 'up';
	ops.reorder(id, toFront ? slide.elements.length - 1 : 0);
}

const noop = (): void => {};

const ribbonProps = computed<RibbonProps>(() => ({
	mode: ribbonMode.value,
	canEdit: props.canEdit,
	isNarrowViewport: isMobile.value,
	isSidebarCollapsed: sidebarCollapsed.value,
	isInspectorPaneOpen: inspectorOpen.value,
	isCompactToolbarOpen: true,
	toolbarSection: toolbarSection.value,
	scale: zoom.value,
	canUndo: history.canUndo.value,
	canRedo: history.canRedo.value,
	undoLabel: undefined,
	redoLabel: undefined,
	findReplaceOpen: findOpen.value,
	selectedElement: selectedElements.value[0] ?? null,
	tableEditorState: null,
	editTemplateMode: false,
	newShapeType: newShapeType.value,
	activeTool: activeTool.value,
	drawingColor: drawingColor.value,
	drawingWidth: drawingWidth.value,
	clipboardPayload: clipboard.value ? { kind: 'element' } : null,
	spellCheckEnabled: spellCheckEnabled.value,
	showGrid: showGrid.value,
	showRulers: showRulers.value,
	snapToGrid: snapToGrid.value,
	snapToShape: snapToShape.value,
	isOverflowMenuOpen: overflowOpen.value,
	layoutOptions: layoutOptions.value,
	customShows: customShows.value,
	activeCustomShowId: activeCustomShowId.value,
	isCurrentSlideInActiveShow: isCurrentSlideInActiveShow.value,
	hasMacros: false,
	isThemeEditorOpen: themeEditorOpen.value,
	isThemeGalleryOpen: themeGalleryOpen.value,
	isCommentsPanelOpen: showComments.value,
	slideCommentCount: activeComments.value.length,
	formatPainterActive: formatPainterActive.value,
	canActivateFormatPainter: canActivateFormatPainter.value,
	isSelectionPaneOpen: false,
	eyedropperActive: false,
	showSubtitles: false,
	activeSlide: activeSlide.value,

	onSetMode: (m) => {
		if (m === 'present') {
			startPresenting();
		} else {
			presenting.value = false;
		}
	},
	onToggleSidebar: () => {
		sidebarCollapsed.value = !sidebarCollapsed.value;
	},
	onToggleInspector: () => {
		inspectorOpen.value = !inspectorOpen.value;
	},
	onOpenAnimationPanel: () => {
		toolbarSection.value = 'animations';
	},
	onAddAnimation,
	onRemoveAnimation,
	onToggleCompactToolbar: noop,
	onSetToolbarSection: (sec) => {
		toolbarSection.value = sec;
	},
	onZoomIn: zoomIn,
	onZoomOut: zoomOut,
	onZoomToFit: zoomReset,
	onUndo: history.undo,
	onRedo: history.redo,
	onToggleFindReplace: () => {
		findOpen.value = !findOpen.value;
	},
	onSetNewShapeType: (t) => {
		newShapeType.value = t;
	},
	onAddTextBox: addText,
	onAddShape: () => addShape(toShapePreset(newShapeType.value)),
	onAddTable: addTable,
	onAddSmartArt: () => {
		showInsertSmartArt.value = true;
	},
	onAddEquation: () => {
		showEquationEditor.value = true;
	},
	onAddActionButton: addActionButton,
	onInsertField: undefined,
	onOpenImagePicker: openImagePicker,
	onOpenMediaPicker: openMediaPicker,
	onSetActiveTool: (t) => {
		activeTool.value = t;
	},
	onSetDrawingColor: (c) => {
		drawingColor.value = c;
	},
	onSetDrawingWidth: (w) => {
		drawingWidth.value = w;
	},
	onSetEditTemplateMode: noop,
	onSetSpellCheckEnabled: (enabled) => {
		spellCheckEnabled.value = enabled;
	},
	onSetShowGrid: (enabled) => {
		showGrid.value = enabled;
	},
	onSetShowRulers: (enabled) => {
		showRulers.value = enabled;
	},
	onSetSnapToGrid: (enabled) => {
		snapToGrid.value = enabled;
	},
	onSetSnapToShape: (enabled) => {
		snapToShape.value = enabled;
	},
	onAddGuide: addGuide,
	onAlignElements: (edge) => {
		const e = RIBBON_ALIGN[edge];
		if (e) {
			onAlign(e);
		}
	},
	onCopy: copySelected,
	onCut: cutSelected,
	onPaste: pasteElement,
	onFlip: ribbonFlip,
	onMoveLayer: (dir) => {
		if (dir === 'forward' || dir === 'up' || dir === 'front') {
			bringForward();
		} else {
			sendBackward();
		}
	},
	onMoveLayerToEdge: ribbonMoveToEdge,
	onDuplicate: duplicateSelected,
	onDelete: deleteSelected,
	onOpenFile: handleOpenFile,
	onExportPng,
	onExportPdf,
	onExportVideo: onExportWebm,
	onExportGif,
	onPackageForSharing: () => {
		shareOpen.value = true;
	},
	onOpenShareDialog: () => {
		shareOpen.value = true;
	},
	onSaveAsPptx: () => void downloadAs('pptx'),
	onSaveAsPpsx: () => void downloadAs('ppsx'),
	onSaveAsPptm: () => void downloadAs('pptm'),
	onCopySlideAsImage: () => void onCopySlideAsImage(),
	onPrint: printer.openPrintDialog,
	onToggleShortcuts: () => {
		showShortcuts.value = !showShortcuts.value;
	},
	onOpenSettings: () => {
		showSettings.value = true;
	},
	onRunAccessibilityCheck: () => {
		showA11y.value = true;
	},
	onToggleSlideSorter: () => {
		showSorter.value = true;
	},
	onUpdateTextStyle: ribbonUpdateTextStyle,
	onSetOverflowMenuOpen: (o) => {
		overflowOpen.value = o;
	},
	onInsertSlideFromLayout: (path, name) => void insertSlideFromLayout(path, name),
	onSetActiveCustomShowId: (id) => {
		activeCustomShowId.value = id;
	},
	onCreateCustomShow: () => {
		showCustomShows.value = true;
	},
	onRenameActiveCustomShow,
	onDeleteActiveCustomShow,
	onToggleCurrentSlideInActiveShow,
	onToggleVersionHistory: () => {
		showVersionHistory.value = true;
	},
	onOpenPasswordProtection: undefined,
	onOpenDocumentProperties: () => {
		propertiesOpen.value = true;
	},
	onOpenFontEmbedding: undefined,
	onOpenDigitalSignatures: () => {
		showSignatures.value = true;
	},
	onEnterMasterView: () => {
		showMasterView.value = true;
	},
	onCloseMasterView: () => {
		showMasterView.value = false;
	},
	onEnterPresenterView: undefined,
	onEnterRehearsalMode: undefined,
	onToggleThemeEditor: () => {
		themeEditorOpen.value = !themeEditorOpen.value;
	},
	onToggleThemeGallery: () => {
		themeGalleryOpen.value = !themeGalleryOpen.value;
	},
	onCompare: undefined,
	onToggleComments: () => {
		showComments.value = !showComments.value;
	},
	onToggleFormatPainter: toggleFormatPainter,
	onToggleSelectionPane: undefined,
	onToggleEyedropper: undefined,
	onOpenSetUpSlideShow: undefined,
	onOpenBroadcastDialog: () => {
		broadcastOpen.value = true;
	},
	onToggleSubtitles: undefined,
	onTransitionChange,
	onApplyTransitionToAll,
}));

// ── Imperative surface (mirrors the React forwardRef handle) ──────────
defineExpose<PowerPointViewerExpose>({ getContent });
</script>

<template>
	<div
		class="pptx-vue-viewer"
		:class="props.class"
		:style="themeStyle"
		:tabindex="props.canEdit ? 0 : undefined"
		@keydown="onEditorKeydown"
	>
		<!-- Loading -->
		<div v-if="loading" class="pptx-vue-state pptx-vue-loading">
			<div class="pptx-vue-spinner" aria-hidden="true" />
			<p>Loading presentation…</p>
		</div>

		<!-- Encrypted -->
		<div v-else-if="isEncrypted" class="pptx-vue-state pptx-vue-error">
			<p>This presentation is password-protected and cannot be opened.</p>
		</div>

		<!-- Error -->
		<div v-else-if="error" class="pptx-vue-state pptx-vue-error">
			<p>Failed to load presentation.</p>
			<pre class="pptx-vue-error-detail">{{ error }}</pre>
		</div>

		<!-- Viewer -->
		<template v-else>
			<!-- Office-style ribbon (desktop): full React-parity chrome -->
			<RibbonToolbar v-if="!isMobile" v-bind="ribbonProps" />

			<!-- Hidden pickers for Insert ▸ Image / Media -->
			<input
				ref="imageInputRef"
				type="file"
				accept="image/*"
				aria-hidden="true"
				style="display: none"
				@change="onImageFileSelected"
			/>
			<input
				ref="mediaInputRef"
				type="file"
				accept="audio/*,video/*"
				aria-hidden="true"
				style="display: none"
				@change="onMediaFileSelected"
			/>

			<!-- Find & replace bar -->
			<FindReplaceBar
				v-if="props.canEdit && findOpen"
				v-model:query="find.query.value"
				v-model:replacement="find.replacement.value"
				v-model:match-case="find.matchCase.value"
				:match-count="find.matchCount.value"
				:current-index="find.currentMatch.value"
				@next="find.next"
				@prev="find.prev"
				@replace="find.replaceCurrent"
				@replace-all="find.replaceAll"
				@close="findOpen = false"
			/>

			<div class="pptx-vue-body">
				<!-- Flat slide rail (React-parity): number-left thumbnails + Add Slide + context menu.
				     Hidden on mobile, where it would otherwise collapse the slide canvas to
				     zero height; mobile navigates slides via the bottom bar's prev/next. -->
				<SlidesPaneSidebar
					v-if="!isMobile && !hasSections && !sidebarCollapsed"
					:slides="slides"
					:active-index="activeSlideIndex"
					:canvas-size="canvasSize"
					:media-data-urls="mediaDataUrls"
					:can-edit="props.canEdit"
					:thumb-width="THUMB_WIDTH"
					@select="goTo"
					@reorder="(p) => slideOps.moveSlide(p.from, p.to)"
					@add-slide="slideOps.addSlide()"
					@duplicate="(i) => slideOps.duplicateSlide(i)"
					@delete="(i) => slideOps.deleteSlide(i)"
					@toggle-hidden="toggleSlideHidden"
				/>
				<!-- Sectioned rail when the deck declares sections (desktop only). -->
				<nav
					v-else-if="!isMobile && !sidebarCollapsed"
					class="pptx-vue-thumbnails"
					aria-label="Slides"
				>
					<SectionList
						:groups="sectionOps.slidesBySection.value"
						:canvas-size="canvasSize"
						:media-data-urls="mediaDataUrls"
						:active-index="activeSlideIndex"
						:can-edit="props.canEdit"
						@select="goTo"
						@toggle-collapse="sectionOps.toggleSectionCollapse"
						@rename="sectionOps.renameSection"
						@move-up="sectionOps.moveSectionUp"
						@move-down="sectionOps.moveSectionDown"
						@delete="sectionOps.deleteSection"
						@add-section="(idx) => sectionOps.addSection('Untitled Section', idx)"
					/>
				</nav>

				<main
					class="pptx-vue-main"
					:class="{ 'is-editable': props.canEdit }"
					@pointerdown="onCanvasPointerDown"
					@contextmenu="onCanvasContextMenu"
					@pointermove="onCollabPointerMove"
					@touchstart="onMainTouchStart"
					@touchend="onMainTouchEnd"
				>
					<SlideCanvas
						:slide="activeSlide"
						:canvas-size="canvasSize"
						:media-data-urls="mediaDataUrls"
						:zoom="effectiveZoom"
						:show-rulers="showRulers && !presenting"
						@update:fit-scale="fitScale = $event"
					>
						<!-- Dot grid overlay (View ▸ Grid): sits over content, under selection -->
						<GridOverlay :canvas-size="canvasSize" :visible="showGrid && !presenting" />
						<!-- Draggable H/V alignment guides (View ▸ Guides) -->
						<CanvasGuides
							v-if="props.canEdit && !presenting"
							:guides="guides"
							:scale="effectiveZoom"
							@move="onMoveGuide"
							@remove="onRemoveGuide"
						/>
						<!-- Transient snap-to-shape alignment lines (during drag) -->
						<SnapLinesOverlay v-if="snapLines.length > 0" :snap-lines="snapLines" />
						<!-- Ink capture (Draw tab): pointer-events on only while a tool is armed -->
						<DrawingOverlay
							v-if="props.canEdit"
							:canvas-size="canvasSize"
							:active="drawingActive"
							:tool="activeTool"
							:color="drawingColor"
							:width="drawingWidth"
							:scale="effectiveZoom"
							@stroke="addInkStroke"
							@erase="eraseInkAt"
						/>
						<SelectionOverlay
							v-if="props.canEdit && !inlineEditingElementId && !presenting"
							:elements="selectedElements"
							:selected-ids="selectedElementIds"
							:zoom="effectiveZoom"
							@transform-start="onTransformStart"
							@transform="onTransform"
							@transform-end="onTransformEnd"
							@adjust-start="onAdjustStart"
							@adjust="onAdjust"
							@adjust-end="onAdjustEnd"
							@request-edit="(p) => enterInlineEdit(p.id)"
						/>
						<InlineTextEditor
							v-if="props.canEdit && inlineEditingElement"
							:element="inlineEditingElement"
							:spell-check="spellCheckEnabled"
							@change="(t) => (inlineEditingText = t)"
							@commit="commitInlineEdit"
							@cancel="cancelInlineEdit"
						/>
						<CollaborationCursors
							v-if="collabActive"
							:cursors="collab.cursors.value"
							:zoom="effectiveZoom"
						/>
						<RemoteSelectionOverlay
							v-if="collabActive"
							:presences="collab.remotePresences.value"
							:elements="activeSlide?.elements ?? []"
							:active-slide-index="activeSlideIndex"
							:zoom="effectiveZoom"
						/>
					</SlideCanvas>
					<NotesPanel
						v-if="props.canEdit && !isMobile && notesExpanded"
						:slide="activeSlide"
						@update="onNotesUpdate"
					/>
				</main>

				<!-- Property inspector (single selection, edit mode). On mobile this
				     becomes a swipe-dismissable bottom sheet (see MobileSheet below). -->
				<InspectorPane
					v-if="props.canEdit && !isMobile && inspectorElementForPanels && inspectorOpen"
					:element="inspectorElementForPanels"
					@update="onInspectorUpdate"
				/>

				<!-- Slide-level inspector (no element selected): slide transition, etc. -->
				<SlideInspector
					v-else-if="props.canEdit && !isMobile && inspectorOpen && slideCount > 0"
					:slide="activeSlide"
					@transition-update="applySlideTransition"
				/>

				<!-- Accessibility checker -->
				<AccessibilityPanel
					v-if="props.canEdit && showA11y"
					:issues="a11y.issues.value"
					@select-slide="goTo"
				/>

				<!-- Comments (desktop right rail; mobile uses the bottom sheet below) -->
				<CommentsPanel
					v-if="props.canEdit && !isMobile && showComments"
					:comments="commentsApi.slideComments.value"
					:author-name="authorNameRef"
					@add="(t) => commitComments(commentsApi.addComment(t))"
					@remove="(id) => commitComments(commentsApi.removeComment(id))"
					@resolve="(id) => commitComments(commentsApi.resolveComment(id))"
				/>

				<!-- Digital signatures -->
				<SignaturesPanel v-if="showSignatures" :signatures="signatures" />

				<!-- Collaboration follow-mode -->
				<FollowModeBar
					v-if="collabActive"
					:presences="collab.remotePresences.value"
					:followed-client-id="collab.followedClientId.value"
					@follow="collab.followUser"
				/>

				<!-- Collaboration connection / participant status pill -->
				<div
					v-if="collabActive"
					class="pptx-vue-collab-status-pill pointer-events-auto absolute bottom-2 right-2 z-50 rounded-full border border-border bg-background/90 px-2.5 py-1 shadow-sm backdrop-blur"
				>
					<CollaborationStatusIndicator
						:status="collab.status.value"
						:connected-count="collab.connectedCount.value"
						@retry="collab.retry"
					/>
				</div>

				<!-- Custom shows -->
				<CustomShowsPanel
					v-if="props.canEdit && showCustomShows"
					:custom-shows="customShows"
					:slides="slides"
					:active-show-id="activeCustomShowId"
					@create="onCreateCustomShow"
					@rename="customShowOps.renameCustomShow"
					@delete="onDeleteCustomShow"
					@select="(id) => (activeCustomShowId = id)"
					@toggle-slide="customShowOps.toggleSlideInShow"
					@move-slide="customShowOps.moveSlideInShow"
				/>
			</div>

			<!-- Bottom status bar (desktop): React-parity chrome -->
			<StatusBar
				v-if="!isMobile && slideCount > 0"
				:slide-count="slideCount"
				:active-slide-index="activeSlideIndex"
				:is-dirty="autosave.isDirty.value"
				:autosave-status="autosaveEnabled ? autosave.status.value : undefined"
				:scale="zoom"
				:mode="ribbonMode"
				:is-notes-expanded="notesExpanded"
				:show-notes="props.canEdit"
				@zoom-in="zoomIn"
				@zoom-out="zoomOut"
				@zoom-to-fit="zoomReset"
				@toggle-notes="notesExpanded = !notesExpanded"
				@toggle-slide-sorter="showSorter = true"
				@set-mode="(m) => (m === 'present' ? startPresenting() : (presenting = false))"
			/>

			<!-- Design ▸ Themes gallery -->
			<ThemeGallery
				:open="themeGalleryOpen"
				:active-name="pptxTheme?.name"
				@apply="applyThemePreset"
				@close="themeGalleryOpen = false"
			/>

			<!-- Design ▸ Edit theme -->
			<ThemeEditorPanel
				v-if="themeEditorOpen && props.canEdit"
				:theme="pptxTheme"
				:can-edit="props.canEdit"
				@apply="applyThemeEdit"
				@close="themeEditorOpen = false"
			/>

			<!-- Element context menu (edit mode) -->
			<ContextMenu
				:open="contextMenu.open"
				:x="contextMenu.x"
				:y="contextMenu.y"
				:items="contextItems"
				@select="onContextSelect"
				@close="contextMenu.open = false"
			/>

			<!-- Hyperlink editor -->
			<HyperlinkDialog
				:open="hyperlinkOpen"
				:element="hyperlinkTarget"
				@save="onHyperlinkSave"
				@close="hyperlinkOpen = false"
			/>

			<!-- Share / collaboration -->
			<ShareDialog
				:open="shareOpen"
				:defaults="props.shareDefaults"
				:active="collabActive"
				@start="onShareStart"
				@stop="onShareStop"
				@close="shareOpen = false"
			/>

			<!-- Document properties (General / Statistics / Custom) -->
			<DocumentPropertiesDialog
				:open="propertiesOpen"
				:core-properties="coreProperties"
				:custom-properties="customProperties"
				:app-properties="appProperties"
				:slides="slides"
				@save="onPropertiesSave"
				@close="propertiesOpen = false"
			/>

			<!-- Print -->
			<PrintDialog
				:open="printer.isPrintDialogOpen.value"
				:slides="slides"
				:active-slide-index="activeSlideIndex"
				@print="printer.print"
				@close="printer.closePrintDialog"
			/>

			<!-- Keyboard shortcut help -->
			<ShortcutPanel :open="showShortcuts" @close="showShortcuts = false" />

			<!-- Header & footer -->
			<ModalDialog
				:open="showHeaderFooter"
				title="Header & footer"
				@close="showHeaderFooter = false"
			>
				<HeaderFooterPanel
					:header-footer="headerFooter"
					@update="onHeaderFooterUpdate"
					@close="showHeaderFooter = false"
				/>
			</ModalDialog>

			<!-- Master views (slide / notes / handout) -->
			<div
				v-if="showMasterView"
				class="pptx-vue-master-overlay"
				role="dialog"
				aria-label="Master views"
				style="
					position: fixed;
					inset: 0;
					z-index: 1000;
					display: flex;
					justify-content: flex-start;
					background: rgba(0, 0, 0, 0.45);
				"
				@click.self="showMasterView = false"
			>
				<MasterViewSidebar
					:slide-masters="slideMasters"
					:active-master-index="activeMasterIndex"
					:active-layout-index="activeLayoutIndex"
					:canvas-size="canvasSize"
					:media-data-urls="mediaDataUrls"
					:master-view-tab="masterViewTab"
					:notes-master="notesMaster"
					:handout-master="handoutMaster"
					:handout-slides-per-page="handoutSlidesPerPage"
					@select-master="onSelectMaster"
					@select-layout="onSelectLayout"
					@tab-change="masterViewTab = $event"
					@handout-slides-per-page-change="handoutSlidesPerPage = $event"
					@collapse="showMasterView = false"
				/>
			</div>

			<!-- Broadcast -->
			<BroadcastDialog
				:open="broadcastOpen"
				:active="collabActive"
				:viewer-url="broadcastViewerUrl"
				:defaults="{ serverUrl: props.shareDefaults?.serverUrl }"
				@start="onBroadcastStart"
				@stop="onBroadcastStop"
				@close="broadcastOpen = false"
			/>

			<!-- Mobile bottom bar -->
			<MobileBottomBar
				v-if="isMobile"
				:slide-index="activeSlideIndex"
				:slide-count="slideCount"
				:zoom-percent="zoomPercent"
				:can-edit="props.canEdit"
				@prev="goPrev"
				@next="goNext"
				@zoom-in="zoomIn"
				@zoom-out="zoomOut"
				@present="present"
				@format="mobileInspectorOpen ? (mobileInspectorOpen = false) : openMobileSheet('format')"
				@comments="mobileCommentsOpen ? (mobileCommentsOpen = false) : openMobileSheet('comments')"
				@save="downloadAs('pptx')"
				@notes="mobileNotesOpen ? (mobileNotesOpen = false) : openMobileSheet('notes')"
				@menu="showSorter = true"
			/>

			<!-- Mobile speaker-notes sheet (toggled from the bottom bar). Uses the
			     shared MobileSheet so it swipe-dismisses like Format/Comments. -->
			<MobileSheet
				v-if="isMobile"
				:open="mobileNotesOpen"
				title="Notes"
				@close="mobileNotesOpen = false"
			>
				<NotesPanel :slide="activeSlide" @update="onNotesUpdate" />
			</MobileSheet>

			<!-- Mobile Format / properties sheet (right-rail inspector on desktop) -->
			<MobileSheet
				v-if="isMobile && props.canEdit"
				:open="mobileInspectorOpen"
				title="Format"
				@close="mobileInspectorOpen = false"
			>
				<InspectorPane
					v-if="inspectorElementForPanels"
					mobile
					:element="inspectorElementForPanels"
					@update="onInspectorUpdate"
				/>
				<SlideInspector
					v-else-if="slideCount > 0"
					mobile
					:slide="activeSlide"
					@transition-update="applySlideTransition"
				/>
				<p v-else class="px-4 py-6 text-center text-xs text-muted-foreground">No slide selected.</p>
			</MobileSheet>

			<!-- Mobile Comments sheet (right-rail panel on desktop) -->
			<MobileSheet
				v-if="isMobile && props.canEdit"
				:open="mobileCommentsOpen"
				title="Comments"
				@close="mobileCommentsOpen = false"
			>
				<CommentsPanel
					:comments="commentsApi.slideComments.value"
					:author-name="authorNameRef"
					@add="(t) => commitComments(commentsApi.addComment(t))"
					@remove="(id) => commitComments(commentsApi.removeComment(id))"
					@resolve="(id) => commitComments(commentsApi.resolveComment(id))"
				/>
			</MobileSheet>

			<!-- Off-screen stage used to rasterise slides for export -->
			<div
				ref="exportStageRef"
				class="pptx-vue-export-stage"
				aria-hidden="true"
				style="position: fixed; left: -99999px; top: 0; pointer-events: none; opacity: 0"
			>
				<SlideStage
					v-if="exportSlide"
					:slide="exportSlide"
					:canvas-size="canvasSize"
					:media-data-urls="mediaDataUrls"
					:scale="1"
				/>
			</div>
		</template>

		<!-- Slide sorter overlay -->
		<SlideSorter
			v-if="showSorter"
			:slides="slides"
			:canvas-size="canvasSize"
			:media-data-urls="mediaDataUrls"
			:active-index="activeSlideIndex"
			@select="onSorterSelect"
			@reorder="onSorterReorder"
			@close="showSorter = false"
		/>

		<!-- Presentation / slideshow overlay -->
		<PresentationMode
			v-if="presenting"
			:slides="slides"
			:canvas-size="canvasSize"
			:media-data-urls="mediaDataUrls"
			:start-index="activeSlideIndex"
			@close="onPresentClose"
			@slide-change="onPresentSlideChange"
		/>
	</div>
</template>
