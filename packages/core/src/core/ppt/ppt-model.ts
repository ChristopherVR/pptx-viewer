/**
 * Intermediate object model produced by the legacy .ppt parser and consumed
 * by the PPTX package writer.
 *
 * All coordinates are in EMU; all colors are hex RGB strings without '#'.
 *
 * @module ppt/ppt-model
 */

import type { PptColorScheme } from './color-scheme';
import type { PptStyleRuns } from './text/style-props';

/** Rectangle in EMU. */
export interface EmuRect {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** A resolved text run. */
export interface PptRun {
	text: string;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	sizePt?: number;
	colorRgb?: string;
	fontName?: string;
}

/** A resolved paragraph. */
export interface PptParagraph {
	indentLevel: number;
	align?: 'l' | 'ctr' | 'r' | 'just';
	/** Explicitly toggled bullet; undefined leaves it to inherited styles. */
	hasBullet?: boolean;
	bulletChar?: string;
	bulletFontName?: string;
	bulletColorRgb?: string;
	marginLeftEmu?: number;
	indentEmu?: number;
	runs: PptRun[];
}

/** A resolved text body. */
export interface PptTextBody {
	/** TextTypeEnum of the source text. */
	textType: number;
	paragraphs: PptParagraph[];
}

/** Solid fill or explicit no-fill. */
export type PptFill = { kind: 'solid'; rgb: string } | { kind: 'none' };

/** Outline properties. */
export interface PptLine {
	kind: 'line';
	rgb: string;
	widthEmu: number;
	dash?: string;
	headArrow?: string;
	tailArrow?: string;
}

/** Common shape fields. */
export interface PptShapeBase {
	name?: string;
	anchor?: EmuRect;
	rotationDeg?: number;
	flipH?: boolean;
	flipV?: boolean;
}

/** A geometric shape or text box. */
export interface PptShape extends PptShapeBase {
	kind: 'shape';
	preset: string;
	isConnector: boolean;
	fill?: PptFill;
	line?: PptLine | { kind: 'noLine' };
	text?: PptTextBody;
	/** ST_PlaceholderType when the shape is a placeholder. */
	placeholderType?: string;
}

/** A picture referencing an entry in the deck picture list. */
export interface PptPicture extends PptShapeBase {
	kind: 'picture';
	/** Zero-based index into PptDeck.pictures. */
	pictureIndex: number;
}

/** A group of shapes. */
export interface PptGroup extends PptShapeBase {
	kind: 'group';
	/** Child coordinate space rect in EMU-scaled group units. */
	childRect: EmuRect;
	children: PptAnyShape[];
}

/** Any drawable element. */
export type PptAnyShape = PptShape | PptPicture | PptGroup;

/** A parsed slide. */
export interface PptSlideModel {
	/** Slide background solid fill, when specified on the slide itself. */
	backgroundRgb?: string;
	/** Whether the background should come from the master. */
	followMasterBackground: boolean;
	/** Whether master decorative shapes should show on this slide. */
	followMasterObjects: boolean;
	shapes: PptAnyShape[];
}

/** An extracted picture. */
export interface PptPictureData {
	/** File extension without dot: png, jpg, bmp, gif, tiff, emf, wmf, pict. */
	extension: string;
	bytes: Uint8Array;
}

/** Default text styles harvested from the main master. */
export interface PptMasterTextLevel {
	sizePt?: number;
	bold?: boolean;
	colorRgb?: string;
	fontName?: string;
	align?: 'l' | 'ctr' | 'r' | 'just';
	bulletChar?: string;
	bulletFontName?: string;
	hasBullet?: boolean;
	marginLeftEmu?: number;
	indentEmu?: number;
}

/** The parsed deck. */
export interface PptDeck {
	widthEmu: number;
	heightEmu: number;
	slides: PptSlideModel[];
	/** Shapes drawn on the main master (excluding placeholders). */
	masterShapes: PptAnyShape[];
	/** Master background color. */
	masterBackgroundRgb?: string;
	/** Master (or document) color scheme. */
	scheme: PptColorScheme;
	/** Document font collection (index = FontIndexRef). */
	fonts: string[];
	/** Title style levels (index = indent level). */
	titleStyles: PptMasterTextLevel[];
	/** Body style levels (index = indent level). */
	bodyStyles: PptMasterTextLevel[];
	pictures: PptPictureData[];
}

/** Raw outline/textbox text with unresolved style runs. */
export interface PptRawTextWithStyles {
	textType: number;
	text: string;
	styles?: PptStyleRuns;
}
