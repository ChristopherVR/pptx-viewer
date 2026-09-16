/**
 * chart-datapoint-picture-resolve.ts: framework-agnostic resolution of a
 * data point's (or its series') picture fill into a paintable descriptor.
 *
 * Split out of `chart-datapoint-style.ts` to keep that file within the
 * repo's ~300-LOC limit: that file resolves per-point formatting in
 * general (fill colour, marker, explosion); this one owns specifically the
 * picture-fill half (`c:pictureOptions` AND the bare-`a:blipFill`
 * `impliedPicture` case, plus `bar3D` face targeting), which had grown into
 * its own coherent concern.
 *
 * @module chart-datapoint-picture-resolve
 */

import type { PptxChartDataPointPicture } from 'pptx-viewer-core';

import type { ChartSeriesLike } from './chart-datapoint-style';
import { findDataPoint } from './chart-datapoint-style';
import { chartFontPx } from './chart-font';

/**
 * An SVG `<pattern>` a binding must render into its chart's `<defs>` to paint
 * a data point's picture fill (`c:dPt/c:pictureOptions`, C2-G9 render half).
 * Pure decision function (CLAUDE.md Rule 2): every field a binding needs to
 * build the pattern element and point the rect's `fill` at it, with no
 * chart-type-specific logic left for the binding to reimplement.
 */
export interface DataPointPictureFill {
	/** Unique id for this point's `<pattern>` element; also its `fill="url(#...)"` target. */
	patternId: string;
	imageUrl: string;
	/** `stretch` fills the whole rect with one scaled copy; `stack`/`stackScale` tile it. */
	format: NonNullable<PptxChartDataPointPicture['pictureFormat']>;
	/**
	 * Height (px) of one repeated tile for `stack`/`stackScale`
	 * (`c:pictureStackUnit`, converted from points). `undefined` for `stretch`,
	 * where the image covers the whole rect and stacking is meaningless.
	 */
	tileHeightPx?: number;
	/**
	 * Effective opacity (0-1) from the blip's `a:alphaModFix` (see
	 * `PptxChartDataPointPicture.opacity`'s doc comment). `undefined` (fully
	 * opaque) when the blip carries no `alphaModFix`.
	 */
	opacity?: number;
}

/** PowerPoint's own default picture-fill format when `c:pictureFormat` is absent. */
const DEFAULT_PICTURE_FORMAT: NonNullable<PptxChartDataPointPicture['pictureFormat']> = 'stretch';

/**
 * Resolve the picture-fill flags actually in effect for a point: its OWN
 * `c:dPt/c:pictureOptions` when it resolved an image, otherwise the series'
 * `c:ser/c:pictureOptions` (C2-G9 series-level half). A point with its own
 * picture wins OUTRIGHT (not merged field-by-field with the series' flags),
 * matching how a `c:dPt/c:spPr` fully replaces the series' formatting
 * elsewhere in this resolver (`resolveDataPointFill`, `chart-datapoint-style.ts`).
 *
 * `impliedPicture` (a bare `a:blipFill` with no `c:pictureOptions` sibling,
 * see `PptxChartDataPoint.impliedPicture`'s doc comment) is checked at the
 * SAME tier as `picture`, once `picture` itself did not resolve an image: a
 * point's own fill (explicit flags or implied) still wins outright over the
 * series', and vice versa.
 */
export function resolveActiveDataPointPicture(
	series: ChartSeriesLike,
	pointIndex: number,
): PptxChartDataPointPicture | undefined {
	const point = findDataPoint(series, pointIndex);
	const pointPicture = point?.picture?.imageUrl
		? point.picture
		: point?.impliedPicture?.imageUrl
			? point.impliedPicture
			: undefined;
	if (pointPicture) {
		return pointPicture;
	}
	if (series.picture?.imageUrl) {
		return series.picture;
	}
	return series.impliedPicture?.imageUrl ? series.impliedPicture : undefined;
}

/** Which face of a 3-D bar/column a picture fill targets. */
export type BarPictureFace = 'front' | 'side' | 'end';

/** Whether a picture fill paints each of a 3-D bar's three faces. */
export interface BarFaceTargets {
	front: boolean;
	side: boolean;
	end: boolean;
}

/**
 * Resolve which 3-D bar/column faces a picture fill paints
 * (`c:applyToFront`/`c:applyToSides`/`c:applyToEnd`).
 *
 * COM-verified ground truth (PowerPoint Object 16, `c:dPt/c:pictureOptions`
 * with an embedded picture): a `c:pictureOptions` that sets NONE of the three
 * `applyTo*` flags renders IDENTICALLY to one that sets all three to `1` (the
 * picture paints every face). Once at least one flag is present, PowerPoint
 * treats an omitted sibling as `0` (not targeted) rather than re-applying the
 * all-faces default. `picture` undefined (no picture fill at all) targets no
 * face.
 */
export function resolveBarFaceTargets(
	picture: PptxChartDataPointPicture | undefined,
): BarFaceTargets {
	if (!picture) {
		return { front: false, side: false, end: false };
	}
	const { applyToFront, applyToSides, applyToEnd } = picture;
	if (applyToFront === undefined && applyToSides === undefined && applyToEnd === undefined) {
		return { front: true, side: true, end: true };
	}
	return { front: applyToFront ?? false, side: applyToSides ?? false, end: applyToEnd ?? false };
}

/**
 * Resolve a data point's picture-fill pattern descriptor from
 * {@link resolveActiveDataPointPicture}, or `undefined` when the point (and
 * its series) have no picture fill, the runtime could not resolve the image
 * ({@link PptxChartDataPointPicture.imageUrl} absent), or (when `face` is
 * given) the resolved flags do not target that face
 * ({@link resolveBarFaceTargets}, C2-G9 3-D face-targeting half).
 *
 * `face` is only meaningful for a 3-D bar/column's oblique-projection faces
 * (front rect, side + end/top extrusion polygons); every other picture-filled
 * chart mark (a plain 2-D bar, a pie slice, ...) has exactly one face and
 * calls this without it, preserving the pre-face-targeting behaviour of
 * always painting the picture once resolved.
 */
export function resolveDataPointPictureFill(
	series: ChartSeriesLike,
	pointIndex: number,
	seriesIndex: number,
	face?: BarPictureFace,
): DataPointPictureFill | undefined {
	const picture = resolveActiveDataPointPicture(series, pointIndex);
	if (!picture?.imageUrl) {
		return undefined;
	}
	if (face) {
		const targets = resolveBarFaceTargets(picture);
		const targeted =
			face === 'front' ? targets.front : face === 'side' ? targets.side : targets.end;
		if (!targeted) {
			return undefined;
		}
	}
	const format = picture.pictureFormat ?? DEFAULT_PICTURE_FORMAT;
	return {
		patternId: `chart-dpt-pic-${seriesIndex}-${pointIndex}${face && face !== 'front' ? `-${face}` : ''}`,
		imageUrl: picture.imageUrl,
		format,
		...(format !== 'stretch' && picture.pictureStackUnit !== undefined
			? { tileHeightPx: chartFontPx(picture.pictureStackUnit) }
			: {}),
		...(picture.opacity !== undefined ? { opacity: picture.opacity } : {}),
	};
}
