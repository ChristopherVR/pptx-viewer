/**
 * `a:blipFill/a:tile`: a picture painted as a repeating TEXTURE rather than one
 * stretched copy.
 *
 * ECMA-376 §20.1.8.58 gives the tile four independent knobs, all of which core
 * parses onto the element (`PptxHandlerRuntimePictureParsing` /
 * `PptxHandlerRuntimeShapeImageFill`):
 *
 *  - `@sx` / `@sy` - per-tile scale as a percentage of the source size.
 *  - `@tx` / `@ty` - the tile origin's offset (EMU; core converts to px).
 *  - `@algn`       - which point of the fill rectangle the tile grid is
 *                    anchored to (9 `ST_RectAlignment` values).
 *  - `@flip`       - mirror alternate tiles (`x` / `y` / `xy`).
 *
 * Only React rendered any of it; the other four bindings sent every picture
 * through `getImageFitStyle` and therefore drew a tiled texture (wood grain, a
 * hatch photo, a logo watermark) as ONE stretched copy. The logic is pure CSS
 * arithmetic with no framework in it, so it lives here and each binding only has
 * to pick the tiled branch in its picture template.
 *
 * @module render/image-tiling
 */
import type { PptxElement } from 'pptx-viewer-core';
import { isImageLikeElement } from 'pptx-viewer-core';

import type { CssStyleMap } from './element-style-transform';
import { escapeSvgAttr } from './visual-effects';

/**
 * Whether this element paints its bitmap as a repeating tile.
 *
 * Any `a:tile` attribute that survived parsing is taken as proof of the tile
 * element itself: `<a:tile flip="xy"/>` and `<a:tile algn="tl"/>` are legal and
 * carry no scale, and gating on `@sx`/`@sy` alone (as React did) rendered those
 * as a single stretched copy.
 */
export function isImageTiled(element: PptxElement): boolean {
	if (!isImageLikeElement(element)) {
		return false;
	}
	return (
		typeof element.tileScaleX === 'number' ||
		typeof element.tileScaleY === 'number' ||
		typeof element.tileOffsetX === 'number' ||
		typeof element.tileOffsetY === 'number' ||
		(element.tileFlip !== undefined && element.tileFlip !== 'none') ||
		element.tileAlignment !== undefined
	);
}

/**
 * `a:tile/@algn` as the percentage pair CSS anchors a background at.
 *
 * A percentage `background-position` aligns the same percentage point of the
 * TILE with that percentage point of the box, which is exactly the OOXML
 * anchoring rule, and unlike the `left`/`center` keywords it composes with the
 * `@tx`/`@ty` offset inside a `calc()`.
 */
function tileAlignmentPercentages(alignment: string | undefined): { x: number; y: number } {
	switch (alignment) {
		case 'tl':
			return { x: 0, y: 0 };
		case 't':
			return { x: 50, y: 0 };
		case 'tr':
			return { x: 100, y: 0 };
		case 'l':
			return { x: 0, y: 50 };
		case 'ctr':
			return { x: 50, y: 50 };
		case 'r':
			return { x: 100, y: 50 };
		case 'bl':
			return { x: 0, y: 100 };
		case 'b':
			return { x: 50, y: 100 };
		case 'br':
			return { x: 100, y: 100 };
		default:
			// `@algn` defaults to the top-left of the fill rectangle.
			return { x: 0, y: 0 };
	}
}

/** One axis of the tile origin: the alignment anchor plus the `@tx`/`@ty` offset. */
function tileAxisPosition(percent: number, offsetPx: number): string {
	if (offsetPx === 0) {
		return `${percent}%`;
	}
	if (percent === 0) {
		return `${offsetPx}px`;
	}
	// `calc()` is what lets the anchor and the offset coexist: the 4-value
	// `background-position` syntax cannot offset from a `center` anchor at all.
	return `calc(${percent}% + ${offsetPx}px)`;
}

/**
 * Bake `a:tile/@flip` into a single composite tile.
 *
 * CSS `background-repeat` cannot mirror alternate tiles, so the mirror is baked
 * into the tile itself: an inline SVG lays out 2 (`x` / `y`) or 4 (`xy`)
 * mirrored copies of the source, and that composite then repeats seamlessly -
 * each neighbour is the mirror of the last, exactly as PowerPoint tiles it.
 *
 * The source must be an embeddable `data:` URI: an SVG loaded as a `data:`
 * background has an opaque origin and cannot reference `blob:`/`http:` hrefs, so
 * for those sources this returns `undefined` and the caller keeps plain
 * (non-mirrored) repetition.
 *
 * @param src    - The tile image source (must start with `data:`).
 * @param flip   - Tile flip mode (`x` / `y` / `xy`).
 * @param scaleX - Per-tile horizontal size as a percentage (e.g. 100 = 100%).
 * @param scaleY - Per-tile vertical size as a percentage.
 * @returns The composite `backgroundImage` + doubled `backgroundSize`, or
 *          `undefined` when no mirror applies / the source is not embeddable.
 */
