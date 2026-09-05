/**
 * Text-inset rects for `parallelogram`, `trapezoid`, `nonIsoscelesTrapezoid`,
 * `mathMultiply`. `parallelogram`/`trapezoid`/`mathMultiply` are gap G1's
 * three named holdouts (see this file's own report for the COM-verification
 * status of each).
 *
 * Transcribed verbatim from ECMA-376's `presetShapeDefinitions.xml` `<rect>`
 * element (the same source, same method as `preset-connection-sites-*.ts`).
 * See `preset-text-rect-types.ts` for why this is a separate override table
 * rather than an edit to `preset-shape-definitions-*.ts`.
 *
 * @module render/preset-text-rect-quads
 */
import { gd } from './preset-connection-sites-types';
import type { PresetTextRectDefinition } from './preset-text-rect-types';

export const QUAD_TEXT_RECTS: Record<string, PresetTextRectDefinition> = {
	parallelogram: {
		avLst: { adj: 25000 },
		gdLst: [
			gd('maxAdj', '*/ 100000 w ss'),
			gd('a', 'pin 0 adj maxAdj'),
			gd('q1', '*/ 5 a maxAdj'),
			gd('q2', '+/ 1 q1 12'),
			gd('il', '*/ q2 w 1'),
			gd('it', '*/ q2 h 1'),
			gd('ir', '+- r 0 il'),
			gd('ib', '+- b 0 it'),
		],
		rect: { l: 'il', t: 'it', r: 'ir', b: 'ib' },
	},

	trapezoid: {
		avLst: { adj: 25000 },
		gdLst: [
			gd('maxAdj', '*/ 50000 w ss'),
			gd('a', 'pin 0 adj maxAdj'),
			gd('il', '*/ wd3 a maxAdj'),
			gd('it', '*/ hd3 a maxAdj'),
			gd('ir', '+- r 0 il'),
		],
		rect: { l: 'il', t: 'it', r: 'ir', b: 'b' },
	},

	nonIsoscelesTrapezoid: {
		avLst: { adj1: 25000, adj2: 25000 },
		gdLst: [
			gd('maxAdj', '*/ 50000 w ss'),
			gd('a1', 'pin 0 adj1 maxAdj'),
			gd('a2', 'pin 0 adj2 maxAdj'),
			gd('il', '*/ wd3 a1 maxAdj'),
			gd('adjm', 'max a1 a2'),
			gd('it', '*/ hd3 adjm maxAdj'),
			gd('irt', '*/ wd3 a2 maxAdj'),
			gd('ir', '+- r 0 irt'),
		],
		rect: { l: 'il', t: 'it', r: 'ir', b: 'b' },
	},

	mathMultiply: {
		avLst: { adj1: 23520 },
		gdLst: [
			gd('a1', 'pin 0 adj1 51965'),
			gd('th', '*/ ss a1 100000'),
			gd('a', 'at2 w h'),
			gd('sa', 'sin 1 a'),
			gd('ca', 'cos 1 a'),
			gd('dl', 'mod w h 0'),
			gd('rw', '*/ dl 51965 100000'),
			gd('lM', '+- dl 0 rw'),
			gd('xM', '*/ ca lM 2'),
			gd('yM', '*/ sa lM 2'),
			gd('dxAM', '*/ sa th 2'),
			gd('dyAM', '*/ ca th 2'),
			gd('xA', '+- xM 0 dxAM'),
			gd('yB', '+- yM 0 dyAM'),
			gd('xE', '+- r 0 xA'),
			gd('yH', '+- b 0 yB'),
		],
		rect: { l: 'xA', t: 'yB', r: 'xE', b: 'yH' },
	},
};
