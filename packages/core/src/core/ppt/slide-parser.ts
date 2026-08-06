/**
 * SlideContainer / MainMasterContainer parsing ([MS-PPT] 2.5).
 *
 * @module ppt/slide-parser
 */

import { findSchemeColors } from './color-scheme';
import type { PptColorScheme } from './color-scheme';
import { parseDrawing } from './escher/sp-container';
import type { DrawingContext } from './escher/sp-container';
import type { PptAnyShape, PptSlideModel } from './ppt-model';
import { findChild, findDescendant } from './record-stream';
import type { PptRecord } from './record-stream';
import { OA, RT } from './record-types';
import type { PptRawText } from './text/text-atoms';

const SLIDE_FLAG_MASTER_OBJECTS = 0x0001;
const SLIDE_FLAG_MASTER_SCHEME = 0x0002;
const SLIDE_FLAG_MASTER_BACKGROUND = 0x0004;

/** Inputs shared across slide parsing. */
export interface SlideParseInputs {
	view: DataView;
	data: Uint8Array;
	fonts: string[];
	masterScheme: PptColorScheme;
	/** Outline text for this slide from the SlideListWithText, if any. */
	outlineText: PptRawText[] | undefined;
}

/**
 * Parse a SlideContainer into the slide model.
 */
export function parseSlideContainer(inputs: SlideParseInputs, container: PptRecord): PptSlideModel {
	const { view, data, fonts } = inputs;

	// Slide flags govern master inheritance of scheme/background.
	let followMasterBackground = true;
	let followMasterScheme = true;
	let followMasterObjects = true;
	const slideAtom = findChild(view, container, RT.SlideAtom);
	if (slideAtom && slideAtom.recLen >= 24) {
		const flags = view.getUint16(slideAtom.dataOffset + 20, true);
		followMasterObjects = (flags & SLIDE_FLAG_MASTER_OBJECTS) !== 0;
		followMasterScheme = (flags & SLIDE_FLAG_MASTER_SCHEME) !== 0;
		followMasterBackground = (flags & SLIDE_FLAG_MASTER_BACKGROUND) !== 0;
	}

	const ownScheme = findSchemeColors(view, container);
	const scheme = followMasterScheme ? inputs.masterScheme : (ownScheme ?? inputs.masterScheme);

	const slide: PptSlideModel = { followMasterBackground, followMasterObjects, shapes: [] };

	const drawing = findChild(view, container, RT.Drawing);
	if (drawing) {
		const dgContainer = findDescendant(view, drawing, OA.DgContainer);
		if (dgContainer) {
			const ctx: DrawingContext = {
				view,
				data,
				scheme,
				fonts,
				rawOutlineText: inputs.outlineText,
			};
			const parsed = parseDrawing(ctx, dgContainer);
			slide.shapes = parsed.shapes;
			if (parsed.backgroundRgb !== undefined) {
				slide.backgroundRgb = parsed.backgroundRgb;
				slide.followMasterBackground = false;
			}
		}
	}

	return slide;
}

/** Result of parsing the main master. */
export interface ParsedMaster {
	scheme: PptColorScheme | undefined;
	backgroundRgb: string | undefined;
	shapes: PptAnyShape[];
	container: PptRecord;
}

/**
 * Parse the MainMasterContainer: color scheme, background and decorative
 * (non-placeholder) shapes.
 */
export function parseMasterContainer(
	view: DataView,
	data: Uint8Array,
	fonts: string[],
	fallbackScheme: PptColorScheme,
	container: PptRecord,
): ParsedMaster {
	const scheme = findSchemeColors(view, container);
	const active = scheme ?? fallbackScheme;

	let backgroundRgb: string | undefined;
	let shapes: PptAnyShape[] = [];
	const drawing = findChild(view, container, RT.Drawing);
	if (drawing) {
		const dgContainer = findDescendant(view, drawing, OA.DgContainer);
		if (dgContainer) {
			const ctx: DrawingContext = {
				view,
				data,
				scheme: active,
				fonts,
				rawOutlineText: undefined,
			};
			const parsed = parseDrawing(ctx, dgContainer);
			backgroundRgb = parsed.backgroundRgb;
			// Placeholder shapes on the master hold prompt text; skip them.
			shapes = parsed.shapes.filter(
				(shape) =>
					!(
						shape.kind === 'shape' &&
						(shape.placeholderType !== undefined || shape.text !== undefined)
					),
			);
		}
	}

	return { scheme, backgroundRgb, shapes, container };
}
