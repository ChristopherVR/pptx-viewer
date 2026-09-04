/**
 * Connection sites for the regular-polygon and star presets: `pentagon`,
 * `hexagon`, `heptagon`, `octagon`, `plus`, `star4`, `star5`, `star6`, `star8`.
 *
 * See `preset-connection-sites-quads.ts` for the provenance note; same source
 * (`presetShapeDefinitions.xml`), same transcription method.
 *
 * @module render/preset-connection-sites-polygons
 */
import type { PresetConnectionSiteDefinition } from './preset-connection-sites-types';
import { cxn, gd } from './preset-connection-sites-types';

export const POLYGON_CONNECTION_SITES: Record<string, PresetConnectionSiteDefinition> = {
	pentagon: {
		avLst: { hf: 105146, vf: 110557 },
		gdLst: [
			gd('swd2', '*/ wd2 hf 100000'),
			gd('shd2', '*/ hd2 vf 100000'),
			gd('svc', '*/ vc  vf 100000'),
			gd('dx1', 'cos swd2 1080000'),
			gd('dx2', 'cos swd2 18360000'),
			gd('dy1', 'sin shd2 1080000'),
			gd('dy2', 'sin shd2 18360000'),
			gd('x1', '+- hc 0 dx1'),
			gd('x2', '+- hc 0 dx2'),
			gd('x3', '+- hc dx2 0'),
			gd('x4', '+- hc dx1 0'),
			gd('y1', '+- svc 0 dy1'),
			gd('y2', '+- svc 0 dy2'),
		],
		sites: [
			cxn('3cd4', 'hc', 't'),
			cxn('cd2', 'x1', 'y1'),
			cxn('cd4', 'x2', 'y2'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd4', 'x3', 'y2'),
			cxn('0', 'x4', 'y1'),
		],
	},

	hexagon: {
		avLst: { adj: 25000, vf: 115470 },
		gdLst: [
			gd('maxAdj', '*/ 50000 w ss'),
			gd('a', 'pin 0 adj maxAdj'),
			gd('shd2', '*/ hd2 vf 100000'),
			gd('x1', '*/ ss a 100000'),
			gd('x2', '+- r 0 x1'),
			gd('dy1', 'sin shd2 3600000'),
			gd('y1', '+- vc 0 dy1'),
			gd('y2', '+- vc dy1 0'),
		],
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'x2', 'y2'),
			cxn('cd4', 'x1', 'y2'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'x1', 'y1'),
			cxn('3cd4', 'x2', 'y1'),
		],
	},

	heptagon: {
		avLst: { hf: 102572, vf: 105210 },
		gdLst: [
			gd('swd2', '*/ wd2 hf 100000'),
			gd('shd2', '*/ hd2 vf 100000'),
			gd('svc', '*/ vc  vf 100000'),
			gd('dx1', '*/ swd2 97493 100000'),
			gd('dx2', '*/ swd2 78183 100000'),
			gd('dx3', '*/ swd2 43388 100000'),
			gd('dy1', '*/ shd2 62349 100000'),
			gd('dy2', '*/ shd2 22252 100000'),
			gd('dy3', '*/ shd2 90097 100000'),
			gd('x1', '+- hc 0 dx1'),
			gd('x2', '+- hc 0 dx2'),
			gd('x3', '+- hc 0 dx3'),
			gd('x4', '+- hc dx3 0'),
			gd('x5', '+- hc dx2 0'),
			gd('x6', '+- hc dx1 0'),
			gd('y1', '+- svc 0 dy1'),
			gd('y2', '+- svc dy2 0'),
			gd('y3', '+- svc dy3 0'),
		],
		sites: [
			cxn('0', 'x5', 'y1'),
			cxn('0', 'x6', 'y2'),
			cxn('cd4', 'x4', 'y3'),
			cxn('cd4', 'x3', 'y3'),
			cxn('cd2', 'x1', 'y2'),
			cxn('cd2', 'x2', 'y1'),
			cxn('3cd4', 'hc', 't'),
		],
	},

	octagon: {
		avLst: { adj: 29289 },
		gdLst: [
			gd('a', 'pin 0 adj 50000'),
			gd('x1', '*/ ss a 100000'),
			gd('x2', '+- r 0 x1'),
			gd('y2', '+- b 0 x1'),
		],
		sites: [
			cxn('0', 'r', 'x1'),
			cxn('0', 'r', 'y2'),
			cxn('cd4', 'x2', 'b'),
			cxn('cd4', 'x1', 'b'),
			cxn('cd2', 'l', 'y2'),
			cxn('cd2', 'l', 'x1'),
			cxn('3cd4', 'x1', 't'),
			cxn('3cd4', 'x2', 't'),
		],
	},

	plus: {
		avLst: { adj: 25000 },
		sites: [
			cxn('3cd4', 'hc', 't'),
			cxn('cd2', 'l', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('0', 'r', 'vc'),
		],
	},

	// star4's cxnLst is the plain 4 cardinals: the notch guides (`sx1`..`yAdj`)
	// it computes exist only for the path, not for any connection site.
	star4: {
		avLst: { adj: 12500 },
		sites: [
			cxn('3cd4', 'hc', 't'),
			cxn('cd2', 'l', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('0', 'r', 'vc'),
		],
	},

	star5: {
		avLst: { adj: 19098, hf: 105146, vf: 110557 },
		gdLst: [
			gd('swd2', '*/ wd2 hf 100000'),
			gd('shd2', '*/ hd2 vf 100000'),
			gd('svc', '*/ vc  vf 100000'),
			gd('dx1', 'cos swd2 1080000'),
			gd('dx2', 'cos swd2 18360000'),
			gd('dy1', 'sin shd2 1080000'),
			gd('dy2', 'sin shd2 18360000'),
			gd('x1', '+- hc 0 dx1'),
			gd('x2', '+- hc 0 dx2'),
			gd('x3', '+- hc dx2 0'),
			gd('x4', '+- hc dx1 0'),
			gd('y1', '+- svc 0 dy1'),
			gd('y2', '+- svc 0 dy2'),
		],
		sites: [
			cxn('3cd4', 'hc', 't'),
			cxn('cd2', 'x1', 'y1'),
			cxn('cd4', 'x2', 'y2'),
			cxn('cd4', 'x3', 'y2'),
			cxn('0', 'x4', 'y1'),
		],
	},

	star6: {
		avLst: { adj: 28868, hf: 115470 },
		gdLst: [
			gd('swd2', '*/ wd2 hf 100000'),
			gd('dx1', 'cos swd2 1800000'),
			gd('x1', '+- hc 0 dx1'),
			gd('x2', '+- hc dx1 0'),
			gd('y2', '+- vc hd4 0'),
		],
		sites: [
			cxn('0', 'x2', 'hd4'),
			cxn('0', 'x2', 'y2'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'x1', 'y2'),
			cxn('cd2', 'x1', 'hd4'),
			cxn('3cd4', 'hc', 't'),
		],
	},

	star8: {
		avLst: { adj: 37500 },
		gdLst: [
			gd('dx1', 'cos wd2 2700000'),
			gd('x1', '+- hc 0 dx1'),
			gd('x2', '+- hc dx1 0'),
			gd('dy1', 'sin hd2 2700000'),
			gd('y1', '+- vc 0 dy1'),
			gd('y2', '+- vc dy1 0'),
		],
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'x2', 'y2'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd4', 'x1', 'y2'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'x1', 'y1'),
			cxn('3cd4', 'hc', 't'),
			cxn('3cd4', 'x2', 'y1'),
		],
	},
};
