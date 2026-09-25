import { describe, expect, it } from 'vitest';

import { buildPreviewAnimation } from './animation-preview';
import type { PreviewGeometry } from './animation-preview-behavior';
import { measurePreviewGeometry } from './animation-preview-behavior';

/** A 100 px square at x = 700 px on a 1280 x 720 px stage. */
const GEOMETRY: PreviewGeometry = {
	box: { x: 700 / 1280, y: 200 / 720, width: 100 / 1280, height: 100 / 720, slideAspect: 16 / 9 },
	slidePx: { width: 1280, height: 720 },
};

describe('buildPreviewAnimation with the element geometry', () => {
	it("previews Fly In with PowerPoint's own tree: from just off the slide edge, no fade", () => {
		const preview = buildPreviewAnimation('flyIn', {
			direction: 'fromLeft',
			durationMs: 1000,
			geometry: GEOMETRY,
		})!;
		expect(preview.keyframeName).toMatch(/^pptx-preview-bhvr-/u);
		// The right edge starts on the slide's left edge: 800 px to travel.
		expect(preview.keyframesCss).toContain('translate(-800px, 0px)');
		expect(preview.keyframesCss).not.toMatch(/0\.5\d*;\s*transform/u);
		expect(preview.cssAnimation).toContain(' 1000ms linear 0ms 1 normal both');
	});

	it('previews a Wipe from its edge with a mask', () => {
		const preview = buildPreviewAnimation('peekIn', {
			direction: 'fromBottom',
			durationMs: 500,
			geometry: GEOMETRY,
		})!;
		expect(preview.keyframesCss).toContain('mask-image');
	});

	it('keeps the preset keyframe without geometry or for a tree with no transform', () => {
		expect(buildPreviewAnimation('flyIn', { direction: 'fromLeft' })!.keyframeName).toBe(
			'pptx-flyInLeft',
		);
		expect(buildPreviewAnimation('fadeIn', { geometry: GEOMETRY })!.keyframeName).toBe(
			'pptx-fadeIn',
		);
	});
});

describe('measurePreviewGeometry', () => {
	it('measures the element against its offset parent, or gives up when not laid out', () => {
		const stage = { offsetWidth: 1280, offsetHeight: 720 };
		const element = {
			offsetParent: stage,
			offsetLeft: 640,
			offsetTop: 360,
			offsetWidth: 128,
			offsetHeight: 72,
		} as unknown as HTMLElement;
		expect(measurePreviewGeometry(element)).toStrictEqual({
			box: { x: 0.5, y: 0.5, width: 0.1, height: 0.1, slideAspect: 1280 / 720 },
			slidePx: { width: 1280, height: 720 },
		});
		const detached = { offsetParent: null } as unknown as HTMLElement;
		expect(measurePreviewGeometry(detached)).toBeUndefined();
	});
});
