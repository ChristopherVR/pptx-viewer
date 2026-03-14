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
	resetIdCounter,
} from "./ElementFactory";

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
