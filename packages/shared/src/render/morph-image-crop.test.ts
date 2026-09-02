import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildImageFitTransform, getImageFitStyle } from './element-style';
import { generateFullMorphTransition, isInertMorphPair } from './morph-animation';
import {
	generateImageCropGhostAnimations,
	generateImageCropMorphAnimations,
	morphImageCropChanged,
	sampleImageCropMorphSteps,
} from './morph-image-crop';
import { buildMorphAnimationRules, buildMorphTransitionPlan } from './morph-plan';

/**
 * A full-slide background picture, the shape issue #148's deck uses: the frame
 * is identical on both slides and only the source crop differs, because that is
 * all PowerPoint's "Scale Height"/"Scale Width" writes.
 */
function background(
	id: string,
	crop: Partial<
		Pick<PptxElement & Record<string, number>, 'cropLeft' | 'cropTop' | 'cropRight' | 'cropBottom'>
	>,
): PptxElement {
	return {
		id,
		name: '!!Background',
		type: 'picture',
		x: 0,
		y: 0,
		width: 1280,
		height: 720,
		imagePath: 'ppt/media/image9.png',
		...crop,
	} as PptxElement;
}

function slide(id: string, elements: PptxElement[]): PptxSlide {
	return { id, slideNumber: 1, elements } as unknown as PptxSlide;
}

// Slide 3 of the reporter's deck: `<a:srcRect l="5739" t="5422" r="5739" b="5422"/>`,
// which PowerPoint's Size panel reads back as ~113% scale.
const SLIDE_3_CROP = {
	cropLeft: 0.05739,
	cropTop: 0.05422,
	cropRight: 0.05739,
	cropBottom: 0.05422,
};
// Slide 12: `<a:srcRect l="356" r="356"/>` - the same picture at ~101%.
const SLIDE_12_CROP = { cropLeft: 0.00356, cropRight: 0.00356 };

describe('morphImageCropChanged', () => {
	it('sees a scale change that leaves the frame untouched', () => {
		expect(
			morphImageCropChanged(background('a', SLIDE_3_CROP), background('b', SLIDE_12_CROP)),
		).toBeTruthy();
	});

	it('is false for two pictures showing the same source region', () => {
		expect(
			morphImageCropChanged(background('a', SLIDE_3_CROP), background('b', SLIDE_3_CROP)),
		).toBeFalsy();
	});

	it('ignores non-pictures, which carry no crop at all', () => {
		const shape = { id: 's', type: 'shape', x: 0, y: 0, width: 10, height: 10 } as PptxElement;
		expect(morphImageCropChanged(shape, background('b', SLIDE_3_CROP))).toBeFalsy();
	});
});

describe('isInertMorphPair', () => {
	it('refuses to call a rescaled picture inert', () => {
		// Same box, same blip, same everything else: before issue #148 this pair
		// was skipped outright and the picture cut between crops in one frame.
		expect(
			isInertMorphPair(background('a', SLIDE_3_CROP), background('b', SLIDE_12_CROP)),
		).toBeFalsy();
	});

	it('still calls an untouched picture inert', () => {
		expect(
			isInertMorphPair(background('a', SLIDE_3_CROP), background('b', SLIDE_3_CROP)),
		).toBeTruthy();
	});
});

