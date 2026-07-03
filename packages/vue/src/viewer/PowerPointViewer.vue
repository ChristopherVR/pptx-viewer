<script setup lang="ts">
/**
 * PowerPointViewer: Vue port of the React `PowerPointViewer.tsx`.
 *
 * Top-level orchestrator that loads `.pptx` bytes and renders the slides with
 * navigation and zoom, composing the full editor (toolbar, inspector panels,
 * dialogs, presentation mode, collaboration, export) like its React
 * counterpart.
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
	hasTextProperties,
	updateSmartArtNodeText,
} from 'pptx-viewer-core';
import type {
	MasterViewTab,
	PptxData,
	PptxElement,
	PptxHeaderFooter,
	PptxSaveFormat,
	PptxSlide,
	PptxThemeColorScheme,
	PptxThemeFontScheme,
	PptxThemePreset,
} from 'pptx-viewer-core';
import type { CollaborationTransport, DistributeAxis } from 'pptx-viewer-shared';
import {
	buildBroadcastViewerUrl,
	downloadBlob,
	isTemplateElementId,
	openPptxFile,
	setCellText,
	strokeToInkElement,
} from 'pptx-viewer-shared';
import { computed, nextTick, provide, ref, toRef, watch } from 'vue';

import { provideViewerTheme, useThemeStyle } from '../theme';
import AccessibilityPanel from './components/AccessibilityPanel.vue';
import BroadcastDialog from './components/BroadcastDialog.vue';
import CanvasGuides from './components/CanvasGuides.vue';
import CollaborationCursors from './components/CollaborationCursors.vue';
import CollaborationStatusIndicator from './components/CollaborationStatusIndicator.vue';
import CommentMarkersOverlay from './components/CommentMarkersOverlay.vue';
import CommentsPanel from './components/CommentsPanel.vue';
import ComparePanel from './components/ComparePanel.vue';
import ContextMenu from './components/ContextMenu.vue';
import CustomShowsPanel from './components/CustomShowsPanel.vue';
import DocumentPropertiesDialog from './components/DocumentPropertiesDialog.vue';
import type { DocumentPropertiesSavePatch } from './components/DocumentPropertiesDialog.vue';
import DrawingOverlay from './components/DrawingOverlay.vue';
import type { ShapePreset } from './components/EditorToolbar.vue';
import EquationEditorDialog from './components/EquationEditorDialog.vue';
import ExportProgressModal from './components/ExportProgressModal.vue';
import FindReplaceBar from './components/FindReplaceBar.vue';
import FollowModeBar from './components/FollowModeBar.vue';
import FontEmbeddingPanel from './components/FontEmbeddingPanel.vue';
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
import MobileSlidesSheet from './components/MobileSlidesSheet.vue';
import MobileToolbar from './components/MobileToolbar.vue';
import ModalDialog from './components/ModalDialog.vue';
import NotesPanel from './components/NotesPanel.vue';
import PasswordProtectionDialog from './components/PasswordProtectionDialog.vue';
import PresentationMode from './components/PresentationMode.vue';
import PrintDialog from './components/PrintDialog.vue';
import RemoteSelectionOverlay from './components/RemoteSelectionOverlay.vue';
import type {
	DrawingTool,
	RibbonProps,
	SupportedShapeType,
	ToolbarSection,
} from './components/ribbon/ribbon-types';
import RibbonToolbar from './components/ribbon/RibbonToolbar.vue';
import SectionList from './components/SectionList.vue';
import SelectionOverlay from './components/SelectionOverlay.vue';
import SelectionPane from './components/SelectionPane.vue';
import SettingsDialog from './components/SettingsDialog.vue';
import SetUpSlideShowDialog from './components/SetUpSlideShowDialog.vue';
import ShareDialog from './components/ShareDialog.vue';
import ShortcutPanel from './components/ShortcutPanel.vue';
import SignaturesPanel from './components/SignaturesPanel.vue';
import SignatureStatusBadge from './components/SignatureStatusBadge.vue';
import SignatureStrippedDialog from './components/SignatureStrippedDialog.vue';
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
import { FieldContextKey, resolveSlideTitle } from './composables/field-context';
import {
	applyFormatToElement,
	copyFormatFromElement,
	hasCopyableFormat,
} from './composables/format-painter';
import type { CopiedFormat } from './composables/format-painter';
import { remapTextToSegments } from './composables/remap-text';
import { compareSlides } from './composables/slide-compare';
import type { CompareResult } from './composables/slide-compare';
import { SmartArt3DKey } from './composables/smart-art-3d';
import { SmartArtNodeEditKey } from './composables/smartart-node-edit';
import { TableCellEditKey } from './composables/table-edit';
import type { TableSelectionState } from './composables/table-selection';
import { provideTableSelection } from './composables/table-selection';
import { TableThemeKey } from './composables/table-theme';
import {
	buildSaveSlides,
	isElementIdInteractive,
	setTemplateElements,
} from './composables/template-editing';
import { useAccessibility } from './composables/useAccessibility';
import { useAlignGroup } from './composables/useAlignGroup';
import { useAutosave } from './composables/useAutosave';
import { useCollaboration } from './composables/useCollaboration';
import { useComments } from './composables/useComments';
import { useContextMenu } from './composables/useContextMenu';
import { useCustomShows } from './composables/useCustomShows';
import { useEditorHistory } from './composables/useEditorHistory';
import { useEditorOperations } from './composables/useEditorOperations';
import { useElementDrag } from './composables/useElementDrag';
import { useElementInsertion } from './composables/useElementInsertion';
import { useEmbeddedFonts } from './composables/useEmbeddedFonts';
import { useExport } from './composables/useExport';
import { useExportProgress } from './composables/useExportProgress';
import { useFindReplace } from './composables/useFindReplace';
import { useIsMobile } from './composables/useIsMobile';
import { useKeyboardInsets } from './composables/useKeyboardInsets';
import { useKeyboardShortcuts } from './composables/useKeyboardShortcuts';
import { useLoadContent } from './composables/useLoadContent';
import { useMediaExport } from './composables/useMediaExport';
import type { SlideAnnotationMap } from './composables/usePresentationAnnotations';
import { usePrint } from './composables/usePrint';
import { RIBBON_ALIGN, toShapePreset, useRibbonActions } from './composables/useRibbonActions';
import { useSectionOperations } from './composables/useSectionOperations';
import { useSignatures } from './composables/useSignatures';
import { useSlideMutations } from './composables/useSlideMutations';
import { useSlideOperations } from './composables/useSlideOperations';
import { useTouchGestures } from './composables/useTouchGestures';
import { useVersionHistory } from './composables/useVersionHistory';
import { provideZoomTargetLookup, toZoomTargetInfo } from './composables/zoom-target';
import type {
	CollaborationConfig,
	PowerPointViewerEmits,
	PowerPointViewerExpose,
	PowerPointViewerProps,
} from './types';

const props = withDefaults(defineProps<PowerPointViewerProps>(), {
	canEdit: false,
	smartArt3D: false,
});
const emit = defineEmits<PowerPointViewerEmits>();

// ── Theme ─────────────────────────────────────────────────────────────
const theme = toRef(props, 'theme');
provideViewerTheme(theme);
// SmartArt 3D opt-in: surface the prop to the element dispatcher via inject.
provide(SmartArt3DKey, props.smartArt3D);
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
	templateElementsBySlideId,
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
	presentationProperties,
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

// Expose a zoom-target lookup so Slide-Zoom / Section-Zoom tiles can render a
// higher-fidelity fallback thumbnail (target slide's real background colour,
// slide number and friendly section name) instead of the raw target index.
provideZoomTargetLookup((targetSlideIndex) => toZoomTargetInfo(slides.value[targetSlideIndex]));

// Expose the OOXML field-substitution context (slide number, date/time,
// header/footer, slide title, custom doc properties) to the text renderers via
// provide/inject. Mirrors the React `fieldContext` built in `ViewerCanvasArea`.
// A getter closure (run post-setup) safely references the later-declared
// `activeSlide`, matching the TableThemeKey pattern above.
provide(FieldContextKey, () => {
	const hf = headerFooter.value;
	const slide = activeSlide.value;
	return {
		slideNumber: slide?.slideNumber,
		dateTimeText: hf?.dateTimeText,
		dateFormat: hf?.dateFormat,
		footerText: hf?.footerText,
		headerText: hf?.headerText,
		slideTitle: resolveSlideTitle(slide),
		customProperties: customProperties.value.map((p) => ({
			name: p.name,
			value: p.value,
		})),
	};
});

// Inline table-cell editing context for `TableRenderer` (double-tap a cell ->
// inline input -> commit). The closures run post-setup, so referencing the
// later-declared `ops`/`presenting` is safe.
provide(TableCellEditKey, {
	canEdit: () => props.canEdit && !presenting.value,
	commit: commitTableCell,
});

// Table cell selection + drag-resize context for `TableRenderer` / `TablePanel`.
// The reactive selection drives the inspector's cell formatting + merge-aware
// structural ops and the canvas highlight; resize callbacks commit new column
// widths / row heights through the history-tracked editor op. Closures run
// post-setup, so referencing `ops` / `findActiveElement` here is safe.
const tableSelection = ref<TableSelectionState | null>(null);
function resizeTableColumns(elementId: string, widths: number[]): void {
	const el = findActiveElement(elementId);
	if (!props.canEdit || !el || el.type !== 'table' || !el.tableData) {
		return;
	}
	ops.updateElement(elementId, {
		tableData: { ...el.tableData, columnWidths: widths },
	} as Partial<PptxElement>);
}
function resizeTableRow(elementId: string, rowIndex: number, height: number): void {
	const el = findActiveElement(elementId);
	if (!props.canEdit || !el || el.type !== 'table' || !el.tableData) {
		return;
	}
	const rows = el.tableData.rows.map((r, i) => (i === rowIndex ? { ...r, height } : r));
	ops.updateElement(elementId, { tableData: { ...el.tableData, rows } } as Partial<PptxElement>);
}
provideTableSelection({
	selection: tableSelection,
	select: (next) => {
		tableSelection.value = next;
	},
	resizeColumns: resizeTableColumns,
	resizeRow: resizeTableRow,
});

// Inline SmartArt node-text and per-node fill editing context.
// Mirrors the TableCellEditKey pattern above. Closures run post-setup,
// so referencing the later-declared `ops`, `presenting`, and
// `findActiveElement` is safe.
provide(SmartArtNodeEditKey, {
	canEdit: () => props.canEdit && !presenting.value,
	commit: (elementId: string, nodeId: string, text: string): void => {
		if (!props.canEdit) {
			return;
		}
		const el = findActiveElement(elementId);
		if (!el || el.type !== 'smartArt') {
			return;
		}
		const data = el.smartArtData;
		if (!data) {
			return;
		}
		ops.updateElement(elementId, {
			smartArtData: updateSmartArtNodeText(data, nodeId, text),
		} as Partial<PptxElement>);
	},
	commitStyle: (elementId: string, patch: Partial<PptxElement>): void => {
		if (!props.canEdit) {
			return;
		}
		ops.updateElement(elementId, patch);
	},
});

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
/**
 * View ▸ Templates: when on, the master/layout shapes a slide inherits (already
 * present in `slide.elements` with `layout-`/`master-` ids) become selectable,
 * draggable and editable on the canvas instead of being interaction-locked.
 * Editing one mutates the shared template part, so all slides inheriting it
 * change together.
 */
