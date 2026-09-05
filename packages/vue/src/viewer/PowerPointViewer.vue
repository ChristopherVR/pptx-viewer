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
import { ShieldAlert } from 'lucide-vue-next';
import { hasShapeProperties, PptxHandler } from 'pptx-viewer-core';
import type { PptxElement, PptxTheme, ShapeStyle } from 'pptx-viewer-core';
import {
	buildDeckSaveOptions,
	buildFieldSubstitutionContext,
	buildUserFontFaceStyles,
	canInteractWithElement,
	computeGridSpacingPx,
	createBackstagePresentation,
	deleteAutosaveSnapshot,
	extraQuickAccessCommands,
	listAutosaveSnapshots,
	MAX_ZOOM_SCALE,
	MIN_ZOOM_SCALE,
	openPptxFile,
	resolve3DRenderingFlags,
	resolveAutosaveIntervalSeconds,
	resolveExpiredAutosaveSnapshots,
	resolveHistoryDepth,
	resolveAuthoredSlideRange,
	resolveImageResolutionScale,
	resolveOptionRootClasses,
	resolveSlideSizeSelection,
	shouldClearAutosaveCacheOnClose,
	shouldOpenInProtectedView,
	shouldShowAutosaveRecoveryPrompt,
} from 'pptx-viewer-shared';
import type { ViewerAddinStatus } from 'pptx-viewer-shared';
import { computed, onBeforeUnmount, onMounted, provide, ref, watch, watchEffect } from 'vue';
import { useI18n } from 'vue-i18n';

import { provideViewerTheme, useThemeStyle } from '../theme';
import AutosaveRecoveryDialog from './components/AutosaveRecoveryDialog.vue';
import CollaborationStatusIndicator from './components/CollaborationStatusIndicator.vue';
import CompatibilityToasts from './components/CompatibilityToasts.vue';
import ExportProgressModal from './components/ExportProgressModal.vue';
import FindReplaceBar from './components/FindReplaceBar.vue';
import MasterViewOverlay from './components/MasterViewOverlay.vue';
import MobileToolbar from './components/MobileToolbar.vue';
import NotesPanel from './components/NotesPanel.vue';
import ReadOnlyBanner from './components/ReadOnlyBanner.vue';
import RibbonToolbar from './components/ribbon/RibbonToolbar.vue';
import TitleBar from './components/ribbon/TitleBar.vue';
import TitleBarQuickAccess from './components/ribbon/TitleBarQuickAccess.vue';
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
import { AreaChart3DKey } from './composables/area-chart-3d';
import { BarChart3DKey } from './composables/bar-chart-3d';
import { useChartCanvasEditContext } from './composables/chart-part-selection';
import { readDeckData } from './composables/deck-data';
import { FieldContextKey } from './composables/field-context';
import { LineChart3DKey } from './composables/line-chart-3d';
import { PieChart3DKey } from './composables/pie-chart-3d';
import { RecentColorsKey } from './composables/recent-colors-context';
import { SmartArt3DKey } from './composables/smart-art-3d';
import { SurfaceChart3DKey } from './composables/surface-chart-3d';
import { TableThemeKey } from './composables/table-theme';
import { ThemeColorMapKey } from './composables/theme-color-map-context';
import { useAccessibility } from './composables/useAccessibility';
import { useAlignGroup } from './composables/useAlignGroup';
import { useAutosaveRecovery } from './composables/useAutosaveRecovery';
import { useAutosaveWiring } from './composables/useAutosaveWiring';
import { useCanvasPointer } from './composables/useCanvasPointer';
import { useCollaborationWiring } from './composables/useCollaborationWiring';
import { useCommandDispatch } from './composables/useCommandDispatch';
import { useCommentsWiring } from './composables/useCommentsWiring';
import { useCompatibilityToasts } from './composables/useCompatibilityToasts';
import { useContentSource } from './composables/useContentSource';
import { useContextMenu } from './composables/useContextMenu';
import { useCustomShowsWiring } from './composables/useCustomShowsWiring';
import { useDeckViewPreferencesSync } from './composables/useDeckViewPreferencesSync';
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
import { useGoogleWebfonts } from './composables/useGoogleWebfonts';
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
import { useMasterViewCrud } from './composables/useMasterViewCrud';
import { useMasterViewWiring } from './composables/useMasterViewWiring';
import { useMobileChrome } from './composables/useMobileChrome';
import { useMultiSelectOps } from './composables/useMultiSelectOps';
import { usePasswordProtection } from './composables/usePasswordProtection';
import { usePresentationControls } from './composables/usePresentationControls';
import { usePrint } from './composables/usePrint';
import { useReadOnlyRecommendation } from './composables/useReadOnlyRecommendation';
import { useRecentColors } from './composables/useRecentColors';
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
import { useTableStyleMapHandlers } from './composables/useTableStyleMapHandlers';
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
	barChart3D: false,
	lineChart3D: false,
	areaChart3D: false,
	pieChart3D: false,
});
const emit = defineEmits<PowerPointViewerEmits>();

