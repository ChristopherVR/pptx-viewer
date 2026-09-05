/**
 * Connection sites for `corner`, `cornerTabs`, `plaque`, `plaqueTabs`, `squareTabs`.
 *
 * See `preset-connection-sites-quads.ts` for the provenance note; same source
 * (`presetShapeDefinitions.xml`), same transcription method.
 *
 * @module render/preset-connection-sites-tabs
 */
import type { PresetConnectionSiteDefinition } from './preset-connection-sites-types';
import { CARDINAL_SITES, cxn, gd } from './preset-connection-sites-types';

export const TAB_CONNECTION_SITES: Record<string, PresetConnectionSiteDefinition> = {
	corner: {
		avLst: { adj2: 50000, adj1: 50000 },
		gdLst: [
			gd('maxAdj1', '*/ 100000 h ss'),
			gd('maxAdj2', '*/ 100000 w ss'),
			gd('a1', 'pin 0 adj1 maxAdj1'),
			gd('a2', 'pin 0 adj2 maxAdj2'),
			gd('x1', '*/ ss a2 100000'),
			gd('dy1', '*/ ss a1 100000'),
			gd('y1', '+- b 0 dy1'),
			gd('cx1', '*/ x1 1 2'),
			gd('cy1', '+/ y1 b 2'),
		],
		sites: [
			cxn('0', 'r', 'cy1'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd2', 'l', 'vc'),
			cxn('3cd4', 'cx1', 't'),
		],
	},

	cornerTabs: {
		gdLst: [
			gd('md', 'mod w h 0'),
			gd('dx', '*/ 1 md 20'),
			gd('y1', '+- 0 b dx'),
			gd('x1', '+- 0 r dx'),
		],
		sites: [
			cxn('cd2', 'l', 't'),
			cxn('cd2', 'l', 'dx'),
			cxn('cd2', 'l', 'y1'),
			cxn('cd2', 'l', 'b'),
			cxn('3cd4', 'dx', 't'),
			cxn('3cd4', 'x1', 't'),
			cxn('cd4', 'dx', 'b'),
			cxn('cd4', 'x1', 'b'),
			cxn('0', 'r', 't'),
			cxn('0', 'r', 'dx'),
			cxn('0', 'r', 'y1'),
			cxn('0', 'r', 'b'),
		],
	},

	plaqueTabs: {
		gdLst: [
			gd('md', 'mod w h 0'),
			gd('dx', '*/ 1 md 20'),
			gd('y1', '+- 0 b dx'),
			gd('x1', '+- 0 r dx'),
		],
		sites: [
			cxn('cd2', 'l', 't'),
			cxn('cd2', 'l', 'dx'),
			cxn('cd2', 'l', 'y1'),
			cxn('cd2', 'l', 'b'),
			cxn('3cd4', 'dx', 't'),
			cxn('3cd4', 'x1', 't'),
			cxn('cd4', 'dx', 'b'),
			cxn('cd4', 'x1', 'b'),
			cxn('0', 'r', 't'),
			cxn('0', 'r', 'dx'),
			cxn('0', 'r', 'y1'),
			cxn('0', 'r', 'b'),
		],
	},

	squareTabs: {
		gdLst: [
			gd('md', 'mod w h 0'),
			gd('dx', '*/ 1 md 20'),
			gd('y1', '+- 0 b dx'),
			gd('x1', '+- 0 r dx'),
		],
		sites: [
			cxn('cd2', 'l', 't'),
			cxn('cd2', 'l', 'dx'),
			cxn('cd2', 'l', 'y1'),
			cxn('cd2', 'l', 'b'),
			cxn('cd2', 'dx', 'dx'),
			cxn('cd2', 'dx', 'x1'),
			cxn('3cd4', 'dx', 't'),
			cxn('3cd4', 'x1', 't'),
			cxn('cd4', 'dx', 'b'),
			cxn('cd4', 'x1', 'b'),
			cxn('0', 'r', 't'),
			cxn('0', 'r', 'dx'),
			cxn('0', 'r', 'y1'),
			cxn('0', 'r', 'b'),
			cxn('0', 'x1', 'dx'),
			cxn('0', 'x1', 'y1'),
		],
	},

	plaque: { sites: CARDINAL_SITES },
};
