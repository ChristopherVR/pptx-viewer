import type { CollaborationController } from '../collab';
import { EditorController } from '../editor/editor-controller.svelte';
import { FindReplaceState } from '../editor/editor-find-replace.svelte';
import type { EditorState } from '../editor/editor-state.svelte';
import { ChromeUiState } from './chrome-ui.svelte';
import type { CreateViewerStateOptions } from './create-viewer-state-types';
import type { PresentationLoader } from './presentation-loader.svelte';
import { useViewerEffects } from './viewer-effects.svelte';
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
}

export interface EditorUiCluster {
	parityUi: ViewerParityUiState;
	chromeUi: ChromeUiState;
	controller: EditorController;
	findReplace: FindReplaceState;
	stageContextMenu: { x: number; y: number } | null;
}

/**
 * The editing chrome cluster: view/print/annotation preferences
 * (`ViewerParityUiState`), side-panel open state (`ChromeUiState`), the
 * pointer/keyboard/history controller (`EditorController`), the ribbon's
 * Find & Replace panel state, and the load-pipeline wiring
 * (`useViewerEffects`, which needs `controller` to close open selections/
 * inline edits when `editable` flips off). Split out of `createViewerState`
 * to keep that file under the repo's file-size budget; built after the
 * collaboration cluster because `controller` reports cursor moves to
 * `collab.setCursor`. Named `use*`, not `build*`, because of the
 * `useViewerEffects` call.
 */
export function useEditorUiCluster(deps: EditorUiClusterDeps): EditorUiCluster {
	const { loader, editor, viewer, collab, options } = deps;

	const parityUi = new ViewerParityUiState(editor);
	const chromeUi = new ChromeUiState();
	provideZoomNavigation({
		navigateToZoomTarget: (index) => viewer.goTo(index),
		getSlides: () => editor.renderedSlides,
	});

	let stageContextMenu = $state<{ x: number; y: number } | null>(null);
	const controller = new EditorController(editor, {
		getScale: () => (editor.masterViewTarget ? options.getMasterScale() : deps.getScale()),
		getCurrent: () => viewer.current,
		getPresenting: () => viewer.isFullscreen,
		getStageRoot: () => options.getStageHolderEl()?.querySelector('.pptx-svelte-stage') ?? null,
		getHolderEl: () => options.getStageHolderEl() ?? null,
		onCursorMove: (x, y) => collab.setCursor(x, y, viewer.current),
		onContextMenu: (x, y) => {
			stageContextMenu = { x, y };
		},
		getSnapToGrid: () => parityUi.preferences.snapToGrid,
		getSnapToShape: () => parityUi.snapToShape,
		getGuides: () => parityUi.guides,
	});

	const findReplace = new FindReplaceState({
		getSlides: () => editor.slides,
		commitSlides: (next) => editor.commitSlides(next),
		onNavigate: (slideIndex, elementId) => {
			viewer.goTo(slideIndex);
			editor.select(elementId);
		},
	});

	useViewerEffects({
		getSource: options.getSource,
		getEditable: () => options.getEditable() && !collab.readOnly,
		getInitialSlide: options.getInitialSlide,
		getTranslator: () => options.t,
		loader,
		viewer,
		editor,
		controller,
		getOnload: () => options.onload,
		getOnerror: () => options.onerror,
		getOnslidechange: () => options.onslidechange,
	});

	return {
		parityUi,
		chromeUi,
		controller,
		findReplace,
		get stageContextMenu() {
			return stageContextMenu;
		},
		set stageContextMenu(next: { x: number; y: number } | null) {
			stageContextMenu = next;
		},
	};
}
