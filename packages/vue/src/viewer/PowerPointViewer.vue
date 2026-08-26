<script setup lang="ts">
/**
 * PowerPointViewer: Vue port of the React `PowerPointViewer.tsx`.
 *
 * Top-level orchestrator that loads `.pptx` bytes and renders the slides with
 * navigation and zoom, composing the full editor (toolbar, inspector panels,
 * dialogs, presentation mode, collaboration, export) like its React
 * counterpart.
 *
 * This file is deliberately only WIRING: every piece of behaviour lives in a
 * composable under `./composables`, and every group of markup in a component
 * under `./components` (`ViewerSlideRail`, `ViewerSidePanels`,
 * `Viewer*Dialogs`, `ViewerMobileSheets`, `ViewerPresentationLayer`). What is
 * left here is the order the composables are created in and the props that
 * connect them, which is the one thing that genuinely cannot be moved out.
 *
 * Composables that need something declared further down receive it as a getter
 * or a closure; this forward-reference pattern is used throughout and is why
 * the declaration order below reads bottom-up in places.
 *
 * Conventions vs. React:
 *  - `forwardRef` handle  -> `defineExpose` ({@link PowerPointViewerExpose}).
 *  - function-prop callbacks -> emits ({@link PowerPointViewerEmits}).
 *  - `theme` context      -> `provideViewerTheme` + `useThemeStyle`.
 */
import { hasShapeProperties, PptxHandler } from 'pptx-viewer-core';
import type { PptxElement, PptxTheme, ShapeStyle } from 'pptx-viewer-core';
import {
	buildFieldSubstitutionContext,
	buildUserFontFaceStyles,
	canInteractWithElement,
	computeGridSpacingPx,
	createBackstagePresentation,
	deleteAutosaveSnapshot,
	listAutosaveSnapshots,
	MAX_ZOOM_SCALE,
	MIN_ZOOM_SCALE,
	openPptxFile,
	resolveAutosaveIntervalSeconds,
	shouldShowAutosaveRecoveryPrompt,
} from 'pptx-viewer-shared';
import { computed, onBeforeUnmount, onMounted, provide, ref, watch, watchEffect } from 'vue';
import { useI18n } from 'vue-i18n';

import { provideViewerTheme, useThemeStyle } from '../theme';
import AutosaveRecoveryDialog from './components/AutosaveRecoveryDialog.vue';
import CollaborationStatusIndicator from './components/CollaborationStatusIndicator.vue';
import ExportProgressModal from './components/ExportProgressModal.vue';
import FindReplaceBar from './components/FindReplaceBar.vue';
import MasterViewOverlay from './components/MasterViewOverlay.vue';
import MobileToolbar from './components/MobileToolbar.vue';
import NotesPanel from './components/NotesPanel.vue';
import RibbonToolbar from './components/ribbon/RibbonToolbar.vue';
import TitleBar from './components/ribbon/TitleBar.vue';
import SlideCanvas from './components/SlideCanvas.vue';
import SlideStage from './components/SlideStage.vue';
import StatusBar from './components/StatusBar.vue';
import ViewerCanvasOverlays from './components/ViewerCanvasOverlays.vue';
import ViewerDeckDialogs from './components/ViewerDeckDialogs.vue';
import ViewerEditDialogs from './components/ViewerEditDialogs.vue';
import ViewerFileDialogs from './components/ViewerFileDialogs.vue';
import ViewerMobileSheets from './components/ViewerMobileSheets.vue';
import ViewerPresentationLayer from './components/ViewerPresentationLayer.vue';
import ViewerSidePanels from './components/ViewerSidePanels.vue';
import ViewerSlideRail from './components/ViewerSlideRail.vue';
import { AccountAuthKey } from './composables/account-auth';
import { useAiBridge } from './composables/ai/useAiBridge';
import { useAiPanelController } from './composables/ai/useAiPanelController';
import { useChartCanvasEditContext } from './composables/chart-part-selection';
import { readDeckData } from './composables/deck-data';
import { FieldContextKey } from './composables/field-context';
import { SmartArt3DKey } from './composables/smart-art-3d';
import { SurfaceChart3DKey } from './composables/surface-chart-3d';
import { TableThemeKey } from './composables/table-theme';
import { useAccessibility } from './composables/useAccessibility';
import { useAlignGroup } from './composables/useAlignGroup';
import { useAutosaveRecovery } from './composables/useAutosaveRecovery';
import { useAutosaveWiring } from './composables/useAutosaveWiring';
import { useCanvasPointer } from './composables/useCanvasPointer';
import { useCollaborationWiring } from './composables/useCollaborationWiring';
import { useCommandDispatch } from './composables/useCommandDispatch';
import { useCommentsWiring } from './composables/useCommentsWiring';
import { useContentSource } from './composables/useContentSource';
import { useContextMenu } from './composables/useContextMenu';
import { useCustomShowsWiring } from './composables/useCustomShowsWiring';
import { useDeckViews } from './composables/useDeckViews';
import { useDocumentPropertiesDialog } from './composables/useDocumentPropertiesDialog';
import { useEditorHistory } from './composables/useEditorHistory';
import { useEditorKeyboard } from './composables/useEditorKeyboard';
import { useEditorOperations } from './composables/useEditorOperations';
import { useElementClipboard } from './composables/useElementClipboard';
import { useElementDrag } from './composables/useElementDrag';
import { useElementInsertion } from './composables/useElementInsertion';
import { useEmbeddedFonts } from './composables/useEmbeddedFonts';
import { useExportWiring } from './composables/useExportWiring';
import { useFindReplace } from './composables/useFindReplace';
import { useFontEmbedding } from './composables/useFontEmbedding';
import { useFormatPainter } from './composables/useFormatPainter';
import { useHeaderFooterDialog } from './composables/useHeaderFooterDialog';
import { useHyperlinkDialog } from './composables/useHyperlinkDialog';
import { useInkDrawing } from './composables/useInkDrawing';
import { useInlineEditing } from './composables/useInlineEditing';
import { useInsertElementDialogs } from './composables/useInsertElementDialogs';
import { useInspectorDeckActions } from './composables/useInspectorDeckActions';
import { useInspectorWiring } from './composables/useInspectorWiring';
import { useIsMobile } from './composables/useIsMobile';
import { useKeyboardInsets } from './composables/useKeyboardInsets';
import { useLoadContent } from './composables/useLoadContent';
import { useMarqueeSelection } from './composables/useMarqueeSelection';
import { useMasterViewWiring } from './composables/useMasterViewWiring';
import { useMobileChrome } from './composables/useMobileChrome';
import { useMultiSelectOps } from './composables/useMultiSelectOps';
import { usePasswordProtection } from './composables/usePasswordProtection';
import { usePresentationControls } from './composables/usePresentationControls';
import { usePrint } from './composables/usePrint';
import { useRibbonActions } from './composables/useRibbonActions';
import { useRibbonUiState } from './composables/useRibbonUiState';
import { useSectionOperations } from './composables/useSectionOperations';
import { useSelectionModel } from './composables/useSelectionModel';
import { useSelectionPaneWiring } from './composables/useSelectionPaneWiring';
import { useSignatureWorkflow } from './composables/useSignatureWorkflow';
import { useSlideMutations } from './composables/useSlideMutations';
import { useSlideNavigation } from './composables/useSlideNavigation';
import { useSlideOperations } from './composables/useSlideOperations';
import { useSlideShowSettings } from './composables/useSlideShowSettings';
import { useSlideTemplateInsertion } from './composables/useSlideTemplateInsertion';
import { useSmartArtNodeEditContext } from './composables/useSmartArtNodeEditContext';
import { useSwipeNavigation } from './composables/useSwipeNavigation';
import { useTableCellEditingContext } from './composables/useTableCellEditingContext';
import { useThemeEditing } from './composables/useThemeEditing';
import { useTouchGestures } from './composables/useTouchGestures';
import { useVersionHistoryWiring } from './composables/useVersionHistoryWiring';
import { useViewerApi } from './composables/useViewerApi';
import { useViewerOptionsStore } from './composables/useViewerOptionsStore';
import { useViewerPreferences } from './composables/useViewerPreferences';
import { useViewerRibbonProps } from './composables/useViewerRibbonProps';
import { useViewerSettingsDialog } from './composables/useViewerSettingsDialog';
import { useViewerZoom } from './composables/useViewerZoom';
import { provideZoomTargetLookup, toZoomTargetInfo } from './composables/zoom-target';
import type { PowerPointViewerEmits, PowerPointViewerExpose, PowerPointViewerProps } from './types';

