import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import { writeSeriesColorToSpPr } from './chart-series-color-serializer';

function getLocalName(qualifiedName: string): string {
	const colonIndex = qualifiedName.lastIndexOf(':');
	return colonIndex >= 0 ? qualifiedName.substring(colonIndex + 1) : qualifiedName;
}

/** Minimal colour resolver: reads a solidFill node's `a:srgbClr/@val`. */
function resolveColor(node: XmlObject | undefined): string | undefined {
	const srgb = node?.['a:srgbClr'] as XmlObject | undefined;
	const val = srgb?.['@_val'];
	return typeof val === 'string' && val.length > 0 ? `#${val}` : undefined;
}

describe('writeSeriesColorToSpPr: area-family (direct fill)', () => {
	it('creates a:solidFill on an empty spPr', () => {
		const spPr: XmlObject = {};
		writeSeriesColorToSpPr(spPr, '#4472C4', false, getLocalName, resolveColor);
		expect(spPr).toStrictEqual({ 'a:solidFill': { 'a:srgbClr': { '@_val': '4472C4' } } });
	});

	it('updates an existing direct solidFill in place', () => {
		const spPr: XmlObject = { 'a:solidFill': { 'a:srgbClr': { '@_val': 'ED7D31' } } };
		writeSeriesColorToSpPr(spPr, '#4472C4', false, getLocalName, resolveColor);
		expect(spPr).toStrictEqual({ 'a:solidFill': { 'a:srgbClr': { '@_val': '4472C4' } } });
	});

	it('inserts a NEW direct fill BEFORE an existing a:ln, never after (CT_ShapeProperties order)', () => {
		// A bar/area series can carry an outline colour (a:ln) with no fill yet.
		const spPr: XmlObject = { 'a:ln': { 'a:solidFill': { 'a:srgbClr': { '@_val': '000000' } } } };
		writeSeriesColorToSpPr(spPr, '#4472C4', false, getLocalName, resolveColor);
		expect(Object.keys(spPr)).toStrictEqual(['a:solidFill', 'a:ln']);
		expect(spPr['a:solidFill']).toStrictEqual({ 'a:srgbClr': { '@_val': '4472C4' } });
		// The outline itself is untouched.
		expect(spPr['a:ln']).toStrictEqual({ 'a:solidFill': { 'a:srgbClr': { '@_val': '000000' } } });
	});

	it('removes a sibling a:noFill when writing a new direct fill', () => {
		const spPr: XmlObject = { 'a:noFill': {} };
		writeSeriesColorToSpPr(spPr, '#4472C4', false, getLocalName, resolveColor);
		expect(spPr['a:noFill']).toBeUndefined();
		expect(spPr['a:solidFill']).toStrictEqual({ 'a:srgbClr': { '@_val': '4472C4' } });
	});

	it('preserves an authored a:schemeClr when the resolved colour is unchanged', () => {
		const original = { 'a:schemeClr': { '@_val': 'accent1', 'a:lumMod': { '@_val': '60000' } } };
		const spPr: XmlObject = { 'a:solidFill': original };
		writeSeriesColorToSpPr(spPr, '#4472C4', false, getLocalName, () => '#4472C4');
		expect(spPr['a:solidFill']).toBe(original);
	});
});

describe('writeSeriesColorToSpPr: line-drawn family (a:ln/a:solidFill)', () => {
	it('creates a:ln/a:solidFill on an empty spPr (no bare a:solidFill sibling)', () => {
		const spPr: XmlObject = {};
		writeSeriesColorToSpPr(spPr, '#ED7D31', true, getLocalName, resolveColor);
		expect(spPr).toStrictEqual({
			'a:ln': { 'a:solidFill': { 'a:srgbClr': { '@_val': 'ED7D31' } } },
		});
	});

	it('updates an existing a:ln/a:solidFill in place, preserving other a:ln attributes', () => {
		const spPr: XmlObject = {
			'a:ln': { '@_w': '28575', 'a:solidFill': { 'a:srgbClr': { '@_val': 'ED7D31' } } },
		};
		writeSeriesColorToSpPr(spPr, '#4472C4', true, getLocalName, resolveColor);
		expect(spPr['a:ln']).toStrictEqual({
			'@_w': '28575',
			'a:solidFill': { 'a:srgbClr': { '@_val': '4472C4' } },
		});
	});

	it('inserts a:solidFill as the FIRST child of a:ln when a:ln has other children (CT_LineProperties order)', () => {
		const spPr: XmlObject = {
			'a:ln': { '@_w': '28575', 'a:prstDash': { '@_val': 'dash' } },
		};
		writeSeriesColorToSpPr(spPr, '#ED7D31', true, getLocalName, resolveColor);
		const ln = spPr['a:ln'] as XmlObject;
		// `@_w` is an attribute, not a child element, so its key position among
		// the CT_LineProperties CHILDREN is what matters: a:solidFill precedes
		// a:prstDash either way.
		expect(Object.keys(ln)).toStrictEqual(['a:solidFill', '@_w', 'a:prstDash']);
		expect(ln['a:solidFill']).toStrictEqual({ 'a:srgbClr': { '@_val': 'ED7D31' } });
		expect(ln['a:prstDash']).toStrictEqual({ '@_val': 'dash' });
	});

	it('never places the colour as a direct spPr-level a:solidFill', () => {
		const spPr: XmlObject = {};
		writeSeriesColorToSpPr(spPr, '#ED7D31', true, getLocalName, resolveColor);
		expect(spPr['a:solidFill']).toBeUndefined();
	});

	it('removes a:ln/a:noFill (marker-only / no-line series) when writing a colour', () => {
		const spPr: XmlObject = { 'a:ln': { 'a:noFill': {} } };
		writeSeriesColorToSpPr(spPr, '#ED7D31', true, getLocalName, resolveColor);
		expect(spPr['a:ln']).toStrictEqual({ 'a:solidFill': { 'a:srgbClr': { '@_val': 'ED7D31' } } });
	});

	it('preserves an authored a:schemeClr on a:ln when the resolved colour is unchanged', () => {
		const original = { 'a:schemeClr': { '@_val': 'accent2' } };
		const spPr: XmlObject = { 'a:ln': { 'a:solidFill': original } };
		writeSeriesColorToSpPr(spPr, '#ED7D31', true, getLocalName, () => '#ED7D31');
		expect((spPr['a:ln'] as XmlObject)['a:solidFill']).toBe(original);
	});
});
