// @vitest-environment happy-dom
import { registerPptxWebControls } from 'pptx-viewer-shared';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { StatusBarProps } from './StatusBar';
import { StatusBar } from './StatusBar';

vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string, opts?: Record<string, unknown>) => {
			const fallback = translationsEn[key];
			if (fallback === undefined) {
				return key;
			}
			return opts
				? fallback.replace(/\{\{(\w+)\}\}/gu, (_m, name: string) => String(opts[name] ?? ''))
				: fallback;
		},
	}),
}));

beforeAll(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	registerPptxWebControls();
});

const mounted: { root: Root; target: HTMLElement }[] = [];
afterEach(() => {
	for (const { root, target } of mounted.splice(0)) {
		act(() => root.unmount());
		target.remove();
	}
});

function props(overrides: Partial<StatusBarProps> = {}): StatusBarProps {
	return {
		slideCount: 10,
		activeSlideIndex: 2,
		isDirty: false,
		scale: 1,
		onZoomIn: vi.fn<() => void>(),
		onZoomOut: vi.fn<() => void>(),
		onZoomToFit: vi.fn<() => void>(),
		isNotesExpanded: false,
		onToggleNotes: vi.fn<() => void>(),
		mode: 'edit',
		onSetMode: vi.fn<() => void>(),
		onToggleSlideSorter: vi.fn<() => void>(),
		...overrides,
	};
}

function mount(overrides: Partial<StatusBarProps> = {}) {
	const target = document.createElement('div');
	document.body.append(target);
	const root = createRoot(target);
	mounted.push({ root, target });
	const render = (next: Partial<StatusBarProps> = overrides) =>
		act(() => root.render(<StatusBar {...props(next)} />));
	render();
	const host = target.querySelector('pptx-ui-status-bar')!;
	const q = (selector: string) => host.shadowRoot!.querySelector<HTMLElement>(selector)!;
	const button = (name: string) =>
		host.shadowRoot!.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;
	return { host, q, button, render };
}

describe('react StatusBar adapter', () => {
	it('renders the counter, language and save state from the shared element', () => {
		const { q } = mount();
		expect(q('.counter').textContent).toBe('Slide 3 of 10');
		expect(q('.save').textContent).toBe(translationsEn['pptx.statusBar.allSaved']);
		expect(q('.bar').textContent).toContain(translationsEn['pptx.statusBar.language']);
	});

	it('clamps the counter and reports an empty deck', () => {
		expect(mount({ slideCount: 5, activeSlideIndex: 9 }).q('.counter').textContent).toBe(
			'Slide 5 of 5',
		);
		expect(mount({ slideCount: 0 }).q('.counter').textContent).toBe('No slides');
	});

	it('derives the save indicator from dirty and autosave state', () => {
		expect(mount({ isDirty: true }).q('.save').textContent).toBe('Unsaved changes');
		expect(
			mount({ autosaveStatus: { state: 'saving' } })
				.q('.save')
				.classList.contains('saving'),
		).toBeTruthy();
		expect(
			mount({ autosaveStatus: { state: 'error', message: 'x' } })
				.q('.save')
				.classList.contains('error'),
		).toBeTruthy();
		expect(
			mount({ autosaveStatus: { state: 'saved', timestamp: Date.now() } }).q('.save').textContent,
		).toContain('just now');
	});

	it('routes each control to its native handler exactly once', () => {
		const p = props();
		const target = document.createElement('div');
		document.body.append(target);
		const root = createRoot(target);
		mounted.push({ root, target });
		act(() => root.render(<StatusBar {...p} />));
		const host = target.querySelector('pptx-ui-status-bar')!;
		const click = (name: string) =>
			host.shadowRoot!.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!.click();
		for (const name of [
			'Toggle notes',
			'Normal view',
			'Slide sorter',
			'Slide show',
			'Zoom out',
			'Zoom to fit',
			'Zoom in',
		]) {
			click(name);
		}
		expect(p.onToggleNotes).toHaveBeenCalledOnce();
		expect(p.onSetMode).toHaveBeenNthCalledWith(1, 'edit');
		expect(p.onSetMode).toHaveBeenNthCalledWith(2, 'present');
		expect(p.onToggleSlideSorter).toHaveBeenCalledOnce();
		expect(p.onZoomOut).toHaveBeenCalledOnce();
		expect(p.onZoomToFit).toHaveBeenCalledOnce();
		expect(p.onZoomIn).toHaveBeenCalledOnce();
	});

	it('reflects pressed state for notes and the current mode', () => {
		const { button } = mount({ isNotesExpanded: true, mode: 'present' });
		expect(button('Toggle notes').getAttribute('aria-pressed')).toBe('true');
		expect(button('Normal view').getAttribute('aria-pressed')).toBe('false');
		expect(button('Slide show').getAttribute('aria-pressed')).toBe('true');
	});

	it('shows the zoom percentage and drops the cluster when hidden', () => {
		expect(mount({ scale: 0.75 }).button('Zoom to fit').textContent).toBe('75%');
		expect(mount({ scale: undefined }).button('Zoom in').closest('.group')).toHaveProperty(
			'hidden',
			true,
		);
		expect(mount({ hideZoomControls: true }).button('Zoom out').closest('.group')).toHaveProperty(
			'hidden',
			true,
		);
	});

	it('gates notes, slide show, sorter and view modes', () => {
		expect(mount({ onToggleNotes: undefined }).button('Toggle notes').hidden).toBeTruthy();
		expect(mount({ hideNotesToggle: true }).button('Toggle notes').hidden).toBeTruthy();
		const noShow = mount({ hideFullscreenToggle: true });
		expect(noShow.button('Slide show').hidden).toBeTruthy();
		expect(noShow.button('Normal view').hidden).toBeFalsy();
		expect(mount({ onToggleSlideSorter: undefined }).button('Slide sorter').hidden).toBeTruthy();
		expect(mount({ onSetMode: undefined }).button('Normal view').closest('.group')).toHaveProperty(
			'hidden',
			true,
		);
	});

	it('uses the latest callback after a re-render and stops listening on unmount', () => {
		const first = vi.fn<() => void>();
		const second = vi.fn<() => void>();
		const { host, render, button } = mount({ onToggleNotes: first });
		render({ onToggleNotes: second });
		button('Toggle notes').click();
		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledOnce();
		const { root } = mounted[mounted.length - 1]!;
		act(() => root.unmount());
		host.dispatchEvent(new CustomEvent('status-request', { detail: { id: 'notes' } }));
		expect(second).toHaveBeenCalledOnce();
		mounted.pop();
	});

	it('projects the collaboration indicator into the named slot', () => {
		const { host } = mount({ collaborationSlot: <span id='collab'>live</span> });
		expect(host.querySelector('[slot="collaboration"] #collab')).not.toBeNull();
	});
});
