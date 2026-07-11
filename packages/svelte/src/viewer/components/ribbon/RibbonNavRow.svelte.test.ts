import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import RibbonNavRow from './RibbonNavRow.svelte';

/**
 * RibbonNavRow tests: locks in that zoom in/out/fit, present toggle, and
 * notes toggle stay ALWAYS accessible in this row (not exclusively tucked
 * inside the View tab), matching the vanilla binding's `ribbon-nav-row.ts`
 * and preventing a regression that broke `e2e/vanilla-svelte-basics.spec.ts`
 * (zoomInButton/notesToggleButton locators timed out because these controls
 * were briefly View-tab-only). Named `*.svelte.test.ts` per this package's
 * mount-based component test convention.
 */

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function mountNavRow(props: Record<string, unknown>): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	const instance = mount(RibbonNavRow, { target, props });
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	return target;
}

function baseProps(over: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		current: 0,
		total: 3,
		onprev: vi.fn(),
		onnext: vi.fn(),
		zoomPercent: 100,
		onzoomin: vi.fn(),
		onzoomout: vi.fn(),
		onzoomfit: vi.fn(),
		isFullscreen: false,
		onfullscreen: vi.fn(),
		showNotes: true,
		notesExpanded: false,
		onnotestoggle: vi.fn(),
		...over,
	};
}

describe('ribbonNavRow', () => {
	it('exposes zoom in/out/fit as always-visible, accessibly-named buttons', () => {
		const target = mountNavRow(baseProps());
		const byLabel = (name: string) =>
			Array.from(target.querySelectorAll('button')).find(
				(b) => b.getAttribute('aria-label')?.toLowerCase() === name,
			);
		expect(byLabel('zoom in')).toBeDefined();
		expect(byLabel('zoom out')).toBeDefined();
		expect(byLabel('zoom to fit')).toBeDefined();
	});

	it('exposes an always-visible notes toggle when showNotes is true', () => {
		const target = mountNavRow(baseProps({ showNotes: true }));
		const toggle = Array.from(target.querySelectorAll('button')).find(
			(b) => b.getAttribute('aria-label')?.toLowerCase() === 'toggle notes',
		);
		expect(toggle).toBeDefined();
	});

	it('hides the notes toggle when showNotes is false', () => {
		const target = mountNavRow(baseProps({ showNotes: false }));
		const toggle = Array.from(target.querySelectorAll('button')).find(
			(b) => b.getAttribute('aria-label')?.toLowerCase() === 'toggle notes',
		);
		expect(toggle).toBeUndefined();
	});

	it('dispatches onzoomin/onzoomout/onzoomfit/onnotestoggle from their buttons', () => {
		const onzoomin = vi.fn();
		const onzoomout = vi.fn();
		const onzoomfit = vi.fn();
		const onnotestoggle = vi.fn();
		const target = mountNavRow(baseProps({ onzoomin, onzoomout, onzoomfit, onnotestoggle }));
		const click = (name: string) => {
			const btn = Array.from(target.querySelectorAll('button')).find(
				(b) => b.getAttribute('aria-label')?.toLowerCase() === name,
			);
			btn?.click();
		};
		click('zoom in');
		click('zoom out');
		click('zoom to fit');
		click('toggle notes');
		expect(onzoomin).toHaveBeenCalledOnce();
		expect(onzoomout).toHaveBeenCalledOnce();
		expect(onzoomfit).toHaveBeenCalledOnce();
		expect(onnotestoggle).toHaveBeenCalledOnce();
	});

	it('renders the zoom percentage label', () => {
		const target = mountNavRow(baseProps({ zoomPercent: 137.4 }));
		expect(target.textContent).toContain('137%');
	});
});
