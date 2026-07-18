import type { ViewerMode } from 'pptx-viewer-shared';
import { onDestroy, onMount } from 'svelte';

import { provideTranslator } from '../../i18n/context';
import { createEditingApi } from '../editor/editing-api';
import { EditorState } from '../editor/editor-state.svelte';
import { createExportingApi } from '../export/exporting-api';
import { PresenterSession } from '../presentation';
import { useCollabCluster } from './create-viewer-state-collab.svelte';
import { useEditorUiCluster } from './create-viewer-state-editor-ui.svelte';
import { buildExportNotesCluster } from './create-viewer-state-export-notes.svelte';
import { usePresentationCluster } from './create-viewer-state-presentation.svelte';
import type { CreateViewerStateOptions, ViewerStateBag } from './create-viewer-state-types';
import { createInspectorDeckActions, provideInspectorDeck } from './inspector-deck';
import { fitScale } from './navigation';
import { PresentationLoader } from './presentation-loader.svelte';
import { provideRenderContext } from './render-context';
import { provideSmartArt3D } from './smart-art-3d-context';
import { ViewerState } from './viewer-state.svelte';

/**
 * Builds every reactive controller the ribbon, toolbar, and slide canvas
 * need: the runes port of `PowerPointViewer.svelte`'s own construction block
 * (originally inlined at the top of its `<script>`), extracted so a host can
 * compose its own viewer shell out of `Ribbon` / `ViewerToolbar` / the state
 * classes without pulling in the whole `PowerPointViewer` component.
 *
 * MUST be called synchronously from a `.svelte` component's own script body
 * (top level, not inside a callback or after an `await`): it registers
 * `onMount` / `onDestroy` hooks and Svelte context (`setContext`) via
 * `provideTranslator` / `provideSmartArt3D` / `provideRenderContext` /
 * `provideZoomNavigation` (inside the editor-ui cluster) / `provideInspectorDeck`,
 * all of which require an active component-initialisation context. Svelte's
 * lifecycle context stays active for the whole synchronous execution of a
 * component's script, not just its top-level statements, so calling this
 * from a component's script works exactly like inlining the same code would.
 *
 * Construction is split across a few `create-viewer-state-*.svelte.ts`
 * helpers purely to stay under the repo's file-size budget; the ORDER those
 * helpers are invoked in below mirrors the original inline code (later
 * clusters close over earlier ones), with one deliberate reordering: the
 * collaboration cluster is now built right after `editor` (it doesn't need
 * the editing-chrome cluster), which lets `controller` close over the real
 * `collab.setCursor` instead of a forward reference.
 *
 * Call the returned `destroy()` from the host component's own `onDestroy`.
 */
