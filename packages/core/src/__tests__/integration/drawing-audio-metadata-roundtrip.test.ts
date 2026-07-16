import { describe, expect, it } from 'vitest';

import { PresentationBuilder } from '../../core/builders/sdk/PresentationBuilder';
import { PptxHandler } from '../../core/PptxHandler';
import type { MediaPptxElement } from '../../core/types';

describe('drawingML audio metadata round-trip', () => {
	it('authors and reloads an Audio CD reference without a media relationship', async () => {
		const { handler, data, createSlide } = await PresentationBuilder.create();
		const slide = createSlide('Blank').build();
		slide.elements.push({
			id: 'audio-cd-1',
			type: 'media',
			x: 20,
			y: 30,
			width: 160,
			height: 40,
			mediaType: 'audio',
			mediaReferenceKind: 'audioCd',
			audioCdStart: { track: 2, time: 1500 },
			audioCdEnd: { track: 4, time: 2500 },
		} as MediaPptxElement);
		data.slides.push(slide);

		const bytes = await handler.save(data.slides);
		const reloaded = await new PptxHandler().load(bytes.buffer as ArrayBuffer);
		const audio = reloaded.slides[0].elements.find(
			(element): element is MediaPptxElement => element.type === 'media',
		);
		expect(audio).toMatchObject({
			mediaType: 'audio',
			mediaReferenceKind: 'audioCd',
			audioCdStart: { track: 2, time: 1500 },
			audioCdEnd: { track: 4, time: 2500 },
		});
	});
});