const { t } = useI18n();

// -- Theme + locale preferences (File > Options) -----------------------
const prefs = useViewerPreferences(props);
provideViewerTheme(prefs.effectiveTheme);
const themeStyle = useThemeStyle(prefs.effectiveTheme);
// The six 3D opt-in flags are provided further down, once `viewerOptions` (File
// > Options) exists: each ANDs the host's own prop with Options > Advanced >
// "Disable 3D rendering", so a viewer user can force flat 2D even in a deck the
// host enabled 3D for. See the `provide(SmartArt3DKey, ...)` block below.
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

// Full PowerPoint File > Options model (persisted). Declared ahead of
// `useLoadContent` (rather than down with the rest of the settings wiring)
// because the load path itself reads Trust Center > "Allow external content"
// to decide whether `handler.load()` may fetch remote image URLs, exactly
// like `password` above is read for the save path.
const { optionsStore, viewerOptions } = useViewerOptionsStore();

const deck = useLoadContent(() => activeContent.value, {
	onContentApplied: () => {
		loadVersion.value += 1;
	},
	getSaveIntent: () => ({
		password: password.presentationPassword.value,
		passwordProtected: password.isPasswordProtected.value,
	}),
	// Trust Center > "Allow external content (remote images and media)".
	// Off (the option's non-default) makes core drop any http(s) image URL
	// instead of fetching it (SSRF/privacy gate); every binding used to skip
	// this entirely, so the toggle changed nothing regardless of its value.
	getAllowExternalImages: () => viewerOptions.value.trust.allowExternalContent,
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
	modifyVerifier,
	compatibilityWarnings,
	appProperties,
	tagCollections,
	signatures,
	tableStyleMap,
	slideMasters,
	sections,
	customShows,
	modernCommentAuthors,
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

// -- Trust Center > Protected View --------------------------------------
// A freshly loaded document opens read-only when the option is on; "Enable
// Editing" (below) lifts it for the CURRENT document only, mirroring
// PowerPoint's own per-document banner rather than flipping the global
// option. `watch(activeContent, ...)` further down resets the dismissal on
// every new load, so re-opening (or opening another) file starts protected
// again. `canEditEffective` is the single gate every actual edit entry point
// below reads instead of `props.canEdit` directly.
const protectedViewDismissed = ref(false);
const protectedViewActive = computed(
	() => shouldOpenInProtectedView(viewerOptions.value) && !protectedViewDismissed.value,
);
// A deck's own `p:modifyVerifier` / "Mark as Final" recommends read-only the
// same way Protected View does, so its lock feeds the SAME gate rather than a
// second mechanism.
const readOnlyRec = useReadOnlyRecommendation({ modifyVerifier, customProperties });
const canEditEffective = computed(
	() => props.canEdit && !protectedViewActive.value && !readOnlyRec.locked.value,
);
function enableEditing(): void {
	protectedViewDismissed.value = true;
}

// -- Compatibility-warning toasts (load diagnostics) --------------------
const compatToasts = useCompatibilityToasts({ warnings: compatibilityWarnings });

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

// "Recent colours" (`p:clrMru`): one shared list every colour-picking panel
// in the inspector reads and pushes to, so a colour picked in Fill shows up
// in Stroke, Text, Slide Background, table-cell fill and chart series alike.
const recentColors = useRecentColors({ presentationProperties, loadVersion });
provide(RecentColorsKey, recentColors);

// The deck's real theme palette for every colour picker's "Theme Colors"
// grid (see `theme-color-map-context.ts`).
provide(ThemeColorMapKey, themeColorMap);

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
	canEdit: () => canEditEffective.value,
	canEditInline: () => canEditEffective.value && !presentation.presenting.value,
	findActiveElement: (id) => selection.findActiveElement(id),
	updateElement: (id, patch) => ops.updateElement(id, patch),
	commitTableCell: (elementId, rowIndex, colIndex, text) =>
		inlineEdit.commitTableCell(elementId, rowIndex, colIndex, text),
});

