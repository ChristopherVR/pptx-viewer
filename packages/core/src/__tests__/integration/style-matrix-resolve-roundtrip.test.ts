/**
 * `resolveStyleMatrixReferences` resolves a `<p:style>` exactly as the load
 * path does, and a shape given its result saves as PowerPoint's Shape Styles
 * gallery writes it: a bare `<p:style>` and an `spPr` with no fill or
 * outline of its own (ground truth: `scripts/capture-gallery-writes-com.ps1`).
 */
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import type { PptxElement, ShapeStyle, XmlObject } from '../../core/types';

const scheme = (val: string, transforms: Record<string, string> = {}): XmlObject => ({
	'a:schemeClr': {
		'@_val': val,
		...Object.fromEntries(Object.entries(transforms).map(([k, v]) => [`a:${k}`, { '@_val': v }])),
	},
});

/** Shape Styles "Colored Fill - Accent 1" (msoShapeStylePreset9). */
const COLORED_FILL_ACCENT1: XmlObject = {
	'a:lnRef': { '@_idx': '2', ...scheme('accent1', { shade: '15000' }) },
	'a:fillRef': { '@_idx': '1', ...scheme('accent1') },
	'a:effectRef': { '@_idx': '0', ...scheme('accent1') },
	'a:fontRef': { '@_idx': 'minor', ...scheme('lt1') },
};

async function deckWithShape() {
	const { handler, data, createSlide } = await PptxHandler.createBlank({ title: 'Styles' });
	data.slides = [
		createSlide('Blank')
			.addShape('rect', {
				x: 50,
				y: 50,
				width: 200,
				height: 100,
				fill: { type: 'solid', color: '#FF0000' },
			})
			.build(),
	];
	const bytes = await handler.save(data.slides);
	const reloaded = new PptxHandler();
	const loaded = await reloaded.load(bytes.buffer as ArrayBuffer);
	return { handler: reloaded, data: loaded };
}

describe('resolveStyleMatrixReferences', () => {
	it('resolves fill, outline and font references against the theme', async () => {
		const { handler, data } = await deckWithShape();
		const { shapeStyle, fontColor } = handler.resolveStyleMatrixReferences(COLORED_FILL_ACCENT1);
		const accent1 = data.themeColorMap?.accent1?.toLowerCase();
		expect(shapeStyle.fillMode).toBe('solid');
		expect(shapeStyle.fillColor?.toLowerCase()).toBe(accent1);
		expect(shapeStyle.fillRefIdx).toBe(1);
		expect(shapeStyle.lnRefIdx).toBe(2);
		expect(shapeStyle.strokeWidth).toBeGreaterThan(0);
		expect(shapeStyle.inheritedFillStyle?.fillColor).toBe(shapeStyle.fillColor);
		expect(fontColor?.toLowerCase()).toBe(data.themeColorMap?.lt1?.toLowerCase());
	});

	it('treats lnRef idx 0 as no outline, as PowerPoint does', async () => {
		const { handler } = await deckWithShape();
		const { shapeStyle } = handler.resolveStyleMatrixReferences({
			'a:lnRef': { '@_idx': '0', ...scheme('accent1') },
			'a:fillRef': { '@_idx': '3', ...scheme('accent1') },
		});
		expect(shapeStyle.strokeWidth).toBe(0);
		expect(shapeStyle.fillMode).toBe('gradient');
	});

	it('saves an applied style as a bare p:style with an empty spPr', async () => {
		const { handler, data } = await deckWithShape();
		const { shapeStyle } = handler.resolveStyleMatrixReferences(COLORED_FILL_ACCENT1);
		const slide = data.slides[0];
		slide.elements = slide.elements.map((el): PptxElement =>
			el.type === 'shape'
				? ({ ...el, shapeStyle: { ...shapeStyle } as ShapeStyle } as PptxElement)
				: el,
		);
		const bytes = await handler.save(data.slides);
		const zip = await JSZip.loadAsync(bytes);
		const xml = (await zip.file('ppt/slides/slide1.xml')?.async('string')) ?? '';
		const spPr = /<p:spPr>(.*?)<\/p:spPr>/su.exec(xml)?.[1] ?? '';
		expect(spPr).not.toContain('solidFill');
		expect(spPr).not.toContain('<a:ln');
		// CT_Shape order: a NEW p:style must sit between spPr and txBody, or
		// PowerPoint ignores it.
		expect(xml.indexOf('<p:style>')).toBeLessThan(xml.indexOf('<p:txBody>'));
		expect(xml.indexOf('<p:style>')).toBeGreaterThan(xml.indexOf('</p:spPr>'));
		const style = /<p:style>(.*?)<\/p:style>/su.exec(xml)?.[1] ?? '';
		// fast-xml-parser writes empty elements as open/close pairs.
		const norm = style.replace(/<(a:\w+)([^>]*)><\/\1>/gu, '<$1$2/>');
		expect(norm).toBe(
			'<a:lnRef idx="2"><a:schemeClr val="accent1"><a:shade val="15000"/></a:schemeClr></a:lnRef>' +
				'<a:fillRef idx="1"><a:schemeClr val="accent1"/></a:fillRef>' +
				'<a:effectRef idx="0"><a:schemeClr val="accent1"/></a:effectRef>' +
				'<a:fontRef idx="minor"><a:schemeClr val="lt1"/></a:fontRef>',
		);
	});
});
