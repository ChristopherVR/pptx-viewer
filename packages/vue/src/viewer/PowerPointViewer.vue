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
	buildUserFontFaceStyles,
	downloadBlob,
	isTemplateElementId,
	openPptxFile,
	setCellText,
	strokeToInkElement,
} from 'pptx-viewer-shared';
import { computed, nextTick, provide, ref, toRef, watch, watchEffect } from 'vue';
import { useI18n } from 'vue-i18n';

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
import DrawingOverlay from './components/DrawingOverlay.vue';
import type { ShapePreset } from './components/EditorToolbar.vue';
import EquationEditorDialog from './components/EquationEditorDialog.vue';
import ExportProgressModal from './components/ExportProgressModal.vue';
import FindReplaceBar from './components/FindReplaceBar.vue';
import FollowModeBar from './components/FollowModeBar.vue';
import FontEmbeddingPanel from './components/FontEmbeddingPanel.vue';
import GridOverlay from './components/GridOverlay.vue';
import HandoutMasterCanvas from './components/HandoutMasterCanvas.vue';
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
import NotesMasterCanvas from './components/NotesMasterCanvas.vue';
import NotesPanel from './components/NotesPanel.vue';
import PasswordProtectionDialog from './components/PasswordProtectionDialog.vue';
import PresentationMode from './components/PresentationMode.vue';
import PrintDialog from './components/PrintDialog.vue';
import RehearseTimingsHud from './components/RehearseTimingsHud.vue';
import RehearseTimingsSummary from './components/RehearseTimingsSummary.vue';
import RemoteSelectionOverlay from './components/RemoteSelectionOverlay.vue';
import RibbonToolbar from './components/ribbon/RibbonToolbar.vue';
import TitleBar from './components/ribbon/TitleBar.vue';
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
import { useChartCanvasEditContext } from './composables/chart-part-selection';
import { FieldContextKey, resolveSlideTitle } from './composables/field-context';
import { SmartArt3DKey } from './composables/smart-art-3d';
import { TableThemeKey } from './composables/table-theme';
import { buildSaveSlides, isElementIdInteractive } from './composables/template-editing';
import { useAccessibility } from './composables/useAccessibility';
import { useAlignGroup } from './composables/useAlignGroup';
import { useAutosave } from './composables/useAutosave';
import { useCollaborationWiring } from './composables/useCollaborationWiring';
import { useCommentsWiring } from './composables/useCommentsWiring';
import { useContextMenu } from './composables/useContextMenu';
import { useCustomShowsWiring } from './composables/useCustomShowsWiring';
import { useDocumentPropertiesDialog } from './composables/useDocumentPropertiesDialog';
import { useEditorHistory } from './composables/useEditorHistory';
import { useEditorKeyboard } from './composables/useEditorKeyboard';
import { useEditorOperations } from './composables/useEditorOperations';
import { useElementDrag } from './composables/useElementDrag';
import { useElementInsertion } from './composables/useElementInsertion';
import { useEmbeddedFonts } from './composables/useEmbeddedFonts';
import { useExportWiring } from './composables/useExportWiring';
import { useFindReplace } from './composables/useFindReplace';
import { useFontEmbedding } from './composables/useFontEmbedding';
import { useFormatPainter } from './composables/useFormatPainter';
import { useHeaderFooterDialog } from './composables/useHeaderFooterDialog';
import { useInkDrawing } from './composables/useInkDrawing';
import { useInlineEditing } from './composables/useInlineEditing';
import { useInsertElementDialogs } from './composables/useInsertElementDialogs';
import { useIsMobile } from './composables/useIsMobile';
import { useKeyboardInsets } from './composables/useKeyboardInsets';
import { useLoadContent } from './composables/useLoadContent';
import { useMasterViewState } from './composables/useMasterViewState';
import { useMobileChrome } from './composables/useMobileChrome';
import { useMultiSelectOps } from './composables/useMultiSelectOps';
import { usePasswordProtection } from './composables/usePasswordProtection';
import { usePresentationModeWiring } from './composables/usePresentationModeWiring';
import { usePrint } from './composables/usePrint';
import { useRehearseTimings } from './composables/useRehearseTimings';
import { useRibbonActions } from './composables/useRibbonActions';
import { useRibbonProps } from './composables/useRibbonProps';
import { useRibbonUiState } from './composables/useRibbonUiState';
import { useSectionOperations } from './composables/useSectionOperations';
import { useSelectionPaneWiring } from './composables/useSelectionPaneWiring';
import { useSignatureWorkflow } from './composables/useSignatureWorkflow';
import { useSlideMutations } from './composables/useSlideMutations';
import { useSlideOperations } from './composables/useSlideOperations';
import { useSlideShowSettings } from './composables/useSlideShowSettings';
import { useSmartArtNodeEditContext } from './composables/useSmartArtNodeEditContext';
import { useTableCellEditingContext } from './composables/useTableCellEditingContext';
import { useThemeEditing } from './composables/useThemeEditing';
import { useTouchGestures } from './composables/useTouchGestures';
import { useVersionHistoryWiring } from './composables/useVersionHistoryWiring';
import { useViewerSettingsDialog } from './composables/useViewerSettingsDialog';
import { provideZoomTargetLookup, toZoomTargetInfo } from './composables/zoom-target';
import type { PowerPointViewerEmits, PowerPointViewerExpose, PowerPointViewerProps } from './types';

