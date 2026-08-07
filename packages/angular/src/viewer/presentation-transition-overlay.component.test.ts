/**
 * Morph transition overlay, Angular binding.
 *
 * The component itself is a thin shell over shared `buildMorphTransitionPlan` /
 * `buildMorphScopedCss`, so what is worth pinning here is the pair of facts
 * that make a PICTURE CROP morph actually play in Angular (issue #148):
 *
 *  - the stylesheet it injects at document level carries a rule for the `<img>`
 *    inside the picture element, not only for the element container, and
 *  - Angular's image renderer really does put that `<img>` inside the node
 *    carrying `data-element-id`, so the descendant selector resolves.
 *
 * PowerPoint's "Scale Height"/"Scale Width" is an `a:srcRect` source crop
 * inside an unchanged frame, so a rescaled picture agrees with its counterpart
 * on position, size, blip and every style: before this the pair was treated as
 * inert and the picture cut between crops in a single frame.
 *
 * No Angular TestBed (see `vitest.config.ts`), so the injected CSS is built
 * from the same shared helpers the component's effect calls.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildMorphScopedCss, buildMorphTransitionPlan } from '../internal/shared';

const OVERLAY_SOURCE = readFileSync(
	path.join(__dirname, 'presentation-transition-overlay.component.ts'),
	'utf8',
);
const IMAGE_RENDERER_SOURCE = readFileSync(
	path.join(__dirname, 'image-renderer.component.ts'),
	'utf8',
);

/** A full-slide picture whose frame never moves and whose source crop does. */
function rescaledPicture(slideId: string, crop: Record<string, number>): PptxSlide {
	return {
		id: slideId,
		elements: [
			{
				id: `${slideId}-picture`,
				type: 'picture',
				name: '!!Background',
				x: 0,
				y: 0,
				width: 960,
				height: 540,
				imagePath: 'ppt/media/image9.png',
				...crop,
			},
		],
	} as unknown as PptxSlide;
}

describe('presentationTransitionOverlayComponent morph css', () => {
	const plan = buildMorphTransitionPlan(
		rescaledPicture('out', { cropLeft: 0.05739, cropRight: 0.05739 }),
		rescaledPicture('in', { cropLeft: 0.00356, cropRight: 0.00356 }),
		800,
	);

	it('emits a crop animation for the incoming picture', () => {
		expect(plan?.incomingImageAnimations.get('in-picture')).toContain('pptx-morph-crop-');
	});

	it('injects it as a rule on the element `<img>`, at document level', () => {
		// The live stage is a SIBLING component, so these rules are unscoped (the
		// component says as much); element ids embed their slide path.
		const css = buildMorphScopedCss(plan!, '', 'incoming');
		expect(css).toContain('[data-element-id="in-picture"] img { animation: pptx-morph-crop-');
		expect(css).toContain('@keyframes pptx-morph-crop-');
		expect(OVERLAY_SOURCE).toContain("buildMorphScopedCss(plan, '', 'incoming')");
	});

	it('renders the `<img>` inside the `data-element-id` container', () => {
		// The rule above is a DESCENDANT selector; if the img ever moved out of the
		// marked node (or the marker moved onto the img) the animation would stop
		// matching, silently, with every unit test above still green.
		const container = IMAGE_RENDERER_SOURCE.indexOf('[attr.data-element-id]');
		const img = IMAGE_RENDERER_SOURCE.indexOf('<img ');
		expect(container).toBeGreaterThan(-1);
		expect(img).toBeGreaterThan(container);
		expect(IMAGE_RENDERER_SOURCE).toContain('[ngStyle]="view().imageStyle"');
	});
});
