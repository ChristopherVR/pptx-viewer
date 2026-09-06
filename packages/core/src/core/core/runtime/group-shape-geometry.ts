/**
 * Pure geometry helpers for parsing `<p:grpSp>` (ECMA-376 §19.3.1.45).
 *
 * These live outside the runtime mixin so they can be unit-tested against the
 * real production symbols (the mixin chain has a circular import when loaded
 * standalone), and so `PptxHandlerRuntimeGroupParsing` stays a thin
 * orchestrator.
 *
 * The one rule that drives all of this: a group declares TWO coordinate
 * systems. `a:off`/`a:ext` place the group in its PARENT's space, while
 * `a:chOff`/`a:chExt` declare the space its CHILDREN are authored in. A child
 * is therefore mapped as `parent + (child - chOff) * (ext / chExt)`, and a
 * group nested inside another group has to be mapped twice.
 */
import type { PptxElement } from '../../types';

/**
 * Maximum nesting depth for `p:grpSp` recursion (Load H1).
 *
 * PowerPoint itself does not document a hard limit, but legitimate decks
 * almost never nest more than a handful of levels (typical max < 10). This is
 * well above any plausible authoring use while still preventing stack-overflow
 * DoS from a maliciously deep group tree
 * (`<p:grpSp><p:grpSp>...</p:grpSp></p:grpSp>` chain).
 *
 * It deliberately matches `MAX_ELEMENT_DEPTH` in
 * `core/utils/flatten-elements.ts`, which every downstream walk (chart /
 * SmartArt / OLE / media-timing enrichment) is capped by. Parsing DEEPER than
 * the walkers descend would build a subtree nothing can ever enrich: a chart
 * below the walker cap would load with no data and no warning. The parser must
 * therefore never emit a tree the walkers cannot reach.
 */
export const MAX_GROUP_DEPTH = 32;

/** EMU values are int32 per ECMA-376 §22.1.2.4. Clamp parsed values to this range. */
const INT32_MIN = -2_147_483_648;
const INT32_MAX = 2_147_483_647;

/**
 * Parse a string as a base-10 integer with a finite-number guard and an
 * int32 clamp. Used for attacker-controlled EMU values from XML attributes.
 * Returns 0 for malformed/non-finite inputs (matching previous fallback
 * behaviour from `parseInt(... || '0')` while rejecting `'1e308'` and
 * similar finite-overflow values).
 */
export function parseEmuInt(value: unknown): number {
	const parsed = parseInt(String(value ?? ''), 10);
	if (!Number.isFinite(parsed)) {
		return 0;
	}
	if (parsed < INT32_MIN) {
		return INT32_MIN;
	}
	if (parsed > INT32_MAX) {
		return INT32_MAX;
	}
	return parsed;
}

/** The two coordinate systems a `p:grpSpPr/a:xfrm` declares, in pixels. */
export interface GroupTransform {
	/** Group position/size in the PARENT coordinate space. */
	readonly parentX: number;
	readonly parentY: number;
	readonly parentW: number;
	readonly parentH: number;
	/**
	 * The exact EMU integers `parentX`/`parentY`/`parentW`/`parentH` were
	 * parsed from (the group's own `a:off`/`a:ext`), for `resolveXfrmEmu`
	 * (`xfrm-emu-resolution.ts`) to re-emit byte-identical on save when the
	 * group has not moved/resized. `0` when the corresponding node is absent,
	 * mirroring the `0` default of the pixel fields above.
	 */
	readonly parentXEmu: number;
	readonly parentYEmu: number;
	readonly parentWEmu: number;
	readonly parentHEmu: number;
	/** Origin/extent of the space the group's CHILDREN are authored in. */
	readonly chX: number;
	readonly chY: number;
	readonly chW: number;
	readonly chH: number;
	/**
	 * The exact EMU integers `chX`/`chY`/`chW`/`chH` were parsed from (the
	 * group's own `a:chOff`/`a:chExt`), for `group-xfrm-preservation.ts` to
	 * decide whether an unmodified group can re-emit them byte-identical.
	 * `0` when the corresponding node is absent, mirroring `chX`/etc's `0`
	 * default above (a caller that cares about "was `a:chOff`/`a:chExt`
	 * actually present" should also check `chW`/`chH` for `> 0`, the same
	 * convention `parentWEmu`/`parentHEmu` already use).
	 */
	readonly chOffXEmu: number;
	readonly chOffYEmu: number;
	readonly chExtWEmu: number;
	readonly chExtHEmu: number;
	/** `ext / chExt`, i.e. how much the group squeezes its child space. */
	readonly scaleX: number;
	readonly scaleY: number;
	/** Degrees; `undefined` when absent or zero. */
	readonly rotation: number | undefined;
	readonly flipHorizontal: boolean;
	readonly flipVertical: boolean;
}

/** Minimal structural view of the parsed-XML nodes this module reads. */
type XmlNode = { readonly [key: string]: unknown };

function attr(node: unknown, name: string): unknown {
	return node && typeof node === 'object' ? (node as XmlNode)[name] : undefined;
}

function child(node: unknown, name: string): unknown {
	return node && typeof node === 'object' ? (node as XmlNode)[name] : undefined;
}

function parseBooleanAttr(value: unknown): boolean {
	const normalized = String(value ?? '')
		.trim()
		.toLowerCase();
	return normalized === '1' || normalized === 'true';
}

