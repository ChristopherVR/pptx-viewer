import type {
	PptxAnimationPreset,
	PptxImageEffects,
	PptxChartData,
	MediaPptxElement,
	PptxComment,
	PptxElement,
	PptxPresentationProperties,
	PptxSlide,
	PptxSlideMaster,
	PptxSmartArtData,
	PptxSmartArtNodeStyle,
	PptxTableCellStyle,
	PptxTableData,
	XmlObject,
	PptxTagCollection,
	TablePptxElement,
	PptxThemeColorScheme,
	PptxThemeFontScheme,
	PptxThemeOption,
	ElementAction,
	OleObjectType,
	SmartArtColorScheme,
	SmartArtLayoutType,
	TextStyle,
	ShapeStyle,
} from 'pptx-viewer-core';
import type {
	AnimationGroup,
	GradientState,
	InlineTextSelection,
	SlideSizeEmu,
	TextAdvancedChanges,
} from 'pptx-viewer-shared';

import type { AnimationTimingPatch } from '../../editor/editor-animation-actions';
import type { GeometryPatch } from '../../editor/editor-edit-ops';
import type { TableCellPosition, TableStructureAction } from '../../editor/table-editor-mutations';

/**
 * The inspector edit actions: universal geometry + flat fill/stroke, plus the
 * element-type-aware sections (text anchor/wrap/autofit, gradient fill +
 * opacity, image adjustments/crop, table-level flags + padding).
 */
export interface InspectorHandlers {
	/** Select an element from the Elements (layer-order) tab. */
	selectElement(id: string): void;
	/** Open the full Document Properties dialog from the Properties tab. */
	openDocumentProperties(): void;
	/**
	 * File > Options > Advanced > "Properties follow chart data point for
	 * current workbook", read fresh on every chart category removal.
	 */
	getChartFollowDataPoint(): boolean;
	/** Merge a patch into the presentation show/print settings (PRESENTATION card). */
	updatePresentationSettings(patch: Partial<PptxPresentationProperties>): void;
	/** Apply a packaged theme part by archive path (THEME card). */
	applyThemeByPath(themePath: string, allMasters: boolean): void;
	/** Re-theme the deck from the THEME EDITOR card's staged colours/fonts/name. */
	applyThemeEdit(payload: {
		colorScheme: PptxThemeColorScheme;
		fontScheme: PptxThemeFontScheme;
		name: string;
	}): void;
	/** Replace the deck's `ppt/tags/*.xml` collections (TAGS card). */
	updateTagCollections(next: PptxTagCollection[]): void;
	/** Patch the active slide (THEME OVERRIDE card). */
	updateActiveSlide(patch: Partial<PptxSlide>): void;
	/**
	 * Set a layout/master's background colour (SLIDE BACKGROUND card's
	 * template rows, shown while `editTemplateMode` is on). Master Views
	 * covers the same ground but requires leaving the slide.
	 */
	setTemplateBackground(path: string, backgroundColor: string): void;
	/** Read a layout/master's current background colour. */
	getTemplateBackgroundColor(path: string): string | undefined;
	/** Resize the slide canvas (the SLIDE SIZE card's raw W/H inputs). */
	updateCanvasSize(size: { width: number; height: number }): void;
	/**
	 * Adopt an EMU slide size (SLIDE SIZE preset dropdown / orientation toggle).
	 * Writes both the EMU state and the pixel canvas.
	 */
	updateSlideSize(size: SlideSizeEmu): void;
	/** Add a comment on the current slide (Comments tab). */
	addComment(text: string): void;
	/** Append a reply under a top-level comment (Comments tab reply form). */
	addCommentReply(parentId: string, text: string): void;
	/** Replace a comment's (or reply's) text (Comments tab edit-in-place). */
	editComment(id: string, text: string): void;
	deleteComment(id: string): void;
	toggleCommentResolved(id: string): void;

	/** Set/clear one effect bucket on the selected element (docked Animation panel). */
	setAnimationEffect(group: AnimationGroup, preset: PptxAnimationPreset | 'none'): void;
	/** Apply/clear a catalogue motion path by preset id (`'none'` clears it). */
	applyMotionPath(presetId: string): void;
	/** Patch timing/effect options on one element's animation entry. */
	setAnimationTiming(elementId: string, patch: AnimationTimingPatch): void;
	/** Stage a picked effect sound file, or clear it entirely (`undefined`). */
	setAnimationSound(
		elementId: string,
		pick: { dataUrl: string; fileName?: string } | undefined,
	): void;
	/** Move an element's animation one step in the slide play order. */
	reorderAnimation(elementId: string, direction: 'up' | 'down'): void;

	setGeometry(patch: GeometryPatch): void;
	/** Flip the selected element's lock (see elementLockTogglePatch). */
	toggleElementLock(): void;
	setShapeFill(color: string): void;
	setShapeStroke(color: string): void;
	setShapeStrokeWidth(width: number): void;
	setShapeStyle(patch: Partial<ShapeStyle>): void;
	setShapeType(shapeType: string): void;

