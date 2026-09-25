// @vitest-environment happy-dom
/**
 * The ribbon Animations tab's Preview button: it used to only flash itself
 * for 1200ms and do nothing else. It must now also play the selected
 * element's own authored effect in place on the canvas, via the shared
 * `playAnimationRibbonPreview` (the same function the other four bindings'
 * ribbons call).
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

const { AnimationsSection } = await import('./AnimationsSection');
type AnimationsSectionProps = import('./AnimationsSection').AnimationsSectionProps;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
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

function clickPreview(): void {
	const button = container.querySelector<HTMLButtonElement>(
		'button[title="pptx.animations.previewTooltip"]',
	);
	act(() => {
		button?.click();
	});
}

describe('animationsSection Preview button', () => {
	it('plays the selected element own animation via the shared player', () => {
		act(() => {
			root.render(<AnimationsSection {...props()} />);
		});
		clickPreview();
		expect(playAnimationRibbonPreview).toHaveBeenCalledExactlyOnceWith(
			document,
			expect.objectContaining({ elementId: 'sp1' }),
		);
	});

	it('does not play a preview when disabled (no selection)', () => {
		act(() => {
			root.render(<AnimationsSection {...props({ selectedElement: null })} />);
		});
		clickPreview();
		expect(playAnimationRibbonPreview).not.toHaveBeenCalled();
	});

	it('plays nothing on the shared player when the selected element has no animation entry', () => {
		act(() => {
			root.render(<AnimationsSection {...props({ activeSlide: { animations: [] } })} />);
		});
		clickPreview();
		// The button still calls through (parity with vanilla/svelte): the
		// shared player itself is what no-ops without an animation to play.
		expect(playAnimationRibbonPreview).toHaveBeenCalledWith(document, undefined);
	});
});
