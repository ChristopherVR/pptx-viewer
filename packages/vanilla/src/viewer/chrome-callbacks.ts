import type { TextSegment } from 'pptx-viewer-core';
import type { ViewerTheme } from 'pptx-viewer-shared';

import type { EditActions } from './editor/editor-edit-ops';
import type { FindReplaceActions } from './editor/editor-find-replace-actions';
import { createLazyActions } from './editor/editor-lazy-actions';
import type { DrawTool } from './state';
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
	toggleAutosave(): boolean;
	startPresentationFromBeginning(): void;
	startPresentationFromCurrent(): void;
	openBroadcast(): void;
	toggleNotes(): void;
	openAccessibility(): void;
	goToSlide(index: number): void;
	commitNotes(notes: string, notesSegments?: TextSegment[]): void;
	exportSlidePng(): Promise<void>;
	exportPdf(): Promise<void>;
	exportGif(): Promise<void>;
	exportVideo(): Promise<void>;
	print(): Promise<boolean>;
	/** Lazily resolve the editor's edit actions (editor is built after chrome). */
	getEditActions(): EditActions;
	/** Lazily resolve the editor's find/replace actions (same timing as edit actions). */
	getFindReplaceActions(): FindReplaceActions;
	/** Swap the viewer chrome's `ViewerTheme` (Design tab theme gallery). */
	setTheme(theme: ViewerTheme | undefined): void;
	/** Switch the Draw ribbon tab's active tool. */
	setDrawTool(tool: DrawTool): void;
	/** Set the pen/highlighter stroke colour (Draw tab). */
	setDrawColor(color: string): void;
	/** Set the pen/highlighter stroke width (Draw tab). */
	setDrawWidth(width: number): void;
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
			openAccessibility: () => deps.openAccessibility(),
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
		slideShow: {
			startFromBeginning: () => deps.startPresentationFromBeginning(),
			startFromCurrent: () => deps.startPresentationFromCurrent(),
			openBroadcast: () => deps.openBroadcast(),
		},
		// Every editing action delegates to the (lazily-resolved) editor edit
		// actions, so a click after mount always hits the live editor instance.
		edit: createLazyActions(() => deps.getEditActions()),
		insert: {
			insert: (kind, shapeType) => deps.getEditActions().insert(kind, shapeType),
			insertImage: () => deps.getEditActions().insertImage(),
			insertMedia: () => deps.getEditActions().insertMedia(),
			insertChart: (chartType) => deps.getEditActions().insertChart(chartType),
			insertSmartArt: (layout, defaultItems) =>
				deps.getEditActions().insertSmartArt(layout, defaultItems),
			insertEquation: (omml) => deps.getEditActions().insertEquation(omml),
			insertActionButton: (shapeType) => deps.getEditActions().insertActionButton(shapeType),
			insertField: (fieldType, value) => deps.getEditActions().insertField(fieldType, value),
		},
		findReplace: createLazyActions(() => deps.getFindReplaceActions()),
		design: {
			setTheme: (theme) => deps.setTheme(theme),
		},
		draw: {
			setTool: (tool) => deps.setDrawTool(tool),
			setColor: (color) => deps.setDrawColor(color),
			setWidth: (width) => deps.setDrawWidth(width),
		},
	};
	const inspectorHandlers: ChromeOptions['inspectorHandlers'] = {
		setGeometry: (patch) => deps.getEditActions().setGeometry(patch),
		setShapeFill: (color) => deps.getEditActions().setShapeFill(color),
		setShapeStroke: (color) => deps.getEditActions().setShapeStroke(color),
		setShapeStrokeWidth: (width) => deps.getEditActions().setShapeStrokeWidth(width),

		setTextVerticalAlign: (vAlign) => deps.getEditActions().setTextVerticalAlign(vAlign),
		setTextWrap: (wrap) => deps.getEditActions().setTextWrap(wrap),
		setAutoFitMode: (mode) => deps.getEditActions().setAutoFitMode(mode),

		setFillOpacity: (opacity) => deps.getEditActions().setFillOpacity(opacity),
		setStrokeOpacity: (opacity) => deps.getEditActions().setStrokeOpacity(opacity),
		setGradientFill: (state) => deps.getEditActions().setGradientFill(state),
		addGradientStop: (color, position) => deps.getEditActions().addGradientStop(color, position),
		removeGradientStop: (index) => deps.getEditActions().removeGradientStop(index),
		updateGradientStop: (index, changes) =>
			deps.getEditActions().updateGradientStop(index, changes),

		setImageBrightness: (value) => deps.getEditActions().setImageBrightness(value),
		setImageContrast: (value) => deps.getEditActions().setImageContrast(value),
		setImageSaturation: (value) => deps.getEditActions().setImageSaturation(value),
		setImageCrop: (edge, value) => deps.getEditActions().setImageCrop(edge, value),

		setTableHeaderRow: (enabled) => deps.getEditActions().setTableHeaderRow(enabled),
		setTableBandedRows: (enabled) => deps.getEditActions().setTableBandedRows(enabled),
		setTableCellPadding: (padding) => deps.getEditActions().setTableCellPadding(padding),
	};
	return {
		ribbonHandlers,
		inspectorHandlers,
		onSelectSlide: (index) => deps.goToSlide(index),
		onToggleNotes: () => deps.toggleNotes(),
		onCommitNotes: (notes, notesSegments) => deps.commitNotes(notes, notesSegments),
	};
}
