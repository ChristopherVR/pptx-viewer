import {
	AUTO_HIDE_DELAY_MS,
	HIGHLIGHTER_COLORS,
	PEN_COLORS,
	PRESENT_TOOLBAR_CONTROLS,
	PRESENT_TOOLBAR_ORDER,
} from 'pptx-viewer-shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import type { PresentationToolbarHandlers } from './presentation-toolbar';
import { createPresentationToolbar } from './presentation-toolbar';

const t = createTranslator('en');

function build(overrides: Partial<PresentationToolbarHandlers> = {}) {
	const handlers: PresentationToolbarHandlers = {
		previous: vi.fn(),
		next: vi.fn(),
		setTool: vi.fn(),
		setColor: vi.fn(),
		toggleBlackboard: vi.fn(),
		clearAnnotations: vi.fn(),
		togglePresenterView: vi.fn(),
		end: vi.fn(),
		...overrides,
	};
	const container = document.createElement('div');
	document.body.appendChild(container);
	const toolbar = createPresentationToolbar(document, t, container, handlers);
	container.appendChild(toolbar.el);
	return { toolbar, handlers, container };
}

/** Every `data-pptx-present-control` in DOM order. */
function controlIds(root: HTMLElement): string[] {
	return [...root.querySelectorAll<HTMLElement>('[data-pptx-present-control]')].map(
		(el) => el.dataset.pptxPresentControl ?? '',
	);
}

function control(root: HTMLElement, id: string): HTMLElement | null {
	return root.querySelector<HTMLElement>(`[data-pptx-present-control="${id}"]`);
}

afterEach(() => {
	document.body.replaceChildren();
	vi.useRealTimers();
});

