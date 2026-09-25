import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { translationsEn } from '../../i18n/translations-en';
import { applyRibbonGalleryItem, buildRibbonGallery } from './gallery-registry';

const PNG =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

function picture(extra: Record<string, unknown> = {}): PptxElement {
	return {
		id: 'p1',
		type: 'picture',
		x: 0,
		y: 0,
		width: 200,
		height: 150,
		shapeType: 'rect',
		shapeStyle: {},
		...extra,
	} as unknown as PptxElement;
}

function patchOf(itemId: string, element: PptxElement): Partial<PptxElement> {
	const result = applyRibbonGalleryItem('pictureStyles', itemId, { element });
	if (result?.kind !== 'element') {
		throw new Error(`no patch for ${itemId}`);
	}
	return result.patch;
}

function styleOf(patch: Partial<PptxElement>): ShapeStyle {
	return (patch as { shapeStyle: ShapeStyle }).shapeStyle;
}

describe('picture Styles gallery', () => {
	it("offers PowerPoint's 28 styles in gallery order, each with a label and tile", () => {
		const d = buildRibbonGallery('pictureStyles', { element: picture() });
		expect(d.disabled).toBeFalsy();
		const items = d.sections.flatMap((s) => s.items);
		expect(items).toHaveLength(28);
		expect(items[0].id).toBe('simpleFrameWhite');
		expect(items[27].id).toBe('metalOval');
		for (const item of items) {
			expect(translationsEn[item.labelKey]).toBe(item.label);
			expect(item.previewSvg.startsWith('<svg')).toBeTruthy();
		}
	});

	it('is disabled without a picture and ignores unknown ids', () => {
		expect(buildRibbonGallery('pictureStyles', { element: null }).disabled).toBeTruthy();
		const shape = { ...picture(), type: 'shape' } as unknown as PptxElement;
		expect(buildRibbonGallery('pictureStyles', { element: shape }).disabled).toBeTruthy();
		expect(applyRibbonGalleryItem('pictureStyles', 'metalOval', { element: shape })).toBeNull();
		expect(applyRibbonGalleryItem('pictureStyles', 'nope', { element: picture() })).toBeNull();
	});

	it('writes the captured frame, shadow and bevel of Simple Frame, White', () => {
		const style = styleOf(patchOf('simpleFrameWhite', picture()));
		expect(style.strokeWidth).toBeCloseTo(88900 / 9525);
		expect(style.strokeColor).toBe('#FFFFFF');
		expect(style.lineCap).toBe('sq');
		expect(style.fillColorXml).toStrictEqual({
			'a:srgbClr': { '@_val': 'FFFFFF', 'a:shade': { '@_val': '85000' } },
		});
		expect(style.shadowOpacity).toBe(0.4);
		expect(style.shape3d).toMatchObject({ bevelTopWidth: 25400, bevelTopHeight: 19050 });
		expect(style.styleMatrixReset).toBeTruthy();
	});

	it('replaces geometry and every previous effect wholesale', () => {
		const oval = picture(patchOf('metalOval', picture()));
		expect((oval as { cropShape?: string }).cropShape).toBe('ellipse');
		const next = patchOf('softEdgeRectangle', oval);
		const style = styleOf(next);
		expect(next).toMatchObject({ shapeType: 'rect', cropShape: undefined });
		expect(style.softEdgeRadius).toBeCloseTo(112500 / 9525);
		expect(style.shadowColor).toBeUndefined();
		expect(style.scene3d).toBeUndefined();
		expect(style.shape3d).toBeUndefined();
		expect(style.strokeFillMode).toBe('none');
		const rounded = patchOf('reflectedRoundedRectangle', oval);
		expect(rounded).toMatchObject({ shapeType: 'roundRect', shapeAdjustments: { adj: 8594 } });
	});

	it('marks exactly the applied style', () => {
		for (const id of [
			'moderateFrameWhite',
			'rotatedWhite',
			'doubleFrameBlack',
			'reflectedBevelWhite',
		]) {
			const element = picture(patchOf(id, picture()));
			const d = buildRibbonGallery('pictureStyles', { element });
			const applied = d.sections.flatMap((s) => s.items).filter((i) => i.applied);
			expect(applied.map((i) => i.id)).toStrictEqual([id]);
		}
	});
});

