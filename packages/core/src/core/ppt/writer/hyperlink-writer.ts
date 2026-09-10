/**
 * Binary `.ppt` hyperlink / click-action record writer: `InteractiveInfo`
 * (`InteractiveInfoAtom`) records attached to a shape's `OfficeArtClientData`
 * or a text run's `OfficeArtClientTextbox`, plus the document-level
 * `ExObjListContainer` of `ExHyperlinkContainer` records they reference.
 *
 * Field values (`InteractiveInfoActionEnum`, `InteractiveInfoJumpEnum`,
 * `LinkToEnum`) and the `LocationAtom` string formats for a specific-slide
 * jump and a custom-show jump are all confirmed against a COM-authored
 * ground-truth fixture (`PowerPoint.Application` COM automation building
 * shapes with every `ActionSettings(ppMouseClick)` variant, saved via
 * `Presentations.SaveAs(..., ppSaveAsPPT)` and inspected with this project's
 * own record reader): relative jumps (next/previous/first/last/end
 * show/last-viewed) need NO `ExHyperlinkContainer` at all (`exHyperlinkIdRef`
 * stays 0, `hyperlinkType` is `LT_Nil`); a URL and a specific-slide jump both
 * use `II_HyperlinkAction`, differing only in `hyperlinkType` (`LT_Url` vs
 * `LT_SlideNumber`) and whether a `LocationAtom` is present.
 *
 * @module ppt/writer/hyperlink-writer
 */

import { RT } from '../record-types';
import { ByteWriter, record } from './byte-writer';
import type { WHyperlink, WHyperlinkKind } from './write-model';

/** [MS-PPT] 2.6.10 InteractiveInfoActionEnum. */
const II_ACTION = {
	noAction: 0x00,
	jumpAction: 0x03,
	hyperlinkAction: 0x04,
	customShowAction: 0x07,
} as const;

/** [MS-PPT] InteractiveInfoJumpEnum. */
const II_JUMP = {
	noJump: 0x00,
	nextSlide: 0x01,
	previousSlide: 0x02,
	firstSlide: 0x03,
	lastSlide: 0x04,
	lastSlideViewed: 0x05,
	endShow: 0x06,
} as const;

/** [MS-PPT] LinkToEnum. */
const LT = {
	customShow: 0x06,
	slideNumber: 0x07,
	url: 0x08,
	otherPresentation: 0x09,
	otherFile: 0x0a,
	nil: 0xff,
} as const;

/** `InteractiveInfoAtom.flags` bit C: `fCustomShowReturn`. */
const FLAG_CUSTOM_SHOW_RETURN = 0x04;

/** One registered hyperlink target, keyed by its allocated `ExHyperlinkId`. */
interface HyperlinkEntry {
	id: number;
	kind: WHyperlinkKind;
}

/**
 * Accumulates every hyperlink target referenced anywhere in the deck (shape
 * actions and text-run actions, across every slide and the master), so
 * `layoutDocumentStream` can emit one document-level `ExObjListContainer`
 * once every slide has been built. `ExHyperlinkId` is a simple incrementing
 * counter: PowerPoint's own writer does not deduplicate identical targets
 * either (confirmed in the ground-truth fixture: the same URL used on two
 * shapes got two distinct ids and two distinct `ExHyperlinkContainer`
 * records), so this doesn't either.
 */
export class HyperlinkCollector {
	private entries: HyperlinkEntry[] = [];
	private nextHyperlinkId = 1;

	/**
	 * Allocate a new id from the SAME counter hyperlinks use. `ExObjId` and
	 * `ExHyperlinkId` are documented as sharing one id space (the
	 * `ExObjListAtom.exObjIdSeed` doc requires a seed at or above the
	 * largest value of EITHER kind), so `ole-writer.ts`'s `OleCollector`
	 * allocates OLE `exObjId`s through this same method rather than keeping
	 * a second counter that could collide with a hyperlink id.
	 */
	public allocateId(): number {
		return this.nextHyperlinkId++;
	}

