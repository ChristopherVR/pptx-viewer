/**
 * Force an inline SVG document to stretch non-uniformly to whatever box it is
 * placed in, matching OOXML's `<a:blipFill><a:stretch><a:fillRect/></a:stretch>`
 * semantics (the default, most common picture fill mode): the ENTIRE source
 * graphic maps onto the destination rectangle, distorting its aspect ratio if
 * the rectangle's doesn't match. There is no "letterbox to preserve aspect"
 * concept anywhere in OOXML's blipFill model.
 *
 * A raster bitmap has no notion of its own aspect-preserving behaviour, so
 * CSS `object-fit: fill` (paired with the `<a:srcRect>` crop transform every
 * binding's `getImageFitStyle` renders) already produces the correct
 * non-uniform stretch for it. An SVG referenced via `<img src="data:image/
 * svg+xml,...">` is different: unless its root element carries
 * `preserveAspectRatio="none"`, the SVG's OWN internal viewBox-to-viewport
 * mapping keeps the default `xMidYMid meet` (uniform scale, centred,
 * letterboxed) REGARDLESS of the outer `object-fit`/`transform` the `<img>`
 * carries, so a cropped or non-square-framed SVG picture renders squashed
 * into a smaller centred region instead of being stretched-then-cropped like
 * the equivalent raster bitmap. Verified in Chromium: identical `<img>` CSS
 * (`width/height:100%; object-fit:fill; transform: translate() scale()`)
 * given a raster vs. an SVG source with the same content produces a stretched
 * crop for the raster and a squashed, non-stretched render for the SVG,
 * until the SVG root is amended with `preserveAspectRatio="none"`.
 *
 * This rewrites (or inserts) `preserveAspectRatio="none"` on the FIRST `<svg`
 * tag found (the document root; XML/DOCTYPE prologues never match `<svg`), so
 * the fix is applied once, at load time, before the bytes become an
 * (opaque, unpatchable-later) `blob:`/`data:` URL. It leaves everything else
 * in the document untouched.
 */
const SVG_ROOT_TAG_RE = /<svg\b([^>]*)>/iu;
const PRESERVE_ASPECT_RATIO_ATTR_RE = /\spreserveAspectRatio\s*=\s*(?:"[^"]*"|'[^']*')/iu;

export function forceSvgStretchFill(svgText: string): string {
	const match = SVG_ROOT_TAG_RE.exec(svgText);
	if (!match) {
		return svgText;
	}
	const attrs = match[1];
	const nextAttrs = PRESERVE_ASPECT_RATIO_ATTR_RE.test(attrs)
		? attrs.replace(PRESERVE_ASPECT_RATIO_ATTR_RE, ' preserveAspectRatio="none"')
		: `${attrs} preserveAspectRatio="none"`;
	return `${svgText.slice(0, match.index)}<svg${nextAttrs}>${svgText.slice(match.index + match[0].length)}`;
}
