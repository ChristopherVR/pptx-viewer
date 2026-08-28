/**
 * Guards the show toolbar against the drift that produced the bar it replaced:
 * a bottom-right strip whose accessible names were the raw tool ids ("pen",
 * "laser") and which shipped no navigation, counter, timer or exit at all.
 *
 * The expectations are read from `pptx-viewer-shared`'s canonical inventory
 * rather than hardcoded here, so a control renamed in the spec fails this test
 * instead of silently diverging from the other four bindings.
 */
import {
	PEN_COLORS,
	HIGHLIGHTER_COLORS,
	PRESENT_TOOLBAR_CONTROLS,
	PRESENT_TOOLBAR_ORDER,
} from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { translate } from '../../i18n/translator';
import { PresentationAnnotations } from '../presentation/presentation-annotations.svelte';
import PresentationToolbar from './PresentationToolbar.svelte';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function mountToolbar(
	current = 1,
	total = 3,
	presenterMode = false,
	blackout: 'none' | 'black' | 'white' = 'none',
) {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const annotations = new PresentationAnnotations();
	const callbacks = {
		onmove: vi.fn(),
		onpresenterview: vi.fn(),
		onexit: vi.fn(),
		onblackoutchange: vi.fn(),
	};
	const instance = mount(PresentationToolbar, {
		target,
		props: { annotations, current, total, presenterMode, blackout, ...callbacks },
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return { target, annotations, ...callbacks };
}

function control(target: HTMLElement, id: string): HTMLElement {
	const el = target.querySelector<HTMLElement>(`[data-pptx-present-control="${id}"]`);
	if (!el) {
		throw new Error(`missing control ${id}`);
	}
	return el;
}

/** The accessible name each labelled control should carry, keyed by control id. */
function expectedLabels(): Record<string, string> {
	return Object.fromEntries(
		PRESENT_TOOLBAR_CONTROLS.flatMap((spec) =>
			spec.labelKey === undefined ? [] : [[spec.id, translate('en', spec.labelKey)]],
		),
	);
}

describe('presentationToolbar', () => {
	it('renders every shared control, in the shared order', () => {
		const { target } = mountToolbar();
		const ids = [...target.querySelectorAll('[data-pptx-present-control]')].map((el) =>
			el.getAttribute('data-pptx-present-control'),
		);
		expect(ids).toStrictEqual([...PRESENT_TOOLBAR_ORDER]);
		expect(target.querySelector('[data-pptx-present-toolbar]')?.getAttribute('role')).toBe(
			'toolbar',
		);
		expect(target.querySelector('[data-pptx-present-toolbar]')?.getAttribute('aria-label')).toBe(
			translate('en', 'pptx.toolbar.presentationToolbarAria'),
		);
	});

	it('labels each control from the dictionary, not from its tool id', () => {
		const { target } = mountToolbar();
		const expected = expectedLabels();
		const ariaLabels = Object.fromEntries(
			Object.keys(expected).map((id) => [id, control(target, id).getAttribute('aria-label')]),
		);
		const titles = Object.fromEntries(
			Object.keys(expected).map((id) => [id, control(target, id).getAttribute('title')]),
		);
		expect(ariaLabels).toStrictEqual(expected);
		expect(titles).toStrictEqual(expected);

		// The regression: these were the old strip's accessible names.
		const raw = [...target.querySelectorAll('[aria-label]')].map((el) =>
			el.getAttribute('aria-label'),
		);
		expect(raw).not.toContain('pen');
		expect(raw).not.toContain('laser');
	});

	it('shows the counter and disables navigation at the deck edges', () => {
		const { target } = mountToolbar(0, 3);
		expect(control(target, 'counter').textContent?.trim()).toBe('1 / 3');
		expect((control(target, 'previous') as HTMLButtonElement).disabled).toBeTruthy();
		expect((control(target, 'next') as HTMLButtonElement).disabled).toBeFalsy();
		cleanup?.();
		cleanup = undefined;

		const last = mountToolbar(2, 3);
		expect((control(last.target, 'previous') as HTMLButtonElement).disabled).toBeFalsy();
		expect((control(last.target, 'next') as HTMLButtonElement).disabled).toBeTruthy();
		expect(control(last.target, 'counter').textContent?.trim()).toBe('3 / 3');
	});

	it('routes navigation, presenter view and exit without bubbling to the stage', () => {
		const { target, onmove, onpresenterview, onexit } = mountToolbar(1, 3);
		const bubbled = vi.fn();
		document.body.addEventListener('click', bubbled);

		control(target, 'previous').click();
		control(target, 'next').click();
		control(target, 'presenter-view').click();
		control(target, 'end').click();

		expect(onmove.mock.calls).toStrictEqual([[-1], [1]]);
		expect(onpresenterview).toHaveBeenCalledOnce();
		expect(onexit).toHaveBeenCalledOnce();
		expect(bubbled).not.toHaveBeenCalled();
		document.body.removeEventListener('click', bubbled);
	});

	it('disables Clear until the show has ink, then clears it', () => {
		const { target, annotations } = mountToolbar();
		expect((control(target, 'clear') as HTMLButtonElement).disabled).toBeTruthy();

		annotations.tool = 'pen';
		annotations.pointerDown(0, { x: 1, y: 1 });
		annotations.pointerMove(0, { x: 5, y: 5 });
		annotations.pointerUp(0);
		flushSync();
		expect((control(target, 'clear') as HTMLButtonElement).disabled).toBeFalsy();

		control(target, 'clear').click();
		flushSync();
		expect(annotations.count).toBe(0);
	});

	it('toggles an annotation tool on and back off', () => {
		const { target, annotations } = mountToolbar();
		control(target, 'laser').click();
		flushSync();
		expect(annotations.tool).toBe('laser');
		expect(control(target, 'laser').getAttribute('aria-pressed')).toBe('true');

		control(target, 'laser').click();
		flushSync();
		expect(annotations.tool).toBe('none');
	});

	it('offers a real palette per tool and arms that tool on pick', () => {
		const { target, annotations } = mountToolbar();
		expect(annotations.penColor).toBe(PEN_COLORS[0]);
		expect(annotations.highlighterColor).toBe(HIGHLIGHTER_COLORS[0]);

		control(target, 'pen-color').click();
		flushSync();
		let swatches = [
			...target.querySelectorAll<HTMLButtonElement>('.pptx-svelte-present-palette button'),
		];
		expect(swatches.map((el) => el.getAttribute('aria-label'))).toStrictEqual(
			PEN_COLORS.map((color) =>
				translate('en', 'pptx.presentationToolbar.penColorValue', { color }),
			),
		);
		swatches[2]?.click();
		flushSync();
		expect(annotations.penColor).toBe(PEN_COLORS[2]);
		expect(annotations.tool).toBe('pen');
		expect(target.querySelector('.pptx-svelte-present-palette')).toBeNull();

		control(target, 'highlighter-color').click();
		flushSync();
		swatches = [
			...target.querySelectorAll<HTMLButtonElement>('.pptx-svelte-present-palette button'),
		];
		expect(swatches.map((el) => el.getAttribute('aria-label'))).toStrictEqual(
			HIGHLIGHTER_COLORS.map((color) =>
				translate('en', 'pptx.presentationToolbar.highlighterColorValue', { color }),
			),
		);
		swatches[3]?.click();
		flushSync();
		expect(annotations.highlighterColor).toBe(HIGHLIGHTER_COLORS[3]);
		expect(annotations.tool).toBe('highlighter');
	});

	it('arms the black screen and the pen together from the blackboard toggle', () => {
		const { target, annotations, onblackoutchange } = mountToolbar();
		expect(control(target, 'blackboard').getAttribute('aria-pressed')).toBe('false');

		control(target, 'blackboard').click();
		flushSync();
		expect(annotations.tool).toBe('pen');
		expect(onblackoutchange).toHaveBeenCalledExactlyOnceWith('black');
	});

	it('disarms both when the blackboard pair is already active', () => {
		const { target, annotations, onblackoutchange } = mountToolbar(1, 3, false, 'black');
		annotations.tool = 'pen';
		flushSync();
		expect(control(target, 'blackboard').getAttribute('aria-pressed')).toBe('true');

		control(target, 'blackboard').click();
		flushSync();
		expect(annotations.tool).toBe('none');
		expect(onblackoutchange).toHaveBeenCalledExactlyOnceWith('none');
	});

	it('completes the pair instead of tearing it down when only half is armed', () => {
		// Blackout up but eraser armed: the click must finish the blackboard,
		// not disarm the blank screen.
		const { target, annotations, onblackoutchange } = mountToolbar(1, 3, false, 'black');
		annotations.tool = 'eraser';
		flushSync();
		expect(control(target, 'blackboard').getAttribute('aria-pressed')).toBe('false');

		control(target, 'blackboard').click();
		flushSync();
		expect(annotations.tool).toBe('pen');
		expect(onblackoutchange).toHaveBeenCalledExactlyOnceWith('black');
	});

	it('starts hidden and reveals itself on mouse movement', () => {
		vi.useFakeTimers();
		try {
			const { target } = mountToolbar();
			const wrapper = target.querySelector('.pptx-svelte-present-wrapper');
			expect(wrapper?.classList.contains('hidden')).toBeTruthy();

			document.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 10 }));
			flushSync();
			expect(wrapper?.classList.contains('hidden')).toBeFalsy();

			vi.advanceTimersByTime(3000);
			flushSync();
			expect(wrapper?.classList.contains('hidden')).toBeTruthy();
		} finally {
			vi.useRealTimers();
		}
	});

	it('never auto-reveals on mousemove when popupToolbarEnabled is false', () => {
		vi.useFakeTimers();
		try {
			const target = document.createElement('div');
			document.body.appendChild(target);
			const annotations = new PresentationAnnotations();
			const instance = mount(PresentationToolbar, {
				target,
				props: {
					annotations,
					current: 1,
					total: 3,
					presenterMode: false,
					onmove: vi.fn(),
					onpresenterview: vi.fn(),
					onexit: vi.fn(),
					popupToolbarEnabled: false,
				},
			});
			flushSync();
			const wrapper = target.querySelector('.pptx-svelte-present-wrapper');
			expect(wrapper?.classList.contains('hidden')).toBeTruthy();

			document.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 10 }));
			flushSync();
			expect(wrapper?.classList.contains('hidden')).toBeTruthy();

			unmount(instance);
			target.remove();
		} finally {
			vi.useRealTimers();
		}
	});
});
