/**
 * Connection sites for the remaining basic presets (alphabetical: halfFrame..wave):
 * `halfFrame`, `heart`, `horizontalScroll`, `irregularSeal1`, `irregularSeal2`,
 * `lightningBolt`, `line`, `lineInv`, `moon`, `nonIsoscelesTrapezoid`, `noSmoking`,
 * `pie`, `pieWedge`, `smileyFace`, `sun`, `teardrop`, `verticalScroll`, `wave`.
 *
 * See `preset-connection-sites-quads.ts` for the provenance note; same source
 * (`presetShapeDefinitions.xml`), same transcription method.
 *
 * @module render/preset-connection-sites-misc
 */
import type { PresetConnectionSiteDefinition } from './preset-connection-sites-types';
import { CARDINAL_SITES, cxn, gd } from './preset-connection-sites-types';

export const MISC_SHAPE_CONNECTION_SITES: Record<string, PresetConnectionSiteDefinition> = {
	halfFrame: {
		avLst: { adj1: 33333, adj2: 33333 },
		gdLst: [
			gd('maxAdj2', '*/ 100000 w ss'),
			gd('a2', 'pin 0 adj2 maxAdj2'),
			gd('x1', '*/ ss a2 100000'),
			gd('g1', '*/ h x1 w'),
			gd('g2', '+- h 0 g1'),
			gd('maxAdj1', '*/ 100000 g2 ss'),
			gd('a1', 'pin 0 adj1 maxAdj1'),
			gd('y1', '*/ ss a1 100000'),
			gd('dx2', '*/ y1 w h'),
			gd('x2', '+- r 0 dx2'),
			gd('dy2', '*/ x1 h w'),
			gd('y2', '+- b 0 dy2'),
			gd('cx1', '*/ x1 1 2'),
			gd('cy1', '+/ y2 b 2'),
			gd('cx2', '+/ x2 r 2'),
			gd('cy2', '*/ y1 1 2'),
		],
		sites: [
			cxn('0', 'cx2', 'cy2'),
			cxn('cd4', 'cx1', 'cy1'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},

	heart: {
		sites: [cxn('3cd4', 'hc', 'hd4'), cxn('cd4', 'hc', 'b')],
	},

	horizontalScroll: {
		avLst: { adj: 12500 },
		gdLst: [gd('a', 'pin 0 adj 25000'), gd('ch', '*/ ss a 100000'), gd('y6', '+- b 0 ch')],
		sites: [
			cxn('cd4', 'hc', 'ch'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'hc', 'y6'),
			cxn('0', 'r', 'vc'),
		],
	},

	irregularSeal1: {
		gdLst: [
			gd('x12', '*/ w 8485 21600'),
			gd('x24', '*/ w 14522 21600'),
			gd('y6', '*/ h 8615 21600'),
			gd('y18', '*/ h 13290 21600'),
		],
		sites: [
			cxn('3cd4', 'x24', 't'),
			cxn('cd2', 'l', 'y6'),
			cxn('cd4', 'x12', 'b'),
			cxn('0', 'r', 'y18'),
		],
	},

	irregularSeal2: {
		gdLst: [
			gd('x2', '*/ w 9722 21600'),
			gd('x16', '*/ w 11612 21600'),
			gd('y2', '*/ h 1887 21600'),
			gd('y8', '*/ h 12877 21600'),
			gd('y16', '*/ h 18842 21600'),
			gd('y24', '*/ h 6645 21600'),
		],
		sites: [
			cxn('3cd4', 'x2', 'y2'),
			cxn('cd2', 'l', 'y8'),
			cxn('cd4', 'x16', 'y16'),
			cxn('0', 'r', 'y24'),
		],
	},

	lightningBolt: {
		gdLst: [
			gd('x1', '*/ w 5022 21600'),
			gd('x3', '*/ w 8472 21600'),
			gd('x5', '*/ w 10012 21600'),
			gd('x8', '*/ w 12860 21600'),
			gd('x11', '*/ w 16577 21600'),
			gd('y1', '*/ h 3890 21600'),
			gd('y2', '*/ h 6080 21600'),
			gd('y6', '*/ h 9705 21600'),
			gd('y7', '*/ h 12007 21600'),
			gd('y11', '*/ h 14915 21600'),
		],
		sites: [
			cxn('3cd4', 'x3', 't'),
			cxn('3cd4', 'l', 'y1'),
			cxn('cd2', 'x1', 'y6'),
			cxn('cd2', 'x5', 'y11'),
			cxn('cd4', 'r', 'b'),
			cxn('0', 'x11', 'y7'),
			cxn('0', 'x8', 'y2'),
		],
	},

	line: {
		sites: [cxn('cd4', 'l', 't'), cxn('3cd4', 'r', 'b')],
	},

	lineInv: {
		sites: [cxn('cd4', 'l', 'b'), cxn('3cd4', 'r', 't')],
	},

	moon: {
		avLst: { adj: 50000 },
		gdLst: [gd('a', 'pin 0 adj 87500'), gd('g0', '*/ ss a 100000'), gd('g0w', '*/ g0 w ss')],
		sites: [
			cxn('3cd4', 'r', 't'),
			cxn('cd2', 'l', 'vc'),
			cxn('cd4', 'r', 'b'),
			cxn('0', 'g0w', 'vc'),
		],
	},

	nonIsoscelesTrapezoid: {
		avLst: { adj1: 25000, adj2: 25000 },
		gdLst: [
			gd('maxAdj', '*/ 50000 w ss'),
			gd('a1', 'pin 0 adj1 maxAdj'),
			gd('a2', 'pin 0 adj2 maxAdj'),
			gd('x1', '*/ ss a1 200000'),
			gd('dx3', '*/ ss a2 100000'),
			gd('x3', '+- r 0 dx3'),
			gd('x4', '+/ r x3 2'),
		],
		sites: [
			cxn('0', 'x4', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'x1', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},

	noSmoking: {
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

	pie: {
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'hc', 't'),
		],
	},

	pieWedge: {
		sites: [cxn('0', 'r', 'vc'), cxn('cd4', 'hc', 'b')],
	},

	smileyFace: {
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

	sun: { sites: CARDINAL_SITES },

	teardrop: {
		avLst: { adj: 100000 },
		gdLst: [
			gd('a', 'pin 0 adj 200000'),
			gd('r2', 'sqrt 2'),
			gd('tw', '*/ wd2 r2 1'),
			gd('th', '*/ hd2 r2 1'),
			gd('sw', '*/ tw a 100000'),
			gd('sh', '*/ th a 100000'),
			gd('dx1', 'cos sw 2700000'),
			gd('dy1', 'sin sh 2700000'),
			gd('x1', '+- hc dx1 0'),
			gd('y1', '+- vc 0 dy1'),
			gd('idx', 'cos wd2 2700000'),
			gd('idy', 'sin hd2 2700000'),
			gd('il', '+- hc 0 idx'),
			gd('ir', '+- hc idx 0'),
			gd('it', '+- vc 0 idy'),
			gd('ib', '+- vc idy 0'),
		],
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'ir', 'ib'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd4', 'il', 'ib'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'il', 'it'),
			cxn('3cd4', 'hc', 't'),
			cxn('3cd4', 'x1', 'y1'),
		],
	},

	verticalScroll: {
		avLst: { adj: 12500 },
		gdLst: [gd('a', 'pin 0 adj 25000'), gd('ch', '*/ ss a 100000'), gd('x6', '+- r 0 ch')],
		sites: [
			cxn('3cd4', 'hc', 't'),
			cxn('0', 'ch', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'x6', 'vc'),
		],
	},

	wave: {
		avLst: { adj1: 12500, adj2: 0 },
		gdLst: [
			gd('a1', 'pin 0 adj1 20000'),
			gd('a2', 'pin -10000 adj2 10000'),
			gd('y1', '*/ h a1 100000'),
			gd('y4', '+- b 0 y1'),
			gd('dx1', '*/ w a2 100000'),
			gd('x1', 'abs dx1'),
			gd('x9', '+- r 0 x1'),
			gd('xAdj', '+- hc dx1 0'),
			gd('xAdj2', '+- hc 0 dx1'),
		],
		sites: [
			cxn('cd4', 'xAdj2', 'y1'),
			cxn('cd2', 'x1', 'vc'),
			cxn('3cd4', 'xAdj', 'y4'),
			cxn('0', 'x9', 'vc'),
		],
	},
};
