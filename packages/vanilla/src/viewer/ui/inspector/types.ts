import type {
	PptxImageEffects,
	PptxChartData,
	MediaPptxElement,
	PptxSmartArtData,
	ElementAction,
	SmartArtColorScheme,
	SmartArtLayoutType,
} from 'pptx-viewer-core';
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
	setImageEffects(patch: Partial<PptxImageEffects>): void;
	setElementAction(trigger: 'click' | 'hover', action: ElementAction): void;
	setChartData(data: PptxChartData): void;
	setMediaProperties(patch: Partial<MediaPptxElement>): void;

	setTableHeaderRow(enabled: boolean): void;
	setTableBandedRows(enabled: boolean): void;
	setTableCellPadding(padding: number): void;

	setSmartArtNodeText(nodeId: string, text: string): void;
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
	imageArtisticEffect: string;
	imageTransparency: number;
	imageBiLevel: number;
	imageDuotone1: string;
	imageDuotone2: string;
	actionClick?: ElementAction;
	actionHover?: ElementAction;
	chartData?: PptxChartData;
	media?: MediaPptxElement;
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
