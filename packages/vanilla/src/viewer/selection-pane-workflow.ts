import type { PptxSlide } from 'pptx-viewer-core';

import type { EditorController } from './editor';
import type { Translator } from './i18n';
import type { Store, ViewerState } from './state';
import { openSelectionPane } from './ui/selection-pane';
import type { SelectionPaneHandle } from './ui/selection-pane';

/**
 * Opening and tearing down the Selection Pane.
 *
 * Its own module for the same two reasons as `outline-workflow`:
 * `parity-workflows` is at the repo's file-size ceiling, and this pane owns a
 * live store subscription that has to be released. The subscription is what
 * makes the pane track the deck: it used to be a snapshot taken when it opened,
 * so an undone rename left the new name on screen while the model had already
 * gone back.
 *
 * The host shape is declared structurally rather than importing
 * `ParityWorkflowHost`, which keeps the dependency one-way.
 */
export interface SelectionPaneWorkflowHost {
	doc: Document;
	t: Translator;
	store: Store<ViewerState>;
	editor: EditorController;
	root(): HTMLElement;
}

export interface SelectionPaneWorkflow {
	open(): void;
	/** Release the pane (and its store subscription). */
	close(): void;
}

/** Value equality for two selection-id lists. */
function sameIds(a: readonly string[], b: readonly string[]): boolean {
	return a.length === b.length && a.every((id, index) => id === b[index]);
}

export function createSelectionPaneWorkflow(
	host: SelectionPaneWorkflowHost,
): SelectionPaneWorkflow {
	let pane: SelectionPaneHandle | null = null;
	const close = (): void => {
		pane?.close();
		pane = null;
	};
	// Read the deck fresh on every use: the pane outlives any single state, so a
	// callback closing over the slide it opened with would act on a deck that has
	// since been edited, undone, or paged away from.
	const activeSlide = (): PptxSlide | undefined => {
		const current = host.store.get();
		return current.slides[current.currentSlide];
	};
	return {
		open() {
			close();
			pane = openSelectionPane(host.doc, host.root(), host.t, {
				elements: activeSlide()?.elements ?? [],
				selectedIds: host.store.get().selectedElementIds,
				subscribe: (listener) => {
					// Re-selecting the same row hands out a fresh array every time, so
					// forward only real changes; the pane would otherwise repaint on
					// every click of a double-click.
					let elements = activeSlide()?.elements ?? [];
					let selectedIds = host.store.get().selectedElementIds;
					return host.store.subscribe((next) => {
						const nextElements = next.slides[next.currentSlide]?.elements ?? [];
						const nextSelected = next.selectedElementIds;
						if (nextElements === elements && sameIds(nextSelected, selectedIds)) {
							return;
						}
						elements = nextElements;
						selectedIds = nextSelected;
						listener({ elements, selectedIds });
					});
				},
				onClose: () => {
					pane = null;
				},
				onSelect: (id) => host.editor.selectElements([id]),
				onToggleHidden: (id) =>
					host.editor.applyElementPatch(id, {
						hidden: !activeSlide()?.elements.find((element) => element.id === id)?.hidden,
					}),
				// The history-integrated patch path, so a rename is undoable and marks
				// the deck dirty like every other edit. An undefined name clears
				// cNvPr/@name.
				onRename: (id, name) => host.editor.applyElementPatch(id, { name }),
				onReorder: (from, to) => {
					const current = host.store.get();
					const slide = current.slides[current.currentSlide];
					if (!slide || from === to) {
						return;
					}
					const elements = [...slide.elements];
					const [moved] = elements.splice(from, 1);
					elements.splice(to, 0, moved);
					host.editor.commitSlides(
						current.slides.map((item, index) =>
							index === current.currentSlide ? { ...item, elements } : item,
						),
					);
				},
			});
		},
		close,
	};
}
