/**
 * Connection sites for the basic box/polygon presets: `rect`, `roundRect`,
 * `ellipse`, `triangle`, `rtTriangle`, `parallelogram`, `trapezoid`, `diamond`.
 *
 * Transcribed verbatim from ECMA-376's `presetShapeDefinitions.xml` (`avLst`
 * defaults, the `gdLst` guides each shape's own `cxnLst` formulas reference,
 * and the `cxnLst` itself). See `preset-connection-sites-types.ts` for why
 * this table is separate from `preset-shape-definitions-*.ts`.
 *
 * @module render/preset-connection-sites-quads
 */
import type { PresetConnectionSiteDefinition } from './preset-connection-sites-types';
import { CARDINAL_SITES, cxn, gd } from './preset-connection-sites-types';

export const QUAD_CONNECTION_SITES: Record<string, PresetConnectionSiteDefinition> = {
	rect: { sites: CARDINAL_SITES },

	// roundRect's cxnLst is the plain 4 cardinals (PowerPoint attaches to the
	// straight edge midpoints, not the rounded corners) even though its own
	// gdLst (`x1`, `il`, ...) exists only for the path/rect.
	roundRect: { sites: CARDINAL_SITES },

	// ellipse needs its own `il`/`it`/`ir`/`ib` (the 45-degree inscribed-rect
	// corners), which this repo's `pathLst`-only table never had to compute.
	ellipse: {
		gdLst: [
			gd('idx', 'cos wd2 2700000'),
			gd('idy', 'sin hd2 2700000'),
			gd('il', '+- hc 0 idx'),
			gd('ir', '+- hc idx 0'),
			gd('it', '+- vc 0 idy'),
			gd('ib', '+- vc idy 0'),
		],
		sites: [
			cxn('3cd4', 'hc', 't'),
			cxn('3cd4', 'il', 'it'),
			cxn('cd2', 'l', 'vc'),
			cxn('cd4', 'il', 'ib'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd4', 'ir', 'ib'),
			cxn('0', 'r', 'vc'),
			cxn('3cd4', 'ir', 'it'),
		],
	},

	triangle: {
		avLst: { adj: 50000 },
		gdLst: [
			gd('a', 'pin 0 adj 100000'),
			gd('x1', '*/ w a 200000'),
			gd('x2', '*/ w a 100000'),
			gd('x3', '+- x1 wd2 0'),
		],
		// The apex (top vertex, and the point directly below it on the bottom
		// edge) sits at x2, the FULL apex offset; x1 (half of x2) is only the
		// x-coordinate of the left slanted edge's midpoint. A prior transcription
		// used x1 for the apex too, which collapses to w/4 (not the horizontal
		// center) at the default adj=50000 - fixed by adding x2 here, verbatim
		// per ECMA-376.
		sites: [
			cxn('3cd4', 'x2', 't'),
			cxn('cd2', 'x1', 'vc'),
			cxn('cd4', 'l', 'b'),
			cxn('cd4', 'x2', 'b'),
			cxn('cd4', 'r', 'b'),
			cxn('0', 'x3', 'vc'),
		],
	},

	rtTriangle: {
		gdLst: [gd('ir', '*/ w 7 12'), gd('ib', '*/ h 11 12')],
		sites: [
			cxn('3cd4', 'l', 't'),
			cxn('cd2', 'l', 'vc'),
			cxn('cd4', 'l', 'b'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd4', 'r', 'b'),
			cxn('0', 'hc', 'vc'),
		],
	},

	parallelogram: {
		avLst: { adj: 25000 },
		gdLst: [
			gd('maxAdj', '*/ 100000 w ss'),
			gd('a', 'pin 0 adj maxAdj'),
			gd('x1', '*/ ss a 200000'),
			gd('x2', '*/ ss a 100000'),
			gd('x6', '+- r 0 x1'),
			gd('x5', '+- r 0 x2'),
			gd('x3', '*/ x5 1 2'),
			gd('x4', '+- r 0 x3'),
			gd('q3', '*/ h hc x2'),
			gd('y1', 'pin 0 q3 h'),
			gd('y2', '+- b 0 y1'),
		],
		sites: [
			cxn('3cd4', 'hc', 'y2'),
			cxn('3cd4', 'x4', 't'),
			cxn('0', 'x6', 'vc'),
			cxn('cd4', 'x3', 'b'),
			cxn('cd4', 'hc', 'y1'),
			cxn('cd2', 'x1', 'vc'),
		],
	},

	trapezoid: {
		avLst: { adj: 25000 },
		gdLst: [
			gd('maxAdj', '*/ 50000 w ss'),
			gd('a', 'pin 0 adj maxAdj'),
			gd('x1', '*/ ss a 200000'),
			gd('x4', '+- r 0 x1'),
		],
		sites: [
			cxn('3cd4', 'hc', 't'),
			cxn('cd2', 'x1', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('0', 'x4', 'vc'),
		],
	},

	// diamond's own `pathLst` table has no `cxnLst`-relevant extra guides: its
	// sites are the four vertices, already expressible via builtins.
	diamond: { sites: CARDINAL_SITES },
};
