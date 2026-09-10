/**
 * Reader-side counterpart to `writer/hyperlink-writer.ts`: parses the
 * document-level `ExObjListContainer` into a lookup table of raw hyperlink
 * strings, then classifies one `InteractiveInfoAtom` (`InteractiveInfoAtom`
 * field layout and enum values reused from the same COM-authored ground
 * truth the writer documents) into a `PptHyperlinkTarget`.
 *
 * @module ppt/hyperlink-parser
 */

import type { PptHyperlinkTarget } from './hyperlink-target';
import { findChild, iterateChildren, iterateRecords } from './record-stream';
import type { PptRecord } from './record-stream';
import { RT } from './record-types';
import { decodeTextChars } from './text/text-atoms';

/** One run-level hyperlink, anchored to a 0-based `[begin, end)` character range. */
export interface TextHyperlinkRange {
	begin: number;
	end: number;
	target: PptHyperlinkTarget;
}

/** Raw strings parsed from one `ExHyperlinkContainer`, keyed by `ExHyperlinkId`. */
export interface RawHyperlinkStrings {
	friendlyName?: string;
	/** `TargetAtom` (recInstance 1): external destination (URL, file path). */
	target?: string;
	/** `LocationAtom` (recInstance 3): same-file destination (slide/custom show). */
	location?: string;
}

/** [MS-PPT] LinkToEnum values this reader understands (mirrors the writer's `LT`). */
const LT = {
	customShow: 0x06,
	slideNumber: 0x07,
	url: 0x08,
	otherPresentation: 0x09,
	otherFile: 0x0a,
} as const;

/** [MS-PPT] InteractiveInfoActionEnum values this reader understands. */
const II_ACTION = {
	jumpAction: 0x03,
	hyperlinkAction: 0x04,
	customShowAction: 0x07,
} as const;

/** The six relative-jump `PptHyperlinkTarget` kinds (no fields beyond `kind`). */
type JumpKind = 'nextSlide' | 'prevSlide' | 'firstSlide' | 'lastSlide' | 'lastViewed' | 'endShow';

/** [MS-PPT] InteractiveInfoJumpEnum values this reader understands. */
const II_JUMP: Record<number, JumpKind> = {
	0x01: 'nextSlide',
	0x02: 'prevSlide',
	0x03: 'firstSlide',
	0x04: 'lastSlide',
	0x05: 'lastViewed',
	0x06: 'endShow',
};

function readCString(view: DataView, rec: PptRecord): string {
	return decodeTextChars(view, rec.dataOffset, rec.recLen);
}

/** Parse one `ExHyperlinkContainer` into its raw id + strings. */
function parseExHyperlinkContainer(
	view: DataView,
	container: PptRecord,
): { id: number; strings: RawHyperlinkStrings } | undefined {
	const atom = findChild(view, container, RT.ExternalHyperlinkAtom);
	if (!atom || atom.recLen < 4) {
		return undefined;
	}
	const id = view.getUint32(atom.dataOffset, true);
	const strings: RawHyperlinkStrings = {};
	for (const child of iterateChildren(view, container)) {
		if (child.recType !== RT.CString) {
			continue;
		}
		if (child.recInstance === 0) {
			strings.friendlyName = readCString(view, child);
		} else if (child.recInstance === 1) {
			strings.target = readCString(view, child);
		} else if (child.recInstance === 3) {
			strings.location = readCString(view, child);
		}
	}
	return { id, strings };
}

/**
 * Parse the document-level `ExObjListContainer`, if present, into a lookup
 * table of raw hyperlink strings keyed by `ExHyperlinkId`. Non-hyperlink
 * `ExObjListSubContainer` entries (media, OLE, ActiveX) are skipped here;
 * they are read elsewhere.
 */
export function parseHyperlinkStrings(
	view: DataView,
	docContainer: PptRecord,
): Map<number, RawHyperlinkStrings> {
	const result = new Map<number, RawHyperlinkStrings>();
	const exObjList = findChild(view, docContainer, RT.ExternalObjectList);
	if (!exObjList) {
		return result;
	}
	for (const child of iterateChildren(view, exObjList)) {
		if (child.recType !== RT.ExternalHyperlink) {
			continue;
		}
		const parsed = parseExHyperlinkContainer(view, child);
		if (parsed) {
			result.set(parsed.id, parsed.strings);
		}
	}
	return result;
}

