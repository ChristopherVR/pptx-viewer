/**
 * Connection sites for the block-arrow and chevron-family presets:
 * `rightArrow`, `leftArrow`, `upArrow`, `downArrow`, `leftRightArrow`,
 * `upDownArrow`, `quadArrow`, `chevron`, `homePlate`.
 *
 * See `preset-connection-sites-quads.ts` for the provenance note; same source
 * (`presetShapeDefinitions.xml`), same transcription method.
 *
 * @module render/preset-connection-sites-arrows
 */
import type { PresetConnectionSiteDefinition } from './preset-connection-sites-types';
import { CARDINAL_SITES, cxn, gd } from './preset-connection-sites-types';

export const ARROW_CONNECTION_SITES: Record<string, PresetConnectionSiteDefinition> = {
	rightArrow: {
		avLst: { adj1: 50000, adj2: 50000 },
		gdLst: [
			gd('maxAdj2', '*/ 100000 w ss'),
			gd('a2', 'pin 0 adj2 maxAdj2'),
			gd('dx1', '*/ ss a2 100000'),
			gd('x1', '+- r 0 dx1'),
		],
		sites: [
			cxn('3cd4', 'x1', 't'),
			cxn('cd2', 'l', 'vc'),
			cxn('cd4', 'x1', 'b'),
			cxn('0', 'r', 'vc'),
		],
	},

	leftArrow: {
		avLst: { adj1: 50000, adj2: 50000 },
		gdLst: [
			gd('maxAdj2', '*/ 100000 w ss'),
			gd('a2', 'pin 0 adj2 maxAdj2'),
			gd('dx2', '*/ ss a2 100000'),
			gd('x2', '+- l dx2 0'),
		],
		sites: [
			cxn('3cd4', 'x2', 't'),
			cxn('cd2', 'l', 'vc'),
			cxn('cd4', 'x2', 'b'),
			cxn('0', 'r', 'vc'),
		],
	},

	upArrow: {
		avLst: { adj1: 50000, adj2: 50000 },
		gdLst: [
			gd('maxAdj2', '*/ 100000 h ss'),
			gd('a2', 'pin 0 adj2 maxAdj2'),
			gd('dy2', '*/ ss a2 100000'),
			gd('y2', '+- t dy2 0'),
		],
		sites: [
			cxn('3cd4', 'hc', 't'),
			cxn('cd2', 'l', 'y2'),
			cxn('cd4', 'hc', 'b'),
			cxn('0', 'r', 'y2'),
		],
	},

	downArrow: {
		avLst: { adj1: 50000, adj2: 50000 },
		gdLst: [
			gd('maxAdj2', '*/ 100000 h ss'),
			gd('a2', 'pin 0 adj2 maxAdj2'),
			gd('dy1', '*/ ss a2 100000'),
			gd('y1', '+- b 0 dy1'),
		],
		sites: [
			cxn('3cd4', 'hc', 't'),
			cxn('cd2', 'l', 'y1'),
			cxn('cd4', 'hc', 'b'),
			cxn('0', 'r', 'y1'),
		],
	},

	leftRightArrow: {
		avLst: { adj1: 50000, adj2: 50000 },
		gdLst: [
			gd('maxAdj2', '*/ 50000 w ss'),
			gd('a2', 'pin 0 adj2 maxAdj2'),
			gd('x2', '*/ ss a2 100000'),
			gd('x3', '+- r 0 x2'),
		],
		sites: [
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'x3', 'b'),
			cxn('cd4', 'x2', 'b'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'x2', 't'),
			cxn('3cd4', 'x3', 't'),
		],
	},

	upDownArrow: {
		avLst: { adj1: 50000, adj2: 50000 },
		gdLst: [
			gd('maxAdj2', '*/ 50000 h ss'),
			gd('a2', 'pin 0 adj2 maxAdj2'),
			gd('y2', '*/ ss a2 100000'),
			gd('y3', '+- b 0 y2'),
		],
		sites: [
			cxn('3cd4', 'hc', 't'),
			cxn('cd2', 'l', 'y2'),
			cxn('cd2', 'l', 'y3'),
			cxn('cd4', 'hc', 'b'),
			cxn('0', 'r', 'y3'),
			cxn('0', 'r', 'y2'),
		],
	},

	// quadArrow's cxnLst is the plain 4 cardinals: the `x1`..`ir` cross-shaft
	// guides it computes exist only for the path.
	quadArrow: { avLst: { adj1: 22500, adj2: 22500, adj3: 22500 }, sites: CARDINAL_SITES },

	chevron: {
		avLst: { adj: 50000 },
		gdLst: [
			gd('maxAdj', '*/ 100000 w ss'),
			gd('a', 'pin 0 adj maxAdj'),
			gd('x1', '*/ ss a 100000'),
			gd('x2', '+- r 0 x1'),
			gd('x3', '*/ x2 1 2'),
		],
		sites: [
			cxn('3cd4', 'x3', 't'),
			cxn('cd2', 'x1', 'vc'),
			cxn('cd4', 'x3', 'b'),
			cxn('0', 'r', 'vc'),
		],
	},

	homePlate: {
		avLst: { adj: 50000 },
		gdLst: [
			gd('maxAdj', '*/ 100000 w ss'),
			gd('a', 'pin 0 adj maxAdj'),
			gd('dx1', '*/ ss a 100000'),
			gd('x1', '+- r 0 dx1'),
			gd('x2', '*/ x1 1 2'),
		],
		sites: [
			cxn('3cd4', 'x2', 't'),
			cxn('cd2', 'l', 'vc'),
			cxn('cd4', 'x1', 'b'),
			cxn('0', 'r', 'vc'),
		],
	},
};
