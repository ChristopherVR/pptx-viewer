import fs from 'node:fs';
import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import type { PptxData, PptxElement } from '../../core/types';
import { requireFixture } from '../require-fixture';

type Placeholderish = PptxElement & { placeholderType?: string; promptText?: string };

/**
 * Layout switching on a real deck: Title Slide -> Two Content on the
 * "Balloons"-themed fixture.
 *
 * Pins three behaviours the fabricated-placeholder path used to get wrong:
 * the centred title claims the new layout's title slot (it used to score zero
 * and a duplicate empty title was added), the empty body prompt the switch
 * fabricates carries the layout's prompt text (it used to render as nothing),
 * and that prompt sits behind the slide's own content.
 */
describe('applyLayoutToSlide on a themed deck', () => {
	const fixturePath = requireFixture(
		path.resolve(__dirname, '../fixtures/themed-layout-placeholders.pptx'),
	);
	let handler: PptxHandler;
	let data: PptxData;
	beforeAll(async () => {
		const bytes = fs.readFileSync(fixturePath);
		const buffer = bytes.buffer.slice(
			bytes.byteOffset,
			bytes.byteOffset + bytes.byteLength,
		) as ArrayBuffer;
		handler = new PptxHandler();
		data = await handler.load(buffer);
	}, 30_000);

	it('moves the centred title into the title slot and prompts for the unfilled body', async () => {
		const slide = data.slides[0];
		const target = (data.layoutOptions ?? []).find((option) => option.type === 'twoObj');
		expect(target).toBeDefined();
		// Bindings hold the inherited artwork in their own store.
		const ownSlide = {
			...slide,
			elements: slide.elements.filter((element) => !/^(layout|master)-/u.test(element.id)),
		};
		const slides = data.slides.map((entry, index) => (index === 0 ? ownSlide : entry));

		const updated = await handler.applyLayoutToSlide(0, target!.path, slides);

		expect(updated.layoutPath).toBe(target!.path);
		const title = updated.elements.find((element) => element.id.endsWith('-shape-0')) as
			| Placeholderish
			| undefined;
		expect(title?.placeholderType).toBe('title');
		expect(updated.elements.filter((element) => element.id.startsWith('ph-title-'))).toHaveLength(
			0,
		);

		// The subtitle (idx 1) claims the first content slot; the second one has
		// nothing to hold and is fabricated as a prompt.
		const subtitle = updated.elements.find((element) => element.id.endsWith('-shape-1')) as
			| Placeholderish
			| undefined;
		// Both content slots omit `@type` (PowerPoint's spelling of body), so the
		// model's placeholder type is cleared and the raw `p:ph` names the slot.
		expect(subtitle?.placeholderType).toBeUndefined();
		const subtitlePh = (
			subtitle?.rawXml as
				| { 'p:nvSpPr'?: { 'p:nvPr'?: { 'p:ph'?: { '@_idx'?: string } } } }
				| undefined
		)?.['p:nvSpPr']?.['p:nvPr']?.['p:ph'];
		expect(subtitlePh?.['@_idx']).toBe('1');
		const generated = updated.elements.filter((element) => element.id.startsWith('ph-'));
		expect(generated).toHaveLength(1);
		const body = generated[0] as Placeholderish;
		expect(body.promptText).toMatch(/click to /iu);
		expect(body.textStyle?.fontFamily).toBeDefined();
		// Fabricated prompts go behind the content the switch kept.
		expect(updated.elements[0]).toBe(body);
	}, 30_000);
});
