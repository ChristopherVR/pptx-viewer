/**
 * Text-inset rects for `leftRightArrow`, `quadArrow`, `leftRightUpArrow`,
 * `leftUpArrow`, `homePlate`.
 *
 * Transcribed verbatim from ECMA-376's `presetShapeDefinitions.xml` `<rect>`
 * element (the same source, same method as `preset-connection-sites-*.ts`).
 * See `preset-text-rect-types.ts` for why this is a separate override table
 * rather than an edit to `preset-shape-definitions-*.ts`.
 *
 * @module render/preset-text-rect-arrows
 */
import { gd } from './preset-connection-sites-types';
import type { PresetTextRectDefinition } from './preset-text-rect-types';

export const ARROW_TEXT_RECTS: Record<string, PresetTextRectDefinition> = {
	leftRightArrow: {
		avLst: { adj2: 50000, adj1: 50000 },
		gdLst: [
			gd('maxAdj2', '*/ 50000 w ss'),
			gd('a1', 'pin 0 adj1 100000'),
			gd('a2', 'pin 0 adj2 maxAdj2'),
			gd('x2', '*/ ss a2 100000'),
			gd('x3', '+- r 0 x2'),
			gd('dy', '*/ h a1 200000'),
			gd('y1', '+- vc 0 dy'),
			gd('y2', '+- vc dy 0'),
			gd('dx1', '*/ y1 x2 hd2'),
			gd('x1', '+- x2 0 dx1'),
			gd('x4', '+- x3 dx1 0'),
		],
		rect: { l: 'x1', t: 'y1', r: 'x4', b: 'y2' },
	},

	quadArrow: {
		avLst: { adj1: 22500, adj3: 22500, adj2: 22500 },
		gdLst: [
			gd('a2', 'pin 0 adj2 50000'),
			gd('maxAdj1', '*/ a2 2 1'),
			gd('a1', 'pin 0 adj1 maxAdj1'),
			gd('q1', '+- 100000 0 maxAdj1'),
			gd('maxAdj3', '*/ q1 1 2'),
			gd('a3', 'pin 0 adj3 maxAdj3'),
			gd('x1', '*/ ss a3 100000'),
			gd('dx2', '*/ ss a2 100000'),
			gd('dx3', '*/ ss a1 200000'),
			gd('y3', '+- vc 0 dx3'),
			gd('y4', '+- vc dx3 0'),
			gd('il', '*/ dx3 x1 dx2'),
			gd('ir', '+- r 0 il'),
		],
		rect: { l: 'il', t: 'y3', r: 'ir', b: 'y4' },
	},

	leftRightUpArrow: {
		avLst: { adj1: 25000, adj3: 25000, adj2: 25000 },
		gdLst: [
			gd('a2', 'pin 0 adj2 50000'),
			gd('maxAdj1', '*/ a2 2 1'),
			gd('a1', 'pin 0 adj1 maxAdj1'),
			gd('q1', '+- 100000 0 maxAdj1'),
			gd('maxAdj3', '*/ q1 1 2'),
			gd('a3', 'pin 0 adj3 maxAdj3'),
			gd('x1', '*/ ss a3 100000'),
			gd('dx2', '*/ ss a2 100000'),
			gd('dx3', '*/ ss a1 200000'),
			gd('y4', '+- b 0 dx2'),
			gd('y3', '+- y4 0 dx3'),
			gd('y5', '+- y4 dx3 0'),
			gd('il', '*/ dx3 x1 dx2'),
			gd('ir', '+- r 0 il'),
		],
		rect: { l: 'il', t: 'y3', r: 'ir', b: 'y5' },
	},

	leftUpArrow: {
		avLst: { adj1: 25000, adj3: 25000, adj2: 25000 },
		gdLst: [
			gd('a2', 'pin 0 adj2 50000'),
			gd('maxAdj1', '*/ a2 2 1'),
			gd('a1', 'pin 0 adj1 maxAdj1'),
			gd('maxAdj3', '+- 100000 0 maxAdj1'),
			gd('a3', 'pin 0 adj3 maxAdj3'),
			gd('x1', '*/ ss a3 100000'),
			gd('dx4', '*/ ss a2 100000'),
			gd('x4', '+- r 0 dx4'),
			gd('y4', '+- b 0 dx4'),
			gd('dx3', '*/ ss a1 200000'),
			gd('y3', '+- y4 0 dx3'),
			gd('y5', '+- y4 dx3 0'),
			gd('il', '*/ dx3 x1 dx4'),
		],
		rect: { l: 'il', t: 'y3', r: 'x4', b: 'y5' },
	},

	homePlate: {
		avLst: { adj: 50000 },
		gdLst: [
			gd('maxAdj', '*/ 100000 w ss'),
			gd('a', 'pin 0 adj maxAdj'),
			gd('dx1', '*/ ss a 100000'),
			gd('x1', '+- r 0 dx1'),
			gd('ir', '+/ x1 r 2'),
		],
		rect: { l: 'l', t: 't', r: 'ir', b: 'b' },
	},
};
