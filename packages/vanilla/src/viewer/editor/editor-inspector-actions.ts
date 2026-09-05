import type {
	PptxImageEffects,
	PptxTableCellStyle,
	PptxTableData,
	XmlObject,
	PptxChartData,
	MediaPptxElement,
	ElementAction,
	SmartArtColorScheme,
	SmartArtLayoutType,
	TextStyle,
	PptxElement,
	PptxSmartArtData,
	PptxSmartArtNodeStyle,
} from 'pptx-viewer-core';
import {
	elementActionToPptxAction,
	addSmartArtNode,
	addSmartArtNodeAsChild,
	removeSmartArtNode,
	promoteSmartArtNode,
	demoteSmartArtNode,
	isImageLikeElement,
	switchSmartArtLayout,
	setSmartArtNodeStyle,
	updateSmartArtNodeText,
} from 'pptx-viewer-core';
import {
	addGradientStopPatch,
	applyStyleToSelectedSegments,
	applyUniformCellPaddingPatch,
	autoFitModePatch,
	buildOleObjectNamePatch,
	elementLockTogglePatch,
	gradientStatePatch,
	imageAdjustmentsPatch,
	imageCropPatch,
	isElementLocked,
	reflowSmartArtData,
	remapTextToSegments,
	removeGradientStopPatch,
	tableInspectorPatch,
	textAdvancedPatch,
	textWrapPatch,
	updateGradientStopPatch,
	vAlignPatch,
} from 'pptx-viewer-shared';
import type { GradientState, InlineTextSelection, TextAdvancedChanges } from 'pptx-viewer-shared';

import type { ApplyToSelected } from './editor-apply-to-selected';
import { patchShapeStyle } from './editor-format-mutations';
import { currentInlineEditorText } from './inline-text-editor';
import {
	mergeTableCellRange,
	mutateTableStructure,
	patchTableCells,
	setTableColumnWidth,
	setTableRowHeight,
	splitTableCell,
} from './table-editor-mutations';
import type { TableCellPosition, TableStructureAction } from './table-editor-mutations';

/**
 * Element-type-aware inspector actions: text vertical-align/wrap/autofit,
 * gradient fill + fill/stroke opacity, image brightness/contrast/saturation +
 * crop, and table-level header-row/banded-rows/cell-padding. Every method is a
 * thin `applyToSelected` wrapper around pure builders from `pptx-viewer-shared`
 * (or the local `patchShapeStyle`), mirroring `editor-text-actions.ts`.
 *
 * The corresponding panels live under `ui/inspector/`.
 */
export interface InspectorActions {
	/** Flip the selected element's lock (writes noMove/noResize; see elementLockTogglePatch). */
	toggleElementLock(): void;
	setTextVerticalAlign(vAlign: NonNullable<TextStyle['vAlign']>): void;
	setTextWrap(wrap: NonNullable<TextStyle['textWrap']>): void;
	setAutoFitMode(mode: NonNullable<TextStyle['autoFitMode']>): void;
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
	setElementAction(trigger: 'click' | 'hover', action: ElementAction): void;
	/** Set the selection's accessibility description (inspector Alt Text field). */
	setAltText(text: string): void;
	/** Set the selection's accessibility title (inspector Title field). */
	setTitle(text: string): void;
	/** Set the selected OLE element's Object Name (`p:oleObj/@name`). */
	setOleName(name: string): void;
	setChartData(data: PptxChartData): void;
	setMediaProperties(patch: Partial<MediaPptxElement>): void;

	setTableHeaderRow(enabled: boolean): void;
	setTableBandedRows(enabled: boolean): void;
	setTableCellPadding(padding: number): void;
	setTableOptions(patch: Partial<PptxTableData>, cellStyle?: Partial<PptxTableCellStyle>): void;
	/** Replace the selection's whole table data (inspector data grid). */
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
	replaceSmartArtData(data: PptxSmartArtData): void;
	setSmartArtLayout(layout: SmartArtLayoutType): void;
	setSmartArtColorScheme(scheme: SmartArtColorScheme): void;
}

const CROP_KEY = {
	left: 'cropLeft',
	top: 'cropTop',
	right: 'cropRight',
	bottom: 'cropBottom',
} as const;

