// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { NotesToolbarViewState } from '../render';
import { registerPptxWebControls } from './index';

beforeAll(registerPptxWebControls);
afterEach(() => document.body.replaceChildren());

const base: NotesToolbarViewState = {
	rich: true,
	canFormat: true,
	showPrint: true,
	translate: (key) => key,
};

function mount(state: Partial<NotesToolbarViewState> = {}) {
	const host = document.createElement('pptx-ui-notes-toolbar');
	host.state = { ...base, ...state };
	document.body.append(host);
	return host;
}
const button = (host: HTMLElement, name: string) =>
	host.shadowRoot!.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;
const mode = (host: HTMLElement) => host.shadowRoot!.querySelector<HTMLButtonElement>('.mode')!;
const requests = (host: HTMLElement) => {
	const spy = vi.fn();
	host.addEventListener('notes-request', spy);
	return spy;
};

describe('pptx-ui-notes-toolbar', () => {
	it('exposes toolbar semantics, canonical order and names', () => {
		const host = mount();
		const bar = host.shadowRoot!.querySelector('[role="toolbar"]')!;
		expect(bar.getAttribute('aria-label')).toBe('pptx.notesToolbar.ariaLabel');
		const order = [...bar.querySelectorAll('button[data-notes-control]')].map(
			(b) => (b as HTMLElement).dataset.notesControl,
		);
		expect(order).toStrictEqual([
			'bold',
			'italic',
			'underline',
			'strike',
			'bullet',
			'numbered',
			'indent',
			'outdent',
			'link',
			'print',
			'toggleRich',
		]);
		expect(button(host, 'pptx.notes.indent').title).toBe('pptx.notes.indent');
		expect(mode(host).textContent).toBe('pptx.notes.plainEditor');
		host.state = { ...host.state, rich: false };
		expect(mode(host).textContent).toBe('pptx.notes.richEditor');
	});

	it('emits one typed intent per activation and none for state updates', () => {
		const host = mount();
		const spy = requests(host);
		host.state = { ...host.state, showPrint: true };
		expect(spy).not.toHaveBeenCalled();
		for (const [name, detail] of [
			['pptx.notes.bold', { kind: 'inline', command: 'bold' }],
			['pptx.notes.strikethrough', { kind: 'inline', command: 'strikeThrough' }],
			['pptx.notes.bulletList', { kind: 'paragraph', command: 'bullet' }],
			['pptx.notes.numberedList', { kind: 'paragraph', command: 'numbered' }],
			['pptx.notes.indent', { kind: 'paragraph', command: 'indent' }],
			['pptx.notes.outdent', { kind: 'paragraph', command: 'outdent' }],
			['pptx.notes.printNotes', { kind: 'print' }],
		] as const) {
			button(host, name).click();
			expect(spy.mock.calls.at(-1)![0].detail).toStrictEqual(detail);
		}
		mode(host).click();
		expect(spy.mock.calls.at(-1)![0].detail).toStrictEqual({ kind: 'toggle-rich' });
		expect(spy).toHaveBeenCalledTimes(8);
	});

	it('disables formatting in the plain editor but keeps print and the mode switch', () => {
		const host = mount({ rich: false, canFormat: false });
		expect(button(host, 'pptx.notes.bold').disabled).toBeTruthy();
		expect(button(host, 'pptx.notes.insertLink').disabled).toBeTruthy();
		expect(button(host, 'pptx.notes.printNotes').disabled).toBeFalsy();
		expect(mode(host).disabled).toBeFalsy();
		host.state = { ...host.state, disabled: true };
		expect(button(host, 'pptx.notes.printNotes').disabled).toBeTruthy();
		expect(mode(host).disabled).toBeTruthy();
		host.state = { ...base, showPrint: false };
		expect(button(host, 'pptx.notes.printNotes').hidden).toBeTruthy();
	});

	it('keeps the editor selection by cancelling mousedown on every button', () => {
		const host = mount();
		for (const el of host.shadowRoot!.querySelectorAll('button[data-notes-control]')) {
			const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
			el.dispatchEvent(event);
			expect(event.defaultPrevented).toBeTruthy();
		}
	});

	it('uses one roving tab stop with arrow, Home and End navigation', () => {
		const host = mount({ showPrint: false });
		const buttons = [...host.shadowRoot!.querySelectorAll<HTMLButtonElement>('button')].filter(
			(b) => b.dataset.notesControl && !b.hidden,
		);
		expect(buttons.filter((b) => b.tabIndex === 0)).toStrictEqual([buttons[0]]);
		const key = (target: HTMLElement, name: string) =>
			target.dispatchEvent(
				new KeyboardEvent('keydown', {
					key: name,
					bubbles: true,
					composed: true,
					cancelable: true,
				}),
			);
		buttons[0].focus();
		key(buttons[0], 'ArrowRight');
		expect(host.shadowRoot!.activeElement).toBe(buttons[1]);
		expect(buttons[1].tabIndex).toBe(0);
		expect(buttons[0].tabIndex).toBe(-1);
		key(buttons[1], 'End');
		expect(host.shadowRoot!.activeElement).toBe(buttons.at(-1));
		key(buttons.at(-1)!, 'ArrowRight');
		expect(host.shadowRoot!.activeElement).toBe(buttons[0]);
		key(buttons[0], 'ArrowLeft');
		expect(host.shadowRoot!.activeElement).toBe(buttons.at(-1));
		key(buttons.at(-1)!, 'Home');
		expect(host.shadowRoot!.activeElement).toBe(buttons[0]);
	});

	it('skips disabled buttons when roving and keeps arrows away from slide shortcuts', () => {
		const host = mount({ rich: false, canFormat: false });
		const outer = vi.fn();
		document.addEventListener('keydown', outer);
		const print = button(host, 'pptx.notes.printNotes');
		expect(print.tabIndex).toBe(0);
		print.focus();
		print.dispatchEvent(
			new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }),
		);
		expect(host.shadowRoot!.activeElement).toBe(mode(host));
		print.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, composed: true }));
		expect(outer).not.toHaveBeenCalled();
		document.removeEventListener('keydown', outer);
	});

	describe('link popover', () => {
		const open = (host: HTMLElement) => {
			button(host, 'pptx.notes.insertLink').click();
			return host.shadowRoot!.querySelector<HTMLElement>('.popover')!;
		};
		const fill = (pop: HTMLElement, name: string, value: string) => {
			const input = pop.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
			input.value = value;
			input.dispatchEvent(new Event('input', { bubbles: true }));
		};

		it('opens a labelled dialog, focuses the URL and emits one normalised link intent', () => {
			const host = mount();
			const spy = requests(host);
			const pop = open(host);
			expect(pop.hidden).toBeFalsy();
			expect(pop.getAttribute('role')).toBe('dialog');
			expect(host.shadowRoot!.activeElement).toBe(pop.querySelector('input[name="url"]'));
			expect(spy).not.toHaveBeenCalled();
			fill(pop, 'url', 'example.com');
			pop.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
			expect(spy).toHaveBeenCalledOnce();
			expect(spy.mock.calls[0][0].detail).toStrictEqual({
				kind: 'link',
				url: 'https://example.com',
				text: 'https://example.com',
			});
			expect(pop.hidden).toBeTruthy();
		});

		it('uses the display text and refuses an empty URL', () => {
			const host = mount();
			const spy = requests(host);
			const pop = open(host);
			pop.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
			expect(spy).not.toHaveBeenCalled();
			expect(pop.querySelector('input[name="url"]')!.getAttribute('aria-invalid')).toBe('true');
			fill(pop, 'url', 'http://a.test');
			fill(pop, 'text', 'Docs');
			pop.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
			expect(spy.mock.calls[0][0].detail).toStrictEqual({
				kind: 'link',
				url: 'http://a.test',
				text: 'Docs',
			});
		});

		it('seeds the display text from the editor selection and restores it on submit', () => {
			const editor = document.createElement('div');
			editor.setAttribute('contenteditable', 'true');
			editor.textContent = 'hello world';
			document.body.append(editor);
			const range = document.createRange();
			range.setStart(editor.firstChild!, 0);
			range.setEnd(editor.firstChild!, 5);
			const selection = document.getSelection()!;
			selection.removeAllRanges();
			selection.addRange(range);
			const host = mount();
			const pop = open(host);
			expect(pop.querySelector<HTMLInputElement>('input[name="text"]')!.value).toBe('hello');
			// Opening the form's inputs clears the document selection in real browsers.
			selection.removeAllRanges();
			fill(pop, 'url', 'a.test');
			pop.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
			expect(selection.toString()).toBe('hello');
		});

		it('closes on Escape and Cancel, restores focus and contains the keystroke', () => {
			const host = mount();
			const outer = vi.fn();
			document.addEventListener('keydown', outer);
			const pop = open(host);
			pop.dispatchEvent(
				new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }),
			);
			expect(pop.hidden).toBeTruthy();
			expect(host.shadowRoot!.activeElement).toBe(button(host, 'pptx.notes.insertLink'));
			expect(outer).not.toHaveBeenCalled();
			document.removeEventListener('keydown', outer);
			open(host);
			pop.querySelector<HTMLButtonElement>('.cancel')!.click();
			expect(pop.hidden).toBeTruthy();
		});

		it('closes when formatting becomes unavailable', () => {
			const host = mount();
			const pop = open(host);
			host.state = { ...host.state, canFormat: false };
			expect(pop.hidden).toBeTruthy();
		});
	});

	it('isolates instances', () => {
		const first = mount();
		const second = mount({ rich: false });
		expect(mode(first).textContent).toBe('pptx.notes.plainEditor');
		expect(mode(second).textContent).toBe('pptx.notes.richEditor');
	});
});
