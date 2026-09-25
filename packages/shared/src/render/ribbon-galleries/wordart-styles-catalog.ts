/**
 * PowerPoint's WordArt styles, as PowerPoint writes them.
 *
 * Ground truth: `scripts/capture-gallery-writes-com.ps1` sets
 * `TextFrame2.WordArtformat = 0..29` (`msoTextEffect1..30`) on 30 fresh text
 * boxes and saves the deck; each entry below is that capture's `a:rPr` (and,
 * for 21-29, the `a:bodyPr` 3-D) verbatim, colours spelled with
 * `gallery-color-spec` (`'accent1 satMod:200000'` = `<a:schemeClr
 * val="accent1"><a:satMod val="200000"/>`). EMU, 60000ths of a degree and
 * 1000ths of a percent throughout. The tile names describe fill / outline /
 * effect (PowerPoint's own tooltips for these legacy styles are not exposed
 * through COM).
 *
 * @module render/ribbon-galleries/wordart-styles-catalog
 */

import { grad, LIN } from './wordart-style-spec';
import type { WordArtStyleSpec } from './wordart-style-spec';

const mirror = (c: string) =>
	grad(
		LIN,
		[0, `${c} tint:40000 satMod:250000`],
		[9000, `${c} tint:52000 satMod:300000`],
		[50000, `${c} shade:20000 satMod:300000`],
		[79000, `${c} tint:52000 satMod:300000`],
		[100000, `${c} tint:40000 satMod:250000`],
	);

