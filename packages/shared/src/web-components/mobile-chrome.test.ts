// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { registerPptxWebControls } from './index';

beforeAll(registerPptxWebControls);
afterEach(() => document.body.replaceChildren());

const listen = (host: HTMLElement, type: string) => {
	const spy = vi.fn();
	host.addEventListener(type, (event) => spy((event as CustomEvent).detail));
	return spy;
};
const button = (host: HTMLElement, selector: string) =>
	host.shadowRoot!.querySelector<HTMLButtonElement>(selector)!;

describe('pptx-ui-mobile-bar', () => {
	function mount(state = {}) {
		const host = document.createElement('pptx-ui-mobile-bar');
		host.state = { slideCount: 3, translate: (key: string) => `t:${key}`, ...state };
		document.body.append(host);
		return host;
	}

	it('renders the five slots in order inside a named navigation', () => {
		const host = mount();
		expect(host.shadowRoot!.querySelector('nav')!.getAttribute('aria-label')).toBe(
			't:pptx.mobileBar.ariaLabel',
		);
		const ids = Array.from(host.shadowRoot!.querySelectorAll('button')).map(
			(b) => b.dataset.mobileAction,
		);
		expect(ids).toStrictEqual(['slides', 'insert', 'inspector', 'comments', 'notes']);
		expect(button(host, '[data-mobile-action="insert"] span')!.textContent).toBe(
			't:pptx.mobileBar.insert',
		);
		expect(button(host, '[data-mobile-action="notes"]').getAttribute('aria-label')).toBe(
			't:pptx.statusBar.toggleNotes',
		);
	});

	it('disables every slot with no slides and extra disabled or hidden ids', () => {
		const empty = mount({ slideCount: 0 });
		expect(
			Array.from(empty.shadowRoot!.querySelectorAll('button')).every((b) => b.disabled),
		).toBeTruthy();
		const host = mount({ disabled: ['insert'], hidden: ['notes'] });
		expect(button(host, '[data-mobile-action="insert"]').disabled).toBeTruthy();
		expect(button(host, '[data-mobile-action="slides"]').disabled).toBeFalsy();
		expect(button(host, '[data-mobile-action="notes"]').hidden).toBeTruthy();
	});

	it('marks the open sheet pressed with a pill and caps the comment badge at 99+', () => {
		const host = mount({ activeSheet: 'comments', commentCount: 120 });
		const comments = button(host, '[data-mobile-action="comments"]');
		expect(comments.getAttribute('aria-pressed')).toBe('true');
		expect(comments.querySelector<HTMLElement>('.pill')!.hidden).toBeFalsy();
		expect(comments.querySelector('.badge')!.textContent).toBe('99+');
		const slides = button(host, '[data-mobile-action="slides"]');
		expect(slides.getAttribute('aria-pressed')).toBe('false');
		expect(slides.querySelector<HTMLElement>('.badge')!.hidden).toBeTruthy();
	});

	it('emits one intent per tap', () => {
		const host = mount();
		const spy = listen(host, 'mobile-bar-request');
		button(host, '[data-mobile-action="slides"]').click();
		button(host, '[data-mobile-action="notes"]').click();
		expect(spy.mock.calls).toStrictEqual([[{ id: 'slides' }], [{ id: 'notes' }]]);
	});
});

describe('pptx-ui-mobile-toolbar', () => {
	function mount(state = {}) {
		const host = document.createElement('pptx-ui-mobile-toolbar');
		host.state = {
			editable: true,
			canUndo: true,
			canRedo: false,
			translate: (key: string) => `t:${key}`,
			...state,
		};
		document.body.append(host);
		return host;
	}
	const named = (host: HTMLElement, key: string) => button(host, `button[aria-label="t:${key}"]`);

	it('renders the editing row inside a named toolbar', () => {
		const host = mount();
		const bar = host.shadowRoot!.querySelector('[role="toolbar"]')!;
		expect(bar.getAttribute('aria-label')).toBe('t:pptx.mobileToolbar.toolbar');
		expect(named(host, 'pptx.mobileToolbar.menu').hidden).toBeFalsy();
		expect(named(host, 'pptx.toolbar.undo').disabled).toBeFalsy();
		expect(named(host, 'pptx.toolbar.redo').disabled).toBeTruthy();
		expect(named(host, 'pptx.toolbar.share').hidden).toBeFalsy();
		expect(named(host, 'pptx.toolbar.toggleAiAssistant').hidden).toBeTruthy();
	});

	it('hides the editing-only buttons and slots when not editable but keeps Save and Present', () => {
		const host = mount({ editable: false });
		for (const key of [
			'pptx.mobileToolbar.menu',
			'pptx.toolbar.undo',
			'pptx.toolbar.redo',
			'pptx.toolbar.share',
		]) {
			expect(named(host, key).hidden).toBeTruthy();
		}
		expect(named(host, 'pptx.toolbar.save').hidden).toBeFalsy();
		expect(named(host, 'pptx.toolbar.present').hidden).toBeFalsy();
		expect(
			host.shadowRoot!.querySelector<HTMLElement>('slot[name="collaboration"]')!.hidden,
		).toBeTruthy();
	});

	it('honours hidden and disabled ids and reflects the AI toggle and menu state', () => {
		const host = mount({
			hidden: ['undo', 'present'],
			disabled: ['save'],
			aiVisible: true,
			aiActive: true,
			menuOpen: true,
		});
		expect(named(host, 'pptx.toolbar.undo').hidden).toBeTruthy();
		expect(named(host, 'pptx.toolbar.present').hidden).toBeTruthy();
		expect(named(host, 'pptx.toolbar.save').disabled).toBeTruthy();
		const ai = named(host, 'pptx.toolbar.toggleAiAssistant');
		expect(ai.hidden).toBeFalsy();
		expect(ai.getAttribute('aria-pressed')).toBe('true');
		expect(named(host, 'pptx.mobileToolbar.menu').getAttribute('aria-expanded')).toBe('true');
	});

	it('emits one intent per activation', () => {
		const host = mount({ canRedo: true, aiVisible: true });
		const spy = listen(host, 'mobile-toolbar-request');
		for (const key of [
			'pptx.mobileToolbar.menu',
			'pptx.toolbar.undo',
			'pptx.toolbar.redo',
			'pptx.toolbar.toggleAiAssistant',
			'pptx.toolbar.save',
			'pptx.toolbar.present',
			'pptx.toolbar.share',
		]) {
			named(host, key).click();
		}
		expect(spy.mock.calls.map(([detail]) => detail.id)).toStrictEqual([
			'menu',
			'undo',
			'redo',
			'ai',
			'save',
			'present',
			'share',
		]);
	});
});
