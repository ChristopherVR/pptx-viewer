import type { SmartArtColorScheme, SmartArtLayoutType, TextStyle } from 'pptx-viewer-core';
import { switchSmartArtLayout, updateSmartArtNodeText } from 'pptx-viewer-core';
import {
	addGradientStopPatch,
	applyUniformCellPaddingPatch,
	autoFitModePatch,
	gradientStatePatch,
	imageAdjustmentsPatch,
	imageCropPatch,
	removeGradientStopPatch,
	tableInspectorPatch,
	textWrapPatch,
	updateGradientStopPatch,
	vAlignPatch,
} from 'pptx-viewer-shared';
import type { GradientState } from 'pptx-viewer-shared';

import type { ApplyToSelected } from './editor-apply-to-selected';
import { patchShapeStyle } from './editor-format-mutations';

/**
 * Element-type-aware inspector actions: text vertical-align/wrap/autofit,
 * gradient fill + fill/stroke opacity, image brightness/contrast/saturation +
 * crop, and table-level header-row/banded-rows/cell-padding. Every method is a
 * thin `applyToSelected` wrapper around pure builders from `pptx-viewer-shared`
 * (or the local `patchShapeStyle`), mirroring `editor-text-actions.ts`.
 *
 * These extend the base position/size/rotation + flat fill/stroke inspector
 * that `editor-edit-ops.ts` already exposes; see `ui/inspector/` for the
 * per-element-type panels that call these.
 */
export interface InspectorActions {
	setTextVerticalAlign(vAlign: NonNullable<TextStyle['vAlign']>): void;
	setTextWrap(wrap: NonNullable<TextStyle['textWrap']>): void;
	setAutoFitMode(mode: NonNullable<TextStyle['autoFitMode']>): void;

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

	setTableHeaderRow(enabled: boolean): void;
	setTableBandedRows(enabled: boolean): void;
	setTableCellPadding(padding: number): void;

	setSmartArtNodeText(nodeId: string, text: string): void;
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
		setTextVerticalAlign: (vAlign) => applyToSelected((el) => vAlignPatch(el, vAlign)),
		setTextWrap: (wrap) => applyToSelected((el) => textWrapPatch(el, wrap)),
		setAutoFitMode: (mode) => applyToSelected((el) => autoFitModePatch(el, mode)),

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

		setTableHeaderRow: (enabled) =>
			applyToSelected((el) => tableInspectorPatch(el, { firstRowHeader: enabled })),
		setTableBandedRows: (enabled) =>
			applyToSelected((el) => tableInspectorPatch(el, { bandedRows: enabled })),
		setTableCellPadding: (padding) =>
			applyToSelected((el) => applyUniformCellPaddingPatch(el, padding)),

		setSmartArtNodeText: (nodeId, text) =>
			applyToSelected((el) =>
				el.type === 'smartArt' && el.smartArtData
					? { smartArtData: updateSmartArtNodeText(el.smartArtData, nodeId, text) }
					: {},
			),
		setSmartArtLayout: (layout) =>
			applyToSelected((el) =>
				el.type === 'smartArt' && el.smartArtData
					? { smartArtData: switchSmartArtLayout(el.smartArtData, layout) }
					: {},
			),
		setSmartArtColorScheme: (scheme) =>
			applyToSelected((el) =>
				el.type === 'smartArt' && el.smartArtData
					? { smartArtData: { ...el.smartArtData, colorScheme: scheme } }
					: {},
			),
	};
}
