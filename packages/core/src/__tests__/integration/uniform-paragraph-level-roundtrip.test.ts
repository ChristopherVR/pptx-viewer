import { describe, it, expect } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import type { PptxElement } from '../../core/types';

/**
 * Integration: a nested paragraph (`a:pPr/@lvl`) must survive save even when
 * every run in the text body shares one style.
 *
 * Regression guard, same family as `uniform-field-segment-roundtrip`:
 * `areTextSegmentsUniform` judged such segments "uniform", so the save path
 * discarded them and rebuilt the paragraphs from the flat `el.text` string.
 * That string carries no indent level, so every nested bullet in a
 * uniformly-styled list came back from a round-trip flattened to the top level.
 * Found while building Outline view, whose entire promote/demote gesture writes
 * exactly this attribute.
 */
describe('uniform-styled paragraph level round-trip', () => {
	it('preserves a:pPr/@lvl on a body whose runs all share one style', async () => {
		const { handler, data } = await PptxHandler.createBlank({ initialSlideCount: 1 });

		const style = { fontSize: 18 };
		const element = {
			id: 'lvl-el',
			type: 'text',
			x: 40,
			y: 40,
			width: 400,
			height: 200,
			text: 'Top\nNested',
			textStyle: style,
			textSegments: [
				{ text: 'Top', style },
				{ text: '\n', style, isParagraphBreak: true },
				{ text: 'Nested', style, paragraphLevel: 2 },
			],
		} as unknown as PptxElement;
		data.slides[0].elements.push(element);

		const saved = await handler.save(data.slides);
		const reloaded = await handler.load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);

		const roundTripped = reloaded.slides[0].elements.find((entry) =>
			(entry.text ?? '').includes('Nested'),
		);
		const segments = (
			roundTripped as unknown as { textSegments?: Array<{ paragraphLevel?: number }> }
		).textSegments;
		const nested = segments?.find((segment) => segment.paragraphLevel !== undefined);
		expect(nested?.paragraphLevel, 'a:pPr/@lvl was flattened on save').toBe(2);
	});
});
