import type { RibbonIconArtwork } from './types';

export const ARRANGE_ALIGNMENT_ICONS: Record<string, RibbonIconArtwork> = {
	'home.arrange.align.left': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'path', attrs: { d: 'M15 12H3' } },
			{ tag: 'path', attrs: { d: 'M17 18H3' } },
			{ tag: 'path', attrs: { d: 'M21 6H3' } },
		],
	},
	'home.arrange.align.center': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'path', attrs: { d: 'M17 12H7' } },
			{ tag: 'path', attrs: { d: 'M19 18H5' } },
			{ tag: 'path', attrs: { d: 'M21 6H3' } },
		],
	},
	'home.arrange.align.right': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'path', attrs: { d: 'M21 12H9' } },
			{ tag: 'path', attrs: { d: 'M21 18H7' } },
			{ tag: 'path', attrs: { d: 'M21 6H3' } },
		],
	},
	'home.arrange.align.top': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [{ tag: 'path', attrs: { d: 'm18 15-6-6-6 6' } }],
	},
	'home.arrange.align.middle': {
		attrs: {
			style: 'rotate: 90deg; transform-origin: center;',
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'path', attrs: { d: 'M17 12H7' } },
			{ tag: 'path', attrs: { d: 'M19 18H5' } },
			{ tag: 'path', attrs: { d: 'M21 6H3' } },
		],
	},
	'home.arrange.align.bottom': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [{ tag: 'path', attrs: { d: 'm6 9 6 6 6-6' } }],
	},
	'home.arrange.distribute.horizontal': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'rect', attrs: { width: '6', height: '10', x: '9', y: '7', rx: '2' } },
			{ tag: 'path', attrs: { d: 'M4 22V2' } },
			{ tag: 'path', attrs: { d: 'M20 22V2' } },
		],
	},
	'home.arrange.distribute.vertical': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'rect', attrs: { width: '10', height: '6', x: '7', y: '9', rx: '2' } },
			{ tag: 'path', attrs: { d: 'M22 20H2' } },
			{ tag: 'path', attrs: { d: 'M22 4H2' } },
		],
	},
};