	/** Register a target, returning its newly allocated `ExHyperlinkId`. */
	public register(kind: WHyperlinkKind): number {
		const id = this.allocateId();
		this.entries.push({ id, kind });
		return id;
	}

	/** Every registered entry, in registration order. */
	public get all(): readonly HyperlinkEntry[] {
		return this.entries;
	}

	/** Whether anything was registered (an empty deck omits the ExObjList entirely). */
	public get isEmpty(): boolean {
		return this.entries.length === 0;
	}

	/** The next id `allocateId` would hand out, i.e. one past the highest allocated so far. */
	public peekNextId(): number {
		return this.nextHyperlinkId;
	}
}

function buildCString(text: string, recInstance: number): Uint8Array {
	return record(RT.CString, new ByteWriter().utf16(text).toBytes(), recInstance, false, 0);
}

/** Build the (12-byte) `ExHyperlinkAtom` referencing `id`. */
function buildExHyperlinkAtom(id: number): Uint8Array {
	return record(RT.ExternalHyperlinkAtom, new ByteWriter().u32(id).toBytes(), 0, false, 0);
}

/**
 * Build one `ExHyperlinkContainer`: `exHyperlinkAtom` plus a
 * `friendlyNameAtom` (recInstance 0) and either a `targetAtom` (recInstance
 * 1, external target) or a `locationAtom` (recInstance 3, same-file target)
 * depending on the kind. `firstSlide`/`lastSlide`/`prevSlide`/`nextSlide`/
 * `endShow`/`lastViewed` never reach here: `buildInteractiveInfo` below
 * resolves those with no `ExHyperlinkContainer` at all.
 */
export function buildExHyperlinkContainer(id: number, kind: WHyperlinkKind): Uint8Array {
	const w = new ByteWriter().bytes(buildExHyperlinkAtom(id));
	switch (kind.kind) {
		case 'url':
			w.bytes(buildCString(kind.url, 0)).bytes(buildCString(kind.url, 1));
			break;
		case 'openFile':
		case 'openPresentation':
			w.bytes(buildCString(kind.path, 0)).bytes(buildCString(kind.path, 1));
			break;
		case 'slide': {
			// Ground truth: friendlyName = "Slide <1-based number>", location =
			// "<slideId>,<1-based number>," where slideId = 256 + slideIndex
			// (this writer's own SlidePersistAtom.slideId convention, see
			// `slide-writer.ts`).
			const number = kind.slideIndex + 1;
			const slideId = 256 + kind.slideIndex;
			w.bytes(buildCString(`Slide ${number}`, 0)).bytes(buildCString(`${slideId},${number},`, 3));
			break;
		}
		case 'customShow': {
			// Ground truth: friendlyName = the show's name, location =
			// "<1-based first-slide NUMBER>,0,<name>" (NOT the slide id: distinct
			// from the plain slide-jump format above).
			const number = kind.firstSlideIndex + 1;
			w.bytes(buildCString(kind.name, 0)).bytes(buildCString(`${number},0,${kind.name}`, 3));
			break;
		}
		default:
			break;
	}
	return record(RT.ExternalHyperlink, w.toBytes(), 0, true);
}

