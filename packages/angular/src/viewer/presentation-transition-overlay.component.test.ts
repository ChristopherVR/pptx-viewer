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
 * from the same shared helpers the component's effect calls, and the
 * template's `@if (liftedSlide(); as lifted)` predicate is tested through the
 * pure `morphLiftedSlide` it delegates to (issue #146).
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildMorphScopedCss, buildMorphTransitionPlan } from '../internal/shared';
import {
	classicIncomingLayerSlide,
	morphCrossfadeGroupSlides,
	morphLiftedSlide,
} from './presentation-transition-overlay.component';

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

function slide(id: string, elements: PptxElement[]): PptxSlide {
	return { id, elements, backgroundColor: '#ffffff' } as unknown as PptxSlide;
}

/**
 * The shape of the issue #146 morph: an unchanged opaque disc, a backdrop that
 * departs (so the disc's ghost is kept as a shield), and new wording arriving
 * INSIDE the disc.
 */
function discAndWording(): { from: PptxSlide; to: PptxSlide } {
	const disc = {
		type: 'shape',
		name: '!!Content',
		x: 0,
		y: 0,
		width: 300,
		height: 300,
		shapeType: 'ellipse',
		shapeStyle: { fillMode: 'solid', fillColor: '#27282A' },
	};
	return {
		from: slide('out', [
			{
				id: 'out-backdrop',
				type: 'shape',
				name: 'Backdrop',
				x: 0,
				y: 0,
				width: 960,
				height: 540,
			} as unknown as PptxElement,
			{ ...disc, id: 'out-disc' } as unknown as PptxElement,
		]),
		to: slide('in', [
			{ ...disc, id: 'in-disc' } as unknown as PptxElement,
			{
				id: 'in-wording',
				type: 'text',
				name: 'TextBox 9',
				x: 50,
				y: 60,
				width: 200,
				height: 30,
				text: 'Multi-Domain Fusion',
			} as unknown as PptxElement,
		]),
	};
}

describe('morphLiftedSlide', () => {
	it('wraps exactly the shapes the plan lifted, on the incoming slide', () => {
		const { from, to } = discAndWording();
		const plan = buildMorphTransitionPlan(from, to, 800);

		const lifted = morphLiftedSlide(plan, to);

		expect(lifted?.id).toBe('in');
		expect(lifted?.elements.map((element) => element.id)).toStrictEqual(['in-wording']);
		// The disc keeps its ghost: it is the shield the wording has to clear.
		expect(plan?.outgoingElements.map((element) => element.id)).toContain('out-disc');
	});

	it('renders no extra layer when a morph has nothing to lift', () => {
		const from = slide('out', [
			{
				id: 'out-1',
				type: 'shape',
				name: 'Rect',
				x: 0,
				y: 0,
				width: 100,
				height: 50,
			} as unknown as PptxElement,
		]);
		const to = slide('in', [
			{
				id: 'in-1',
				type: 'shape',
				name: 'Rect',
				x: 200,
				y: 0,
				width: 100,
				height: 50,
			} as unknown as PptxElement,
		]);

		expect(morphLiftedSlide(buildMorphTransitionPlan(from, to, 800), to)).toBeUndefined();
	});

	it('renders no extra layer without a plan or an incoming slide', () => {
		const { from, to } = discAndWording();
		expect(morphLiftedSlide(undefined, to)).toBeUndefined();
		expect(morphLiftedSlide(buildMorphTransitionPlan(from, to, 800), undefined)).toBeUndefined();
	});
});

/**
 * The same panel with its wording REPLACED rather than arriving: a matched pair
 * the overlay paints both halves of. `shapeId` is the identity that pairs two
 * text boxes saying different things - proximity alone deliberately refuses
 * them (issue #131).
 */
function discAndReplacedWording(): { from: PptxSlide; to: PptxSlide } {
	const { from, to } = discAndWording();
	const wording = (id: string, text: string): PptxElement =>
		({
			id,
			type: 'text',
			name: 'TextBox 6',
			shapeId: 7,
			x: 50,
			y: 60,
			width: 200,
			height: 30,
			text,
		}) as unknown as PptxElement;
	return {
		from: slide('out', [...from.elements, wording('out-wording', 'Open Integration')]),
		to: slide('in', [
			...to.elements.filter((element) => element.id !== 'in-wording'),
			wording('in-wording', 'Tactical Edge'),
		]),
	};
}

