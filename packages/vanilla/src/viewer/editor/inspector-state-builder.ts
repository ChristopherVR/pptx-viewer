import type { PptxElement } from 'pptx-viewer-core';
import { hasShapeProperties, isImageLikeElement } from 'pptx-viewer-core';
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
export function buildInspectorState(el: PptxElement | undefined): InspectorState {
	const shape = shapeStyleOf(el);
	const textAdvanced = el ? textAdvancedStateOf(el) : undefined;
	const image = el ? imageAdjustmentsStateOf(el) : undefined;
	const crop = el ? imageCropStateOf(el) : undefined;
	const table = el ? tableInspectorStateOf(el) : undefined;

	return {
		hasSelection: el !== undefined,
		canShape: canFormatShape(el),
		canText: canFormatText(el),
		isImage: el !== undefined && isImageLikeElement(el),
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
		imageBrightness: image?.brightness ?? 0,
		imageContrast: image?.contrast ?? 0,
		imageSaturation: image?.saturation ?? 0,
		cropLeft: crop?.cropLeft ?? 0,
		cropTop: crop?.cropTop ?? 0,
		cropRight: crop?.cropRight ?? 0,
		cropBottom: crop?.cropBottom ?? 0,
		tableHeaderRow: table?.firstRowHeader ?? false,
		tableBandedRows: table?.bandedRows ?? false,
		tableCellPadding: table?.cellPadding ?? 0,
	};
}
