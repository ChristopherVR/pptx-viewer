import type { RibbonIconArtwork } from './types';

export const EDITING_ICONS: Record<string, RibbonIconArtwork> = {
	'home.editing.find': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'circle', attrs: { cx: '11', cy: '11', r: '8' } },
			{ tag: 'path', attrs: { d: 'm21 21-4.3-4.3' } },
		],
	},
	'home.editing.replace': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'path', attrs: { d: 'M14 4a2 2 0 0 1 2-2' } },
			{ tag: 'path', attrs: { d: 'M16 10a2 2 0 0 1-2-2' } },
			{ tag: 'path', attrs: { d: 'M20 2a2 2 0 0 1 2 2' } },
			{ tag: 'path', attrs: { d: 'M22 8a2 2 0 0 1-2 2' } },
			{ tag: 'path', attrs: { d: 'm3 7 3 3 3-3' } },
			{ tag: 'path', attrs: { d: 'M6 10V5a3 3 0 0 1 3-3h1' } },
			{ tag: 'rect', attrs: { x: '2', y: '14', width: '8', height: '8', rx: '2' } },
		],
	},
	'home.editing.select': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{
				tag: 'path',
				attrs: {
					d: 'M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z',
				},
			},
		],
	},
};
