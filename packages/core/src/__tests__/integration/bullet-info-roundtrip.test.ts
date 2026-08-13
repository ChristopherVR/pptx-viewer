import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxTextElement } from '../../core/types';

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Saved packages are DEFLATE-compressed, so the part has to be inflated. */
async function countBuNone(bytes: Uint8Array): Promise<number> {
	const zip = await JSZip.loadAsync(bytes);
	const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
	return (xml.match(/<a:buNone\s*\/>|<a:buNone>/gu) ?? []).length;
}

function findTextElement(handlerData: Awaited<ReturnType<PptxHandler['load']>>): PptxTextElement {
	const element = handlerData.slides[0]?.elements.find(
		(candidate): candidate is PptxTextElement =>
			candidate.type === 'text' && candidate.text?.includes('Plain paragraph') === true,
	);
	expect(element, 'plain text element missing after round-trip').toBeTruthy();
	return element!;
}

function expectNativeBullet(element: PptxTextElement): void {
	expect(element.textSegments?.[0]?.bulletInfo?.char).toBe('•');
	const contentText = element.textSegments
		?.filter((segment) => !segment.bulletInfo)
		.map((segment) => segment.text)
		.join('');
	expect(contentText).not.toMatch(/^•/);
}

describe('bulletInfo round-trip', () => {
	it('preserves a native bullet added to an existing plain paragraph', async () => {
		const {
			handler: seedHandler,
			data: seedData,
			createSlide,
		} = await PresentationBuilder.create();
		seedData.slides.push(
			createSlide('Blank')
				.addText('Plain paragraph', { x: 40, y: 40, width: 240, height: 40 })
				.build(),
		);
		const source = await seedHandler.save(seedData.slides);

		const handler = new PptxHandler();
		const loaded = await handler.load(asArrayBuffer(source));
		const edited = findTextElement(loaded);
		expect(edited.textSegments?.[0]?.bulletInfo).toBeUndefined();
		edited.textSegments![0]!.bulletInfo = { char: '•' };

		const firstSave = await handler.save(loaded.slides);
		const firstReload = await handler.load(asArrayBuffer(firstSave));
		const firstResult = findTextElement(firstReload);
		expectNativeBullet(firstResult);

		const secondSave = await handler.save(firstReload.slides);
		const secondReload = await handler.load(asArrayBuffer(secondSave));
		const secondResult = findTextElement(secondReload);
		expectNativeBullet(secondResult);
	});

	// `a:buNone` is the author saying "no bullet on THIS paragraph". Parsing it
	// produced no marker segment and attached no `bulletInfo`, so the writer was
	// never told and dropped the element: the paragraph then inherited a bullet
	// back from the list style and markers appeared where the author had removed
	// them. 56 instances were lost on the Arabic RTL corpus deck alone.
	it('preserves an explicit a:buNone through load and save', async () => {
		const {
			handler: seedHandler,
			data: seedData,
			createSlide,
		} = await PresentationBuilder.create();
		seedData.slides.push(
			createSlide('Blank')
				.addText('Plain paragraph', { x: 40, y: 40, width: 240, height: 40 })
				.build(),
		);
		const source = await seedHandler.save(seedData.slides);

		const handler = new PptxHandler();
		const loaded = await handler.load(asArrayBuffer(source));
		findTextElement(loaded).textSegments![0]!.bulletInfo = { none: true };

		// The writer already handled `none` correctly; the gap was upstream.
		const firstSave = await handler.save(loaded.slides);
		await expect(countBuNone(firstSave)).resolves.toBe(1);

		// The load side is the regression: without it the suppression reaches the
		// model as nothing at all and the NEXT save silently drops it.
		const firstReload = await handler.load(asArrayBuffer(firstSave));
		expect(findTextElement(firstReload).textSegments?.[0]?.bulletInfo?.none).toBeTruthy();

		// `isDirty` fingerprints content and passes unmodified parts through
		// byte-for-byte, which would prove nothing about the rebuild path.
		const secondSave = await handler.save(
			firstReload.slides.map((slide) => ({ ...slide, isDirty: true })),
		);
		await expect(countBuNone(secondSave)).resolves.toBe(1);
	});
});
