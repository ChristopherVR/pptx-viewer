import type { RibbonIconArtwork } from './types';

export const SLIDES_ICONS: Record<string, RibbonIconArtwork> = {
	'home.slides.caret': {
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
	'home.slides.newSlide': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'path', attrs: { d: 'M5 12h14' } },
			{ tag: 'path', attrs: { d: 'M12 5v14' } },
		],
	},
	'home.slides.slideTemplates': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'rect', attrs: { width: '18', height: '7', x: '3', y: '3', rx: '1' } },
			{ tag: 'rect', attrs: { width: '9', height: '7', x: '3', y: '14', rx: '1' } },
			{ tag: 'rect', attrs: { width: '5', height: '7', x: '16', y: '14', rx: '1' } },
		],
	},
	'home.slides.layout': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'rect', attrs: { width: '7', height: '7', x: '3', y: '3', rx: '1' } },
			{ tag: 'rect', attrs: { width: '7', height: '7', x: '14', y: '3', rx: '1' } },
			{ tag: 'rect', attrs: { width: '7', height: '7', x: '14', y: '14', rx: '1' } },
			{ tag: 'rect', attrs: { width: '7', height: '7', x: '3', y: '14', rx: '1' } },
		],
	},
	'home.slides.reset': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'path', attrs: { d: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' } },
			{ tag: 'path', attrs: { d: 'M3 3v5h5' } },
		],
	},
	'home.slides.section': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'path', attrs: { d: 'M12 10v6' } },
			{ tag: 'path', attrs: { d: 'M9 13h6' } },
			{
				tag: 'path',
				attrs: {
					d: 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z',
				},
			},
		],
	},
};
