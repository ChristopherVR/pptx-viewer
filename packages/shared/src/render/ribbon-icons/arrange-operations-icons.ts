import type { RibbonIconArtwork } from './types';

export const ARRANGE_OPERATIONS_ICONS: Record<string, RibbonIconArtwork> = {
	'home.arrange.group': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'path', attrs: { d: 'M3 7V5c0-1.1.9-2 2-2h2' } },
			{ tag: 'path', attrs: { d: 'M17 3h2c1.1 0 2 .9 2 2v2' } },
			{ tag: 'path', attrs: { d: 'M21 17v2c0 1.1-.9 2-2 2h-2' } },
			{ tag: 'path', attrs: { d: 'M7 21H5c-1.1 0-2-.9-2-2v-2' } },
			{ tag: 'rect', attrs: { width: '7', height: '5', x: '7', y: '7', rx: '1' } },
			{ tag: 'rect', attrs: { width: '7', height: '5', x: '10', y: '12', rx: '1' } },
		],
	},
	'home.arrange.ungroup': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'rect', attrs: { width: '8', height: '6', x: '5', y: '4', rx: '1' } },
			{ tag: 'rect', attrs: { width: '8', height: '6', x: '11', y: '14', rx: '1' } },
		],
	},
	'home.arrange.mergeShapes': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'path', attrs: { d: 'M10 18H5a3 3 0 0 1-3-3v-1' } },
			{ tag: 'path', attrs: { d: 'M14 2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2' } },
			{ tag: 'path', attrs: { d: 'M20 2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2' } },
			{ tag: 'path', attrs: { d: 'm7 21 3-3-3-3' } },
			{ tag: 'rect', attrs: { x: '14', y: '14', width: '8', height: '8', rx: '2' } },
			{ tag: 'rect', attrs: { x: '2', y: '2', width: '8', height: '8', rx: '2' } },
		],
	},
	'home.arrange.crop': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'path', attrs: { d: 'M6 2v14a2 2 0 0 0 2 2h14' } },
			{ tag: 'path', attrs: { d: 'M18 22V8a2 2 0 0 0-2-2H2' } },
		],
	},
	'home.arrange.sendBackward': {
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
	'home.arrange.bringForward': {
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
	'home.arrange.duplicate': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'rect', attrs: { width: '14', height: '14', x: '8', y: '8', rx: '2', ry: '2' } },
			{ tag: 'path', attrs: { d: 'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2' } },
		],
	},
	'home.arrange.delete': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'path', attrs: { d: 'M3 6h18' } },
			{ tag: 'path', attrs: { d: 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6' } },
			{ tag: 'path', attrs: { d: 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2' } },
			{ tag: 'line', attrs: { x1: '10', x2: '10', y1: '11', y2: '17' } },
			{ tag: 'line', attrs: { x1: '14', x2: '14', y1: '11', y2: '17' } },
		],
	},
};
