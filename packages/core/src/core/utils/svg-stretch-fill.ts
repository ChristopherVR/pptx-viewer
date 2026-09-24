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
 *
 * This is applied UNCONDITIONALLY, not only when the picture has an
 * `<a:srcRect>` crop: PowerPoint's `a:stretch/a:fillRect` fill mode always
 * non-uniformly stretches the (possibly cropped) source onto the ENTIRE
 * destination frame, cropped or not, and it does this identically whether or
 * not the frame happens to have been resized to the crop's own aspect ratio.
 * Measured with COM automation (`PowerPoint.Application`) on 2026-09-25,
 * two independent ways:
 *
 * 1. The audit deck's own "SVG cropped" picture (`<a:srcRect l="40000"/>`,
 *    frame auto-shrunk by the crop tool to the cropped aspect ratio): the
 *    rendered PNG's visible pixels land within 1px of predicting a full
 *    non-uniform stretch of the kept 60%-wide source window across the
 *    ENTIRE (already-shrunk) frame width, not a same-scale clip (which would
 *    predict a very different, much narrower, offset window).
 * 2. A purpose-built deck with a 20%-left `<a:srcRect>` on a square SVG,
 *    exported once with the frame resized to the crop (150.5x200 -> the
 *    common "drag the crop handle" result) and once with the SAME crop but
 *    the frame left at its pre-crop size (200x200, the shape a hand-authored
 *    or round-tripped file, or `PictureFormat.CropLeft` set without also
 *    resizing, produces): both renders show the circle non-uniformly
 *    stretched to fill the frame (an undistorted smaller circle in the
 *    first case, a visibly widened ellipse in the second, because the SAME
 *    stretched proportion now covers a wider, unshrunk frame), never a
 *    same-scale clip that would leave blank space instead of stretching.
 *
 * A raster picture behaves the same way in both authoring shapes (its crop
 * is a plain, always-applied CSS transform with no frame-size branch
 * either), so this function's lack of a frame-size parameter is not a gap:
 * OOXML's fill model has no concept of "frame happens to match the crop" to
 * special-case, and forcing this unconditionally is what keeps SVG and
 * raster pictures behaving identically for any authored frame size.
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