/**
 * Read a group's `a:xfrm` into UNROUNDED pixels.
 *
 * Rounding here is a bug, not a nicety: a themed background often uses a
 * compact child coordinate space (a `chExt` of a few thousand EMU for a
 * full-slide group), and rounding `chExt`/child offsets to whole pixels
 * collapses them to 0, which both zeroes the child geometry and makes the
 * scale silently fall back to 1. Float math keeps `parentExt / chExt`
 * accurate whatever the units. Callers that need integers round at the very
 * end, once.
 */
export function readGroupTransform(xfrm: unknown, emuPerPx: number): GroupTransform {
	let parentX = 0,
		parentY = 0,
		parentW = 0,
		parentH = 0;
	let parentXEmu = 0,
		parentYEmu = 0,
		parentWEmu = 0,
		parentHEmu = 0;
	let chX = 0,
		chY = 0,
		chW = 0,
		chH = 0;
	let chOffXEmu = 0,
		chOffYEmu = 0,
		chExtWEmu = 0,
		chExtHEmu = 0;
	let rotation: number | undefined;
	let flipHorizontal = false;
	let flipVertical = false;

	if (xfrm) {
		const off = child(xfrm, 'a:off');
		if (off) {
			parentXEmu = parseEmuInt(attr(off, '@_x'));
			parentYEmu = parseEmuInt(attr(off, '@_y'));
			parentX = parentXEmu / emuPerPx;
			parentY = parentYEmu / emuPerPx;
		}
		const ext = child(xfrm, 'a:ext');
		if (ext) {
			parentWEmu = parseEmuInt(attr(ext, '@_cx'));
			parentHEmu = parseEmuInt(attr(ext, '@_cy'));
			parentW = parentWEmu / emuPerPx;
			parentH = parentHEmu / emuPerPx;
		}
		const chOff = child(xfrm, 'a:chOff');
		if (chOff) {
			chOffXEmu = parseEmuInt(attr(chOff, '@_x'));
			chOffYEmu = parseEmuInt(attr(chOff, '@_y'));
			chX = chOffXEmu / emuPerPx;
			chY = chOffYEmu / emuPerPx;
		}
		const chExt = child(xfrm, 'a:chExt');
		if (chExt) {
			chExtWEmu = parseEmuInt(attr(chExt, '@_cx'));
			chExtHEmu = parseEmuInt(attr(chExt, '@_cy'));
			chW = chExtWEmu / emuPerPx;
			chH = chExtHEmu / emuPerPx;
		}
		// `@_rot` is 60000ths of a degree (ECMA-376 ST_Angle).
		const rot = attr(xfrm, '@_rot');
		if (rot !== undefined && rot !== null) {
			const degrees = parseInt(String(rot), 10) / 60000;
			rotation = Number.isFinite(degrees) && degrees !== 0 ? degrees : undefined;
		}
		flipHorizontal = parseBooleanAttr(attr(xfrm, '@_flipH'));
		flipVertical = parseBooleanAttr(attr(xfrm, '@_flipV'));
	}

	return {
		parentX,
		parentY,
		parentW,
		parentH,
		parentXEmu,
		parentYEmu,
		parentWEmu,
		parentHEmu,
		chX,
		chY,
		chW,
		chH,
		chOffXEmu,
		chOffYEmu,
		chExtWEmu,
		chExtHEmu,
		scaleX: chW > 0 ? parentW / chW : 1,
		scaleY: chH > 0 ? parentH / chH : 1,
		rotation,
		flipHorizontal,
		flipVertical,
	};
}

/**
 * Scale an element's geometry in place WITHOUT moving its origin, recursing
 * into a nested group's children.
 *
 * A nested group stores its children relative to its own origin, so when the
 * outer group squeezes its child space those relative coordinates have to be
 * squeezed too. Skipping the recursion leaves the wrapper resized but its
 * contents at their original size, which is how a nested group renders as an
 * exploded pile of shapes spilling outside its own box.
 */
export function scaleElementSubtree(el: PptxElement, scaleX: number, scaleY: number): void {
	el.x *= scaleX;
	el.y *= scaleY;
	el.width *= scaleX;
	el.height *= scaleY;
	if (el.type === 'group') {
		for (const nested of el.children) {
			scaleElementSubtree(nested, scaleX, scaleY);
		}
	}
}

/**
 * Map one child of a group from the group's child coordinate space into the
 * group's parent space, in place.
 *
 * Text and stroke widths are deliberately NOT scaled. `a:chOff` / `a:chExt`
 * define an arbitrary coordinate space for child GEOMETRY, while font sizes
 * and `a:ln/@w` remain absolute measurements. A real deck uses a 1,710-unit
 * child space inside a 1,085,850-EMU group; multiplying its authored 8 px
 * connector stroke by that 635x coordinate ratio turns three curved lines
 * into slide-height black bars. The same rule already keeps grouped text at
 * its authored point size (issue #131 slide 3).
 */
export function transformGroupChild(el: PptxElement, t: GroupTransform): void {
	const relativeX = el.x - t.chX;
	const relativeY = el.y - t.chY;
	el.x = t.parentX + relativeX * t.scaleX;
	el.y = t.parentY + relativeY * t.scaleY;
	el.width *= t.scaleX;
	el.height *= t.scaleY;

	if (el.type === 'group') {
		// The wrapper itself has just been placed; its children are stored
		// relative to it, so they take the scale but not the offset.
		for (const nested of el.children) {
			scaleElementSubtree(nested, t.scaleX, t.scaleY);
		}
	}
}
