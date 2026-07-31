import { buildFieldSubstitutionContext } from 'pptx-viewer-shared';
import type { FieldSubstitutionContext } from 'pptx-viewer-shared';

import { provideTranslator } from '../../i18n/context';
import { createDeckApi } from '../editor/deck-api';
import { createEditingApi } from '../editor/editing-api';
import { EditorState } from '../editor/editor-state.svelte';
import { createExportingApi } from '../export/exporting-api';
import { useAiCluster } from './create-viewer-state-ai.svelte';
import { useCollabCluster } from './create-viewer-state-collab.svelte';
import { useViewerDerived } from './create-viewer-state-derived.svelte';
import { useEditorUiCluster } from './create-viewer-state-editor-ui.svelte';
import { buildExportNotesCluster } from './create-viewer-state-export-notes.svelte';
import { usePresentationCluster } from './create-viewer-state-presentation.svelte';
import { usePresenterCluster } from './create-viewer-state-presenter.svelte';
import type { CreateViewerStateOptions, ViewerStateBag } from './create-viewer-state-types';
import { provideFieldContext } from './field-context';
import { createInspectorDeckActions, provideInspectorDeck } from './inspector-deck';
import { createOpenFile } from './open-file';
import { PresentationLoader } from './presentation-loader.svelte';
import { runQuickAccessCommand } from './quick-access-commands';
import { provideRenderContext } from './render-context';
import { provideSmartArt3D } from './smart-art-3d-context';
import { ViewerState } from './viewer-state.svelte';

/**
 * Builds every reactive controller the ribbon, toolbar, and slide canvas
 * need. This is `PowerPointViewer.svelte`'s entire construction block,
 * extracted so that SFC stays thin composition and so a host can build its
 * own viewer shell out of `Ribbon` / `ViewerToolbar` / the state classes
 * without pulling in the whole `PowerPointViewer` component.
 *
 * MUST be called synchronously from a `.svelte` component's own script body
 * (top level, not inside a callback or after an `await`): it registers
 * `onMount` / `onDestroy` hooks and Svelte context (`setContext`) via
 * `provideTranslator` / `provideSmartArt3D` / `provideRenderContext` /
 * `provideInspectorDeck` / `provideFieldContext` (plus more inside the
 * clusters), all of which require an active component-initialisation
 * context. Svelte's lifecycle context stays active for the whole synchronous
 * execution of a component's script, not just its top-level statements, so
 * calling this from a component's script works exactly like inlining the
 * same code would.
 *
 * Construction is split across the `create-viewer-state-*.svelte.ts` helpers
 * purely to stay under the repo's file-size budget; the ORDER they are
 * invoked in below mirrors the original inline code (later clusters close
 * over earlier ones), with one deliberate reordering: the collaboration
 * cluster is built right after `editor` (it doesn't need the editing-chrome
 * cluster), which lets `controller` close over the real `collab.setCursor`
 * instead of a forward reference.
 *
 * Call the returned `destroy()` from the host component's own `onDestroy`.
 */
