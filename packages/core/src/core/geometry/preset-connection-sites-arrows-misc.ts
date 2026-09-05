/**
 * Connection sites for the remaining block-arrow variants:
 * `leftRightUpArrow`, `leftUpArrow`, `notchedRightArrow`, `stripedRightArrow`,
 * `swooshArrow`, `uturnArrow`.
 *
 * See `preset-connection-sites-quads.ts` for the provenance note; same source
 * (`presetShapeDefinitions.xml`), same transcription method.
 *
 * @module render/preset-connection-sites-arrows-misc
 */
import type { PresetConnectionSiteDefinition } from './preset-connection-sites-types';
import { cxn, gd } from './preset-connection-sites-types';

export const MISC_ARROW_CONNECTION_SITES: Record<string, PresetConnectionSiteDefinition> = {
	leftRightUpArrow: {
		avLst: { adj2: 25000, adj1: 25000 },
		gdLst: [
			gd('a2', 'pin 0 adj2 50000'),
			gd('maxAdj1', '*/ a2 2 1'),
			gd('a1', 'pin 0 adj1 maxAdj1'),
			gd('dx2', '*/ ss a2 100000'),
			gd('dx3', '*/ ss a1 200000'),
			gd('y4', '+- b 0 dx2'),
			gd('y5', '+- y4 dx3 0'),
		],
		sites: [
			cxn('3cd4', 'hc', 't'),
			cxn('cd2', 'l', 'y4'),
			cxn('cd4', 'hc', 'y5'),
			cxn('0', 'r', 'y4'),
		],
	},

	leftUpArrow: {
		avLst: { adj3: 25000, adj2: 25000, adj1: 25000 },
		gdLst: [
			gd('a2', 'pin 0 adj2 50000'),
			gd('maxAdj1', '*/ a2 2 1'),
			gd('a1', 'pin 0 adj1 maxAdj1'),
			gd('maxAdj3', '+- 100000 0 maxAdj1'),
			gd('a3', 'pin 0 adj3 maxAdj3'),
			gd('x1', '*/ ss a3 100000'),
			gd('dx2', '*/ ss a2 50000'),
			gd('x2', '+- r 0 dx2'),
			gd('y2', '+- b 0 dx2'),
			gd('dx4', '*/ ss a2 100000'),
			gd('x4', '+- r 0 dx4'),
			gd('y4', '+- b 0 dx4'),
			gd('dx3', '*/ ss a1 200000'),
			gd('x5', '+- x4 dx3 0'),
			gd('y5', '+- y4 dx3 0'),
			gd('cx1', '+/ x1 x5 2'),
			gd('cy1', '+/ x1 y5 2'),
		],
		sites: [
			cxn('3cd4', 'x4', 't'),
			cxn('cd2', 'x2', 'x1'),
			cxn('3cd4', 'x1', 'y2'),
			cxn('cd2', 'l', 'y4'),
			cxn('cd4', 'x1', 'b'),
			cxn('cd4', 'cx1', 'y5'),
			cxn('0', 'x5', 'cy1'),
			cxn('0', 'r', 'x1'),
		],
	},

	notchedRightArrow: {
		avLst: { adj2: 50000, adj1: 50000 },
		gdLst: [
			gd('maxAdj2', '*/ 100000 w ss'),
			gd('a1', 'pin 0 adj1 100000'),
			gd('a2', 'pin 0 adj2 maxAdj2'),
			gd('dx2', '*/ ss a2 100000'),
			gd('x2', '+- r 0 dx2'),
			gd('dy1', '*/ h a1 200000'),
			gd('x1', '*/ dy1 dx2 hd2'),
		],
		sites: [
			cxn('3cd4', 'x2', 't'),
			cxn('cd2', 'x1', 'vc'),
			cxn('cd4', 'x2', 'b'),
			cxn('0', 'r', 'vc'),
		],
	},

	stripedRightArrow: {
		avLst: { adj2: 50000 },
		gdLst: [
			gd('maxAdj2', '*/ 84375 w ss'),
			gd('a2', 'pin 0 adj2 maxAdj2'),
			gd('dx5', '*/ ss a2 100000'),
			gd('x5', '+- r 0 dx5'),
		],
		sites: [
			cxn('3cd4', 'x5', 't'),
			cxn('cd2', 'l', 'vc'),
			cxn('cd4', 'x5', 'b'),
			cxn('0', 'r', 'vc'),
		],
	},

	swooshArrow: {
		avLst: { adj2: 16667, adj1: 25000 },
		gdLst: [
			gd('a1', 'pin 1 adj1 75000'),
			gd('maxAdj2', '*/ 70000 w ss'),
			gd('a2', 'pin 0 adj2 maxAdj2'),
			gd('ad1', '*/ h a1 100000'),
			gd('ad2', '*/ ss a2 100000'),
			gd('xB', '+- r 0 ad2'),
			gd('yB', '+- t ssd8 0'),
			gd('alfa', '*/ cd4 1 14'),
			gd('dx0', 'tan ssd8 alfa'),
			gd('xC', '+- xB 0 dx0'),
			gd('dx1', 'tan ad1 alfa'),
			gd('yF', '+- yB ad1 0'),
			gd('xF', '+- xB dx1 0'),
			gd('xE', '+- xF dx0 0'),
			gd('yE', '+- yF ssd8 0'),
			gd('dy2', '+- yE 0 t'),
			gd('dy22', '*/ dy2 1 2'),
			gd('dy3', '*/ h 1 20'),
			gd('yD', '+- t dy22 dy3'),
		],
		sites: [
			cxn('cd4', 'l', 'b'),
			cxn('3cd4', 'xC', 't'),
			cxn('0', 'r', 'yD'),
			cxn('cd4', 'xE', 'yE'),
		],
	},

	uturnArrow: {
		avLst: { adj5: 75000, adj2: 25000, adj3: 25000, adj1: 25000 },
		gdLst: [
			gd('a2', 'pin 0 adj2 25000'),
			gd('maxAdj1', '*/ a2 2 1'),
			gd('a1', 'pin 0 adj1 maxAdj1'),
			gd('q2', '*/ a1 ss h'),
			gd('q3', '+- 100000 0 q2'),
			gd('maxAdj3', '*/ q3 h ss'),
			gd('a3', 'pin 0 adj3 maxAdj3'),
			gd('q1', '+- a3 a1 0'),
			gd('minAdj5', '*/ q1 ss h'),
			gd('a5', 'pin minAdj5 adj5 100000'),
			gd('th', '*/ ss a1 100000'),
			gd('aw2', '*/ ss a2 100000'),
			gd('th2', '*/ th 1 2'),
			gd('dh2', '+- aw2 0 th2'),
			gd('y5', '*/ h a5 100000'),
			gd('ah', '*/ ss a3 100000'),
			gd('y4', '+- y5 0 ah'),
			gd('x8', '+- r 0 aw2'),
			gd('x6', '+- x8 0 aw2'),
			gd('x7', '+- x6 dh2 0'),
			gd('cx', '+/ th x7 2'),
		],
		sites: [
			cxn('cd4', 'x6', 'y4'),
			cxn('cd4', 'x8', 'y5'),
			cxn('0', 'r', 'y4'),
			cxn('3cd4', 'cx', 't'),
			cxn('cd4', 'th2', 'b'),
		],
	},
};
