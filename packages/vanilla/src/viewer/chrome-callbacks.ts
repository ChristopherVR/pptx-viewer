import type { EditActions } from './editor';
import type {
	ChromeOptions,
	FormatToolbarHandlers,
	InspectorHandlers,
	ToolbarHandlers,
} from './ui';

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
	/** Lazily resolve the editor's edit actions (editor is built after chrome). */
	getEditActions(): EditActions;
}

/**
 * Build the toolbar handlers + chrome callbacks wired to the viewer's own
 * methods. Extracted from `PptxViewer.mountChrome` (pure wiring, no state of
 * its own) to keep the orchestrator class focused on lifecycle/public API.
 */
export function buildChromeCallbacks(
	deps: ChromeCallbackDeps,
): Pick<
	ChromeOptions,
	| 'toolbarHandlers'
	| 'formatHandlers'
	| 'inspectorHandlers'
	| 'onSelectSlide'
	| 'onToggleNotes'
	| 'onCommitNotes'
> {
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
	// Every editing action delegates to the (lazily-resolved) editor edit
	// actions, so a click after mount always hits the live editor instance.
	const formatHandlers: FormatToolbarHandlers = {
		toggleBold: () => deps.getEditActions().toggleBold(),
		toggleItalic: () => deps.getEditActions().toggleItalic(),
		toggleUnderline: () => deps.getEditActions().toggleUnderline(),
		changeFontSize: (delta) => deps.getEditActions().changeFontSize(delta),
		setFontSize: (size) => deps.getEditActions().setFontSize(size),
		setTextColor: (color) => deps.getEditActions().setTextColor(color),
		setHighlightColor: (color) => deps.getEditActions().setHighlightColor(color),
		setShapeFill: (color) => deps.getEditActions().setShapeFill(color),
		setShapeStroke: (color) => deps.getEditActions().setShapeStroke(color),
		bringForward: () => deps.getEditActions().bringForward(),
		sendBackward: () => deps.getEditActions().sendBackward(),
		bringToFront: () => deps.getEditActions().bringToFront(),
		sendToBack: () => deps.getEditActions().sendToBack(),
		insert: (kind) => deps.getEditActions().insert(kind),
		insertImage: () => void deps.getEditActions().insertImage(),
	};
	const inspectorHandlers: InspectorHandlers = {
		setGeometry: (patch) => deps.getEditActions().setGeometry(patch),
		setShapeFill: (color) => deps.getEditActions().setShapeFill(color),
		setShapeStroke: (color) => deps.getEditActions().setShapeStroke(color),
		setShapeStrokeWidth: (width) => deps.getEditActions().setShapeStrokeWidth(width),
	};
	return {
		toolbarHandlers,
		formatHandlers,
		inspectorHandlers,
		onSelectSlide: (index) => deps.goToSlide(index),
		onToggleNotes: () => deps.toggleNotes(),
		onCommitNotes: (notes) => deps.commitNotes(notes),
	};
}
