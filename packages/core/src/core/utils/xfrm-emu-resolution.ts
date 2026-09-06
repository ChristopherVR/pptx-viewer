/**
 * Pure decision helper for writing an `a:off` / `a:ext` (or `a:chOff` /
 * `a:chExt`) coordinate back to OpenXML on save.
 *
 * ## The problem
 *
 * Every element position/size is stored on the model in CSS pixels
 * (`PptxElementBase.x` / `y` / `width` / `height`), converted from EMU at
 * parse time via `Math.round(emu / EMU_PER_PX)`. Saving used to invert that
 * with `Math.round(px * EMU_PER_PX)`, which re-quantizes any EMU value that
 * was not an exact multiple of 9525: an untouched element's `a:off`/`a:ext`
 * could drift by up to +/-4762 EMU (half a pixel) on every load/save cycle
 * with no edit involved, purely from the round-trip through pixels.
 *
 * ## The fix
 *
 * Parsers additionally capture the ORIGINAL EMU integer alongside the
 * rounded pixel value (`PptxElementBase.xEmu` / `yEmu` / `widthEmu` /
 * `heightEmu`, mirroring the existing presentation-level `widthEmu` /
 * `heightEmu` naming). {@link resolveXfrmEmu} decides, per axis, whether the
 * element's current pixel value still agrees with that stored EMU: if so,
 * the exact original EMU is re-emitted (byte-identical `a:off`/`a:ext`); if
 * the model's pixel value has since diverged (the user moved or resized the
 * element, or a group/placeholder transform changed it), the stored EMU is
 * stale and the pixel value is re-quantized exactly as before.
 *
 * ## Why this is safe for clones and duplicates without any extra bookkeeping
 *
 * A duplicated or pasted element is typically cloned with its `xEmu` /
 * `yEmu` / `widthEmu` / `heightEmu` still intact (see `cloneElement` in
 * `clone-utils.ts`, which is a structural deep clone with no per-field
 * allowlist) and then has its `x` / `y` moved by the duplicate/paste
 * operation. That is exactly the "diverged" case above: once `x`/`y` change,
 * `Math.round(storedEmu / emuPerPx)` no longer equals the new pixel value,
 * so this function falls straight through to the freshly-computed
 * `px * emuPerPx` and the stale EMU is never written anywhere. A duplicate
 * placed at the IDENTICAL position (e.g. a same-position paste before the
 * caller offsets it) legitimately reuses the same EMU, which is correct: it
 * is, byte-for-byte, the same position. No explicit "clear the EMU fields on
 * clone" step is needed; the equality check is the whole guard.
 *
 * @module xfrm-emu-resolution
 */

/**
 * Resolve the EMU integer to write for one axis of a transform.
 *
 * @param px - The element's current value on this axis, in CSS pixels
 *   (`element.x` / `.y` / `.width` / `.height`).
 * @param storedEmu - The exact EMU integer this axis was parsed from, if
 *   any (`element.xEmu` / `.yEmu` / `.widthEmu` / `.heightEmu`). `undefined`
 *   for an SDK-created element, or one whose parser could not resolve an
 *   exact source (e.g. no usable `a:xfrm` at all).
 * @param emuPerPx - EMU per CSS pixel (`PptxHandlerRuntime.EMU_PER_PX`,
 *   always 9525 in this codebase, but threaded through rather than
 *   hardcoded so this stays a pure function of its inputs).
 * @returns `storedEmu` when it round-trips to the same pixel value the
 *   element currently reports (nothing has moved this axis since load);
 *   otherwise `Math.round(px * emuPerPx)`, the pre-existing re-quantized
 *   value.
 */
export function resolveXfrmEmu(
	px: number,
	storedEmu: number | undefined,
	emuPerPx: number,
): number {
	if (isXfrmEmuUnchanged(px, storedEmu, emuPerPx)) {
		return storedEmu as number;
	}
	return Math.round(px * emuPerPx);
}

/**
 * Whether `storedEmu` still agrees with the element's current pixel value on
 * this axis, i.e. whether {@link resolveXfrmEmu} would re-emit it verbatim.
 * Exposed separately (rather than inferring "unchanged" from
 * `resolveXfrmEmu`'s return value) so callers that need to gate a DIFFERENT
 * decision on "has this axis moved" - such as
 * `group-xfrm-preservation.ts` deciding whether a whole group's child space
 * can be preserved - have an unambiguous boolean instead of re-deriving it
 * from a value that could coincidentally match by other means.
 */
export function isXfrmEmuUnchanged(
	px: number,
	storedEmu: number | undefined,
	emuPerPx: number,
): boolean {
	return storedEmu !== undefined && Math.round(storedEmu / emuPerPx) === Math.round(px);
}
