import type { RibbonIconArtwork } from './types';

export const DRAWING_ICONS: Record<string, RibbonIconArtwork> = {
	'home.drawing.shapes': {
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
					d: 'M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z',
				},
			},
			{ tag: 'rect', attrs: { x: '3', y: '14', width: '7', height: '7', rx: '1' } },
			{ tag: 'circle', attrs: { cx: '17.5', cy: '17.5', r: '3.5' } },
		],
	},
	'home.drawing.arrange': {
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
					d: 'm12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z',
				},
			},
			{ tag: 'path', attrs: { d: 'm22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65' } },
			{ tag: 'path', attrs: { d: 'm22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65' } },
		],
	},
	'home.drawing.shapeFill': {
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
				attrs: { d: 'm19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z' },
			},
			{ tag: 'path', attrs: { d: 'm5 2 5 5' } },
			{ tag: 'path', attrs: { d: 'M2 13h15' } },
			{ tag: 'path', attrs: { d: 'M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z' } },
		],
	},
	'home.drawing.shapeOutline': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'path', attrs: { d: 'M12 20h9' } },
			{
				tag: 'path',
				attrs: {
					d: 'M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z',
				},
			},
		],
	},
	'home.drawing.quickStyles': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'circle', attrs: { cx: '13.5', cy: '6.5', r: '.5', fill: 'currentColor' } },
			{ tag: 'circle', attrs: { cx: '17.5', cy: '10.5', r: '.5', fill: 'currentColor' } },
			{ tag: 'circle', attrs: { cx: '8.5', cy: '7.5', r: '.5', fill: 'currentColor' } },
			{ tag: 'circle', attrs: { cx: '6.5', cy: '12.5', r: '.5', fill: 'currentColor' } },
			{
				tag: 'path',
				attrs: {
					d: 'M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z',
				},
			},
		],
	},
	'home.drawing.shapeEffects': {
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
					d: 'M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z',
				},
			},
			{ tag: 'path', attrs: { d: 'M20 3v4' } },
			{ tag: 'path', attrs: { d: 'M22 5h-4' } },
			{ tag: 'path', attrs: { d: 'M4 17v2' } },
			{ tag: 'path', attrs: { d: 'M5 18H3' } },
		],
	},
};
