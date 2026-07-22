// oxlint-disable react-hooks/rules-of-hooks
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import { useAiPanelController } from './useAiPanelController';

/**
 * useAiPanelController tests: the focus scope (live selection / pin / picks),
 * PICK MODE (start -> simulated pick -> focus target + highlight), the live-tool
 * flash (an "active" ring + colour-tween window), and the click-to-ask prefill
 * bumping its nonce so the composer refocuses.
 */
function make(selected: string[] = []) {
	const activeSlideIndex = ref(0);
	const selectedElementIds = ref<string[]>(selected);
	const controller = useAiPanelController({
		activeSlideIndex,
		selectedElementIds,
		selectedElement: () =>
			selectedElementIds.value[0]
				? ({ id: selectedElementIds.value[0], type: 'shape' } as never)
				: null,
	});
	return { controller, activeSlideIndex, selectedElementIds };
}

describe('useAiPanelController', () => {
	it('derives a whole-slide live focus when nothing is selected', () => {
		const { controller } = make();
		expect(controller.liveFocusTargets.value).toStrictEqual([{ kind: 'slide', slideIndex: 0 }]);
	});

	it('derives element focus targets from the live selection', () => {
		const { controller } = make(['e1', 'e2']);
		expect(controller.liveFocusTargets.value).toStrictEqual([
			{ kind: 'element', slideIndex: 0, elementId: 'e1' },
			{ kind: 'element', slideIndex: 0, elementId: 'e2' },
		]);
	});

	it('pick mode: start, add a pick (deduped) becomes a focus target + highlight', () => {
		const { controller } = make();
		expect(controller.pickMode.value).toBeFalsy();
		controller.startPicking();
		expect(controller.pickMode.value).toBeTruthy();

		controller.addPick(0, 'shape-9');
		controller.addPick(0, 'shape-9'); // duplicate ignored
		expect(controller.pickTargets.value).toStrictEqual([
			{ kind: 'element', slideIndex: 0, elementId: 'shape-9' },
		]);
		expect(controller.canvasHighlights.value).toStrictEqual([
			{ slideIndex: 0, elementId: 'shape-9', variant: 'pick' },
		]);

		controller.clearPicks();
		expect(controller.pickTargets.value).toStrictEqual([]);
		expect(controller.pickMode.value).toBeFalsy();
	});

	it('flashToolTarget adds an active ring + enables the colour-tween window', () => {
		vi.useFakeTimers();
		const { controller } = make();
		controller.flashToolTarget({ slideIndex: 1, elementIds: ['shape-3'] });
		expect(controller.canvasAnimating.value).toBeTruthy();
		expect(controller.canvasHighlights.value).toContainEqual({
			slideIndex: 1,
			elementId: 'shape-3',
			variant: 'active',
		});
		// The window settles after the flash timeout.
		vi.advanceTimersByTime(3000);
		expect(controller.canvasHighlights.value).toStrictEqual([]);
		expect(controller.canvasAnimating.value).toBeFalsy();
		vi.useRealTimers();
	});

	it('pin freezes the current live focus; clearing follows the selection again', () => {
		const { controller } = make(['e1']);
		controller.pinFocus();
		expect(controller.pinnedFocus.value).toStrictEqual([
			{ kind: 'element', slideIndex: 0, elementId: 'e1' },
		]);
		controller.clearPinnedFocus();
		expect(controller.pinnedFocus.value).toBeNull();
	});

	it('click-to-ask: askAboutSelection pins focus and bumps the prefill nonce', () => {
		const { controller } = make(['e1']);
		const before = controller.prefill.value.nonce;
		controller.askAboutSelection();
		expect(controller.prefill.value.text).toBe('');
		expect(controller.prefill.value.nonce).toBe(before + 1);
		expect(controller.pinnedFocus.value).not.toBeNull();
	});

	it('click-to-ask: fixSelection prefills a fix directive for the element', () => {
		const { controller } = make(['e1']);
		controller.fixSelection();
		expect(controller.prefill.value.text).toContain('fix');
		expect(controller.prefill.value.text).toContain('e1');
	});
});