// Inline SmartArt node-text and per-node fill editing context. Mirrors the
// table-cell context above (same forward-reference / wrapper-closure pattern).
useSmartArtNodeEditContext({
	canEdit: () => canEditEffective.value,
	canEditInline: () => canEditEffective.value && !presentation.presenting.value,
	findActiveElement: (id) => selection.findActiveElement(id),
	updateElement: (id, patch) => ops.updateElement(id, patch),
});

// Inject embedded fonts as @font-face (side effect; auto-cleaned on unmount).
useEmbeddedFonts(deck.embeddedFonts);
// Fetch Google-hosted webfonts for referenced families that are neither
// installed nor embedded (Microsoft 365 "cloud fonts" have no browser
// equivalent); auto-cleaned on unmount.
useGoogleWebfonts(slides, deck.embeddedFonts);
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
	// A newly opened document is protected again even if the previous one
	// was unlocked via "Enable Editing" this session.
	protectedViewDismissed.value = false;
	readOnlyRec.reset();
	compatToasts.reset();
});
watch(activeSlideIndex, (index) => {
	emit('active-slide-change', index);
	selection.selectedElementIds.value = [];
});

// On touch devices a horizontal swipe across the slide area changes slides
// (view mode only, so it never hijacks an edit gesture).
const swipe = useSwipeNavigation({ canEdit: () => canEditEffective.value, goPrev, goNext });

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
const history = useEditorHistory(slides, templateElementsBySlideId, {
	maxDepth: resolveHistoryDepth(viewerOptions.value),
});
// File > Options > Advanced > "Maximum number of undos", re-applied whenever
// it changes mid-session (not just at construction).
watch(
	() => resolveHistoryDepth(viewerOptions.value),
	(depth) => history.setMaxDepth(depth),
);
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
	canEdit: () => canEditEffective.value,
	findActiveElement,
	ops,
	// Live preview: mirror each keystroke into the shared doc so peers see
	// typing before the editor commits. `collaboration` is declared further down;
	// the accessor is only invoked from user input, long after setup.
	livePatcher: () => collaboration.collab.livePatcher,
	activeSlide: () => activeSlide.value,
	// Options > Proofing > AutoCorrect, applied on commit (blur/Enter/element
	// switch), not on every keystroke. `viewerOptions` is declared further
	// down; the accessor is only invoked from user input, long after setup.
	proofing: () => viewerOptions.value.proofing,
});

// Declared before the pointer wiring below so `requestElementEdit` (the
// tap/double-click route into element editing) can consult it.
const insertDialogs = useInsertElementDialogs({ ops, selectedElementIds, findActiveElement });

// -- Canvas pointer routing --------------------------------------------
const { requestElementEdit, onCanvasDoubleClick, onCanvasPointerDown, onEscape } = useCanvasPointer(
	{
		canEdit: () => canEditEffective.value,
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
	// `presentationAuthoredRange` is declared further down (it depends on
	// `presentationProperties`); a getter is fine here since it is only READ
	// once the show is actually entered, long after every composable in this
	// file has been constructed.
	authoredRange: () => presentationAuthoredRange.value,
	pushHistory: history.pushHistory,
});

