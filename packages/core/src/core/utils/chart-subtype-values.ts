/**
 * Legal `@val` enumerations for the three OOXML chart subtype flags added in
 * this wave: `c:bar3DChart/c:shape` (and per-series `c:ser/c:shape`),
 * `c:radarChart/c:radarStyle`, and the boolean `c:surfaceChart|surface3DChart/
 * c:wireframe`. Shared by the parse and save paths so both agree on what is
 * a legal attribute value.
 *
 * @module utils/chart-subtype-values
 */

import type { PptxBar3DShape, PptxChartData } from '../types';

/** All legal `c:shape/@val` (`ST_Shape`) values, in schema-listed order. */
export const BAR3D_SHAPE_VALUES: readonly PptxBar3DShape[] = [
	'box',
	'cone',
	'coneToMax',
	'cylinder',
	'pyramid',
	'pyramidToMax',
];

const BAR3D_SHAPE_SET = new Set<string>(BAR3D_SHAPE_VALUES);

/** Parse a raw `c:shape/@val` string, returning `undefined` for anything illegal. */
export function parseBar3DShapeVal(raw: string): PptxBar3DShape | undefined {
	return BAR3D_SHAPE_SET.has(raw) ? (raw as PptxBar3DShape) : undefined;
}

/** All legal `c:radarStyle/@val` (`ST_RadarStyle`) values. */
export const RADAR_STYLE_VALUES: readonly NonNullable<PptxChartData['radarStyle']>[] = [
	'standard',
	'marker',
	'filled',
];

const RADAR_STYLE_SET = new Set<string>(RADAR_STYLE_VALUES);

/** Parse a raw `c:radarStyle/@val` string, returning `undefined` for anything illegal. */
export function parseRadarStyleVal(raw: string): PptxChartData['radarStyle'] {
	return RADAR_STYLE_SET.has(raw) ? (raw as PptxChartData['radarStyle']) : undefined;
}