export function createInspectorActions(applyToSelected: ApplyToSelected): InspectorActions {
	return {
		// Shared decides both what reads as "locked" and what the toggle writes,
		// so the button's state can never drift from what the canvas enforces.
		toggleElementLock: () =>
			applyToSelected((el) => ({ locks: elementLockTogglePatch(!isElementLocked(el)) })),
		setTextVerticalAlign: (vAlign) => applyToSelected((el) => vAlignPatch(el, vAlign)),
		setTextWrap: (wrap) => applyToSelected((el) => textWrapPatch(el, wrap)),
		setAutoFitMode: (mode) => applyToSelected((el) => autoFitModePatch(el, mode)),
		setTextAdvanced: (patch) => applyToSelected((el) => textAdvancedPatch(el, patch)),
		setTextStyle: (patch, selection) =>
			applyToSelected((el) => {
				if (!('textStyle' in el)) {
					return {};
				}
				if (selection && el.textSegments?.length) {
					// The inline editor is uncontrolled: reconcile against its live
					// text (same remap the commit path uses) before slicing by
					// `selection`, or the style applies to stale pre-keystroke
					// content and is discarded when the edit session commits. See
					// `currentInlineEditorText`.
					const liveText = currentInlineEditorText();
					const currentSegments =
						liveText !== undefined
							? remapTextToSegments(liveText, el.textSegments, el.textStyle)
							: el.textSegments;
					return {
						textSegments: applyStyleToSelectedSegments(currentSegments, selection, patch)
							.newSegments,
						...(liveText !== undefined ? { text: liveText } : {}),
					};
				}
				return { textStyle: { ...el.textStyle, ...patch } };
			}),

		setFillOpacity: (opacity) =>
			applyToSelected((el) => patchShapeStyle(el, { fillOpacity: opacity })),
		setStrokeOpacity: (opacity) =>
			applyToSelected((el) => patchShapeStyle(el, { strokeOpacity: opacity })),
		setGradientFill: (state) => applyToSelected((el) => gradientStatePatch(el, state)),
		addGradientStop: (color, position) =>
			applyToSelected((el) => addGradientStopPatch(el, color, position)),
		removeGradientStop: (index) =>
			applyToSelected((el) => removeGradientStopPatch(el, index) ?? {}),
		updateGradientStop: (index, changes) =>
			applyToSelected((el) => updateGradientStopPatch(el, index, changes)),

		setImageBrightness: (value) =>
			applyToSelected((el) => imageAdjustmentsPatch(el, { brightness: value })),
		setImageContrast: (value) =>
			applyToSelected((el) => imageAdjustmentsPatch(el, { contrast: value })),
		setImageSaturation: (value) =>
			applyToSelected((el) => imageAdjustmentsPatch(el, { saturation: value })),
		setImageCrop: (edge, value) =>
			applyToSelected((el) => imageCropPatch(el, { [CROP_KEY[edge]]: value })),
		setImageEffects: (patch) =>
			applyToSelected((el) =>
				isImageLikeElement(el)
					? ({ imageEffects: { ...el.imageEffects, ...patch } } as Partial<typeof el>)
					: {},
			),
		setElementAction: (trigger, action) =>
			applyToSelected(() => ({
				[trigger === 'click' ? 'actionClick' : 'actionHover']: elementActionToPptxAction(action),
			})),
		// `altText` is a base-element field, so this works for every element type
		// the accessibility checker can complain about, not just pictures.
		setAltText: (text) => applyToSelected(() => ({ altText: text })),
		// `title` similarly applies to every element kind that models it (a plain
		// shape/text box/connector and every graphic-frame kind); a picture has
		// no title field, so this is a no-op there (the field is hidden in the UI).
		setTitle: (text) => applyToSelected(() => ({ title: text })),
		setOleName: (name) =>
			applyToSelected((el) => (el.type === 'ole' ? buildOleObjectNamePatch(name) : {})),
		setChartData: (data) =>
			applyToSelected((el) => (el.type === 'chart' ? { chartData: data } : {})),
		setMediaProperties: (patch) => applyToSelected((el) => (el.type === 'media' ? patch : {})),

		setTableHeaderRow: (enabled) =>
			applyToSelected((el) => tableInspectorPatch(el, { firstRowHeader: enabled })),
		setTableBandedRows: (enabled) =>
			applyToSelected((el) => tableInspectorPatch(el, { bandedRows: enabled })),
		setTableCellPadding: (padding) =>
			applyToSelected((el) => applyUniformCellPaddingPatch(el, padding)),
		setTableOptions: (patch, cellStyle) =>
			applyToSelected((el) => {
				if (el.type !== 'table' || !el.tableData) {
					return {};
				}
				return {
					tableData: {
						...el.tableData,
						...patch,
						rows: cellStyle
							? el.tableData.rows.map((row) => ({
									...row,
									cells: row.cells.map((cell) => ({
										...cell,
										style: { ...cell.style, ...cellStyle },
									})),
								}))
							: el.tableData.rows,
					},
				} as Partial<typeof el>;
			}),
		// The data grid hands over a complete `tableData` (rows included), which
		// `setTableOptions` would silently drop: it re-applies the element's
		// existing rows after merging the patch.
		setTableData: (data, rawXml) =>
			applyToSelected((el) =>
				el.type === 'table' ? { tableData: data, ...(rawXml ? { rawXml } : {}) } : {},
			),
		setTableCellStyle: (rowIndex, columnIndex, patch) =>
			applyToSelected((el) => {
				if (el.type !== 'table' || !el.tableData?.rows[rowIndex]?.cells[columnIndex]) {
					return {};
				}
				return {
					tableData: {
						...el.tableData,
						rows: el.tableData.rows.map((row, index) =>
							index === rowIndex
								? {
										...row,
										cells: row.cells.map((cell, cellIndex) =>
											cellIndex === columnIndex
												? { ...cell, style: { ...cell.style, ...patch } }
												: cell,
										),
									}
								: row,
						),
					},
				};
			}),
		setTableCellStyles: (cells, patch) =>
			applyToSelected((el) =>
				el.type === 'table' && el.tableData
					? { tableData: patchTableCells(el.tableData, cells, patch) }
					: {},
			),
		mutateTableStructure: (cell, action) =>
			applyToSelected((el) =>
				el.type === 'table' && el.tableData
					? { tableData: mutateTableStructure(el.tableData, cell, action) }
					: {},
			),
		setTableColumnWidth: (column, percent) =>
			applyToSelected((el) =>
				el.type === 'table' && el.tableData
					? { tableData: setTableColumnWidth(el.tableData, column, percent) }
					: {},
			),
		setTableRowHeight: (row, height) =>
			applyToSelected((el) =>
				el.type === 'table' && el.tableData
					? { tableData: setTableRowHeight(el.tableData, row, height) }
					: {},
			),
		mergeTableCells: (cells) =>
			applyToSelected((el) =>
				el.type === 'table' && el.tableData
					? { tableData: mergeTableCellRange(el.tableData, cells) }
					: {},
			),
		splitTableCell: (cell) =>
			applyToSelected((el) =>
				el.type === 'table' && el.tableData
					? { tableData: splitTableCell(el.tableData, cell) }
					: {},
			),

		setSmartArtNodeText: (nodeId, text) =>
			applyToSelected((el) =>
				smartArtPatch(el, (data) => updateSmartArtNodeText(data, nodeId, text)),
			),
		setSmartArtNodeStyle: (nodeId, patch) =>
			applyToSelected((el) =>
				smartArtPatch(el, (data) => setSmartArtNodeStyle(data, nodeId, patch)),
			),
		mutateSmartArtNode: (nodeId, action) =>
			applyToSelected((el) =>
				smartArtPatch(el, (data) =>
					action === 'add'
						? addSmartArtNode(data, 'New item')
						: action === 'addChild'
							? addSmartArtNodeAsChild(data, nodeId, 'New item')
							: action === 'remove'
								? removeSmartArtNode(data, nodeId)
								: action === 'promote'
									? promoteSmartArtNode(data, nodeId)
									: demoteSmartArtNode(data, nodeId),
				),
			),
		replaceSmartArtData: (data) => applyToSelected((el) => smartArtPatch(el, () => data)),
		setSmartArtLayout: (layout) =>
			applyToSelected((el) => smartArtPatch(el, (data) => switchSmartArtLayout(data, layout))),
		setSmartArtColorScheme: (scheme) =>
			applyToSelected((el) => smartArtPatch(el, (data) => ({ ...data, colorScheme: scheme }))),
	};
}

/**
 * Apply a SmartArt data edit to a selected element and reflow the cached
 * drawing shapes when the edit cleared them.
 *
 * Every edit routed through here can clear `drawingShapes` (add / remove /
 * promote / demote / style / layout switch all do). Without the reflow the
 * renderer dropped from PowerPoint's cached `dsp` geometry to the crude family
 * approximation, which is what React has always avoided by calling
 * `rebuildDrawingShapesIfCleared` at each commit. The reflow is a no-op while
 * the cached drawing survives an edit (a text edit patches it in place), so the
 * cached-drawing-wins precedence between the two render paths is unchanged.
 */
function smartArtPatch(
	el: PptxElement,
	edit: (data: PptxSmartArtData) => PptxSmartArtData,
): Partial<PptxElement> {
	if (el.type !== 'smartArt' || !el.smartArtData) {
		return {};
	}
	const next = edit(el.smartArtData);
	const box = { width: el.width, height: el.height };
	return { smartArtData: reflowSmartArtData(next, el.id, box) };
}
