// @vitest-environment happy-dom
import type { PptxSlideTransition } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SlideTransitionSection } from './SlideTransitionSection';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

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

function renderSection(
	transition: PptxSlideTransition | undefined,
	onTransitionChange: (updates: Partial<PptxSlideTransition>) => void,
): void {
	act(() => {
		root.render(
			<SlideTransitionSection
				activeSlide={{ transition }}
				onTransitionChange={onTransitionChange}
			/>,
		);
	});
}

function getSelect(label: string): HTMLSelectElement {
	return container.querySelector<HTMLSelectElement>(`pptx-ui-select[aria-label="${label}"]`)!;
}

describe('slideTransitionSection speed and morph controls', () => {
	it('shows the Speed selector for every transition, including none', () => {
		renderSection(undefined, () => {});
		expect(getSelect('pptx.transition.speed')).toBeTruthy();

		renderSection({ type: 'fade', durationMs: 500 }, () => {});
		expect(getSelect('pptx.transition.speed')).toBeTruthy();
	});

	it('defaults the Speed selector to fast and emits the chosen speed', () => {
		const onTransitionChange = vi.fn();
		renderSection({ type: 'fade', durationMs: 500 }, onTransitionChange);
		const select = getSelect('pptx.transition.speed');
		expect(select.value).toBe('fast');

		act(() => {
			select.value = 'slow';
			select.dispatchEvent(new Event('change', { bubbles: true }));
		});
		expect(onTransitionChange).toHaveBeenCalledWith({ speed: 'slow' });
	});

	it('hides the morph-option selector for non-morph transitions', () => {
		renderSection({ type: 'fade', durationMs: 500 }, () => {});
		expect(
			container.querySelector('pptx-ui-select[aria-label="pptx.transition.morphOption"]'),
		).toBeNull();
	});

	it('shows the morph-option selector only for the morph transition and emits the choice', () => {
		const onTransitionChange = vi.fn();
		renderSection({ type: 'morph', durationMs: 2000 }, onTransitionChange);
		const select = getSelect('pptx.transition.morphOption');
		expect(select).toBeTruthy();
		expect(select.value).toBe('byObject');

		act(() => {
			select.value = 'byWord';
			select.dispatchEvent(new Event('change', { bubbles: true }));
		});
		expect(onTransitionChange).toHaveBeenCalledWith({ morphOption: 'byWord' });
	});

	it('reflects an already-set speed and morphOption', () => {
		renderSection(
			{ type: 'morph', durationMs: 2000, speed: 'slow', morphOption: 'byChar' },
			() => {},
		);
		expect(getSelect('pptx.transition.speed').value).toBe('slow');
		expect(getSelect('pptx.transition.morphOption').value).toBe('byChar');
	});
});

describe('slideTransitionSection pattern and thruBlk controls', () => {
	it('hides pattern and thruBlk for a transition type that has neither', () => {
		renderSection({ type: 'wipe', durationMs: 500 }, () => {});
		expect(container.textContent).not.toContain('pptx.transition.pattern');
		expect(container.textContent).not.toContain('pptx.transition.thruBlk');
	});

	it('shows the pattern buttons for glitter and emits the chosen pattern', () => {
		const onTransitionChange = vi.fn();
		renderSection({ type: 'glitter', durationMs: 500 }, onTransitionChange);
		const buttons = [...container.querySelectorAll('button')].filter((b) =>
			b.textContent?.includes('pptx.transition.pattern.'),
		);
		expect(buttons.map((b) => b.textContent)).toStrictEqual([
			'pptx.transition.pattern.diamond',
			'pptx.transition.pattern.hexagon',
		]);
		act(() => buttons[1]!.click());
		expect(onTransitionChange).toHaveBeenCalledWith({ pattern: 'hexagon' });
	});

	it('shows strip/rectangle pattern buttons for shred', () => {
		renderSection({ type: 'shred', durationMs: 500 }, () => {});
		const buttons = [...container.querySelectorAll('button')].filter((b) =>
			b.textContent?.includes('pptx.transition.pattern.'),
		);
		expect(buttons.map((b) => b.textContent)).toStrictEqual([
			'pptx.transition.pattern.strip',
			'pptx.transition.pattern.rectangle',
		]);
	});

	it('shows the Through Black checkbox for cut and fade, and toggles it', () => {
		const onTransitionChange = vi.fn();
		renderSection({ type: 'cut', durationMs: 500 }, onTransitionChange);
		const label = [...container.querySelectorAll('label')].find((l) =>
			l.textContent?.includes('pptx.transition.thruBlk'),
		);
		expect(label).toBeTruthy();
		const checkbox = label!.querySelector('pptx-ui-checkbox') as HTMLInputElement;
		expect(checkbox).toBeTruthy();
		act(() => {
			checkbox!.checked = true;
			checkbox!.dispatchEvent(new Event('change', { bubbles: true }));
		});
		expect(onTransitionChange).toHaveBeenCalledWith({ thruBlk: true });
	});

	it('hides the Through Black checkbox for a type that does not support it', () => {
		renderSection({ type: 'blinds', durationMs: 500 }, () => {});
		expect(container.textContent).not.toContain('pptx.transition.thruBlk');
	});
});