const props = withDefaults(defineProps<PowerPointViewerProps>(), {
	canEdit: false,
	smartArt3D: false,
});
const emit = defineEmits<PowerPointViewerEmits>();

const { t } = useI18n();

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

// Inline table-cell editing + table cell selection/resize contexts for
// `TableRenderer` / `TablePanel`. Dependencies that don't exist yet at this
// point in setup (`ops`, `presenting`, `commitTableCell`) are passed as
// wrapper closures, deferred until actually called (same forward-reference
// pattern used throughout this component).
const { tableSelection } = useTableCellEditingContext({
	canEdit: () => props.canEdit,
	canEditInline: () => props.canEdit && !presenting.value,
	findActiveElement,
	updateElement: (id, patch) => ops.updateElement(id, patch),
	commitTableCell: (elementId, rowIndex, colIndex, text) =>
		commitTableCell(elementId, rowIndex, colIndex, text),
});

// Inline SmartArt node-text and per-node fill editing context. Mirrors the
// table-cell context above (same forward-reference / wrapper-closure pattern).
useSmartArtNodeEditContext({
	canEdit: () => props.canEdit,
	canEditInline: () => props.canEdit && !presenting.value,
	findActiveElement,
	updateElement: (id, patch) => ops.updateElement(id, patch),
});

// Inject embedded fonts as @font-face (side effect; auto-cleaned on unmount).
useEmbeddedFonts(embeddedFonts);
watchEffect((onCleanup) => {
	const css = buildUserFontFaceStyles(props.fonts ?? []);
	if (!css || typeof document === 'undefined') {
		return;
	}
	const style = document.createElement('style');
	style.dataset.pptxUserFonts = 'vue';
	style.textContent = css;
	document.head.appendChild(style);
	onCleanup(() => style.remove());
});

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
// px - matches the thumbnail rail content width (180px rail - 2x0.75rem
// padding) and React's SLIDE_NAV_THUMBNAIL_WIDTH so thumbnails render at the
// same size across bindings.
const THUMB_WIDTH = 156;

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

// ── Emit events for zoom, selection, and slide count ──────────────────
watch(zoom, (level) => {
	emit('zoom-change', level);
});
watch(selectedElementIds, (ids) => {
	emit('selection-change', ids);
});
watch(slideCount, (count) => {
	emit('slide-count-change', count);
});

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
const {
	formatPainterActive,
	canActivateFormatPainter,
	toggleFormatPainter,
	cancelFormatPainter,
	applyFormatToTarget,
} = useFormatPainter({ selectedElements, findActiveElement, ops });

// ── Inline text editing ───────────────────────────────────────────────
// Entered by tapping an already-selected element (SelectionOverlay emits
// `requestEdit`). Commits on blur, on selecting another element, or on an
// empty-canvas tap; the typed text is remapped back onto the rich segments.
const {
	inlineEditingElementId,
	inlineEditingText,
	inlineEditingElement,
	enterInlineEdit,
	commitInlineEdit,
	cancelInlineEdit,
	commitTableCell,
} = useInlineEditing({ canEdit: () => props.canEdit, findActiveElement, ops });

// ── Insert SmartArt / equation ────────────────────────────────────────
// Declared before the drag/selection wiring below so `requestElementEdit`
// (the tap/double-click route into element editing) can consult it.
const {
	showInsertSmartArt,
	showEquationEditor,
	editingEquationOmml,
	onInsertElement,
	openEquationEditorForElement,
	onApplyEquation,
	closeEquationEditor,
} = useInsertElementDialogs({ ops, selectedElementIds, findActiveElement });

/**
 * Route a tap / double-click that should open an element for editing: an
 * equation element opens the equation editor (inline text editing would only
 * see the "[Equation]" placeholder and destroy the OMML on commit), everything
 * else enters ordinary inline text editing.
 */
function requestElementEdit(id: string): void {
	const el = findActiveElement(id);
	if (el && openEquationEditorForElement(el)) {
		return;
	}
	enterInlineEdit(id);
}