describe('generateImageCropMorphAnimations', () => {
	it('animates the incoming picture from the outgoing crop to its own', () => {
		const from = background('a', SLIDE_3_CROP);
		const to = background('b', SLIDE_12_CROP);

		const [animation, ...rest] = generateImageCropMorphAnimations(
			[{ fromElement: from, toElement: to }],
			800,
		);

		expect(rest).toHaveLength(0);
		expect(animation.elementId).toBe('b');
		// It rides the `<img>`, not the element container: the frame never moves.
		expect(animation.target).toBe('image');
		expect(animation.animation).toContain('800ms');
		expect(animation.keyframes).toContain(buildImageFitTransform(from, true));
		expect(animation.keyframes).toContain(buildImageFitTransform(to, true));
	});

	it('lands on exactly the incoming element static transform', () => {
		// Whatever the plan does mid-flight, the last frame has to equal the style
		// the element reverts to when the plan is torn down, or the picture snaps.
		const to = background('b', SLIDE_12_CROP);
		const [animation] = generateImageCropMorphAnimations(
			[{ fromElement: background('a', SLIDE_3_CROP), toElement: to }],
			500,
		);
		const staticTransform = getImageFitStyle(to).transform;

		expect(staticTransform).toBeTruthy();
		expect(animation.keyframes).toContain(`transform: ${buildImageFitTransform(to, true)};`);
		// Padding only prefixes an identity placement pair; the crop half is the
		// element's own rendered value.
		expect(buildImageFitTransform(to, true)).toContain(String(staticTransform));
	});

	it('emits nothing when the crop is unchanged', () => {
		expect(
			generateImageCropMorphAnimations(
				[
					{
						fromElement: background('a', SLIDE_3_CROP),
						toElement: background('b', SLIDE_3_CROP),
					},
				],
				500,
			),
		).toStrictEqual([]);
	});

	it('pads both ends to the same transform function list', () => {
		// An uncropped end has no static transform at all. Emitting a bare `none`
		// would make CSS fall back to a matrix decomposition; an explicit identity
		// pair keeps the interpolation per-function and still equals `none`.
		const [animation] = generateImageCropMorphAnimations(
			[{ fromElement: background('a', {}), toElement: background('b', SLIDE_12_CROP) }],
			500,
		);
		expect(animation.keyframes).toContain(
			'translate(0%, 0%) scale(1, 1) translate(0%, 0%) scale(1, 1)',
		);
	});
});

describe('generateImageCropGhostAnimations', () => {
	it('only animates ghosts the overlay is actually painting', () => {
		const pair = {
			fromElement: background('a', SLIDE_3_CROP),
			toElement: background('b', SLIDE_12_CROP),
		};

		expect(generateImageCropGhostAnimations([pair], 500, new Set())).toStrictEqual([]);
		const [ghost] = generateImageCropGhostAnimations([pair], 500, new Set(['a']));
		expect(ghost.elementId).toBe('a');
		expect(ghost.target).toBe('image');
	});
});