const props = withDefaults(defineProps<PowerPointViewerProps>(), {
	canEdit: false,
	smartArt3D: false,
	surfaceChart3D: false,
});
const emit = defineEmits<PowerPointViewerEmits>();

const { t } = useI18n();

// -- Theme + locale preferences (File > Options) -----------------------
const prefs = useViewerPreferences(props);
provideViewerTheme(prefs.effectiveTheme);
const themeStyle = useThemeStyle(prefs.effectiveTheme);
// SmartArt 3D opt-in: surface the prop to the element dispatcher via inject.
provide(SmartArt3DKey, props.smartArt3D);
// Surface-chart 3D opt-in: surface the prop to ChartRenderer via inject.
provide(SurfaceChart3DKey, props.surfaceChart3D);
// File > Account sign-in hook point: surface the prop to AccountPage.vue via
// inject, avoiding threading `accountAuth` through the large RibbonProps
// contract just to reach one deeply-nested panel (mirrors SmartArt3DKey above).
provide(AccountAuthKey, props.accountAuth);

// -- Load + parse content ----------------------------------------------
const source = useContentSource({
	content: () => props.content,
	onOpenFile: () => props.onOpenFile,
});
const activeContent = source.activeContent;

// Bumped each time the load pipeline finishes applying a parsed deck; the
// collaboration layer watches it to re-adopt the shared doc's slides when a
// slow local load lands mid-session (late-joiner bootstrap-deck clobber).
const loadVersion = ref(0);

// Declared ahead of `useLoadContent` on purpose: the save path reads the
// Protect-Presentation secret so a protected deck serialises encrypted.
const password = usePasswordProtection();

const deck = useLoadContent(() => activeContent.value, {
	onContentApplied: () => {
		loadVersion.value += 1;
	},
	getSaveIntent: () => ({
		password: password.presentationPassword.value,
		passwordProtected: password.isPasswordProtected.value,
	}),
	// File > Fonts. `fontEmbedding` is declared further down (it needs the
	// loaded deck's embedded fonts), so this getter reads it lazily at save
	// time, exactly like `getSaveIntent` reads the password.
	getEmbedFonts: () => fontEmbedding.embedFontsEnabled.value,
});
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
	tagCollections,
	signatures,
	tableStyleMap,
	slideMasters,
	sections,
	customShows,
	presentationProperties,
	viewProperties,
	headerFooter,
	notesMaster,
	handoutMaster,
	theme: pptxTheme,
	themeColorMap,
	handler,
	getContent,
	getRecoverySnapshot,
} = deck;

function createPresentation(templateId: string): void {
	slides.value = createBackstagePresentation(templateId);
	templateElementsBySlideId.value = {};
	activeSlideIndex.value = 0;
	selection.selectedElementIds.value = [];
}

// Expose the presentation colour scheme + parsed table-style map to table
// cells (banded/header colour resolution by table-style GUID) via
// provide/inject, avoiding theme prop-threading through the hot
// SlideStage -> ElementRenderer chain.
provide(TableThemeKey, () => ({
	colorScheme: pptxTheme.value?.colorScheme,
	tableStyleMap: tableStyleMap.value,
	fontScheme: pptxTheme.value?.fontScheme,
}));

// Expose a zoom-target lookup so Slide-Zoom / Section-Zoom tiles can render a
// higher-fidelity fallback thumbnail (target slide's real background colour,
// slide number and friendly section name) instead of the raw target index.
provideZoomTargetLookup((targetSlideIndex) => toZoomTargetInfo(slides.value[targetSlideIndex]));

// Expose the DECK-level OOXML field-substitution context (slide number,
// date/time, header/footer, slide title, custom doc properties) to the text
// renderers via provide/inject. Assembly lives in shared so every binding builds
// the same shape; this component keeps only the reactive wiring. Each
// `SlideStage` re-provides this re-pointed at the slide IT paints, so thumbnails
// do not inherit the active slide's number and title.
provide(FieldContextKey, () =>
	buildFieldSubstitutionContext({
		headerFooter: headerFooter.value,
		customProperties: customProperties.value,
		slide: activeSlide.value,
	}),
);

// Inline table-cell editing + table cell selection/resize contexts for
// `TableRenderer` / `TablePanel`.
const { tableSelection } = useTableCellEditingContext({
	canEdit: () => props.canEdit,
	canEditInline: () => props.canEdit && !presentation.presenting.value,
	findActiveElement: (id) => selection.findActiveElement(id),
	updateElement: (id, patch) => ops.updateElement(id, patch),
	commitTableCell: (elementId, rowIndex, colIndex, text) =>
		inlineEdit.commitTableCell(elementId, rowIndex, colIndex, text),
});

// Inline SmartArt node-text and per-node fill editing context. Mirrors the
// table-cell context above (same forward-reference / wrapper-closure pattern).
useSmartArtNodeEditContext({
	canEdit: () => props.canEdit,
	canEditInline: () => props.canEdit && !presentation.presenting.value,
	findActiveElement: (id) => selection.findActiveElement(id),
	updateElement: (id, patch) => ops.updateElement(id, patch),
});

// Inject embedded fonts as @font-face (side effect; auto-cleaned on unmount).
useEmbeddedFonts(deck.embeddedFonts);
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

// -- Navigation + zoom -------------------------------------------------
const { activeSlideIndex, slideCount, activeSlide, goTo, goPrev, goNext } =
	useSlideNavigation(slides);
const { zoom, fitScale, effectiveZoom, zoomIn, zoomOut, zoomReset } = useViewerZoom();

