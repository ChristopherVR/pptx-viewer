import type {
	PptxImageEffects,
	PptxChartData,
	MediaPptxElement,
	PptxSmartArtData,
	PptxSmartArtNodeStyle,
	PptxTableCellStyle,
	PptxTableData,
	ElementAction,
	SmartArtColorScheme,
	SmartArtLayoutType,
	TextStyle,
	ShapeStyle,
} from 'pptx-viewer-core';
import type { GradientState, InlineTextSelection, TextAdvancedChanges } from 'pptx-viewer-shared';

import type { GeometryPatch } from '../../editor/editor-edit-ops';
import type { TableCellPosition, TableStructureAction } from '../../editor/table-editor-mutations';

/**
 * The inspector edit actions: universal geometry + flat fill/stroke, plus the
 * element-type-aware sections (text anchor/wrap/autofit, gradient fill +
 * opacity, image adjustments/crop, table-level flags + padding).
 */
export interface InspectorHandlers {
	setGeometry(patch: GeometryPatch): void;
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
	setChartData(data: PptxChartData): void;
	setMediaProperties(patch: Partial<MediaPptxElement>): void;

	setTableHeaderRow(enabled: boolean): void;
	setTableBandedRows(enabled: boolean): void;
	setTableCellPadding(padding: number): void;
	setTableOptions(patch: Partial<PptxTableData>, cellStyle?: Partial<PptxTableCellStyle>): void;
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
	setSmartArtLayout(layout: SmartArtLayoutType): void;
	setSmartArtColorScheme(scheme: SmartArtColorScheme): void;
}

/** Selection-derived state the inspector reflects, computed by `buildInspectorState`. */
export interface InspectorState {
	hasSelection: boolean;
	canShape: boolean;
	canText: boolean;
	isImage: boolean;
	isChart: boolean;
	isMedia: boolean;
	isTable: boolean;
	isSmartArt: boolean;
	smartArtData: PptxSmartArtData | undefined;
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
	chartData?: PptxChartData;
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
}

export interface Inspector {
	el: HTMLElement;
	update(state: InspectorState): void;
	setEditable(editable: boolean): void;
}