describe('createPresentationToolbar', () => {
	it('renders the shared control inventory in order', () => {
		const { toolbar } = build();
		expect(controlIds(toolbar.el)).toStrictEqual([...PRESENT_TOOLBAR_ORDER]);
	});

	it('exposes the toolbar container with its shared aria contract', () => {
		const { toolbar } = build();
		const bar = toolbar.el.querySelector('[data-pptx-present-toolbar]');
		expect(bar?.getAttribute('role')).toBe('toolbar');
		expect(bar?.getAttribute('aria-label')).toBe('Presentation toolbar');
	});

	it('labels every control from its shared i18n key', () => {
		const { toolbar } = build();
		for (const spec of PRESENT_TOOLBAR_CONTROLS) {
			if (spec.labelKey === undefined) {
				continue;
			}
			const el = control(toolbar.el, spec.id);
			expect({ id: spec.id, label: el?.getAttribute('aria-label') }).toStrictEqual({
				id: spec.id,
				label: t(spec.labelKey),
			});
			expect({ id: spec.id, title: el?.getAttribute('title') }).toStrictEqual({
				id: spec.id,
				title: t(spec.labelKey),
			});
		}
	});

	it('disables navigation at the deck boundaries and shows the counter', () => {
		const { toolbar } = build();
		toolbar.update({ current: 0, total: 3 });
		expect((control(toolbar.el, 'previous') as HTMLButtonElement).disabled).toBeTruthy();
		expect((control(toolbar.el, 'next') as HTMLButtonElement).disabled).toBeFalsy();
		expect(control(toolbar.el, 'counter')?.textContent).toBe('1 / 3');

		toolbar.update({ current: 2 });
		expect((control(toolbar.el, 'previous') as HTMLButtonElement).disabled).toBeFalsy();
		expect((control(toolbar.el, 'next') as HTMLButtonElement).disabled).toBeTruthy();
		expect(control(toolbar.el, 'counter')?.textContent).toBe('3 / 3');
	});

	it('disables Clear until the show has ink, and marks the active tool', () => {
		const { toolbar } = build();
		expect((control(toolbar.el, 'clear') as HTMLButtonElement).disabled).toBeTruthy();

		toolbar.update({ tool: 'pen', hasAnnotations: true, presenterViewActive: true });
		expect((control(toolbar.el, 'clear') as HTMLButtonElement).disabled).toBeFalsy();
		expect(control(toolbar.el, 'pen')?.getAttribute('aria-pressed')).toBe('true');
		expect(control(toolbar.el, 'laser')?.getAttribute('aria-pressed')).toBe('false');
		expect(control(toolbar.el, 'presenter-view')?.getAttribute('aria-pressed')).toBe('true');
	});

	it('renders the blackboard toggle between eraser and clear and routes its click', () => {
		const { toolbar, handlers } = build();
		const ids = controlIds(toolbar.el);
		expect(ids.indexOf('blackboard')).toBe(ids.indexOf('eraser') + 1);
		expect(ids.indexOf('clear')).toBe(ids.indexOf('blackboard') + 1);

		control(toolbar.el, 'blackboard')?.click();
		expect(handlers.toggleBlackboard).toHaveBeenCalledOnce();
	});

	it('marks the blackboard toggle active only for the black screen + pen pair', () => {
		const { toolbar } = build();
		expect(control(toolbar.el, 'blackboard')?.getAttribute('aria-pressed')).toBe('false');

		toolbar.update({ blackout: 'black', tool: 'pen' });
		expect(control(toolbar.el, 'blackboard')?.getAttribute('aria-pressed')).toBe('true');

		// A white screen or a different tool is not blackboard mode.
		toolbar.update({ blackout: 'white', tool: 'pen' });
		expect(control(toolbar.el, 'blackboard')?.getAttribute('aria-pressed')).toBe('false');
		toolbar.update({ blackout: 'black', tool: 'eraser' });
		expect(control(toolbar.el, 'blackboard')?.getAttribute('aria-pressed')).toBe('false');
	});

	it('routes every action handler', () => {
		const { toolbar, handlers } = build();
		toolbar.update({ current: 1, total: 3, hasAnnotations: true });
		control(toolbar.el, 'previous')?.click();
		control(toolbar.el, 'next')?.click();
		control(toolbar.el, 'laser')?.click();
		control(toolbar.el, 'eraser')?.click();
		control(toolbar.el, 'clear')?.click();
		control(toolbar.el, 'presenter-view')?.click();
		control(toolbar.el, 'end')?.click();

		expect(handlers.previous).toHaveBeenCalledOnce();
		expect(handlers.next).toHaveBeenCalledOnce();
		expect(handlers.setTool).toHaveBeenNthCalledWith(1, 'laser');
		expect(handlers.setTool).toHaveBeenNthCalledWith(2, 'eraser');
		expect(handlers.clearAnnotations).toHaveBeenCalledOnce();
		expect(handlers.togglePresenterView).toHaveBeenCalledOnce();
		expect(handlers.end).toHaveBeenCalledOnce();
	});

	it('never lets a bar click reach the stage advance handler', () => {
		const { toolbar, container } = build();
		const bubbled = vi.fn();
		container.addEventListener('click', bubbled);
		control(toolbar.el, 'next')?.click();
		expect(bubbled).not.toHaveBeenCalled();
	});

	describe('colour palettes', () => {
		it('opens one palette at a time from its caret', () => {
			const { toolbar } = build();
			const penPalette = control(toolbar.el, 'pen')?.parentElement?.querySelector(
				'.pptxv-present-palette',
			);
			const highlighterPalette = control(toolbar.el, 'highlighter')?.parentElement?.querySelector(
				'.pptxv-present-palette',
			);
			expect((penPalette as HTMLElement).hidden).toBeTruthy();

			control(toolbar.el, 'pen-color')?.click();
			expect((penPalette as HTMLElement).hidden).toBeFalsy();

			control(toolbar.el, 'highlighter-color')?.click();
			expect((penPalette as HTMLElement).hidden).toBeTruthy();
			expect((highlighterPalette as HTMLElement).hidden).toBeFalsy();

			control(toolbar.el, 'highlighter-color')?.click();
			expect((highlighterPalette as HTMLElement).hidden).toBeTruthy();
		});

		it('offers the shared swatches with per-colour accessible names', () => {
			const { toolbar } = build();
			const swatches = [
				...(control(toolbar.el, 'pen')?.parentElement?.querySelectorAll<HTMLElement>(
					'[data-pptx-present-swatch]',
				) ?? []),
			];
			expect(swatches.map((el) => el.dataset.pptxPresentSwatch)).toStrictEqual([...PEN_COLORS]);
			expect(swatches[0]?.getAttribute('aria-label')).toBe(`Pen colour ${PEN_COLORS[0] ?? ''}`);

			const highlighterSwatches = [
				...(control(toolbar.el, 'highlighter')?.parentElement?.querySelectorAll<HTMLElement>(
					'[data-pptx-present-swatch]',
				) ?? []),
			];
			expect(highlighterSwatches.map((el) => el.dataset.pptxPresentSwatch)).toStrictEqual([
				...HIGHLIGHTER_COLORS,
			]);
			expect(highlighterSwatches[0]?.getAttribute('aria-label')).toBe(
				`Highlighter colour ${HIGHLIGHTER_COLORS[0] ?? ''}`,
			);
		});

		it('picking a colour selects the tool, closes the palette and tints the underline', () => {
			const { toolbar, handlers } = build();
			control(toolbar.el, 'pen-color')?.click();
			const group = control(toolbar.el, 'pen')?.parentElement as HTMLElement;
			const pick = PEN_COLORS[2] ?? '';
			group.querySelector<HTMLElement>(`[data-pptx-present-swatch="${pick}"]`)?.click();

			expect(handlers.setColor).toHaveBeenCalledWith(pick);
			expect(handlers.setTool).toHaveBeenCalledWith('pen');
			expect(group.querySelector<HTMLElement>('.pptxv-present-palette')?.hidden).toBeTruthy();
			expect(
				control(toolbar.el, 'pen')?.querySelector<HTMLElement>('.pptxv-present-swatch-bar')?.style
					.backgroundColor,
			).not.toBe('');
		});
	});

	describe('auto-hide', () => {
		beforeEach(() => {
			vi.useFakeTimers();
		});

		it('reveals on show start and hides after the shared delay', () => {
			const { toolbar } = build();
			expect(toolbar.el.style.opacity).toBe('0');
			expect(toolbar.el.style.pointerEvents).toBe('none');

			toolbar.setPresenting(true);
			expect(toolbar.el.style.opacity).toBe('1');
			expect(toolbar.el.style.pointerEvents).toBe('auto');

			vi.advanceTimersByTime(AUTO_HIDE_DELAY_MS);
			expect(toolbar.el.style.opacity).toBe('0');
			expect(toolbar.el.style.pointerEvents).toBe('none');
		});

		it('a mouse move restarts the countdown', () => {
			const { toolbar } = build();
			toolbar.setPresenting(true);
			vi.advanceTimersByTime(AUTO_HIDE_DELAY_MS);
			expect(toolbar.el.style.opacity).toBe('0');

			document.dispatchEvent(new MouseEvent('mousemove', { clientY: 10 }));
			expect(toolbar.el.style.opacity).toBe('1');
			vi.advanceTimersByTime(AUTO_HIDE_DELAY_MS - 1);
			expect(toolbar.el.style.opacity).toBe('1');
			vi.advanceTimersByTime(1);
			expect(toolbar.el.style.opacity).toBe('0');
		});

		it('hovering the bar keeps it visible', () => {
			const { toolbar } = build();
			toolbar.setPresenting(true);
			toolbar.el.dispatchEvent(new MouseEvent('mouseenter'));
			vi.advanceTimersByTime(AUTO_HIDE_DELAY_MS * 2);
			expect(toolbar.el.style.opacity).toBe('1');

			toolbar.el.dispatchEvent(new MouseEvent('mouseleave'));
			vi.advanceTimersByTime(AUTO_HIDE_DELAY_MS);
			expect(toolbar.el.style.opacity).toBe('0');
		});

		it('ticks the elapsed readout once a second and resets when the show ends', () => {
			const { toolbar } = build();
			expect(control(toolbar.el, 'timer')?.textContent).toBe('00:00');

			toolbar.setPresenting(true);
			vi.advanceTimersByTime(65_000);
			expect(control(toolbar.el, 'timer')?.textContent).toBe('01:05');

			toolbar.setPresenting(false);
			expect(control(toolbar.el, 'timer')?.textContent).toBe('00:00');
			// The show is over: no listener may keep the bar alive.
			document.dispatchEvent(new MouseEvent('mousemove', { clientY: 10 }));
			expect(toolbar.el.style.opacity).toBe('0');
		});
	});
});
