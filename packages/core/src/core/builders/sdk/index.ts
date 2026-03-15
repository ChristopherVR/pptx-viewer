/**
 * Headless PPTX SDK — high-level builder API for creating and
 * manipulating PowerPoint presentations programmatically.
 *
 * @module sdk
 */

export { PresentationBuilder } from "./PresentationBuilder";
export type { PresentationBuilderResult } from "./PresentationBuilder";

export { SlideBuilder } from "./SlideBuilder";

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
} from "./ElementFactory";

// Slide operations
export {
	duplicateSlide,
	duplicateElement,
	resetCloneIdCounter,
} from "./slide-operations";

// Text operations
export {
	findText,
	replaceText,
	replaceTextInSlide,
} from "./text-operations";
export type { FindResult } from "./text-operations";

// Chart operations
export {
	setChartType,
	addChartSeries,
	removeChartSeries,
	setChartCategories,
	updateChartSeriesValues,
	setChartTitle,
	setChartGrouping,
} from "./chart-operations";

// Layout operations
export {
	createLayout,
	createLayouts,
	findLayoutByName,
	findLayoutByType,
	generateLayoutXml,
} from "./layout-operations";
export type {
	LayoutDefinition,
	PlaceholderDefinition,
	LayoutCreationResult,
} from "./layout-operations";

// Section operations
export {
	addSection,
	removeSection,
	reorderSections,
	getSectionForSlide,
	moveSlidesToSection,
	resetSectionIdCounter,
} from "./section-operations";

// Merge operations
export { mergePresentation } from "./merge-operations";
export type { MergeOptions } from "./merge-operations";

// Shape operations
export {
	replaceShapeGeometry,
	replaceWithCustomGeometry,
	interpolateShapeGeometry,
	parseSvgPath,
	serializeSvgPath,
} from "./shape-operations";

// Diff operations
export { diffPresentations, diffSlides } from "./diff-operations";
export type {
	PresentationDiff,
	SlideDiff,
	ElementDiff,
	PropertyChange,
} from "./diff-operations";

// Template engine (mail merge)
export {
	applyTemplate,
	findPlaceholders,
	mailMerge,
} from "./template-engine";
export type { TemplateData } from "./template-engine";

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
} from "./types";
