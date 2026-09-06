/**
 * Intermediate model consumed by the legacy binary `.ppt` writer.
 *
 * Distinct from `ppt/ppt-model.ts` (which models what the IMPORTER reads):
 * this model is built directly from the editor's own `PptxElement` tree
 * (see `element-to-write-model.ts`) and carries everything the writer needs
 * to emit, including gradient fills, which the read-side model degrades to
 * a solid colour.
 *
 * All coordinates are EMU; all colours are '#'-less hex RGB strings.
 *
 * @module ppt/writer/write-model
 */

/** Rectangle in EMU. */
export interface WRect {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** A resolved text run. */
export interface WRun {
	text: string;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	sizePt?: number;
	colorRgb?: string;
	fontName?: string;
}

/** A resolved paragraph (one or more runs, terminated implicitly). */
export interface WParagraph {
	indentLevel: number;
	align?: 'l' | 'ctr' | 'r' | 'just';
	hasBullet?: boolean;
	bulletChar?: string;
	bulletColorRgb?: string;
	marginLeftEmu?: number;
	indentEmu?: number;
	runs: WRun[];
}

/** A text body: PowerPoint text type plus paragraphs. */
export interface WTextBody {
	/** TextTypeEnum: 0 = title, 1 = body, 4 = other (plain text box). */
	textType: number;
	paragraphs: WParagraph[];
}

/** A single gradient stop. */
export interface WGradientStop {
	rgb: string;
	position: number;
}

/** Shape fill. */
export type WFill =
	| { kind: 'solid'; rgb: string }
	| { kind: 'gradient'; angleDeg: number; stops: WGradientStop[] }
	| { kind: 'none' };

/** Shape outline. */
export type WLine =
	| { kind: 'line'; rgb: string; widthEmu: number; dash?: string }
	| { kind: 'none' };

/** Fields shared by every drawable node. */
export interface WShapeBase {
	name?: string;
	anchor: WRect;
	rotationDeg?: number;
	flipH?: boolean;
	flipV?: boolean;
}

/** A geometric shape, text box, or connector. */
export interface WShape extends WShapeBase {
	kind: 'shape';
	/** MSOSPT shape type (already mapped from the ECMA-376 preset name). */
	spt: number;
	isConnector: boolean;
	fill?: WFill;
	line?: WLine;
	text?: WTextBody;
	placeholderType?: 'title' | 'body' | 'ctrTitle' | 'subTitle';
}

/** A picture shape referencing an entry in the deck's picture list. */
export interface WPicture extends WShapeBase {
	kind: 'picture';
	pictureIndex: number;
}

/** A group of shapes. */
export interface WGroup extends WShapeBase {
	kind: 'group';
	children: WAnyShape[];
}

export type WAnyShape = WShape | WPicture | WGroup;

/** A picture stored in the deck's Pictures stream / BStore. */
export interface WPictureData {
	/** 'png' or 'jpg': the only formats the writer embeds as-is. */
	extension: 'png' | 'jpg';
	bytes: Uint8Array;
}

/** A parsed slide ready for binary serialisation. */
export interface WSlide {
	backgroundRgb?: string;
	shapes: WAnyShape[];
	notesParagraphs?: WParagraph[];
}

/** The complete deck the writer serialises. */
export interface WDeck {
	widthEmu: number;
	heightEmu: number;
	slides: WSlide[];
	pictures: WPictureData[];
}