/** Classify one `WHyperlinkKind` into its `InteractiveInfoAtom` field values. */
function classify(kind: WHyperlinkKind): {
	action: number;
	jump: number;
	hyperlinkType: number;
	needsHyperlink: boolean;
} {
	switch (kind.kind) {
		case 'nextSlide':
			return {
				action: II_ACTION.jumpAction,
				jump: II_JUMP.nextSlide,
				hyperlinkType: LT.nil,
				needsHyperlink: false,
			};
		case 'prevSlide':
			return {
				action: II_ACTION.jumpAction,
				jump: II_JUMP.previousSlide,
				hyperlinkType: LT.nil,
				needsHyperlink: false,
			};
		case 'firstSlide':
			return {
				action: II_ACTION.jumpAction,
				jump: II_JUMP.firstSlide,
				hyperlinkType: LT.nil,
				needsHyperlink: false,
			};
		case 'lastSlide':
			return {
				action: II_ACTION.jumpAction,
				jump: II_JUMP.lastSlide,
				hyperlinkType: LT.nil,
				needsHyperlink: false,
			};
		case 'endShow':
			return {
				action: II_ACTION.jumpAction,
				jump: II_JUMP.endShow,
				hyperlinkType: LT.nil,
				needsHyperlink: false,
			};
		case 'lastViewed':
			return {
				action: II_ACTION.jumpAction,
				jump: II_JUMP.lastSlideViewed,
				hyperlinkType: LT.nil,
				needsHyperlink: false,
			};
		case 'slide':
			return {
				action: II_ACTION.hyperlinkAction,
				jump: II_JUMP.noJump,
				hyperlinkType: LT.slideNumber,
				needsHyperlink: true,
			};
		case 'url':
			return {
				action: II_ACTION.hyperlinkAction,
				jump: II_JUMP.noJump,
				hyperlinkType: LT.url,
				needsHyperlink: true,
			};
		case 'openFile':
			return {
				action: II_ACTION.hyperlinkAction,
				jump: II_JUMP.noJump,
				hyperlinkType: LT.otherFile,
				needsHyperlink: true,
			};
		case 'openPresentation':
			return {
				action: II_ACTION.hyperlinkAction,
				jump: II_JUMP.noJump,
				hyperlinkType: LT.otherPresentation,
				needsHyperlink: true,
			};
		case 'customShow':
			return {
				action: II_ACTION.customShowAction,
				jump: II_JUMP.noJump,
				hyperlinkType: LT.customShow,
				needsHyperlink: true,
			};
		default:
			return {
				action: II_ACTION.noAction,
				jump: II_JUMP.noJump,
				hyperlinkType: LT.nil,
				needsHyperlink: false,
			};
	}
}

/** Build the 16-byte `InteractiveInfoAtom`. */
function buildInteractiveInfoAtom(hyperlink: WHyperlink, exHyperlinkId: number): Uint8Array {
	const { action, jump, hyperlinkType } = classify(hyperlink.target);
	const flags =
		hyperlink.target.kind === 'customShow' && hyperlink.target.returnAfter
			? FLAG_CUSTOM_SHOW_RETURN
			: 0;
	const data = new ByteWriter()
		.u32(0) // soundIdRef: no click sound
		.u32(exHyperlinkId)
		.u8(action)
		.u8(0) // oleVerb: only meaningful for II_OLEAction
		.u8(jump)
		.u8(flags)
		.u8(hyperlinkType)
		.bytes(new Uint8Array(3)) // unused
		.toBytes();
	return record(RT.InteractiveInfoAtom, data, 0, false, 0);
}

/**
 * Build one `MouseClickInteractiveInfoContainer` for `hyperlink`, registering
 * its target with `collector` first when the kind needs an
 * `ExHyperlinkContainer` (everything except the six relative-jump kinds).
 */
export function buildInteractiveInfo(
	hyperlink: WHyperlink,
	collector: HyperlinkCollector,
): Uint8Array {
	const { needsHyperlink } = classify(hyperlink.target);
	const exHyperlinkId = needsHyperlink ? collector.register(hyperlink.target) : 0;
	return record(RT.InteractiveInfo, buildInteractiveInfoAtom(hyperlink, exHyperlinkId), 0, true);
}

/** Build the 8-byte `MouseClickTextInteractiveInfoAtom` anchoring the preceding InteractiveInfo to a text range. */
export function buildTextInteractiveInfoAtom(beginChar: number, endChar: number): Uint8Array {
	const data = new ByteWriter().u32(beginChar).u32(endChar).toBytes();
	return record(RT.TextInteractiveInfoAtom, data, 0, false, 0);
}
