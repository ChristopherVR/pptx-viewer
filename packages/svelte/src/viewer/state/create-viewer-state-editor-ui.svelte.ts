import {
	computeGridSpacingPx,
	resolveAuthoredCustomShowId,
	seedRecentColors,
	viewerPreferencesFromViewProperties,
	viewPropertiesPatchFromPreferences,
} from 'pptx-viewer-shared';
import { untrack } from 'svelte';

import type { CollaborationController } from '../collab';
import type { StageContextMenu } from '../components/props';
import { EditorController } from '../editor/editor-controller.svelte';
import { FindReplaceState } from '../editor/editor-find-replace.svelte';
import type { EditorState } from '../editor/editor-state.svelte';
import { ChromeUiState } from './chrome-ui.svelte';
import { CompatToastsState } from './compat-toasts.svelte';
import type { CreateViewerStateOptions } from './create-viewer-state-types';
import type { PresentationLoader } from './presentation-loader.svelte';
import { ReadOnlyRecommendationState } from './read-only-recommendation.svelte';
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
	/** The live editable flag (not the raw host prop; already ANDs Trust Center's Protected View). */
	getEditable(): boolean;
	/** Reset the Protected View "Enable Editing" dismissal; called on every new document load. */
	onNewDocumentLoaded?(): void;
	/** Autosave flag + toggle, owned by the collaboration cluster built before this one. */
	getAutosaveEnabled(): boolean;
	setAutosaveEnabled(enabled: boolean): void;
}

export interface EditorUiCluster {
	parityUi: ViewerParityUiState;
	readOnlyRec: ReadOnlyRecommendationState;
	compatToasts: CompatToastsState;
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
	// Wave 4 #2: the deck's own `p:modifyVerifier` / "Mark as Final" read-only
	// recommendation. `locked` is ANDed into the editable gate below, mirroring
	// (not duplicating) the existing Protected View mechanism.
	const readOnlyRec = new ReadOnlyRecommendationState({
		getModifyVerifier: () => loader.modifyVerifier,
		getCustomProperties: () => loader.customProperties,
	});
	// Wave 4 #3: fidelity-loss toasts from `handler.getCompatibilityWarnings()`.
	const compatToasts = new CompatToastsState({
		getWarnings: () => loader.compatibilityWarnings,
	});
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

	// Guarded bidirectional sync (options <-> the six legacy toggles) and undo
	// depth. Trust Center's Protected View is not load-triggered wiring here:
	// `getEditable` (built by the composition root) already ANDs it in
	// continuously, so unchecking the option re-enables editing immediately
	// instead of only taking effect on the next load.
	useViewerOptionsWiring({
		optionsState,
		parityUi,
		editor,
		getAutosaveEnabled: deps.getAutosaveEnabled,
		setAutosaveEnabled: deps.setAutosaveEnabled,
		onAutosaveToggle: (enabled) => options.onautosavetoggle?.(enabled),
	});

	useViewerEffects({
		getSource: options.getSource,
		getEditable: () => deps.getEditable() && !collab.readOnly && !readOnlyRec.locked,
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
			deps.onNewDocumentLoaded?.();
			collab.adoptDocAfterLoad(loader.loadOrigin);
			// `p:showPr/p:custShow/@id` is authored intent: a deck saved with "Set
			// Up Slide Show > Custom show" plays that subset. It was parsed and
			// then ignored, so the radio was decorative. Seeded per load, so a
			// manual pick made afterwards still wins for the rest of the session.
			parityUi.activeCustomShowId =
				resolveAuthoredCustomShowId(loader.presentationProperties, loader.customShows) ?? null;
			// Wave 4 #2: re-arm the read-only recommendation for the newly loaded
			// document, even if a previous one was unlocked via "Edit anyway".
			readOnlyRec.reset();
			// Wave 4 #3: clear the compat-toast dismissal state for the newly
			// loaded document; its own warnings feed in live off the loader.
			compatToasts.reset();
			// Wave 4 #5: seed the grid/snap/guides toggles from the deck's own
			// `ppt/viewProps.xml`, falling back to whatever this session already
			// has for anything the file did not author. `editor.viewProperties`
			// starts as the as-parsed part so a save that touches no toggle at all
			// still round-trips fields this binding has no UI for (last view,
			// splitter position, ...) instead of silently dropping them.
			const seeded = viewerPreferencesFromViewProperties(
				{ viewProperties: loader.viewProperties },
				{
					...parityUi.preferences,
					snapToObjects: parityUi.snapToShape,
					showGuides: parityUi.showGuides,
				},
			);
			parityUi.preferences = seeded;
			parityUi.snapToShape = seeded.snapToObjects ?? parityUi.snapToShape;
			parityUi.showGuides = seeded.showGuides ?? parityUi.showGuides;
			editor.viewProperties = loader.viewProperties;
			// Wave 4 #6 (B6): seed the colour pickers' "Recent colours" row from
			// the deck's own `p:clrMru`. Written back the same way as the view
			// preferences above: outside `pushHistory`/`commitChange`.
			editor.presentationMetadata.setMruColorsSilently(
				seedRecentColors({ mruColors: loader.presentationProperties.mruColors }),
			);
		},
	});

	// Wave 4 #5 write-back: fold the grid/snap/guides toggles into
	// `editor.viewProperties` on every change so a save round-trips them
	// (`viewPropertiesPatchFromPreferences`). Deliberately a plain `$effect`,
	// not routed through `pushHistory`/`commitChange`: PowerPoint does not undo
	// a view toggle, and `editor.viewProperties` already lives outside
	// `EditorSnapshot` for the same reason `theme` does.
	$effect(() => {
		const patch = viewPropertiesPatchFromPreferences({
			...parityUi.preferences,
			snapToObjects: parityUi.snapToShape,
			showGuides: parityUi.showGuides,
		});
		untrack(() => {
			editor.viewProperties = {
				...editor.viewProperties,
				...patch,
				slideViewPr: { ...editor.viewProperties?.slideViewPr, ...patch.slideViewPr },
			};
		});
	});

	return {
		parityUi,
		readOnlyRec,
		compatToasts,
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
