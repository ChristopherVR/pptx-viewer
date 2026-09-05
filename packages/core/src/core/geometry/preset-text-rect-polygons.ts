/**
 * Text-inset rects for `heptagon`, `decagon`, `dodecagon`.
 *
 * Transcribed verbatim from ECMA-376's `presetShapeDefinitions.xml` `<rect>`
 * element (the same source, same method as `preset-connection-sites-*.ts`).
 * See `preset-text-rect-types.ts` for why this is a separate override table
 * rather than an edit to `preset-shape-definitions-*.ts`.
 *
 * @module render/preset-text-rect-polygons
 */
import { gd } from './preset-connection-sites-types';
import type { PresetTextRectDefinition } from './preset-text-rect-types';

export const POLYGON_TEXT_RECTS: Record<string, PresetTextRectDefinition> = {
	heptagon: {
		avLst: { vf: 105210, hf: 102572 },
		gdLst: [
			gd('swd2', '*/ wd2 hf 100000'),
			gd('shd2', '*/ hd2 vf 100000'),
			gd('svc', '*/ vc  vf 100000'),
			gd('dx2', '*/ swd2 78183 100000'),
			gd('dy1', '*/ shd2 62349 100000'),
			gd('x2', '+- hc 0 dx2'),
			gd('x5', '+- hc dx2 0'),
			gd('y1', '+- svc 0 dy1'),
			gd('ib', '+- b 0 y1'),
		],
		rect: { l: 'x2', t: 'y1', r: 'x5', b: 'ib' },
	},

	decagon: {
		avLst: { vf: 105146 },
		gdLst: [
			gd('shd2', '*/ hd2 vf 100000'),
			gd('dx1', 'cos wd2 2160000'),
			gd('x1', '+- hc 0 dx1'),
			gd('x4', '+- hc dx1 0'),
			gd('dy2', 'sin shd2 2160000'),
			gd('y2', '+- vc 0 dy2'),
			gd('y3', '+- vc dy2 0'),
		],
		rect: { l: 'x1', t: 'y2', r: 'x4', b: 'y3' },
	},

	dodecagon: {
		gdLst: [
			gd('x1', '*/ w 2894 21600'),
			gd('x4', '*/ w 18706 21600'),
			gd('y1', '*/ h 2894 21600'),
			gd('y4', '*/ h 18706 21600'),
		],
		rect: { l: 'x1', t: 'y1', r: 'x4', b: 'y4' },
	},
};
