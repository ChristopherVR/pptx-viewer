/**
 * Connection sites for the banner/ribbon family: `ribbon`, `ribbon2`,
 * `ellipseRibbon`, `ellipseRibbon2`, `leftRightRibbon`.
 *
 * See `preset-connection-sites-quads.ts` for the provenance note; same source
 * (`presetShapeDefinitions.xml`), same transcription method.
 *
 * @module render/preset-connection-sites-ribbons
 */
import type { PresetConnectionSiteDefinition } from './preset-connection-sites-types';
import { cxn, gd } from './preset-connection-sites-types';

export const RIBBON_CONNECTION_SITES: Record<string, PresetConnectionSiteDefinition> = {
	ellipseRibbon: {
		avLst: { adj1: 25000, adj3: 12500 },
		gdLst: [
			gd('a1', 'pin 0 adj1 100000'),
			gd('q10', '+- 100000 0 a1'),
			gd('q11', '*/ q10 1 2'),
			gd('q12', '+- a1 0 q11'),
			gd('minAdj3', 'max 0 q12'),
			gd('a3', 'pin minAdj3 adj3 a1'),
			gd('x6', '+- r 0 wd8'),
			gd('dy1', '*/ h a3 100000'),
			gd('q1', '*/ h a1 100000'),
			gd('rh', '+- b 0 q1'),
			gd('q8', '*/ dy1 14 16'),
			gd('y2', '+/ q8 rh 2'),
		],
		sites: [
			cxn('3cd4', 'hc', 'q1'),
			cxn('cd2', 'wd8', 'y2'),
			cxn('cd4', 'hc', 'b'),
			cxn('0', 'x6', 'y2'),
		],
	},

	ellipseRibbon2: {
		avLst: { adj1: 25000, adj3: 12500 },
		gdLst: [
			gd('a1', 'pin 0 adj1 100000'),
			gd('q10', '+- 100000 0 a1'),
			gd('q11', '*/ q10 1 2'),
			gd('q12', '+- a1 0 q11'),
			gd('minAdj3', 'max 0 q12'),
			gd('a3', 'pin minAdj3 adj3 a1'),
			gd('x6', '+- r 0 wd8'),
			gd('dy1', '*/ h a3 100000'),
			gd('q1', '*/ h a1 100000'),
			gd('rh', '+- b 0 q1'),
			gd('q8', '*/ dy1 14 16'),
			gd('u2', '+/ q8 rh 2'),
			gd('y2', '+- b 0 u2'),
		],
		sites: [
			cxn('3cd4', 'hc', 't'),
			cxn('cd2', 'wd8', 'y2'),
			cxn('cd4', 'hc', 'rh'),
			cxn('0', 'x6', 'y2'),
		],
	},

	// the real presetShapeDefinitions.xml uses `wd32` (w/32) here without
	// defining it locally, relying on it as a built-in guide; this repo's
	// guide-formula-api.ts `createBuiltinVariables` only seeds wd2..wd12 (no
	// wd16/wd32), so it is redefined here as an ordinary gdLst entry to keep
	// this table correct independent of that engine gap (see report).
	leftRightRibbon: {
		avLst: { adj2: 50000, adj1: 50000, adj3: 16667 },
		gdLst: [
			gd('wd32', '*/ w 1 32'),
			gd('a3', 'pin 0 adj3 33333'),
			gd('maxAdj1', '+- 100000 0 a3'),
			gd('a1', 'pin 0 adj1 maxAdj1'),
			gd('w1', '+- wd2 0 wd32'),
			gd('maxAdj2', '*/ 100000 w1 ss'),
			gd('a2', 'pin 0 adj2 maxAdj2'),
			gd('x1', '*/ ss a2 100000'),
			gd('x4', '+- r 0 x1'),
			gd('dy1', '*/ h a1 200000'),
			gd('dy2', '*/ h a3 -200000'),
			gd('ly1', '+- vc dy2 dy1'),
			gd('ly2', '+- ly1 dy1 0'),
			gd('ry3', '+- b 0 ly2'),
			gd('ly4', '*/ ly2 2 1'),
			gd('ry1', '+- b 0 ly4'),
		],
		sites: [
			cxn('0', 'r', 'ry3'),
			cxn('cd4', 'x4', 'b'),
			cxn('cd4', 'x1', 'ly4'),
			cxn('cd2', 'l', 'ly2'),
			cxn('3cd4', 'x1', 't'),
			cxn('3cd4', 'x4', 'ry1'),
		],
	},

	ribbon: {
		avLst: { adj1: 16667 },
		gdLst: [
			gd('a1', 'pin 0 adj1 33333'),
			gd('x10', '+- r 0 wd8'),
			gd('y2', '*/ h a1 100000'),
			gd('y4', '+- b 0 y2'),
			gd('y3', '*/ y4 1 2'),
		],
		sites: [
			cxn('3cd4', 'hc', 'y2'),
			cxn('cd2', 'wd8', 'y3'),
			cxn('cd4', 'hc', 'b'),
			cxn('0', 'x10', 'y3'),
		],
	},

	ribbon2: {
		avLst: { adj1: 16667 },
		gdLst: [
			gd('a1', 'pin 0 adj1 33333'),
			gd('x10', '+- r 0 wd8'),
			gd('dy2', '*/ h a1 100000'),
			gd('y2', '+- b 0 dy2'),
			gd('y4', '+- t dy2 0'),
			gd('y3', '+/ y4 b 2'),
		],
		sites: [
			cxn('3cd4', 'hc', 't'),
			cxn('cd2', 'wd8', 'y3'),
			cxn('cd4', 'hc', 'y2'),
			cxn('0', 'x10', 'y3'),
		],
	},
};
