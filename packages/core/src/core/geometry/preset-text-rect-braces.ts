/**
 * Text-inset rects for `bracePair`, `bracketPair`, `leftBrace`, `leftBracket`,
 * `rightBrace`, `rightBracket`.
 *
 * Transcribed verbatim from ECMA-376's `presetShapeDefinitions.xml` `<rect>`
 * element (the same source, same method as `preset-connection-sites-*.ts`).
 * See `preset-text-rect-types.ts` for why this is a separate override table
 * rather than an edit to `preset-shape-definitions-*.ts`.
 *
 * @module render/preset-text-rect-braces
 */
import { gd } from './preset-connection-sites-types';
import type { PresetTextRectDefinition } from './preset-text-rect-types';

export const BRACE_TEXT_RECTS: Record<string, PresetTextRectDefinition> = {
	bracePair: {
		avLst: { adj: 8333 },
		gdLst: [
			gd('a', 'pin 0 adj 25000'),
			gd('x1', '*/ ss a 100000'),
			gd('it', '*/ x1 29289 100000'),
			gd('il', '+- x1 it 0'),
			gd('ir', '+- r 0 il'),
			gd('ib', '+- b 0 it'),
		],
		rect: { l: 'il', t: 'il', r: 'ir', b: 'ib' },
	},

	bracketPair: {
		avLst: { adj: 16667 },
		gdLst: [
			gd('a', 'pin 0 adj 50000'),
			gd('x1', '*/ ss a 100000'),
			gd('il', '*/ x1 29289 100000'),
			gd('ir', '+- r 0 il'),
			gd('ib', '+- b 0 il'),
		],
		rect: { l: 'il', t: 'il', r: 'ir', b: 'ib' },
	},

	leftBrace: {
		avLst: { adj1: 8333, adj2: 50000 },
		gdLst: [
			gd('a2', 'pin 0 adj2 100000'),
			gd('q1', '+- 100000 0 a2'),
			gd('q2', 'min q1 a2'),
			gd('q3', '*/ q2 1 2'),
			gd('maxAdj1', '*/ q3 h ss'),
			gd('a1', 'pin 0 adj1 maxAdj1'),
			gd('y1', '*/ ss a1 100000'),
			gd('dx1', 'cos wd2 2700000'),
			gd('dy1', 'sin y1 2700000'),
			gd('il', '+- r 0 dx1'),
			gd('it', '+- y1 0 dy1'),
			gd('ib', '+- b dy1 y1'),
		],
		rect: { l: 'il', t: 'it', r: 'r', b: 'ib' },
	},

	leftBracket: {
		avLst: { adj: 8333 },
		gdLst: [
			gd('maxAdj', '*/ 50000 h ss'),
			gd('a', 'pin 0 adj maxAdj'),
			gd('y1', '*/ ss a 100000'),
			gd('dx1', 'cos w 2700000'),
			gd('dy1', 'sin y1 2700000'),
			gd('il', '+- r 0 dx1'),
			gd('it', '+- y1 0 dy1'),
			gd('ib', '+- b dy1 y1'),
		],
		rect: { l: 'il', t: 'it', r: 'r', b: 'ib' },
	},

	rightBrace: {
		avLst: { adj1: 8333, adj2: 50000 },
		gdLst: [
			gd('a2', 'pin 0 adj2 100000'),
			gd('q1', '+- 100000 0 a2'),
			gd('q2', 'min q1 a2'),
			gd('q3', '*/ q2 1 2'),
			gd('maxAdj1', '*/ q3 h ss'),
			gd('a1', 'pin 0 adj1 maxAdj1'),
			gd('y1', '*/ ss a1 100000'),
			gd('dx1', 'cos wd2 2700000'),
			gd('dy1', 'sin y1 2700000'),
			gd('ir', '+- l dx1 0'),
			gd('it', '+- y1 0 dy1'),
			gd('ib', '+- b dy1 y1'),
		],
		rect: { l: 'l', t: 'it', r: 'ir', b: 'ib' },
	},

	rightBracket: {
		avLst: { adj: 8333 },
		gdLst: [
			gd('maxAdj', '*/ 50000 h ss'),
			gd('a', 'pin 0 adj maxAdj'),
			gd('y1', '*/ ss a 100000'),
			gd('dx1', 'cos w 2700000'),
			gd('dy1', 'sin y1 2700000'),
			gd('ir', '+- l dx1 0'),
			gd('it', '+- y1 0 dy1'),
			gd('ib', '+- b dy1 y1'),
		],
		rect: { l: 'l', t: 'it', r: 'ir', b: 'ib' },
	},
};
