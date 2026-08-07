import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildImageFitTransform, getImageFitStyle } from './element-style';
import { generateFullMorphTransition, isInertMorphPair } from './morph-animation';
import {
	generateImageCropGhostAnimations,
	generateImageCropMorphAnimations,
	morphImageCropChanged,
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
