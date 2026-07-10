import type { ChromeOptions, ToolbarHandlers } from './ui';

/**
 * The subset of {@link PptxViewer} behaviour the chrome (toolbar + notes
 * panel) needs to call back into. Kept as a narrow interface (not the whole
 * class) so this module has no circular dependency on `PptxViewer`.
 */
export interface ChromeCallbackDeps {
	prev(): void;
	next(): void;
	zoomIn(): void;
	zoomOut(): void;
	zoomToFit(): void;
	togglePresentation(): void;
	undo(): void;
	redo(): void;
	save(): void;
	toggleNotes(): void;
	goToSlide(index: number): void;
	commitNotes(notes: string): void;
}

/**
 * Build the toolbar handlers + chrome callbacks wired to the viewer's own
 * methods. Extracted from `PptxViewer.mountChrome` (pure wiring, no state of
 * its own) to keep the orchestrator class focused on lifecycle/public API.
 */
export function buildChromeCallbacks(
	deps: ChromeCallbackDeps,
): Pick<ChromeOptions, 'toolbarHandlers' | 'onSelectSlide' | 'onToggleNotes' | 'onCommitNotes'> {
	const toolbarHandlers: ToolbarHandlers = {
		prev: () => deps.prev(),
		next: () => deps.next(),
		zoomIn: () => deps.zoomIn(),
		zoomOut: () => deps.zoomOut(),
		zoomToFit: () => deps.zoomToFit(),
		togglePresentation: () => deps.togglePresentation(),
		undo: () => deps.undo(),
		redo: () => deps.redo(),
		save: () => deps.save(),
		toggleNotes: () => deps.toggleNotes(),
	};
	return {
		toolbarHandlers,
		onSelectSlide: (index) => deps.goToSlide(index),
		onToggleNotes: () => deps.toggleNotes(),
		onCommitNotes: (notes) => deps.commitNotes(notes),
	};
}