/** Styles 0-20 (flat); 21-29 are in `wordart-styles-catalog-3d.ts`. */
export const WORDART_FLAT_STYLES: readonly WordArtStyleSpec[] = [
	{
		label: 'Fill: Background 2; Outline: Text 2; Shadow',
		b: true,
		ln: { w: 12700, fill: 'tx2 satMod:155000' },
		fill: 'bg2 tint:85000 satMod:155000',
		outer: [41275, 20320, 1800000, '#000000 alpha:40000'],
	},
	{
		label: 'Fill: None; Outline: Accent 2; Shadow',
		b: true,
		ln: { w: 18000, fill: 'accent2 satMod:140000' },
		fill: 'none',
		outer: [25500, 23000, 7020000, '#000000 alpha:50000'],
	},
	{
		label: 'Fill: White; Outline: White; Shadow',
		ln: { w: 18415, fill: '#FFFFFF' },
		fill: '#FFFFFF',
		outer: [63500, 0, 3600000, '#000000 alpha:70000'],
	},
	{
		label: 'Fill: White; Outline: Accent 1; Shadow',
		ln: { w: 10160, fill: 'accent1' },
		fill: '#FFFFFF',
		outer: [38100, 32000, 5400000, '#000000 alpha:30000'],
	},
	{
		label: 'Fill: Accent 3; Outline: Text 2; Shadow',
		b: true,
		ln: { w: 19050, fill: 'tx2 tint:1000' },
		fill: 'accent3',
		outer: [50000, 50800, 7500000, '#000000 shade:5000 alpha:35000'],
	},
	{
		label: 'Fill: Accent 1, Transparent; Outline: Accent 1; Shadow',
		b: true,
		spc: 100,
		ln: { w: 18000, fill: 'accent1 satMod:200000 tint:72000' },
		fill: 'accent1 satMod:280000 tint:100000 alpha:5700',
		outer: [25000, 20000, 16020000, 'accent1 satMod:200000 shade:1000 alpha:60000'],
	},
	{
		label: 'Fill: Accent 6, Light; Outline: Accent 6; Glow',
		b: true,
		spc: 50,
		ln: { w: 12700, fill: 'accent6 satMod:120000 shade:80000' },
		fill: 'accent6 tint:1000',
		glow: [53100, 'accent6 satMod:180000 alpha:30000'],
	},
	{
		label: 'Fill: Accent 1, Light; Inner Shadow',
		b: true,
		spc: 50,
		ln: { w: 13500, fill: 'accent1 shade:2500 alpha:6500' },
		fill: 'accent1 tint:3000 alpha:95000',
		inner: [50900, 38500, 13500000, '#000000 alpha:60000'],
	},
	{
		label: 'Fill: Accent 1, Light; Outline: Accent 1; Inner Shadow',
		b: true,
		ln: { w: 900, fill: 'accent1 satMod:190000 alpha:55000' },
		fill: 'accent1 satMod:200000 tint:3000',
		inner: [101600, 76200, 5400000, 'accent1 satMod:190000 tint:100000 alpha:74000'],
	},
	{
		label: 'Fill: Accent 3, Semitransparent; Outline: Accent 3, Light; Inner Shadow',
		b: true,
		spc: 200,
		ln: { w: 29210, fill: 'accent3 tint:10000' },
		fill: 'accent3 satMod:200000 alpha:50000',
		inner: [50800, 50800, 8100000, '#7D7D7D alpha:73000'],
	},
	{
		label: 'Fill: White; Gradient Outline: Accent 1; Shadow',
		b: true,
		ln: {
			w: 31550,
			fill: grad(
				LIN,
				[25000, 'accent1 shade:25000 satMod:190000'],
				[80000, 'accent1 tint:75000 satMod:190000'],
			),
		},
		fill: '#FFFFFF',
		outer: [41275, 12700, 12000000, '#000000 alpha:40000'],
	},
	{
		label: 'Fill: Accent 6, Light; Gradient Outline: Accent 6; Shadow',
		b: true,
		ln: {
			w: 31550,
			fill: grad(
				LIN,
				[70000, 'accent6 shade:50000 satMod:190000'],
				[0, 'accent6 tint:77000 satMod:180000'],
			),
		},
		fill: 'accent6 tint:15000 satMod:200000',
		outer: [50800, 40000, 5400000, '#000000 shade:5000 satMod:120000 alpha:33000'],
	},
	{
		label: 'Gradient Fill: Gray; Outline: Gray',
		b: true,
		ln: { w: 10541, fill: '#7D7D7D tint:100000 shade:100000 satMod:110000' },
		fill: mirror('#FFFFFF'),
	},
	{
		label: 'Gradient Fill: Accent 1; Outline: Accent 1',
		b: true,
		ln: { w: 10541, fill: 'accent1 shade:88000 satMod:110000' },
		fill: mirror('accent1'),
	},
	{
		label: 'Gradient Fill: Accent 2; Double Outline: Accent 2; Shadow',
		b: true,
		ln: { w: 24500, cmpd: 'dbl', fill: 'accent2 shade:85000 satMod:155000' },
		fill: grad(
			LIN,
			[10000, 'accent2 tint:10000 satMod:155000'],
			[60000, 'accent2 tint:30000 satMod:155000'],
			[100000, 'accent2 tint:73000 satMod:155000'],
		),
		outer: [38100, 38100, 7020000, '#000000 alpha:35000'],
	},
	{
		label: 'Gradient Fill: Accent 1; Outline: Accent 1, Light; Glow',
		b: true,
		spc: 300,
		ln: { w: 11430, fill: 'accent1 tint:10000' },
		fill: grad(
			LIN,
			[10000, 'accent1 tint:83000 shade:100000 satMod:200000'],
			[75000, 'accent1 tint:100000 shade:50000 satMod:150000'],
		),
		glow: [45500, 'accent1 satMod:220000 alpha:35000'],
	},
	{
		label: 'Gradient Fill: Accent 6; Inner Shadow',
		b: true,
		ln: { w: 1905 },
		fill: grad(
			LIN,
			[0, 'accent6 shade:20000 satMod:200000'],
			[78000, 'accent6 tint:90000 shade:89000 satMod:220000'],
			[100000, 'accent6 tint:12000 satMod:255000'],
		),
		inner: [69850, 43180, 5400000, '#000000 alpha:65000'],
	},
	{
		label: 'Gradient Fill: Black; Outline: White; Shadow',
		b: true,
		ln: { w: 17780, fill: '#FFFFFF' },
		fill: grad(
			LIN,
			[0, '#000000 tint:92000 shade:100000 satMod:150000'],
			[49000, '#000000 tint:89000 shade:90000 satMod:150000'],
			[50000, '#000000 tint:100000 shade:75000 satMod:150000'],
			[95000, '#000000 shade:47000 satMod:150000'],
			[100000, '#000000 shade:39000 satMod:150000'],
		),
		outer: [50800, 0, 0, '#000000'],
	},
	{
		label: 'Gradient Fill: Accent 1; Outline: Accent 1, Light; Shadow',
		b: true,
		ln: { w: 17780, fill: 'accent1 tint:3000' },
		fill: grad(
			LIN,
			[10000, 'accent1 tint:63000 sat:105000'],
			[90000, 'accent1 shade:50000 satMod:100000'],
		),
		outer: [55000, 50800, 5400000, '#000000 alpha:33000'],
	},
	{
		label: 'Gradient Fill: Accent 4; Outline: Accent 4; Reflection',
		b: true,
		caps: true,
		ln: { w: 9000, fill: 'accent4 shade:50000 satMod:120000' },
		fill: grad(
			LIN,
			[0, 'accent4 shade:20000 satMod:245000'],
			[43000, 'accent4 satMod:255000'],
			[48000, 'accent4 shade:85000 satMod:255000'],
			[100000, 'accent4 shade:20000 satMod:245000'],
		),
		reflection: { blur: 12700, stA: 28000, endPos: 45000, dist: 1000, algn: 'bl' },
	},
	{
		label: 'Fill: White; Shadow',
		b: true,
		spc: 150,
		ln: { w: 11430 },
		fill: '#F8F8F8',
		outer: [25400, 0, 0, '#000000 alpha:43000'],
	},
];