// Regression (issue #161): two fades stacked as ordinary layers composite
// source-over, leaving the ink the halves SHARE at 0.75 of full strength
// halfway through - measured 34.6/255 too dark on the wheel deck, which bites
// chunks out of glyphs where the two line grids cross. PowerPoint's own render
// keeps the blend coefficients summing to 1.0 for every frame, so the pair is
// summed inside its own isolation group instead.
describe('classicIncomingLayerSlide', () => {
	const template = [
		{
			id: 'tpl-1',
			type: 'shape',
			name: 'Template Rect',
			x: 0,
			y: 0,
			width: 960,
			height: 540,
		} as unknown as PptxElement,
	];

	it('wraps the arriving slide (with template elements) for a wipe', () => {
		const incoming = slide('in', [
			{
				id: 'in-1',
				type: 'shape',
				name: 'Rect',
				x: 10,
				y: 10,
				width: 50,
				height: 25,
			} as unknown as PptxElement,
		]);

		const layer = classicIncomingLayerSlide(
			false,
			'pptx-tr-wipe-from-left 600ms',
			incoming,
			template,
		);

		expect(layer?.id).toBe('in');
		expect(layer?.elements.map((element) => element.id)).toStrictEqual(['tpl-1', 'in-1']);
	});

	it('renders no layer for the uncover family, which reveals the live stage', () => {
		const incoming = slide('in', []);
		expect(classicIncomingLayerSlide(false, 'none', incoming, template)).toBeUndefined();
	});

	it('renders no layer for a morph, which paints its own halves', () => {
		const incoming = slide('in', []);
		expect(
			classicIncomingLayerSlide(true, 'pptx-morph-7-incoming 800ms', incoming, template),
		).toBeUndefined();
	});

	it('renders no layer without an incoming slide', () => {
		expect(
			classicIncomingLayerSlide(false, 'pptx-tr-wipe-from-left 600ms', undefined, []),
		).toBeUndefined();
	});

	it('binds the layer and its animation in the template', () => {
		expect(OVERLAY_SOURCE).toContain('data-pptx-transition-layer="incoming"');
		expect(OVERLAY_SOURCE).toContain('[ngStyle]="incomingLayerStyle()"');
		expect(OVERLAY_SOURCE).toContain('incomingLayerSlide()');
	});
});

describe('morphCrossfadeGroupSlides', () => {
	it('wraps each half as its own single-element slide, in an isolated group', () => {
		const { from, to } = discAndReplacedWording();
		const plan = buildMorphTransitionPlan(from, to, 800);

		const groups = morphCrossfadeGroupSlides(plan, from, to);

		expect(groups).toHaveLength(1);
		expect(groups[0].key).toBe('in-wording');
		expect(groups[0].outgoing.elements.map((element) => element.id)).toStrictEqual(['out-wording']);
		expect(groups[0].incoming.elements.map((element) => element.id)).toStrictEqual(['in-wording']);
		expect(groups[0].style['isolation']).toBe('isolate');
		// Above the ghost layer (40) and the lifted layer (41).
		expect(groups[0].style['z-index']).toBe('42');
		// Both halves blend additively, and each carries its own dissolve: on the
		// wrapper, not on the element, whose own layer would snap to whole device
		// pixels and paint the wording off the live stage.
		expect(groups[0].outgoingStyle['mix-blend-mode']).toBe('plus-lighter');
		expect(groups[0].incomingStyle['mix-blend-mode']).toBe('plus-lighter');
		expect(groups[0].outgoingStyle['animation']).toContain('-fade');
		expect(groups[0].incomingStyle['animation']).toContain('-fade');
		// Each half is painted exactly once: the flat layers no longer carry them.
		expect(plan?.outgoingElements.map((element) => element.id)).not.toContain('out-wording');
		expect(morphLiftedSlide(plan, to)).toBeUndefined();
	});

	it('renders no group without a plan or either slide', () => {
		const { from, to } = discAndReplacedWording();
		const plan = buildMorphTransitionPlan(from, to, 800);

		expect(morphCrossfadeGroupSlides(undefined, from, to)).toStrictEqual([]);
		expect(morphCrossfadeGroupSlides(plan, undefined, to)).toStrictEqual([]);
		expect(morphCrossfadeGroupSlides(plan, from, undefined)).toStrictEqual([]);
	});

	it('binds the group and its two halves in the template', () => {
		// No TestBed in this package, so the template is asserted as source: the
		// group is worthless unless both halves are actually bound to the styles
		// carrying `plus-lighter` and the dissolve.
		expect(OVERLAY_SOURCE).toContain('[attr.data-pptx-morph-crossfade]="group.key"');
		expect(OVERLAY_SOURCE).toContain(`'mix-blend-mode': MORPH_CROSSFADE_HALF_BLEND_MODE`);
		expect(OVERLAY_SOURCE).toContain('[ngStyle]="group.outgoingStyle"');
		expect(OVERLAY_SOURCE).toContain('[ngStyle]="group.incomingStyle"');
	});
});

describe('presentationTransitionOverlayComponent transition sound (p:sndAc)', () => {
	// No TestBed in this package (effects need a scheduler flush this project's
	// vitest config does not provide), matching the morph-CSS assertions above:
	// the wiring is asserted as source, and the primitives it delegates to
	// (`resolveTransitionSoundAction`/`applySlideTransitionSound`,
	// `playAnimationSound`/`stopAnimationSound`) are unit-tested in
	// `slide-transition-sound-playback.test.ts` and `animation-sound.test.ts`.

	it('resolves the raw archive soundPath through mediaDataUrls() instead of handing it to Audio directly', () => {
		// The regression this closes: the old code was
		// `new Audio(this.transition().soundPath)`, which 404s because a
		// `ppt/media/media3.wav` archive path is not a fetchable browser URL.
		expect(OVERLAY_SOURCE).not.toContain('new Audio(');
		expect(OVERLAY_SOURCE).toContain('this.mediaDataUrls().get(soundPath)');
	});

	it('plays/stops through the shared per-effect sound singleton, not a private Audio element', () => {
		expect(OVERLAY_SOURCE).toContain('applySlideTransitionSound(');
		expect(OVERLAY_SOURCE).toContain('play: playAnimationSound');
		expect(OVERLAY_SOURCE).toContain('stop: stopAnimationSound');
	});

	it('stops the transition sound on teardown', () => {
		expect(OVERLAY_SOURCE).toContain('stopAnimationSound();');
	});
});
