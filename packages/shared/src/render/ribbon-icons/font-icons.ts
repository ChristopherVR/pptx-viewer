import type { RibbonIconArtwork } from './types';

export const FONT_ICONS: Record<string, RibbonIconArtwork> = {
	'home.font.bold': {
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
				attrs: { d: 'M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8' },
			},
		],
	},
	'home.font.italic': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'line', attrs: { x1: '19', x2: '10', y1: '4', y2: '4' } },
			{ tag: 'line', attrs: { x1: '14', x2: '5', y1: '20', y2: '20' } },
			{ tag: 'line', attrs: { x1: '15', x2: '9', y1: '4', y2: '20' } },
		],
	},
	'home.font.underline': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'path', attrs: { d: 'M6 4v6a6 6 0 0 0 12 0V4' } },
			{ tag: 'line', attrs: { x1: '4', x2: '20', y1: '20', y2: '20' } },
		],
	},
	'home.font.strikethrough': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'path', attrs: { d: 'M16 4H9a3 3 0 0 0-2.83 4' } },
			{ tag: 'path', attrs: { d: 'M14 12a4 4 0 0 1 0 8H6' } },
			{ tag: 'line', attrs: { x1: '4', x2: '20', y1: '12', y2: '12' } },
		],
	},
	'home.font.shadow': {
		attrs: { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' },
		children: [
			{
				tag: 'text',
				attrs: {
					x: '6',
					y: '17',
					'font-size': '16',
					'font-weight': 'bold',
					fill: 'currentColor',
					stroke: 'none',
				},
				text: 'S',
			},
			{
				tag: 'text',
				attrs: {
					x: '7.5',
					y: '18.5',
					'font-size': '16',
					'font-weight': 'bold',
					fill: 'none',
					stroke: 'currentColor',
					'stroke-width': '0.5',
					opacity: '0.4',
				},
				text: 'S',
			},
		],
	},
	'home.font.increaseFontSize': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'path', attrs: { d: 'M3.5 13h6' } },
			{ tag: 'path', attrs: { d: 'm2 16 4.5-9 4.5 9' } },
			{ tag: 'path', attrs: { d: 'M18 16V7' } },
			{ tag: 'path', attrs: { d: 'm14 11 4-4 4 4' } },
		],
	},
	'home.font.decreaseFontSize': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'path', attrs: { d: 'M3.5 13h6' } },
			{ tag: 'path', attrs: { d: 'm2 16 4.5-9 4.5 9' } },
			{ tag: 'path', attrs: { d: 'M18 7v9' } },
			{ tag: 'path', attrs: { d: 'm14 12 4 4 4-4' } },
		],
	},
	'home.font.clearFormatting': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'path', attrs: { d: 'M4 7V4h16v3' } },
			{ tag: 'path', attrs: { d: 'M5 20h6' } },
			{ tag: 'path', attrs: { d: 'M13 4 8 20' } },
			{ tag: 'path', attrs: { d: 'm15 15 5 5' } },
			{ tag: 'path', attrs: { d: 'm20 15-5 5' } },
		],
	},
	'home.font.characterSpacing': {
		attrs: { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' },
		children: [
			{
				tag: 'text',
				attrs: {
					x: '4',
					y: '16',
					'font-size': '11',
					'font-weight': 'bold',
					fill: 'currentColor',
					stroke: 'none',
				},
				text: 'AV',
			},
			{ tag: 'path', attrs: { d: 'M3 20 L1 20 M3 20 L5 20', 'stroke-width': '1.5' } },
			{ tag: 'path', attrs: { d: 'M21 20 L19 20 M21 20 L23 20', 'stroke-width': '1.5' } },
		],
	},
	'home.font.changeCase': {
		attrs: { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' },
		children: [
			{
				tag: 'text',
				attrs: {
					x: '2',
					y: '16',
					'font-size': '13',
					'font-weight': 'bold',
					fill: 'currentColor',
					stroke: 'none',
				},
				text: 'Aa',
			},
		],
	},
	'home.font.fontColor': {
		attrs: {
			viewBox: '0 0 24 24',
			fill: 'none',
			stroke: 'currentColor',
			'stroke-width': '2',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [{ tag: 'path', attrs: { d: 'M6 20h12M9.5 4h5L18 16H6L9.5 4z' } }],
	},
	'home.font.highlightColor': {
		attrs: {
			stroke: 'currentColor',
			fill: 'none',
			'stroke-width': '2',
			viewBox: '0 0 24 24',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		},
		children: [
			{ tag: 'path', attrs: { d: 'm9 11-6 6v3h9l3-3' } },
			{ tag: 'path', attrs: { d: 'm22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4' } },
		],
	},
};