/** Collapse fast-xml-parser's `<x></x>` pairs so saved XML compares with PowerPoint's. */
function norm(xml: string): string {
	return xml.replace(/<(a:\w+)([^>]*)><\/\1>/gu, '<$1$2/>');
}

async function savedPicSpPr(handler: PptxHandler, slides: Parameters<PptxHandler['save']>[0]) {
	const zip = await JSZip.loadAsync(await handler.save(slides));
	const xml = norm((await zip.file('ppt/slides/slide1.xml')?.async('string')) ?? '');
	return /<p:pic>.*?<\/p:pic>/su.exec(xml)?.[0] ?? '';
}

describe('picture Styles round trip', () => {
	it('saves a pick as PowerPoint writes it (COM capture) and reloads it as applied', async () => {
		const { handler, data, createSlide } = await PptxHandler.createBlank({ title: 'Pictures' });
		data.slides = [
			createSlide('Blank').addImage(PNG, { x: 50, y: 50, width: 240, height: 180 }).build(),
		];
		const loadedHandler = new PptxHandler();
		const loaded = await loadedHandler.load(
			(await handler.save(data.slides)).buffer as ArrayBuffer,
		);
		const slide = loaded.slides[0];
		const target = slide.elements.find((el) => el.type === 'image' || el.type === 'picture');
		if (!target) {
			throw new Error('no picture');
		}
		// A rounded style first, so the switch to a rect must drop its guides.
		let element = { ...target, ...patchOf('bevelRectangle', target) } as PptxElement;
		element = { ...element, ...patchOf('relaxedPerspectiveWhite', element) } as PptxElement;
		slide.elements = slide.elements.map((el) => (el.id === target.id ? element : el));
		const pic = await savedPicSpPr(loadedHandler, loaded.slides);

		expect(pic).toContain('<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>');
		expect(pic).toContain(
			'<a:solidFill><a:srgbClr val="FFFFFF"><a:shade val="85000"/></a:srgbClr></a:solidFill>',
		);
		expect(pic).toMatch(/<a:ln w="101600" cap="sq"><a:solidFill><a:srgbClr val="FDFDFD"\/>/u);
		expect(pic).toMatch(/<a:outerShdw[^>]* blurRad="57150"[^>]* dist="37500"[^>]* dir="7560000"/u);
		expect(pic).toMatch(/<a:outerShdw[^>]* sy="98000"[^>]* kx="110000"[^>]* ky="200000"/u);
		expect(pic).toContain(
			'<a:srgbClr val="000000"><a:alpha val="20000"/></a:srgbClr></a:outerShdw>',
		);
		expect(pic).toContain(
			'<a:camera prst="perspectiveRelaxed"><a:rot lat="18960000" lon="0" rev="0"/>',
		);
		expect(pic).toContain('<a:rot lat="0" lon="0" rev="7200000"/>');
		expect(pic).toMatch(/<a:sp3d prstMaterial="matte"><a:bevelT[^>]* w="22860" h="12700"\/>/u);
		expect(pic).not.toContain('relaxedInset');
		expect(pic).not.toContain('plastic');

		const reloaded = await new PptxHandler().load(
			(await loadedHandler.save(loaded.slides)).buffer as ArrayBuffer,
		);
		const back = reloaded.slides[0].elements.find((el) => el.id === target.id) as PptxElement;
		const d = buildRibbonGallery('pictureStyles', { element: back });
		const applied = d.sections.flatMap((s) => s.items).filter((i) => i.applied);
		expect(applied.map((i) => i.id)).toStrictEqual(['relaxedPerspectiveWhite']);
	});
});
