import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../../types';
import {
	extractDrawingShapeFill,
	extractDrawingShapeTextStyle,
} from './smartart-drawing-shape-style';
import type { DrawingShapeStyleDeps } from './smartart-drawing-shape-style';

/** Local-name suffix match over fast-xml-parser prefixed keys (`a:foo`). */
function local(key: string): string {
	return key.split(':').at(-1) ?? key;
}

function getChild(node: XmlObject | undefined, name: string): XmlObject | undefined {
	if (!node) {
		return undefined;
	}
	for (const [key, value] of Object.entries(node)) {
		if (key.startsWith('@_')) {
			continue;
		}
		if (local(key) === name) {
			return (Array.isArray(value) ? value[0] : value) as XmlObject;
		}
	}
	return undefined;
}

function getChildren(node: XmlObject | undefined, name: string): XmlObject[] {
	if (!node) {
		return [];
	}
	const out: XmlObject[] = [];
	for (const [key, value] of Object.entries(node)) {
		if (key.startsWith('@_')) {
			continue;
		}
		if (local(key) === name) {
			if (Array.isArray(value)) {
				out.push(...(value as XmlObject[]));
			} else {
				out.push(value as XmlObject);
			}
		}
	}
	return out;
}

/** Minimal `a:srgbClr`-only colour reader mirroring the real codec's output. */
function parseColor(node: XmlObject | undefined): string | undefined {
	const srgb = getChild(node, 'srgbClr');
	const val = srgb ? String(srgb['@_val'] || '') : '';
	return val ? `#${val}` : undefined;
}

/** Deps wired to mirror the real gradient/shadow codec semantics closely enough
 * to prove `gradFill` / `pattFill` / `blipFill` route onto the model. */
const deps: DrawingShapeStyleDeps = {
	getChild,
	getChildren,
	parseColor,
	extractGradientStops: (gradFill) =>
		getChildren(getChild(gradFill, 'gsLst'), 'gs').map((gs) => ({
			color: parseColor(gs) ?? '#000000',
			position: (Number.parseInt(String(gs['@_pos'] || '0'), 10) / 100000) * 100,
		})),
	extractGradientType: (gradFill) => (getChild(gradFill, 'path') ? 'radial' : 'linear'),
	extractGradientAngle: (gradFill) => {
		const ang = Number.parseInt(String(getChild(gradFill, 'lin')?.['@_ang'] || ''), 10);
		return Number.isFinite(ang) ? (((ang / 60000) % 360) + 360) % 360 : 90;
	},
	extractShadowColor: (spPr) => parseColor(getChild(getChild(spPr, 'effectLst'), 'outerShdw')),
};

describe('extractDrawingShapeFill', () => {
	it('parses a gradient fill onto the drawing-shape model (issue #73)', () => {
		const spPr: XmlObject = {
			'a:gradFill': {
				'a:gsLst': {
					'a:gs': [
						{ '@_pos': '0', 'a:srgbClr': { '@_val': '4472C4' } },
						{ '@_pos': '100000', 'a:srgbClr': { '@_val': '2F5496' } },
					],
				},
				'a:lin': { '@_ang': '5400000' },
			},
		};

		const fill = extractDrawingShapeFill(spPr, deps);

		expect(fill.fillGradientStops).toHaveLength(2);
		expect(fill.fillGradientStops?.[0]?.color).toBe('#4472C4');
		expect(fill.fillGradientStops?.[1]?.position).toBe(100);
		expect(fill.fillGradientType).toBe('linear');
		expect(fill.fillGradientAngle).toBe(90);
		// A representative solid fallback is still provided for flat renderers.
		expect(fill.fillColor).toBeTruthy();
	});

	it('captures a picture (blip) fill embed id', () => {
		const spPr: XmlObject = {
			'a:blipFill': { 'a:blip': { '@_r:embed': 'rId7' }, 'a:stretch': {} },
		};

		const fill = extractDrawingShapeFill(spPr, deps);

		expect(fill.fillBlipEmbedId).toBe('rId7');
		expect(fill.fillGradientStops).toBeUndefined();
		expect(fill.fillColor).toBeUndefined();
	});

	it('captures pattern fill foreground/background colours', () => {
		const spPr: XmlObject = {
			'a:pattFill': {
				'@_prst': 'pct50',
				'a:fgClr': { 'a:srgbClr': { '@_val': 'FF0000' } },
				'a:bgClr': { 'a:srgbClr': { '@_val': 'FFFFFF' } },
			},
		};

		const fill = extractDrawingShapeFill(spPr, deps);

		expect(fill.fillPatternPreset).toBe('pct50');
		expect(fill.fillPatternForegroundColor).toBe('#FF0000');
		expect(fill.fillPatternBackgroundColor).toBe('#FFFFFF');
		// Foreground is the flat-fill fallback for a pattern.
		expect(fill.fillColor).toBe('#FF0000');
	});

	it('still parses a plain solid fill (no regression)', () => {
		const spPr: XmlObject = { 'a:solidFill': { 'a:srgbClr': { '@_val': '00B050' } } };

		const fill = extractDrawingShapeFill(spPr, deps);

		expect(fill.fillColor).toBe('#00B050');
		expect(fill.fillGradientStops).toBeUndefined();
		expect(fill.fillPatternPreset).toBeUndefined();
	});

	it('captures an outer-shadow effect', () => {
		const spPr: XmlObject = {
			'a:solidFill': { 'a:srgbClr': { '@_val': '4472C4' } },
			'a:effectLst': {
				'a:outerShdw': { '@_blurRad': '40000', 'a:srgbClr': { '@_val': '000000' } },
			},
		};

		const fill = extractDrawingShapeFill(spPr, deps);

		expect(fill.hasShadow).toBeTruthy();
		expect(fill.shadowColor).toBe('#000000');
	});
});

describe('extractDrawingShapeTextStyle', () => {
	it('reads font size and colour from the first styled run', () => {
		const txBody: XmlObject = {
			'a:p': {
				'a:r': {
					'a:rPr': { '@_sz': '1800', 'a:solidFill': { 'a:srgbClr': { '@_val': 'FFFFFF' } } },
				},
			},
		};

		const style = extractDrawingShapeTextStyle(txBody, deps);

		expect(style.fontSize).toBe(18);
		expect(style.fontColor).toBe('#FFFFFF');
	});
});
