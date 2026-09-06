/**
 * chart-bar3d-face-picture.ts: picture-fill face targeting for a `bar3D`
 * chart's oblique-projection extrusion faces (C2-G9 3-D face-targeting half).
 *
 * Split out of `chart-3d-depth.ts` (the depth/extrusion geometry module,
 * which stayed within the repo's ~300-LOC guidance without this) so the two
 * concerns - "where do the top/side face polygons sit" vs. "what paints
 * them" - live in separate files. `chart-3d-depth.ts`'s `barExtrusion` calls
 * {@link resolveExtrusionFaceFill} once per face; this module owns resolving
 * `c:applyToSides`/`c:applyToEnd` against the point's (or series') picture
 * and building the `<pattern>` def, leaving the front rect's own
 * `c:applyToFront` targeting to `chart-datapoint-picture-fills.ts` (a
 * completely separate primitive, painted in a later pass).
 *
 * @module chart-bar3d-face-picture
 */
import {
	ensureBarFacePicturePixelSampled,
	getCachedBarFacePicturePixelColor,
} from './chart-bar3d-face-picture-sample';
import type { ChartSeriesLike } from './chart-datapoint-style';
import {
	resolveActiveDataPointPicture,
	resolveDataPointPictureFill,
} from './chart-datapoint-style';
import { shade, tint } from './chart-palette';
import { buildPictureFillPatternDef, polygonBoundingBox } from './chart-picture-pattern-def';
import type { ChartSvgDef, SvgRect } from './chart-view-model-types';

/**
 * A `bar3D` chart's series data, threaded through the depth pass so its
 * extrusion faces can resolve their own picture-fill targeting. `elementId`
 * prefixes every pattern id, matching `chart-datapoint-picture-fills.ts`'s
 * front-face pattern ids so two chart instances on the same slide never
 * collide.
 */
export interface BarFacePictureContext {
	series: readonly ChartSeriesLike[];
	elementId: string;
}

/**
 * Resolve the fallback fill for a `bar3D` extrusion face (top/end or side)
 * that no picture targets: `baseColor` (the resolved point/series colour, OR
 * - once decoded - the picture's own sampled colour, see
 * {@link resolveExtrusionFaceFill}), shaded (side) or tinted (top/end) with
 * the SAME per-face 3-D lighting every solid-filled bar already gets.
 *
 * COM-verified ground truth (PowerPoint Object 16, 2026-09): a `bar3D` point
 * whose fill is picture-only (`c:pictureOptions` with an embedded picture,
 * NO `c:spPr/a:solidFill`) and whose `c:applyToSides`/`c:applyToEnd` are
 * explicitly `0` does NOT paint that face black, and does NOT paint the
 * actual picture there either. Two independent test decks (a real
 * `Series.ApplyPictToFront/Sides/End` chart built through PowerPoint's own
 * object model, not hand-authored XML) confirm PowerPoint paints a FLAT
 * solid colour there, run through its ordinary per-face lighting, that
 * tracks the fill picture itself: a yellow/purple striped fill painted a
 * solid purple (the stripe colour sitting at the image's first pixel) on
 * both untargeted faces, and a 16x16 mostly-red fill with a single green
 * pixel at (0,0) painted those faces solid GREEN, not the majority red -
 * i.e. PowerPoint samples the picture's pixel at (0,0), not an average or
 * the centre. {@link resolveExtrusionFaceFill} now reproduces that: it reads
 * `chart-bar3d-face-picture-sample.ts`'s async first-pixel cache and, once a
 * sample has landed, tints/shades THAT colour instead of the resolved
 * point/series one. Before the async decode resolves (or when it fails, e.g.
 * no DOM), this resolved point/series colour is still the fallback used
 * here, which is why this function keeps taking a plain colour rather than
 * an image URL.
 */
export function resolveUntargetedBarFaceFill(face: 'side' | 'end', baseColor: string): string {
	return face === 'end' ? tint(baseColor, 0.22) : shade(baseColor, 0.25);
}

/**
 * Resolve one extrusion face's fill: a `c:dPt`/`c:ser` picture-fill pattern
 * when {@link resolveDataPointPictureFill} targets this face
 * (`c:applyToSides`/`c:applyToEnd`); otherwise this face is untargeted, and
 * PowerPoint paints it a flat colour sampled from the picture itself when one
 * is configured at all (see {@link resolveUntargetedBarFaceFill}'s doc
 * comment). When that picture's first pixel has already been decoded
 * (`chart-bar3d-face-picture-sample.ts`), this tints/shades the SAMPLED
 * colour; otherwise it kicks off the async decode (fire-and-forget - the
 * caller re-renders once it resolves) and falls back to tinting/shading
 * `resolvedColor` (the resolved point/series colour) for this render, same
 * as before sampling existed. A point with no picture fill at all always
 * uses `resolvedColor`. Pushes the pattern def onto `defs` when one is built.
 */
export function resolveExtrusionFaceFill(
	facePoints: string,
	face: 'side' | 'end',
	resolvedColor: string,
	rect: SvgRect,
	picture: BarFacePictureContext | undefined,
	defs: ChartSvgDef[],
): string {
	const fallback = resolveUntargetedBarFaceFill(face, resolvedColor);
	if (!picture || !rect.part || rect.part.pointIndex === undefined) {
		return fallback;
	}
	const series = picture.series[rect.part.seriesIndex];
	if (!series) {
		return fallback;
	}
	const resolved = resolveDataPointPictureFill(
		series,
		rect.part.pointIndex,
		rect.part.seriesIndex,
		face,
	);
	if (resolved) {
		const patternId = `${picture.elementId}-${resolved.patternId}`;
		defs.push(
			buildPictureFillPatternDef(
				patternId,
				resolved.imageUrl,
				resolved.format,
				polygonBoundingBox(facePoints),
				resolved.tileHeightPx,
			),
		);
		return `url(#${patternId})`;
	}
	const activePicture = resolveActiveDataPointPicture(series, rect.part.pointIndex);
	if (!activePicture?.imageUrl) {
		return fallback;
	}
	const sampled = getCachedBarFacePicturePixelColor(activePicture.imageUrl);
	if (sampled !== undefined) {
		return resolveUntargetedBarFaceFill(face, sampled);
	}
	ensureBarFacePicturePixelSampled(activePicture.imageUrl);
	return fallback;
}