	setTextVerticalAlign(vAlign: InspectorState['vAlign']): void;
	setTextWrap(wrap: InspectorState['textWrap']): void;
	setAutoFitMode(mode: InspectorState['autoFitMode']): void;
	setTextAdvanced(patch: TextAdvancedChanges): void;
	setTextStyle(patch: Partial<TextStyle>, selection?: InlineTextSelection | null): void;

	setFillOpacity(opacity: number): void;
	setStrokeOpacity(opacity: number): void;
	setGradientFill(state: GradientState): void;
	addGradientStop(color: string, position: number): void;
	removeGradientStop(index: number): void;
	updateGradientStop(index: number, changes: Partial<GradientState['stops'][number]>): void;

	setImageBrightness(value: number): void;
	setImageContrast(value: number): void;
	setImageSaturation(value: number): void;
	setImageCrop(edge: 'left' | 'top' | 'right' | 'bottom', value: number): void;
	setImageEffects(patch: Partial<PptxImageEffects>): void;
	replaceImage(): void;
	resetImage(): void;
	setElementAction(trigger: 'click' | 'hover', action: ElementAction): void;
	/** Set the selected element's accessibility description (Alt Text field). */
	setAltText(text: string): void;
	/**
	 * Set the selected OLE element's Object Name (`p:oleObj/@name`, ECMA-376
	 * SS13.3.4). A browser cannot run the native application an embedded OLE
	 * object belongs to, so the object stays read-only; this name already
	 * parses, saves, and syncs via collaboration and only lacked an editing
	 * surface.
	 */
	setOleName(name: string): void;
	setChartData(data: PptxChartData): void;
	setMediaProperties(patch: Partial<MediaPptxElement>): void;

	setTableHeaderRow(enabled: boolean): void;
	setTableBandedRows(enabled: boolean): void;
	setTableCellPadding(padding: number): void;
	setTableOptions(patch: Partial<PptxTableData>, cellStyle?: Partial<PptxTableCellStyle>): void;
	/**
	 * Replace the selected table's whole `tableData` (inspector data grid).
	 *
	 * `setTableOptions` cannot serve here: it re-applies the element's existing
	 * rows after the patch, so a row/cell change made through it is discarded.
	 */
	/**
	 * Replace the selected table's whole `tableData`, plus the graphic-frame
	 * `rawXml` the renderer and save writer actually read for a table parsed from
	 * a real deck (a `tableData`-only patch is invisible on such tables).
	 */
	setTableData(data: PptxTableData, rawXml?: XmlObject): void;
	setTableCellStyle(row: number, column: number, patch: Partial<PptxTableCellStyle>): void;
	setTableCellStyles(cells: TableCellPosition[], patch: Partial<PptxTableCellStyle>): void;
	mutateTableStructure(cell: TableCellPosition, action: TableStructureAction): void;
	setTableColumnWidth(column: number, percent: number): void;
	setTableRowHeight(row: number, height: number): void;
	mergeTableCells(cells: TableCellPosition[]): void;
	splitTableCell(cell: TableCellPosition): void;

	setSmartArtNodeText(nodeId: string, text: string): void;
	setSmartArtNodeStyle(nodeId: string, patch: Partial<PptxSmartArtNodeStyle>): void;
	mutateSmartArtNode(
		nodeId: string,
		action: 'add' | 'addChild' | 'remove' | 'promote' | 'demote',
	): void;
	/**
	 * Commit a whole replacement `smartArtData`, reflowed and history-integrated
	 * like every other SmartArt mutation. Used by the text pane's Tab / Enter /
	 * Backspace keyboard handling, which computes the next data (and, for
	 * add/remove, the node to focus next) via the shared `smartart-node-pane-
	 * handlers` builders before committing.
	 */
	replaceSmartArtData(data: PptxSmartArtData): void;
	setSmartArtLayout(layout: SmartArtLayoutType): void;
	setSmartArtColorScheme(scheme: SmartArtColorScheme): void;
}

