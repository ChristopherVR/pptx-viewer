import type { GradientState } from 'pptx-viewer-shared';

import type { GeometryPatch } from '../../editor/editor-edit-ops';

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

	setTextVerticalAlign(vAlign: InspectorState['vAlign']): void;
	setTextWrap(wrap: InspectorState['textWrap']): void;
	setAutoFitMode(mode: InspectorState['autoFitMode']): void;

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
}

/** Selection-derived state the inspector reflects, computed by `buildInspectorState`. */
export interface InspectorState {
	hasSelection: boolean;
	canShape: boolean;
	canText: boolean;
	isImage: boolean;
	isTable: boolean;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	fillColor: string | undefined;
	strokeColor: string | undefined;
	strokeWidth: number;
	fillOpacity: number;
	strokeOpacity: number;
	gradientEnabled: boolean;
	gradient: GradientState;
	vAlign: 'top' | 'middle' | 'bottom';
	textWrap: 'square' | 'none';
	autoFitMode: 'shrink' | 'normal' | 'none';
	imageBrightness: number;
	imageContrast: number;
	imageSaturation: number;
	cropLeft: number;
	cropTop: number;
	cropRight: number;
	cropBottom: number;
	tableHeaderRow: boolean;
	tableBandedRows: boolean;
	tableCellPadding: number;
}

export interface Inspector {
	el: HTMLElement;
	update(state: InspectorState): void;
	setEditable(editable: boolean): void;
}