const editTemplateMode = ref(false);
const history = useEditorHistory(slides, templateElementsBySlideId);
const ops = useEditorOperations({
	slides,
	activeSlideIndex,
	pushHistory: history.pushHistory,
	selectedElementIds,
	templateElementsBySlideId,
});
const hasSelection = computed(() => selectedElementIds.value.length > 0);

/** The active slide's separate template (master/layout) element layer. */
const activeTemplateElements = computed<PptxElement[]>(
	() => templateElementsBySlideId.value[activeSlide.value?.id ?? ''] ?? [],
);

/**
 * Resolve an element by id across both stores: template ids (`master-` /
 * `layout-` prefix) come from the active slide's template layer, everything else
 * from the slide content.
 */
function findActiveElement(id: string): PptxElement | undefined {
	if (isTemplateElementId(id)) {
		return activeTemplateElements.value.find((el) => el.id === id);
	}
	return activeSlide.value?.elements.find((el) => el.id === id);
}

const selectedElements = computed<PptxElement[]>(() => {
	const ids = new Set(selectedElementIds.value);
	const slideHits = (activeSlide.value?.elements ?? []).filter((el) => ids.has(el.id));
	const templateHits = activeTemplateElements.value.filter((el) => ids.has(el.id));
	return [...templateHits, ...slideHits];
});

