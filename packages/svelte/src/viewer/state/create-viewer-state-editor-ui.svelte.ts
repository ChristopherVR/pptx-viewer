import { computeGridSpacingPx, resolveAuthoredCustomShowId } from 'pptx-viewer-shared';

import type { CollaborationController } from '../collab';
import type { StageContextMenu } from '../components/props';
import { EditorController } from '../editor/editor-controller.svelte';
import { FindReplaceState } from '../editor/editor-find-replace.svelte';
import type { EditorState } from '../editor/editor-state.svelte';
import { ChromeUiState } from './chrome-ui.svelte';
import type { CreateViewerStateOptions } from './create-viewer-state-types';
import type { PresentationLoader } from './presentation-loader.svelte';
import { useViewerEffects } from './viewer-effects.svelte';
import { provideViewerOptions } from './viewer-options-context';
import { useViewerOptionsWiring } from './viewer-options-wiring.svelte';
import { ViewerOptionsState } from './viewer-options.svelte';
import { ViewerParityUiState } from './viewer-parity-ui.svelte';
import type { ViewerState } from './viewer-state.svelte';
import { provideZoomNavigation } from './zoom-navigation-context';

export interface EditorUiClusterDeps {
	loader: PresentationLoader;
	editor: EditorState;
	viewer: ViewerState;
	collab: CollaborationController;
	options: CreateViewerStateOptions;
	/** Effective canvas scale (main stage), or master-view scale when applicable. */
	getScale(): number;
	/** The live editable flag (not the raw host prop). */
	getEditable(): boolean;
	/** Flip the live editable flag (Trust Center's Protected View on load). */
	setEditable(editable: boolean): void;
	/** Autosave flag + toggle, owned by the collaboration cluster built before this one. */
	getAutosaveEnabled(): boolean;
	setAutosaveEnabled(enabled: boolean): void;
}

export interface EditorUiCluster {
	parityUi: ViewerParityUiState;
	chromeUi: ChromeUiState;
	optionsState: ViewerOptionsState;
	controller: EditorController;
	findReplace: FindReplaceState;
	stageContextMenu: StageContextMenu | null;
}

/**
 * The editing chrome cluster: view/print/annotation preferences
 * (`ViewerParityUiState`), the full File > Options model (`ViewerOptionsState`,
 * published via context for the quick-access bar / ribbon / Options dialog),
 * side-panel open state (`ChromeUiState`), the pointer/keyboard/history
 * controller (`EditorController`), the ribbon's Find & Replace panel state, and
 * the load-pipeline wiring (`useViewerEffects`, which needs `controller` to
 * close open selections/inline edits when `editable` flips off). Split out of
 * `createViewerState` to keep that file under the repo's file-size budget;
 * built after the collaboration cluster because `controller` reports cursor
 * moves to `collab.setCursor` and the options wiring drives its autosave flag.
 * Named `use*`, not `build*`, because of the `use*` calls it makes.
 */
export function useEditorUiCluster(deps: EditorUiClusterDeps): EditorUiCluster {
	const { loader, editor, viewer, collab, options } = deps;

	const parityUi = new ViewerParityUiState(editor);
	// Full PowerPoint File > Options model (persisted); provided to chrome
	// components (quick access, ribbon) and the Options dialog. The wiring below
	// keeps it in sync with the six legacy preference toggles both ways.
	const optionsState = new ViewerOptionsState();
	provideViewerOptions(optionsState);
	const chromeUi = new ChromeUiState();
	provideZoomNavigation({
		navigateToZoomTarget: (index) => viewer.goTo(index),
		getSlides: () => editor.renderedSlides,
	});

	let stageContextMenu = $state<StageContextMenu | null>(null);
	const controller = new EditorController(editor, {
		getScale: () => (editor.masterViewTarget ? options.getMasterScale() : deps.getScale()),
		getCurrent: () => viewer.current,
		getPresenting: () => viewer.isFullscreen,
		getStageRoot: () => options.getStageHolderEl()?.querySelector('.pptx-svelte-stage') ?? null,
		getHolderEl: () => options.getStageHolderEl() ?? null,
		onCursorMove: (x, y) => collab.setCursor(x, y, viewer.current),
		onContextMenu: (x, y, cell) => {
			stageContextMenu = { x, y, cell };
		},
		getSnapToGrid: () => parityUi.preferences.snapToGrid,
		getGridSize: () => computeGridSpacingPx(loader.viewProperties?.gridSpacing, 12),
		getSnapToShape: () => parityUi.snapToShape,
		getGuides: () => parityUi.guides,
		getLivePatcher: () => collab.livePatcher,
		getActiveSlide: () => editor.slides[viewer.current],
		// The stage gesture preventDefault()s the click, so the keymap's focus has
		// to be put back on the (focusable) viewer root after every canvas press.
		getRootEl: () => options.getRootEl() ?? null,
		toggleShortcuts: () => {
			parityUi.shortcutsOpen = !parityUi.shortcutsOpen;
		},
		closeShortcuts: () => {
			if (!parityUi.shortcutsOpen) {
				return false;
			}
			parityUi.shortcutsOpen = false;
			return true;
		},
		// `findReplace` is constructed just below; the closure only runs on a real
		// key press, long after this function has returned.
		toggleFind: () => findReplace.toggle(),
	});

	const findReplace = new FindReplaceState({
		getSlides: () => editor.slides,
		commitSlides: (next) => editor.commitSlides(next),
		onNavigate: (slideIndex, elementId) => {
			viewer.goTo(slideIndex);
			editor.select(elementId);
		},
	});

	// Guarded bidirectional sync (options <-> the six legacy toggles), undo
	// depth, and Trust Center's Protected View on load. Registered before
	// `useViewerEffects` so a load's Protected View verdict is applied in the
	// same order the inline wiring used to run in.
	useViewerOptionsWiring({
		optionsState,
		parityUi,
		editor,
		getAutosaveEnabled: deps.getAutosaveEnabled,
		setAutosaveEnabled: deps.setAutosaveEnabled,
		onAutosaveToggle: (enabled) => options.onautosavetoggle?.(enabled),
		getLoadCount: () => loader.loadCount,
		setEditable: deps.setEditable,
	});

	useViewerEffects({
		getSource: options.getSource,
		getEditable: () => deps.getEditable() && !collab.readOnly,
		getInitialSlide: options.getInitialSlide,
		getTranslator: () => options.t,
		loader,
		viewer,
		editor,
		controller,
		getOnload: () => options.onload,
		getOnerror: () => options.onerror,
		getOnslidechange: () => options.onslidechange,
		onContentApplied: () => {
			collab.adoptDocAfterLoad(loader.loadOrigin);
			// `p:showPr/p:custShow/@id` is authored intent: a deck saved with "Set
			// Up Slide Show > Custom show" plays that subset. It was parsed and
			// then ignored, so the radio was decorative. Seeded per load, so a
			// manual pick made afterwards still wins for the rest of the session.
			parityUi.activeCustomShowId =
				resolveAuthoredCustomShowId(loader.presentationProperties, loader.customShows) ?? null;
		},
	});

	return {
		parityUi,
		chromeUi,
		optionsState,
		controller,
		findReplace,
		get stageContextMenu() {
			return stageContextMenu;
		},
		set stageContextMenu(next: StageContextMenu | null) {
			stageContextMenu = next;
		},
	};
}
