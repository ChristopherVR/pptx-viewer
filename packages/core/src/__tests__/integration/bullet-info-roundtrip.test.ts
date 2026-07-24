import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { PptxTextElement } from '../../core/types';

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
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
});
