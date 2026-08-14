import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	MORPH_CROSSFADE_GROUP_CSS_TEXT,
	MORPH_CROSSFADE_HALF_BLEND_MODE,
	resolveMorphCrossfadeGroups,
} from './morph-crossfade-group';
import { buildMorphTransitionPlan } from './morph-plan';
import type { MorphPair } from './morph-types';

function shape(id: string, name: string): PptxElement {
	return { id, name, type: 'shape', x: 0, y: 0, width: 100, height: 50 } as PptxElement;
}

function pair(from: PptxElement, to: PptxElement): MorphPair {
	return { fromElement: from, toElement: to };
}

function slide(id: string, elements: PptxElement[]): PptxSlide {
	return { id, slideNumber: 1, elements } as unknown as PptxSlide;
}

/**
 * An unchanged, opaque disc with the wording inside it REPLACED - the wheel
 * deck's centre panel, and the shape of every case this exists for. The disc is
 * only ghosted while something below it dissolves, so the backdrop is not
 * decoration: without it nothing is lifted and nothing pairs up.
 */
function discAndReplacedWording(): { from: PptxSlide; to: PptxSlide } {
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
	const backdrop = (id: string): PptxElement =>
		({ id, name: 'Backdrop', type: 'shape', x: 0, y: 0, width: 1280, height: 720 }) as PptxElement;
	// `shapeId` is what pairs two text boxes saying different things: proximity
	// alone deliberately refuses them (issue #131), so without an identity the
	// wording would dissolve as an unmatched pair and never be grouped.
	const wording = (id: string, text: string): PptxElement =>
		({
			id,
			name: 'TextBox 6',
			shapeId: 7,
			type: 'text',
			x: 40,
			y: 60,
			width: 200,
			height: 40,
			text,
		}) as PptxElement;
	return {
		from: slide('a', [backdrop('a-0'), disc('a-1'), wording('a-2', 'Open Integration')]),
		to: slide('b', [disc('b-1'), wording('b-2', 'Tactical Edge')]),
	};
}

describe('resolveMorphCrossfadeGroups', () => {
	it('pairs a ghost with its LIFTED counterpart', () => {
		const from = shape('a-1', 'TextBox 6');
		const to = shape('b-1', 'TextBox 6');

		const groups = resolveMorphCrossfadeGroups(
			[pair(from, to)],
			new Set(['a-1']),
			new Set(['b-1']),
			[to],
		);

		expect(groups).toStrictEqual([{ outgoing: from, incoming: to }]);
	});

	it('leaves a pair alone when only one half is in the overlay', () => {
		const from = shape('a-1', 'TextBox 6');
		const to = shape('b-1', 'TextBox 6');
		const pairs = [pair(from, to)];

		// The incoming half animates on the live stage: a different DOM tree, so
		// the two cannot share an isolation group.
		expect(resolveMorphCrossfadeGroups(pairs, new Set(['a-1']), new Set(), [to])).toStrictEqual([]);
		// And a lifted half whose ghost was dropped has nothing to blend with.
		expect(resolveMorphCrossfadeGroups(pairs, new Set(), new Set(['b-1']), [to])).toStrictEqual([]);
	});

	it('returns the groups in the incoming slide document order', () => {
		const first = pair(shape('a-1', 'One'), shape('b-1', 'One'));
		const second = pair(shape('a-2', 'Two'), shape('b-2', 'Two'));

		const groups = resolveMorphCrossfadeGroups(
			[second, first],
			new Set(['a-1', 'a-2']),
			new Set(['b-1', 'b-2']),
			[second.toElement, first.toElement],
		);

		expect(groups.map((group) => group.incoming.id)).toStrictEqual(['b-2', 'b-1']);
	});
});

describe('the group styles', () => {
	it('isolate the pair, which is what makes the additive blend correct', () => {
		// Without the isolation the sum would take in the backdrop underneath and
		// paint the non-overlapping half too bright by `alpha * backdrop`.
		expect(MORPH_CROSSFADE_GROUP_CSS_TEXT).toContain('isolation: isolate');
		expect(MORPH_CROSSFADE_HALF_BLEND_MODE).toBe('plus-lighter');
	});
});

describe('buildMorphTransitionPlan crossfade groups (issue #161)', () => {
	it('hands a dissolving pair over as a group instead of two flat layers', () => {
		const { from, to } = discAndReplacedWording();

		const plan = buildMorphTransitionPlan(from, to, 500);

		expect(
			plan?.crossfadeGroups.map((group) => [group.outgoing.id, group.incoming.id]),
		).toStrictEqual([['a-2', 'b-2']]);
		// Each half is painted EXACTLY once: a binding that renders the groups
		// must not also find them in the flat lists.
		expect(plan?.outgoingElements.map((element) => element.id)).not.toContain('a-2');
		expect(plan?.overlayIncomingElements.map((element) => element.id)).not.toContain('b-2');
		// The ghost the arrival dissolves over is still painted flat.
		expect(plan?.outgoingElements.map((element) => element.id)).toContain('a-1');
	});

	it('hands the dissolve to the wrapper and drops the pair no-op journey', () => {
		const { from, to } = discAndReplacedWording();

		const plan = buildMorphTransitionPlan(from, to, 500);
		const [group] = plan!.crossfadeGroups;

		// The pair stands still, so all it needs is the fade, and the fade rides
		// the wrapper: on the element it would buy a compositing layer whose raster
		// snaps to whole device pixels and nothing else. The journey keyframes say
		// the same thing at both ends, so they go entirely.
		const trackNames = (shorthand: string | undefined): string[] =>
			(shorthand ?? '').split(/,\s*(?=pptx-)/u).map((track) => track.split(' ')[0]);
		expect(trackNames(group.outgoingAnimation)).toHaveLength(1);
		expect(trackNames(group.outgoingAnimation)[0]).toMatch(/-fade$/u);
		expect(trackNames(group.incomingAnimation)).toHaveLength(1);
		expect(trackNames(group.incomingAnimation)[0]).toMatch(/-fade$/u);
		// The elements themselves are pinned to `none`, not just left out: a
		// binding whose stage rules are unscoped (Angular) would otherwise let the
		// rule that hides the STAGE copy match the overlay's copy as well, and the
		// arriving half would never paint (issue #160's defect).
		expect(plan?.outgoingAnimations.get('a-2')).toBe('none');
		expect(plan?.overlayIncomingAnimations.get('b-2')).toBe('none');
		// The stage copy is still held invisible, or the pair composites twice.
		expect(plan?.incomingAnimations.get('b-2')).toContain('pptx-morph-lifted-hidden');
	});

	it('leaves a pair that MOVES driving itself', () => {
		const { from, to } = discAndReplacedWording();
		const moved = {
			...to,
			elements: to.elements.map((element) =>
				element.id === 'b-2' ? ({ ...element, y: 160 } as PptxElement) : element,
			),
		} as PptxSlide;

		const plan = buildMorphTransitionPlan(from, moved, 500);
		const group = plan?.crossfadeGroups[0];

		if (group) {
			// It has a journey to run, and a travelling shape cannot be seen to snap.
			expect(group.outgoingAnimation).toBeUndefined();
			expect(group.incomingAnimation).toBeUndefined();
			expect(plan?.outgoingAnimations.has('a-2')).toBeTruthy();
		}
	});

	it('has no groups when nothing is lifted', () => {
		const from = slide('a', [shape('a-1', 'Title')]);
		const to = slide('b', [shape('b-1', 'Title')]);

		const plan = buildMorphTransitionPlan(from, to, 500);

		expect(plan?.crossfadeGroups).toStrictEqual([]);
	});
});
