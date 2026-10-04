import { registerPptxWebControls } from 'pptx-viewer-shared';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import StatusBar from './StatusBar.svelte';

registerPptxWebControls();

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function open(props: Record<string, unknown> = {}) {
	const handlers = {
		onzoomin: vi.fn(),
		onzoomout: vi.fn(),
		onzoomfit: vi.fn(),
		onfullscreen: vi.fn(),
		onnotestoggle: vi.fn(),
		onnormal: vi.fn(),
		onslidesorter: vi.fn(),
	};
	const target = document.createElement('div');
	document.body.append(target);
	const instance = mount(StatusBar, {
		target,
		props: { current: 0, total: 7, zoomPercent: 100, isDirty: false, ...handlers, ...props },
	});
	flushSync();
	cleanup = () => {
		unmount(instance);
		target.remove();
	};
	const host = target.querySelector('pptx-ui-status-bar')!;
	const root = host.shadowRoot!;
	const button = (name: string) =>
		root.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;
	return { host, root, button, handlers };
}

describe('statusBar adapter', () => {
	it('renders the counter, zoom percent and save state', () => {
		const { root, button } = open({ current: 2, zoomPercent: 125, isDirty: true });
		expect(root.querySelector('[data-item="counter"]')!.textContent).toBe('Slide 3 of 7');
		expect(button('Zoom to fit').textContent).toBe('125%');
		expect(root.querySelector('[data-item="save"]')!.textContent).toBe('Unsaved changes');
	});

	it('routes every control to its callback', () => {
		const { button, handlers } = open({ showNotes: true });
		for (const name of [
			'Toggle notes',
			'Normal view',
			'Slide sorter',
			'Slide show',
			'Zoom out',
			'Zoom to fit',
			'Zoom in',
		]) {
			button(name).click();
		}
		for (const fn of Object.values(handlers)) {
			expect(fn).toHaveBeenCalledOnce();
		}
	});

	it('reflects pressed state for notes, normal, sorter and slide show', () => {
		const a = open({ showNotes: true, notesExpanded: true, slideSorterActive: true });
		expect(a.button('Toggle notes').getAttribute('aria-pressed')).toBe('true');
		expect(a.button('Slide sorter').getAttribute('aria-pressed')).toBe('true');
		expect(a.button('Normal view').getAttribute('aria-pressed')).toBe('false');
		cleanup?.();
		const b = open({ isFullscreen: true });
		expect(b.button('Slide show').getAttribute('aria-pressed')).toBe('true');
	});

	it('gates notes, slide show, sorter and zoom', () => {
		const { button } = open({ hideZoom: true, hideFullscreen: true, onslidesorter: undefined });
		expect(button('Toggle notes').hidden).toBeTruthy();
		expect(button('Slide show').hidden).toBeTruthy();
		expect(button('Slide sorter').hidden).toBeTruthy();
		expect(button('Zoom in').closest('.group')).toHaveProperty('hidden', true);
	});

	it('projects the collaboration snippet', () => {
		const { host } = open({
			collaborationSlot: createRawSnippet(() => ({
				render: () => '<span id="collab">live</span>',
			})),
		});
		expect(host.querySelector('[slot="collaboration"] #collab')).not.toBeNull();
	});
});
