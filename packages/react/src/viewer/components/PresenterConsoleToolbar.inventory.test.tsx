// @vitest-environment happy-dom
/**
 * The presenter console's strip had no accessible names at all: every control
 * carried a hard-coded English `title` and nothing else, so a screen reader
 * announced the black-screen switch as the letter "B" and no locale could
 * translate the console. Nothing pinned its inventory either, which is how the
 * other four bindings each ended up with a different strip (Vue rendered one
 * only for an empty deck, Angular re-ordered the zoom pair, Vanilla had none).
 *
 * This asserts the rendered order and the accessible names against the shared
 * spec, the way `PresentationToolbar.inventory.test.tsx` does for the show bar.
 */
import type { PresentationSnapshot } from 'pptx-viewer-shared';
import { PRESENTER_CONSOLE_CONTROLS, PRESENTER_CONSOLE_ORDER } from 'pptx-viewer-shared';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, string>) => {
			const raw = translationsEn[key] ?? key;
			return options
				? raw.replaceAll(/\{\{(?<name>\w+)\}\}/gu, (_, name: string) => options[name] ?? '')
				: raw;
		},
	}),
}));

const { PresenterConsoleToolbar } = await import('./PresenterConsoleToolbar');

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => {
		root.unmount();
	});
	container.remove();
});

const BASE_SNAPSHOT: PresentationSnapshot = {
	slideIndex: 0,
	buildStep: 0,
	sequence: 0,
	blackout: 'none',
	paused: false,
	elapsedMs: 0,
};

function renderConsole(overrides: Record<string, unknown> = {}): void {
	act(() => {
		root.render(
			<PresenterConsoleToolbar
				snapshot={BASE_SNAPSHOT}
				audienceOpen={false}
				onToggleAudience={() => undefined}
				onSwapDisplays={() => undefined}
				onToggleTimer={() => undefined}
				onResetTimer={() => undefined}
				onShowSlides={() => undefined}
				onStepZoom={() => undefined}
				onResetZoom={() => undefined}
				onBlackout={() => undefined}
				onPointerTool={() => undefined}
				onToggleSubtitles={() => undefined}
				onExit={() => undefined}
				{...overrides}
			/>,
		);
	});
}

function controlIds(): (string | null)[] {
	return [...container.querySelectorAll('[data-pptx-presenter-control]')].map((node) =>
		node.getAttribute('data-pptx-presenter-control'),
	);
}

function slot(id: string): HTMLElement | null {
	return container.querySelector<HTMLElement>(`[data-pptx-presenter-control="${id}"]`);
}

function nameOf(id: string): string | null {
	return slot(id)?.getAttribute('aria-label') ?? null;
}

describe('the presenter console strip', () => {
	it('renders every shared inventory slot in order', () => {
		renderConsole();
		expect(controlIds()).toStrictEqual([...PRESENTER_CONSOLE_ORDER]);
	});

	it('names every interactive slot from the dictionary', () => {
		renderConsole();
		expect(nameOf('timer-toggle')).toBe('Pause or Resume Timer');
		expect(nameOf('timer-reset')).toBe('Reset Timer');
		expect(nameOf('all-slides')).toBe('See All Slides');
		expect(nameOf('zoom-in')).toBe('Zoom In');
		expect(nameOf('zoom-out')).toBe('Zoom Out');
		expect(nameOf('zoom-reset')).toBe('Reset Zoom');
		expect(nameOf('laser')).toBe('Laser Pointer');
		expect(nameOf('pen')).toBe('Pen');
		expect(nameOf('highlighter')).toBe('Highlighter');
		expect(nameOf('eraser')).toBe('Eraser');
		expect(nameOf('blackout-black')).toBe('Black Screen');
		expect(nameOf('blackout-white')).toBe('White Screen');
		expect(nameOf('captions')).toBe('Toggle subtitles');
		expect(nameOf('audience')).toBe('Open Audience Window');
		expect(nameOf('swap-displays')).toBe('Swap Displays');
		expect(nameOf('end')).toBe('End Presentation');
	});

	it('mirrors each accessible name into the tooltip, with nothing hard-coded', () => {
		renderConsole();
		for (const control of PRESENTER_CONSOLE_CONTROLS) {
			if (control.labelKey === undefined) {
				continue;
			}
			const node = slot(control.id);
			expect(node?.getAttribute('title')).toBe(nameOf(control.id));
			expect(nameOf(control.id)).not.toBe(control.labelKey);
		}
	});

	it('labels the blackout switches by name, not by their B / W glyph', () => {
		renderConsole();
		expect(slot('blackout-black')?.textContent).toBe('B');
		expect(slot('blackout-white')?.textContent).toBe('W');
		expect(nameOf('blackout-black')).not.toBe('B');
		expect(nameOf('blackout-white')).not.toBe('W');
	});

	it('exposes toggle state through aria-pressed, and only on toggles', () => {
		renderConsole({
			snapshot: {
				...BASE_SNAPSHOT,
				blackout: 'black',
				pointer: { x: 0, y: 0, tool: 'pen', color: '#ef4444' },
			},
		});
		expect(slot('blackout-black')?.getAttribute('aria-pressed')).toBe('true');
		expect(slot('blackout-white')?.getAttribute('aria-pressed')).toBe('false');
		expect(slot('pen')?.getAttribute('aria-pressed')).toBe('true');
		expect(slot('laser')?.getAttribute('aria-pressed')).toBe('false');
		// Plain buttons must not claim a pressed state.
		expect(slot('timer-reset')?.getAttribute('aria-pressed')).toBeNull();
		expect(slot('end')?.getAttribute('aria-pressed')).toBeNull();
	});

	it('renames the audience slot when its window is open', () => {
		renderConsole({ audienceOpen: true });
		expect(nameOf('audience')).toBe('Close Audience Window');
		expect(slot('audience')?.getAttribute('aria-pressed')).toBe('true');
		const swap = slot('swap-displays') as HTMLButtonElement | null;
		expect(swap).not.toBeNull();
		expect(swap?.disabled).toBeFalsy();
	});

	it('disables swapping displays while there is only one display', () => {
		renderConsole();
		expect((slot('swap-displays') as HTMLButtonElement | null)?.disabled).toBeTruthy();
	});

	it('keeps every control behaviour wired', () => {
		const calls: string[] = [];
		renderConsole({
			onToggleTimer: () => calls.push('timer'),
			onResetTimer: () => calls.push('reset-timer'),
			onShowSlides: () => calls.push('all-slides'),
			onStepZoom: (direction: 1 | -1) => calls.push(`zoom:${direction}`),
			onResetZoom: () => calls.push('zoom-reset'),
			onPointerTool: (tool: string) => calls.push(`tool:${tool}`),
			onBlackout: (value: string) => calls.push(`blackout:${value}`),
			onToggleSubtitles: () => calls.push('captions'),
			onToggleAudience: () => calls.push('audience'),
			onExit: () => calls.push('end'),
		});
		for (const id of [
			'timer-toggle',
			'timer-reset',
			'all-slides',
			'zoom-in',
			'zoom-out',
			'zoom-reset',
			'pen',
			'blackout-black',
			'blackout-white',
			'captions',
			'audience',
			'end',
		]) {
			act(() => {
				(slot(id) as HTMLButtonElement | null)?.click();
			});
		}
		expect(calls).toStrictEqual([
			'timer',
			'reset-timer',
			'all-slides',
			'zoom:1',
			'zoom:-1',
			'zoom-reset',
			'tool:pen',
			'blackout:black',
			'blackout:white',
			'captions',
			'audience',
			'end',
		]);
	});
});
