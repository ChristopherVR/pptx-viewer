/**
 * FragmentedTransitionLayerComponent, Angular binding.
 *
 * Renders one `FragmentedLayer` (from `getFragmentedTransitionDescriptor` in
 * `pptx-viewer-shared`) as N clipped copies of `pptx-slide-canvas` - the
 * Angular mapping of the seven multi-fragment cinematic transitions (`vortex`,
 * `honeycomb`, `glitter`, `shred`, `fracture`, `curtains`, `airplane`).
 *
 * No Angular TestBed (see `vitest.config.ts`), so the fragment-to-style
 * mapping is unit-tested directly through the exported pure
 * `buildFragmentViews`, fed with REAL descriptors from
 * `getFragmentedTransitionDescriptor` (not hand-rolled fixtures), and the
 * component's template wiring is asserted as source - matching the pattern
 * `presentation-transition-overlay.component.test.ts` already uses for
 * `classicIncomingLayerSlide` / `morphLiftedSlide` / `morphCrossfadeGroupSlides`.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { PptxTransitionType } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getFragmentedTransitionDescriptor } from '../internal/shared';
import { buildFragmentViews } from './fragmented-transition-layer.component';

const COMPONENT_SOURCE = readFileSync(
	path.join(__dirname, 'fragmented-transition-layer.component.ts'),
	'utf8',
);
/**
 * The overlay's template lives in an external `templateUrl`, and its derived
 * (`computed()`) state - including `fragmented` - in a separate factory
 * module, both split out of `presentation-transition-overlay.component.ts`
 * to keep it under the project's per-file LOC budget. See that file's own
 * test for the full rationale.
 */
const TEMPLATE_SOURCE = readFileSync(
	path.join(__dirname, 'presentation-transition-overlay.component.html'),
	'utf8',
);
const STATE_SOURCE = readFileSync(
	path.join(__dirname, 'presentation-transition-overlay-state.ts'),
	'utf8',
);

/**
 * The seven types measured (via COM `CreateVideo`) as many independent
 * fragments/particles/panels rather than one animated layer. Kept as a
 * literal list (not derived from the descriptor module) so this test fails
 * loudly if a preset is ever added or removed there without a matching
 * update here.
 */
const FRAGMENTED_TYPES: PptxTransitionType[] = [
	'vortex',
	'honeycomb',
	'glitter',
	'shred',
	'fracture',
	'curtains',
	'airplane',
];

describe('buildFragmentViews', () => {
	it.each(FRAGMENTED_TYPES)('renders more than one clipped fragment for %s', (type) => {
		const descriptor = getFragmentedTransitionDescriptor(type, 3000, 'left', 8, 'strip');
		expect(descriptor).toBeDefined();
		const layer = descriptor?.outgoing ?? descriptor?.incoming;
		expect(layer).toBeDefined();

		const views = buildFragmentViews(layer!);

		expect(views.length).toBeGreaterThan(1);
		// Every fragment id is unique within the layer (used as the Angular
		// `trackBy` key and the `data-pptx-transition-fragment` value).
		expect(new Set(views.map((view) => view.id)).size).toBe(views.length);
		// At least one fragment carries a REAL clip-path (not empty, not the
		// no-op 'none'), and it lands under the literal 'clip-path' key so the
		// template's `[ngStyle]` sets it as an inline style property (the
		// cross-binding parity spec reads `el.style.clipPath` directly).
		expect(
			views.some((view) => view.style['clip-path'] && view.style['clip-path'] !== 'none'),
		).toBeTruthy();
		// Every fragment carries the shared per-layer animation wiring.
		for (const view of views) {
			expect(view.style['animation-name']).toBe(layer!.keyframesName);
			expect(view.style['animation-duration']).toBe(`${layer!.durationMs}ms`);
			expect(view.style['animation-fill-mode']).toBe('forwards');
		}
	});

	it('renders zero fragments for a non-fragmented transition type', () => {
		expect(
			getFragmentedTransitionDescriptor('fade', 600, undefined, undefined, undefined),
		).toBeUndefined();
	});

	it("merges each fragment's CSS custom properties (vars) into its style", () => {
		const descriptor = getFragmentedTransitionDescriptor(
			'shred',
			3000,
			undefined,
			undefined,
			'strip',
		);
		const layer = descriptor?.outgoing;
		expect(layer).toBeDefined();

		const [first] = buildFragmentViews(layer!);
		const [firstFragment] = layer!.fragments;

		for (const [key, value] of Object.entries(firstFragment.vars)) {
			expect(first.style[key]).toBe(value);
		}
	});
});

describe('fragmentedTransitionLayerComponent wiring', () => {
	it('declares the two data-* hooks the parity spec selects on', () => {
		expect(COMPONENT_SOURCE).toContain('[attr.data-pptx-transition-layer]="layerName()"');
		expect(COMPONENT_SOURCE).toContain(
			'[attr.data-pptx-transition-fragments]="layer().keyframesName"',
		);
		expect(COMPONENT_SOURCE).toContain('[attr.data-pptx-transition-fragment]="fragment.id"');
	});

	it('binds each fragment style via [ngStyle], not a CSS class', () => {
		expect(COMPONENT_SOURCE).toContain('[ngStyle]="fragment.style"');
	});

	it('renders the same pptx-slide-canvas the single-layer path uses', () => {
		expect(COMPONENT_SOURCE).toContain('<pptx-slide-canvas');
		expect(COMPONENT_SOURCE).toContain('[autoFit]="false"');
		expect(COMPONENT_SOURCE).toContain('[interactive]="false"');
	});
});

describe('presentationTransitionOverlayComponent fragmented wiring', () => {
	it('switches the incoming layer to fragments when the descriptor has one, else keeps the classic layer', () => {
		expect(TEMPLATE_SOURCE).toContain('@if (fragmentedIncoming(); as fragIncoming) {');
		expect(TEMPLATE_SOURCE).toContain('} @else if (incomingLayerSlide(); as incoming) {');
		expect(TEMPLATE_SOURCE).toContain('[slide]="incomingFragmentSlide()!"');
	});

	it('switches the outgoing layer to fragments when the descriptor has one, else keeps the classic layer', () => {
		expect(TEMPLATE_SOURCE).toContain('@if (fragmentedOutgoing(); as fragOutgoing) {');
		expect(TEMPLATE_SOURCE).toContain('[layer]="fragOutgoing"');
		expect(TEMPLATE_SOURCE).toContain('[slide]="layerSlide()"');
	});

	it('derives the fragmented descriptor from only the transition + duration, not unrelated state', () => {
		// Regression class: an Angular effect/computed that tracks more than it
		// needs re-fires on every unrelated store write (see the Options-store
		// load-effect bug fixed in 12feaeea7). `fragmented` must depend on
		// exactly the same inputs as the `animations` computed next to it (both
		// live in `presentation-transition-overlay-state.ts` now).
		const fragmentedBody = STATE_SOURCE.slice(
			STATE_SOURCE.indexOf('fragmented = computed<FragmentedTransitionDescriptor'),
			STATE_SOURCE.indexOf('fragmentedOutgoing = computed'),
		);
		expect(fragmentedBody).toContain('inputs.transition()');
		expect(fragmentedBody).toContain('resolvedDurationMs()');
		expect(fragmentedBody).not.toContain('inputs.incomingSlide()');
		expect(fragmentedBody).not.toContain('inputs.outgoingSlide()');
	});
});
