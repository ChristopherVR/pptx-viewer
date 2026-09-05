/**
 * Text-inset rects for `ellipseRibbon`, `ellipseRibbon2`, `leftRightRibbon`,
 * `ribbon`, `ribbon2`.
 *
 * Transcribed verbatim from ECMA-376's `presetShapeDefinitions.xml` `<rect>`
 * element (the same source, same method as `preset-connection-sites-*.ts`).
 * See `preset-text-rect-types.ts` for why this is a separate override table
 * rather than an edit to `preset-shape-definitions-*.ts`.
 *
 * @module render/preset-text-rect-ribbons
 */
import { gd } from './preset-connection-sites-types';
import type { PresetTextRectDefinition } from './preset-text-rect-types';

export const RIBBON_TEXT_RECTS: Record<string, PresetTextRectDefinition> = {
	ellipseRibbon: {
		avLst: { adj1: 25000, adj2: 50000, adj3: 12500 },
		gdLst: [
			gd('a1', 'pin 0 adj1 100000'),
			gd('a2', 'pin 25000 adj2 75000'),
			gd('q10', '+- 100000 0 a1'),
			gd('q11', '*/ q10 1 2'),
			gd('q12', '+- a1 0 q11'),
			gd('minAdj3', 'max 0 q12'),
			gd('a3', 'pin minAdj3 adj3 a1'),
			gd('dx2', '*/ w a2 200000'),
			gd('x2', '+- hc 0 dx2'),
			gd('x5', '+- r 0 x2'),
			gd('dy1', '*/ h a3 100000'),
			gd('f1', '*/ 4 dy1 w'),
			gd('q1', '*/ h a1 100000'),
			gd('dy3', '+- q1 0 dy1'),
			gd('q3', '*/ x2 x2 w'),
			gd('q4', '+- x2 0 q3'),
			gd('q5', '*/ f1 q4 1'),
			gd('y3', '+- q5 dy3 0'),
			gd('rh', '+- b 0 q1'),
			gd('y6', '+- y3 rh 0'),
		],
		rect: { l: 'x2', t: 'q1', r: 'x5', b: 'y6' },
	},

	ellipseRibbon2: {
		avLst: { adj2: 50000, adj1: 25000, adj3: 12500 },
		gdLst: [
			gd('a1', 'pin 0 adj1 100000'),
			gd('a2', 'pin 25000 adj2 75000'),
			gd('q10', '+- 100000 0 a1'),
			gd('q11', '*/ q10 1 2'),
			gd('q12', '+- a1 0 q11'),
			gd('minAdj3', 'max 0 q12'),
			gd('a3', 'pin minAdj3 adj3 a1'),
			gd('dx2', '*/ w a2 200000'),
			gd('x2', '+- hc 0 dx2'),
			gd('x5', '+- r 0 x2'),
			gd('dy1', '*/ h a3 100000'),
			gd('f1', '*/ 4 dy1 w'),
			gd('q1', '*/ h a1 100000'),
			gd('dy3', '+- q1 0 dy1'),
			gd('q3', '*/ x2 x2 w'),
			gd('q4', '+- x2 0 q3'),
			gd('q5', '*/ f1 q4 1'),
			gd('u3', '+- q5 dy3 0'),
			gd('rh', '+- b 0 q1'),
			gd('u6', '+- u3 rh 0'),
			gd('y6', '+- b 0 u6'),
		],
		rect: { l: 'x2', t: 'y6', r: 'x5', b: 'rh' },
	},

	// wd32 is redefined locally here for the same reason as in
	// preset-connection-sites-ribbons.ts (see that file's comment): the real
	// spec relies on it as a built-in this repo's guide-formula-api.ts does not
	// seed.
	leftRightRibbon: {
		avLst: { adj2: 50000, adj3: 16667, adj1: 50000 },
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
			gd('ry4', '+- vc dy1 dy2'),
		],
		rect: { l: 'x1', t: 'ly1', r: 'x4', b: 'ry4' },
	},

	ribbon: {
		avLst: { adj1: 16667, adj2: 50000 },
		gdLst: [
			gd('a1', 'pin 0 adj1 33333'),
			gd('a2', 'pin 25000 adj2 75000'),
			gd('dx2', '*/ w a2 200000'),
			gd('x2', '+- hc 0 dx2'),
			gd('x9', '+- hc dx2 0'),
			gd('y2', '*/ h a1 100000'),
		],
		rect: { l: 'x2', t: 'y2', r: 'x9', b: 'b' },
	},

	ribbon2: {
		avLst: { adj2: 50000, adj1: 16667 },
		gdLst: [
			gd('a1', 'pin 0 adj1 33333'),
			gd('a2', 'pin 25000 adj2 75000'),
			gd('dx2', '*/ w a2 200000'),
			gd('x2', '+- hc 0 dx2'),
			gd('x9', '+- hc dx2 0'),
			gd('dy2', '*/ h a1 100000'),
			gd('y2', '+- b 0 dy2'),
		],
		rect: { l: 'x2', t: 't', r: 'x9', b: 'y2' },
	},
};
