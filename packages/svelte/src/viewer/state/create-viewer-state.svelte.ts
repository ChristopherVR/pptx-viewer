import type { PptxSaveFormat } from 'pptx-viewer-core';
import {
	buildFieldSubstitutionContext,
	deleteAutosaveSnapshot,
	listAutosaveSnapshots,
	resolve3DRenderingFlags,
	resolveExpiredAutosaveSnapshots,
	resolveImageResolutionScale,
	resolveSlideSizeSelection,
} from 'pptx-viewer-shared';
import type { FieldSubstitutionContext } from 'pptx-viewer-shared';

import { provideTranslator } from '../../i18n/context';
import { createDeckApi } from '../editor/deck-api';
import { createEditingApi } from '../editor/editing-api';
import { EditorState } from '../editor/editor-state.svelte';
import { createExportingApi } from '../export/exporting-api';
import { provideAreaChart3D } from './area-chart-3d-context';
import { provideBarChart3D } from './bar-chart-3d-context';
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
import { provideLineChart3D } from './line-chart-3d-context';
import { createOpenFile } from './open-file';
import { providePieChart3D } from './pie-chart-3d-context';
import { PresentationLoader } from './presentation-loader.svelte';
import { runQuickAccessCommand } from './quick-access-commands';
import { provideRenderContext } from './render-context';
import { provideSmartArt3D } from './smart-art-3d-context';
import { provideSurfaceChart3D } from './surface-chart-3d-context';
import { provideTableCellSelection } from './table-cell-selection-context';
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

	// The live editable flag. Seeded from the host prop, but writable, because
	// an AI edit and `deck.setMode()` both have to flip editing without waiting
	// for the host to re-render.
	let editable = $state(false);
	$effect(() => {
		editable = options.getEditable();
	});
	const setEditable = (next: boolean): void => {
		editable = next;
	};
	// Trust Center > "Open presentations in Protected View" ANDs onto the raw
	// flag continuously (a live gate, not a one-shot "block on load"): the only
	// way back to editing a protected deck is unchecking the option in File >
	// Options, so the gate has to keep listening for that instead of forcing
	// `editable` false once and leaving no way to reverse it. `editorUi` is a
	// forward reference (assigned a few lines below, like `getOptionsIntervalSeconds`
	// elsewhere in this file); safe because this closure is only ever CALLED
	// later, once construction below has completed.
	const getEditable = (): boolean =>
		editable && !editorUi.optionsState.options.trust.openInProtectedView;

	const loader = new PresentationLoader();
	provideRenderContext({
		getColorScheme: () => loader.colorScheme,
		getTableStyleMap: () => loader.tableStyleMap,
		getFontScheme: () => loader.presentationTheme?.fontScheme,
		getCanvasSize: () => loader.canvasSize,
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
		// Design > Slide Size. The EMU state wins wherever it still agrees with
		// the pixel canvas (a pixel round-trip would cost Ledger its preset
		// identity); once the raw W/H inputs disagree, the pixels win.
		getSlideSize: () =>
			resolveSlideSizeSelection({ current: loader.slideSize, canvas: loader.canvasSize }).size,
		onChange: () => {
			options.onchange?.();
			void editor.save().then((bytes) => options.oncontentchange?.(bytes));
		},
	});
	// Deck-level inspector actions (Properties tab, no selection), via context.
	provideInspectorDeck(createInspectorDeckActions({ loader, editor }));
	// The canvas table-cell range, so `TableView` can ring the selected block.
	// A getter, not a snapshot: the reads stay live against the runes state.
	provideTableCellSelection((elementId, row, col) =>
		editor.tableCells.contains(elementId, row, col),
	);

	// oxlint-disable-next-line react-hooks/rules-of-hooks
	const collabCluster = useCollabCluster({
		loader,
		viewer,
		editor,
		options,
		getEditable,
		// Forward reference (like `getScale` below): the options cluster is built
		// after this one, and the cadence is only read when a save is scheduled.
		getOptionsIntervalSeconds: () => editorUi.optionsState.autosaveIntervalSeconds,
	});
	// oxlint-disable-next-line react-hooks/rules-of-hooks
	const editorUi = useEditorUiCluster({
		loader,
		editor,
		viewer,
		collab: collabCluster.collab,
		options,
		getScale: () => derived.scale,
		getEditable,
		// The RAW preference, not the host-gated effective value: the options store
		// persists what the user chose, and a host shipping `autosave={false}`
		// must not rewrite that choice for every other host.
		getAutosaveEnabled: () => collabCluster.autosavePreference,
		setAutosaveEnabled: collabCluster.setAutosaveFlag,
	});

	// Trust Center > "Allow external content": read live on every load, not
	// snapshotted once, so a user who flips the option keeps it in effect for
	// the very next file they open.
	loader.getLoadOptions = () => ({
		allowExternalImages: editorUi.optionsState.options.trust.allowExternalContent,
	});

	// Each 3D opt-in flag ANDs the host's own prop with Options > Advanced >
	// "Disable 3D rendering" (see `resolve3DRenderingFlags`), so a viewer user
	// can force flat 2D even in a deck the host enabled 3D for. Getter closures
	// (not snapshots), like every other field here, so `editorUi.optionsState`
	// -- built just above, hence the 3D provides live below it rather than at
	// the top with the rest -- stays live for consumers.
	const getEffective3D = () =>
		resolve3DRenderingFlags(
			{
				smartArt3D: options.getSmartArt3D(),
				surfaceChart3D: options.getSurfaceChart3D(),
				barChart3D: options.getBarChart3D(),
				lineChart3D: options.getLineChart3D(),
				areaChart3D: options.getAreaChart3D(),
				pieChart3D: options.getPieChart3D(),
			},
			editorUi.optionsState.options,
		);
	provideSmartArt3D(() => getEffective3D().smartArt3D);
	provideSurfaceChart3D(() => getEffective3D().surfaceChart3D);
	provideBarChart3D(() => getEffective3D().barChart3D);
	provideLineChart3D(() => getEffective3D().lineChart3D);
	provideAreaChart3D(() => getEffective3D().areaChart3D);
	providePieChart3D(() => getEffective3D().pieChart3D);

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
		t: options.t,
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
		getSurfaceChart3D: options.getSurfaceChart3D,
		getBarChart3D: options.getBarChart3D,
		getLineChart3D: options.getLineChart3D,
		getAreaChart3D: options.getAreaChart3D,
		getPieChart3D: options.getPieChart3D,
		getImageResolutionScale: () => resolveImageResolutionScale(editorUi.optionsState.options),
		getIncludeHiddenSlides: () => editorUi.optionsState.options.advanced.printHiddenSlides,
		getPrintHighQuality: () => editorUi.optionsState.options.advanced.printHighQuality,
		getRootEl: options.getRootEl,
		getEditable,
		getFieldContext: fieldContext,
		getFileName: () => options.getFileName?.(),
		onnotesupdate: options.onnotesupdate,
	});

	const rawEditingApi = createEditingApi(editor);
	// Options > Accessibility > "feedback with sound", and Options > Save >
	// "keep the last AutoRecover version": once a `.pptx` Save/Save-As download
	// actually lands, play the completion cue and, unless the user asked to
	// keep it, discard the crash-recovery snapshot for this file (the real
	// file on disk already has the work).
	const afterSuccessfulSave = (format: PptxSaveFormat): void => {
		editorUi.optionsState.playFeedback();
		const filePath = options.getFilePath();
		if (format === 'pptx' && filePath && editorUi.optionsState.shouldDiscardAutosaveOnSave) {
			void deleteAutosaveSnapshot(filePath);
		}
	};
	const editingApi = {
		...rawEditingApi,
		save: async (format?: PptxSaveFormat) => {
			const bytes = await rawEditingApi.save(format);
			afterSuccessfulSave(format ?? 'pptx');
			return bytes;
		},
		downloadAs: async (format: PptxSaveFormat, fileName?: string) => {
			await rawEditingApi.downloadAs(format, fileName);
			afterSuccessfulSave(format);
		},
		downloadPptx: async (fileName?: string) => {
			await rawEditingApi.downloadPptx(fileName);
			afterSuccessfulSave('pptx');
		},
	};
	const exportingApi = createExportingApi(exportNotes.exportWiring.controller);
	const deck = createDeckApi({
		editor,
		viewer,
		getZoomPercent: () => derived.effectivePercent,
		getMode: () => derived.viewerMode,
		toggleFullscreen: presentationCluster.onFullscreenToggle,
		setEditable,
	});

	// File > Options > Save > "cache retention": a one-time sweep per mount is
	// enough, since a fresh snapshot only ever lands with a fresh timestamp.
	void (async () => {
		try {
			const snapshots = await listAutosaveSnapshots();
			const expired = resolveExpiredAutosaveSnapshots(snapshots, editorUi.optionsState.options);
			await Promise.all(expired.map((key) => deleteAutosaveSnapshot(key)));
		} catch {
			// Best-effort background maintenance; a blocked IndexedDB skips it.
		}
	})();

	// File > Options > Save > "clear cache on close": wipe recovery snapshots
	// when the tab closes/navigates away, and when this viewer is destroyed.
	function clearCacheOnUnload(): void {
		if (editorUi.optionsState.shouldClearCacheOnClose) {
			void editorUi.optionsState.clearCache();
		}
	}
	if (typeof window !== 'undefined') {
		window.addEventListener('beforeunload', clearCacheOnUnload);
	}

	function destroy(): void {
		if (typeof window !== 'undefined') {
			window.removeEventListener('beforeunload', clearCacheOnUnload);
		}
		clearCacheOnUnload();
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
		autosaveRecovery: collabCluster.autosaveRecovery,
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
		get autosaveToggleAvailable() {
			return collabCluster.autosaveToggleAvailable;
		},
		get autosaveDisabledReason() {
			return collabCluster.autosaveDisabledReason;
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
		onWheel: presentationCluster.onWheel,
		downloadPptx: editingApi.downloadPptx,
		downloadAs: editingApi.downloadAs,
		destroy,
	};
}
