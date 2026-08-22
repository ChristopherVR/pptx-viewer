/**
 * Blip `a:fillOverlay` compositing: an SVG `feFlood`/`feBlend`/`feComposite`
 * chain that paints the overlay's resolved paint over an image, using the
 * authored blend mode, clipped to the image's own alpha so transparent PNG
 * regions never pick up a colour bleed.
 *
 * Split out of `image-effects.ts` (already at the file-size ceiling) so the
 * fill-overlay compositing stays a focused, independently testable module;
 * `image-effects.ts` only wires the two exports below into its existing
 * `getImageFilterCss` / `getImageSvgFilters` aggregate functions.
 *
 * Three overlay paint shapes composite (whichever core resolved onto
 * `PptxImageEffects.fillOverlay`):
 *   - `resolvedColor` (plain `a:solidFill`) -> a flat `feFlood`.
 *   - `resolvedGradient` (`a:gradFill`) -> an SVG paint server
 *     (`<linearGradient>`/`<radialGradient>`) rasterised into a self-contained
 *     `feImage` data URI sized to the element's own box.
 *   - `resolvedPattern` (`a:pattFill`) -> the same preset-pattern tile
 *     `fill-style.ts` already builds for CSS pattern fills, rasterised via
 *     `feImage` + `feTile` so it repeats across the element.
 * A picture overlay fill resolves to none of the three and is skipped here;
 * its raw XML still round-trips losslessly via `fillRawXml`.
 *
 * @module render/image-fill-overlay
 */
import type { PptxElement, PptxImageEffects } from 'pptx-viewer-core';
import { isImageLikeElement } from 'pptx-viewer-core';

import { getPatternTile } from './fill-style';

/** Stable SVG filter ID for a blip fill-overlay effect on an element. */
export function getImageFillOverlayFilterId(elementId: string): string {
	return `imgoverlay-${elementId}`;
}

/** Map an OOXML `a:fillOverlay/@blend` token to an SVG `feBlend` `mode`. */
function toFeBlendMode(blend: NonNullable<PptxImageEffects['fillOverlay']>['blend']): string {
	switch (blend) {
		case 'mult':
			return 'multiply';
		case 'screen':
			return 'screen';
		case 'darken':
			return 'darken';
		case 'lighten':
			return 'lighten';
		default:
			return 'normal';
	}
}

/** Get an element's image effects, or `undefined` for a non-image element. */
function getEffects(element: PptxElement): PptxImageEffects | undefined {
	return isImageLikeElement(element) ? element.imageEffects : undefined;
}

/**
 * Whether an element has a fill-overlay effect this module can composite
 * (i.e. core resolved the overlay to a colour, gradient, or preset pattern).
 */
export function hasImageFillOverlayEffect(element: PptxElement): boolean {
	const overlay = getEffects(element)?.fillOverlay;
	return Boolean(
		overlay?.resolvedColor ||
		(overlay?.resolvedGradient && overlay.resolvedGradient.stops.length > 0) ||
		overlay?.resolvedPattern,
	);
}

/** Escape a string for safe use inside an XML/SVG attribute value. */
function escapeXmlAttr(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/** Build a self-contained `data:image/svg+xml,...` URI from raw SVG markup. */
function toSvgDataUri(svgMarkup: string): string {
	return `data:image/svg+xml,${encodeURIComponent(svgMarkup)}`;
}

/**
 * Build a `<linearGradient>`/`<radialGradient>` + full-box `<rect>` SVG
 * document sized to `width` x `height`, encoded as a `feImage` data URI. This
 * is the "SVG paint server" the overlay's gradient composites through: a
 * `feFlood` can only paint a flat colour, so a gradient overlay is rasterised
 * into an image once and fed into the same flood -> blend -> clip chain via
 * `feImage` in place of `feFlood`.
 */
function buildGradientOverlayDataUri(
	gradient: NonNullable<PptxImageEffects['fillOverlay']>['resolvedGradient'],
	width: number,
	height: number,
): string | undefined {
	if (!gradient || gradient.stops.length === 0) {
		return undefined;
	}
	const stopsMarkup = gradient.stops
		.map((stop) => {
			const opacity = typeof stop.opacity === 'number' ? stop.opacity : 1;
			return `<stop offset="${Math.round(stop.position * 1000) / 10}%" stop-color="${escapeXmlAttr(stop.color)}" stop-opacity="${opacity}"/>`;
		})
		.join('');

	let gradientDef: string;
	if (gradient.type === 'radial') {
		gradientDef = `<radialGradient id="g" cx="50%" cy="50%" r="70.7%">${stopsMarkup}</radialGradient>`;
	} else {
		const angle = gradient.angle ?? 0;
		const radians = (angle * Math.PI) / 180;
		// Project a unit vector at `angle` (OOXML: 0 = left-to-right, clockwise)
		// onto the gradient line endpoints, in the SVG `objectBoundingBox` 0-1 space.
		const dx = Math.cos(radians) / 2;
		const dy = Math.sin(radians) / 2;
		const x1 = 0.5 - dx;
		const y1 = 0.5 - dy;
		const x2 = 0.5 + dx;
		const y2 = 0.5 + dy;
		gradientDef = `<linearGradient id="g" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stopsMarkup}</linearGradient>`;
	}

	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
		`<defs>${gradientDef}</defs>` +
		`<rect width="${width}" height="${height}" fill="url(#g)"/>` +
		'</svg>';
	return toSvgDataUri(svg);
}

/**
 * Build a preset-pattern tile SVG document (reusing `fill-style.ts`'s
 * `getPatternTile`), encoded as a `feImage` data URI. Returned alongside the
 * tile's own pixel size so the caller can `feTile` it across the element.
 */
function buildPatternOverlayTile(
	pattern: NonNullable<PptxImageEffects['fillOverlay']>['resolvedPattern'],
): { dataUri: string; width: number; height: number } | undefined {
	if (!pattern) {
		return undefined;
	}
	const tile = getPatternTile(
		pattern.preset,
		pattern.foreground ?? '#000000',
		pattern.background ?? '#ffffff',
	);
	if (!tile) {
		return undefined;
	}
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tile.w}" height="${tile.h}">${tile.inner}</svg>`;
	return { dataUri: toSvgDataUri(svg), width: tile.w, height: tile.h };
}

