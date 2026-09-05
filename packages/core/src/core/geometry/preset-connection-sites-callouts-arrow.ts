/**
 * Connection sites for the arrow- and wedge-leader callout family:
 * `leftArrowCallout`, `rightArrowCallout`, `upArrowCallout`, `downArrowCallout`,
 * `leftRightArrowCallout`, `upDownArrowCallout`, `quadArrowCallout`,
 * `wedgeEllipseCallout`, `wedgeRectCallout`, `wedgeRoundRectCallout`.
 *
 * See `preset-connection-sites-quads.ts` for the provenance note; same source
 * (`presetShapeDefinitions.xml`), same transcription method.
 *
 * @module render/preset-connection-sites-callouts-arrow
 */
import type { PresetConnectionSiteDefinition } from './preset-connection-sites-types';
import { CARDINAL_SITES, cxn, gd } from './preset-connection-sites-types';

export const ARROW_CALLOUT_CONNECTION_SITES: Record<string, PresetConnectionSiteDefinition> = {
	leftArrowCallout: {
		avLst: { adj4: 64977, adj3: 25000 },
		gdLst: [
			gd('maxAdj3', '*/ 100000 w ss'),
			gd('a3', 'pin 0 adj3 maxAdj3'),
			gd('q2', '*/ a3 ss w'),
			gd('maxAdj4', '+- 100000 0 q2'),
			gd('a4', 'pin 0 adj4 maxAdj4'),
			gd('dx2', '*/ w a4 100000'),
			gd('x2', '+- r 0 dx2'),
			gd('x3', '+/ x2 r 2'),
		],
		sites: [
			cxn('3cd4', 'x3', 't'),
			cxn('cd2', 'l', 'vc'),
			cxn('cd4', 'x3', 'b'),
			cxn('0', 'r', 'vc'),
		],
	},

	rightArrowCallout: {
		avLst: { adj4: 64977, adj3: 25000 },
		gdLst: [
			gd('maxAdj3', '*/ 100000 w ss'),
			gd('a3', 'pin 0 adj3 maxAdj3'),
			gd('q2', '*/ a3 ss w'),
			gd('maxAdj4', '+- 100000 0 q2'),
			gd('a4', 'pin 0 adj4 maxAdj4'),
			gd('x2', '*/ w a4 100000'),
			gd('x1', '*/ x2 1 2'),
		],
		sites: [
			cxn('3cd4', 'x1', 't'),
			cxn('cd2', 'l', 'vc'),
			cxn('cd4', 'x1', 'b'),
			cxn('0', 'r', 'vc'),
		],
	},

	upArrowCallout: {
		avLst: { adj4: 64977, adj3: 25000 },
		gdLst: [
			gd('maxAdj3', '*/ 100000 h ss'),
			gd('a3', 'pin 0 adj3 maxAdj3'),
			gd('q2', '*/ a3 ss h'),
			gd('maxAdj4', '+- 100000 0 q2'),
			gd('a4', 'pin 0 adj4 maxAdj4'),
			gd('dy2', '*/ h a4 100000'),
			gd('y2', '+- b 0 dy2'),
		],
		sites: [
			cxn('3cd4', 'hc', 't'),
			cxn('cd2', 'l', 'y2'),
			cxn('cd4', 'hc', 'b'),
			cxn('0', 'r', 'y2'),
		],
	},

	downArrowCallout: {
		avLst: { adj4: 64977, adj3: 25000 },
		gdLst: [
			gd('maxAdj3', '*/ 100000 h ss'),
			gd('a3', 'pin 0 adj3 maxAdj3'),
			gd('q2', '*/ a3 ss h'),
			gd('maxAdj4', '+- 100000 0 q2'),
			gd('a4', 'pin 0 adj4 maxAdj4'),
			gd('y2', '*/ h a4 100000'),
			gd('y1', '*/ y2 1 2'),
		],
		sites: [
			cxn('3cd4', 'hc', 't'),
			cxn('cd2', 'l', 'y1'),
			cxn('cd4', 'hc', 'b'),
			cxn('0', 'r', 'y1'),
		],
	},

	leftRightArrowCallout: { sites: CARDINAL_SITES },

	upDownArrowCallout: { sites: CARDINAL_SITES },

	quadArrowCallout: { sites: CARDINAL_SITES },

	wedgeEllipseCallout: {
		avLst: { adj1: -20833, adj2: 62500 },
		gdLst: [
			gd('dxPos', '*/ w adj1 100000'),
			gd('dyPos', '*/ h adj2 100000'),
			gd('xPos', '+- hc dxPos 0'),
			gd('yPos', '+- vc dyPos 0'),
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
			cxn('cd4', 'il', 'ib'),
			cxn('cd4', 'hc', 'b'),
			cxn('cd4', 'ir', 'ib'),
			cxn('0', 'r', 'vc'),
			cxn('3cd4', 'ir', 'it'),
			cxn('pang', 'xPos', 'yPos'),
		],
	},

	wedgeRectCallout: {
		avLst: { adj1: -20833, adj2: 62500 },
		gdLst: [
			gd('dxPos', '*/ w adj1 100000'),
			gd('dyPos', '*/ h adj2 100000'),
			gd('xPos', '+- hc dxPos 0'),
			gd('yPos', '+- vc dyPos 0'),
		],
		sites: [
			cxn('3cd4', 'hc', 't'),
			cxn('cd2', 'l', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'xPos', 'yPos'),
		],
	},

	wedgeRoundRectCallout: {
		avLst: { adj1: -20833, adj2: 62500 },
		gdLst: [
			gd('dxPos', '*/ w adj1 100000'),
			gd('dyPos', '*/ h adj2 100000'),
			gd('xPos', '+- hc dxPos 0'),
			gd('yPos', '+- vc dyPos 0'),
		],
		sites: [
			cxn('3cd4', 'hc', 't'),
			cxn('cd2', 'l', 'vc'),
			cxn('cd4', 'hc', 'b'),
			cxn('0', 'r', 'vc'),
			cxn('cd4', 'xPos', 'yPos'),
		],
	},
};
