import type { RibbonIconArtwork } from './types';

export const CLIPBOARD_ICONS: Record<string, RibbonIconArtwork> = {
	'home.clipboard.paste': {
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
				attrs: { d: 'M15 2H9a1 1 0 0 0-1 1v2c0 .6.4 1 1 1h6c.6 0 1-.4 1-1V3c0-.6-.4-1-1-1Z' },
			},
			{
				tag: 'path',
				attrs: {
					d: 'M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2M16 4h2a2 2 0 0 1 2 2v2M11 14h10',
				},
			},
			{ tag: 'path', attrs: { d: 'm17 10 4 4-4 4' } },
		],
	},
	'home.clipboard.cut': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'circle', attrs: { cx: '6', cy: '6', r: '3' } },
			{ tag: 'path', attrs: { d: 'M8.12 8.12 12 12' } },
			{ tag: 'path', attrs: { d: 'M20 4 8.12 15.88' } },
			{ tag: 'circle', attrs: { cx: '6', cy: '18', r: '3' } },
			{ tag: 'path', attrs: { d: 'M14.8 14.8 20 20' } },
		],
	},
	'home.clipboard.copy': {
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
	'home.clipboard.formatPainter': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'path', attrs: { d: 'm14.622 17.897-10.68-2.913' } },
			{
				tag: 'path',
				attrs: {
					d: 'M18.376 2.622a1 1 0 1 1 3.002 3.002L17.36 9.643a.5.5 0 0 0 0 .707l.944.944a2.41 2.41 0 0 1 0 3.408l-.944.944a.5.5 0 0 1-.707 0L8.354 7.348a.5.5 0 0 1 0-.707l.944-.944a2.41 2.41 0 0 1 3.408 0l.944.944a.5.5 0 0 0 .707 0z',
				},
			},
			{
				tag: 'path',
				attrs: {
					d: 'M9 8c-1.804 2.71-3.97 3.46-6.583 3.948a.507.507 0 0 0-.302.819l7.32 8.883a1 1 0 0 0 1.185.204C12.735 20.405 16 16.792 16 15',
				},
			},
		],
	},
};
