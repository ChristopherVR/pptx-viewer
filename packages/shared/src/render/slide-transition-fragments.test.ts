import type { PptxTransitionType } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	FRAGMENT_TRANSITION_KEYFRAMES,
	getFragmentedTransitionDescriptor,
} from './slide-transition-fragments';

const DUR = 3000;

/** The seven presets COM-measured as multi-fragment renders. */
const FRAGMENT_TYPES: readonly PptxTransitionType[] = [
	'vortex',
	'honeycomb',
	'glitter',
	'shred',
	'fracture',
	'curtains',
	'airplane',
];

/** Every `@keyframes NAME` declared in the aggregate block. */
function declaredKeyframeNames(css: string): Set<string> {
	const names = new Set<string>();
	for (const match of css.matchAll(/@keyframes\s+([\w-]+)/gu)) {
		names.add(match[1]);
	}
	return names;
}

describe('getFragmentedTransitionDescriptor', () => {
	it('returns undefined for non-fragment types', () => {
		for (const type of [
			'fade',
			'push',
			'conveyor',
			'morph',
			'cube',
			'box',
			'origami',
			'none',
		] as PptxTransitionType[]) {
			expect(
				getFragmentedTransitionDescriptor(type, DUR, undefined, undefined, undefined),
			).toBeUndefined();
		}
	});

	it.each(FRAGMENT_TYPES)('returns a descriptor with >1 fragments for %s', (type) => {
		const descriptor = getFragmentedTransitionDescriptor(type, DUR, 'l', undefined, undefined);
		expect(descriptor).toBeDefined();
		const layer = descriptor?.outgoing ?? descriptor?.incoming;
		expect(layer).toBeDefined();
		expect(layer!.fragments.length).toBeGreaterThan(1);
		expect(descriptor!.outgoingOnTop).toBeTruthy();
	});

	it.each(FRAGMENT_TYPES)(
		'every fragment for %s carries a real clip-path and delay >= 0',
		(type) => {
			const descriptor = getFragmentedTransitionDescriptor(type, DUR, 'l', 8, 'rectangle')!;
			const layer = (descriptor.outgoing ?? descriptor.incoming)!;
			for (const fragment of layer.fragments) {
				expect(fragment.clipPath.startsWith('polygon(')).toBeTruthy();
				expect(fragment.delayMs).toBeGreaterThanOrEqual(0);
				expect(fragment.id.length).toBeGreaterThan(0);
				expect(fragment.transformOrigin.length).toBeGreaterThan(0);
			}
			// Fragment ids are unique within a layer (bindings use them as keys).
			expect(new Set(layer.fragments.map((f) => f.id)).size).toBe(layer.fragments.length);
		},
	);

	it.each(FRAGMENT_TYPES)(
		'%s references a keyframes block declared in FRAGMENT_TRANSITION_KEYFRAMES',
		(type) => {
			const declared = declaredKeyframeNames(FRAGMENT_TRANSITION_KEYFRAMES);
			const descriptor = getFragmentedTransitionDescriptor(type, DUR, 'l', 8, 'rectangle')!;
			const layer = (descriptor.outgoing ?? descriptor.incoming)!;
			expect(declared.has(layer.keyframesName)).toBeTruthy();
		},
	);

	it('is pure: same inputs produce byte-identical output', () => {
		const a = getFragmentedTransitionDescriptor('honeycomb', DUR, 'l', undefined, undefined);
		const b = getFragmentedTransitionDescriptor('honeycomb', DUR, 'l', undefined, undefined);
		expect(JSON.stringify(a)).toBe(JSON.stringify(b));
	});

	describe('vortex', () => {
		it('fragments the outgoing layer only', () => {
			const descriptor = getFragmentedTransitionDescriptor(
				'vortex',
				DUR,
				'l',
				undefined,
				undefined,
			)!;
			expect(descriptor.outgoing).toBeDefined();
			expect(descriptor.incoming).toBeUndefined();
		});

		it('an authored spokes hint changes the particle count within a capped range', () => {
			const base = getFragmentedTransitionDescriptor('vortex', DUR, 'l', undefined, undefined)!;
			const dense = getFragmentedTransitionDescriptor('vortex', DUR, 'l', 8, undefined)!;
			expect(dense.outgoing!.fragments.length).toBeGreaterThan(base.outgoing!.fragments.length);
			// Capped: an absurd spokes value never explodes the fragment count.
			const capped = getFragmentedTransitionDescriptor('vortex', DUR, 'l', 999, undefined)!;
			expect(capped.outgoing!.fragments.length).toBeLessThanOrEqual(16 * 7);
		});
	});

	describe('honeycomb / glitter', () => {
		it('fragment the incoming layer only, leaving outgoing to the single-layer fallback', () => {
			for (const type of ['honeycomb', 'glitter'] as const) {
				const descriptor = getFragmentedTransitionDescriptor(type, DUR, 'l', undefined, undefined)!;
				expect(descriptor.incoming).toBeDefined();
				expect(descriptor.outgoing).toBeUndefined();
			}
		});
	});

	describe('shred', () => {
		it('the rectangle pattern produces fewer, wider wedges than the default strip pattern', () => {
			const strips = getFragmentedTransitionDescriptor('shred', DUR, 'in', undefined, undefined)!;
			const rectangles = getFragmentedTransitionDescriptor(
				'shred',
				DUR,
				'in',
				undefined,
				'rectangle',
			)!;
			expect(rectangles.outgoing!.fragments.length).toBeLessThan(strips.outgoing!.fragments.length);
		});
	});

	describe('airplane', () => {
		it('produces exactly five hand-authored dart panels', () => {
			const descriptor = getFragmentedTransitionDescriptor(
				'airplane',
				DUR,
				'l',
				undefined,
				undefined,
			)!;
			expect(descriptor.outgoing!.fragments).toHaveLength(5);
		});

		it('every panel shares the flight-phase keyframe with the single-layer fallback end values', () => {
			expect(FRAGMENT_TRANSITION_KEYFRAMES).toContain('translate3d(150%, -70%, 0)');
			expect(FRAGMENT_TRANSITION_KEYFRAMES).toContain('rotate3d(1, -1, 1, 70deg)');
		});
	});

	describe('curtains', () => {
		it('produces several vertical slats, not one flat sheet', () => {
			const descriptor = getFragmentedTransitionDescriptor(
				'curtains',
				DUR,
				'l',
				undefined,
				undefined,
			)!;
			expect(descriptor.outgoing!.fragments.length).toBeGreaterThanOrEqual(6);
		});
	});
});
