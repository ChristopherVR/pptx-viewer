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

/**
 * A hyperlink / click-action target, the write-side equivalent of
 * `ElementActionType` (see `hyperlink-model.ts`, which derives one of these
 * from a `PptxAction`). `slideIndex` and `firstSlideIndex` are 0-based
 * indices into `WDeck['slides']`.
 */
export type WHyperlinkKind =
	| { kind: 'url'; url: string }
	| { kind: 'slide'; slideIndex: number }
	| { kind: 'firstSlide' }
	| { kind: 'lastSlide' }
	| { kind: 'prevSlide' }
	| { kind: 'nextSlide' }
	| { kind: 'endShow' }
	| { kind: 'lastViewed' }
	| { kind: 'customShow'; name: string; firstSlideIndex: number; returnAfter?: boolean }
	| { kind: 'openFile'; path: string }
	| { kind: 'openPresentation'; path: string };

/** A resolved mouse-click hyperlink/action, attachable to a shape or a text run. */
export interface WHyperlink {
	target: WHyperlinkKind;
	tooltip?: string;
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
	/** Run-level (`a:rPr/a:hlinkClick`) mouse-click hyperlink. */
	hyperlink?: WHyperlink;
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
	/** Shape-level (`p:cNvPr/a:hlinkClick`) mouse-click hyperlink/action. */
	hyperlink?: WHyperlink;
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

/**
 * An embedded OLE object's payload, wrapped as a classic "OLE Package"
 * object (see `ole-writer.ts`): `data` is the raw embedded file bytes
 * (`OlePptxElement.oleEmbeddedData`, decoded), `label` its display name.
 */
export interface WOleEmbed {
	data: Uint8Array;
	label: string;
}

/** A picture shape referencing an entry in the deck's picture list. */
export interface WPicture extends WShapeBase {
	kind: 'picture';
	pictureIndex: number;
	/** Set when this picture is really an OLE object's icon/preview. */
	ole?: WOleEmbed;
}

/** A group of shapes. */
export interface WGroup extends WShapeBase {
	kind: 'group';
	children: WAnyShape[];
}

/**
 * An embedded audio shape. `wavBytes` is the complete WAV file (RIFF header
 * included) written verbatim as the `SoundDataBlob` record (see
 * `media-writer.ts`'s doc comment): real PowerPoint's own 97-2003 SaveAs
 * never populates this record (COM-verified: `Shape.MediaFormat.Length`
 * reads back 0 even from a freshly-launched `PowerPoint.Application`), so
 * this writer exceeds PowerPoint's own exporter rather than matching its
 * (broken) output.
 */
export interface WMedia extends WShapeBase {
	kind: 'media';
	wavBytes: Uint8Array;
	/** Display name (`SoundNameAtom`); PowerPoint shows this in the sound picker. */
	soundName: string;
}

export type WAnyShape = WShape | WPicture | WGroup | WMedia;

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
