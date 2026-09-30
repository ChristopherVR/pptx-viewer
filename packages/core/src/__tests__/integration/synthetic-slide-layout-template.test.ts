import fs from 'node:fs';
import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import type { PptxData, PptxSlide } from '../../core/types';
import { requireFixture } from '../require-fixture';

const fixturePath = requireFixture(
	path.resolve(__dirname, '../../../../../e2e/fixtures/template-editing.pptx'),
);

describe('layout inheritance for synthetic slides', () => {
	let handler: PptxHandler;
	let data: PptxData;

	beforeAll(async () => {
		const bytes = fs.readFileSync(fixturePath);
		handler = new PptxHandler();
		data = await handler.load(
			bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
		);
	}, 30_000);

	it('resolves template artwork immediately and follows repeated layout changes', async () => {
		const syntheticSlide = {
			id: 'slide-new',
			rId: '',
			slideNumber: 2,
			elements: [],
		} as unknown as PptxSlide;
		const slides = [syntheticSlide];
		const firstLayout = data.slideMasters
			?.flatMap((master) => master.layouts ?? [])
			.find((layout) =>
				layout.elements?.some((element) => 'text' in element && element.text === 'TPL-LAYOUT-ORIG'),
			)?.path;
		expect(firstLayout).toBeDefined();
		const secondLayout = data.layoutOptions?.find((layout) => layout.path !== firstLayout)?.path;
		expect(secondLayout).toBeDefined();

		await handler.applyLayoutToSlide(0, firstLayout!, slides);
		const firstTemplate = await handler.getTemplateElementsForSlide('slide-new');
		expect(firstTemplate.length).toBeGreaterThan(0);
		expect(
			firstTemplate.some((element) => 'text' in element && element.text === 'TPL-LAYOUT-ORIG'),
		).toBeTruthy();

		await handler.applyLayoutToSlide(0, secondLayout!, slides);
		const secondTemplate = await handler.getTemplateElementsForSlide('slide-new');
		expect(secondTemplate.length).toBeGreaterThan(0);
		expect(
			secondTemplate.some((element) => 'text' in element && element.text === 'TPL-LAYOUT-ORIG'),
		).toBeFalsy();
		expect(slides[0].layoutPath).toBe(secondLayout);

		await handler.applyLayoutToSlide(0, firstLayout!, slides);
		const restoredTemplate = await handler.getTemplateElementsForSlide('slide-new');
		expect(
			restoredTemplate.some((element) => 'text' in element && element.text === 'TPL-LAYOUT-ORIG'),
		).toBeTruthy();
	});
});