/** Double-clicking a rendered equation always opens its edit dialog. */
function onCanvasDoubleClick(event: MouseEvent): void {
	const target = event.target instanceof Element ? event.target : null;
	const id = target?.closest<HTMLElement>('[data-element-id]')?.dataset.elementId;
	if (!id) {
		return;
	}
	const element = findActiveElement(id);
	if (
		element &&
		hasTextProperties(element) &&
		(element.textSegments ?? []).some((segment) => segment.equationXml)
	) {
		requestElementEdit(id);
	}
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

/** Click-to-select via event delegation (elements render `data-element-id`). */
// ── Touch double-tap detection (mirrors React/Angular canvas-level detection) ──
// On mobile, native `dblclick` is not reliably synthesised from two quick taps.
// Track the last touch tap by element id and coordinates.
const DOUBLE_TAP_MS = 400;
const lastCanvasTap = ref<{ id: string; time: number; x: number; y: number } | null>(null);

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

	// On touch, if a table cell is being edited and the tap did NOT land inside
	// the cell input itself (the input stops its own pointerdown), the
	// TableRenderer's document-level pointerdown listener handles blur/commit.
	// (See TableRenderer.vue: docListener.)

	// Touch double-tap detection: two quick taps on the same element (or close
	// enough coordinates that the element didn't move) trigger inline/cell edit.
	if (event.pointerType !== 'mouse') {
		const now = event.timeStamp || Date.now();
		const last = lastCanvasTap.value;

		// Resolve the element id: prefer the event target's ancestry, but fall
		// back to elementFromPoint (covers cases where an overlay div intercepts).
		const hitEl = document.elementFromPoint(event.clientX, event.clientY);
		const hitHost = (hitEl?.closest('[data-element-id]') ??
			target?.closest('[data-element-id]')) as HTMLElement | null;
		const hitElementId = hitHost?.dataset.elementId;
		const resolvedId =
			hitElementId && isElementIdInteractive(hitElementId, editTemplateMode.value)
				? hitElementId
				: id;

		// On the second tap, match against the first tap's element. Layout may
		// shift between taps (selection causing fitScale change), so the second
		// tap might not resolve to ANY element. Use proximity + the stored id.
		const TAP_DISTANCE = 40; // px tolerance for matching taps after reflow
		const isSameTarget =
			last &&
			now - last.time < DOUBLE_TAP_MS &&
			(resolvedId === last.id ||
				(Math.abs(event.clientX - last.x) < TAP_DISTANCE &&
					Math.abs(event.clientY - last.y) < TAP_DISTANCE));

		if (last && isSameTarget) {
			lastCanvasTap.value = null;
			const doubleTapId = resolvedId ?? last.id;
			const el = findActiveElement(doubleTapId);
			if (el?.type === 'table') {
				// For table elements: find the cell under the tap coordinates.
				// After selection reflow, elementFromPoint may not hit the <td>
				// directly; search the table element's DOM for the closest cell.
				const tableHost = document.querySelector(`[data-element-id="${doubleTapId}"]`);
				const tds = tableHost?.querySelectorAll('td');
				let closestTd: HTMLElement | null = null;
				if (tds && tds.length > 0) {
					let minDist = Infinity;
					for (const td of tds) {
						const r = td.getBoundingClientRect();
						if (r.width === 0 || r.height === 0) {
							continue;
						}
						const cx = r.left + r.width / 2;
						const cy = r.top + r.height / 2;
						const dist = Math.hypot(event.clientX - cx, event.clientY - cy);
						if (dist < minDist) {
							minDist = dist;
							closestTd = td as HTMLElement;
						}
					}
				}
				if (closestTd) {
					closestTd.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
					return;
				}
			}
			// For text elements: enter inline text edit (equations route to the
			// equation editor instead of destructive plain-text editing).
			if (doubleTapId) {
				requestElementEdit(doubleTapId);
			}
			return;
		}
		if (resolvedId) {
			lastCanvasTap.value = { id: resolvedId, time: now, x: event.clientX, y: event.clientY };
		} else if (last && now - last.time < DOUBLE_TAP_MS) {
			// Keep the previous tap alive if no element resolved (second tap in
			// reflowed area); the proximity check above will still match.
		} else {
			lastCanvasTap.value = null;
		}
	}

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
	enterInlineEdit: requestElementEdit,
});