export function createViewerState(options: CreateViewerStateOptions): ViewerStateBag {
	provideTranslator(options.t);
	provideSmartArt3D(options.getSmartArt3D);

	// The live editable flag. Seeded from the host prop, but writable, because
	// an AI edit, `deck.setMode()` and Trust Center's Protected View all have to
	// flip editing without waiting for the host to re-render.
	let editable = $state(false);
	$effect(() => {
		editable = options.getEditable();
	});
	const getEditable = (): boolean => editable;
	const setEditable = (next: boolean): void => {
		editable = next;
	};

	const loader = new PresentationLoader();
	provideRenderContext({
		getColorScheme: () => loader.colorScheme,
		getTableStyleMap: () => loader.tableStyleMap,
		getFontScheme: () => loader.presentationTheme?.fontScheme,
	});
	const viewer = new ViewerState();
	// The `use*Cluster` helpers below are named after this codebase's
	// pre-existing Svelte `$effect`-registering-function convention (e.g.
	// `useViewerEffects`), not React hooks; oxlint's `react-hooks` plugin
	// applies its naming heuristic regardless, so it's suppressed per call.
	// oxlint-disable-next-line react-hooks/rules-of-hooks
	const presenter = usePresenterCluster({
		viewer,
		options,
		showEndOfShow: () => presentationCluster.presentation.showEndOfShow(),
	});

	const editor = new EditorState({
		getCurrent: () => viewer.current,
		getHandler: () => loader.handler,
		onChange: () => {
			options.onchange?.();
			void editor.save().then((bytes) => options.oncontentchange?.(bytes));
		},
	});
	// Deck-level inspector actions (Properties tab, no selection), via context.
	provideInspectorDeck(createInspectorDeckActions({ loader, editor }));

	// oxlint-disable-next-line react-hooks/rules-of-hooks
	const collabCluster = useCollabCluster({ loader, viewer, editor, options, getEditable });
	// oxlint-disable-next-line react-hooks/rules-of-hooks
	const editorUi = useEditorUiCluster({
		loader,
		editor,
		viewer,
		collab: collabCluster.collab,
		options,
		getScale: () => derived.scale,
		getEditable,
		setEditable,
		getAutosaveEnabled: () => collabCluster.autosaveEnabled,
		setAutosaveEnabled: collabCluster.setAutosaveFlag,
	});
	// oxlint-disable-next-line react-hooks/rules-of-hooks
	const ai = useAiCluster({
		loader,
		viewer,
		editor,
		collab: collabCluster.collab,
		options,
		setEditable,
	});
	// oxlint-disable-next-line react-hooks/rules-of-hooks
	const derived = useViewerDerived({
		loader,
		viewer,
		editor,
		collab: collabCluster.collab,
		options,
		getEditable,
	});

	/**
	 * Deck-level OOXML field-substitution context (date/time, header/footer,
	 * document properties, plus the active slide's number and title) so field
	 * runs render their display text instead of the authored placeholder
	 * ("Slide #"). Each `SlideStage` re-points the per-slide parts at its own
	 * slide, and the off-screen export stage is seeded with the same source.
	 */
	function fieldContext(): FieldSubstitutionContext {
		return buildFieldSubstitutionContext({
			headerFooter: editor.headerFooter,
			customProperties: editor.customProperties,
			slide: derived.activeSlide,
		});
	}
	// A getter closure (not a snapshot) keeps the runes reads live for consumers.
	provideFieldContext(fieldContext);

	// oxlint-disable-next-line react-hooks/rules-of-hooks
	const presentationCluster = usePresentationCluster({
		editor,
		viewer,
		loader,
		parityUi: editorUi.parityUi,
		controller: editorUi.controller,
		presenterSession: presenter.presenterSession,
		optionsState: editorUi.optionsState,
		getEditingActive: () => derived.editingActive,
		getStageHolderEl: options.getStageHolderEl,
		getRootEl: options.getRootEl,
	});

	const exportNotes = buildExportNotesCluster({
		editor,
		loader,
		viewer,
		t: options.t,
		getSmartArt3D: options.getSmartArt3D,
		getRootEl: options.getRootEl,
		getEditable,
		getFieldContext: fieldContext,
		onnotesupdate: options.onnotesupdate,
	});

	const editingApi = createEditingApi(editor);
	const exportingApi = createExportingApi(exportNotes.exportWiring.controller);
	const deck = createDeckApi({
		editor,
		viewer,
		getZoomPercent: () => derived.effectivePercent,
		getMode: () => derived.viewerMode,
		toggleFullscreen: presentationCluster.onFullscreenToggle,
		setEditable,
	});

	function destroy(): void {
		editorUi.controller.destroy();
		collabCluster.collab.stop();
		exportNotes.exportWiring.destroy();
		loader.dispose();
	}

	return {
		loader,
		viewer,
		editor,
		controller: editorUi.controller,
		parityUi: editorUi.parityUi,
		chromeUi: editorUi.chromeUi,
		optionsState: editorUi.optionsState,
		findReplace: editorUi.findReplace,
		collab: collabCluster.collab,
		dialogs: collabCluster.dialogs,
		autosaveCtl: collabCluster.autosaveCtl,
		presentation: presentationCluster.presentation,
		presenterSession: presenter.presenterSession,
		exportWiring: exportNotes.exportWiring,
		exportUi: exportNotes.exportUi,
		ai,
		t: options.t,
		editingApi,
		exportingApi,
		deck,
		get editable() {
			return editable;
		},
		set editable(next: boolean) {
			editable = next;
		},
		get scale() {
			return derived.scale;
		},
		get effectivePercent() {
			return derived.effectivePercent;
		},
		get displaySlides() {
			return derived.displaySlides;
		},
		get activeSlide() {
			return derived.activeSlide;
		},
		get chromeVisible() {
			return derived.chromeVisible;
		},
		get editingActive() {
			return derived.editingActive;
		},
		get showRibbon() {
			return derived.showRibbon;
		},
		get viewerMode() {
			return derived.viewerMode;
		},
		get autosaveActive() {
			return collabCluster.autosaveActive;
		},
		get autosaveEnabled() {
			return collabCluster.autosaveEnabled;
		},
		setAutosaveEnabled: collabCluster.setAutosaveEnabled,
		get presenterMode() {
			return presenter.presenterMode;
		},
		set presenterMode(next: boolean) {
			presenter.presenterMode = next;
		},
		get presenterStartedAt() {
			return presenter.presenterStartedAt;
		},
		get stageContextMenu() {
			return editorUi.stageContextMenu;
		},
		set stageContextMenu(next) {
			editorUi.stageContextMenu = next;
		},
		get activeMobileSheet() {
			return exportNotes.activeMobileSheet;
		},
		setActiveMobileSheet: exportNotes.setActiveMobileSheet,
		get notesExpanded() {
			return exportNotes.notesExpanded;
		},
		get versionHistoryOpen() {
			return collabCluster.versionHistoryOpen;
		},
		set versionHistoryOpen(next: boolean) {
			collabCluster.versionHistoryOpen = next;
		},
		get signatureWarningOpen() {
			return collabCluster.signatureWarningOpen;
		},
		enterPresenterView: presenter.enterPresenterView,
		closeSignatureWarning: collabCluster.closeSignatureWarning,
		openFile: createOpenFile(loader, () => options.onopenfile),
		runQuickAccessCommand: (id) =>
			runQuickAccessCommand(id, { deck, exportingApi, parityUi: editorUi.parityUi }),
		fieldContext,
		onNotesToggle: exportNotes.onNotesToggle,
		onNotesCommit: exportNotes.onNotesCommit,
		onFullscreenToggle: presentationCluster.onFullscreenToggle,
		onFullscreenChange: presentationCluster.onFullscreenChange,
		onKeydown: presentationCluster.onKeydown,
		downloadPptx: editingApi.downloadPptx,
		downloadAs: editingApi.downloadAs,
		destroy,
	};
}