// Reset view state only when a NEW document is loaded, keyed off the `content`
// input, not `slides`. Editing reassigns `slides.value` (so watching it here
// would wrongly clear the selection + undo history on every edit); the input
// changes only on a real load.
watch(activeContent, () => {
	activeSlideIndex.value = 0;
	selection.selectedElementIds.value = [];
	history.clearHistory();
});
watch(activeSlideIndex, (index) => {
	emit('active-slide-change', index);
	selection.selectedElementIds.value = [];
});

// On touch devices a horizontal swipe across the slide area changes slides
// (view mode only, so it never hijacks an edit gesture).
const swipe = useSwipeNavigation({ canEdit: () => props.canEdit, goPrev, goNext });

// -- Editing: selection, history, operations ---------------------------
// Composed unconditionally (cheap); the toolbar/overlay/handlers only act when
// `props.canEdit` is true. `slides` is the writable `ShallowRef` from
// `useLoadContent`, and `getContent` serialises it, so edits flow to export.
const selection = useSelectionModel({ slides, templateElementsBySlideId, activeSlide });
const {
	selectedElementIds,
	editTemplateMode,
	activeTemplateElements,
	findActiveElement,
	selectedElements,
	mergedSlides,
	clearSelection,
} = selection;
const history = useEditorHistory(slides, templateElementsBySlideId);
const ops = useEditorOperations({
	slides,
	activeSlideIndex,
	pushHistory: history.pushHistory,
	selectedElementIds,
	templateElementsBySlideId,
});

watch(zoom, (level) => {
	emit('zoom-change', level);
});
watch(selectedElementIds, (ids) => {
	emit('selection-change', ids);
	// Drop the table cell selection once its owning table is no longer selected,
	// so a stale highlight / inspector cell doesn't linger on the next selection.
	const sel = tableSelection.value;
	if (sel && !ids.includes(sel.elementId)) {
		tableSelection.value = null;
	}
});
watch(slideCount, (count) => {
	emit('slide-count-change', count);
});

// Rubber-band selection. Template-owned elements join the band only in
// edit-template mode, the same rule the pointer uses for a direct click, and an
// `a:spLocks/@noSelect` shape never joins it at all (the band was the one route
// that could still select a locked shape once the pointer path was gated).
const { marquee, beginMarquee, cancelMarquee } = useMarqueeSelection({
	getSelectableElements: () =>
		[...activeTemplateElements.value, ...(activeSlide.value?.elements ?? [])].filter(
			(el) => selection.isInteractive(el.id) && canInteractWithElement(el, 'select'),
		),
	getCanvasSize: () => canvasSize.value,
	selectedElementIds,
});
onBeforeUnmount(cancelMarquee);

// -- AI panel controller (focus / picks / live-tool canvas presence) ----
// Owns the assistant's focus scope + the on-canvas highlight sources. Created
// unconditionally (cheap) but only consumed when the host opts into `ai`.
const aiPanelOpen = ref(false);
const aiPanel = useAiPanelController({
	activeSlideIndex,
	selectedElementIds,
	selectedElement: () => {
		const id = selectedElementIds.value[0];
		return id ? (findActiveElement(id) ?? null) : null;
	},
});

const {
	formatPainterActive,
	canActivateFormatPainter,
	toggleFormatPainter,
	cancelFormatPainter,
	applyFormatToTarget,
} = useFormatPainter({ selectedElements, findActiveElement, ops });

// Inline text editing. Entered by tapping an already-selected element
// (SelectionOverlay emits `requestEdit`). Commits on blur, on selecting another
// element, or on an empty-canvas tap.
const inlineEdit = useInlineEditing({
	canEdit: () => props.canEdit,
	findActiveElement,
	ops,
	// Live preview: mirror each keystroke into the shared doc so peers see
	// typing before the editor commits. `collaboration` is declared further down;
	// the accessor is only invoked from user input, long after setup.
	livePatcher: () => collaboration.collab.livePatcher,
	activeSlide: () => activeSlide.value,
});

// Declared before the pointer wiring below so `requestElementEdit` (the
// tap/double-click route into element editing) can consult it.
const insertDialogs = useInsertElementDialogs({ ops, selectedElementIds, findActiveElement });

// -- Canvas pointer routing --------------------------------------------
const { requestElementEdit, onCanvasDoubleClick, onCanvasPointerDown, onEscape } = useCanvasPointer(
	{
		canEdit: () => props.canEdit,
		editTemplateMode,
		findActiveElement,
		openEquationEditorForElement: insertDialogs.openEquationEditorForElement,
		enterInlineEdit: inlineEdit.enterInlineEdit,
		inlineEditingElementId: inlineEdit.inlineEditingElementId,
		commitInlineEdit: inlineEdit.commitInlineEdit,
		cancelInlineEdit: inlineEdit.cancelInlineEdit,
		formatPainterActive,
		cancelFormatPainter,
		applyFormatToTarget,
		selectedElementIds,
		selectElement: selection.selectElement,
		clearSelection,
		activeSlideIndex,
		aiPickMode: aiPanel.pickMode,
		addAiPick: aiPanel.addPick,
		startElementDrag: (id, event, wasSelected) => drag.startElementDrag(id, event, wasSelected),
		beginMarquee,
	},
);

// Grid spacing in CSS px, from the deck's authored `viewProperties.gridSpacing`
// (falls back to 8px when the deck has none). `p:gridSpacing` lives under
// `p:viewPr` in viewProps.xml, never under `p:presentationPr`.
const gridSpacingPx = computed(() => computeGridSpacingPx(viewProperties.value?.gridSpacing, 8));

// -- Element drag / transform / adjust + snap & alignment guides -------
const drag = useElementDrag({
	findActiveElement,
	pushHistory: history.pushHistory,
	effectiveZoom,
	activeTemplateElements,
	activeSlide,
	activeSlideIndex,
	gridSpacingPx,
	slides,
	templateElementsBySlideId,
	canvasSize,
	enterInlineEdit: requestElementEdit,
});

// -- Element insertion (Insert tab) ------------------------------------
const insertion = useElementInsertion({
	canvasSize,
	ops,
	selectedElementIds,
	slides,
	activeSlideIndex,
	pushHistory: history.pushHistory,
	handler,
	templateElementsBySlideId,
});
// The two hidden `<input type="file">` pickers bind by string ref, so their
// refs must be top-level bindings in this SFC.
const { imageInputRef, mediaInputRef } = insertion;

// -- Slide-template insertion (Home tab gallery) -----------------------
const templateInsertion = useSlideTemplateInsertion({
	canvasSize,
	slides,
	activeSlideIndex,
	pushHistory: history.pushHistory,
	theme: pptxTheme,
});
const { deleteSelected, duplicateSelected, bringForward, sendBackward } = useMultiSelectOps({
	selectedElementIds,
	ops,
	clearSelection,
});

// -- Inspector (element panels + motion path) --------------------------
const inspector = useInspectorWiring({
	slides,
	activeSlide,
	activeSlideIndex,
	selectedElements,
	pushHistory: history.pushHistory,
	updateElement: (id, patch) => ops.updateElement(id, patch),
});

// -- Slide operations (add / duplicate / delete / reorder) -------------
const slideOps = useSlideOperations({ slides, activeSlideIndex, pushHistory: history.pushHistory });

