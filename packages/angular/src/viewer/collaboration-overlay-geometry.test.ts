/**
 * Unit tests for the collaboration-overlay geometry helpers.
 *
 * Regression coverage for the Angular-only "remote cursors and selection boxes
 * are off-centred" bug: the overlays were rendered as siblings of the slide
 * canvas (so `<main>` space, not slide space) and multiplied by the *user*
 * zoom, which ignores the auto-fit factor folded into the stage transform. Both
 * halves of the mapping (draw + broadcast) are covered here.
 *
 * Vue / Svelte references:
 *   packages/vue/src/viewer/components/RemoteSelectionOverlay.test.ts
 *   packages/svelte/src/viewer/collab/components/RemoteSelectionOverlay.test.ts
 */
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import type { RemotePresence } from './collaboration-helpers';
import { clientPointToSlide, resolveRemoteSelectionBoxes } from './collaboration-overlay-geometry';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function element(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 'el-1',
		x: 962,
		y: 306,
		width: 150,
		height: 150,
		...overrides,
	} as PptxElement;
}

function presence(overrides: Partial<RemotePresence> = {}): RemotePresence {
	return {
		clientId: 7,
		userName: 'Ada',
		userColor: '#22c55e',
		activeSlideIndex: 0,
		selectedElementId: 'el-1',
		...overrides,
	} as RemotePresence;
}

const identityLabel = (userName: string): string => userName;

// ---------------------------------------------------------------------------
// resolveRemoteSelectionBoxes
// ---------------------------------------------------------------------------

describe('resolveRemoteSelectionBoxes', () => {
	it('returns the element geometry unscaled (the stage transform applies zoom)', () => {
		const boxes = resolveRemoteSelectionBoxes([presence()], [element()], 0, identityLabel);

		expect(boxes).toHaveLength(1);
		expect(boxes[0]).toMatchObject({ x: 962, y: 306, width: 150, height: 150 });
	});

	it('keys a box by peer client id + element id', () => {
		const boxes = resolveRemoteSelectionBoxes([presence()], [element()], 0, identityLabel);

		expect(boxes[0].key).toBe('7-el-1');
	});

	it('passes the peer name through the supplied label formatter', () => {
		const boxes = resolveRemoteSelectionBoxes([presence()], [element()], 0, (n) => n.slice(0, 2));

		expect(boxes[0].label).toBe('Ad');
	});

	it('skips peers viewing another slide', () => {
		const boxes = resolveRemoteSelectionBoxes(
			[presence({ activeSlideIndex: 3 })],
			[element()],
			0,
			identityLabel,
		);

		expect(boxes).toStrictEqual([]);
	});

	it('skips peers with no selection', () => {
		const boxes = resolveRemoteSelectionBoxes(
			[presence({ selectedElementId: undefined })],
			[element()],
			0,
			identityLabel,
		);

		expect(boxes).toStrictEqual([]);
	});

	it('skips selections that do not resolve to an element on the slide', () => {
		const boxes = resolveRemoteSelectionBoxes(
			[presence({ selectedElementId: 'ghost' })],
			[element()],
			0,
			identityLabel,
		);

		expect(boxes).toStrictEqual([]);
	});

	it('draws one box per peer when several peers select different elements', () => {
		const boxes = resolveRemoteSelectionBoxes(
			[presence(), presence({ clientId: 9, userName: 'Grace', selectedElementId: 'el-2' })],
			[element(), element({ id: 'el-2', x: 10, y: 20 })],
			0,
			identityLabel,
		);

		expect(boxes.map((b) => b.key)).toStrictEqual(['7-el-1', '9-el-2']);
	});
});

// ---------------------------------------------------------------------------
// clientPointToSlide
// ---------------------------------------------------------------------------

describe('clientPointToSlide', () => {
	const size = { width: 1280, height: 720 };

	it('maps a client point through the stage origin and on-screen scale', () => {
		// Stage laid out at (8, 69) and auto-fit to half size.
		const rect = { left: 8, top: 69, width: 640 };

		expect(clientPointToSlide(rect, size, 8 + 320, 69 + 180)).toStrictEqual({ x: 640, y: 360 });
	});

	it('does not subtract the stage origin twice (origin maps to 0,0)', () => {
		const rect = { left: 8, top: 69, width: 640 };

		expect(clientPointToSlide(rect, size, 8, 69)).toStrictEqual({ x: 0, y: 0 });
	});

	it('is identity when the stage renders at 100% at the viewport origin', () => {
		const rect = { left: 0, top: 0, width: 1280 };

		expect(clientPointToSlide(rect, size, 400, 300)).toStrictEqual({ x: 400, y: 300 });
	});

	it('clamps a point past the stage edges to the canvas bounds (+ the shared margin)', () => {
		const rect = { left: 8, top: 69, width: 640 };

		// `clampCursorPosition` allows a 20px overshoot on each side.
		expect(clientPointToSlide(rect, size, -5000, -5000)).toStrictEqual({ x: -20, y: -20 });
		expect(clientPointToSlide(rect, size, 5000, 5000)).toStrictEqual({ x: 1300, y: 740 });
	});

	it('falls back to 1:1 when the stage has not been measured yet', () => {
		expect(clientPointToSlide({ left: 0, top: 0, width: 0 }, size, 120, 90)).toStrictEqual({
			x: 120,
			y: 90,
		});
	});
});
