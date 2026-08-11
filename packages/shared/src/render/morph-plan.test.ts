import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildMorphScopedCss, buildMorphTransitionPlan, morphOptionToMode } from './morph-plan';

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
		// `a-1` is inert. It is painted (it must cover the dissolving backdrop)
		// but carries NO animation: one that ran from itself to itself would put
		// it on its own compositing layer, whose raster the browser snaps to
		// whole device pixels, moving a shape that is not supposed to move at
		// all (issue #161).
		expect(plan?.outgoingAnimations.has('a-1')).toBeFalsy();
		expect(plan?.keyframesCss).not.toContain('a1');
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

	it('keeps a pair travelling when its outline is tweened too', () => {
		// A shape-type change emits a baked `clip-path` tween keyed on the SAME
		// incoming id as the pair's own `transform` journey. Both have to survive:
		// while the map overwrote instead of composing, whichever was generated
		// first was dropped, so a shape gliding across the slide stopped
		// travelling and sat at its destination re-cutting its own outline while
		// its ghost flew the path alone.
		const preset = (id: string, shapeType: string, x: number): PptxElement =>
			({ ...shape(id, 'Badge', x, 0), shapeType }) as PptxElement;
		const from = slide('a', [preset('a-1', 'triangle', 0)]);
		const to = slide('b', [preset('b-1', 'hexagon', 200)]);

		const plan = buildMorphTransitionPlan(from, to, 500);
		const incoming = plan?.incomingAnimations.get('b-1') ?? '';

		expect(incoming).toContain('pptx-morph-0-b1 ');
		expect(incoming).toContain('pptx-morph-geo-0-b1 ');
		// The journey itself, not just its name.
		expect(plan?.keyframesCss).toContain('translate(-200px, 0px)');
		expect(plan?.keyframesCss).toContain('clip-path: path(');
	});

	it('emits one keyframes block per animation it hands out', () => {
		const from = slide('a', [shape('a-1', 'Title', 0, 0), shape('a-2', 'Leaving', 10, 10)]);
		const to = slide('b', [shape('b-1', 'Title', 50, 50), shape('b-2', 'Arriving', 20, 20)]);

		const plan = buildMorphTransitionPlan(from, to, 500);
		const handedOut = (plan?.incomingAnimations.size ?? 0) + (plan?.outgoingAnimations.size ?? 0);

		expect(handedOut).toBeGreaterThan(0);
		expect(plan?.keyframesCss.match(/@keyframes/gu) ?? []).toHaveLength(handedOut);
	});

	it('dissolves a repopulated group into its counterpart, on the measured curve', () => {
		// The hub slide's centre panel is a disc plus one line; the topic slide's
		// is the same disc plus a button and three paragraphs. PowerPoint dissolves
		// one whole panel into the other (see `morph-flatten`), so the two groups
		// pair and the OUTGOING half carries the fade. The incoming half must not
		// fade too: the panel is built around an opaque disc, and fading both
		// halves turns it translucent through the middle of the morph.
		const disc = (id: string): PptxElement =>
			({
				id,
				name: '!!Content',
				type: 'shape',
				x: 0,
				y: 0,
				width: 270,
				height: 270,
				shapeStyle: { fillMode: 'solid', fillColor: '#27282A' },
			}) as PptxElement;
		const panel = (id: string, children: PptxElement[]): PptxElement =>
			({
				id,
				name: '!!Circle',
				type: 'group',
				x: 505,
				y: 225,
				width: 270,
				height: 270,
				children,
			}) as unknown as PptxElement;
		const from = slide('a', [
			panel('a-panel', [disc('a-disc'), shape('a-select', 'TextBox 5', 28, 121)]),
		]);
		const to = slide('b', [
			panel('b-panel', [
				disc('b-disc'),
				shape('b-button', 'Rectangle 4', 73, 189),
				shape('b-title', 'TextBox 9', 28, 61),
				shape('b-body', 'TextBox 11', 41, 95),
				shape('b-challenge', 'TextBox 13', 31, 136),
			]),
		]);

		const plan = buildMorphTransitionPlan(from, to, 1000);

		// One object each side, not one departure and four arrivals.
		expect(plan?.outgoingElements.map((e) => e.id)).toStrictEqual(['a-panel']);
		expect(plan?.overlayIncomingElements).toStrictEqual([]);
		expect(plan?.outgoingAnimations.get('a-panel')).toContain('cubic-bezier(0.2, 0, 0.4, 1)');
		// The live half holds its own opacity: no second fade to dip through.
		expect(plan?.incomingAnimations.get('b-panel') ?? '').not.toContain(
			'cubic-bezier(0.2, 0, 0.4, 1)',
		);
	});

	describe('an arrival a ghost would hide (issue #146)', () => {
		/** An unchanged, opaque disc with new wording arriving inside it. */
		function discAndWording(): { from: PptxSlide; to: PptxSlide } {
			const disc = (id: string): PptxElement =>
				({
					id,
					name: '!!Content',
					type: 'shape',
					x: 0,
					y: 0,
					width: 300,
					height: 300,
					shapeStyle: { fillMode: 'solid', fillColor: '#27282A' },
				}) as PptxElement;
			// The disc has to be ghosted for this to bite, which takes something
			// dissolving below it: a departing backdrop, exactly as the deck has.
			const backdrop = (id: string): PptxElement =>
				({
					id,
					name: 'Backdrop',
					type: 'shape',
					x: 0,
					y: 0,
					width: 1280,
					height: 720,
				}) as PptxElement;
			return {
				from: slide('a', [backdrop('a-0'), disc('a-1')]),
				to: slide('b', [disc('b-1'), shape('b-2', 'Multi-Domain Fusion', 50, 60)]),
			};
		}

		it('paints it in the overlay and holds the stage copy invisible', () => {
			const { from, to } = discAndWording();

			const plan = buildMorphTransitionPlan(from, to, 500);

			expect(plan?.outgoingElements.map((e) => e.id)).toContain('a-1');
			expect(plan?.overlayIncomingElements.map((e) => e.id)).toStrictEqual(['b-2']);
			// The overlay copy carries the real dissolve...
			expect(plan?.overlayIncomingAnimations.get('b-2')).toContain('pptx-morph-fadein-');
			// ...and the one still on the live stage holds at nothing, so the two
			// never composite with each other.
			expect(plan?.incomingAnimations.get('b-2')).toContain('pptx-morph-lifted-hidden');
			expect(plan?.keyframesCss).toContain('@keyframes pptx-morph-lifted-hidden');
		});

		it('leaves the plan alone when no ghost covers anything arriving', () => {
			const from = slide('a', [shape('a-1', 'Title', 0, 0)]);
			const to = slide('b', [shape('b-1', 'Title', 0, 0), shape('b-2', 'Arriving', 400, 400)]);

			const plan = buildMorphTransitionPlan(from, to, 500);

			expect(plan?.overlayIncomingElements).toStrictEqual([]);
			expect(plan?.overlayIncomingAnimations.size).toBe(0);
			expect(plan?.keyframesCss).not.toContain('pptx-morph-lifted-hidden');
		});

		it('emits the lifted rules under their own scope', () => {
			const { from, to } = discAndWording();
			const plan = buildMorphTransitionPlan(from, to, 500)!;

			const lifted = buildMorphScopedCss(plan, 'data-pptx-morph-lifted', 'lifted');
			const incoming = buildMorphScopedCss(plan, 'data-pptx-morph-incoming', 'incoming');

			expect(lifted).toContain('[data-pptx-morph-lifted] [data-element-id="b-2"]');
			expect(lifted).toContain('pptx-morph-fadein-');
			expect(incoming).toContain('[data-pptx-morph-incoming] [data-element-id="b-2"]');
			expect(incoming).toContain('pptx-morph-lifted-hidden');
		});
	});
});