export function createViewerState(options: CreateViewerStateOptions): ViewerStateBag {
	provideTranslator(options.t);
	provideSmartArt3D(options.getSmartArt3D);

	const loader = new PresentationLoader();
	provideRenderContext({
		getColorScheme: () => loader.colorScheme,
		getTableStyleMap: () => loader.tableStyleMap,
	});
	const viewer = new ViewerState();
	let presenterMode = $state(false);
	let presenterStartedAt = $state(Date.now());
	const presenterSession = new PresenterSession({
		getSource: options.getSource,
		getSlideIndex: () => viewer.current,
		onAudienceSlide: (index) => viewer.goTo(index),
		onAudienceExit: () => (viewer.isFullscreen = false),
	});
	onMount(() => {
		presenterSession.connect();
		if (presenterSession.isAudience) {
			viewer.isFullscreen = true;
		}
	});
	onDestroy(() => presenterSession.dispose());
	$effect(() => {
		presenterSession.sync(viewer.current);
	});
	function enterPresenterView(): void {
		presenterStartedAt = Date.now();
		presenterMode = true;
	}

	const editor = new EditorState({
		getCurrent: () => viewer.current,
		getHandler: () => loader.handler,
		onChange: () => {
			options.onchange?.();
			void editor.save().then((bytes) => options.oncontentchange?.(bytes));
		},
	});
	provideInspectorDeck(createInspectorDeckActions({ loader, editor }));

	// The `use*Cluster` helpers below are named after this codebase's
	// pre-existing Svelte `$effect`-registering-function convention (e.g.
	// `useViewerEffects`), not React hooks; oxlint's `react-hooks` plugin
	// applies its naming heuristic regardless, so it's suppressed per call.
	// oxlint-disable-next-line react-hooks/rules-of-hooks
	const collabCluster = useCollabCluster({ loader, viewer, editor, options });
	// oxlint-disable-next-line react-hooks/rules-of-hooks
	const editorUi = useEditorUiCluster({
		loader,
		editor,
		viewer,
		collab: collabCluster.collab,
		options,
		getScale: () => scale,
	});

	const fittedScale = $derived(
		fitScale(
			options.getViewportWidth(),
			options.getViewportHeight(),
			loader.canvasSize.width,
			loader.canvasSize.height,
			viewer.isFullscreen ? 0 : 24,
		),
	);
	const scale = $derived(
		viewer.isFullscreen ? fittedScale : fittedScale * ((viewer.zoomPercent ?? 100) / 100),
	);
	const effectivePercent = $derived(Math.max(1, Math.round(viewer.zoomPercent ?? 100)));
	const displaySlides = $derived(editor.renderedSlides);
	const activeSlide = $derived(displaySlides[viewer.current]);
	const chromeVisible = $derived(!viewer.isFullscreen);
	const editingActive = $derived(
		options.getEditable() && !viewer.isFullscreen && !collabCluster.collab.readOnly,
	);
	const showRibbon = $derived(
		options.getEditable() && !collabCluster.collab.readOnly && loader.slides.length > 0,
	);
	const viewerMode = $derived<ViewerMode>(
		editor.masterViewTarget
			? 'master'
			: viewer.isFullscreen
				? 'present'
				: options.getEditable()
					? 'edit'
					: 'preview',
	);
	$effect(() => options.ondirtychange?.(editor.dirty));
	$effect(() => options.onmodechange?.(viewerMode));
	$effect(() => options.onzoomchange?.(effectivePercent / 100));
	$effect(() => options.onselectionchange?.([...editor.selection.ids]));
	$effect(() => options.onslidecountchange?.(displaySlides.length));

	// oxlint-disable-next-line react-hooks/rules-of-hooks
	const presentationCluster = usePresentationCluster({
		editor,
		viewer,
		loader,
		parityUi: editorUi.parityUi,
		controller: editorUi.controller,
		getEditingActive: () => editingActive,
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
		getEditable: options.getEditable,
		onnotesupdate: options.onnotesupdate,
	});

	const editingApi = createEditingApi(editor);
	const exportingApi = createExportingApi(exportNotes.exportWiring.controller);

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
		findReplace: editorUi.findReplace,
		collab: collabCluster.collab,
		dialogs: collabCluster.dialogs,
		autosaveCtl: collabCluster.autosaveCtl,
		presentation: presentationCluster.presentation,
		presenterSession,
		exportWiring: exportNotes.exportWiring,
		exportUi: exportNotes.exportUi,
		t: options.t,
		editingApi,
		exportingApi,
		get scale() {
			return scale;
		},
		get effectivePercent() {
			return effectivePercent;
		},
		get displaySlides() {
			return displaySlides;
		},
		get activeSlide() {
			return activeSlide;
		},
		get chromeVisible() {
			return chromeVisible;
		},
		get editingActive() {
			return editingActive;
		},
		get showRibbon() {
			return showRibbon;
		},
		get viewerMode() {
			return viewerMode;
		},
		get autosaveActive() {
			return collabCluster.autosaveActive;
		},
		get autosaveEnabled() {
			return collabCluster.autosaveEnabled;
		},
		setAutosaveEnabled: collabCluster.setAutosaveEnabled,
		get presenterMode() {
			return presenterMode;
		},
		set presenterMode(next: boolean) {
			presenterMode = next;
		},
		get presenterStartedAt() {
			return presenterStartedAt;
		},
		get stageContextMenu() {
			return editorUi.stageContextMenu;
		},
		set stageContextMenu(next: { x: number; y: number } | null) {
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
		enterPresenterView,
		closeSignatureWarning: collabCluster.closeSignatureWarning,
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
