import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';
import type { PptxElement, TextSegment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { applyRibbonGalleryItem, buildRibbonGallery } from './gallery-registry';

const colorMap = {
	dk1: '#000000',
	lt1: '#FFFFFF',
	tx1: '#000000',
	bg1: '#FFFFFF',
	tx2: '#0E2841',
	bg2: '#E8E8E8',
	accent1: '#156082',
	accent2: '#E97132',
	accent3: '#196B24',
	accent4: '#0F9ED5',
	accent5: '#A02B93',
	accent6: '#4EA72E',
};

function textBox(): PptxElement {
	return {
		id: 't1',
		type: 'text',
		x: 0,
		y: 0,
		width: 200,
		height: 80,
		text: 'Abc',
		textStyle: { fontSize: 36 },
		textSegments: [
			{ text: 'Abc', style: { fontSize: 36, color: '#000000', textShadowColor: '#FF0000' } },
		],
	} as unknown as PptxElement;
}

function patched(itemId: string, element: PptxElement = textBox()): PptxElement {
	const result = applyRibbonGalleryItem('wordArtStyles', itemId, {
		element,
		themeColorMap: colorMap,
	});
	if (result?.kind !== 'element') {
		throw new Error(itemId);
	}
	return { ...element, ...result.patch } as PptxElement;
}

const runStyle = (element: PptxElement) =>
	(element as { textSegments: TextSegment[] }).textSegments[0].style;

describe('wordArt Styles gallery', () => {
	it('offers the 30 captured styles as Abc tiles', () => {
		const d = buildRibbonGallery('wordArtStyles', { element: textBox(), themeColorMap: colorMap });
		expect(d.disabled).toBeFalsy();
		expect(d.sections[0].items).toHaveLength(30);
		expect(d.sections[0].items[0].previewSvg).toContain('>Abc</text>');
		expect(d.sections[0].items[19].previewSvg).toContain('>ABC</text>');
		expect(buildRibbonGallery('wordArtStyles', { element: null }).disabled).toBeTruthy();
		expect(
			applyRibbonGalleryItem('wordArtStyles', 'wordArt-30', { element: textBox() }),
		).toBeNull();
	});

	it('writes the fill in theme terms and replaces the previous effects', () => {
		const style = runStyle(patched('wordArt-4'));
		expect(style.color).toBe('#196B24');
		expect(style.colorXml).toStrictEqual({ 'a:schemeClr': { '@_val': 'accent3' } });
		expect(style.colorRef).toStrictEqual({ scheme: 'accent3' });
		expect(style.bold).toBeTruthy();
		expect(style.textOutlineWidth).toBeCloseTo(19050 / 9525);
		expect(style.textShadowColor).toBe('#000000');
		expect(style.textShadowOpacity).toBe(0.35);
		expect(style.fontSize).toBe(36);
	});

	it('maps glow, inner shadow, gradient and reflection styles', () => {
		const glow = runStyle(patched('wordArt-6'));
		expect(glow.textShadowColor).toBeUndefined();
		expect(glow.textGlowRadius).toBeCloseTo(53100 / 9525);
		expect(glow.textGlowOpacity).toBe(0.3);
		expect(glow.textGlowColorXml).toStrictEqual({
			'a:schemeClr': {
				'@_val': 'accent6',
				'a:satMod': { '@_val': '180000' },
				'a:alpha': { '@_val': '30000' },
			},
		});
		expect(glow.characterSpacing).toBe(50);
		const inner = runStyle(patched('wordArt-9'));
		expect(inner.textInnerShadowColor).toBe('#7D7D7D');
		expect(inner.textInnerShadowOpacity).toBe(0.73);
		const gradient = runStyle(patched('wordArt-13'));
		expect(gradient.color).toBeUndefined();
		expect(gradient.textFillGradientStops?.map((s) => s.position)).toStrictEqual([
			0, 9, 50, 79, 100,
		]);
		expect(gradient.textFillGradientAngle).toBe(90);
		const reflected = runStyle(patched('wordArt-19'));
		expect(reflected.textReflection).toBeTruthy();
		expect(reflected.textReflectionEndPosition).toBe(0.45);
		expect(reflected.textCaps).toBe('all');
	});

	it('adds the body bevel for the 3-D styles and clears it for flat ones', () => {
		const bevelled = patched('wordArt-23');
		const textStyle = (bevelled as { textStyle: Record<string, unknown> }).textStyle;
		expect(textStyle.text3d).toStrictEqual({
			extrusionHeight: 31750,
			presetMaterial: 'powder',
			bevelTopType: 'angle',
			bevelTopWidth: 19050,
			bevelTopHeight: 19050,
		});
		const flat = patched('wordArt-0', bevelled) as { textStyle: Record<string, unknown> };
		expect(flat.textStyle.text3d).toBeUndefined();
	});

	it('reports the applied tile', () => {
		const d = buildRibbonGallery('wordArtStyles', {
			element: patched('wordArt-15'),
			themeColorMap: colorMap,
		});
		expect(d.sections[0].items.filter((i) => i.applied).map((i) => i.id)).toStrictEqual([
			'wordArt-15',
		]);
	});
});

describe('wordArt round trip', () => {
	it('saves a style with the a:rPr PowerPoint writes (COM capture)', async () => {
		const { handler, data, createSlide } = await PptxHandler.createBlank({ title: 'WordArt' });
		data.slides = [
			createSlide('Blank').addText('Abc', { x: 40, y: 40, width: 300, height: 100 }).build(),
		];
		const loadedHandler = new PptxHandler();
		const loaded = await loadedHandler.load(
			(await handler.save(data.slides)).buffer as ArrayBuffer,
		);
		const slide = loaded.slides[0];
		const target = slide.elements.find((el) => el.type === 'text') as PptxElement;
		const result = applyRibbonGalleryItem('wordArtStyles', 'wordArt-6', {
			element: target,
			themeColorMap: loaded.themeColorMap,
		});
		if (result?.kind !== 'element') {
			throw new Error('no patch');
		}
		slide.elements = slide.elements.map((el) =>
			el.id === target.id ? ({ ...el, ...result.patch } as PptxElement) : el,
		);
		const zip = await JSZip.loadAsync(await loadedHandler.save(loaded.slides));
		const xml = (await zip.file('ppt/slides/slide1.xml')?.async('string')) ?? '';
		const rPr = (/<a:rPr[^>]*>.*?<\/a:rPr>/su.exec(xml)?.[0] ?? '').replace(
			/<(a:\w+)([^>]*)><\/\1>/gu,
			'<$1$2/>',
		);
		// PowerPoint (TextFrame2.WordArtformat = 6):
		// <a:rPr lang="en-US" sz="3600" b="1" spc="50"><a:ln w="12700" cmpd="sng"><a:solidFill>
		// <a:schemeClr val="accent6"><a:satMod val="120000"/><a:shade val="80000"/></a:schemeClr>
		// </a:solidFill><a:prstDash val="solid"/></a:ln><a:solidFill><a:schemeClr val="accent6">
		// <a:tint val="1000"/></a:schemeClr></a:solidFill><a:effectLst><a:glow rad="53100">
		// <a:schemeClr val="accent6"><a:satMod val="180000"/><a:alpha val="30000"/></a:schemeClr>
		// </a:glow></a:effectLst></a:rPr>
		expect(rPr).toMatch(/ b="1"/u);
		expect(rPr).toMatch(/ spc="50"/u);
		// The outline colour is the one part written as flat sRGB (TextStyle has no
		// outline colour node); its resolved value is PowerPoint's.
		expect(rPr).toMatch(
			/<a:ln w="12700"><a:solidFill><a:srgbClr val="[0-9A-F]{6}"\/><\/a:solidFill><\/a:ln>/u,
		);
		expect(rPr).toContain(
			'</a:ln><a:solidFill><a:schemeClr val="accent6"><a:tint val="1000"/></a:schemeClr></a:solidFill>',
		);
		expect(rPr).toContain(
			'<a:effectLst><a:glow rad="53100"><a:schemeClr val="accent6"><a:satMod val="180000"/><a:alpha val="30000"/></a:schemeClr></a:glow></a:effectLst>',
		);

		const reloaded = await new PptxHandler().load(
			(await loadedHandler.save(loaded.slides)).buffer as ArrayBuffer,
		);
		const back = reloaded.slides[0].elements.find((el) => el.id === target.id) as PptxElement;
		const d = buildRibbonGallery('wordArtStyles', {
			element: back,
			themeColorMap: reloaded.themeColorMap,
		});
		expect(d.sections[0].items.filter((i) => i.applied).map((i) => i.id)).toStrictEqual([
			'wordArt-6',
		]);
	});
});
