// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { resolveStatusBarSave, statusBarViewMode } from '../render';
import type { StatusBarViewState } from '../render';
import { registerPptxWebControls } from './index';

beforeAll(registerPptxWebControls);
afterEach(() => document.body.replaceChildren());

const base: StatusBarViewState = {
	slideCount: 10,
	activeSlideIndex: 2,
	saveText: 'All saved',
	zoomPercent: 100,
	showNotes: true,
	viewMode: 'normal',
	translate: (key, params) =>
		key === 'pptx.statusBar.slideOf' ? `Slide ${params?.current} of ${params?.total}` : key,
};

function mount(state: Partial<StatusBarViewState> = {}) {
	const host = document.createElement('pptx-ui-status-bar');
	host.state = { ...base, ...state };
	document.body.append(host);
	return host;
}
const button = (host: HTMLElement, name: string) =>
	host.shadowRoot!.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);

describe('pptx-ui-status-bar', () => {
	it('renders the counter, save text, names and pressed state', () => {
		const host = mount({ notesExpanded: true });
		const root = host.shadowRoot!;
		expect(root.querySelector('[data-item="counter"]')!.textContent).toBe('Slide 3 of 10');
		expect(root.querySelector('[data-item="save"]')!.textContent).toBe('All saved');
		expect(button(host, 'pptx.statusBar.toggleNotes')!.getAttribute('aria-pressed')).toBe('true');
		expect(button(host, 'pptx.statusBar.normalView')!.getAttribute('aria-pressed')).toBe('true');
		expect(button(host, 'pptx.statusBar.slideShow')!.getAttribute('aria-pressed')).toBe('false');
		expect(button(host, 'pptx.statusBar.zoomToFit')!.textContent).toBe('100%');
		expect(button(host, 'pptx.statusBar.zoomToFit')!.title).toBe('pptx.statusBar.zoomToFit');
	});

	it('gates notes, sorter, slide show, view modes and zoom', () => {
		const host = mount({
			showNotes: false,
			showSorter: false,
			showSlideShow: false,
			zoomPercent: undefined,
		});
		expect(button(host, 'pptx.statusBar.toggleNotes')!.hidden).toBeTruthy();
		expect(button(host, 'pptx.statusBar.slideSorter')!.hidden).toBeTruthy();
		expect(button(host, 'pptx.statusBar.slideShow')!.hidden).toBeTruthy();
		expect(host.shadowRoot!.querySelectorAll('.group')[1]).toHaveProperty('hidden', true);
		host.state = { ...host.state, showViewModes: false };
		expect(host.shadowRoot!.querySelectorAll('.group')[0]).toHaveProperty('hidden', true);
	});

	it('emits one typed intent per activation and none for programmatic updates', () => {
		const host = mount();
		const request = vi.fn();
		host.addEventListener('status-request', request);
		host.state = { ...host.state, zoomPercent: 150 };
		expect(request).not.toHaveBeenCalled();
		for (const [name, id] of [
			['pptx.statusBar.toggleNotes', 'notes'],
			['pptx.statusBar.normalView', 'normal'],
			['pptx.statusBar.slideSorter', 'sorter'],
			['pptx.statusBar.slideShow', 'slideShow'],
			['pptx.statusBar.zoomOut', 'zoomOut'],
			['pptx.statusBar.zoomToFit', 'zoomFit'],
			['pptx.statusBar.zoomIn', 'zoomIn'],
		] as const) {
			button(host, name)!.click();
			expect(request.mock.calls.at(-1)![0].detail).toStrictEqual({ id });
		}
		expect(request).toHaveBeenCalledTimes(7);
	});

	it('keeps Enter and Space inside the control and survives remounting', () => {
		const host = mount();
		const outer = vi.fn();
		document.addEventListener('keydown', outer);
		button(host, 'pptx.statusBar.zoomIn')!.dispatchEvent(
			new KeyboardEvent('keydown', { key: ' ', bubbles: true, composed: true }),
		);
		expect(outer).not.toHaveBeenCalled();
		document.removeEventListener('keydown', outer);
		const request = vi.fn();
		host.addEventListener('status-request', request);
		for (let i = 0; i < 3; i++) {
			host.remove();
			document.body.append(host);
		}
		button(host, 'pptx.statusBar.zoomIn')!.click();
		expect(request).toHaveBeenCalledOnce();
	});

	it('isolates instances and clamps the counter', () => {
		const first = mount({ activeSlideIndex: 99 });
		const second = mount({ slideCount: 0 });
		expect(first.shadowRoot!.querySelector('[data-item="counter"]')!.textContent).toBe(
			'Slide 10 of 10',
		);
		expect(second.shadowRoot!.querySelector('[data-item="counter"]')!.textContent).toBe(
			'pptx.statusBar.noSlides',
		);
	});

	it('marks saving and error kinds', () => {
		const host = mount({ saveKind: 'error', saveText: 'x' });
		expect(
			host.shadowRoot!.querySelector('[data-item="save"]')!.classList.contains('error'),
		).toBeTruthy();
		host.state = { ...host.state, saveKind: 'saving' };
		expect(
			host.shadowRoot!.querySelector('[data-item="save"]')!.classList.contains('saving'),
		).toBeTruthy();
	});
});

describe('status bar state helpers', () => {
	const t = (key: string, params?: Record<string, string | number>) =>
		params ? `${key}:${JSON.stringify(params)}` : key;

	it('resolves the save indicator in one place', () => {
		expect(resolveStatusBarSave(t, { state: 'saving' }, true).kind).toBe('saving');
		expect(resolveStatusBarSave(t, { state: 'error' }, false).kind).toBe('error');
		expect(resolveStatusBarSave(t, undefined, true).text).toBe('pptx.statusBar.unsavedChanges');
		expect(resolveStatusBarSave(t, { state: 'saved' }, false).text).toBe('pptx.statusBar.allSaved');
		const saved = resolveStatusBarSave(t, { state: 'saved', timestamp: 0 }, false, 90_000);
		expect(saved.text).toContain('pptx.autosave.saved');
		expect(saved.text).toContain('pptx.autosave.oneMinAgo');
	});

	it('maps viewer modes to the pressed view', () => {
		expect(statusBarViewMode('edit')).toBe('normal');
		expect(statusBarViewMode('present')).toBe('slideShow');
		expect(statusBarViewMode('edit', true)).toBe('sorter');
		expect(statusBarViewMode('reading')).toBeUndefined();
	});
});