describe('a pair whose frame grows WITH its crop', () => {
	// A rotated sliver of a picture (right 91% cropped away, frame 43x482px)
	// grows into the full picture (no crop, 482px wide), same height, same
	// rotation. The frame widens ~11x while the crop opens ~11x, so the
	// picture's pixel scale is the same on both slides and PowerPoint REVEALS
	// rightwards - no stretch, no zoom, no slide. The outgoing frame's width
	// ratio (0.089935) must match the surviving crop fraction (1 - 0.91007) or
	// the picture's pixel scale genuinely differs between the slides.
	const from = {
		id: 'sliver',
		type: 'picture',
		name: 'Picture 8',
		x: 143,
		y: 36,
		width: 43.31,
		height: 482.1,
		rotation: 26.7,
		imagePath: 'ppt/media/reveal.png',
		cropRight: 0.91007,
	} as unknown as PptxElement;
	const to = {
		id: 'full',
		type: 'picture',
		name: 'Picture 6',
		x: 120,
		y: 135,
		width: 481.53,
		height: 482.1,
		rotation: 26.7,
		imagePath: 'ppt/media/reveal.png',
	} as unknown as PptxElement;

	it('switches the track to stepped, linear-timed keyframes', () => {
		const [animation] = generateImageCropMorphAnimations(
			[{ fromElement: from, toElement: to }],
			300,
		);
		expect(animation.animation).toContain('300ms linear forwards');
		expect(animation.animation).not.toContain('cubic-bezier');
		// Densely sampled: more stops than a from/to pair could carry.
		expect(animation.keyframes.match(/transform:/gu)?.length).toBeGreaterThan(10);
	});

	it('keeps the painted width constant through the flight', () => {
		// At every sample the img scale must cancel the frame's own growth at
		// the SAME eased progress, or the image visibly zooms mid-morph.
		const samples = sampleImageCropMorphSteps(from, to);
		const initialWidth = from.width * extractCropScaleX(samples[0].transform);
		for (const sample of samples) {
			const frameWidth = from.width + (to.width - from.width) * sample.progress;
			const paintedWidth = frameWidth * extractCropScaleX(sample.transform);
			expect(Math.abs(paintedWidth - initialWidth)).toBeLessThan(initialWidth * 0.02);
		}
	});

	it('advances the sample progress along the real CSS easing curve', () => {
		// Regression: a swapped-exponent bezier evaluation made the early
		// samples race ahead (progress 0.097 at time 0.021), so the img track
		// desynced from the container journey in the live transition even
		// though a per-sample invariant still held. cubic-bezier(0.4, 0, 0.2, 1)
		// stays well below the diagonal early on and is monotone.
		const samples = sampleImageCropMorphSteps(from, to);
		expect(samples[1].percent).toBe('2.0833%');
		expect(samples[1].progress).toBeLessThan(0.05);
		let previous = -1;
		for (const sample of samples) {
			expect(sample.progress).toBeGreaterThanOrEqual(previous);
			previous = sample.progress;
		}
		expect(samples[samples.length - 1].progress).toBe(1);
	});

	it('lands on the incoming static transform and starts on the outgoing one', () => {
		const samples = sampleImageCropMorphSteps(from, to);
		expect(samples[0].percent).toBe('0%');
		expect(samples[0].transform).toBe(buildImageFitTransform(from, true));
		expect(samples[samples.length - 1].percent).toBe('100%');
		expect(samples[samples.length - 1].transform).toBe(buildImageFitTransform(to, true));
	});

	it('keeps the single eased pair when only the crop changes', () => {
		// The issue #148 case (identical frames) must stay a from/to pair on
		// the morph easing; the stepped track is only for compounding frames.
		const same = background('b', SLIDE_12_CROP);
		const [animation] = generateImageCropMorphAnimations(
			[{ fromElement: background('a', SLIDE_3_CROP), toElement: same }],
			300,
		);
		expect(animation.animation).toContain('cubic-bezier');
		expect(animation.animation).not.toContain('linear forwards');
		expect(animation.keyframes.match(/transform:/gu)?.length).toBe(2);
	});
});

/** Pull the CROP pair's scale factor out of a padded img fit transform. */
function extractCropScaleX(transform: string): number {
	const matches = [...transform.matchAll(/scale\(([\d.]+)/gu)];
	expect(matches.length).toBeGreaterThanOrEqual(2);
	return Number(matches[matches.length - 1][1]);
}

describe('a rescaled picture end to end', () => {
	const from = slide('slide3', [background('slide3-bg', SLIDE_3_CROP)]);
	const to = slide('slide12', [background('slide12-bg', SLIDE_12_CROP)]);

	it('produces an animation where the engine used to produce none', () => {
		const animations = generateFullMorphTransition(from, to, 800);
		expect(
			animations.some((a) => a.target === 'image' && a.elementId === 'slide12-bg'),
		).toBeTruthy();
	});

	it('keeps the crop out of the element-level animation maps', () => {
		const plan = buildMorphTransitionPlan(from, to, 800);

		expect(plan?.incomingImageAnimations.get('slide12-bg')).toContain('pptx-morph-crop-');
		// The element container's own animation must not be overwritten by it.
		expect(plan?.incomingAnimations.get('slide12-bg')).not.toContain('pptx-morph-crop-');
	});

	it('scopes the crop rule to the picture element `<img>`', () => {
		const plan = buildMorphTransitionPlan(from, to, 800);
		const rules = buildMorphAnimationRules(plan!, 'data-pptx-morph-incoming', 'incoming', 'image');

		expect(rules).toBe(
			`[data-pptx-morph-incoming] [data-element-id="slide12-bg"] img { animation: ${plan?.incomingImageAnimations.get(
				'slide12-bg',
			)}; }`,
		);
	});
});
