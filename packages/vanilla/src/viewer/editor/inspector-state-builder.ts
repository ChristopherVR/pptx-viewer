import type { PptxElement } from 'pptx-viewer-core';
import {
	hasShapeProperties,
	isImageLikeElement,
	pptxActionToElementAction,
} from 'pptx-viewer-core';
import type { GradientState } from 'pptx-viewer-shared';
import {
	autoFitModeOf,
	gradientStateOf,
	hasGradientFill,
	imageAdjustmentsStateOf,
	imageCropStateOf,
	tableInspectorStateOf,
	textAdvancedStateOf,
	textWrapOf,
} from 'pptx-viewer-shared';

import type { InspectorState } from '../ui';
import { canFormatShape, canFormatText } from './editor-format-mutations';

const DEFAULT_GRADIENT: GradientState = {
	type: 'linear',
	angle: 90,
	stops: [
		{ color: '#4472c4', position: 0, opacity: 1 },
		{ color: '#ffffff', position: 100, opacity: 1 },
	],
};

/** Read the shape fill/stroke for the inspector (undefined/0 when not a shape). */
function shapeStyleOf(el: PptxElement | undefined): {
	fillColor: string | undefined;
	strokeColor: string | undefined;
	strokeWidth: number;
	fillOpacity: number;
	strokeOpacity: number;
} {
	if (el && hasShapeProperties(el)) {
		return {
			fillColor: el.shapeStyle?.fillColor,
			strokeColor: el.shapeStyle?.strokeColor,
			strokeWidth: el.shapeStyle?.strokeWidth ?? 0,
			fillOpacity: el.shapeStyle?.fillOpacity ?? 1,
			strokeOpacity: el.shapeStyle?.strokeOpacity ?? 1,
		};
	}
	return {
		fillColor: undefined,
		strokeColor: undefined,
		strokeWidth: 0,
		fillOpacity: 1,
		strokeOpacity: 1,
	};
}

/**
 * Build the full {@link InspectorState} for the currently selected element (or
 * the "nothing selected" defaults). Pure; the same element in => the same
 * state out, so it's directly unit-testable without a store/DOM.
 */
export function buildInspectorState(
	el: PptxElement | undefined,
	selectedTableCell: { row: number; column: number } | null = null,
): InspectorState {
	const shape = shapeStyleOf(el);
	const textAdvanced = el ? textAdvancedStateOf(el) : undefined;
	const image = el ? imageAdjustmentsStateOf(el) : undefined;
	const crop = el ? imageCropStateOf(el) : undefined;
	const table = el ? tableInspectorStateOf(el) : undefined;
	const tableCell =
		el?.type === 'table' && selectedTableCell
			? el.tableData?.rows[selectedTableCell.row]?.cells[selectedTableCell.column]
			: undefined;

	return {
		hasSelection: el !== undefined,
		canShape: canFormatShape(el),
		canText: canFormatText(el),
		isImage: el !== undefined && isImageLikeElement(el),
		isChart: el?.type === 'chart',
		isMedia: el?.type === 'media',
		isTable: el?.type === 'table',
		isSmartArt: el?.type === 'smartArt',
		smartArtData: el?.type === 'smartArt' ? el.smartArtData : undefined,
		x: el?.x ?? 0,
		y: el?.y ?? 0,
		width: el?.width ?? 0,
		height: el?.height ?? 0,
		rotation: el?.rotation ?? 0,
		fillColor: shape.fillColor,
		strokeColor: shape.strokeColor,
		strokeWidth: shape.strokeWidth,
		fillOpacity: shape.fillOpacity,
		strokeOpacity: shape.strokeOpacity,
		gradientEnabled: el !== undefined && hasGradientFill(el),
		gradient: el ? gradientStateOf(el) : DEFAULT_GRADIENT,
		vAlign: textAdvanced?.vAlign ?? 'top',
		textWrap: el ? textWrapOf(el) : 'square',
		autoFitMode: el ? autoFitModeOf(el) : 'none',
		characterSpacing: textAdvanced?.characterSpacing ?? 0,
		lineSpacing: textAdvanced?.lineSpacing ?? 1,
		lineSpacingExactPt: textAdvanced?.lineSpacingExactPt ?? null,
		paragraphSpacingBefore: textAdvanced?.paragraphSpacingBefore ?? 0,
		paragraphSpacingAfter: textAdvanced?.paragraphSpacingAfter ?? 0,
		paragraphIndent: textAdvanced?.paragraphIndent ?? 0,
		paragraphMarginLeft: textAdvanced?.paragraphMarginLeft ?? 0,
		textDirection: textAdvanced?.textDirection ?? 'horizontal',
		textRtl: textAdvanced?.rtl ?? false,
		imageBrightness: image?.brightness ?? 0,
		imageContrast: image?.contrast ?? 0,
		imageSaturation: image?.saturation ?? 0,
		imageArtisticEffect:
			el && isImageLikeElement(el) ? (el.imageEffects?.artisticEffect ?? 'none') : 'none',
		imageTransparency:
			el && isImageLikeElement(el) ? 100 - (el.imageEffects?.alphaModFix ?? 100) : 0,
		imageBiLevel: el && isImageLikeElement(el) ? (el.imageEffects?.biLevel ?? 0) : 0,
		imageDuotone1:
			el && isImageLikeElement(el) ? (el.imageEffects?.duotone?.color1 ?? '#000000') : '#000000',
		imageDuotone2:
			el && isImageLikeElement(el) ? (el.imageEffects?.duotone?.color2 ?? '#ffffff') : '#ffffff',
		actionClick: el?.actionClick ? pptxActionToElementAction(el.actionClick, 'click') : undefined,
		actionHover: el?.actionHover ? pptxActionToElementAction(el.actionHover, 'hover') : undefined,
		chartData: el?.type === 'chart' ? el.chartData : undefined,
		media: el?.type === 'media' ? el : undefined,
		cropLeft: crop?.cropLeft ?? 0,
		cropTop: crop?.cropTop ?? 0,
		cropRight: crop?.cropRight ?? 0,
		cropBottom: crop?.cropBottom ?? 0,
		tableHeaderRow: table?.firstRowHeader ?? false,
		tableBandedRows: table?.bandedRows ?? false,
		tableBandedColumns: table?.bandedColumns ?? false,
		tableLastRow: el?.type === 'table' ? (el.tableData?.lastRow ?? false) : false,
		tableFirstCol: el?.type === 'table' ? (el.tableData?.firstCol ?? false) : false,
		tableLastCol: el?.type === 'table' ? (el.tableData?.lastCol ?? false) : false,
		tableRtl: el?.type === 'table' ? (el.tableData?.rtl ?? false) : false,
		tableStyleId: el?.type === 'table' ? (el.tableData?.tableStyleId ?? '') : '',
		tableCellBackground:
			el?.type === 'table'
				? (el.tableData?.rows[0]?.cells[0]?.style?.backgroundColor ?? '#ffffff')
				: '#ffffff',
		tableCellBorder:
			el?.type === 'table'
				? (el.tableData?.rows[0]?.cells[0]?.style?.borderColor ?? '#000000')
				: '#000000',
		tableCellPadding: table?.cellPadding ?? 0,
		selectedTableCell: tableCell ? selectedTableCell : null,
		tableCellStyle: tableCell?.style,
	};
}
