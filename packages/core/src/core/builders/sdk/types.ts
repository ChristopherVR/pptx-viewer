/**
 * SDK input types for the headless PPTX builder API.
 *
 * These types provide a simplified, ergonomic interface for creating
 * presentation elements programmatically. Internal types (PptxElement,
 * ShapeStyle, TextStyle) are the canonical model; these types are
 * convenience wrappers that get mapped to the internal model by
 * the builder functions.
 *
 * @module sdk/types
 */

import type { PptxChartType } from "../../types/chart";
import type {
	PptxAnimationPreset,
	PptxAnimationTrigger,
} from "../../types/animation";
import type { PptxTransitionType } from "../../types/transition";
import type { StrokeDashType, ConnectorArrowType } from "../../types/common";

// ---------------------------------------------------------------------------
// Position & layout
// ---------------------------------------------------------------------------

/** Position and size in pixels. Converted to EMU internally when needed. */
export interface ElementPosition {
	x: number;
	y: number;
	width: number;
	height: number;
	rotation?: number;
}

// ---------------------------------------------------------------------------
// Fill, stroke, shadow helpers
// ---------------------------------------------------------------------------

export type FillInput =
	| { type: "solid"; color: string; opacity?: number }
	| {
			type: "gradient";
			angle?: number;
			gradientType?: "linear" | "radial";
			stops: Array<{ color: string; position: number; opacity?: number }>;
	  }
	| { type: "pattern"; preset: string; foreground?: string; background?: string }
	| { type: "image"; url: string; mode?: "stretch" | "tile" }
	| { type: "none" };

export interface StrokeInput {
	color?: string;
	width?: number;
	dash?: StrokeDashType;
	opacity?: number;
	join?: "round" | "bevel" | "miter";
	cap?: "flat" | "rnd" | "sq";
}

export interface ShadowInput {
	color?: string;
	blur?: number;
	offsetX?: number;
	offsetY?: number;
	opacity?: number;
}

// ---------------------------------------------------------------------------
// Text input
// ---------------------------------------------------------------------------

export interface TextStyleInput {
	fontSize?: number;
	fontFamily?: string;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	strikethrough?: boolean;
	color?: string;
	alignment?: "left" | "center" | "right" | "justify";
	verticalAlignment?: "top" | "middle" | "bottom";
	lineSpacing?: number;
	spaceBefore?: number;
	spaceAfter?: number;
}

export interface TextSegmentInput {
	text: string;
	style?: Partial<TextStyleInput>;
}

export interface TextOptions extends Partial<ElementPosition> {
	fontSize?: number;
	fontFamily?: string;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	color?: string;
	alignment?: "left" | "center" | "right" | "justify";
	verticalAlignment?: "top" | "middle" | "bottom";
	lineSpacing?: number;
	fill?: FillInput;
	stroke?: StrokeInput;
	shadow?: ShadowInput;
	opacity?: number;
}

// ---------------------------------------------------------------------------
// Shape input
// ---------------------------------------------------------------------------

export interface ShapeOptions extends Partial<ElementPosition> {
	fill?: FillInput;
	stroke?: StrokeInput;
	text?: string;
	textStyle?: Partial<TextStyleInput>;
	adjustments?: Record<string, number>;
	shadow?: ShadowInput;
	opacity?: number;
}

// ---------------------------------------------------------------------------
// Image input
// ---------------------------------------------------------------------------

export interface ImageOptions extends Partial<ElementPosition> {
	altText?: string;
	cropLeft?: number;
	cropTop?: number;
	cropRight?: number;
	cropBottom?: number;
	opacity?: number;
}

// ---------------------------------------------------------------------------
// Table input
// ---------------------------------------------------------------------------

export interface TableInput {
	rows: TableRowInput[];
	columnWidths?: number[];
	style?: string;
	bandRows?: boolean;
	bandColumns?: boolean;
	firstRow?: boolean;
	lastRow?: boolean;
	firstCol?: boolean;
	lastCol?: boolean;
}

export interface TableRowInput {
	cells: TableCellInput[];
	height?: number;
}

export interface TableCellInput {
	text: string;
	style?: Partial<TextStyleInput>;
	fill?: FillInput;
	gridSpan?: number;
	rowSpan?: number;
}

export interface TableOptions extends Partial<ElementPosition> {}

// ---------------------------------------------------------------------------
// Chart input
// ---------------------------------------------------------------------------

export interface ChartSeriesInput {
	name: string;
	values: number[];
	color?: string;
}

export interface ChartInput {
	series: ChartSeriesInput[];
	categories: string[];
	title?: string;
	hasLegend?: boolean;
	legendPosition?: "t" | "b" | "l" | "r" | "tr";
	grouping?: "clustered" | "stacked" | "percentStacked";
}

export interface ChartOptions extends Partial<ElementPosition> {}

// ---------------------------------------------------------------------------
// Connector input
// ---------------------------------------------------------------------------

export interface ConnectorOptions extends Partial<ElementPosition> {
	type?: "straight" | "bent" | "curved";
	stroke?: StrokeInput;
	startArrow?: ConnectorArrowType;
	endArrow?: ConnectorArrowType;
	from?: { elementId: string; site: number };
	to?: { elementId: string; site: number };
}

// ---------------------------------------------------------------------------
// Media input
// ---------------------------------------------------------------------------

export interface MediaOptions extends Partial<ElementPosition> {
	autoPlay?: boolean;
	loop?: boolean;
	volume?: number;
	trimStartMs?: number;
	trimEndMs?: number;
	posterFrame?: string;
}

// ---------------------------------------------------------------------------
// Group input
// ---------------------------------------------------------------------------

export interface GroupOptions extends Partial<ElementPosition> {}

// ---------------------------------------------------------------------------
// Slide-level inputs
// ---------------------------------------------------------------------------

export type BackgroundInput =
	| { type: "solid"; color: string }
	| {
			type: "gradient";
			angle?: number;
			stops: Array<{ color: string; position: number }>;
	  }
	| { type: "image"; source: string };

export interface TransitionInput {
	type: PptxTransitionType;
	duration?: number;
	direction?: string;
	advanceAfterMs?: number;
}

export interface AnimationInput {
	preset: PptxAnimationPreset;
	trigger?: PptxAnimationTrigger;
	duration?: number;
	delay?: number;
}

// ---------------------------------------------------------------------------
// Presentation-level inputs
// ---------------------------------------------------------------------------

export interface PresentationOptions {
	/** Slide width in EMU. Default: 12192000 (16:9 widescreen). */
	width?: number;
	/** Slide height in EMU. Default: 6858000 (16:9 widescreen). */
	height?: number;
	/** Theme configuration. */
	theme?: PresentationThemeInput;
	/** Presentation title (stored in docProps/core.xml). */
	title?: string;
	/** Presentation author. */
	creator?: string;
}

export interface PresentationThemeInput {
	name?: string;
	colors?: {
		dk1?: string;
		lt1?: string;
		dk2?: string;
		lt2?: string;
		accent1?: string;
		accent2?: string;
		accent3?: string;
		accent4?: string;
		accent5?: string;
		accent6?: string;
		hlink?: string;
		folHlink?: string;
	};
	fonts?: {
		majorFont?: string;
		minorFont?: string;
	};
}