const clipboard = useElementClipboard({
	findSlideElement: (id) => activeSlide.value?.elements.find((e) => e.id === id),
	addElement: (element) => ops.addElement(element),
	removeElement: (id) => ops.removeElement(id),
	selectedElementIds,
});

// -- Presentation (slideshow) mode -------------------------------------
const presentation = usePresentationControls({
	slides,
	activeSlideIndex,
	customShows,
	activeCustomShowId: () => customShowsWiring.activeCustomShowId.value,
	pushHistory: history.pushHistory,
});

// Direct on-canvas chart editing context (mirrors the SmartArt node-edit
// context above): gates mark interactivity to the selected chart in edit
// mode, carries the canvas <-> inspector part selection, and routes commits
// through the SAME history-tracked editor op the inspector uses.
useChartCanvasEditContext({
	canEditInline: () => props.canEdit && !presentation.presenting.value,
	isElementSelected: (id) => selectedElementIds.value.includes(id),
	updateElement: (id, patch) => ops.updateElement(id, patch),
});

const hyperlink = useHyperlinkDialog({
	findSlideElement: (id) => activeSlide.value?.elements.find((e) => e.id === id),
	selectedElementIds,
	updateElement: (id, patch) => ops.updateElement(id, patch),
});

/**
 * Patch the selection's `shapeStyle` from the ribbon (the Arrange group's
 * outline-width spinner). `shapeStyle` is a nested object on the element, so
 * the current value has to be merged in or a one-field write erases fill,
 * dash and every effect beside it. Routed through `ops.updateElement` so the
 * change is one history entry, exactly like the inspector's panels.
 */
function updateSelectedShapeStyle(updates: Partial<ShapeStyle>): void {
	const el = selectedElements.value[0];
	if (!el || !hasShapeProperties(el)) {
		return;
	}
	ops.updateElement(el.id, {
		shapeStyle: { ...el.shapeStyle, ...updates },
	} as Partial<PptxElement>);
}

// -- Find & replace ----------------------------------------------------
const findOpen = ref(false);
const find = useFindReplace({ slides, activeSlideIndex, pushHistory: history.pushHistory });

// -- Export (PNG / PDF) + print ----------------------------------------
const exporter = useExportWiring({
	mergedSlides,
	slides,
	slideCount,
	canvasSize,
	activeSlideIndex,
	saveAs: deck.saveAs,
	fileName: () => props.fileName,
	getDeckData: () => readDeckData(deck),
});
const { exportStageRef, exportSlide, rasterizeSlide, exportProgressCtl, downloadAs, onExportPdf } =
	exporter;

// Print renders vector slides; notes and handouts are rasterised.
const printer = usePrint({
	slides: mergedSlides,
	activeSlideIndex,
	rasterizeSlide,
	slideSize: canvasSize,
});

// -- Full-deck overlays (sorter / outline / reading view) --------------
const deckViews = useDeckViews({
	slides,
	goTo,
	moveSlide: slideOps.moveSlide,
	pushHistory: history.pushHistory,
});

// -- Accessibility checker ---------------------------------------------
const showA11y = ref(false);
const a11y = useAccessibility(slides);

