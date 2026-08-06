/**
 * Should this shape/picture outline be painted at all?
 *
 * OOXML allows a width-only line, e.g. `<a:ln w="12700"><a:miter .../></a:ln>`,
 * with no fill child and no `<p:style>/<a:lnRef>` reference. That leaves the
 * line FILL unspecified, and PowerPoint paints no outline for it (verified
 * against a PowerPoint render of the real-world media deck, whose photos all
 * carry exactly that markup: the pictures are frameless). Core parses it as
 * `strokeWidth > 0` with `strokeColor`/`strokeFillMode` both `undefined`, so a
 * renderer must treat the missing colour as "no line", never substitute a
 * default stroke colour: React did, and painted a dark 1px frame around every
 * such picture that no other binding (and not PowerPoint) draws.
 *
 * When a line has any fill source (an explicit `a:solidFill`, an averaged
 * gradient/pattern colour, or a colour resolved from the theme's `lnStyleLst`
 * via `a:lnRef`), core writes `strokeColor` (and `strokeFillMode`), and the
 * outline paints as before.
 */
export function hasStrokePaint(
	style: { strokeWidth?: number; strokeColor?: string; strokeFillMode?: string } | undefined,
): boolean {
	if (!style || Math.max(0, style.strokeWidth ?? 0) <= 0) {
		return false;
	}
	return style.strokeColor !== undefined || style.strokeFillMode !== undefined;
}

/**
 * The stroke width a renderer should paint: the parsed width when the line has
 * a fill source, `0` when it is a width-only (fill-less) line. Bindings that
 * gate their CSS border on `strokeWidth > 0` can substitute this directly.
 */
export function paintedStrokeWidth(
	style: { strokeWidth?: number; strokeColor?: string; strokeFillMode?: string } | undefined,
): number {
	return hasStrokePaint(style) ? Math.max(0, style?.strokeWidth ?? 0) : 0;
}