export function buildMirrorTiledBackground(
	src: string,
	flip: 'x' | 'y' | 'xy',
	scaleX: number,
	scaleY: number,
): { backgroundImage: string; backgroundSize: string } | undefined {
	if (!src.startsWith('data:')) {
		return undefined;
	}
	const flipX = flip === 'x' || flip === 'xy';
	const flipY = flip === 'y' || flip === 'xy';
	const cols = flipX ? 2 : 1;
	const rows = flipY ? 2 : 1;

	// `src` is a data URI straight off the element. An un-encoded SVG payload
	// (`data:image/svg+xml,<svg …>`) carries `<`, `&` and `"`, which would close
	// the href attribute and leave the tile SVG malformed.
	const href = escapeSvgAttr(src);
	const images: string[] = [];
	for (let cy = 0; cy < rows; cy++) {
		for (let cx = 0; cx < cols; cx++) {
			const mirrorX = flipX && cx % 2 === 1;
			const mirrorY = flipY && cy % 2 === 1;
			const sx = mirrorX ? -1 : 1;
			const sy = mirrorY ? -1 : 1;
			// After scale(-1) the unit cell spans [-1,0]; shift it back by +1 so it
			// lands in [0,1], then translate to the target grid cell (cx, cy).
			const tx = cx + (mirrorX ? 1 : 0);
			const ty = cy + (mirrorY ? 1 : 0);
			images.push(
				`<image href="${href}" x="0" y="0" width="1" height="1" ` +
					`preserveAspectRatio="none" transform="translate(${tx},${ty}) scale(${sx},${sy})"/>`,
			);
		}
	}

	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols} ${rows}" ` +
		`width="${cols}" height="${rows}">${images.join('')}</svg>`;

	return {
		backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
		backgroundSize: `${scaleX * cols}% ${scaleY * rows}%`,
	};
}

/**
 * The CSS that paints a tiled picture, or `undefined` when the element is not
 * tiled.
 *
 * Returned as a full-size background layer, because a repeating fill cannot be
 * expressed on an `<img>`: the binding renders a `<div>` carrying this style in
 * place of the `<img>` it would otherwise emit.
 */
export function getImageTilingStyle(element: PptxElement): CssStyleMap | undefined {
	if (!isImageLikeElement(element) || !isImageTiled(element)) {
		return undefined;
	}
	// `@sx`/`@sy` default to 100% when the attribute is absent.
	const scaleX = typeof element.tileScaleX === 'number' ? element.tileScaleX * 100 : 100;
	const scaleY = typeof element.tileScaleY === 'number' ? element.tileScaleY * 100 : 100;
	const offsetX = typeof element.tileOffsetX === 'number' ? element.tileOffsetX : 0;
	const offsetY = typeof element.tileOffsetY === 'number' ? element.tileOffsetY : 0;

	// `@algn` anchors the tile grid and `@tx`/`@ty` shift it from that anchor:
	// they COMPOSE. React let a non-zero offset replace the anchor entirely, so a
	// centre-anchored tile with a nudge was re-anchored to the top left.
	const anchor = tileAlignmentPercentages(element.tileAlignment);
	const backgroundPosition = `${tileAxisPosition(anchor.x, offsetX)} ${tileAxisPosition(
		anchor.y,
		offsetY,
	)}`;

	const src = element.svgData || element.imageData;
	const flip = element.tileFlip;
	const mirror =
		src && flip && flip !== 'none'
			? buildMirrorTiledBackground(src, flip, scaleX, scaleY)
			: undefined;

	const style: CssStyleMap = {
		backgroundRepeat: 'repeat',
		backgroundSize: mirror ? mirror.backgroundSize : `${scaleX}% ${scaleY}%`,
		backgroundPosition,
		width: '100%',
		height: '100%',
	};
	const backgroundImage = mirror ? mirror.backgroundImage : src ? `url(${src})` : undefined;
	if (backgroundImage) {
		style.backgroundImage = backgroundImage;
	}
	return style;
}
