/**
 * Text-inset rects for the remaining ANSI flowchart presets not yet on
 * `VERIFIED_TEXT_RECT_PRESETS`.
 *
 * Transcribed verbatim from ECMA-376's `presetShapeDefinitions.xml` `<rect>`
 * element (the same source, same method as `preset-connection-sites-*.ts`).
 * See `preset-text-rect-types.ts` for why this is a separate override table
 * rather than an edit to `preset-shape-definitions-*.ts`.
 *
 * @module render/preset-text-rect-flowchart
 */
import { gd } from './preset-connection-sites-types';
import type { PresetTextRectDefinition } from './preset-text-rect-types';

export const FLOWCHART_TEXT_RECTS: Record<string, PresetTextRectDefinition> = {
	flowChartAlternateProcess: {
		gdLst: [gd('il', '*/ ssd6 29289 100000'), gd('ir', '+- r 0 il'), gd('ib', '+- b 0 il')],
		rect: { l: 'il', t: 'il', r: 'ir', b: 'ib' },
	},

	flowChartCollate: {
		gdLst: [gd('ir', '*/ w 3 4'), gd('ib', '*/ h 3 4')],
		rect: { l: 'wd4', t: 'hd4', r: 'ir', b: 'ib' },
	},

	flowChartConnector: {
		gdLst: [
			gd('idx', 'cos wd2 2700000'),
			gd('idy', 'sin hd2 2700000'),
			gd('il', '+- hc 0 idx'),
			gd('ir', '+- hc idx 0'),
			gd('it', '+- vc 0 idy'),
			gd('ib', '+- vc idy 0'),
		],
		rect: { l: 'il', t: 'it', r: 'ir', b: 'ib' },
	},

	flowChartDelay: {
		gdLst: [
			gd('idx', 'cos wd2 2700000'),
			gd('idy', 'sin hd2 2700000'),
			gd('ir', '+- hc idx 0'),
			gd('it', '+- vc 0 idy'),
			gd('ib', '+- vc idy 0'),
		],
		rect: { l: 'l', t: 'it', r: 'ir', b: 'ib' },
	},

	flowChartMagneticDisk: {
		gdLst: [gd('y3', '*/ h 5 6')],
		rect: { l: 'l', t: 'hd3', r: 'r', b: 'y3' },
	},

	flowChartMagneticDrum: {
		gdLst: [gd('x2', '*/ w 2 3')],
		rect: { l: 'wd6', t: 't', r: 'x2', b: 'b' },
	},

	flowChartMagneticTape: {
		gdLst: [
			gd('idx', 'cos wd2 2700000'),
			gd('idy', 'sin hd2 2700000'),
			gd('il', '+- hc 0 idx'),
			gd('ir', '+- hc idx 0'),
			gd('it', '+- vc 0 idy'),
			gd('ib', '+- vc idy 0'),
		],
		rect: { l: 'il', t: 'it', r: 'ir', b: 'ib' },
	},

	flowChartMultidocument: {
		gdLst: [
			gd('y2', '*/ h 3675 21600'),
			gd('y8', '*/ h 20782 21600'),
			gd('x5', '*/ w 18595 21600'),
		],
		rect: { l: 'l', t: 'y2', r: 'x5', b: 'y8' },
	},

	flowChartOr: {
		gdLst: [
			gd('idx', 'cos wd2 2700000'),
			gd('idy', 'sin hd2 2700000'),
			gd('il', '+- hc 0 idx'),
			gd('ir', '+- hc idx 0'),
			gd('it', '+- vc 0 idy'),
			gd('ib', '+- vc idy 0'),
		],
		rect: { l: 'il', t: 'it', r: 'ir', b: 'ib' },
	},

	flowChartPunchedTape: {
		gdLst: [gd('ib', '*/ h 4 5')],
		rect: { l: 'l', t: 'hd5', r: 'r', b: 'ib' },
	},

	flowChartSort: {
		gdLst: [gd('ir', '*/ w 3 4'), gd('ib', '*/ h 3 4')],
		rect: { l: 'wd4', t: 'hd4', r: 'ir', b: 'ib' },
	},

	flowChartSummingJunction: {
		gdLst: [
			gd('idx', 'cos wd2 2700000'),
			gd('idy', 'sin hd2 2700000'),
			gd('il', '+- hc 0 idx'),
			gd('ir', '+- hc idx 0'),
			gd('it', '+- vc 0 idy'),
			gd('ib', '+- vc idy 0'),
		],
		rect: { l: 'il', t: 'it', r: 'ir', b: 'ib' },
	},
};
