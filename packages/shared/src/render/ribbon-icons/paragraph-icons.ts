import type { RibbonIconArtwork } from './types';

export const PARAGRAPH_ICONS: Record<string, RibbonIconArtwork> = {
	'home.paragraph.bullets': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'path', attrs: { d: 'M3 12h.01' } },
			{ tag: 'path', attrs: { d: 'M3 18h.01' } },
			{ tag: 'path', attrs: { d: 'M3 6h.01' } },
			{ tag: 'path', attrs: { d: 'M8 12h13' } },
			{ tag: 'path', attrs: { d: 'M8 18h13' } },
			{ tag: 'path', attrs: { d: 'M8 6h13' } },
		],
	},
	'home.paragraph.numbering': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'path', attrs: { d: 'M10 12h11' } },
			{ tag: 'path', attrs: { d: 'M10 18h11' } },
			{ tag: 'path', attrs: { d: 'M10 6h11' } },
			{ tag: 'path', attrs: { d: 'M4 10h2' } },
			{ tag: 'path', attrs: { d: 'M4 6h1v4' } },
			{ tag: 'path', attrs: { d: 'M6 18H4c0-1 2-2 2-3s-1-1.5-2-1' } },
		],
	},
	'home.paragraph.decreaseIndent': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'path', attrs: { d: 'M21 12H11' } },
			{ tag: 'path', attrs: { d: 'M21 18H11' } },
			{ tag: 'path', attrs: { d: 'M21 6H11' } },
			{ tag: 'path', attrs: { d: 'm7 8-4 4 4 4' } },
		],
	},
	'home.paragraph.increaseIndent': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'path', attrs: { d: 'M21 12H11' } },
			{ tag: 'path', attrs: { d: 'M21 18H11' } },
			{ tag: 'path', attrs: { d: 'M21 6H11' } },
			{ tag: 'path', attrs: { d: 'm3 8 4 4-4 4' } },
		],
	},
	'home.paragraph.alignLeft': {
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
	'home.paragraph.alignCenter': {
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
	'home.paragraph.alignRight': {
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
	'home.paragraph.justify': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'path', attrs: { d: 'M3 12h18' } },
			{ tag: 'path', attrs: { d: 'M3 18h18' } },
			{ tag: 'path', attrs: { d: 'M3 6h18' } },
		],
	},
	'home.paragraph.lineSpacing': {
		attrs: { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' },
		children: [
			{ tag: 'line', attrs: { x1: '5', y1: '5', x2: '19', y2: '5' } },
			{ tag: 'line', attrs: { x1: '5', y1: '12', x2: '19', y2: '12' } },
			{ tag: 'line', attrs: { x1: '5', y1: '19', x2: '19', y2: '19' } },
			{ tag: 'path', attrs: { d: 'M2 8 L2 3 M2 3 L3.5 4.5 M2 3 L0.5 4.5' } },
			{ tag: 'path', attrs: { d: 'M2 16 L2 21 M2 21 L3.5 19.5 M2 21 L0.5 19.5' } },
		],
	},
	'home.paragraph.textDirection': {
		attrs: { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' },
		children: [
			{
				tag: 'text',
				attrs: { x: '3', y: '16', 'font-size': '12', fill: 'currentColor', stroke: 'none' },
				text: 'A',
			},
			{ tag: 'path', attrs: { d: 'M18 6 C21 6 21 10 18 10' } },
			{ tag: 'path', attrs: { d: 'M18 10 L19.5 8.5 M18 10 L16.5 8.5' } },
		],
	},
	'home.paragraph.columns': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'rect', attrs: { width: '18', height: '18', x: '3', y: '3', rx: '2' } },
			{ tag: 'path', attrs: { d: 'M9 3v18' } },
			{ tag: 'path', attrs: { d: 'M15 3v18' } },
		],
	},
};