/**
 * Build the inner `<filter>` markup compositing a fill-overlay paint over an
 * image: paint the overlay (flat colour flood, rasterised gradient, or tiled
 * pattern), blend it with the source using the authored mode, then clip the
 * result to the source's own alpha so transparent regions are never painted.
 *
 * @param width  Element width in px, used to size a gradient/pattern paint server.
 * @param height Element height in px, used to size a gradient/pattern paint server.
 * @returns The markup, or `undefined` when there is no resolved overlay paint.
 */
function buildImageFillOverlayFilterMarkup(
	effects: PptxImageEffects,
	width: number,
	height: number,
): string | undefined {
	const overlay = effects.fillOverlay;
	if (!overlay) {
		return undefined;
	}
	const mode = toFeBlendMode(overlay.blend);
	const w = Math.max(width, 1);
	const h = Math.max(height, 1);

	let paintMarkup: string | undefined;
	if (overlay.resolvedColor) {
		const opacity = typeof overlay.resolvedOpacity === 'number' ? overlay.resolvedOpacity : 1;
		paintMarkup = `<feFlood flood-color="${overlay.resolvedColor}" flood-opacity="${opacity}" result="fillOverlayFlood"/>`;
	} else if (overlay.resolvedGradient) {
		const dataUri = buildGradientOverlayDataUri(overlay.resolvedGradient, w, h);
		const uriAttr = dataUri ? escapeXmlAttr(dataUri) : '';
		paintMarkup = dataUri
			? `<feImage href="${uriAttr}" xlink:href="${uriAttr}" x="0" y="0" width="${w}" height="${h}" result="fillOverlayFlood"/>`
			: undefined;
	} else if (overlay.resolvedPattern) {
		const tile = buildPatternOverlayTile(overlay.resolvedPattern);
		const uriAttr = tile ? escapeXmlAttr(tile.dataUri) : '';
		paintMarkup = tile
			? `<feImage href="${uriAttr}" xlink:href="${uriAttr}" x="0" y="0" width="${tile.width}" height="${tile.height}" result="fillOverlayTile"/>` +
				'<feTile in="fillOverlayTile" result="fillOverlayFlood"/>'
			: undefined;
	}

	if (!paintMarkup) {
		return undefined;
	}
	return (
		`${paintMarkup}<feBlend in="fillOverlayFlood" in2="SourceGraphic" mode="${mode}" result="fillOverlayBlended"/>` +
		'<feComposite in="fillOverlayBlended" in2="SourceGraphic" operator="in"/>'
	);
}

/**
 * Fill-overlay SVG filter for an image element.
 *
 * @returns The filter `id`, its `cssReference` (`url(#id)`), and the inner
 *          `filterMarkup`, or `undefined` when there is no resolved overlay
 *          colour to composite.
 */
export function getImageFillOverlayFilter(
	element: PptxElement,
	elementId: string = isImageLikeElement(element) ? element.id : '',
): { id: string; cssReference: string; filterMarkup: string } | undefined {
	const effects = getEffects(element);
	if (!effects) {
		return undefined;
	}
	const markup = buildImageFillOverlayFilterMarkup(effects, element.width, element.height);
	if (!markup) {
		return undefined;
	}
	const id = getImageFillOverlayFilterId(elementId);
	return { id, cssReference: `url(#${id})`, filterMarkup: markup };
}
