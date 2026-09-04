/**
 * `a:hlinkClick`/`a:hlinkMouseOver`'s `@tgtFrame`: the browser frame/window a
 * text-run hyperlink opens into (the old Action Settings "Hyperlink to" >
 * frame-target field, a holdover from when Office authored HTML frameset
 * navigation).
 *
 * Parsed onto `TextStyle.hyperlinkTargetFrame` and round-tripped correctly,
 * but never read by any binding's `<a>` render: every binding hardcodes
 * `target="_blank" rel="noopener noreferrer"` regardless of what the deck
 * authored. This is the one decision (map an authored frame name onto the
 * `target`/`rel` an anchor should actually carry) every binding's hyperlink
 * render now consults instead of hardcoding.
 *
 * @module render/hyperlink-target
 */

/** The `target`/`rel` an `<a>` should carry for a resolved hyperlink. */
export interface HyperlinkTargetAttrs {
	/** `<a target>` value. */
	target: string;
	/**
	 * `<a rel>` value. Empty for `_self`: the link replaces the current
	 * document, so there is no new browsing context to isolate with
	 * `noopener`/`noreferrer`.
	 */
	rel: string;
}

/** What every binding rendered before `tgtFrame` was read: open in a new tab, isolated. */
const DEFAULT_TARGET_ATTRS: HyperlinkTargetAttrs = { target: '_blank', rel: 'noopener noreferrer' };

/**
 * Resolve `tgtFrame` (`a:hlinkClick/@tgtFrame`, e.g. `_self`, `_parent`,
 * `_top`, or a named frame) to the `target`/`rel` an anchor should carry.
 *
 * Always returns a concrete pair, defaulting to `_blank` + `noopener
 * noreferrer` (today's hardcoded behaviour) when the deck authors no
 * `tgtFrame`, so a caller can apply the result unconditionally rather than
 * branching on whether the deck set one.
 */
export function resolveHyperlinkTargetAttrs(tgtFrame: string | undefined): HyperlinkTargetAttrs {
	const frame = tgtFrame?.trim();
	if (!frame) {
		return DEFAULT_TARGET_ATTRS;
	}
	return { target: frame, rel: frame === '_self' ? '' : 'noopener noreferrer' };
}