// Drop the table cell selection once its owning table is no longer selected, so
// a stale highlight / inspector cell doesn't linger on the next selection.
watch(selectedElementIds, (ids) => {
	const sel = tableSelection.value;
	if (sel && !ids.includes(sel.elementId)) {
		tableSelection.value = null;
	}
});

// Slides re-merged with their template (master/layout) layer in front of (behind)
// the slide content. The editable canvas renders the partitioned `slides` + the
// template layer separately; every other VISUAL surface (thumbnail rail, sorter,
// presentation, off-screen export stage) renders these merged slides so the
// inherited master/layout decorations still appear, matching the saved file.
const mergedSlides = computed<PptxSlide[]>(() =>
	buildSaveSlides(slides.value, templateElementsBySlideId.value),
);
const mergedSlideById = computed(() => new Map(mergedSlides.value.map((s) => [s.id, s])));

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
	inlineEditingElementId.value ? findActiveElement(inlineEditingElementId.value) : undefined,
);
function enterInlineEdit(id: string): void {
	const el = findActiveElement(id);
	// Only elements that carry text (text boxes / shapes) get the element-level
	// inline text editor, and only when text editing is not locked. Mirrors
	// React's gate (useCanvasInteractions: `hasTextProperties(el) &&
	// !el.locks?.noTextEdit`). Without this, tapping a selected table opened the
	// whole-table text editor and masked the per-cell <td> editor.
	if (!el || !hasTextProperties(el) || el.locks?.noTextEdit) {
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
	const el = findActiveElement(id) as
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
/**
 * Commit an inline table-cell edit: resolve the table element, apply the
 * immutable `setCellText` update, and record it through the history-tracked
 * editor op so undo/redo works (mirrors React/Angular cell-commit handlers).
 */
function commitTableCell(
	elementId: string,
	rowIndex: number,
	colIndex: number,
	text: string,
): void {
	if (!props.canEdit) {
		return;
	}
	const el = findActiveElement(elementId);
	if (!el || el.type !== 'table') {
		return;
	}
	const updated = setCellText(el, rowIndex, colIndex, text);
	ops.updateElement(elementId, { tableData: updated.tableData } as Partial<PptxElement>);
}
/** Apply the copied format to a target element (shape/text style only). */
function applyFormatToTarget(id: string): void {
	const format = copiedFormat.value;
	const target = findActiveElement(id);
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
	const hitId = host?.dataset.elementId;
	// Template (master/layout) elements are interaction-locked unless the user
	// turns on edit-template mode; a click on a locked one behaves like an
	// empty-canvas click (no select / drag / inline-edit).
	const id = hitId && isElementIdInteractive(hitId, editTemplateMode.value) ? hitId : undefined;
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

// ── Element drag / transform / adjust + snap & alignment guides ───────
const {
	snapToShape,
	snapToGrid,
	snapLines,
	guides,
	addGuide,
	onMoveGuide,
	onRemoveGuide,
	startElementDrag,
	onTransformStart,
	onTransform,
	onTransformEnd,
	onAdjustStart,
	onAdjust,
	onAdjustEnd,
} = useElementDrag({
	findActiveElement,
	pushHistory: history.pushHistory,
	effectiveZoom,
	activeTemplateElements,
	activeSlide,
	activeSlideIndex,
	slides,
	templateElementsBySlideId,
	canvasSize,
	enterInlineEdit,
});

// ── Element insertion (Insert tab) ───────────────────────────────────
const {
	imageInputRef,
	mediaInputRef,
	addText,
	addShape,
	addTable,
	addChart,
	openImagePicker,
	onImageFileSelected,
	openMediaPicker,
	onMediaFileSelected,
	addActionButton,
	insertSlideFromLayout,
} = useElementInsertion({
	canvasSize,
	ops,
	selectedElementIds,
	slides,
	activeSlideIndex,
	pushHistory: history.pushHistory,
	handler,
});
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
function onPresentClose(payload?: { annotations: SlideAnnotationMap }): void {
	presenting.value = false;
	const map = payload?.annotations;
	if (!map || map.size === 0) {
		return;
	}
	// Persist kept ink annotations as `ink` elements on their slides. Strokes
	// are converted with the shared `strokeToInkElement` helper (highlighter when
	// the stroke is translucent), appended per slide, and committed as a single
	// history-tracked change so the whole batch undoes together.
	let mutated = false;
	const nextSlides = slides.value.map((slide, index) => {
		const strokes = map.get(index);
		if (!strokes || strokes.length === 0) {
			return slide;
		}
		const inkElements = strokes
			.map((stroke) =>
				strokeToInkElement({
					points: stroke.points,
					color: stroke.color,
					width: stroke.width,
					tool: stroke.opacity < 1 ? 'highlighter' : 'pen',
				}),
			)
			.filter((el): el is NonNullable<typeof el> => el !== null);
		if (inkElements.length === 0) {
			return slide;
		}
		mutated = true;
		return { ...slide, elements: [...slide.elements, ...inkElements] };
	});
	if (mutated) {
		history.pushHistory();
		slides.value = nextSlides;
	}
}
function onPresentSlideChange(index: number): void {
	activeSlideIndex.value = index;
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
// Rasterise the merged slide (template layer included) so exports/print match
// the on-screen presentation and the saved file.
const exportSlide = computed(() => mergedSlides.value[exportIndex.value]);

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
const exportProgressCtl = useExportProgress({ exporter, mediaExport });
const isExporting = computed(() => exporter.exporting.value || mediaExport.exporting.value);
function onExportPng(): void {
	void exporter.exportSlidePng(activeSlideIndex.value);
}
function onExportPdf(): void {
	void exportProgressCtl.runPdf();
}
function onExportGif(): void {
	void exportProgressCtl.runGif();
}
function onExportWebm(): void {
	void exportProgressCtl.runWebm();
}

/** Serialise to a chosen OpenXML format and trigger a browser download. */
async function downloadAs(format: PptxSaveFormat): Promise<void> {
	try {
		const bytes = await saveAs(format);
		const blob = new Blob([bytes as unknown as BlobPart], {
			type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		});
		downloadBlob(blob, `presentation.${format}`);
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

// ── Slide-level mutations (notes / hidden / transition / animations) ──
const {
	onNotesUpdate,
	toggleSlideHidden,
	applySlideTransition,
	applySlideBackgroundPatch,
	onTransitionChange,
	onApplyTransitionToAll,
	onAddAnimation,
	onRemoveAnimation,
} = useSlideMutations({
	slides,
	activeSlideIndex,
	activeSlide,
	pushHistory: history.pushHistory,
	selectedElements,
});

// ── Align / distribute / group ────────────────────────────────────────
const { canGroup, canUngroup, canDistribute, onAlign, onDistribute, onGroup, onUngroup } =
	useAlignGroup({
		selectedElements,
		selectedElementIds,
		activeSlideIndex,
		slides,
		pushHistory: history.pushHistory,
	});

// ── Element context menu (right-click / long-press) ───────────────────
const { contextMenu, contextItems, onCanvasContextMenu, onContextSelect } = useContextMenu({
	canEdit: () => props.canEdit,
	findActiveElement,
	tableSelection,
	hasClipboard,
	canGroup,
	canUngroup,
	editTemplateMode,
	selectedElementIds,
	ops,
	cutElement,
	copyElement,
	pasteElement,
	onGroup,
	onUngroup,
	openHyperlinkDialog,
});

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
/** Open the comments panel and focus the deck on the marker's slide. */
function onCommentMarkerClick(_id: string): void {
	showComments.value = true;
}
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
	getTemplateElements: () => templateElementsBySlideId.value,
	// Retain the loaded source bytes for elected-writer (role 'owner') write-back:
	// the write-back reloads the original file, overlays the live Y.Doc slides,
	// and re-serializes so template/master content survives the round-trip.
	getSourceBytes: () => {
		const c = activeContent.value;
		if (!c) {
			return null;
		}
		return c instanceof Uint8Array ? c : new Uint8Array(c);
	},
	userColor: props.collaboration?.userColor,
	canvasWidth: collabCanvasWidth,
	canvasHeight: collabCanvasHeight,
});
const shareOpen = ref(false);
const collabActive = collab.active;

// Auto-start/stop a session when the host supplies (or clears) a `collaboration`
// config, so URL-driven joins connect without opening the Share dialog.
// Dialog-initiated sessions echo the same config object back through this prop,
// so we compare by reference to avoid restarting a session we already started.
let lastStartedCollab: CollaborationConfig | null = null;
watch(
	() => props.collaboration,
	(config) => {
		if (config && config !== lastStartedCollab) {
			lastStartedCollab = config;
			void collab.start(config);
		} else if (!config && collab.active.value) {
			lastStartedCollab = null;
			collab.stop();
		}
	},
	{ immediate: true },
);

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
	lastStartedCollab = collaboratorConfig;
	void collab.start(collaboratorConfig);
	emit('start-collaboration', collaboratorConfig);
	shareOpen.value = false;
}
function onShareStop(): void {
	lastStartedCollab = null;
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
const hasDigitalSignatures = computed(() => signatures.value.length > 0);
// Warn once, on the first edit of a signed deck, that saving strips signatures
// (mirrors React's useViewerDialogs signature-strip effect).
const showSignatureStripped = ref(false);
const signatureStripAcknowledged = ref(false);
watch(
	() => autosave.isDirty.value,
	(dirty) => {
		if (dirty && hasDigitalSignatures.value && !signatureStripAcknowledged.value) {
			showSignatureStripped.value = true;
		}
	},
);
function onAckSignatureStripped(): void {
	signatureStripAcknowledged.value = true;
	showSignatureStripped.value = false;
}

// ── Broadcast ─────────────────────────────────────────────────────────
const broadcastOpen = ref(false);
const broadcastConfig = ref<{
	roomId: string;
	serverUrl: string;
	transport?: CollaborationTransport;
} | null>(null);
const broadcastViewerUrl = computed(() => {
	if (!broadcastConfig.value || typeof window === 'undefined') {
		return '';
	}
	const { roomId, serverUrl } = broadcastConfig.value;
	return buildBroadcastViewerUrl(roomId, serverUrl, window.location);
});
function onBroadcastStart(config: {
	roomId: string;
	serverUrl: string;
	transport?: CollaborationTransport;
}): void {
	broadcastConfig.value = config;
	// One-way broadcast: the presenter owns navigation; viewers auto-follow via
	// `broadcasterSlideIndex`. The presenter joins with the `owner` role.
	const broadcastSession: CollaborationConfig = {
		...config,
		userName: props.authorName ?? 'Presenter',
		role: 'owner',
	};
	lastStartedCollab = broadcastSession;
	void collab.start(broadcastSession);
	emit('start-collaboration', broadcastSession);
	broadcastOpen.value = false;
}
function onBroadcastStop(): void {
	lastStartedCollab = null;
	broadcastConfig.value = null;
	collab.stop();
	emit('stop-collaboration');
	broadcastOpen.value = false;
}

// ── Set Up Slide Show ─────────────────────────────────────────────────
// Edits a draft copy of the presentation-level properties; on save we commit
// the new properties. `saveAs` forwards `presentationProperties` to
// `handler.save`, so the change round-trips into the saved `.pptx` (same
// persist-via-refs pattern as document properties).
const showSetUpSlideShow = ref(false);
function onSaveSlideShowSettings(next: typeof presentationProperties.value): void {
	presentationProperties.value = next;
	showSubtitles.value = Boolean(next.showSubtitles);
}
/** Merge a partial presentation-properties patch (from the slide inspector). */
function onPresentationPropertiesUpdate(patch: Partial<typeof presentationProperties.value>): void {
	presentationProperties.value = { ...presentationProperties.value, ...patch };
}

// ── Password protection ───────────────────────────────────────────────
// Mirrors React: the password lives in host state; encryption on save is not
// wired in either binding, so this only tracks the protected flag + secret.
const showPasswordDialog = ref(false);
const isPasswordProtected = ref(false);
const presentationPassword = ref<string | null>(null);
function onSetPassword(password: string): void {
	presentationPassword.value = password;
	isPasswordProtected.value = true;
}
function onRemovePassword(): void {
	presentationPassword.value = null;
	isPasswordProtected.value = false;
}

// ── Font embedding ────────────────────────────────────────────────────
const showFontEmbedding = ref(false);
const embedFontsEnabled = ref(false);
/** Unique font families used across every slide, sorted (mirrors React collectUsedFonts). */
const usedFontFamilies = computed<string[]>(() => {
	const fonts = new Set<string>();
	const collect = (el: PptxElement): void => {
		if (hasTextProperties(el)) {
			if (el.textStyle?.fontFamily) {
				fonts.add(el.textStyle.fontFamily);
			}
			for (const seg of el.textSegments ?? []) {
				if (seg.style?.fontFamily) {
					fonts.add(seg.style.fontFamily);
				}
			}
		}
		if (el.type === 'group' && el.children) {
			for (const child of el.children) {
				collect(child);
			}
		}
	};
	for (const slide of slides.value) {
		for (const el of slide.elements ?? []) {
			collect(el);
		}
	}
	return Array.from(fonts).sort();
});
const embeddedFontNames = computed(() => embeddedFonts.value.map((f) => f.name));

// ── Selection pane (View ▸ Selection Pane) ────────────────────────────
const showSelectionPane = ref(false);
function onSelectionPaneSelect(id: string): void {
	selectedElementIds.value = [id];
}
function onSelectionPaneToggleVisibility(id: string): void {
	const el = findActiveElement(id);
	if (el) {
		ops.updateElement(id, { hidden: !el.hidden } as Partial<PptxElement>);
	}
}
function onSelectionPaneReorder(payload: { from: number; to: number }): void {
	const el = activeSlide.value?.elements[payload.from];
	if (el) {
		ops.reorder(el.id, payload.to);
	}
}

// ── Subtitles toggle (Slide Show ▸ Subtitles) ─────────────────────────
const showSubtitles = ref(false);
watch(
	() => presentationProperties.value.showSubtitles,
	(value) => {
		showSubtitles.value = Boolean(value);
	},
	{ immediate: true },
);
function onToggleSubtitles(): void {
	showSubtitles.value = !showSubtitles.value;
	presentationProperties.value = {
		...presentationProperties.value,
		showSubtitles: showSubtitles.value,
	};
}

// ── Responsive / mobile chrome ────────────────────────────────────────
// The viewer root element drives breakpoints from the CONTAINER width (so an
// embedded viewer in a narrow sidebar gets mobile chrome), falling back to the
// viewport when unmounted / no ResizeObserver. Mirrors React's containerRef.
const viewerRootRef = ref<HTMLElement | null>(null);
const { isMobile, isTouchDevice } = useIsMobile(768, viewerRootRef);
// Keep the focused field visible when the on-screen keyboard opens, and lift
// the fixed bottom bar above the keyboard.
const { keyboardInset } = useKeyboardInsets();

// ── Touch gestures (pinch-zoom + long-press) on the main canvas ────────
// The gesture state machine is framework-agnostic (pptx-viewer-shared); this
// composable owns only the native-listener lifecycle. Swipe navigation in view
// mode keeps its own inline handler (onMainTouchStart/End) below; pinch-zoom
// and long-press-to-context-menu are routed through the shared recogniser here.
const mainRef = ref<HTMLElement | null>(null);
useTouchGestures({
	targetRef: mainRef,
	currentScale: zoom,
	minScale: ZOOM_MIN,
	maxScale: ZOOM_MAX,
	enabled: isTouchDevice,
	callbacks: {
		onPinchZoom: (newScale) => {
			zoom.value = Number(newScale.toFixed(2));
		},
		onLongPress: (clientX, clientY) => {
			// Mirror React: long-press opens the element context menu, but only in
			// edit mode with an element already selected.
			if (!props.canEdit || presenting.value) {
				return;
			}
			const id = selectedElementIds.value[0];
			if (!id) {
				return;
			}
			contextMenu.value = { open: true, x: clientX, y: clientY, elementId: id };
		},
	},
});
const mobileNotesOpen = ref(false);
/** Mobile-only bottom sheets for panels that are right-rail sidebars on desktop. */
const mobileInspectorOpen = ref(false);
const mobileCommentsOpen = ref(false);
/** Mobile-only slide-rail sheet (the slides panel is a left rail on desktop). */
const mobileSlidesOpen = ref(false);

/** Open one mobile sheet at a time so they don't stack over each other. */
function openMobileSheet(which: 'slides' | 'format' | 'comments' | 'notes'): void {
	mobileSlidesOpen.value = which === 'slides';
	mobileInspectorOpen.value = which === 'format';
	mobileCommentsOpen.value = which === 'comments';
	mobileNotesOpen.value = which === 'notes';
}

/**
 * Quick-insert from the mobile bottom bar: a text box is the most common
 * starter element on a phone; the full Insert section lives in the top-bar
 * Menu sheet. Mirrors React's MobileBottomBar `onOpenInsert`.
 */
function mobileQuickInsert(): void {
	addText();
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
// Section-grouped thumbnails render the merged slides (template layer included)
// so the rail matches the canvas; grouping/order still come from `sectionOps`.
const mergedSlidesBySection = computed(() =>
	sectionOps.slidesBySection.value.map((group) => ({
		...group,
		slides: group.slides.map((slide) => mergedSlideById.value.get(slide.id) ?? slide),
	})),
);

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
	// Partition into template ids (master-/layout- prefix) and normal slide ids so
	// the nudge routes through the correct store for each group. Without this split
	// a selected template element is silently skipped (it lives in the template
	// store, not in slide.elements) and the arrow-key move is lost.
	const templateIds = new Set([...ids].filter((id) => isTemplateElementId(id)));
	const slideIds = new Set([...ids].filter((id) => !isTemplateElementId(id)));
	history.pushHistory();
	if (templateIds.size > 0) {
		const current = templateElementsBySlideId.value[slide.id];
		if (current) {
			templateElementsBySlideId.value = setTemplateElements(
				templateElementsBySlideId.value,
				slide.id,
				current.map((el) => (templateIds.has(el.id) ? { ...el, x: el.x + dx, y: el.y + dy } : el)),
			);
		}
	}
	if (slideIds.size > 0) {
		const nextSlides = slides.value.slice();
		nextSlides[index] = {
			...slide,
			elements: slide.elements.map((el) =>
				slideIds.has(el.id) ? { ...el, x: el.x + dx, y: el.y + dy } : el,
			),
		};
		slides.value = nextSlides;
	}
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
/** Ribbon content expanded (true) vs collapsed to just the tab bar (false). */
const ribbonExpanded = ref(true);
const overflowOpen = ref(false);
/** Status-bar Notes toggle: expands/collapses the desktop notes panel. */
const notesExpanded = ref(false);
/** View-tab dot-grid overlay (snap-to-grid state lives in useElementDrag). */
const showGrid = ref(false);
/** View ▸ Rulers: horizontal/vertical rulers along the slide edges. */
const showRulers = ref(false);
/** View ▸ Spell: draw the browser's native spell-check squiggles while editing. */
const spellCheckEnabled = ref(true);
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

const { ribbonMode, activeTableSelection, ribbonUpdateTextStyle, ribbonFlip, ribbonMoveToEdge } =
	useRibbonActions({
		canEdit: () => props.canEdit,
		presenting,
		showMasterView,
		tableSelection,
		selectedElements,
		selectedElementIds,
		activeSlide,
		activeSlideIndex,
		slides,
		pushHistory: history.pushHistory,
		ops,
	});

const ribbonProps = computed<RibbonProps>(() => ({
	mode: ribbonMode.value,
	canEdit: props.canEdit,
	isNarrowViewport: isMobile.value,
	isSidebarCollapsed: sidebarCollapsed.value,
	isInspectorPaneOpen: inspectorOpen.value,
	isCompactToolbarOpen: ribbonExpanded.value,
	toolbarSection: toolbarSection.value,
	scale: zoom.value,
	canUndo: history.canUndo.value,
	canRedo: history.canRedo.value,
	undoLabel: undefined,
	redoLabel: undefined,
	findReplaceOpen: findOpen.value,
	selectedElement: selectedElements.value[0] ?? null,
	tableEditorState: activeTableSelection.value,
	editTemplateMode: editTemplateMode.value,
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
	isSelectionPaneOpen: showSelectionPane.value,
	eyedropperActive: false,
	showSubtitles: showSubtitles.value,
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
	onToggleCompactToolbar: () => {
		ribbonExpanded.value = !ribbonExpanded.value;
	},
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
	onAddChart: addChart,
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
	onSetEditTemplateMode: (mode: boolean) => {
		editTemplateMode.value = mode;
	},
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
	onDistributeElements: (axis) => {
		if (axis === 'horizontal' || axis === 'vertical') {
			onDistribute(axis as DistributeAxis);
		}
	},
	canDistribute: canDistribute.value,
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
	onOpenPasswordProtection: () => {
		showPasswordDialog.value = true;
	},
	onOpenDocumentProperties: () => {
		propertiesOpen.value = true;
	},
	onOpenFontEmbedding: () => {
		showFontEmbedding.value = true;
	},
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
	onToggleSelectionPane: () => {
		showSelectionPane.value = !showSelectionPane.value;
	},
	onToggleEyedropper: undefined,
	onOpenSetUpSlideShow: () => {
		showSetUpSlideShow.value = true;
	},
	onOpenBroadcastDialog: () => {
		broadcastOpen.value = true;
	},
	onToggleSubtitles,
	onTransitionChange,
	onApplyTransitionToAll,
}));

// ── Imperative surface (mirrors the React forwardRef handle) ──────────
defineExpose<PowerPointViewerExpose>({ getContent });
</script>

<template>
	<div
		ref="viewerRootRef"
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
			<!-- Office-style ribbon on wide viewports; compact mobile top bar
			     (menu / undo / redo / save / present / share) on narrow viewports
			     (< 768px container width). Mirrors React's Toolbar.tsx which
			     swaps in <MobileToolbar> when isNarrowViewport is true. The
			     hamburger opens MobileMenuSheet so every ribbon section stays
			     reachable on a phone where the desktop ribbon is hidden.
			     Unmounted while presenting (mirrors React's `mode !== 'present'`
			     gate on `ViewerToolbarSection`): the full-screen PresentationMode
			     overlay already covers it visually, but leaving it mounted keeps
			     its controls tab-focusable and creates duplicate accessible names
			     (e.g. a second "Present" / "Menu" button) underneath the overlay. -->
			<template v-if="!presenting">
				<RibbonToolbar v-if="!isMobile" v-bind="ribbonProps" />
				<MobileToolbar v-else v-bind="ribbonProps" />
			</template>

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
					:slides="mergedSlides"
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
						:groups="mergedSlidesBySection"
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
					ref="mainRef"
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
						:template-elements="activeTemplateElements"
						:edit-template-mode="editTemplateMode && !presenting"
						@update:fit-scale="fitScale = $event"
					>
						<!-- Dot grid overlay (View ▸ Grid): sits over content, under selection -->
						<GridOverlay :canvas-size="canvasSize" :visible="showGrid && !presenting" />
						<!-- Numbered comment markers (click to open the comments panel) -->
						<CommentMarkersOverlay
							v-if="props.canEdit && !presenting && activeComments.length > 0"
							:comments="activeComments"
							:canvas-size="canvasSize"
							@marker-click="onCommentMarkerClick"
						/>
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
							@format="ribbonUpdateTextStyle"
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
					:can-edit="props.canEdit"
					@update="onInspectorUpdate"
				/>

				<!-- Slide-level inspector (no element selected): slide transition, etc. -->
				<SlideInspector
					v-else-if="props.canEdit && !isMobile && inspectorOpen && slideCount > 0"
					:slide="activeSlide"
					:theme="pptxTheme"
					:presentation-properties="presentationProperties"
					:can-edit="props.canEdit"
					@transition-update="applySlideTransition"
					@slide-update="applySlideBackgroundPatch"
					@presentation-update="onPresentationPropertiesUpdate"
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
					@reply="(p) => commitComments(commentsApi.replyToComment(p.parentId, p.text))"
				/>

				<!-- Signed-document badge (opens the signatures panel). -->
				<div
					v-if="hasDigitalSignatures && !isMobile"
					class="pointer-events-auto absolute right-2 top-2 z-50"
				>
					<SignatureStatusBadge
						:has-signatures="hasDigitalSignatures"
						:signature-count="signatures.length"
						@click="showSignatures = true"
					/>
				</div>

				<!-- Digital signatures -->
				<SignaturesPanel v-if="showSignatures" :signatures="signatures" />

				<!-- Selection pane (View ▸ Selection Pane): object list + z-order +
				     visibility over the active slide's elements. -->
				<SelectionPane
					v-if="props.canEdit && !isMobile && showSelectionPane"
					:elements="activeSlide?.elements ?? []"
					:selected-ids="selectedElementIds"
					:can-edit="props.canEdit"
					@select="onSelectionPaneSelect"
					@toggle-visibility="onSelectionPaneToggleVisibility"
					@reorder="onSelectionPaneReorder"
					@close="showSelectionPane = false"
				/>

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
				:can-edit="props.canEdit"
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
				:slide-count="slideCount"
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

			<!-- Slide Show ▸ Set Up Slide Show -->
			<SetUpSlideShowDialog
				:open="showSetUpSlideShow"
				:properties="presentationProperties"
				:custom-shows="customShows"
				:slide-count="slideCount"
				@save="onSaveSlideShowSettings"
				@close="showSetUpSlideShow = false"
			/>

			<!-- File ▸ Protect Presentation -->
			<PasswordProtectionDialog
				:open="showPasswordDialog"
				:is-currently-protected="isPasswordProtected"
				@set-password="onSetPassword"
				@remove-password="onRemovePassword"
				@close="showPasswordDialog = false"
			/>

			<!-- File ▸ Embed Fonts -->
			<FontEmbeddingPanel
				:open="showFontEmbedding"
				:embed-fonts-enabled="embedFontsEnabled"
				:used-font-families="usedFontFamilies"
				:embedded-fonts="embeddedFontNames"
				@toggle-embed-fonts="embedFontsEnabled = $event"
				@close="showFontEmbedding = false"
			/>

			<!-- First-edit warning: saving a signed deck strips its signatures. -->
			<SignatureStrippedDialog
				:open="showSignatureStripped"
				:signature-count="signatures.length"
				@confirm="onAckSignatureStripped"
				@cancel="onAckSignatureStripped"
			/>

			<!-- Mobile bottom bar. Unmounted while presenting (mirrors React's
			     `mode !== 'present'` gate on `MobileChromeOverlay`): otherwise its
			     own "Next slide" / "Previous slide" buttons stay mounted (just
			     covered by the full-screen PresentationMode overlay) and collide
			     with the presentation's own same-named touch controls for
			     accessible-role queries. -->
			<MobileBottomBar
				v-if="isMobile && !presenting"
				:slide-index="activeSlideIndex"
				:slide-count="slideCount"
				:zoom-percent="zoomPercent"
				:can-edit="props.canEdit"
				:keyboard-inset="keyboardInset"
				:comment-count="activeComments.length"
				@prev="goPrev"
				@next="goNext"
				@zoom-in="zoomIn"
				@zoom-out="zoomOut"
				@present="present"
				@slides="mobileSlidesOpen ? (mobileSlidesOpen = false) : openMobileSheet('slides')"
				@insert="mobileQuickInsert"
				@format="mobileInspectorOpen ? (mobileInspectorOpen = false) : openMobileSheet('format')"
				@comments="mobileCommentsOpen ? (mobileCommentsOpen = false) : openMobileSheet('comments')"
				@save="downloadAs('pptx')"
				@notes="mobileNotesOpen ? (mobileNotesOpen = false) : openMobileSheet('notes')"
				@menu="showSorter = true"
			/>

			<!-- Mobile slide-rail sheet (the slides panel is a left rail on
			     desktop, hidden inline on mobile). Reuses SlidesPaneSidebar inside
			     the shared swipe-dismiss MobileSheet; selecting a slide closes it. -->
			<MobileSlidesSheet
				v-if="isMobile && !presenting"
				:open="mobileSlidesOpen"
				:slides="mergedSlides"
				:active-index="activeSlideIndex"
				:canvas-size="canvasSize"
				:media-data-urls="mediaDataUrls"
				:can-edit="props.canEdit"
				@close="mobileSlidesOpen = false"
				@select="goTo"
				@reorder="(p) => slideOps.moveSlide(p.from, p.to)"
				@add-slide="slideOps.addSlide()"
				@duplicate="(i) => slideOps.duplicateSlide(i)"
				@delete="(i) => slideOps.deleteSlide(i)"
				@toggle-hidden="toggleSlideHidden"
			/>

			<!-- Mobile speaker-notes sheet (toggled from the bottom bar). Uses the
			     shared MobileSheet so it swipe-dismisses like Format/Comments. -->
			<MobileSheet
				v-if="isMobile && !presenting"
				:open="mobileNotesOpen"
				title="Notes"
				@close="mobileNotesOpen = false"
			>
				<NotesPanel :slide="activeSlide" @update="onNotesUpdate" />
			</MobileSheet>

			<!-- Mobile Format / properties sheet (right-rail inspector on desktop) -->
			<MobileSheet
				v-if="isMobile && props.canEdit && !presenting"
				:open="mobileInspectorOpen"
				title="Format"
				@close="mobileInspectorOpen = false"
			>
				<InspectorPane
					v-if="inspectorElementForPanels"
					mobile
					:element="inspectorElementForPanels"
					:can-edit="props.canEdit"
					@update="onInspectorUpdate"
				/>
				<SlideInspector
					v-else-if="slideCount > 0"
					mobile
					:slide="activeSlide"
					:theme="pptxTheme"
					:presentation-properties="presentationProperties"
					:can-edit="props.canEdit"
					@transition-update="applySlideTransition"
					@slide-update="applySlideBackgroundPatch"
					@presentation-update="onPresentationPropertiesUpdate"
				/>
				<p v-else class="px-4 py-6 text-center text-xs text-muted-foreground">No slide selected.</p>
			</MobileSheet>

			<!-- Mobile Comments sheet (right-rail panel on desktop) -->
			<MobileSheet
				v-if="isMobile && props.canEdit && !presenting"
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
					@reply="(p) => commitComments(commentsApi.replyToComment(p.parentId, p.text))"
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

		<!-- Export progress overlay (PDF / GIF / WebM) -->
		<ExportProgressModal
			:open="exportProgressCtl.exportModalOpen.value"
			:title="exportProgressCtl.exportModalTitle.value"
			:progress="exportProgressCtl.exportProgress.value"
			:status-message="exportProgressCtl.exportStatusMessage.value"
			@cancel="exportProgressCtl.cancelExport"
		/>

		<!-- Slide sorter overlay -->
		<SlideSorter
			v-if="showSorter"
			:slides="mergedSlides"
			:canvas-size="canvasSize"
			:media-data-urls="mediaDataUrls"
			:active-index="activeSlideIndex"
			:can-edit="props.canEdit"
			@select="onSorterSelect"
			@reorder="onSorterReorder"
			@duplicate="(i) => slideOps.duplicateSlide(i)"
			@delete="(i) => slideOps.deleteSlide(i)"
			@toggle-hidden="toggleSlideHidden"
			@close="showSorter = false"
		/>

		<!-- Presentation / slideshow overlay -->
		<PresentationMode
			v-if="presenting"
			:slides="mergedSlides"
			:canvas-size="canvasSize"
			:media-data-urls="mediaDataUrls"
			:start-index="activeSlideIndex"
			@close="onPresentClose"
			@slide-change="onPresentSlideChange"
		/>
	</div>
</template>
