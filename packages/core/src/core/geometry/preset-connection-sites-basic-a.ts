/**
 * Connection sites for basic presets, part 1 (alphabetical: arc..decagon):
 * `arc`, `bevel`, `blockArc`, `can`, `chord`, `cloud`, `cube`, `decagon`.
 *
 * See `preset-connection-sites-quads.ts` for the provenance note; same source
 * (`presetShapeDefinitions.xml`), same transcription method.
 *
 * @module render/preset-connection-sites-basic-a
 */
import type { PresetConnectionSiteDefinition } from './preset-connection-sites-types';
import { cxn, gd } from './preset-connection-sites-types';

export const BASIC_SHAPE_CONNECTION_SITES_A: Record<string, PresetConnectionSiteDefinition> = {
	arc: {
		avLst: { adj1: 16200000, adj2: 0 },
		gdLst: [
			gd('stAng', 'pin 0 adj1 21599999'),
			gd('enAng', 'pin 0 adj2 21599999'),
			gd('wt1', 'sin wd2 stAng'),
			gd('ht1', 'cos hd2 stAng'),
			gd('dx1', 'cat2 wd2 ht1 wt1'),
			gd('dy1', 'sat2 hd2 ht1 wt1'),
			gd('wt2', 'sin wd2 enAng'),
			gd('ht2', 'cos hd2 enAng'),
			gd('dx2', 'cat2 wd2 ht2 wt2'),
			gd('dy2', 'sat2 hd2 ht2 wt2'),
			gd('x1', '+- hc dx1 0'),
			gd('y1', '+- vc dy1 0'),
			gd('x2', '+- hc dx2 0'),
			gd('y2', '+- vc dy2 0'),
		],
		sites: [cxn('cang1', 'x1', 'y1'), cxn('cang3', 'hc', 'vc'), cxn('cang2', 'x2', 'y2')],
	},

	bevel: {
		avLst: { adj: 12500 },
		gdLst: [
			gd('a', 'pin 0 adj 50000'),
			gd('x1', '*/ ss a 100000'),
			gd('x2', '+- r 0 x1'),
			gd('y2', '+- b 0 x1'),
		],
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('0', 'x2', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd4', 'hc', 'y2'),
			cxn('cd2', 'l', 'vc'),
			cxn('cd2', 'x1', 'vc'),
			cxn('3cd4', 'hc', 't'),
			cxn('3cd4', 'hc', 'x1'),
		],
	},

	blockArc: {
		avLst: { adj1: 10800000, adj2: 0, adj3: 25000 },
		gdLst: [
			gd('stAng', 'pin 0 adj1 21599999'),
			gd('istAng', 'pin 0 adj2 21599999'),
			gd('a3', 'pin 0 adj3 50000'),
			gd('wt1', 'sin wd2 stAng'),
			gd('ht1', 'cos hd2 stAng'),
			gd('wt3', 'sin wd2 istAng'),
			gd('ht3', 'cos hd2 istAng'),
			gd('dx1', 'cat2 wd2 ht1 wt1'),
			gd('dy1', 'sat2 hd2 ht1 wt1'),
			gd('dx3', 'cat2 wd2 ht3 wt3'),
			gd('dy3', 'sat2 hd2 ht3 wt3'),
			gd('x1', '+- hc dx1 0'),
			gd('y1', '+- vc dy1 0'),
			gd('x3', '+- hc dx3 0'),
			gd('y3', '+- vc dy3 0'),
			gd('dr', '*/ ss a3 100000'),
			gd('iwd2', '+- wd2 0 dr'),
			gd('ihd2', '+- hd2 0 dr'),
			gd('wt2', 'sin iwd2 istAng'),
			gd('ht2', 'cos ihd2 istAng'),
			gd('wt4', 'sin iwd2 stAng'),
			gd('ht4', 'cos ihd2 stAng'),
			gd('dx2', 'cat2 iwd2 ht2 wt2'),
			gd('dy2', 'sat2 ihd2 ht2 wt2'),
			gd('dx4', 'cat2 iwd2 ht4 wt4'),
			gd('dy4', 'sat2 ihd2 ht4 wt4'),
			gd('x2', '+- hc dx2 0'),
			gd('y2', '+- vc dy2 0'),
			gd('x4', '+- hc dx4 0'),
			gd('y4', '+- vc dy4 0'),
			gd('x5', '+/ x1 x4 2'),
			gd('y5', '+/ y1 y4 2'),
			gd('x6', '+/ x3 x2 2'),
			gd('y6', '+/ y3 y2 2'),
		],
		sites: [cxn('cang1', 'x5', 'y5'), cxn('cang2', 'x6', 'y6'), cxn('cang3', 'hc', 'vc')],
	},

	can: {
		avLst: { adj: 25000 },
		gdLst: [
			gd('maxAdj', '*/ 50000 h ss'),
			gd('a', 'pin 0 adj maxAdj'),
			gd('y1', '*/ ss a 200000'),
			gd('y2', '+- y1 y1 0'),
		],
		sites: [
			cxn('3cd4', 'hc', 'y2'),
			cxn('3cd4', 'hc', 't'),
			cxn('cd2', 'l', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('0', 'r', 'vc'),
		],
	},

	chord: {
		avLst: { adj1: 2700000, adj2: 16200000 },
		gdLst: [
			gd('stAng', 'pin 0 adj1 21599999'),
			gd('enAng', 'pin 0 adj2 21599999'),
			gd('wt1', 'sin wd2 stAng'),
			gd('ht1', 'cos hd2 stAng'),
			gd('dx1', 'cat2 wd2 ht1 wt1'),
			gd('dy1', 'sat2 hd2 ht1 wt1'),
			gd('wt2', 'sin wd2 enAng'),
			gd('ht2', 'cos hd2 enAng'),
			gd('dx2', 'cat2 wd2 ht2 wt2'),
			gd('dy2', 'sat2 hd2 ht2 wt2'),
			gd('x1', '+- hc dx1 0'),
			gd('y1', '+- vc dy1 0'),
			gd('x2', '+- hc dx2 0'),
			gd('y2', '+- vc dy2 0'),
			gd('x3', '+/ x1 x2 2'),
			gd('y3', '+/ y1 y2 2'),
		],
		sites: [cxn('stAng', 'x1', 'y1'), cxn('enAng', 'x2', 'y2'), cxn('midAng', 'x3', 'y3')],
	},

	cloud: {
		gdLst: [
			gd('g27', '*/ w 67 21600'),
			gd('g28', '*/ h 21577 21600'),
			gd('g29', '*/ w 21582 21600'),
			gd('g30', '*/ h 1235 21600'),
		],
		sites: [
			cxn('0', 'g29', 'vc'),
			cxn('cd4', 'hc', 'g28'),
			cxn('cd2', 'g27', 'vc'),
			cxn('3cd4', 'hc', 'g30'),
		],
	},

	cube: {
		avLst: { adj: 25000 },
		gdLst: [
			gd('a', 'pin 0 adj 100000'),
			gd('y1', '*/ ss a 100000'),
			gd('y4', '+- b 0 y1'),
			gd('y2', '*/ y4 1 2'),
			gd('y3', '+/ y1 b 2'),
			gd('x4', '+- r 0 y1'),
			gd('x2', '*/ x4 1 2'),
			gd('x3', '+/ y1 r 2'),
		],
		sites: [
			cxn('3cd4', 'x3', 't'),
			cxn('3cd4', 'x2', 'y1'),
			cxn('cd2', 'l', 'y3'),
			cxn('cd4', 'x2', 'b'),
			cxn('0', 'x4', 'y3'),
			cxn('0', 'r', 'y2'),
		],
	},

	decagon: {
		avLst: { vf: 105146 },
		gdLst: [
			gd('shd2', '*/ hd2 vf 100000'),
			gd('dx1', 'cos wd2 2160000'),
			gd('dx2', 'cos wd2 4320000'),
			gd('x1', '+- hc 0 dx1'),
			gd('x2', '+- hc 0 dx2'),
			gd('x3', '+- hc dx2 0'),
			gd('x4', '+- hc dx1 0'),
			gd('dy1', 'sin shd2 4320000'),
			gd('dy2', 'sin shd2 2160000'),
			gd('y1', '+- vc 0 dy1'),
			gd('y2', '+- vc 0 dy2'),
			gd('y3', '+- vc dy2 0'),
			gd('y4', '+- vc dy1 0'),
		],
		sites: [
			cxn('0', 'x4', 'y2'),
			cxn('0', 'r', 'vc'),
			cxn('0', 'x4', 'y3'),
			cxn('cd4', 'x3', 'y4'),
			cxn('cd4', 'x2', 'y4'),
			cxn('cd2', 'x1', 'y3'),
			cxn('cd2', 'l', 'vc'),
			cxn('cd2', 'x1', 'y2'),
			cxn('3cd4', 'x2', 'y1'),
			cxn('3cd4', 'x3', 'y1'),
		],
	},
};