// -- Slide-level mutations (notes / hidden / transition / animations) --
const {
	onNotesUpdate,
	toggleSlideHidden,
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

// -- Align / distribute / group ----------------------------------------
const { canGroup, canUngroup, canDistribute, onAlign, onDistribute, onGroup, onUngroup } =
	useAlignGroup({
		selectedElements,
		selectedElementIds,
		activeSlideIndex,
		slides,
		pushHistory: history.pushHistory,
	});

// -- Element context menu (right-click / long-press) -------------------
const { contextMenu, contextItems, onCanvasContextMenu, onContextSelect } = useContextMenu({
	canEdit: () => props.canEdit,
	findActiveElement,
	tableSelection,
	hasClipboard: clipboard.hasClipboard,
	canGroup,
	editTemplateMode,
	selectedElementIds,
	inlineEditingElementId: inlineEdit.inlineEditingElementId,
	ops,
	cutElement: clipboard.cutElement,
	copyElement: clipboard.copyElement,
	pasteElement: clipboard.pasteElement,
	onGroup,
	onUngroup,
	openHyperlinkDialog: hyperlink.openHyperlinkDialog,
	// "Add Comment" opens the comments panel, matching React's menu action.
	onAddComment: () => {
		comments.showComments.value = true;
	},
	aiEnabled: () => Boolean(props.ai),
	onAskAi: () => {
		aiPanel.askAboutSelection();
		aiPanelOpen.value = true;
	},
	onFixAi: () => {
		aiPanel.fixSelection();
		aiPanelOpen.value = true;
	},
});

// -- Autosave ----------------------------------------------------------
const { autosave, autosaveEnabled, autosaveActive, toggleAutosave, autosaveDisabledReason } =
	useAutosaveWiring({
		slides,
		// Edit-template mode rebuilds only this map, never `slides`.
		templateElements: templateElementsBySlideId,
		loading,
		canEdit: () => props.canEdit,
		// Undefined (the host said nothing) permits autosave; only an explicit
		// `false` vetoes it. See `resolveAutosaveActivation` in the shared package.
		autosaveEnabledByHost: () => props.autosave,
		intervalMs: () => props.autosaveIntervalMs,
		// File > Options > Save > "Save AutoRecover information every N minutes",
		// used whenever the host did not state a cadence of its own.
		optionsIntervalSeconds: () => resolveAutosaveIntervalSeconds(viewerOptions.value),
		snapshotName: () => props.filePath ?? props.fileName ?? 'Untitled Presentation',
		getRecoverySnapshot,
		emitAutosave: (bytes) => emit('autosave', bytes),
		captureVersion: (label, at) => versionHistoryWiring.versionHistory.capture(label, at),
	});

// -- Crash-recovery prompt --------------------------------------------
// Vue wrote snapshots and never offered one back; the decision and the copy are
// the shared ones every binding now renders.
const autosaveRecovery = useAutosaveRecovery({
	filePath: () => props.filePath ?? props.fileName ?? 'Untitled Presentation',
	loading,
	error,
	slideCount: () => slides.value.length,
	autosaveAllowed: () => props.autosave !== false,
	onRestore: (bytes) => {
		source.internalContent.value = bytes;
	},
});

// -- No-selection inspector deck actions (theme-by-path / slide size /
//    doc properties), feeding the tabbed SlideInspector's Properties tab.
const deckActions = useInspectorDeckActions({
	handler,
	slideMasters,
	canvasSize,
	slideSize: deck.slideSize,
	coreProperties,
	appProperties,
	customProperties,
	tagCollections,
	markDirty: () => {
		autosave.isDirty.value = true;
	},
	// Mirror React's refreshContentAfterThemeChange: re-serialise and reload so
	// slide colours re-resolve against the newly-applied theme. These bytes go
	// straight back into our own loader, which has no password, so they use the
	// plaintext recovery serialisation rather than `getContent`.
	refreshContent: async () => {
		source.internalContent.value = await getRecoverySnapshot();
	},
});

// -- Comments ----------------------------------------------------------
const authorNameRef = computed(() => props.authorName ?? 'You');
const comments = useCommentsWiring({
	activeSlide,
	activeSlideIndex,
	slides,
	authorName: authorNameRef,
	pushHistory: history.pushHistory,
});

// -- Collaboration (Yjs) + broadcast -----------------------------------
const collaboration = useCollaborationWiring({
	slides,
	loadVersion,
	// A room may replace the host's own deck (a late joiner's bootstrap load),
	// never one the user opened during the session.
	getLoadOrigin: () => source.loadOrigin.value,
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

// -- Panels and dialogs owned by their own composables ------------------
const signatureWorkflow = useSignatureWorkflow({ signatures, isDirty: autosave.isDirty });
const slideShow = useSlideShowSettings({ presentationProperties });
// `password` is created above `useLoadContent` so the save path can read it.
const fontEmbedding = useFontEmbedding({ slides, embeddedFonts: deck.embeddedFonts });

/**
 * Families the user registered from a local font file this session
 * (File > Options > Fonts, off by default).
 *
 * Component state rather than a module-level global so several viewers on one
 * page keep their own lists, and so nothing survives a reload: the font binary
 * is the user's, not ours to persist.
 */
const customFontFamilies = ref<string[]>([]);
function handleCustomFontRegistered(family: string): void {
	if (!customFontFamilies.value.includes(family)) {
		customFontFamilies.value = [...customFontFamilies.value, family];
	}
}
const selectionPane = useSelectionPaneWiring({
	findActiveElement,
	activeSlide,
	selectedElementIds,
	ops,
});
const documentProperties = useDocumentPropertiesDialog({
	coreProperties,
	customProperties,
	appProperties,
});
const headerFooterDialog = useHeaderFooterDialog({ headerFooter });
const versionHistoryWiring = useVersionHistoryWiring({
	slides,
	pushHistory: history.pushHistory,
});
const customShowsWiring = useCustomShowsWiring({
	customShows,
	slides,
	activeSlideIndex,
	activeSlide,
	// Honours `p:showPr/p:custShow`: a deck authored to open into a named show
	// now plays that show instead of the whole deck.
	presentationProperties,
	pushHistory: history.pushHistory,
});

// -- Master view (slide / notes / handout masters) ---------------------
const masterView = useMasterViewWiring({
	slideMasters,
	notesMaster,
	handoutMaster,
	markDirty: () => {
		autosave.isDirty.value = true;
	},
});

// -- Sections (group the slide rail) -----------------------------------
const sectionOps = useSectionOperations({
	sections,
	slides,
	activeSlideIndex,
	pushHistory: history.pushHistory,
});
const hasSections = computed(() => sections.value.length > 0);

async function compareWithPresentation(): Promise<void> {
	const picked = await openPptxFile();
	if (!picked) {
		return;
	}
	const incoming = await new PptxHandler().load(picked.buffer);
	if (incoming) {
		versionHistoryWiring.compareWithSlides(incoming.slides);
	}
}

// -- Responsive / mobile chrome ----------------------------------------
// Breakpoints follow the BROWSER viewport, not this container: a host that
// renders the viewer inside a narrow sidebar or split pane still has a full
// desktop pointer and keyboard, so a narrow host container must not switch in
// the touch-oriented mobile bottom-sheet UI. Do not pass `viewerRootRef` as
// the container source here (it used to be, matching React's old container-
// based `useIsMobile`, which had the same bug - see `deriveViewportBreakpoints`
// in pptx-viewer-shared). `viewerRootRef` stays bound to the template for
// other consumers; it just is not fed into breakpoint derivation any more.
const viewerRootRef = ref<HTMLElement | null>(null);
const { isMobile, isTouchDevice } = useIsMobile(768);
// Keep the focused field visible when the on-screen keyboard opens, and lift
// the fixed bottom bar above the keyboard.
const { keyboardInset } = useKeyboardInsets();

// Pinch-zoom + long-press on the main canvas. The gesture state machine is
// framework-agnostic (pptx-viewer-shared); this composable owns only the
// native-listener lifecycle. Swipe navigation keeps its own handlers (above).
const mainRef = ref<HTMLElement | null>(null);
useTouchGestures({
	targetRef: mainRef,
	currentScale: zoom,
	minScale: MIN_ZOOM_SCALE,
	maxScale: MAX_ZOOM_SCALE,
	enabled: isTouchDevice,
	callbacks: {
		onPinchZoom: (newScale) => {
			zoom.value = Number(newScale.toFixed(2));
		},
		onLongPress: (clientX, clientY) => {
			// Mirror React: long-press opens the element context menu, but only in
			// edit mode with an element already selected.
			if (!props.canEdit || presentation.presenting.value) {
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
const mobileChrome = useMobileChrome({
	presenting: presentation.presenting,
	addText: insertion.addText,
});

// -- Keyboard shortcuts ------------------------------------------------
// A config-driven registry (mirrors React `useKeyboardShortcuts`) replaces the
// old ad-hoc Ctrl+Z/Y/Delete handling. Find (Ctrl+F) and the shortcut-help
// overlay ("?" or Ctrl+/) now resolve inside the shared keymap too, so
// `onEditorKeydown` intercepts nothing ahead of the registry.
const { showShortcuts, onEditorKeydown, copySelected, cutSelected, selectAllElements } =
	useEditorKeyboard({
		canEdit: () => props.canEdit,
		hasSelection: selection.hasSelection,
		presenting: presentation.presenting,
		findOpen,
		selectedElementIds,
		activeSlide,
		activeSlideIndex,
		slides,
		templateElementsBySlideId,
		pushHistory: history.pushHistory,
		undo: history.undo,
		redo: history.redo,
		copyElement: clipboard.copyElement,
		cutElement: clipboard.cutElement,
		pasteElement: clipboard.pasteElement,
		duplicateSelected,
		deleteSelected,
		goPrev,
		goNext,
		onEscape,
		onGroup,
		onUngroup,
	});

// -- Office-style ribbon wiring (RibbonToolbar <- React Toolbar.tsx) ----
// The desktop chrome is the full Office ribbon. This block adapts the host's
// existing state and handlers to the presentation-only `RibbonProps` contract.
const ribbonUi = useRibbonUiState();
// The subset the template and the local composables read directly; the whole
// object still goes to `useViewerRibbonProps`.
const {
	activeTool,
	drawingColor,
	drawingWidth,
	inspectorOpen,
	sidebarCollapsed,
	notesExpanded,
	showGrid,
	showRulers,
	showGuides,
	spellCheckEnabled,
	themeGalleryOpen,
	themeEditorOpen,
} = ribbonUi;

// -- Viewer settings ---------------------------------------------------
const reducedMotion = ref(false);
// Full PowerPoint File > Options model (persisted); the six legacy toggles
// below stay the behavior source and sync with it both ways.
const { optionsStore, viewerOptions } = useViewerOptionsStore();
const { showSettings } = useViewerSettingsDialog({
	autoSave: autosaveEnabled,
	spellCheck: spellCheckEnabled,
	showGrid,
	showRulers,
	snapToGrid: drag.snapToGrid,
	reducedMotion,
	optionsStore,
	viewerOptions,
});

/** File > Options > Save > "Delete cached files". */
function onOptionsClearCache(): void {
	void (async () => {
		const snapshots = await listAutosaveSnapshots();
		await Promise.all(snapshots.map((entry) => deleteAutosaveSnapshot(entry.key)));
	})();
}

const { drawingActive, addInkStroke, eraseInkAt } = useInkDrawing({
	canEdit: () => props.canEdit,
	presenting: presentation.presenting,
	activeTool,
	activeSlide,
	selectedElementIds,
	ops,
});

const themeEditing = useThemeEditing({
	slides,
	pptxTheme,
	themeColorMap,
	pushHistory: history.pushHistory,
	themeGalleryOpen,
	themeEditorOpen,
});

// -- AI assistant ------------------------------------------------------
// The Sparkles ribbon toggle and the right-hand chat panel are gated behind
// the optional `ai` prop. The bridge is built unconditionally (a cheap pure
// factory) but only consumed when the host opts in; its three write choke
// points route through the editor-history layer so AI edits are a single
// Ctrl+Z. The panel (and its `@ai-sdk/vue` peer) loads lazily on first open.
/** Map a partial AI theme update onto the deck-wide theme editor (mirrors React's applyAiTheme). */
function applyAiTheme(updates: Partial<PptxTheme>): void {
	const current = pptxTheme.value;
	const colorScheme = updates.colorScheme ?? current?.colorScheme;
	if (!colorScheme) {
		return;
	}
	themeEditing.applyTheme(
		colorScheme,
		updates.fontScheme ?? current?.fontScheme,
		updates.name ?? current?.name ?? 'Theme',
	);
}
const aiBridge = useAiBridge({
	slides,
	activeSlideIndex,
	canvasSize,
	theme: pptxTheme,
	handler,
	sections,
	presentationProperties,
	customProperties,
	coreProperties,
	appProperties,
	fileName: () => props.fileName,
	pushHistory: history.pushHistory,
	markDirty: () => {
		autosave.isDirty.value = true;
	},
	goTo,
	setSelection: (ids) => {
		selectedElementIds.value = ids;
	},
	applyThemeUpdates: applyAiTheme,
	selectedElementIds: () => selectedElementIds.value,
	pinnedFocus: () => aiPanel.pinnedFocus.value,
	pickedFocus: () => aiPanel.pickTargets.value,
});

const ribbonActions = useRibbonActions({
	canEdit: () => props.canEdit,
	presenting: presentation.presenting,
	showMasterView: masterView.showMasterView,
	tableSelection,
	selectedElements,
	selectedElementIds,
	activeSlide,
	activeSlideIndex,
	slides,
	pushHistory: history.pushHistory,
	ops,
});
const { ribbonMode, ribbonUpdateTextStyle, ribbonMoveToEdge } = ribbonActions;

watch(ribbonMode, (mode) => {
	emit('mode-change', mode);
});

const ribbonProps = useViewerRibbonProps({
	canEdit: () => props.canEdit,
	isMobile,
	zoom,
	zoomIn,
	zoomOut,
	zoomReset,
	findOpen,
	activeSlide,
	activeSlideIndex,
	showA11y,
	showShortcuts,
	showSettings,
	deck,
	embeddedFontFamilies: fontEmbedding.embeddedFontNames,
	customFontFamilies,
	ui: ribbonUi,
	selection,
	history,
	arrange: {
		bringForward,
		sendBackward,
		duplicateSelected,
		deleteSelected,
		canDistribute,
		onAlign,
		onDistribute,
		onGroup,
		onUngroup,
	},
	editing: {
		clipboard: clipboard.clipboard,
		pasteElement: clipboard.pasteElement,
		copySelected,
		cutSelected,
		formatPainterActive,
		canActivateFormatPainter,
		toggleFormatPainter,
		updateSelectedShapeStyle,
		openHyperlinkForSelection: hyperlink.openHyperlinkForSelection,
	},
	slideMutations: {
		toggleSlideHidden,
		onAddAnimation,
		onRemoveAnimation,
		onTransitionChange,
		onApplyTransitionToAll,
	},
	slideCommands: {
		addSection: sectionOps.addSection,
		defaultSectionName: () => t('pptx.sections.defaultName'),
		selectAllElements,
		clearSelection,
	},
	presentationProperties,
	ribbonActions,
	drag,
	insertion,
	templateInsertion,
	insertDialogs,
	exporter,
	printer,
	presentation,
	deckViews,
	comments,
	collaboration,
	customShows: customShowsWiring,
	versionHistory: versionHistoryWiring,
	documentProperties,
	fontEmbedding,
	signatureWorkflow,
	selectionPane,
	slideShow,
	password,
	masterView,
	headerFooterDialog,
	handleOpenFile: source.handleOpenFile,
	handleOpenRecentFile: source.handleOpenRecentFile,
	createPresentation,
	compareWithPresentation,
});

// -- Title-bar command surfaces ----------------------------------------
const { handleCommandSearch, handleQuickAccessCommand } = useCommandDispatch({
	updateTextStyle: ribbonUpdateTextStyle,
	addText: insertion.addText,
	addShape: insertion.addShape,
	addTable: insertion.addTable,
	addChart: insertion.addChart,
	openImagePicker: insertion.openImagePicker,
	openMediaPicker: insertion.openMediaPicker,
	showInsertSmartArt: insertDialogs.showInsertSmartArt,
	showEquationEditor: insertDialogs.showEquationEditor,
	editingEquationOmml: insertDialogs.editingEquationOmml,
	hyperlinkOpen: hyperlink.hyperlinkOpen,
	showGrid,
	showRulers,
	showSorter: deckViews.showSorter,
	spellCheckEnabled,
	themeGalleryOpen,
	zoomIn,
	zoomOut,
	zoomReset,
	startPresenting: presentation.startPresenting,
	moveToEdge: ribbonMoveToEdge,
	duplicateSelected,
	openPrintDialog: printer.openPrintDialog,
	exportPdf: onExportPdf,
	addSlide: slideOps.addSlide,
});

// -- Imperative surface (implements the shared PowerPointViewerAPI) ----
defineExpose<PowerPointViewerExpose>(
	useViewerApi({
		slides,
		activeSlide,
		activeSlideIndex,
		slideCount,
		selectedElementIds,
		zoom,
		isDirty: autosave.isDirty,
		presenting: presentation.presenting,
		showMasterView: masterView.showMasterView,
		mode: ribbonMode,
		getContent,
		goTo,
		goPrev,
		goNext,
		zoomIn,
		zoomOut,
		zoomReset,
		startPresenting: presentation.startPresenting,
		history,
		slideOps,
		toggleSlideHidden,
		elementOps: ops,
	}),
);
</script>

<template>
	<div
		ref="viewerRootRef"
		class="pptx-vue-viewer"
		:class="[props.class, { 'pptx-vue-reduced-motion': reducedMotion }]"
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
			     swaps in <MobileToolbar> when isNarrowViewport is true.
			     Unmounted while presenting (mirrors React's `mode !== 'present'`
			     gate on `ViewerToolbarSection`): the full-screen PresentationMode
			     overlay already covers it visually, but leaving it mounted keeps
			     its controls tab-focusable and creates duplicate accessible names
			     (e.g. a second "Present" / "Menu" button) underneath the overlay. -->
			<template v-if="!presentation.presenting.value">
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
					:autosave-enabled="autosaveActive"
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
					:on-quick-command="handleQuickAccessCommand"
					:hidden-actions="props.hiddenActions"
				/>
				<RibbonToolbar
					v-if="!isMobile"
					v-bind="ribbonProps"
					:hidden-actions="props.hiddenActions"
					:ai-enabled="Boolean(props.ai)"
					:is-ai-panel-open="aiPanelOpen"
					:on-toggle-ai-panel="() => (aiPanelOpen = !aiPanelOpen)"
				/>
				<!-- The AI bindings must be passed here too: `ribbonProps` does not
				     carry them, so without these the mobile toolbar's Sparkles
				     toggle never rendered and the assistant was unreachable on
				     phones (the desktop quick-access bar is replaced by this
				     toolbar on mobile). -->
				<MobileToolbar
					v-else
					v-bind="ribbonProps"
					:hidden-actions="props.hiddenActions"
					:ai-enabled="Boolean(props.ai)"
					:is-ai-panel-open="aiPanelOpen"
					:on-toggle-ai-panel="() => (aiPanelOpen = !aiPanelOpen)"
				/>
			</template>

			<!-- Hidden pickers for Insert > Image / Media -->
			<input
				ref="imageInputRef"
				type="file"
				accept="image/*"
				aria-hidden="true"
				style="display: none"
				@change="insertion.onImageFileSelected"
			/>
			<input
				ref="mediaInputRef"
				type="file"
				accept="audio/*,video/*"
				aria-hidden="true"
				style="display: none"
				@change="insertion.onMediaFileSelected"
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
				<!-- Like the ribbon above, unmounted while presenting: the show
				     overlay hides it visually, but a mounted rail keeps every
				     thumbnail in the tab order and the accessibility tree during
				     the show. -->
				<ViewerSlideRail
					v-if="!isMobile && !sidebarCollapsed && !presentation.presenting.value"
					:merged-slides="mergedSlides"
					:merged-slide-by-id="selection.mergedSlideById.value"
					:active-slide-index="activeSlideIndex"
					:canvas-size="canvasSize"
					:media-data-urls="mediaDataUrls"
					:can-edit="props.canEdit"
					:has-sections="hasSections"
					:section-ops="sectionOps"
					:slide-ops="slideOps"
					:go-to="goTo"
					:toggle-slide-hidden="toggleSlideHidden"
				/>

				<main
					ref="mainRef"
					class="pptx-vue-main"
					:class="{ 'is-editable': props.canEdit }"
					:data-pptx-ai-active="props.ai && aiPanel.canvasAnimating.value ? 'true' : undefined"
					@pointerdown="onCanvasPointerDown"
					@dblclick.capture="onCanvasDoubleClick"
					@contextmenu="onCanvasContextMenu"
					@pointermove="collaboration.onCollabPointerMove"
					@touchstart="swipe.onTouchStart"
					@touchend="swipe.onTouchEnd"
				>
					<SlideCanvas
						:slide="activeSlide"
						:canvas-size="canvasSize"
						:media-data-urls="mediaDataUrls"
						:zoom="effectiveZoom"
						:show-rulers="showRulers && !presentation.presenting.value"
						:ruler-selected-bounds="selection.rulerSelectedBounds.value"
						:can-drag-guides="props.canEdit && !presentation.presenting.value"
						:template-elements="activeTemplateElements"
						:edit-template-mode="editTemplateMode && !presentation.presenting.value"
						:inline-editing-element-id="inlineEdit.inlineEditingElementId.value"
						@update:fit-scale="fitScale = $event"
						@create-guide="drag.addGuide"
					>
						<ViewerCanvasOverlays
							:can-edit="props.canEdit"
							:presenting="presentation.presenting.value"
							:canvas-size="canvasSize"
							:effective-zoom="effectiveZoom"
							:active-slide="activeSlide"
							:active-slide-index="activeSlideIndex"
							:selected-elements="selectedElements"
							:selected-element-ids="selectedElementIds"
							:marquee="marquee"
							:active-comments="comments.activeComments.value"
							:on-comment-marker-click="comments.onCommentMarkerClick"
							:show-grid="showGrid"
							:grid-spacing-px="gridSpacingPx"
							:show-guides="showGuides"
							:drag="drag"
							:inline-edit="inlineEdit"
							:inspector="inspector"
							:collaboration="collaboration"
							:spell-check-enabled="spellCheckEnabled"
							:drawing-active="drawingActive"
							:active-tool="activeTool"
							:drawing-color="drawingColor"
							:drawing-width="drawingWidth"
							:on-stroke="addInkStroke"
							:on-erase="eraseInkAt"
							:ai="props.ai"
							:ai-panel="aiPanel"
							:on-request-edit="requestElementEdit"
							:on-format="ribbonUpdateTextStyle"
						/>
					</SlideCanvas>
				</main>

				<!-- Inspector / selection / comments / AI rail: unmounted while
				     presenting for the same reason as the ribbon and the rail. -->
				<ViewerSidePanels
					v-if="!presentation.presenting.value"
					:deck="deck"
					:can-edit="props.canEdit"
					:edit-template-mode="editTemplateMode"
					:is-mobile="isMobile"
					:inspector-open="inspectorOpen"
					:on-close-inspector="() => (inspectorOpen = false)"
					:inspector-element="inspector.inspectorElementForPanels.value"
					:active-slide="activeSlide"
					:slide-count="slideCount"
					:author-name="authorNameRef"
					:selected-element-ids="selectedElementIds"
					:deck-actions="deckActions"
					:comments="comments"
					:accessibility="a11y"
					:show-a11y="showA11y"
					:signature-workflow="signatureWorkflow"
					:selection-pane="selectionPane"
					:collaboration="collaboration"
					:custom-shows="customShowsWiring"
					:ai="props.ai"
					:ai-panel-open="aiPanelOpen"
					:on-close-ai-panel="() => (aiPanelOpen = false)"
					:ai-panel="aiPanel"
					:ai-bridge="aiBridge"
					:ribbon-mode="ribbonMode"
					:go-to="goTo"
					:on-inspector-update="inspector.onInspectorUpdate"
					:on-update-slide-animations="inspector.writeSlideAnimations"
					:on-slide-update="applySlideBackgroundPatch"
					:on-presentation-update="slideShow.onPresentationPropertiesUpdate"
				/>
			</div>

			<!-- Docked speaker-notes panel (desktop): collapsed to a "Notes" strip
			     that sits directly above the status bar (React parity via
			     ViewerBottomPanels). Toggling it expands the editor inline; the
			     status-bar Notes button and this strip's chevron stay in sync. It
			     lives OUTSIDE <main> so it never scrolls away with the canvas. -->
			<NotesPanel
				v-if="props.canEdit && !isMobile && slideCount > 0 && !presentation.presenting.value"
				:slide="activeSlide"
				:expanded="notesExpanded"
				:notes-style="notesMaster?.notesStyle"
				@update="onNotesUpdate"
				@toggle="notesExpanded = !notesExpanded"
			/>

			<!-- Bottom status bar (desktop): React-parity chrome -->
			<StatusBar
				v-if="!isMobile && slideCount > 0 && !presentation.presenting.value"
				:slide-count="slideCount"
				:active-slide-index="activeSlideIndex"
				:is-dirty="autosave.isDirty.value"
				:autosave-status="
					autosaveDisabledReason ? 'disabled' : autosaveEnabled ? autosave.status.value : undefined
				"
				:last-saved-at="autosave.lastSavedAt.value"
				:scale="zoom"
				:mode="ribbonMode"
				:is-notes-expanded="notesExpanded"
				:show-notes="props.canEdit"
				:hidden-actions="props.hiddenActions"
				@zoom-in="zoomIn"
				@zoom-out="zoomOut"
				@zoom-to-fit="zoomReset"
				@toggle-notes="notesExpanded = !notesExpanded"
				@toggle-slide-sorter="deckViews.showSorter.value = true"
				@set-mode="
					(m) =>
						m === 'present'
							? presentation.startPresenting()
							: (presentation.presenting.value = false)
				"
			>
				<!-- Collaboration status in the footer (React parity), replacing the
				     former floating pill. -->
				<template v-if="collaboration.collabActive.value" #collaboration>
					<CollaborationStatusIndicator
						:status="collaboration.collab.status.value"
						:connected-count="collaboration.collab.connectedCount.value"
						@retry="collaboration.collab.retry"
					/>
				</template>
			</StatusBar>

			<ViewerEditDialogs
				:can-edit="props.canEdit"
				:theme="pptxTheme"
				:theme-gallery-open="themeGalleryOpen"
				:on-close-theme-gallery="() => (themeGalleryOpen = false)"
				:theme-editor-open="themeEditorOpen"
				:on-close-theme-editor="() => (themeEditorOpen = false)"
				:theme-editing="themeEditing"
				:context-menu="contextMenu"
				:context-items="contextItems"
				:on-context-select="onContextSelect"
				:on-close-context-menu="() => (contextMenu.open = false)"
				:hyperlink="hyperlink"
				:slide-count="slideCount"
				:collaboration="collaboration"
				:share-defaults="props.shareDefaults"
			/>

			<!-- A running show has no editor chrome, and this prompt is modal: left
			     mounted it puts a full-area backdrop over the stage that swallows
			     action-button clicks. The offer is deferred, not dropped. -->
			<AutosaveRecoveryDialog
				:prompt="
					shouldShowAutosaveRecoveryPrompt({
						prompt: autosaveRecovery.prompt.value,
						presenting: presentation.presenting.value,
					})
						? autosaveRecovery.prompt.value
						: null
				"
				@restore="autosaveRecovery.restore"
				@discard="autosaveRecovery.discard"
			/>

			<ViewerFileDialogs
				:custom-font-families="customFontFamilies"
				:slides="slides"
				@custom-font-registered="handleCustomFontRegistered"
				:active-slide-index="activeSlideIndex"
				:canvas-size="canvasSize"
				:media-data-urls="mediaDataUrls"
				:core-properties="coreProperties"
				:custom-properties="customProperties"
				:app-properties="appProperties"
				:header-footer="headerFooter"
				:document-properties="documentProperties"
				:version-history="versionHistoryWiring"
				:printer="printer"
				:header-footer-dialog="headerFooterDialog"
				:show-shortcuts="showShortcuts"
				:on-close-shortcuts="() => (showShortcuts = false)"
				:show-settings="showSettings"
				:on-close-settings="() => (showSettings = false)"
				:options-store="optionsStore"
				:viewer-options="viewerOptions"
				:theme-key="prefs.themeKey.value"
				:on-theme-select="prefs.selectTheme"
				:locale-code="prefs.localeCode.value"
				:on-locale-select="prefs.selectLocale"
				:available-themes="props.availableThemes"
				:available-locales="prefs.resolvedAvailableLocales.value"
				:ai-enabled="Boolean(props.ai)"
				:on-clear-cache="onOptionsClearCache"
			/>

			<!-- Master views (slide / notes / handout) -->
			<MasterViewOverlay
				v-if="masterView.showMasterView.value"
				:state="masterView"
				:slide-masters="slideMasters"
				:canvas-size="canvasSize"
				:media-data-urls="mediaDataUrls"
				:notes-master="notesMaster"
				:notes-canvas-size="deck.notesCanvasSize.value"
				:handout-master="handoutMaster"
				:can-edit="canEdit"
			/>

			<ViewerDeckDialogs
				:collaboration="collaboration"
				:broadcast-server-url="props.shareDefaults?.serverUrl"
				:slide-show="slideShow"
				:presentation-properties="presentationProperties"
				:custom-shows="customShows"
				:slide-count="slideCount"
				:password="password"
				:font-embedding="fontEmbedding"
				:insert-dialogs="insertDialogs"
				:signature-workflow="signatureWorkflow"
				:signature-count="signatures.length"
			/>

			<ViewerMobileSheets
				v-if="isMobile && !presentation.presenting.value"
				:chrome="mobileChrome"
				:deck="deck"
				:slide-ops="slideOps"
				:comments="comments"
				:deck-actions="deckActions"
				:edit-template-mode="editTemplateMode"
				:merged-slides="mergedSlides"
				:active-slide="activeSlide"
				:active-slide-index="activeSlideIndex"
				:slide-count="slideCount"
				:active-comments="comments.activeComments.value"
				:can-edit="props.canEdit"
				:keyboard-inset="keyboardInset"
				:inspector-element="inspector.inspectorElementForPanels.value"
				:author-name="authorNameRef"
				:notes-master="notesMaster"
				:go-to="goTo"
				:toggle-slide-hidden="toggleSlideHidden"
				:on-notes-update="onNotesUpdate"
				:on-inspector-update="inspector.onInspectorUpdate"
				:on-update-slide-animations="inspector.writeSlideAnimations"
				:on-slide-update="applySlideBackgroundPatch"
				:on-presentation-update="slideShow.onPresentationPropertiesUpdate"
				:on-select-element="selectionPane.onSelectionPaneSelect"
			/>

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

		<ViewerPresentationLayer
			:deck-views="deckViews"
			:presentation="presentation"
			:merged-slides="mergedSlides"
			:slides="slides"
			:canvas-size="canvasSize"
			:media-data-urls="mediaDataUrls"
			:content="props.content"
			:active-slide-index="activeSlideIndex"
			:can-edit="props.canEdit"
			:presentation-properties="presentationProperties"
			:end-with-black-slide="viewerOptions.advanced.slideShowEndWithBlackSlide"
			:prompt-keep-ink-annotations="viewerOptions.advanced.slideShowPromptKeepInkAnnotations"
			:duplicate-slide="slideOps.duplicateSlide"
			:delete-slide="slideOps.deleteSlide"
			:toggle-slide-hidden="toggleSlideHidden"
		/>
	</div>
</template>
