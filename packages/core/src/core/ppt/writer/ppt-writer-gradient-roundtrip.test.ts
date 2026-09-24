/**
 * A gradient fill written by the `.ppt` writer as a real two-stop
 * `msofillShadeShape` (see `shape-props-writer.ts`) now reads back as a
 * gradient too, not degraded to its first stop's solid colour: `extractFill`
 * in `escher/shape-props.ts` reads `fillType`/`fillBackColor`/`fillAngle`
 * back into a `PptFill.gradient`, and `ppt/pptx/shape-writer.ts` emits a real
 * `a:gradFill` for it.
 *
 * @module ppt/writer/ppt-writer-gradient-roundtrip.test
 */
import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../PptxHandler';
import type { PptxElement } from '../../types';

async function buildGradientDeck(angle: number) {
	const { handler, data, createSlide } = await PptxHandler.createBlank({ title: 'Gradient' });
	const slide = createSlide('Blank')
		.addShape('rect', {
			x: 50,
			y: 50,
			width: 200,
			height: 100,
			text: 'Grad',
			fill: {
				type: 'gradient',
				stops: [
					{ color: '#4472C4', position: 0 },
					{ color: '#ED7D31', position: 1 },
				],
				angle,
			},
		})
		.build();
	data.slides = [slide];
	return { handler, slides: data.slides };
}

function firstShape(elements: PptxElement[]): PptxElement & { shapeStyle?: { fillMode?: string } } {
	const el = elements.find((e) => e.type === 'shape');
	if (!el) {
		throw new Error('no shape element found');
	}
	return el as PptxElement & { shapeStyle?: { fillMode?: string } };
}

describe('.ppt writer: gradient fill round-trip', () => {
	it('reloads a gradient fill as a gradient, not a first-stop solid', async () => {
		const { handler, slides } = await buildGradientDeck(45);
		const bytes = await handler.save(slides, { outputFormat: 'ppt' });

		const reloadHandler = new PptxHandler();
		const reloaded = await reloadHandler.load(bytes.buffer as ArrayBuffer);

		const shape = firstShape(reloaded.slides[0]!.elements) as PptxElement & {
			shapeStyle?: {
				fillMode?: string;
				fillGradientStops?: Array<{ color: string; position: number }>;
				fillGradientAngle?: number;
			};
		};
		expect(shape.shapeStyle?.fillMode).toBe('gradient');
		const stops = shape.shapeStyle?.fillGradientStops ?? [];
		expect(stops).toHaveLength(2);
		expect(stops[0]?.color.replace('#', '').toUpperCase()).toBe('4472C4');
		expect(stops[1]?.color.replace('#', '').toUpperCase()).toBe('ED7D31');
	});

	it('preserves the gradient angle', async () => {
		const { handler, slides } = await buildGradientDeck(135);
		const bytes = await handler.save(slides, { outputFormat: 'ppt' });

		const reloadHandler = new PptxHandler();
		const reloaded = await reloadHandler.load(bytes.buffer as ArrayBuffer);
		const shape = firstShape(reloaded.slides[0]!.elements) as PptxElement & {
			shapeStyle?: { fillGradientAngle?: number };
		};
		expect(shape.shapeStyle?.fillGradientAngle).toBeCloseTo(135, 0);
	});
});
