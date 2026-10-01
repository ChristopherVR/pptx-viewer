// @vitest-environment happy-dom
/**
 * The ribbon Animations tab is the shared `pptx-ui-ribbon-animations` view;
 * this adapter owns the slide model callbacks, the Preview highlight and the
 * inspector lifecycle. Preview must also play the selected element's own
 * authored effect in place on the canvas via the shared player.
 */
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const playAnimationRibbonPreview = vi.fn();

vi.mock(import('pptx-viewer-shared'), async (original) => ({
	...(await original()),
	playAnimationRibbonPreview,
}));

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

const { registerPptxWebControls } = await import('pptx-viewer-shared');
const { AnimationsSection } = await import('./AnimationsSection');
type AnimationsSectionProps = import('./AnimationsSection').AnimationsSectionProps;

registerPptxWebControls();

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
	playAnimationRibbonPreview.mockClear();
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
	vi.useRealTimers();
});

function element(id = 'sp1'): PptxElement {
	return { id, type: 'shape' } as unknown as PptxElement;
}

function slideWithAnimation(elementId: string): Pick<PptxSlide, 'animations'> {
	return {
		animations: [{ elementId, entrance: 'fadeIn', durationMs: 500, order: 0 }],
	} as unknown as Pick<PptxSlide, 'animations'>;
}

function props(overrides: Partial<AnimationsSectionProps> = {}): AnimationsSectionProps {
	return {
		canEdit: true,
		selectedElement: element(),
		activeSlide: slideWithAnimation('sp1'),
		isInspectorPaneOpen: false,
		onToggleInspector: vi.fn(),
		...overrides,
	};
}

function mount(overrides: Partial<AnimationsSectionProps> = {}): AnimationsSectionProps {
	const value = props(overrides);
	act(() => {
		root.render(<AnimationsSection {...value} />);
	});
	return value;
}

function control(id: string): HTMLButtonElement {
	return container
		.querySelector(`[data-ribbon-control="${id}"]`)!
		.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
}

function click(button: HTMLButtonElement): void {
	act(() => {
		button.click();
	});
}

describe('animationsSection Preview button', () => {
	it('plays the selected element own animation via the shared player', () => {
		mount();
		click(control('animations.preview.preview'));
		expect(playAnimationRibbonPreview).toHaveBeenCalledExactlyOnceWith(
			document,
			expect.objectContaining({ elementId: 'sp1' }),
		);
	});

	it('does not play a preview when disabled (no selection)', () => {
		mount({ selectedElement: null });
		expect(control('animations.preview.preview').disabled).toBeTruthy();
		click(control('animations.preview.preview'));
		expect(playAnimationRibbonPreview).not.toHaveBeenCalled();
	});

	it('plays nothing on the shared player when the selected element has no animation entry', () => {
		mount({ activeSlide: { animations: [] } });
		click(control('animations.preview.preview'));
		// The shared player itself no-ops without an animation to play.
		expect(playAnimationRibbonPreview).toHaveBeenCalledWith(document, undefined);
	});

	it('highlights the button briefly and clears the timer on unmount', () => {
		vi.useFakeTimers();
		mount();
		const host = container.querySelector('[data-ribbon-control="animations.preview.preview"]')!;
		click(control('animations.preview.preview'));
		expect(host.hasAttribute('active')).toBeTruthy();
		act(() => {
			vi.advanceTimersByTime(1300);
		});
		expect(host.hasAttribute('active')).toBeFalsy();
	});
});

describe('animationsSection native routing', () => {
	it('routes presets, motion paths, exit and path shortcuts to onAddAnimation', () => {
		const onAddAnimation = vi.fn();
		mount({ onAddAnimation });
		click(container.querySelector('[data-animation-preset="flyIn"]')!);
		click(container.querySelector('[data-animation-preset="lineRight"]')!);
		click(control('animations.advancedAnimation.addAnimation'));
		expect(onAddAnimation.mock.calls).toStrictEqual([
			['flyIn', 'entrance'],
			['lineRight', 'motionPath'],
			['fadeOut', 'exit'],
		]);
	});

	it('routes remove and the panel commands, preferring onOpenAnimationPanel', () => {
		const onRemoveAnimation = vi.fn();
		const onOpenAnimationPanel = vi.fn();
		const onToggleInspector = vi.fn();
		mount({ onRemoveAnimation, onOpenAnimationPanel, onToggleInspector });
		click(control('animations.advancedAnimation.remove'));
		click(control('animations.animation.effectOptions'));
		click(control('animations.advancedAnimation.trigger'));
		click(control('animations.advancedAnimation.animationPane'));
		expect(onRemoveAnimation).toHaveBeenCalledOnce();
		expect(onOpenAnimationPanel).toHaveBeenCalledTimes(3);
		expect(onToggleInspector).not.toHaveBeenCalled();
		mount({ onOpenAnimationPanel: undefined, onToggleInspector });
		click(control('animations.advancedAnimation.animationPane'));
		expect(onToggleInspector).toHaveBeenCalledOnce();
	});

	it('gates read-only and unselected hosts while keeping the pane reachable and pressed', () => {
		const onAddAnimation = vi.fn();
		mount({ canEdit: false, onAddAnimation, isInspectorPaneOpen: true });
		const preset = container.querySelector<HTMLButtonElement>('[data-animation-preset="fadeIn"]')!;
		expect(preset.disabled).toBeTruthy();
		click(preset);
		expect(onAddAnimation).not.toHaveBeenCalled();
		const pane = control('animations.advancedAnimation.animationPane');
		expect(pane.disabled).toBeFalsy();
		expect(pane.getAttribute('aria-pressed')).toBe('true');
	});

	it('remounts with independent callbacks', () => {
		const first = vi.fn();
		const second = vi.fn();
		mount({ onAddAnimation: first });
		act(() => root.unmount());
		root = createRoot(container);
		mount({ onAddAnimation: second });
		click(container.querySelector('[data-animation-preset="appear"]')!);
		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledExactlyOnceWith('appear', 'entrance');
	});
});
