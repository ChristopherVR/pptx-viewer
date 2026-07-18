import type { PptxSaveFormat, TextSegment } from 'pptx-viewer-core';
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
	/** Return to the normal editing view (exit presentation + close slide sorter). */
	returnToNormalView(): void;
	undo(): void;
	redo(): void;
	save(): void;
	downloadAs(format: PptxSaveFormat): Promise<void>;
	packageForSharing(): Promise<void>;
	toggleAutosave(): boolean;
	startPresentationFromBeginning(): void;
	startPresentationFromCurrent(): void;
	openPresenterView(): void;
	openBroadcast(): void;
	openShare(): void;
	toggleNotes(): void;
	openAccessibility(): void;
	openSettings(tab?: 'general' | 'shortcuts'): void;
	openHeaderFooter(): void;
	openCompare(): void;
	openSetUpSlideShow(): void;
	startRehearsal(): void;
	toggleSubtitles(): void;
	openSelectionPane(): void;
	openSlideSorter(): void;
	openComments(): void;
	openHyperlink(): void;
	openCustomShows(): void;
	openDocumentProperties(): void;
	openFontEmbedding(): void;
	openDigitalSignatures(): void;
	openPasswordProtection(): void;
	openVersionHistory(): void;
	toggleTemplateEditing(): void;
	toggleMasterNavigation(): void;
	/** Show/hide the right-hand property inspector panel. */
	toggleInspector(): void;
	/** Select a single element by id (inspector Elements tab). */
	selectElement(id: string): void;
	goToSlide(index: number): void;
	commitNotes(notes: string, notesSegments?: TextSegment[]): void;
	exportSlidePng(): Promise<void>;
	copySlideAsImage(): Promise<void>;
	exportPdf(): Promise<void>;
	exportGif(): Promise<void>;
	exportVideo(): Promise<void>;
	print(): Promise<boolean>;
	openFile(): void;
	openRecentFile(key: string): void;
	createPresentation(templateId: string): void;
	/** Lazily resolve the editor's edit actions (editor is built after chrome). */
	getEditActions(): EditActions;
	/** Lazily resolve the editor's find/replace actions (same timing as edit actions). */
	getFindReplaceActions(): FindReplaceActions;
	/** Swap the viewer chrome's `ViewerTheme` (Design tab theme gallery). */
	setTheme(theme: ViewerTheme | undefined): void;
	applyPresentationTheme(presetId: string): void;
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
			normalView: () => deps.returnToNormalView(),
			toggleNotes: () => deps.toggleNotes(),
			openAccessibility: () => deps.openAccessibility(),
			openSettings: (tab) => deps.openSettings(tab),
			openHeaderFooter: () => deps.openHeaderFooter(),
			openCompare: () => deps.openCompare(),
			openSelectionPane: () => deps.openSelectionPane(),
			openSlideSorter: () => deps.openSlideSorter(),
			openComments: () => deps.openComments(),
			openHyperlink: () => deps.openHyperlink(),
			toggleTemplateEditing: () => deps.toggleTemplateEditing(),
			toggleMasterView: () => deps.toggleMasterNavigation(),
			toggleInspector: () => deps.toggleInspector(),
			toggleViewOption: (option) => deps.getEditActions().toggleViewOption(option),
			addGuide: (axis) => deps.getEditActions().addGuide(axis),
			activateEyedropper: () => deps.getEditActions().activateEyedropper(),
			toggleSpellCheck: () => deps.getEditActions().toggleSpellCheck(),
		},
		primary: {
			undo: () => deps.undo(),
			redo: () => deps.redo(),
			save: () => deps.save(),
		},
		file: {
			openFile: () => deps.openFile(),
			openRecentFile: (key) => deps.openRecentFile(key),
			createPresentation: (templateId) => deps.createPresentation(templateId),
			openSettings: () => deps.openSettings('general'),
			openShare: () => deps.openShare(),
			openDocumentProperties: () => deps.openDocumentProperties(),
			openFontEmbedding: () => deps.openFontEmbedding(),
			openDigitalSignatures: () => deps.openDigitalSignatures(),
			openPasswordProtection: () => deps.openPasswordProtection(),
			openVersionHistory: () => deps.openVersionHistory(),
			save: () => deps.save(),
			saveAsPpsx: () => void deps.downloadAs('ppsx'),
			saveAsPptm: () => void deps.downloadAs('pptm'),
			packageForSharing: () => void deps.packageForSharing(),
			exportPng: () => void deps.exportSlidePng(),
			copySlideAsImage: () => void deps.copySlideAsImage(),
			exportPdf: () => void deps.exportPdf(),
			exportGif: () => void deps.exportGif(),
			exportVideo: () => void deps.exportVideo(),
			print: () => void deps.print(),
		},
		slideShow: {
			startFromBeginning: () => deps.startPresentationFromBeginning(),
			startFromCurrent: () => deps.startPresentationFromCurrent(),
			openPresenterView: () => deps.openPresenterView(),
			openBroadcast: () => deps.openBroadcast(),
			openSetUp: () => deps.openSetUpSlideShow(),
			startRehearsal: () => deps.startRehearsal(),
			openCustomShows: () => deps.openCustomShows(),
			toggleSubtitles: () => deps.toggleSubtitles(),
			openSubtitleSettings: () => deps.openSetUpSlideShow(),
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
			applyPresentationTheme: (presetId) => deps.applyPresentationTheme(presetId),
		},
		draw: {
			setTool: (tool) => deps.setDrawTool(tool),
			setColor: (color) => deps.setDrawColor(color),
			setWidth: (width) => deps.setDrawWidth(width),
		},
	};
	const inspectorHandlers: ChromeOptions['inspectorHandlers'] = {
		selectElement: (id) => deps.selectElement(id),
		openDocumentProperties: () => deps.openDocumentProperties(),
		updatePresentationSettings: (patch) => deps.getEditActions().updatePresentationSettings(patch),
		applyThemeByPath: (themePath, allMasters) =>
			deps.getEditActions().applyThemeByPath(themePath, allMasters),
		updateActiveSlide: (patch) => deps.getEditActions().updateActiveSlide(patch),
		updateCanvasSize: (size) => deps.getEditActions().updateCanvasSize(size),
		addComment: (text) => void deps.getEditActions().comments.addComment(text),
		addCommentReply: (parentId, text) =>
			void deps.getEditActions().comments.addCommentReply(parentId, text),
		editComment: (id, text) => deps.getEditActions().comments.editComment(id, text),
		deleteComment: (id) => deps.getEditActions().comments.deleteComment(id),
		toggleCommentResolved: (id) => deps.getEditActions().comments.toggleCommentResolved(id),
		setAnimationEffect: (group, preset) => deps.getEditActions().setAnimationEffect(group, preset),
		setAnimationTiming: (elementId, patch) =>
			deps.getEditActions().setAnimationTiming(elementId, patch),
		reorderAnimation: (elementId, direction) =>
			deps.getEditActions().reorderAnimation(elementId, direction),
		setGeometry: (patch) => deps.getEditActions().setGeometry(patch),
		setShapeFill: (color) => deps.getEditActions().setShapeFill(color),
		setShapeStroke: (color) => deps.getEditActions().setShapeStroke(color),
		setShapeStrokeWidth: (width) => deps.getEditActions().setShapeStrokeWidth(width),
		setShapeStyle: (patch) => deps.getEditActions().setShapeStyle(patch),
		setShapeType: (shapeType) => deps.getEditActions().setShapeType(shapeType),

		setTextVerticalAlign: (vAlign) => deps.getEditActions().setTextVerticalAlign(vAlign),
		setTextWrap: (wrap) => deps.getEditActions().setTextWrap(wrap),
		setAutoFitMode: (mode) => deps.getEditActions().setAutoFitMode(mode),
		setTextAdvanced: (patch) => deps.getEditActions().setTextAdvanced(patch),
		setTextStyle: (patch, selection) => deps.getEditActions().setTextStyle(patch, selection),

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
		setImageEffects: (patch) => deps.getEditActions().setImageEffects(patch),
		replaceImage: () => void deps.getEditActions().replaceSelectedImage(),
		resetImage: () => deps.getEditActions().resetSelectedImage(),
		setElementAction: (trigger, action) => deps.getEditActions().setElementAction(trigger, action),
		setChartData: (data) => deps.getEditActions().setChartData(data),
		setMediaProperties: (patch) => deps.getEditActions().setMediaProperties(patch),

		setTableHeaderRow: (enabled) => deps.getEditActions().setTableHeaderRow(enabled),
		setTableBandedRows: (enabled) => deps.getEditActions().setTableBandedRows(enabled),
		setTableCellPadding: (padding) => deps.getEditActions().setTableCellPadding(padding),
		setTableOptions: (patch, cellStyle) => deps.getEditActions().setTableOptions(patch, cellStyle),
		setTableCellStyle: (row, column, patch) =>
			deps.getEditActions().setTableCellStyle(row, column, patch),
		setTableCellStyles: (cells, patch) => deps.getEditActions().setTableCellStyles(cells, patch),
		mutateTableStructure: (cell, action) =>
			deps.getEditActions().mutateTableStructure(cell, action),
		setTableColumnWidth: (column, percent) =>
			deps.getEditActions().setTableColumnWidth(column, percent),
		setTableRowHeight: (row, height) => deps.getEditActions().setTableRowHeight(row, height),
		mergeTableCells: (cells) => deps.getEditActions().mergeTableCells(cells),
		splitTableCell: (cell) => deps.getEditActions().splitTableCell(cell),

		setSmartArtNodeText: (nodeId, text) => deps.getEditActions().setSmartArtNodeText(nodeId, text),
		setSmartArtNodeStyle: (nodeId, patch) =>
			deps.getEditActions().setSmartArtNodeStyle(nodeId, patch),
		mutateSmartArtNode: (nodeId, action) =>
			deps.getEditActions().mutateSmartArtNode(nodeId, action),
		setSmartArtLayout: (layout) => deps.getEditActions().setSmartArtLayout(layout),
		setSmartArtColorScheme: (scheme) => deps.getEditActions().setSmartArtColorScheme(scheme),
	};
	return {
		ribbonHandlers,
		inspectorHandlers,
		onSelectSlide: (index) => deps.goToSlide(index),
		onToggleNotes: () => deps.toggleNotes(),
		onCommitNotes: (notes, notesSegments) => deps.commitNotes(notes, notesSegments),
	};
}
