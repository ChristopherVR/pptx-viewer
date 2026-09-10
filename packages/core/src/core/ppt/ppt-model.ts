/**
 * Intermediate object model produced by the legacy .ppt parser and consumed
 * by the PPTX package writer.
 *
 * All coordinates are in EMU; all colors are hex RGB strings without '#'.
 *
 * @module ppt/ppt-model
 */

import type { PptColorScheme } from './color-scheme';
import type { PptHyperlinkTarget } from './hyperlink-target';
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
	/** Run-level (`MouseClickTextInteractiveInfoAtom`-anchored) hyperlink. */
	hyperlink?: PptHyperlinkTarget;
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
	/** Shape-level (`MouseClickInteractiveInfoContainer` in `OfficeArtClientData`) hyperlink. */
	actionClick?: PptHyperlinkTarget;
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

/**
 * A picture-frame shape whose `OfficeArtClientData` carries an `ExObjRefAtom`
 * pointing at a document-level OLE embed (`ExOleEmbedContainer` /
 * `ExOleObjStg`), the inverse of `writer/ole-writer.ts`. Keeps both the
 * picture-frame preview (same `pictureIndex` a plain `PptPicture` would use)
 * and a reference to the recovered embedded payload, resolved separately
 * into `PptDeck.oleEmbeds` (see `ole-embed-parser.ts`) since resolving it
 * needs async decompression while shape parsing itself stays synchronous.
 */
export interface PptOleObject extends PptShapeBase {
	kind: 'ole';
	/** Zero-based index into PptDeck.pictures (the picture-frame preview). */
	pictureIndex: number;
	/** `ExOleEmbedContainer`'s `exObjId`; keys `PptDeck.oleEmbeds`. */
	exObjId: number;
}

/** A group of shapes. */
export interface PptGroup extends PptShapeBase {
	kind: 'group';
	/** Child coordinate space rect in EMU-scaled group units. */
	childRect: EmuRect;
	children: PptAnyShape[];
}

/** Any drawable element. */
export type PptAnyShape = PptShape | PptPicture | PptOleObject | PptGroup;

/**
 * One resolved OLE embed's recovered storage, keyed by `exObjId` in
 * `PptDeck.oleEmbeds`.
 */
export interface PptOleEmbedData {
	/**
	 * Raw bytes recovered from the embed's `ExOleObjStg` (decompressed when
	 * the storage was compressed): the nested OLE2 compound file this
	 * project's own writer produces for every embed (see
	 * `writer/ole-writer.ts#buildPackageStorage`), or whatever a real
	 * PowerPoint-authored `.ppt` wrote there (e.g. a native `Excel.Sheet.8`
	 * storage). Written verbatim as the synthesized PPTX's OLE embedding
	 * part so the existing OOXML load pipeline
	 * (`PptxHandlerRuntimeLoadSession.ts`'s `unwrapOleEmbedding` call) does
	 * the actual "Package" unwrap once, in one place, instead of a second
	 * copy of that logic living here.
	 */
	data: Uint8Array;
	/** `ExOleEmbedContainer`'s `ProgIDAtom` string, when present. */
	progId?: string;
	/** The nested storage's root CLSID, formatted `XXXXXXXX-XXXX-...`, when recoverable. */
	clsId?: string;
}

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
	/** Resolved OLE embeds, keyed by `exObjId` (see `PptOleObject`). */
	oleEmbeds: Map<number, PptOleEmbedData>;
}

/** Raw outline/textbox text with unresolved style runs. */
export interface PptRawTextWithStyles {
	textType: number;
	text: string;
	styles?: PptStyleRuns;
}
