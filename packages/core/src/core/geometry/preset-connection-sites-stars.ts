/**
 * Connection sites for the higher-point star presets: `star7`, `star10`,
 * `star12`, `star16`, `star24`, `star32`. See `preset-connection-sites-polygons.ts`
 * for `star4`/`star5`/`star6`/`star8`.
 *
 * See `preset-connection-sites-quads.ts` for the provenance note; same source
 * (`presetShapeDefinitions.xml`), same transcription method.
 *
 * @module render/preset-connection-sites-stars
 */
import type { PresetConnectionSiteDefinition } from './preset-connection-sites-types';
import { CARDINAL_SITES, cxn, gd } from './preset-connection-sites-types';

export const STAR_CONNECTION_SITES: Record<string, PresetConnectionSiteDefinition> = {
	star7: {
		avLst: { vf: 105210, hf: 102572 },
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

	star10: {
		avLst: { hf: 105146 },
		gdLst: [
			gd('swd2', '*/ wd2 hf 100000'),
			gd('dx1', '*/ swd2 95106 100000'),
			gd('dx2', '*/ swd2 58779 100000'),
			gd('x1', '+- hc 0 dx1'),
			gd('x2', '+- hc 0 dx2'),
			gd('x3', '+- hc dx2 0'),
			gd('x4', '+- hc dx1 0'),
			gd('dy1', '*/ hd2 80902 100000'),
			gd('dy2', '*/ hd2 30902 100000'),
			gd('y1', '+- vc 0 dy1'),
			gd('y2', '+- vc 0 dy2'),
			gd('y3', '+- vc dy2 0'),
			gd('y4', '+- vc dy1 0'),
		],
		sites: [
			cxn('0', 'x4', 'y2'),
			cxn('0', 'x4', 'y3'),
			cxn('cd4', 'x3', 'y4'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd4', 'x2', 'y4'),
			cxn('cd2', 'x1', 'y3'),
			cxn('cd2', 'x1', 'y2'),
			cxn('3cd4', 'x2', 'y1'),
			cxn('3cd4', 'hc', 't'),
			cxn('3cd4', 'x3', 'y1'),
		],
	},

	star12: {
		gdLst: [
			gd('dx1', 'cos wd2 1800000'),
			gd('dy1', 'sin hd2 3600000'),
			gd('x1', '+- hc 0 dx1'),
			gd('x3', '*/ w 3 4'),
			gd('x4', '+- hc dx1 0'),
			gd('y1', '+- vc 0 dy1'),
			gd('y3', '*/ h 3 4'),
			gd('y4', '+- vc dy1 0'),
		],
		sites: [
			cxn('0', 'x4', 'hd4'),
			cxn('0', 'r', 'vc'),
			cxn('0', 'x4', 'y3'),
			cxn('cd4', 'x3', 'y4'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd4', 'wd4', 'y4'),
			cxn('cd2', 'x1', 'y3'),
			cxn('cd2', 'l', 'vc'),
			cxn('cd2', 'x1', 'hd4'),
			cxn('3cd4', 'wd4', 'y1'),
			cxn('3cd4', 'hc', 't'),
			cxn('3cd4', 'x3', 'y1'),
		],
	},

	star16: {
		gdLst: [
			gd('dx1', '*/ wd2 92388 100000'),
			gd('dx2', '*/ wd2 70711 100000'),
			gd('dx3', '*/ wd2 38268 100000'),
			gd('dy1', '*/ hd2 92388 100000'),
			gd('dy2', '*/ hd2 70711 100000'),
			gd('dy3', '*/ hd2 38268 100000'),
			gd('x1', '+- hc 0 dx1'),
			gd('x2', '+- hc 0 dx2'),
			gd('x3', '+- hc 0 dx3'),
			gd('x4', '+- hc dx3 0'),
			gd('x5', '+- hc dx2 0'),
			gd('x6', '+- hc dx1 0'),
			gd('y1', '+- vc 0 dy1'),
			gd('y2', '+- vc 0 dy2'),
			gd('y3', '+- vc 0 dy3'),
			gd('y4', '+- vc dy3 0'),
			gd('y5', '+- vc dy2 0'),
			gd('y6', '+- vc dy1 0'),
		],
		sites: [
			cxn('0', 'x5', 'y2'),
			cxn('0', 'x6', 'y3'),
			cxn('0', 'r', 'vc'),
			cxn('0', 'x6', 'y4'),
			cxn('0', 'x5', 'y5'),
			cxn('cd4', 'x4', 'y6'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd4', 'x3', 'y6'),
			cxn('cd2', 'x2', 'y5'),
			cxn('cd2', 'x1', 'y4'),
			cxn('cd2', 'l', 'vc'),
			cxn('cd2', 'x1', 'y3'),
			cxn('cd2', 'x2', 'y2'),
			cxn('3cd4', 'x3', 'y1'),
			cxn('3cd4', 'hc', 't'),
			cxn('3cd4', 'x4', 'y1'),
		],
	},

	star24: { sites: CARDINAL_SITES },

	star32: { sites: CARDINAL_SITES },
};
