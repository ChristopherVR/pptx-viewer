import { describe, expect, it } from 'vitest';

import { calculateViewportFit } from '../viewport-fit';
import {
	EDITOR_VIEWPORT_FIT,
	editorThumbnailHeight,
	editorThumbnailStep,
	editorThumbnailWidth,
} from './metrics';

describe('editor layout geometry', () => {
	it.each([180, 240, 300])(
		'keeps room for the slide number when the rail is %ipx wide',
		(railWidth) => {
			const width = editorThumbnailWidth(railWidth);
			expect(railWidth - width).toBe(48);
			expect(editorThumbnailHeight(1280, 720, width) / width).toBe(720 / 1280);
		},
	);

	it.each([
		[1280, 720],
		[720, 1280],
		[960, 720],
	])('virtualizes %ix%i slides at the painted row height', (width, height) => {
		const preview = editorThumbnailHeight(width, height);
		// Two 1px borders, two 2px row paddings, and a 4px row gap.
		expect(editorThumbnailStep(width, height)).toBe(preview + 10);
	});

	it('fits the editor without enlarging authored content', () => {
		const input = {
			viewportWidth: 2560,
			viewportHeight: 1440,
			canvasWidth: 1280,
			canvasHeight: 720,
		};
		expect(calculateViewportFit(input, EDITOR_VIEWPORT_FIT).scale).toBe(1);
		expect(calculateViewportFit({ ...input, viewportWidth: 648 }, EDITOR_VIEWPORT_FIT).scale).toBe(
			0.5,
		);
		expect(
			calculateViewportFit({ ...input, fitPadding: 0, maxFitScale: null }, EDITOR_VIEWPORT_FIT)
				.scale,
		).toBe(2);
	});

	it('reserves the page-number line height for panoramic slides', () => {
		expect(editorThumbnailHeight(10000, 1)).toBeCloseTo(0.0132);
		expect(editorThumbnailStep(10000, 1)).toBe(23);
	});
});
