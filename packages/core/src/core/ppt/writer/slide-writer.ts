/**
 * Slide / MainMaster container writer, the inverse of `slide-parser.ts`.
 *
 * @module ppt/writer/slide-writer
 */

import { RT } from '../record-types';
import { ByteWriter, record } from './byte-writer';
import { buildColorSchemeAtom } from './color-scheme-writer';
import { buildDrawing } from './drawing-writer';
import { buildMasterTextStyles } from './master-text-styles-writer';
import type { WRect, WSlide } from './write-model';

const SLIDE_FLAG_MASTER_OBJECTS = 0x0001;
const SLIDE_FLAG_MASTER_SCHEME = 0x0002;
const SLIDE_FLAG_MASTER_BACKGROUND = 0x0004;

/**
 * A real (COM-written) slide's `SlideAtom.masterIdRef` is NOT the master's
 * persist id: this deck's only master is persist id 2, yet every slide's
 * own `SlideAtom` carries this exact sentinel (`0x80000000`) instead.
 * Writing the actual persist id there (this writer's earlier, more
 * "logical" but wrong assumption) failed real PowerPoint's Office File
 * Validation outright, confirmed fixed by COM re-verification; PowerPoint
 * evidently resolves a slide's master by a different path (its layout, or
 * simply the deck's one master) and treats a small persist-id-shaped value
 * here as invalid. The MAIN MASTER's own leading `SlideAtom` is unaffected:
 * it genuinely writes 0 there (verified against the same file).
 */
const SLIDE_MASTER_ID_SENTINEL = 0x80000000;

function buildSlideAtomRaw(
	geom: number,
	masterIdRef: number,
	notesIdRef: number,
	flags: number,
): Uint8Array {
	const data = new ByteWriter()
		.i32(geom)
		.bytes(new Uint8Array(8)) // SlideLayoutAtom.placeholderId[8]
		.u32(masterIdRef)
		.i32(notesIdRef)
		.u16(flags)
		.u16(0)
		.toBytes();
	return record(RT.SlideAtom, data, 0, false, 2);
}

function buildSlideAtom(
	masterIdRef: number,
	notesIdRef: number,
	hasOwnBackground: boolean,
): Uint8Array {
	let flags = SLIDE_FLAG_MASTER_OBJECTS | SLIDE_FLAG_MASTER_SCHEME;
	if (!hasOwnBackground) {
		flags |= SLIDE_FLAG_MASTER_BACKGROUND;
	}
	return buildSlideAtomRaw(0, masterIdRef, notesIdRef, flags);
}

/**
 * A real MainMaster's own leading SlideAtom carries only
 * `SLIDE_FLAG_MASTER_SCHEME` (a master following its OWN objects/background
 * would be nonsensical): verified against `sample-deck.ppt`, whose master
 * writes flags = 2, not the slide-shaped 7 this writer's earlier
 * `buildSlideAtom(0, 0, false)` call produced.
 */
function buildMasterSlideAtom(): Uint8Array {
	return buildSlideAtomRaw(0, 0, 0, SLIDE_FLAG_MASTER_SCHEME);
}

/**
 * Build a framed `Slide` container (RT.Slide) for one slide.
 */
export function buildSlideContainer(
	slide: WSlide,
	slideRect: WRect,
	_masterIdRef: number,
	notesIdRef: number,
	fonts: string[],
	drawingId: number,
): Uint8Array {
	const data = new ByteWriter()
		.bytes(buildSlideAtom(SLIDE_MASTER_ID_SENTINEL, notesIdRef, Boolean(slide.backgroundRgb)))
		.bytes(buildDrawing(slideRect, slide.shapes, slide.backgroundRgb, fonts, drawingId))
		.bytes(buildColorSchemeAtom())
		.toBytes();
	return record(RT.Slide, data, 0, true);
}

/**
 * Build a framed `MainMaster` container: leading SlideAtom, colour scheme,
 * decorative shapes and default title/body text styles.
 *
 * A real (COM-written) `MainMaster` starts with the SAME `RT.SlideAtom`
 * shape used by a `Slide` container (verified against `sample-deck.ppt`,
 * `ver=2 inst=0 len=24`, byte-identical in structure). Omitting it did not
 * trip up this project's own lenient importer, but real PowerPoint's Office
 * File Validation hard-rejected every `.ppt` this writer produced ("Office
 * has detected a problem with this file... cannot be opened", no repair
 * option) until this was added, confirmed fixed by COM re-verification.
 */
export function buildMainMasterContainer(slideRect: WRect, drawingId: number): Uint8Array {
	const data = new ByteWriter()
		.bytes(buildMasterSlideAtom())
		.bytes(buildDrawing(slideRect, [], undefined, [], drawingId))
		.bytes(buildColorSchemeAtom())
		.bytes(buildMasterTextStyles())
		.toBytes();
	return record(RT.MainMaster, data, 0, true);
}
