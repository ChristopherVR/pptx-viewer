import type { EditorController } from './editor';
import type { Translator } from './i18n';
import type { Store, ViewerState } from './state';
import type { OutlineViewHandle } from './ui/outline-view';
import { openOutlineViewOverlay } from './ui/outline-view';

/**
 * Opening and tearing down Outline view.
 *
 * Its own module rather than another arm of `parity-workflows`: that file is
 * already at the repo's file-size ceiling, and this workflow owns something the
 * others do not, a live store subscription that has to be released on teardown.
 *
 * The host shape is declared structurally instead of importing
 * `ParityWorkflowHost`, which keeps the dependency one-way (parity-workflows
 * uses this module, never the reverse).
 */
export interface OutlineWorkflowHost {
	doc: Document;
	t: Translator;
	store: Store<ViewerState>;
	editor: EditorController;
	root(): HTMLElement;
}

export interface OutlineWorkflow {
	open(): void;
	/** Release the pane (and its store subscription) on viewer teardown. */
	close(): void;
}

export function createOutlineWorkflow(host: OutlineWorkflowHost): OutlineWorkflow {
	let pane: OutlineViewHandle | null = null;
	const close = (): void => {
		pane?.close();
		pane = null;
	};
	return {
		open() {
			close();
			const current = host.store.get();
			pane = openOutlineViewOverlay(host.doc, host.root(), host.t, {
				slides: current.slides,
				canvasSize: current.canvasSize,
				canEdit: current.editable,
				subscribe: (listener) => host.store.subscribe((next) => listener(next.slides)),
				// The viewer's own whole-deck commit, so an outline edit undoes and
				// redoes through the same history as a slide reorder or delete.
				commit: (slides, activeSlideIndex) => host.editor.commitSlides(slides, activeSlideIndex),
				onClose: () => {
					pane = null;
				},
			});
		},
		close,
	};
}
