/**
 * Text-inset rects for `cornerTabs`, `plaqueTabs`, `squareTabs`, `plaque`,
 * `foldedCorner`.
 *
 * Transcribed verbatim from ECMA-376's `presetShapeDefinitions.xml` `<rect>`
 * element (the same source, same method as `preset-connection-sites-*.ts`).
 * See `preset-text-rect-types.ts` for why this is a separate override table
 * rather than an edit to `preset-shape-definitions-*.ts`.
 *
 * @module render/preset-text-rect-tabs
 */
import { gd } from './preset-connection-sites-types';
import type { PresetTextRectDefinition } from './preset-text-rect-types';

export const TAB_TEXT_RECTS: Record<string, PresetTextRectDefinition> = {
	cornerTabs: {
		gdLst: [
			gd('md', 'mod w h 0'),
			gd('dx', '*/ 1 md 20'),
			gd('y1', '+- 0 b dx'),
			gd('x1', '+- 0 r dx'),
		],
		rect: { l: 'dx', t: 'dx', r: 'x1', b: 'y1' },
	},

	plaqueTabs: {
		gdLst: [
			gd('md', 'mod w h 0'),
			gd('dx', '*/ 1 md 20'),
			gd('y1', '+- 0 b dx'),
			gd('x1', '+- 0 r dx'),
		],
		rect: { l: 'dx', t: 'dx', r: 'x1', b: 'y1' },
	},

	squareTabs: {
		gdLst: [
			gd('md', 'mod w h 0'),
			gd('dx', '*/ 1 md 20'),
			gd('y1', '+- 0 b dx'),
			gd('x1', '+- 0 r dx'),
		],
		rect: { l: 'dx', t: 'dx', r: 'x1', b: 'y1' },
	},

	plaque: {
		avLst: { adj: 16667 },
		gdLst: [
			gd('a', 'pin 0 adj 50000'),
			gd('x1', '*/ ss a 100000'),
			gd('il', '*/ x1 70711 100000'),
			gd('ir', '+- r 0 il'),
			gd('ib', '+- b 0 il'),
		],
		rect: { l: 'il', t: 'il', r: 'ir', b: 'ib' },
	},

	foldedCorner: {
		avLst: { adj: 16667 },
		gdLst: [gd('a', 'pin 0 adj 50000'), gd('dy2', '*/ ss a 100000'), gd('y2', '+- b 0 dy2')],
		rect: { l: 'l', t: 't', r: 'r', b: 'y2' },
	},
};
