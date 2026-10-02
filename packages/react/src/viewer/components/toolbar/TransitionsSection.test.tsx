// @vitest-environment happy-dom
import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import { registerPptxWebControls } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Regression tests for the Transitions ribbon tab.
 *
 * The defect these cover is not "a control is missing" (the inventory spec
 * already proves presence): it is that every control was `React.useState` and
 * nothing reached the deck. So these assert EFFECT, not presence. The controls
 * live in the shared `pptx-ui-ribbon-transitions` view, so they are mounted and
 * clicked for real instead of rendered to static markup.
 */
vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

const { TransitionsSection } = await import('./TransitionsSection');

registerPptxWebControls();

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

function slideWith(transition?: PptxSlideTransition): PptxSlide {
	return { id: 's1', elements: [], transition } as unknown as PptxSlide;
}

function renderTab(overrides: Partial<Parameters<typeof TransitionsSection>[0]> = {}) {
	const onTransitionChange = vi.fn<(updates: Partial<PptxSlideTransition>) => void>();
	const onApplyTransitionToAll = vi.fn<() => void>();
	const onToggleInspector = vi.fn<() => void>();
	act(() => {
		root.render(
			React.createElement(TransitionsSection, {
				isInspectorPaneOpen: false,
				onToggleInspector,
				onTransitionChange,
				onApplyTransitionToAll,
				...overrides,
			}),
		);
	});
	return { onTransitionChange, onApplyTransitionToAll, onToggleInspector };
}

const presets = () => [...container.querySelectorAll<HTMLButtonElement>('.preset')];
const field = <T extends HTMLElement>(selector: string) => container.querySelector<T>(selector)!;
const command = (id: string) =>
	container.querySelector(`[data-ribbon-control="${id}"]`)!.shadowRoot!.querySelector('button')!;

describe('transitionsSection reads the active slide', () => {
	it('highlights the preset the slide actually carries', () => {
		renderTab({ activeSlide: slideWith({ type: 'wipe', durationMs: 1500 }) });
		const pressed = presets().filter((button) => button.getAttribute('aria-pressed') === 'true');
		expect(pressed.map((button) => button.textContent)).toStrictEqual(['Wipe']);
	});

	it('shows the slide duration rather than a hard-coded default', () => {
		renderTab({ activeSlide: slideWith({ type: 'fade', durationMs: 1500 }) });
		expect(field<HTMLInputElement>('input[type=number]').value).toBe('1.5');
	});

	it('shows a stored timed advance in the After field', () => {
		renderTab({ activeSlide: slideWith({ type: 'fade', advanceAfterMs: 3000 }) });
		expect(field<HTMLInputElement>('input[type=text]').value).toBe('00:03.00');
		expect(field<HTMLInputElement>('input[type=text]').disabled).toBeFalsy();
	});

	it('offers None and Other Sound for a slide with no sound', () => {
		renderTab();
		const values = [...field<HTMLSelectElement>('pptx-ui-select').options].map(
			(option) => option.value,
		);
		expect(values[0]).toBe('none');
		expect(values.at(-1)).toBe('other');
	});

	it('falls back to the empty draft instead of throwing', () => {
		renderTab({ activeSlide: slideWith() });
		expect(field<HTMLInputElement>('input[type=number]').value).toBe('0.7');
		expect(field<HTMLInputElement>('input[type=text]').value).toBe('00:00.00');
	});
});

describe('transitionsSection commits through the callbacks', () => {
	it('commits a preset on top of the slide draft', () => {
		const { onTransitionChange } = renderTab({
			activeSlide: slideWith({ type: 'fade', durationMs: 1500 }),
		});
		act(() =>
			presets()
				.find((button) => button.textContent === 'Push')!
				.click(),
		);
		expect(onTransitionChange).toHaveBeenCalledExactlyOnceWith(
			expect.objectContaining({ type: 'push', durationMs: 1500 }),
		);
	});

	it('commits duration and the Advance Slide controls', () => {
		const { onTransitionChange } = renderTab({ activeSlide: slideWith({ type: 'fade' }) });
		const duration = field<HTMLInputElement>('input[type=number]');
		act(() => {
			duration.value = '2.5';
			duration.dispatchEvent(new Event('input', { bubbles: true }));
		});
		expect(onTransitionChange).toHaveBeenLastCalledWith(
			expect.objectContaining({ durationMs: 2500 }),
		);
		const after = container.querySelector<HTMLInputElement>(
			'[data-ribbon-control="transitions.timing.advanceAfter"] pptx-ui-checkbox',
		)!;
		act(() => after.click());
		expect(onTransitionChange).toHaveBeenLastCalledWith(
			expect.objectContaining({ advanceAfterMs: 0 }),
		);
	});

	it('routes Apply to All and the Inspector toggle to their native callbacks', () => {
		const { onApplyTransitionToAll, onToggleInspector, onTransitionChange } = renderTab();
		act(() => command('transitions.timing.applyToAll').click());
		expect(onApplyTransitionToAll).toHaveBeenCalledOnce();
		act(() => {
			field('.inspector').shadowRoot!.querySelector('button')!.click();
		});
		expect(onToggleInspector).toHaveBeenCalledOnce();
		expect(onTransitionChange).not.toHaveBeenCalled();
	});

	it('is read-only when canEdit is false but still previews', () => {
		const { onTransitionChange, onApplyTransitionToAll } = renderTab({
			canEdit: false,
			activeSlide: slideWith({ type: 'push' }),
		});
		act(() => presets()[1].click());
		act(() => command('transitions.timing.applyToAll').click());
		expect(onTransitionChange).not.toHaveBeenCalled();
		expect(onApplyTransitionToAll).not.toHaveBeenCalled();
		expect(presets().every((button) => button.disabled)).toBeTruthy();
		expect(command('transitions.preview.preview').disabled).toBeFalsy();
	});

	it('keeps independent instances and survives a remount', () => {
		renderTab({ activeSlide: slideWith({ type: 'wipe' }) });
		act(() => root.unmount());
		root = createRoot(container);
		renderTab({ activeSlide: slideWith({ type: 'cut' }) });
		const pressed = presets().filter((button) => button.getAttribute('aria-pressed') === 'true');
		expect(pressed.map((button) => button.textContent)).toStrictEqual(['Cut']);
		expect(container.querySelectorAll('pptx-ui-ribbon-transitions')).toHaveLength(1);
	});
});
