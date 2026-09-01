/**
 * Connection-site resolution for connectors: where on a shape a connector end
 * may bind, in slide-ready coordinates. Pure (no framework imports).
 *
 * Split out of `connector-reroute.ts`, which re-exports everything here so the
 * historical import path keeps working. Consumed by the reroute, connector
 * authoring, the endpoint-drag helpers and every binding's site overlay, so a
 * site means the same place to all of them.
 *
 * @module render/connector-sites
 */

import { createBuiltinVariables, resolveCoordinate } from 'pptx-viewer-core';
import type { PptxElement } from 'pptx-viewer-core';

/** A single connection site on a shape's bounding box (element-local coords). */
export interface ConnectionSite {
	x: number;
	y: number;
	index: number;
}

/**
 * Compute connection sites for a rectangular bounding box. Returns the four
 * edge midpoints in element-local coordinates: top, right, bottom, left.
 *
 * This is the fallback used for shapes whose real connection sites are
 * unknown (preset shapes without a parsed `a:cxnLst`).
 */
export function getConnectionSites(width: number, height: number): ConnectionSite[] {
	return [
		{ x: width / 2, y: 0, index: 0 }, // top center
		{ x: width, y: height / 2, index: 1 }, // right center
		{ x: width / 2, y: height, index: 2 }, // bottom center
		{ x: 0, y: height / 2, index: 3 }, // left center
	];
}

/** Structural view of the custom-geometry fields we read off a shape element. */
interface ShapeGeometryFields {
	customGeometryConnectionSites?: Array<{ posX?: string; posY?: string; ang?: string }>;
	pathWidth?: number;
	pathHeight?: number;
}

/** The frame fields that place a connection site on the slide. */
export type ConnectionSiteFrame = Pick<
	PptxElement,
	'width' | 'height' | 'rotation' | 'flipHorizontal' | 'flipVertical'
>;

/**
 * Carry a site from the shape's UNROTATED box into the frame the shape is
 * actually drawn in: flip about the box centre (`a:xfrm/@flipH`, `@flipV`),
 * then rotate about it by `@rot` (degrees, clockwise on screen), the same
 * order `getElementOrientationMatrix` composes for text. The result is still
 * relative to the frame origin, so `shape.x + site.x` is the on-slide point.
 *
 * Without this every consumer attached a connector to where the site WOULD be
 * if the shape were upright: on a 90-degree-rotated rectangle the "top" site
 * sat in mid-air a half-width away from the edge it belongs to, and the site
 * dots the overlay draws for the drag were in the same wrong place.
 */
export function transformConnectionSite(
	site: ConnectionSite,
	frame: ConnectionSiteFrame,
): ConnectionSite {
	const localX = frame.flipHorizontal ? frame.width - site.x : site.x;
	const localY = frame.flipVertical ? frame.height - site.y : site.y;
	const degrees = Number(frame.rotation) || 0;
	if (degrees === 0) {
		return { x: localX, y: localY, index: site.index };
	}
	const radians = (degrees * Math.PI) / 180;
	const cos = Math.cos(radians);
	const sin = Math.sin(radians);
	const cx = frame.width / 2;
	const cy = frame.height / 2;
	const dx = localX - cx;
	const dy = localY - cy;
	return {
		x: cx + dx * cos - dy * sin,
		y: cy + dx * sin + dy * cos,
		index: site.index,
	};
}

/**
 * Resolve the connection sites of a shape element relative to its frame
 * origin, with the shape's own flip and rotation applied (see
 * {@link transformConnectionSite}) so `shape.x + site.x` / `shape.y + site.y`
 * is where the site sits on the slide.
 *
 * When the shape carries typed custom-geometry connection sites (parsed from
 * `a:custGeom/a:cxnLst/a:cxn`), each `a:pos` formula is evaluated against the
 * shape's path coordinate space and scaled to the element's pixel box, so a
 * connector referencing `stCxn/@idx` on a non-rectangular shape attaches near
 * the real site rather than collapsing to an edge midpoint. Shapes with no
 * known sites fall back to the four edge midpoints.
 */
export function getShapeConnectionSites(shape: PptxElement): ConnectionSite[] {
	return getUnrotatedShapeConnectionSites(shape).map((site) =>
		transformConnectionSite(site, shape),
	);
}

/**
 * The same sites as {@link getShapeConnectionSites} in the shape's upright,
 * unflipped box: what `a:cxnLst` literally describes, before the frame
 * transform. For callers that draw inside the shape's own (already
 * transformed) coordinate system.
 */
export function getUnrotatedShapeConnectionSites(shape: PptxElement): ConnectionSite[] {
	const geo = shape as PptxElement & ShapeGeometryFields;
	const cxn = geo.customGeometryConnectionSites;
	if (!cxn || cxn.length === 0) {
		return getConnectionSites(shape.width, shape.height);
	}

	// Path coordinate space the `a:pos` formulas are expressed in. Fall back to
	// the element's pixel dimensions (scale factor 1) when unavailable.
	const pathW = geo.pathWidth && geo.pathWidth > 0 ? geo.pathWidth : shape.width;
	const pathH = geo.pathHeight && geo.pathHeight > 0 ? geo.pathHeight : shape.height;
	const vars = createBuiltinVariables({ w: pathW, h: pathH });
	const scaleX = pathW > 0 ? shape.width / pathW : 1;
	const scaleY = pathH > 0 ? shape.height / pathH : 1;

	return cxn.map((site, index) => ({
		x: resolveCoordinate(site.posX, vars) * scaleX,
		y: resolveCoordinate(site.posY, vars) * scaleY,
		index,
	}));
}
