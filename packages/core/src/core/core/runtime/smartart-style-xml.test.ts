import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../../types';
import type { PptxSmartArtNode } from '../../types/smart-art';
import { applySmartArtNodeStyleToPoint } from './smartart-style-xml';
import { mergeSmartArtPointXml } from './smartart-xml-builders';

/** Build a minimal existing content point with a single run. */
function contentPoint(modelId: string, text: string): XmlObject {
	return {
		'@_modelId': modelId,
		'dgm:t': {
			'a:bodyPr': {},
			'a:lstStyle': {},
			'a:p': { 'a:r': { 'a:rPr': { '@_lang': 'en-US' }, 'a:t': text } },
		},
	};
}

function asObject(value: unknown): XmlObject {
	return value as XmlObject;
}

describe('applySmartArtNodeStyleToPoint', () => {
	it('is a no-op for undefined or empty style', () => {
		const pt = contentPoint('1', 'A');
		const clone = JSON.parse(JSON.stringify(pt));
		applySmartArtNodeStyleToPoint(pt, undefined);
		applySmartArtNodeStyleToPoint(pt, {});
		expect(pt).toStrictEqual(clone);
	});

	it('writes fill + line into spPr', () => {
		const pt = contentPoint('1', 'A');
		applySmartArtNodeStyleToPoint(pt, { fillColor: '#FF0000', lineColor: '#00FF00' });
		const spPr = asObject(pt['dgm:spPr']);
		const fill = asObject(spPr['a:solidFill']);
		expect(asObject(fill['a:srgbClr'])['@_val']).toBe('FF0000');
		const ln = asObject(spPr['a:ln']);
		const lnFill = asObject(ln['a:solidFill']);
		expect(asObject(lnFill['a:srgbClr'])['@_val']).toBe('00FF00');
	});

	it('writes bold / italic / font colour into the first run rPr', () => {
		const pt = contentPoint('1', 'A');
		applySmartArtNodeStyleToPoint(pt, { bold: true, italic: true, fontColor: '#112233' });
		const body = asObject(pt['dgm:t']);
		const p = asObject(body['a:p']);
		const r = asObject(p['a:r']);
		const rPr = asObject(r['a:rPr']);
		expect(rPr['@_b']).toBe('1');
		expect(rPr['@_i']).toBe('1');
		const fontFill = asObject(rPr['a:solidFill']);
		expect(asObject(fontFill['a:srgbClr'])['@_val']).toBe('112233');
	});

	it('preserves existing run text and lang attribute', () => {
		const pt = contentPoint('1', 'Keep me');
		applySmartArtNodeStyleToPoint(pt, { bold: true });
		const body = asObject(pt['dgm:t']);
		const p = asObject(body['a:p']);
		const r = asObject(p['a:r']);
		expect(r['a:t']).toBe('Keep me');
		expect(asObject(r['a:rPr'])['@_lang']).toBe('en-US');
	});
});

describe('mergeSmartArtPointXml round-trips node style', () => {
	it('writes the style of an updated existing content point', () => {
		const existing: XmlObject[] = [{ '@_type': 'doc', '@_modelId': '0' }, contentPoint('1', 'One')];
		const nodes: PptxSmartArtNode[] = [
			{ id: '1', text: 'One', style: { fillColor: '#ABCDEF', bold: true } },
		];
		const merged = mergeSmartArtPointXml(existing, nodes);
		// doc point preserved verbatim at the front.
		expect(asObject(merged[0])['@_type']).toBe('doc');
		const pt = asObject(merged[1]);
		const spPr = asObject(pt['dgm:spPr']);
		expect(asObject(asObject(spPr['a:solidFill'])['a:srgbClr'])['@_val']).toBe('ABCDEF');
		const r = asObject(asObject(asObject(pt['dgm:t'])['a:p'])['a:r']);
		expect(asObject(r['a:rPr'])['@_b']).toBe('1');
	});

	it('writes the style of a newly-appended content point', () => {
		const existing: XmlObject[] = [{ '@_type': 'doc', '@_modelId': '0' }];
		const nodes: PptxSmartArtNode[] = [{ id: '9', text: 'New', style: { fillColor: '#010203' } }];
		const merged = mergeSmartArtPointXml(existing, nodes);
		const appended = merged.find((p) => asObject(p)['@_modelId'] === '9');
		expect(appended).toBeDefined();
		const spPr = asObject(asObject(appended)['dgm:spPr']);
		expect(asObject(asObject(spPr['a:solidFill'])['a:srgbClr'])['@_val']).toBe('010203');
	});

	it('leaves points without style untouched (no spPr added)', () => {
		const existing: XmlObject[] = [contentPoint('1', 'One')];
		const merged = mergeSmartArtPointXml(existing, [{ id: '1', text: 'One' }]);
		expect(asObject(merged[0])).not.toHaveProperty('dgm:spPr');
	});
});
