/**
 * A colour picked from the theme palette must be SAVED as
 * `<a:schemeClr val="accent1"><a:lumMod/><a:lumOff/></a:schemeClr>` instead of
 * a canonical `<a:srgbClr>`, so it keeps following the theme after a later
 * theme change. `ShapeStyle.fillColorRef` / `strokeColorRef`, text run
 * `colorRef`, and bullet `colorRef` are what carry that ref through the
 * in-memory model; this test proves the ref survives a full
 * load -> edit(ref) -> save -> re-parse cycle for each surface, and that a
 * theme switch re-resolves the ref to the new theme's hex.
 */
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxShapeElement, PptxTextElement } from '../../core/types';
import { applyThemeToData } from '../../core/utils/theme-switching';

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function slide1Xml(bytes: Uint8Array): Promise<string> {
	const zip = await JSZip.loadAsync(bytes);
	return await zip.file('ppt/slides/slide1.xml')!.async('string');
}

function findShape(handlerData: Awaited<ReturnType<PptxHandler['load']>>): PptxShapeElement {
	const element = handlerData.slides[0]?.elements.find(
		(candidate): candidate is PptxShapeElement => candidate.type === 'shape',
	);
	expect(element, 'shape element missing after round-trip').toBeTruthy();
	return element!;
}

function findText(handlerData: Awaited<ReturnType<PptxHandler['load']>>): PptxTextElement {
	const element = handlerData.slides[0]?.elements.find(
		(candidate): candidate is PptxTextElement => candidate.type === 'text',
	);
	expect(element, 'text element missing after round-trip').toBeTruthy();
	return element!;
}

describe('theme colour ref round-trip', () => {
	it('saves shape fill/stroke refs as a:schemeClr and re-parses the same ref', async () => {
		const {
			handler: seedHandler,
			data: seedData,
			createSlide,
		} = await PresentationBuilder.create();
		seedData.slides.push(
			createSlide('Blank')
				.addShape('rect', {
					fill: { type: 'solid', color: '#4472C4' },
					stroke: { color: '#ED7D31', width: 2 },
				})
				.build(),
		);
		const source = await seedHandler.save(seedData.slides);

		const handler = new PptxHandler();
		const loaded = await handler.load(asArrayBuffer(source));
		const shape = findShape(loaded);
		expect(shape.shapeStyle?.fillColorRef).toBeUndefined();

		// Pick the fill/stroke from the theme palette: "Accent 1, Lighter 40%"
		// and plain "Accent 2".
		shape.shapeStyle!.fillColorRef = { scheme: 'accent1', lumMod: 0.6, lumOff: 0.4 };
		shape.shapeStyle!.strokeColorRef = { scheme: 'accent2' };

		const firstSave = await handler.save(loaded.slides);
		const xml = await slide1Xml(firstSave);
		// The whole point: no canonical srgbClr for a colour that carries a ref.
		expect(xml).toContain('<a:schemeClr val="accent1">');
		expect(xml).toContain('<a:schemeClr val="accent2"');
		expect(xml).not.toContain('4472C4');
		expect(xml).not.toContain('ED7D31');

		const firstReload = await handler.load(asArrayBuffer(firstSave));
		const reloadedShape = findShape(firstReload);
		expect(reloadedShape.shapeStyle?.fillColorRef).toStrictEqual({
			scheme: 'accent1',
			lumMod: 0.6,
			lumOff: 0.4,
		});
		expect(reloadedShape.shapeStyle?.strokeColorRef).toStrictEqual({ scheme: 'accent2' });

		// Second save/reload: the ref must not decay back to sRGB.
		const secondSave = await handler.save(firstReload.slides);
		const secondReload = await handler.load(asArrayBuffer(secondSave));
		expect(findShape(secondReload).shapeStyle?.fillColorRef).toStrictEqual({
			scheme: 'accent1',
			lumMod: 0.6,
			lumOff: 0.4,
		});
	});

	it('saves a text run colorRef and a bullet colorRef as a:schemeClr', async () => {
		const {
			handler: seedHandler,
			data: seedData,
			createSlide,
		} = await PresentationBuilder.create();
		seedData.slides.push(
			createSlide('Blank')
				.addText('Themed text', { x: 40, y: 40, width: 400, height: 60, color: '#000000' })
				.build(),
		);
		const source = await seedHandler.save(seedData.slides);

		const handler = new PptxHandler();
		const loaded = await handler.load(asArrayBuffer(source));
		const text = findText(loaded);
		text.textSegments![0]!.style.colorRef = { scheme: 'accent3' };
		text.textSegments![0]!.bulletInfo = { char: '•', colorRef: { scheme: 'accent4' } };

		const firstSave = await handler.save(loaded.slides);
		const xml = await slide1Xml(firstSave);
		expect(xml).toContain('<a:schemeClr val="accent3"');
		expect(xml).toContain('<a:schemeClr val="accent4"');

		const reloaded = await handler.load(asArrayBuffer(firstSave));
		const reloadedText = findText(reloaded);
		// The bullet marker and the run text are separate segments once reparsed
		// (the marker carries `bulletInfo`, mirroring `bullet-info-roundtrip.test.ts`);
		// the run's own colour lives on the content segment.
		const markerSegment = reloadedText.textSegments?.find((seg) => seg.bulletInfo);
		const contentSegment = reloadedText.textSegments?.find((seg) => !seg.bulletInfo);
		expect(contentSegment?.style.colorRef).toStrictEqual({ scheme: 'accent3' });
		expect(markerSegment?.bulletInfo?.colorRef).toStrictEqual({ scheme: 'accent4' });
	});

	it('re-resolves a fillColorRef to the new theme hex on a theme switch', async () => {
		const {
			handler: seedHandler,
			data: seedData,
			createSlide,
		} = await PresentationBuilder.create();
		seedData.slides.push(
			createSlide('Blank')
				.addShape('rect', { fill: { type: 'solid', color: '#4472C4' } })
				.build(),
		);
		const source = await seedHandler.save(seedData.slides);

		const handler = new PptxHandler();
		const loaded = await handler.load(asArrayBuffer(source));
		const shape = findShape(loaded);
		shape.shapeStyle!.fillColorRef = { scheme: 'accent1' };
		expect(shape.shapeStyle!.fillColor?.toLowerCase()).toBe('#4472c4');

		const newColorScheme = {
			...loaded.theme!.colorScheme!,
			accent1: '#FF0000',
		};
		const switched = applyThemeToData(loaded, newColorScheme);
		const switchedShape = findShape(switched);
		// The ref re-resolved to the NEW theme's accent1, not a leftover hex.
		expect(switchedShape.shapeStyle?.fillColor?.toLowerCase()).toBe('#ff0000');
		expect(switchedShape.shapeStyle?.fillColorRef).toStrictEqual({ scheme: 'accent1' });
	});
});