/** Parse `"<slideId>,<1-based number>,"` (see `hyperlink-writer.ts`'s ground truth). */
function parseSlideLocation(location: string | undefined): number | undefined {
	if (!location) {
		return undefined;
	}
	const match = /^\d+,(\d+),$/u.exec(location);
	return match ? Number.parseInt(match[1], 10) - 1 : undefined;
}

/**
 * Resolve one `InteractiveInfoAtom`'s 16 data bytes (immediately following
 * its 8-byte record header, i.e. `atomRec.dataOffset`) into a
 * `PptHyperlinkTarget`, or `undefined` for `II_NoAction`/`II_OLEAction`/
 * `II_MacroAction`/`II_RunProgramAction`/`II_MediaAction` (handled
 * elsewhere, or with no `.ppt` hyperlink-target equivalent here).
 */
export function resolveInteractiveInfoTarget(
	view: DataView,
	atomRec: PptRecord,
	hyperlinkStrings: Map<number, RawHyperlinkStrings>,
): PptHyperlinkTarget | undefined {
	if (atomRec.recLen < 16) {
		return undefined;
	}
	const exHyperlinkIdRef = view.getUint32(atomRec.dataOffset + 4, true);
	const action = view.getUint8(atomRec.dataOffset + 8);
	const jump = view.getUint8(atomRec.dataOffset + 10);
	const hyperlinkType = view.getUint8(atomRec.dataOffset + 12);

	if (action === II_ACTION.jumpAction) {
		return II_JUMP[jump] ? { kind: II_JUMP[jump] } : undefined;
	}
	if (action !== II_ACTION.hyperlinkAction && action !== II_ACTION.customShowAction) {
		return undefined;
	}
	const strings = hyperlinkStrings.get(exHyperlinkIdRef);
	if (!strings) {
		return undefined;
	}
	switch (hyperlinkType) {
		case LT.url:
			return strings.target ? { kind: 'url', url: strings.target } : undefined;
		case LT.slideNumber: {
			const slideIndex = parseSlideLocation(strings.location);
			return slideIndex !== undefined ? { kind: 'slide', slideIndex } : undefined;
		}
		case LT.customShow:
			return strings.friendlyName ? { kind: 'customShow', name: strings.friendlyName } : undefined;
		case LT.otherFile:
			return strings.target ? { kind: 'openFile', path: strings.target } : undefined;
		case LT.otherPresentation:
			return strings.target ? { kind: 'openPresentation', path: strings.target } : undefined;
		default:
			return undefined;
	}
}

/**
 * Scan a flat record range (an `OfficeArtClientTextbox`'s data, the same
 * range `collectTextBodies` walks) for `(MouseClickInteractiveInfoContainer,
 * MouseClickTextInteractiveInfoAtom)` pairs trailing the text atoms: run-level
 * hyperlinks, the inverse of `text-atom-writer.ts#buildRunHyperlinks`.
 */
export function collectTextHyperlinkRanges(
	view: DataView,
	start: number,
	end: number,
	hyperlinkStrings: Map<number, RawHyperlinkStrings>,
): TextHyperlinkRange[] {
	const ranges: TextHyperlinkRange[] = [];
	let pendingTarget: PptHyperlinkTarget | undefined;
	for (const rec of iterateRecords(view, start, end)) {
		if (rec.recType === RT.InteractiveInfo && rec.recInstance === 0) {
			const atom = findChild(view, rec, RT.InteractiveInfoAtom);
			pendingTarget = atom ? resolveInteractiveInfoTarget(view, atom, hyperlinkStrings) : undefined;
		} else if (rec.recType === RT.TextInteractiveInfoAtom && rec.recLen >= 8) {
			if (pendingTarget) {
				ranges.push({
					begin: view.getUint32(rec.dataOffset, true),
					end: view.getUint32(rec.dataOffset + 4, true),
					target: pendingTarget,
				});
			}
			pendingTarget = undefined;
		}
	}
	return ranges;
}

/**
 * Find the `InteractiveInfoAtom` child of a `MouseClickInteractiveInfoContainer`
 * (`RT.InteractiveInfo` with `recInstance === 0`) and resolve it.
 */
export function resolveShapeInteractiveInfo(
	view: DataView,
	clientData: PptRecord,
	hyperlinkStrings: Map<number, RawHyperlinkStrings>,
): PptHyperlinkTarget | undefined {
	for (const child of iterateChildren(view, clientData)) {
		if (child.recType === RT.InteractiveInfo && child.recInstance === 0) {
			const atom = findChild(view, child, RT.InteractiveInfoAtom);
			if (atom) {
				return resolveInteractiveInfoTarget(view, atom, hyperlinkStrings);
			}
		}
	}
	return undefined;
}