/** Selection-derived state the inspector reflects, computed by `buildInspectorState`. */
export interface InspectorState {
	hasSelection: boolean;
	isLocked: boolean;
	canShape: boolean;
	canText: boolean;
	isImage: boolean;
	isChart: boolean;
	isMedia: boolean;
	isTable: boolean;
	isSmartArt: boolean;
	smartArtData: PptxSmartArtData | undefined;
	isGroup: boolean;
	/** Number of children on a selected group, or undefined when not (yet) known. */
	groupChildCount: number | undefined;
	isOle: boolean;
	oleObjectType: OleObjectType | undefined;
	oleFileName: string | undefined;
	oleIsLinked: boolean;
	/** The OLE object's author-assigned name (`p:oleObj/@name`), if any. */
	oleName: string | undefined;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	fillColor: string | undefined;
	strokeColor: string | undefined;
	strokeWidth: number;
	shapeStyle: ShapeStyle | undefined;
	shapeType: string | undefined;
	isConnector: boolean;
	fillOpacity: number;
	strokeOpacity: number;
	gradientEnabled: boolean;
	gradient: GradientState;
	vAlign: 'top' | 'middle' | 'bottom';
	textWrap: 'square' | 'none';
	autoFitMode: 'shrink' | 'normal' | 'none';
	characterSpacing: number;
	lineSpacing: number;
	lineSpacingExactPt: number | null;
	paragraphSpacingBefore: number;
	paragraphSpacingAfter: number;
	paragraphIndent: number;
	paragraphMarginLeft: number;
	textDirection:
		| 'horizontal'
		| 'vertical'
		| 'vertical270'
		| 'eaVert'
		| 'wordArtVert'
		| 'wordArtVertRtl'
		| 'mongolianVert';
	textRtl: boolean;
	textStyle: TextStyle | undefined;
	selectedTextRange: InlineTextSelection | null;
	imageBrightness: number;
	imageContrast: number;
	imageSaturation: number;
	imageArtisticEffect: string;
	imageTransparency: number;
	imageBiLevel: number;
	imageDuotone1: string;
	imageDuotone2: string;
	imageColorWash?: { color: string; opacity: number };
	actionClick?: ElementAction;
	actionHover?: ElementAction;
	/** The selected element's alt text (accessibility description), if any. */
	altText: string;
	chartData?: PptxChartData;
	/**
	 * The on-canvas chart part selection, scoped to the selected chart element:
	 * a `pointIndex` ring-highlights one value cell in the data grid and syncs
	 * the "Data Point Index" picker; series-only (no `pointIndex`) highlights
	 * the series name header. `null` when nothing is selected on canvas, or the
	 * selection belongs to a different chart.
	 */
	chartHighlightCell: { seriesIndex: number; pointIndex?: number } | null;
	media?: MediaPptxElement;
	mediaPreviewUrl?: string;
	mediaPosterUrl?: string;
	cropLeft: number;
	cropTop: number;
	cropRight: number;
	cropBottom: number;
	tableHeaderRow: boolean;
	tableBandedRows: boolean;
	tableBandedColumns: boolean;
	tableLastRow: boolean;
	tableFirstCol: boolean;
	tableLastCol: boolean;
	tableRtl: boolean;
	tableStyleId: string;
	tableCellBackground: string;
	tableCellBorder: string;
	tableCellPadding: number;
	selectedTableCell: { row: number; column: number } | null;
	selectedTableCells: Array<{ row: number; column: number }>;
	tableCellStyle: PptxTableCellStyle | undefined;
	tableColumnWidths: number[];
	tableRowHeights: number[];
	/** The selected table element itself, feeding the inspector data grid. */
	tableElement?: TablePptxElement;
}

/**
 * Deck/slide-level state for the inspector's Elements and Comments tabs plus
 * the no-selection Properties sections (React's `InspectorPane` default view).
 */
export interface InspectorDeckState {
	slideCount: number;
	currentSlide: number;
	canvasSize: { width: number; height: number };
	/** The deck's `p:sldSz` in EMU, which is what a save persists. */
	slideSize: SlideSizeEmu | undefined;
	elements: readonly PptxElement[];
	selectedIds: readonly string[];
	/** Primary selected element id (docked Animation panel target), if any. */
	selectedElementId?: string;
	comments: readonly PptxComment[];
	docTitle: string | undefined;
	docAuthor: string | undefined;
	editable: boolean;
	/** Presentation show/print settings (PRESENTATION card controls). */
	presentationProperties: PptxPresentationProperties;
	/** Theme parts discovered in the package (THEME card dropdown). */
	themeOptions: readonly PptxThemeOption[];
	/** The visible slide (THEME OVERRIDE card), or undefined on an empty deck. */
	activeSlide: PptxSlide | undefined;
	/** Whether inherited layout/master elements are unlocked for editing. */
	editTemplateMode: boolean;
	/** Slide masters, resolving the active slide's layout/master (SLIDE BACKGROUND card's template rows). */
	slideMasters: readonly PptxSlideMaster[];
	/** Presentation theme colours used to preview override target slots. */
	colorScheme: PptxThemeColorScheme | undefined;
	/** Presentation theme fonts, seeding the THEME EDITOR card's font pair. */
	fontScheme: PptxThemeFontScheme | undefined;
	/** The loaded theme's name (THEME EDITOR card), when the package has one. */
	themeName: string | undefined;
	/** Tag collections parsed from `ppt/tags/*.xml` (TAGS card). */
	tagCollections: readonly PptxTagCollection[];
	/** Notes page size in px (NOTES & HANDOUT card), when the package has one. */
	notesCanvasSize: { width: number; height: number } | undefined;
	/** Notes master placeholder count, or undefined when no notes master. */
	notesPlaceholderCount: number | undefined;
	/** Handout master placeholder count, or undefined when no handout master. */
	handoutPlaceholderCount: number | undefined;
}

export interface Inspector {
	el: HTMLElement;
	update(state: InspectorState): void;
	/** Refresh the deck-level tabs (Elements/Comments + no-selection Properties). */
	updateDeck(state: InspectorDeckState): void;
	setEditable(editable: boolean): void;
}
