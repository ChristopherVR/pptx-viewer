import type { EditActions } from './editor/editor-edit-ops';
import type { FindReplaceActions } from './editor/editor-find-replace-actions';
import { createLazyActions } from './editor/editor-lazy-actions';
import type { ChromeOptions } from './ui';

/**
 * The subset of {@link PptxViewer} behaviour the chrome (ribbon + notes
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
	exportSlidePng(): Promise<void>;
	exportPdf(): Promise<void>;
	exportGif(): Promise<void>;
	exportVideo(): Promise<void>;
	print(): Promise<boolean>;
	/** Lazily resolve the editor's edit actions (editor is built after chrome). */
	getEditActions(): EditActions;
	/** Lazily resolve the editor's find/replace actions (same timing as edit actions). */
	getFindReplaceActions(): FindReplaceActions;
}

/**
 * Build the ribbon handler bundle + chrome callbacks wired to the viewer's
 * own methods. Extracted from `PptxViewer.mountChrome` (pure wiring, no state
 * of its own) to keep the orchestrator class focused on lifecycle/public API.
 */
export function buildChromeCallbacks(
	deps: ChromeCallbackDeps,
): Pick<
	ChromeOptions,
	'ribbonHandlers' | 'inspectorHandlers' | 'onSelectSlide' | 'onToggleNotes' | 'onCommitNotes'
> {
	const ribbonHandlers: ChromeOptions['ribbonHandlers'] = {
		nav: {
			prev: () => deps.prev(),
			next: () => deps.next(),
			zoomIn: () => deps.zoomIn(),
			zoomOut: () => deps.zoomOut(),
			zoomToFit: () => deps.zoomToFit(),
			togglePresentation: () => deps.togglePresentation(),
			toggleNotes: () => deps.toggleNotes(),
		},
		primary: {
			undo: () => deps.undo(),
			redo: () => deps.redo(),
			save: () => deps.save(),
		},
		file: {
			save: () => deps.save(),
			exportPng: () => void deps.exportSlidePng(),
			exportPdf: () => void deps.exportPdf(),
			exportGif: () => void deps.exportGif(),
			exportVideo: () => void deps.exportVideo(),
			print: () => void deps.print(),
		},
		// Every editing action delegates to the (lazily-resolved) editor edit
		// actions, so a click after mount always hits the live editor instance.
		edit: createLazyActions(() => deps.getEditActions()),
		insert: {
			insert: (kind, shapeType) => deps.getEditActions().insert(kind, shapeType),
			insertImage: () => deps.getEditActions().insertImage(),
		},
		findReplace: createLazyActions(() => deps.getFindReplaceActions()),
	};
	const inspectorHandlers: ChromeOptions['inspectorHandlers'] = {
		setGeometry: (patch) => deps.getEditActions().setGeometry(patch),
		setShapeFill: (color) => deps.getEditActions().setShapeFill(color),
		setShapeStroke: (color) => deps.getEditActions().setShapeStroke(color),
		setShapeStrokeWidth: (width) => deps.getEditActions().setShapeStrokeWidth(width),
	};
	return {
		ribbonHandlers,
		inspectorHandlers,
		onSelectSlide: (index) => deps.goToSlide(index),
		onToggleNotes: () => deps.toggleNotes(),
		onCommitNotes: (notes) => deps.commitNotes(notes),
	};
}
