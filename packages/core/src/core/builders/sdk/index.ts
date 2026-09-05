/**
 * Headless PPTX SDK — high-level builder API for creating and
 * manipulating PowerPoint presentations programmatically.
 *
 * @module sdk
 */

export { Presentation } from './Presentation';

export { PresentationBuilder, buildBlankPresentationArchive } from './PresentationBuilder';
export type { PresentationBuilderResult } from './PresentationBuilder';

export { SlideBuilder } from './SlideBuilder';

export {
	createTextElement,
	createShapeElement,
	createConnectorElement,
	createImageElement,
	createTableElement,
	createChartElement,
	createMediaElement,
	createGroupElement,
	createFreeformElement,
	resetIdCounter,
} from './ElementFactory';

// Slide operations
export { duplicateSlide, duplicateElement, resetCloneIdCounter } from './slide-operations';

// Text operations
export { findText, replaceText, replaceTextInSlide } from './text-operations';
export type { FindResult } from './text-operations';

// Chart operations
export {
	setChartType,
	addChartSeries,
	removeChartSeries,
	setChartCategories,
	updateChartSeriesValues,
	setChartTitle,
	setChartGrouping,
	setChartLegend,
	setChartAxis,
	setChartDataLabels,
	setChartSeriesTrendline,
	setChartSeriesErrorBars,
	updateChartDataPoint,
	addChartCategory,
	removeChartCategory,
	setChartSeriesColor,
	setChartAxisLogScale,
	setChartAxisTitleStyle,
	setChartAxisGridlineStyle,
	setChartSeriesMarker,
	setChartSeriesChartType,
	setChartDataPointFill,
	setChartDataPointExplosion,
	setChartDataPointMarker,
	setChartDataPointLabel,
} from './chart-operations';
export type {
	PptxChartLegendPosition,
	PptxChartAxisType,
	ChartAxisEdit,
	ChartAxisTitleStyleEdit,
	ChartGridlineStyleEdit,
	ChartDataPointLabelEdit,
} from './chart-operations';

// Chart drawing-overlay (c:userShapes) operations
export {
	listChartUserShapes,
	addChartUserShape,
	updateChartUserShape,
	removeChartUserShape,
} from './chart-user-shape-operations';

// Layout operations
export {
	createLayout,
	createLayouts,
	findLayoutByName,
	findLayoutByType,
	generateLayoutXml,
} from './layout-operations';
export type {
	LayoutDefinition,
	PlaceholderDefinition,
	LayoutCreationResult,
} from './layout-operations';

// Slide Master view CRUD (Insert/Duplicate/Delete/Rename Layout and Slide Master)
export {
	duplicateLayout,
	deleteLayout,
	renameLayout,
	insertLayout,
	duplicateSlideMaster,
	deleteSlideMaster,
	renameSlideMaster,
	insertSlideMaster,
	collectLayoutNames,
	collectMasterNames,
	uniqueDisplayName,
	uniquePrefixedName,
} from './master-layout-crud';
export type {
	DuplicateLayoutSuccess,
	DuplicateLayoutResult,
	DuplicateMasterSuccess,
	DuplicateMasterResult,
	MasterLayoutCrudFailure,
	MasterLayoutCrudResult,
	MasterLayoutCrudSuccess,
} from './master-layout-crud';

// Section operations
export {
	addSection,
	removeSection,
	reorderSections,
	getSectionForSlide,
	moveSlidesToSection,
	resetSectionIdCounter,
} from './section-operations';

// Merge operations
export { mergePresentation } from './merge-operations';
export type { MergeOptions } from './merge-operations';

// Shape operations
export {
	replaceShapeGeometry,
	replaceWithCustomGeometry,
	interpolateShapeGeometry,
	parseSvgPath,
	serializeSvgPath,
} from './shape-operations';

// Element operations
export { setElementLocked } from './element-operations';

// Diff operations
export { diffPresentations, diffSlides } from './diff-operations';
export type { PresentationDiff, SlideDiff, ElementDiff, PropertyChange } from './diff-operations';

// Template engine (mail merge)
export { applyTemplate, findPlaceholders, mailMerge } from './template-engine';
export type { TemplateData } from './template-engine';

// Element builders (fluent API)
export {
	TextBuilder,
	ShapeBuilder,
	ImageBuilder,
	TableBuilder,
	ChartBuilder,
	ConnectorBuilder,
	MediaBuilder,
	GroupBuilder,
} from './ElementBuilders';

// Unit conversion helpers
export {
	EMU_PER_PIXEL,
	EMU_PER_INCH,
	EMU_PER_POINT,
	inches,
	cm,
	mm,
	pt,
	emuToPixels,
	pixelsToEmu,
	inchesToEmu,
	cmToEmu,
	SlideSizes,
} from './units';

// Theme presets
export { ThemePresets, getThemePreset } from './theme-presets';
export type { ThemePreset, ThemePresetName } from './theme-presets';

export type {
	ElementPosition,
	FillInput,
	StrokeInput,
	ShadowInput,
	TextStyleInput,
	TextSegmentInput,
	TextOptions,
	ShapeOptions,
	ImageOptions,
	TableInput,
	TableRowInput,
	TableCellInput,
	TableOptions,
	ChartSeriesInput,
	ChartInput,
	ChartOptions,
	ConnectorOptions,
	MediaOptions,
	GroupOptions,
	BackgroundInput,
	TransitionInput,
	AnimationInput,
	PresentationOptions,
	PresentationThemeInput,
} from './types';
