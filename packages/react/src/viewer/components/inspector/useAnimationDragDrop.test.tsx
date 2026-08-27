// @vitest-environment happy-dom
/**
 * Regression coverage for full-sequence drag-to-reorder: dragging an
 * editor-authored animation past a deck-native effect (a read-only
 * `PptxAnimationTimelineAnchor` row) must be able to place it ahead of or
 * behind that native effect, not just among the effects this editor added.
 */
/* oxlint-disable eslint/one-var -- each `it`/fixture block below declares its
   own independent locals; merging unrelated declarations across these test
   cases would hurt readability, not help it. */
import type { PptxElement, PptxElementAnimation, PptxSlide } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useAnimationHandlers } from './useAnimationHandlers';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

type Handlers = ReturnType<typeof useAnimationHandlers>;

function renderHarness(
	activeSlide: PptxSlide,
	selectedElement: PptxElement,
): { current: Handlers } {
	const ref: { current: Handlers | null } = { current: null };
	let updates: Partial<PptxSlide> = {};

	function Harness(): null {
		ref.current = useAnimationHandlers({
			selectedElement,
			activeSlide: { ...activeSlide, ...updates } as PptxSlide,
			canEdit: true,
			onUpdateSlide: (next) => {
				updates = { ...updates, ...next };
				act(() => {
					root.render(<Harness />);
				});
			},
		});
		return null;
	}
	act(() => {
		root.render(<Harness />);
	});
	return ref as { current: Handlers };
}

const ELEMENT_A = { id: 'a', type: 'shape', x: 0, y: 0, width: 1, height: 1 } as PptxElement;

describe('full-sequence drag-to-reorder (docked animation timeline)', () => {
	it('moves an editor-authored row ahead of a deck-native anchor row', () => {
		const animations: PptxElementAnimation[] = [
			{ elementId: 'a', entrance: 'fadeIn', order: 1, trigger: 'onClick' },
		];
		const slide = {
			elements: [ELEMENT_A],
			animations,
			animationTimelineAnchors: [{ order: 0, targetIds: ['native-1'], presetClasses: ['entr'] }],
		} as unknown as PptxSlide;

		const handlers = renderHarness(slide, ELEMENT_A);
		expect(handlers.current.timelineRows.map((r) => r.key)).toStrictEqual(['native:0', 'editor:a']);

		// Drag the editor row (index 1) ahead of the native row (index 0).
		// Each handler is its own `act()` so React flushes `dragIndex` state
		// between them, matching real drag events firing on separate ticks.
		act(() => {
			handlers.current.handleDragStart(1, {
				dataTransfer: { setData() {}, effectAllowed: '' },
			} as never);
		});
		act(() => {
			handlers.current.handleDrop(0, { preventDefault() {} } as never);
		});

		expect(handlers.current.timelineRows.map((r) => r.key)).toStrictEqual(['editor:a', 'native:0']);
	});

	it('does not allow dragging a native row as the source', () => {
		const animations: PptxElementAnimation[] = [
			{ elementId: 'a', entrance: 'fadeIn', order: 1, trigger: 'onClick' },
		];
		const slide = {
			elements: [ELEMENT_A],
			animations,
			animationTimelineAnchors: [{ order: 0, targetIds: ['native-1'], presetClasses: ['entr'] }],
		} as unknown as PptxSlide;

		const handlers = renderHarness(slide, ELEMENT_A);
		act(() => {
			handlers.current.handleDragStart(0, {
				dataTransfer: { setData() {}, effectAllowed: '' },
			} as never);
		});
		expect(handlers.current.dragIndex).toBeNull();
	});

	it('moves an editor row behind a native anchor via the move-down button', () => {
		const animations: PptxElementAnimation[] = [
			{ elementId: 'a', entrance: 'fadeIn', order: -1, trigger: 'onClick' },
		];
		const slide = {
			elements: [ELEMENT_A],
			animations,
			animationTimelineAnchors: [{ order: 0, targetIds: ['native-1'], presetClasses: ['entr'] }],
		} as unknown as PptxSlide;

		const handlers = renderHarness(slide, ELEMENT_A);
		expect(handlers.current.timelineRows.map((r) => r.key)).toStrictEqual(['editor:a', 'native:0']);

		act(() => {
			handlers.current.handleMoveDown(0);
		});

		expect(handlers.current.timelineRows.map((r) => r.key)).toStrictEqual(['native:0', 'editor:a']);
	});
});
