// @vitest-environment happy-dom
import type { PptxSlide } from 'pptx-viewer-core';
import type { PptxAiBridge, PptxAiFocusedTarget } from 'pptx-viewer-shared/ai';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { UseAiBridgeInput } from './useAiBridge';
import { useAiBridge } from './useAiBridge';

/**
 * useAiBridge.getFocusedTargets must reflect the LIVE canvas selection at call
 * time (multi-select included) and defer to a pinned focus when one is set.
 */

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

function slides(): PptxSlide[] {
	return [
		{ id: 's0', slideNumber: 1, elements: [] },
		{ id: 's1', slideNumber: 2, elements: [] },
	] as unknown as PptxSlide[];
}

function baseInput(overrides: Partial<UseAiBridgeInput>): UseAiBridgeInput {
	return {
		slides: slides(),
		activeSlideIndex: 1,
		canvasSize: { width: 960, height: 540 },
		theme: undefined,
		selectedElementId: null,
		selectedElementIds: [],
		pinnedFocus: null,
		handlerRef: { current: null },
		setSlides: () => {},
		setActiveSlideIndex: () => {},
		applySelection: () => {},
		bumpHistory: () => {},
		markDirty: () => {},
		applyThemeUpdates: () => {},
		...overrides,
	};
}

function mount(input: UseAiBridgeInput): {
	bridge: () => PptxAiBridge;
	rerender: (next: UseAiBridgeInput) => void;
} {
	const captured: { value: PptxAiBridge | null } = { value: null };
	function Probe({ value }: { value: UseAiBridgeInput }): null {
		captured.value = useAiBridge(value);
		return null;
	}
	act(() => root.render(<Probe value={input} />));
	return {
		bridge: () => {
			if (!captured.value) {
				throw new Error('bridge not captured');
			}
			return captured.value;
		},
		rerender: (next) => act(() => root.render(<Probe value={next} />)),
	};
}

describe('useAiBridge getFocusedTargets', () => {
	it('returns a whole-slide target when nothing is selected', () => {
		const { bridge } = mount(baseInput({}));
		expect(bridge().getFocusedTargets?.()).toStrictEqual([{ kind: 'slide', slideIndex: 1 }]);
	});

	it('reflects the live multi-selection after a rerender (stable identity)', () => {
		const { bridge, rerender } = mount(baseInput({}));
		const first = bridge();
		rerender(baseInput({ selectedElementIds: ['a', 'b'], selectedElementId: 'a' }));
		// Bridge identity is stable across renders (ref pattern).
		expect(bridge()).toBe(first);
		expect(bridge().getFocusedTargets?.()).toStrictEqual([
			{ kind: 'element', slideIndex: 1, elementId: 'a' },
			{ kind: 'element', slideIndex: 1, elementId: 'b' },
		]);
	});

	it('prefers a pinned focus over the live selection', () => {
		const pinned: PptxAiFocusedTarget[] = [{ kind: 'element', slideIndex: 0, elementId: 'pinned' }];
		const { bridge } = mount(
			baseInput({ selectedElementIds: ['live'], selectedElementId: 'live', pinnedFocus: pinned }),
		);
		expect(bridge().getFocusedTargets?.()).toStrictEqual(pinned);
	});
});
