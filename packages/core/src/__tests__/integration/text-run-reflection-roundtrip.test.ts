import { describe, it, expect } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import type { PptxElement } from '../../core/types';

/**
 * Integration: a text run's `a:rPr/a:effectLst/a:reflection` must survive a
 * load -> save -> reload cycle for the full attribute set, not just
 * `@dist`/`@stA`/`@endA`/`@blurRad`.
 *
 * Regression guard for the gap documented in `docs/guide/limitations.md`:
 * core's text-run parser used to drop `@sx`/`@sy`, `@kx`/`@ky`, `@rot`,
 * `@fadeDir` and `@algn` on a run's reflection even though the shape-level
 * parser (`PptxShapeEffectStyleExtractor`) already extracted all of them, so
 * an authored value for any of those five attributes on a text run was lost
 * on load and never round-tripped through a save.
 */
describe('text-run reflection round-trip', () => {
	it('preserves sx/sy, kx/ky, rot, fadeDir and algn on a:rPr/a:effectLst/a:reflection', async () => {
		const { handler, data } = await PptxHandler.createBlank({ initialSlideCount: 1 });

		const style = {
			fontSize: 24,
			textReflection: true,
			textReflectionBlur: 2,
			textReflectionStartOpacity: 0.6,
			textReflectionEndOpacity: 0.1,
			textReflectionOffset: 1,
			textReflectionFadeDirection: 45,
			textReflectionScaleX: 50000,
			textReflectionScaleY: 150000,
			textReflectionSkewX: 600000,
			textReflectionSkewY: -300000,
			textReflectionRotation: 30,
			textReflectionAlignment: 'br',
		};
		const element = {
			id: 'refl-run',
			type: 'text',
			x: 40,
			y: 40,
			width: 400,
			height: 200,
			text: 'Reflected',
			textStyle: style,
			textSegments: [{ text: 'Reflected', style }],
		} as unknown as PptxElement;
		data.slides[0].elements.push(element);

		const saved = await handler.save(data.slides);
		const reloaded = await handler.load(
			saved.buffer.slice(saved.byteOffset, saved.byteOffset + saved.byteLength) as ArrayBuffer,
		);

		const roundTripped = reloaded.slides[0].elements.find((entry) =>
			(entry.text ?? '').includes('Reflected'),
		);
		const segments = (
			roundTripped as unknown as {
				textSegments?: Array<{
					style?: Record<string, unknown>;
				}>;
			}
		).textSegments;
		const runStyle = segments?.[0]?.style;

		expect(runStyle?.textReflection).toBeTruthy();
		expect(runStyle?.textReflectionBlur).toBeCloseTo(2);
		expect(runStyle?.textReflectionStartOpacity).toBeCloseTo(0.6);
		expect(runStyle?.textReflectionEndOpacity).toBeCloseTo(0.1);
		expect(runStyle?.textReflectionOffset).toBeCloseTo(1);
		expect(runStyle?.textReflectionFadeDirection).toBeCloseTo(45);
		expect(runStyle?.textReflectionScaleX).toBe(50000);
		expect(runStyle?.textReflectionScaleY).toBe(150000);
		expect(runStyle?.textReflectionSkewX).toBe(600000);
		expect(runStyle?.textReflectionSkewY).toBe(-300000);
		expect(runStyle?.textReflectionRotation).toBeCloseTo(30);
		expect(runStyle?.textReflectionAlignment).toBe('br');
	});
});