// Direct on-canvas chart editing context (mirrors the SmartArt node-edit
// context above): gates mark interactivity to the selected chart in edit
// mode, carries the canvas <-> inspector part selection, and routes commits
// through the SAME history-tracked editor op the inspector uses.
useChartCanvasEditContext({
	canEditInline: () => canEditEffective.value && !presentation.presenting.value,
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
	// `viewerOptions` is declared further down (see file-level forward-reference
	// note); the getter is only invoked once an export actually runs. The raw
	// multiplier: `useExportWiring`'s `rasterizeSlide` applies it on top of the
	// baseline 2x capture scale itself, so it is NOT pre-multiplied here.
	imageExportScale: () => resolveImageResolutionScale(viewerOptions.value),
	// Same forward-reference pattern as `imageExportScale` above: only invoked
	// once a Save-As download actually completes.
	getOptions: () => viewerOptions.value,
	filePath: () => props.filePath ?? props.fileName ?? 'Untitled Presentation',
});
const { exportStageRef, exportSlide, rasterizeSlide, exportProgressCtl, downloadAs, onExportPdf } =
	exporter;

// Print renders vector slides; notes and handouts are rasterised.
const printer = usePrint({
	slides: mergedSlides,
	activeSlideIndex,
	rasterizeSlide,
	slideSize: canvasSize,
	handoutMaster,
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
const {
	canGroup,
	canUngroup,
	canDistribute,
	selectionGroupable,
	onAlign,
	onDistribute,
	onGroup,
	onUngroup,
} = useAlignGroup({
	selectedElements,
	selectedElementIds,
	activeSlideIndex,
	slides,
	pushHistory: history.pushHistory,
});

// -- Element context menu (right-click / long-press) -------------------
const { contextMenu, contextItems, onCanvasContextMenu, onContextSelect } = useContextMenu({
	canEdit: () => canEditEffective.value,
	findActiveElement,
	tableSelection,
	hasClipboard: clipboard.hasClipboard,
	canGroup,
	selectionGroupable,
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
		canEdit: () => canEditEffective.value,
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
	slides,
	coreProperties,
	appProperties,
	customProperties,
	tagCollections,
	markDirty: () => {
		autosave.isDirty.value = true;
	},
	pushHistory: history.pushHistory,
	// Mirror React's refreshContentAfterThemeChange: re-serialise and reload so
	// slide colours re-resolve against the newly-applied theme. These bytes go
	// straight back into our own loader, which has no password, so they use the
	// plaintext recovery serialisation rather than `getContent`.
	refreshContent: async () => {
		source.internalContent.value = await getRecoverySnapshot();
	},
});

// -- Table style DEFINITION editor ("Edit style...") persistence: threads
// edits/deletes from the element inspector's table panel into `deck`'s
// mutable `tableStyleMap`/`tableStylesToDelete`, which `deck.serialize`
// forwards to every `handler.save(...)` call via `tableStyleSaveOptions`.
const tableStyleMapHandlers = useTableStyleMapHandlers({
	tableStyleMap: deck.tableStyleMap,
	tableStylesToDelete: deck.tableStylesToDelete,
	markDirty: () => {
		autosave.isDirty.value = true;
	},
});

// -- Comments ----------------------------------------------------------
// An explicit host `authorName` wins; otherwise fall back to the user's own
// Options > General > "User name" before the generic "You".
const authorNameRef = computed(
	() => props.authorName || viewerOptions.value.general.userName || 'You',
);
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
	// Session-level save options (view properties, table styles, tags, deck
	// properties, ...), built the same way as `deck.serialize`, so an owner's
	// write-back file no longer drops every session-level edit outside `slides`.
	getSaveOptions: () =>
		buildDeckSaveOptions({
			headerFooter: headerFooter.value,
			presentationProperties: presentationProperties.value,
			viewProperties: viewProperties.value,
			customShows: customShows.value,
			sections: sections.value,
			coreProperties: coreProperties.value,
			appProperties: appProperties.value,
			customProperties: customProperties.value,
			tagCollections: tagCollections.value,
			slideMasters: slideMasters.value,
			notesMaster: notesMaster.value,
			handoutMaster: handoutMaster.value,
			slideSize: resolveSlideSizeSelection({
				current: deck.slideSize.value,
				canvas: canvasSize.value,
			}).size,
			tableStyleMap: tableStyleMap.value,
			tableStylesDefaultId: deck.tableStylesDefaultId.value,
			tableStylesToDelete: deck.tableStylesToDelete.value,
			embedFonts: fontEmbedding.embedFontsEnabled.value,
		}),
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

// Honours `p:showPr/p:sldRg`: a deck authored to open into a custom slide
// range (`showSlidesMode === 'range'`) presents only that range instead of
// the whole deck. Fed to `PresentationMode` alongside `activeCustomShow`.
const presentationAuthoredRange = computed(
	() => resolveAuthoredSlideRange(presentationProperties.value, slides.value.length) ?? null,
);

// -- Master view (slide / notes / handout masters) ---------------------
const masterView = useMasterViewWiring({
	slideMasters,
	notesMaster,
	handoutMaster,
	markDirty: () => {
		autosave.isDirty.value = true;
	},
});

// Slide Master view sidebar CRUD (Insert/Duplicate/Delete/Rename Layout and
// Slide Master). Real ZIP surgery (`pptx-viewer-core`) that hands back a new
// `handler` + `data`, adopted the same way `refreshContent` above adopts a
// re-serialised deck: the mutation is not an in-place edit.
const masterViewCrud = useMasterViewCrud({
	handler,
	slideMasters,
	deckData: () => readDeckData(deck),
	target: () => ({
		tab: masterView.masterViewTab.value,
		masterIndex: masterView.activeMasterIndex.value,
		layoutIndex: masterView.activeLayoutIndex.value,
	}),
	onSelectMaster: masterView.onSelectMaster,
	onSelectLayout: masterView.onSelectLayout,
	markDirty: () => {
		autosave.isDirty.value = true;
	},
	pushHistory: history.pushHistory,
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
	const incoming = await new PptxHandler().load(picked.buffer, {
		allowExternalImages: viewerOptions.value.trust.allowExternalContent,
	});
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
			if (!canEditEffective.value || presentation.presenting.value) {
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
		canEdit: () => canEditEffective.value,
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
		presentFromBeginning: presentation.presentFromBeginning,
		startPresenting: presentation.startPresenting,
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

// Seed the View-tab snap/guide toggles from the deck's own `viewProps.xml` on
// every load, and write user changes back so a save round-trips them. Kept
// out of the undo stack (PowerPoint does not undo View-tab toggles).
useDeckViewPreferencesSync({
	viewProperties,
	loadVersion,
	snapToGrid: drag.snapToGrid,
	snapToObjects: drag.snapToShape,
	showGuides,
});

// -- Viewer settings ---------------------------------------------------
const reducedMotion = ref(false);
// `optionsStore` / `viewerOptions` (the six legacy toggles below stay the
// behavior source and sync with it both ways) are declared up near `password`,
// ahead of `useLoadContent` - see the comment there.
// Viewer-root CSS classes reflecting display-affecting options (reduced
// motion, disabled hardware acceleration, "optimize for compatibility").
const optionRootClasses = computed(() => resolveOptionRootClasses(viewerOptions.value, 'pptx-vue'));
// Options > Quick Access Toolbar > "Show below the Ribbon": `TitleBar.vue`
// suppresses its own inline strip when this is the position, and this row
// renders in its place, directly under `RibbonToolbar`.
const belowRibbonQuickAccess = computed(() => {
	const quickAccess = viewerOptions.value.quickAccess;
	if (!quickAccess.visible || quickAccess.position !== 'below') {
		return [];
	}
	return extraQuickAccessCommands(quickAccess.commandIds).map((command) => ({
		id: command.id,
		label: t(command.labelKey),
		icon: command.icon,
	}));
});
// The host's own 3D opt-in props, ANDed with the viewer user's Options >
// Advanced > "Disable 3D rendering" override (see `resolve3DRenderingFlags`),
// each provided as a computed ref so toggling the option takes effect live,
// without needing a reload.
const effective3D = computed(() =>
	resolve3DRenderingFlags(
		{
			smartArt3D: props.smartArt3D,
			surfaceChart3D: props.surfaceChart3D,
			barChart3D: props.barChart3D,
			lineChart3D: props.lineChart3D,
			areaChart3D: props.areaChart3D,
			pieChart3D: props.pieChart3D,
		},
		viewerOptions.value,
	),
);
// SmartArt 3D opt-in: surface it to the element dispatcher via inject.
provide(
	SmartArt3DKey,
	computed(() => effective3D.value.smartArt3D),
);
// Surface-chart 3D opt-in: surface it to ChartRenderer via inject.
provide(
	SurfaceChart3DKey,
	computed(() => effective3D.value.surfaceChart3D),
);
// Bar3D-chart 3D opt-in: surface it to ChartRenderer via inject.
provide(
	BarChart3DKey,
	computed(() => effective3D.value.barChart3D),
);
// Line3D-chart 3D opt-in: surface it to ChartRenderer via inject.
provide(
	LineChart3DKey,
	computed(() => effective3D.value.lineChart3D),
);
// Area3D-chart 3D opt-in: surface it to ChartRenderer via inject.
provide(
	AreaChart3DKey,
	computed(() => effective3D.value.areaChart3D),
);
// Pie3D-chart 3D opt-in: surface it to ChartRenderer via inject.
provide(
	PieChart3DKey,
	computed(() => effective3D.value.pieChart3D),
);

// File > Options > Add-ins: real availability signals for the two catalog
// entries this binding can actually answer for. `smartArt3d` reflects the
// same host-prop/user-override AND `effective3D` already resolves; live
// collaboration reflects whether a session is currently joined. Every other
// catalog id (model3d, emfConverter, mtxDecompressor, locales) has no
// runtime on/off switch - they are bundled dependencies that are simply
// always there - so they are left out and fall back to the pane's own
// `active: true` default rather than being padded with a fake status here.
const addinStatus = computed<ViewerAddinStatus>(() => ({
	smartArt3d: effective3D.value.smartArt3D,
	collaboration: collaboration.collabActive.value,
}));

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

// File > Options > Save > "cache retention": a one-time sweep per mount is
// enough, since a fresh snapshot only ever lands with a fresh timestamp.
onMounted(() => {
	void (async () => {
		try {
			const snapshots = await listAutosaveSnapshots();
			const expired = resolveExpiredAutosaveSnapshots(snapshots, viewerOptions.value);
			await Promise.all(expired.map((key) => deleteAutosaveSnapshot(key)));
		} catch {
			// Best-effort background maintenance; a blocked IndexedDB skips it.
		}
	})();
});

// File > Options > Save > "clear cache on close": wipe recovery snapshots
// when the tab closes/navigates away, and when this viewer unmounts.
function clearCacheIfRequested(): void {
	if (shouldClearAutosaveCacheOnClose(viewerOptions.value)) {
		onOptionsClearCache();
	}
}
if (typeof window !== 'undefined') {
	window.addEventListener('beforeunload', clearCacheIfRequested);
}
onBeforeUnmount(() => {
	if (typeof window !== 'undefined') {
		window.removeEventListener('beforeunload', clearCacheIfRequested);
	}
	clearCacheIfRequested();
});

const { drawingActive, addInkStroke, eraseInkAt } = useInkDrawing({
	canEdit: () => canEditEffective.value,
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
	templateElementsBySlideId,
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
	viewProperties,
	tableStyleMap,
	tableStylesDefaultId: deck.tableStylesDefaultId,
	tagCollections,
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
	canEdit: () => canEditEffective.value,
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
	canEdit: () => canEditEffective.value,
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
	presentFromBeginning: presentation.presentFromBeginning,
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
		:class="[props.class, { 'pptx-vue-reduced-motion': reducedMotion }, ...optionRootClasses]"
		:style="themeStyle"
		:aria-busy="loading ? 'true' : 'false'"
		:tabindex="canEditEffective ? 0 : undefined"
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
				<!-- Trust Center > Protected View: shown only when the HOST allows
				     editing but the option is still blocking it; a document the host
				     opened read-only never shows this (there is nothing to enable). -->
				<div
					v-if="props.canEdit && protectedViewActive"
					class="pptx-vue-protected-view-banner flex items-center gap-3 border-b border-amber-700/30 bg-amber-900/20 px-4 py-2"
					role="status"
				>
					<ShieldAlert class="h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
					<p class="flex-1 text-xs text-amber-200">
						<strong>{{ t('pptx.security.protectedViewTitle') }}</strong
						>:
						{{ t('pptx.options.trust.protectedViewInfo') }}
					</p>
					<button
						type="button"
						class="shrink-0 rounded border border-amber-600/50 px-3 py-1 text-xs font-medium text-amber-100 transition-colors hover:bg-amber-700/30"
						@click="enableEditing"
					>
						{{ t('pptx.security.enableEditing') }}
					</button>
				</div>

				<!-- The deck's own `p:modifyVerifier` / "Mark as Final" recommendation:
				     shown regardless of `props.canEdit` (a host-read-only deck still
				     benefits from the "why" this banner explains). -->
				<ReadOnlyBanner
					v-if="readOnlyRec.showBanner.value"
					:kind="readOnlyRec.recommendation.value.kind"
					:message-key="readOnlyRec.recommendation.value.messageKey"
					@edit-anyway="readOnlyRec.editAnyway"
					@dismiss="readOnlyRec.dismiss"
				/>

				<!-- PowerPoint-style title bar sits ABOVE and OUTSIDE the
				     role="toolbar" ribbon element (which e2e measures for height
				     parity), gated like React on desktop + non-present. -->
				<TitleBar
					v-if="!isMobile"
					:mode="ribbonMode"
					:can-edit="canEditEffective"
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
				<!-- Both the ribbon and its optional below-strip are grouped under one
				     v-if so MobileToolbar's v-else keeps pairing with "desktop or
				     not" (its original condition), not with the below-strip's OWN
				     (usually-false) condition: an ungrouped sibling v-if/v-else pair
				     here previously bound MobileToolbar's v-else to the below-strip
				     div instead of the ribbon, so MobileToolbar rendered ALONGSIDE
				     the desktop ribbon whenever no below-ribbon Quick Access was
				     configured (the default), covering the ribbon and swallowing
				     clicks meant for it. -->
				<template v-if="!isMobile">
					<RibbonToolbar
						v-bind="ribbonProps"
						:hidden-actions="props.hiddenActions"
						:recent-presentations-count="viewerOptions.advanced.recentPresentationsCount"
						:ai-enabled="Boolean(props.ai)"
						:is-ai-panel-open="aiPanelOpen"
						:on-toggle-ai-panel="() => (aiPanelOpen = !aiPanelOpen)"
					/>
					<!-- Options > Quick Access Toolbar > "below the Ribbon" -->
					<div
						v-if="belowRibbonQuickAccess.length > 0"
						class="flex items-center border-b border-border bg-background px-2 py-0.5"
						data-pptx-quick-access-below
					>
						<TitleBarQuickAccess
							:items="belowRibbonQuickAccess"
							:show-labels="viewerOptions.quickAccess.showCommandLabels"
							:on-command="handleQuickAccessCommand"
						/>
					</div>
				</template>
				<!-- The AI bindings must be passed here too: `ribbonProps` does not
				     carry them, so without these the mobile toolbar's Sparkles
				     toggle never rendered and the assistant was unreachable on
				     phones (the desktop quick-access bar is replaced by this
				     toolbar on mobile). -->
				<MobileToolbar
					v-else
					v-bind="ribbonProps"
					:hidden-actions="props.hiddenActions"
					:recent-presentations-count="viewerOptions.advanced.recentPresentationsCount"
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
				v-if="canEditEffective && findOpen"
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

			<!-- Hidden (not unmounted) while presenting: the show overlay is a
			     separate fixed layer painting the SHOW's slide, so the editor
			     canvas underneath would otherwise keep showing the slide the
			     author had selected, which an authored `p:sldRg` / custom show
			     may exclude. The other bindings present in place on the same
			     stage; Vue keeps the editor mounted so its refs (touch gestures,
			     inspector state) survive the show. -->
			<div v-show="!presentation.presenting.value" class="pptx-vue-body">
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
					:can-edit="canEditEffective"
					:has-sections="hasSections"
					:section-ops="sectionOps"
					:slide-ops="slideOps"
					:go-to="goTo"
					:toggle-slide-hidden="toggleSlideHidden"
				/>

				<main
					ref="mainRef"
					class="pptx-vue-main"
					:class="{ 'is-editable': canEditEffective }"
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
						:can-drag-guides="canEditEffective && !presentation.presenting.value"
						:template-elements="activeTemplateElements"
						:edit-template-mode="editTemplateMode && !presentation.presenting.value"
						:inline-editing-element-id="inlineEdit.inlineEditingElementId.value"
						@update:fit-scale="fitScale = $event"
						@create-guide="drag.addGuide"
					>
						<ViewerCanvasOverlays
							:can-edit="canEditEffective"
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
					:can-edit="canEditEffective"
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
					:on-table-style-map-change="tableStyleMapHandlers.onTableStyleMapChange"
					:on-delete-table-style="tableStyleMapHandlers.onDeleteTableStyle"
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
				v-if="canEditEffective && !isMobile && slideCount > 0 && !presentation.presenting.value"
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
				:show-notes="canEditEffective"
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
				:can-edit="canEditEffective"
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
				:addin-status="addinStatus"
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
				:crud="masterViewCrud"
				:slide-masters="slideMasters"
				:canvas-size="canvasSize"
				:media-data-urls="mediaDataUrls"
				:notes-master="notesMaster"
				:notes-canvas-size="deck.notesCanvasSize.value"
				:handout-master="handoutMaster"
				:can-edit="canEditEffective"
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
				:deck-actions="deckActions"
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
				:can-edit="canEditEffective"
				:keyboard-inset="keyboardInset"
				:inspector-element="inspector.inspectorElementForPanels.value"
				:author-name="authorNameRef"
				:notes-master="notesMaster"
				:go-to="goTo"
				:toggle-slide-hidden="toggleSlideHidden"
				:on-notes-update="onNotesUpdate"
				:on-inspector-update="inspector.onInspectorUpdate"
				:on-update-slide-animations="inspector.writeSlideAnimations"
				:on-table-style-map-change="tableStyleMapHandlers.onTableStyleMapChange"
				:on-delete-table-style="tableStyleMapHandlers.onDeleteTableStyle"
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

		<!-- Compatibility-warning toasts: load diagnostics, hidden during a
		     running show like the rest of the editor chrome. -->
		<CompatibilityToasts
			v-if="!presentation.presenting.value"
			:toasts="compatToasts.visibleToasts.value"
			:overflow-count="compatToasts.overflowCount.value"
			@dismiss="compatToasts.dismiss"
			@dismiss-all="compatToasts.dismissAll"
		/>

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
			:can-edit="canEditEffective"
			:presentation-properties="presentationProperties"
			:custom-shows="customShows"
			:authored-range="presentationAuthoredRange"
			:end-with-black-slide="viewerOptions.advanced.slideShowEndWithBlackSlide"
			:prompt-keep-ink-annotations="viewerOptions.advanced.slideShowPromptKeepInkAnnotations"
			:show-menu-on-right-click="viewerOptions.advanced.slideShowShowMenuOnRightClick"
			:show-popup-toolbar="viewerOptions.advanced.slideShowShowPopupToolbar"
			:duplicate-slide="slideOps.duplicateSlide"
			:delete-slide="slideOps.deleteSlide"
			:toggle-slide-hidden="toggleSlideHidden"
		/>
	</div>
</template>
