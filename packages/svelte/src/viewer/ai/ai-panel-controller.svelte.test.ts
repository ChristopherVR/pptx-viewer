import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { AiPanelController } from './ai-panel-controller.svelte';

function controller(
	overrides: {
		activeSlideIndex?: number;
		selectedElementId?: string | null;
		selectedElementIds?: string[];
		selectedElement?: PptxElement;
		openPanel?: () => void;
	} = {},
): AiPanelController {
	return new AiPanelController({
		getActiveSlideIndex: () => overrides.activeSlideIndex ?? 0,
		getSelectedElementId: () => overrides.selectedElementId ?? null,
		getSelectedElementIds: () => overrides.selectedElementIds ?? [],
		getSelectedElement: () => overrides.selectedElement,
		openPanel: overrides.openPanel ?? (() => undefined),
	});
}

describe('aiPanelController', () => {
	it('derives a whole-slide focus when nothing is selected', () => {
		const c = controller({ activeSlideIndex: 3 });
		expect(c.liveFocusTargets).toStrictEqual([{ kind: 'slide', slideIndex: 3 }]);
		expect(c.effectiveTargets).toStrictEqual([{ kind: 'slide', slideIndex: 3 }]);
	});

	it('derives element targets from the multi-selection (order preserved)', () => {
		const c = controller({ activeSlideIndex: 1, selectedElementIds: ['a', 'b'] });
		expect(c.effectiveTargets).toStrictEqual([
			{ kind: 'element', slideIndex: 1, elementId: 'a' },
			{ kind: 'element', slideIndex: 1, elementId: 'b' },
		]);
	});

	it('starts pick mode (opening the panel) and turns clicks into picks', () => {
		const openPanel = vi.fn();
		const c = controller({ openPanel });
		c.startPicking();
		expect(c.pickMode).toBeTruthy();
		expect(openPanel).toHaveBeenCalledOnce();

		c.addPick(2, 'ppt/slides/slide3.xml-shape-4');
		c.addPick(2, 'ppt/slides/slide3.xml-shape-4'); // de-duped
		c.addPick(2, 'ppt/slides/slide3.xml-shape-5');
		expect(c.pickTargets).toStrictEqual([
			{ kind: 'element', slideIndex: 2, elementId: 'ppt/slides/slide3.xml-shape-4' },
			{ kind: 'element', slideIndex: 2, elementId: 'ppt/slides/slide3.xml-shape-5' },
		]);
		// Picks win over the live selection and drive the highlight overlay.
		expect(c.hasPicks).toBeTruthy();
		expect(c.effectiveTargets).toBe(c.pickTargets);
		expect(c.canvasHighlights).toStrictEqual([
			{ slideIndex: 2, elementId: 'ppt/slides/slide3.xml-shape-4', variant: 'pick' },
			{ slideIndex: 2, elementId: 'ppt/slides/slide3.xml-shape-5', variant: 'pick' },
		]);

		c.clearPicks();
		expect(c.pickTargets).toStrictEqual([]);
		expect(c.pickMode).toBeFalsy();
	});

	it('pins the live selection and clears the pin', () => {
		const c = controller({ activeSlideIndex: 0, selectedElementIds: ['x'] });
		c.pinFocus();
		expect(c.isPinned).toBeTruthy();
		expect(c.pinnedFocus).toStrictEqual([{ kind: 'element', slideIndex: 0, elementId: 'x' }]);
		c.clearPinnedFocus();
		expect(c.isPinned).toBeFalsy();
	});

	it('askAboutSelection pins + bumps the prefill nonce with empty text', () => {
		const openPanel = vi.fn();
		const c = controller({ selectedElementIds: ['q'], openPanel });
		c.askAboutSelection();
		expect(c.prefill.text).toBe('');
		expect(c.prefill.nonce).toBe(1);
		expect(c.isPinned).toBeTruthy();
		expect(openPanel).toHaveBeenCalledOnce();
	});

	it('fixSelection prefills a fix directive for the selected element', () => {
		const element = { id: 'ppt/slides/slide1.xml-shape-2', type: 'shape' } as PptxElement;
		const c = controller({ activeSlideIndex: 0, selectedElement: element });
		c.fixSelection();
		expect(c.prefill.text).toContain('fix');
		expect(c.prefill.text).toContain('shape');
		expect(c.prefill.nonce).toBe(1);
	});

	it('flashToolTarget adds an active highlight + animates, then settles', () => {
		vi.useFakeTimers();
		try {
			const c = controller();
			c.flashToolTarget({ slideIndex: 4, elementIds: ['el-1'] });
			expect(c.canvasAnimating).toBeTruthy();
			expect(c.canvasHighlights).toStrictEqual([
				{ slideIndex: 4, elementId: 'el-1', variant: 'active' },
			]);
			vi.advanceTimersByTime(3000);
			expect(c.canvasHighlights).toStrictEqual([]);
			expect(c.canvasAnimating).toBeFalsy();
			c.dispose();
		} finally {
			vi.useRealTimers();
		}
	});

	it('flashToolTarget(null) still animates the tween window (no element ring)', () => {
		vi.useFakeTimers();
		try {
			const c = controller();
			c.flashToolTarget(null);
			expect(c.canvasHighlights).toStrictEqual([]);
			expect(c.canvasAnimating).toBeTruthy();
			c.dispose();
		} finally {
			vi.useRealTimers();
		}
	});
});
