import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildMorphTransitionPlan, morphOptionToMode } from './morph-plan';

function shape(id: string, name: string, x: number, y: number): PptxElement {
	return {
		id,
		name,
		type: 'shape',
		x,
		y,
		width: 100,
		height: 50,
	} as PptxElement;
}

function slide(id: string, elements: PptxElement[]): PptxSlide {
	return { id, slideNumber: 1, elements } as unknown as PptxSlide;
}

describe('morphOptionToMode', () => {
	it('maps the OOXML option token onto the engine mode', () => {
		expect(morphOptionToMode('byObject')).toBe('object');
		expect(morphOptionToMode('byWord')).toBe('word');
		expect(morphOptionToMode('byChar')).toBe('character');
	});

	it('defaults to object granularity, matching PowerPoint', () => {
		expect(morphOptionToMode(undefined)).toBe('object');
		expect(morphOptionToMode('nonsense')).toBe('object');
	});
});

describe('buildMorphTransitionPlan', () => {
	it('returns undefined when either slide is missing', () => {
		expect(buildMorphTransitionPlan(undefined, slide('b', []), 500)).toBeUndefined();
		expect(buildMorphTransitionPlan(slide('a', []), undefined, 500)).toBeUndefined();
	});

	it('returns undefined when both slides are empty', () => {
		expect(buildMorphTransitionPlan(slide('a', []), slide('b', []), 500)).toBeUndefined();
	});

	it('keys a matched pair on the INCOMING element so it glides into place', () => {
		const from = slide('a', [shape('a-1', 'Title', 0, 0)]);
		const to = slide('b', [shape('b-1', 'Title', 200, 100)]);

		const plan = buildMorphTransitionPlan(from, to, 750);

		expect(plan).toBeDefined();
		expect(plan?.incomingAnimations.has('b-1')).toBeTruthy();
		expect(plan?.durationMs).toBe(750);
		// The keyframes must start at the outgoing offset (-200, -100) and land
		// at the identity transform, i.e. the incoming element's own geometry.
		expect(plan?.keyframesCss).toContain('translate(-200px, -100px)');
		expect(plan?.keyframesCss).toContain('translate(0, 0)');
	});

	it('paints the departing shapes in the overlay, in document order', () => {
		// The overlay carries what the live stage cannot draw for itself. Order is
		// the outgoing slide's own, so the copy keeps its z-stacking.
		const from = slide('a', [shape('a-1', 'Title', 0, 0), shape('a-2', 'Leaving', 10, 10)]);
		const to = slide('b', [shape('b-1', 'Title', 200, 100)]);

		const plan = buildMorphTransitionPlan(from, to, 500);

		expect(plan?.outgoingElements.map((e) => e.id)).toStrictEqual(['a-2']);
		for (const element of plan?.outgoingElements ?? []) {
			expect(plan?.outgoingAnimations.has(element.id)).toBeTruthy();
			// An outgoing element must never be attached to the incoming slide.
			expect(plan?.incomingAnimations.has(element.id)).toBeFalsy();
		}
	});

	it('keeps a ghost that a dissolving shape below it would otherwise show through', () => {
		// A full-slide backdrop whose PICTURE changes has to dissolve, and the
		// overlay is one flat layer above the live stage: every shape drawn over
		// that backdrop needs its own ghost or it is seen through the dissolve
		// instead of over it (issue #131).
		const backdrop = (id: string, image: string): PptxElement =>
			({
				id,
				name: '!!Background',
				type: 'picture',
				x: 0,
				y: 0,
				width: 1280,
				height: 720,
				imagePath: image,
			}) as PptxElement;
		const from = slide('a', [backdrop('a-0', 'one.png'), shape('a-1', 'Title', 100, 100)]);
		const to = slide('b', [backdrop('b-0', 'two.png'), shape('b-1', 'Title', 100, 100)]);

		const plan = buildMorphTransitionPlan(from, to, 500);

		expect(plan?.outgoingElements.map((e) => e.id)).toStrictEqual(['a-0', 'a-1']);
		expect(plan?.outgoingAnimations.get('a-0')).toContain('pptx-morph-ghost-');
	});

	it('glides a restyled outgoing half onto its counterpart', () => {
		const restyled = (id: string, fill: string, x: number): PptxElement =>
			({ ...shape(id, 'Title', x, x / 2), shapeStyle: { fillColor: fill } }) as PptxElement;
		const from = slide('a', [restyled('a-1', '#FF0000', 0)]);
		const to = slide('b', [restyled('b-1', '#00FF00', 200)]);

		const plan = buildMorphTransitionPlan(from, to, 500);

		// The ghost travels the pair's path in the opposite direction to the
		// incoming half: from its own geometry to the incoming one.
		expect(plan?.outgoingAnimations.get('a-1')).toContain('pptx-morph-ghost-');
		expect(plan?.keyframesCss).toContain('translate(200px, 100px)');
	});

	it('routes incoming-only elements to the incoming bucket as a fade-in', () => {
		const from = slide('a', [shape('a-1', 'Title', 0, 0)]);
		const to = slide('b', [shape('b-1', 'Title', 0, 0), shape('b-2', 'Arriving', 20, 20)]);

		const plan = buildMorphTransitionPlan(from, to, 500);

		expect(plan?.incomingAnimations.has('b-2')).toBeTruthy();
		// `a-1` did not move and did not change, so the live stage already draws
		// it: ghosting it would only hide `b-2` dissolving in underneath (issue
		// #144 - a detail slide's callouts never appeared until the overlay came
		// down).
		expect(plan?.outgoingElements).toStrictEqual([]);
	});

	it('emits one keyframes block per animation it hands out', () => {
		const from = slide('a', [shape('a-1', 'Title', 0, 0), shape('a-2', 'Leaving', 10, 10)]);
		const to = slide('b', [shape('b-1', 'Title', 50, 50), shape('b-2', 'Arriving', 20, 20)]);

		const plan = buildMorphTransitionPlan(from, to, 500);
		const handedOut = (plan?.incomingAnimations.size ?? 0) + (plan?.outgoingAnimations.size ?? 0);

		expect(handedOut).toBeGreaterThan(0);
		expect(plan?.keyframesCss.match(/@keyframes/gu) ?? []).toHaveLength(handedOut);
	});
});
