/**
 * Text-inset rects for `circularArrow`, `leftCircularArrow`,
 * `leftRightCircularArrow`.
 *
 * Transcribed verbatim from ECMA-376's `presetShapeDefinitions.xml` `<rect>`
 * element (the same source, same method as `preset-connection-sites-*.ts`).
 * See `preset-text-rect-types.ts` for why this is a separate override table
 * rather than an edit to `preset-shape-definitions-*.ts`.
 *
 * @module render/preset-text-rect-circular-arrows
 */
import { gd } from './preset-connection-sites-types';
import type { PresetTextRectDefinition } from './preset-text-rect-types';

export const CIRCULAR_ARROW_TEXT_RECTS: Record<string, PresetTextRectDefinition> = {
	circularArrow: {
		avLst: { adj5: 12500, adj1: 12500 },
		gdLst: [
			gd('a5', 'pin 0 adj5 25000'),
			gd('maxAdj1', '*/ a5 2 1'),
			gd('a1', 'pin 0 adj1 maxAdj1'),
			gd('th', '*/ ss a1 100000'),
			gd('thh', '*/ ss a5 100000'),
			gd('th2', '*/ th 1 2'),
			gd('rw1', '+- wd2 th2 thh'),
			gd('rh1', '+- hd2 th2 thh'),
			gd('idx', 'cos rw1 2700000'),
			gd('idy', 'sin rh1 2700000'),
			gd('il', '+- hc 0 idx'),
			gd('ir', '+- hc idx 0'),
			gd('it', '+- vc 0 idy'),
			gd('ib', '+- vc idy 0'),
		],
		rect: { l: 'il', t: 'it', r: 'ir', b: 'ib' },
	},

	leftCircularArrow: {
		avLst: { adj5: 12500, adj1: 12500 },
		gdLst: [
			gd('a5', 'pin 0 adj5 25000'),
			gd('maxAdj1', '*/ a5 2 1'),
			gd('a1', 'pin 0 adj1 maxAdj1'),
			gd('th', '*/ ss a1 100000'),
			gd('thh', '*/ ss a5 100000'),
			gd('th2', '*/ th 1 2'),
			gd('rw1', '+- wd2 th2 thh'),
			gd('rh1', '+- hd2 th2 thh'),
			gd('idx', 'cos rw1 2700000'),
			gd('idy', 'sin rh1 2700000'),
			gd('il', '+- hc 0 idx'),
			gd('ir', '+- hc idx 0'),
			gd('it', '+- vc 0 idy'),
			gd('ib', '+- vc idy 0'),
		],
		rect: { l: 'il', t: 'it', r: 'ir', b: 'ib' },
	},

	leftRightCircularArrow: {
		avLst: { adj5: 12500, adj1: 12500 },
		gdLst: [
			gd('a5', 'pin 0 adj5 25000'),
			gd('maxAdj1', '*/ a5 2 1'),
			gd('a1', 'pin 0 adj1 maxAdj1'),
			gd('th', '*/ ss a1 100000'),
			gd('thh', '*/ ss a5 100000'),
			gd('th2', '*/ th 1 2'),
			gd('rw1', '+- wd2 th2 thh'),
			gd('rh1', '+- hd2 th2 thh'),
			gd('idx', 'cos rw1 2700000'),
			gd('idy', 'sin rh1 2700000'),
			gd('il', '+- hc 0 idx'),
			gd('ir', '+- hc idx 0'),
			gd('it', '+- vc 0 idy'),
			gd('ib', '+- vc idy 0'),
		],
		rect: { l: 'il', t: 'it', r: 'ir', b: 'ib' },
	},
};