// ── Element insertion (Insert tab) ───────────────────────────────────
const {
	imageInputRef,
	mediaInputRef,
	addText,
	addShape,
	addTable,
	addChart,
	addField,
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
const { deleteSelected, duplicateSelected, bringForward, sendBackward } = useMultiSelectOps({
	selectedElementIds,
	ops,
	clearSelection,
});

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
const { presenting, startPresenting, onPresentClose, onPresentSlideChange } =
	usePresentationModeWiring({
		slides,
		activeSlideIndex,
		pushHistory: history.pushHistory,
	});
const startInPresenterView = ref(false);
const rehearsal = useRehearseTimings({
	onSave: (timings) => {
		history.pushHistory();
		slides.value = slides.value.map((slide, index) => {
			const advanceAfterMs = timings[index];
			return typeof advanceAfterMs !== 'number'
				? slide
				: {
						...slide,
						transition: {
							...slide.transition,
							type: slide.transition?.type ?? 'none',
							advanceAfterMs,
						},
					};
		});
	},
});
function startPresenterView(): void {
	startInPresenterView.value = true;
	startPresenting();
}
function startRehearsal(): void {
	startInPresenterView.value = false;
	rehearsal.start();
	startPresenting();
}
function closePresentation(payload?: Parameters<typeof onPresentClose>[0]): void {
	if (rehearsal.rehearsing.value) {
		rehearsal.recordCurrentSlideTime(activeSlideIndex.value);
		rehearsal.finish();
	}
	onPresentClose(payload);
	startInPresenterView.value = false;
}
function handlePresentSlideChange(index: number): void {
	if (rehearsal.rehearsing.value) {
		rehearsal.recordCurrentSlideTime(activeSlideIndex.value);
	}
	onPresentSlideChange(index);
}

// Direct on-canvas chart editing context (mirrors the SmartArt node-edit
// context above): gates mark interactivity to the selected chart in edit
// mode, carries the canvas <-> inspector part selection, and routes commits
// through the SAME history-tracked editor op the inspector uses.
useChartCanvasEditContext({
	canEditInline: () => props.canEdit && !presenting.value,
	isElementSelected: (id) => selectedElementIds.value.includes(id),
	updateElement: (id, patch) => ops.updateElement(id, patch),
});

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
const {
	exportStageRef,
	exportSlide,
	rasterizeSlide,
	exporter,
	mediaExport,
	exportProgressCtl,
	isExporting,
	onExportPng,
	onExportPdf,
	onExportGif,
	onExportWebm,
	downloadAs,
	onCopySlideAsImage,
} = useExportWiring({ mergedSlides, slides, slideCount, canvasSize, activeSlideIndex, saveAs });

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
// `autosaveEnabled` is the title-bar AutoSave toggle (user-facing, defaults on),
// mirroring React's `autosaveEnabled` useState(true). The engine only runs when
// the host has opted into autosave AND editing is allowed AND the toggle is on.
const autosaveEnabled = ref(true);
const autosaveActive = computed(
	() => props.canEdit && (props.autosave ?? false) && autosaveEnabled.value,
);
/**
 * When autosave is inactive, this computed explains why so the title bar can
 * display a meaningful status message to the user.
 */
const autosaveDisabledReason = computed<string | undefined>(() => {
	if (autosaveActive.value) {
		return undefined;
	}
	if (!autosaveEnabled.value) {
		return 'autosave_toggle_off';
	}
	if (!props.autosave) {
		return 'no_file_path';
	}
	if (!props.canEdit) {
		return 'autosave_toggle_off';
	}
	return undefined;
});
function toggleAutosave(): void {
	autosaveEnabled.value = !autosaveEnabled.value;
}
const autosave = useAutosave({
	slides,
	enabled: autosaveActive,
	intervalMs: props.autosaveIntervalMs ?? 2000,
	onSave: async () => {
		const bytes = await getContent();
		emit('autosave', bytes);
		// Snapshot a restorable version on each autosave.
		versionHistory.capture('Autosave', Date.now());
	},
});
// Loading a deck reassigns `slides`, which the autosave watcher counts as an
// edit; clear the dirty flag once loading settles so a freshly opened deck
// reads "Saved to this PC" in the title bar, matching React.
watch(loading, (now, was) => {
	if (was && !now) {
		autosave.isDirty.value = false;
	}
});

// ── Comments ──────────────────────────────────────────────────────────
const authorNameRef = computed(() => props.authorName ?? 'You');
const { showComments, activeComments, commentsApi, onCommentMarkerClick, commitComments } =
	useCommentsWiring({
		activeSlide,
		activeSlideIndex,
		slides,
		authorName: authorNameRef,
		pushHistory: history.pushHistory,
	});

// ── Collaboration (Yjs) + broadcast ────────────────────────────────────
const {
	collab,
	collabActive,
	shareOpen,
	onShareStart,
	onShareStop,
	onCollabPointerMove,
	broadcastOpen,
	broadcastViewerUrl,
	onBroadcastStart,
	onBroadcastStop,
} = useCollaborationWiring({
	slides,
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
	initialUserColor: props.collaboration?.userColor,
	canvasWidth: computed(() => canvasSize.value.width),
	canvasHeight: computed(() => canvasSize.value.height),
	collaborationProp: () => props.collaboration,
	selectedElementIds,
	activeSlideIndex,
	goTo,
	effectiveZoom,
	authorName: () => props.authorName,
	onStartCollaboration: (config) => emit('start-collaboration', config),
	onStopCollaboration: () => emit('stop-collaboration'),
});

// ── Digital signatures ────────────────────────────────────────────────
const {
	showSignatures,
	signaturesApi,
	hasDigitalSignatures,
	showSignatureStripped,
	onAckSignatureStripped,
} = useSignatureWorkflow({ signatures, isDirty: autosave.isDirty });

// ── Set Up Slide Show + Subtitles ──────────────────────────────────────
const {
	showSetUpSlideShow,
	showSubtitles,
	onSaveSlideShowSettings,
	onPresentationPropertiesUpdate,
	onToggleSubtitles,
} = useSlideShowSettings({ presentationProperties });

// ── Password protection ───────────────────────────────────────────────
const {
	showPasswordDialog,
	isPasswordProtected,
	presentationPassword,
	onSetPassword,
	onRemovePassword,
} = usePasswordProtection();

// ── Font embedding ────────────────────────────────────────────────────
const { showFontEmbedding, embedFontsEnabled, usedFontFamilies, embeddedFontNames } =
	useFontEmbedding({
		slides,
		embeddedFonts,
	});

// ── Selection pane (View ▸ Selection Pane) ────────────────────────────
const {
	showSelectionPane,
	onSelectionPaneSelect,
	onSelectionPaneToggleVisibility,
	onSelectionPaneReorder,
} = useSelectionPaneWiring({ findActiveElement, activeSlide, selectedElementIds, ops });

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
const {
	mobileSlidesOpen,
	mobileInspectorOpen,
	mobileCommentsOpen,
	mobileNotesOpen,
	openMobileSheet,
	mobileQuickInsert,
	present,
} = useMobileChrome({ presenting, addText });

// ── Document properties dialog ────────────────────────────────────────
const { propertiesOpen, onPropertiesSave } = useDocumentPropertiesDialog({
	coreProperties,
	customProperties,
	appProperties,
});

// ── Master view (slide / notes / handout masters) ─────────────────────
const {
	showMasterView,
	masterViewTab,
	activeMasterIndex,
	activeLayoutIndex,
	handoutSlidesPerPage,
	onSelectMaster,
	onSelectLayout,
} = useMasterViewState();

function onNotesMasterBackgroundChange(backgroundColor: string): void {
	if (!notesMaster.value) {
		return;
	}
	notesMaster.value = { ...notesMaster.value, backgroundColor };
	autosave.isDirty.value = true;
}

function onHandoutMasterBackgroundChange(backgroundColor: string): void {
	if (!handoutMaster.value) {
		return;
	}
	handoutMaster.value = { ...handoutMaster.value, backgroundColor };
	autosave.isDirty.value = true;
}

function onHandoutSlidesPerPageChange(slidesPerPage: number): void {
	handoutSlidesPerPage.value = slidesPerPage;
	if (handoutMaster.value) {
		handoutMaster.value = { ...handoutMaster.value, slidesPerPage };
		autosave.isDirty.value = true;
	}
}

const activeMasterViewSlide = computed<PptxSlide | undefined>(() => {
	const master = slideMasters.value[activeMasterIndex.value];
	if (!master) {
		return undefined;
	}
	const layout =
		activeLayoutIndex.value === null ? undefined : master.layouts?.[activeLayoutIndex.value];
	return {
		id: layout?.path ?? master.path,
		rId: '',
		slideNumber: 0,
		elements: layout
			? [...(master.elements ?? []), ...(layout.elements ?? [])]
			: (master.elements ?? []),
		backgroundColor: layout?.backgroundColor ?? master.backgroundColor,
		backgroundImage: layout?.backgroundImage ?? master.backgroundImage,
	};
});

// ── Header / footer dialog ────────────────────────────────────────────
const { showHeaderFooter, onHeaderFooterUpdate } = useHeaderFooterDialog({ headerFooter });

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
const {
	showCustomShows,
	activeCustomShowId,
	customShowOps,
	isCurrentSlideInActiveShow,
	onCreateCustomShow,
	onDeleteCustomShow,
	onRenameActiveCustomShow,
	onDeleteActiveCustomShow,
	onToggleCurrentSlideInActiveShow,
} = useCustomShowsWiring({
	customShows,
	slides,
	activeSlideIndex,
	activeSlide,
	pushHistory: history.pushHistory,
});

// ── Version history + compare ─────────────────────────────────────────
// Snapshots accrue on each autosave (see the autosave `onSave` below).
const {
	versionHistory,
	showVersionHistory,
	compareResult,
	compareVersionId,
	showCompare,
	onVersionRestore,
	onVersionDelete,
	onVersionCompare,
	onCompareClose,
	onCompareAcceptAll,
} = useVersionHistoryWiring({ slides, pushHistory: history.pushHistory });

// ── Viewer settings ───────────────────────────────────────────────────
const { showSettings, viewerSettings, onSettingsUpdate } = useViewerSettingsDialog();

// ── Keyboard shortcuts ────────────────────────────────────────────────
// A config-driven registry (mirrors React `useKeyboardShortcuts`) replaces the
// old ad-hoc Ctrl+Z/Y/Delete handling. Find (Ctrl+F) and the shortcut-help
// overlay (Ctrl+/) are handled in `onEditorKeydown` before delegating.
const { showShortcuts, shortcuts, onEditorKeydown, copySelected, cutSelected } = useEditorKeyboard({
	canEdit: () => props.canEdit,
	hasSelection,
	presenting,
	findOpen,
	selectedElementIds,
	activeSlide,
	activeSlideIndex,
	slides,
	templateElementsBySlideId,
	pushHistory: history.pushHistory,
	undo: history.undo,
	redo: history.redo,
	copyElement,
	cutElement,
	pasteElement,
	duplicateSelected,
	deleteSelected,
	goPrev,
	goNext,
	onEscape,
});

// ── Office-style ribbon wiring (RibbonToolbar ← React Toolbar.tsx) ────────
// The desktop chrome is the full Office ribbon. This block adapts the host's
// existing state + handlers to the `RibbonProps` contract. Capabilities the
// host does not yet expose (drawing tools, grid/ruler/snap, theme gallery,
// flip, action buttons, layout gallery) are wired as no-ops for now; the
// ribbon renders faithfully and the core actions are live.
const {
	toolbarSection,
	newShapeType,
	activeTool,
	drawingColor,
	drawingWidth,
	inspectorOpen,
	sidebarCollapsed,
	ribbonExpanded,
	overflowOpen,
	notesExpanded,
	showGrid,
	showRulers,
	spellCheckEnabled,
	themeGalleryOpen,
	themeEditorOpen,
} = useRibbonUiState();

const { drawingActive, addInkStroke, eraseInkAt } = useInkDrawing({
	canEdit: () => props.canEdit,
	presenting,
	activeTool,
	activeSlide,
	selectedElementIds,
	ops,
});

const { applyTheme, applyThemePreset, applyThemeEdit } = useThemeEditing({
	slides,
	pptxTheme,
	themeColorMap,
	pushHistory: history.pushHistory,
	themeGalleryOpen,
	themeEditorOpen,
});

const {
	ribbonMode,
	activeTableSelection,
	ribbonUpdateTextStyle,
	ribbonUpdateTextCase,
	ribbonFlip,
	ribbonMoveToEdge,
} = useRibbonActions({
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

watch(ribbonMode, (mode) => {
	emit('mode-change', mode);
});

const ribbonProps = useRibbonProps({
	ribbonMode,
	canEdit: () => props.canEdit,
	isMobile,
	sidebarCollapsed,
	inspectorOpen,
	ribbonExpanded,
	toolbarSection,
	zoom,
	canUndo: history.canUndo,
	canRedo: history.canRedo,
	findOpen,
	selectedElements,
	activeTableSelection,
	editTemplateMode,
	newShapeType,
	activeTool,
	drawingColor,
	drawingWidth,
	clipboard,
	spellCheckEnabled,
	showGrid,
	showRulers,
	snapToGrid,
	snapToShape,
	overflowOpen,
	layoutOptions,
	customShows,
	activeCustomShowId,
	isCurrentSlideInActiveShow,
	themeEditorOpen,
	themeGalleryOpen,
	showComments,
	activeComments,
	formatPainterActive,
	canActivateFormatPainter,
	showSelectionPane,
	showSubtitles,
	activeSlide,
	presenting,
	canDistribute,
	shareOpen,
	showShortcuts,
	showSettings,
	showA11y,
	showSorter,
	showCustomShows,
	showVersionHistory,
	showPasswordDialog,
	propertiesOpen,
	showFontEmbedding,
	showSignatures,
	showMasterView,
	showSetUpSlideShow,
	broadcastOpen,
	showInsertSmartArt,
	showEquationEditor,
	collab,
	startPresenting,
	startPresenterView,
	startRehearsal,
	onAddAnimation,
	onRemoveAnimation,
	zoomIn,
	zoomOut,
	zoomReset,
	undo: history.undo,
	redo: history.redo,
	addText,
	addShape,
	addTable,
	addChart,
	addField,
	addActionButton,
	openImagePicker,
	openMediaPicker,
	addGuide,
	onAlign,
	onDistribute,
	copySelected,
	cutSelected,
	pasteElement,
	ribbonFlip,
	bringForward,
	sendBackward,
	ribbonMoveToEdge,
	duplicateSelected,
	deleteSelected,
	handleOpenFile,
	onExportPng,
	onExportPdf,
	onExportWebm,
	onExportGif,
	downloadAs,
	onCopySlideAsImage,
	openPrintDialog: printer.openPrintDialog,
	ribbonUpdateTextStyle,
	ribbonUpdateTextCase,
	insertSlideFromLayout,
	onRenameActiveCustomShow,
	onDeleteActiveCustomShow,
	onToggleCurrentSlideInActiveShow,
	toggleFormatPainter,
	onToggleSubtitles,
	onTransitionChange,
	onApplyTransitionToAll,
});

// ── Imperative surface (implements the shared PowerPointViewerAPI) ────
defineExpose<PowerPointViewerExpose>({
	getContent,
	goTo,
	goPrev,
	goNext,
	undo: () => history.undo(),
	redo: () => history.redo(),
	canUndo: () => history.canUndo.value,
	canRedo: () => history.canRedo.value,
	getZoom: () => zoom.value,
	setZoom: (level: number) => {
		zoom.value = Math.min(Math.max(level, ZOOM_MIN), ZOOM_MAX);
	},
	zoomIn,
	zoomOut,
	zoomReset,
	getMode: () => ribbonMode.value,
	setMode: (newMode) => {
		if (newMode === 'present') {
			startPresenting();
		} else if (newMode === 'master') {
			showMasterView.value = true;
		} else {
			presenting.value = false;
			showMasterView.value = false;
		}
	},
	getActiveSlideIndex: () => activeSlideIndex.value,
	setActiveSlideIndex: (index: number) => goTo(index),
	getSlideCount: () => slideCount.value,
	isDirty: () => autosave.isDirty.value,
	// -- Slide access --
	getSlides: () => slides.value,
	getSlide: (index: number) => slides.value[index],
	getActiveSlide: () => activeSlide.value,
	// -- Slide manipulation --
	addSlide: () => slideOps.addSlide(),
	deleteSlides: (indexes: number[]) => {
		for (const i of [...indexes].sort((a, b) => b - a)) {
			slideOps.deleteSlide(i);
		}
	},
	duplicateSlides: (indexes: number[]) => {
		for (const i of indexes) {
			slideOps.duplicateSlide(i);
		}
	},
	moveSlide: (from: number, to: number) => slideOps.moveSlide(from, to),
	toggleHideSlides: (indexes: number[]) => {
		for (const i of indexes) {
			toggleSlideHidden(i);
		}
	},
	// -- Element access --
	getElements: (slideIndex?: number) => {
		const idx = slideIndex ?? activeSlideIndex.value;
		const s = slides.value[idx];
		return s?.elements ?? [];
	},
	getElementById: (elementId: string, slideIndex?: number) => {
		const idx = slideIndex ?? activeSlideIndex.value;
		const s = slides.value[idx];
		return s?.elements.find((e) => e.id === elementId);
	},
	// -- Element manipulation --
	updateElement: (elementId: string, updates: Partial<PptxElement>) => {
		ops.updateElement(elementId, updates);
	},
	deleteElements: (elementIds: string[]) => {
		for (const id of elementIds) {
			ops.removeElement(id);
		}
	},
	duplicateElement: (elementId: string) => ops.duplicateElement(elementId),
	// -- Selection --
	getSelectedElementIds: () => selectedElementIds.value,
	selectElements: (ids: string[]) => {
		selectedElementIds.value = ids;
	},
	clearSelection: () => {
		selectedElementIds.value = [];
	},
});

function handleCommandSearch(command: string): void {
	const [category, action] = command.split('.');
	switch (category) {
		case 'format':
			switch (action) {
				case 'bold':
					ribbonUpdateTextStyle({ bold: true });
					break;
				case 'italic':
					ribbonUpdateTextStyle({ italic: true });
					break;
				case 'underline':
					ribbonUpdateTextStyle({ underline: true });
					break;
				case 'alignLeft':
					ribbonUpdateTextStyle({ align: 'left' });
					break;
				case 'alignCenter':
					ribbonUpdateTextStyle({ align: 'center' });
					break;
				case 'alignRight':
					ribbonUpdateTextStyle({ align: 'right' });
					break;
				case 'clear':
					ribbonUpdateTextStyle({
						bold: false,
						italic: false,
						underline: false,
						strikethrough: false,
					});
					break;
			}
			break;
		case 'insert':
			switch (action) {
				case 'textBox':
					addText();
					break;
				case 'shape':
					addShape('rect');
					break;
				case 'image':
					openImagePicker();
					break;
				case 'media':
					openMediaPicker();
					break;
				case 'table':
					addTable();
					break;
				case 'chart':
					addChart('bar');
					break;
				case 'smartArt':
					showInsertSmartArt.value = true;
					break;
				case 'equation':
					editingEquationOmml.value = null;
					showEquationEditor.value = true;
					break;
				case 'link':
					hyperlinkOpen.value = true;
					break;
			}
			break;
		case 'view':
			switch (action) {
				case 'toggleGrid':
					showGrid.value = !showGrid.value;
					break;
				case 'toggleRulers':
					showRulers.value = !showRulers.value;
					break;
				case 'slideSorter':
					showSorter.value = true;
					break;
				case 'zoomToFit':
					zoomReset();
					break;
			}
			break;
		case 'slideShow':
			switch (action) {
				case 'fromBeginning':
					startPresenting();
					break;
				case 'presenterView':
					startPresenting();
					break;
			}
			break;
		case 'design':
			switch (action) {
				case 'browseThemes':
					themeGalleryOpen.value = !themeGalleryOpen.value;
					break;
			}
			break;
		case 'arrange':
			switch (action) {
				case 'bringToFront':
					ribbonMoveToEdge('front');
					break;
				case 'sendToBack':
					ribbonMoveToEdge('back');
					break;
				case 'duplicate':
					duplicateSelected();
					break;
			}
			break;
		case 'review':
			switch (action) {
				case 'spelling':
					spellCheckEnabled.value = !spellCheckEnabled.value;
					break;
			}
			break;
	}
}
</script>

<template>
	<div
		ref="viewerRootRef"
		class="pptx-vue-viewer"
		:class="props.class"
		:style="themeStyle"
		:aria-busy="loading ? 'true' : 'false'"
		:tabindex="props.canEdit ? 0 : undefined"
		@keydown="onEditorKeydown"
	>
		<!-- Loading -->
		<div v-if="loading" class="pptx-vue-state pptx-vue-loading" role="status" aria-live="polite">
			<div class="pptx-vue-spinner" aria-hidden="true" />
			<p>{{ t('pptx.viewer.loading') }}</p>
		</div>

		<!-- Encrypted -->
		<div v-else-if="isEncrypted" class="pptx-vue-state pptx-vue-error" role="alert">
			<p>{{ t('pptx.viewer.encrypted') }}</p>
		</div>

		<!-- Error -->
		<div v-else-if="error" class="pptx-vue-state pptx-vue-error" role="alert">
			<p>{{ t('pptx.viewer.loadError') }}</p>
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
				<!-- PowerPoint-style title bar sits ABOVE and OUTSIDE the
				     role="toolbar" ribbon element (which e2e measures for height
				     parity), gated like React on desktop + non-present. -->
				<TitleBar
					v-if="!isMobile"
					:mode="ribbonMode"
					:can-edit="props.canEdit"
					:file-name="props.fileName"
					:is-dirty="autosave.isDirty.value"
					:autosave-status="autosaveDisabledReason ? 'disabled' : autosave.status.value"
					:autosave-enabled="autosaveEnabled"
					:autosave-disabled-reason="autosaveDisabledReason"
					:on-toggle-autosave="toggleAutosave"
					:can-undo="history.canUndo.value"
					:can-redo="history.canRedo.value"
					:on-undo="history.undo"
					:on-redo="history.redo"
					:on-save="() => void downloadAs('pptx')"
					:find-replace-open="findOpen"
					:on-toggle-find-replace="() => (findOpen = !findOpen)"
					:on-command-search="handleCommandSearch"
				/>
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
					:aria-label="t('pptx.sections.slides')"
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
						@add-section="(idx) => sectionOps.addSection(t('pptx.sections.defaultName'), idx)"
					/>
				</nav>

				<main
					ref="mainRef"
					class="pptx-vue-main"
					:class="{ 'is-editable': props.canEdit }"
					@pointerdown="onCanvasPointerDown"
					@dblclick.capture="onCanvasDoubleClick"
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
							@request-edit="(p) => requestElementEdit(p.id)"
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
						v-if="props.canEdit && !isMobile"
						:slide="activeSlide"
						:expanded="notesExpanded"
						@update="onNotesUpdate"
						@toggle="notesExpanded = !notesExpanded"
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
				:autosave-status="
					autosaveDisabledReason ? 'disabled' : autosaveEnabled ? autosave.status.value : undefined
				"
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

			<!-- File ▸ Version History -->
			<VersionHistoryPanel
				:open="showVersionHistory"
				:versions="versionHistory.versions.value"
				:canvas-size="canvasSize"
				:media-data-urls="mediaDataUrls"
				@close="showVersionHistory = false"
				@restore="onVersionRestore"
				@delete="onVersionDelete"
				@compare="onVersionCompare"
			/>

			<!-- Version history ▸ compare against current -->
			<ComparePanel
				:open="showCompare"
				:compare-result="compareResult"
				:canvas-size="canvasSize"
				:media-data-urls="mediaDataUrls"
				@close="onCompareClose"
				@accept-all="onCompareAcceptAll"
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
				:aria-label="t('pptx.view.masterViews')"
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
					:handout-slides-per-page="handoutMaster?.slidesPerPage ?? handoutSlidesPerPage"
					@select-master="onSelectMaster"
					@select-layout="onSelectLayout"
					@tab-change="masterViewTab = $event"
					@handout-slides-per-page-change="onHandoutSlidesPerPageChange"
					@notes-background-change="onNotesMasterBackgroundChange"
					@handout-background-change="onHandoutMasterBackgroundChange"
					@collapse="showMasterView = false"
				/>
				<main
					class="pptx-vue-master-canvas"
					style="
						display: flex;
						flex: 1;
						min-width: 0;
						align-items: center;
						justify-content: center;
						overflow: hidden;
						background: var(--pptx-vue-background, #111827);
					"
					role="application"
					:aria-label="
						masterViewTab === 'notes'
							? t('pptx.master.notesMasterTitle')
							: masterViewTab === 'handout'
								? t('pptx.master.handoutMasterTitle')
								: t('pptx.master.title')
					"
				>
					<NotesMasterCanvas
						v-if="masterViewTab === 'notes'"
						:notes-master="notesMaster"
						:canvas-size="canvasSize"
					/>
					<HandoutMasterCanvas
						v-else-if="masterViewTab === 'handout'"
						:handout-master="handoutMaster"
						:canvas-size="canvasSize"
						:slides-per-page="handoutMaster?.slidesPerPage ?? handoutSlidesPerPage"
					/>
					<SlideStage
						v-else-if="activeMasterViewSlide"
						:slide="activeMasterViewSlide"
						:canvas-size="canvasSize"
						:media-data-urls="mediaDataUrls"
						:scale="0.75"
					/>
				</main>
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

			<!-- Insert ▸ SmartArt -->
			<InsertSmartArtDialog
				:open="showInsertSmartArt"
				@insert="onInsertElement"
				@close="showInsertSmartArt = false"
			/>

			<!-- Insert ▸ Equation (also re-edits an existing equation) -->
			<EquationEditorDialog
				:open="showEquationEditor"
				:existing-omml="editingEquationOmml"
				@insert="onInsertElement"
				@apply="onApplyEquation"
				@close="closeEquationEditor"
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
				:title="t('pptx.notes.title')"
				@close="mobileNotesOpen = false"
			>
				<NotesPanel
					:slide="activeSlide"
					:expanded="true"
					@update="onNotesUpdate"
					@toggle="mobileNotesOpen = false"
				/>
			</MobileSheet>

			<!-- Mobile Format / properties sheet (right-rail inspector on desktop) -->
			<MobileSheet
				v-if="isMobile && props.canEdit && !presenting"
				:open="mobileInspectorOpen"
				inspector
				:title="t('pptx.arrange.format')"
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
				<p v-else class="px-4 py-6 text-center text-xs text-muted-foreground">
					{{ t('pptx.inspector.noSlideSelected') }}
				</p>
			</MobileSheet>

			<!-- Mobile Comments sheet (right-rail panel on desktop) -->
			<MobileSheet
				v-if="isMobile && props.canEdit && !presenting"
				:open="mobileCommentsOpen"
				:title="t('pptx.toolbar.comments')"
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
			:content="props.content"
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
			:start-in-presenter-view="startInPresenterView"
			@close="closePresentation"
			@slide-change="handlePresentSlideChange"
		/>
		<RehearseTimingsHud
			v-if="rehearsal.rehearsing.value"
			:slide-elapsed-ms="rehearsal.slideElapsedMs.value"
			:total-elapsed-ms="rehearsal.totalElapsedMs.value"
			:paused="rehearsal.paused.value"
			@toggle-pause="rehearsal.togglePause"
		/>
		<RehearseTimingsSummary
			v-if="rehearsal.showSummary.value"
			:timings="rehearsal.recordedTimings.value"
			@save="rehearsal.saveTimings"
			@discard="rehearsal.dismissSummary"
		/>
	</div>
</template>
