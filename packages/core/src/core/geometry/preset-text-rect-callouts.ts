/**
 * Text-inset rects for the arrow/wedge callout family: `leftArrowCallout`,
 * `rightArrowCallout`, `upArrowCallout`, `downArrowCallout`,
 * `leftRightArrowCallout`, `upDownArrowCallout`, `wedgeEllipseCallout`,
 * `wedgeRoundRectCallout`.
 *
 * Transcribed verbatim from ECMA-376's `presetShapeDefinitions.xml` `<rect>`
 * element (the same source, same method as `preset-connection-sites-*.ts`).
 * See `preset-text-rect-types.ts` for why this is a separate override table
 * rather than an edit to `preset-shape-definitions-*.ts`.
 *
 * @module render/preset-text-rect-callouts
 */
import { gd } from './preset-connection-sites-types';
import type { PresetTextRectDefinition } from './preset-text-rect-types';

export const CALLOUT_TEXT_RECTS: Record<string, PresetTextRectDefinition> = {
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
		],
		rect: { l: 'x2', t: 't', r: 'r', b: 'b' },
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
		],
		rect: { l: 'l', t: 't', r: 'x2', b: 'b' },
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
		rect: { l: 'l', t: 'y2', r: 'r', b: 'b' },
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
		],
		rect: { l: 'l', t: 't', r: 'r', b: 'y2' },
	},

	leftRightArrowCallout: {
		avLst: { adj4: 48123, adj3: 25000 },
		gdLst: [
			gd('maxAdj3', '*/ 50000 w ss'),
			gd('a3', 'pin 0 adj3 maxAdj3'),
			gd('q2', '*/ a3 ss wd2'),
			gd('maxAdj4', '+- 100000 0 q2'),
			gd('a4', 'pin 0 adj4 maxAdj4'),
			gd('dx2', '*/ w a4 200000'),
			gd('x2', '+- hc 0 dx2'),
			gd('x3', '+- hc dx2 0'),
		],
		rect: { l: 'x2', t: 't', r: 'x3', b: 'b' },
	},

	upDownArrowCallout: {
		avLst: { adj4: 48123, adj3: 25000 },
		gdLst: [
			gd('maxAdj3', '*/ 50000 h ss'),
			gd('a3', 'pin 0 adj3 maxAdj3'),
			gd('q2', '*/ a3 ss hd2'),
			gd('maxAdj4', '+- 100000 0 q2'),
			gd('a4', 'pin 0 adj4 maxAdj4'),
			gd('dy2', '*/ h a4 200000'),
			gd('y2', '+- vc 0 dy2'),
			gd('y3', '+- vc dy2 0'),
		],
		rect: { l: 'l', t: 'y2', r: 'r', b: 'y3' },
	},

	wedgeEllipseCallout: {
		gdLst: [
			gd('idx', 'cos wd2 2700000'),
			gd('idy', 'sin hd2 2700000'),
			gd('il', '+- hc 0 idx'),
			gd('ir', '+- hc idx 0'),
			gd('it', '+- vc 0 idy'),
			gd('ib', '+- vc idy 0'),
		],
		rect: { l: 'il', t: 'it', r: 'ir', b: 'ib' },
	},

	wedgeRoundRectCallout: {
		avLst: { adj3: 16667 },
		gdLst: [
			gd('u1', '*/ ss adj3 100000'),
			gd('il', '*/ u1 29289 100000'),
			gd('ir', '+- r 0 il'),
			gd('ib', '+- b 0 il'),
		],
		rect: { l: 'il', t: 'il', r: 'ir', b: 'ib' },
	},
};
