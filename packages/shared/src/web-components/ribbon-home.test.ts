// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { clipboardHomeControls, fontHomeControls, paragraphHomeControls } from '../render';
import { registerPptxWebControls } from './index';

beforeAll(registerPptxWebControls);
afterEach(() => document.body.replaceChildren());

const clipboard = {
	editable: true,
	hasSelection: true,
	hasClipboard: true,
	formatPainterActive: false,
	canFormatPaint: true,
	showFormatPainter: true,
};
function mount(tag: 'clipboard' | 'font' | 'paragraph' | 'editing', controls = {}) {
	const host = document.createElement(`pptx-ui-ribbon-home-${tag}`);
	host.state = { controls };
	document.body.append(host);
	return host;
}
const button = (host: HTMLElement, id: string) =>
	host.querySelector<HTMLButtonElement>(`[data-ribbon-control="${id}"]`)!;

describe('shared Home controls', () => {
	it('renders the clipboard group with public ids and one typed intent per click', () => {
		const host = mount('clipboard', clipboardHomeControls(clipboard));
		const request = vi.fn();
		host.addEventListener('home-request', request);
		expect(host.querySelector('[data-ribbon-group="home.clipboard"]')).toBeTruthy();
		expect(host.querySelectorAll('button')).toHaveLength(4);
		button(host, 'home.clipboard.copy').click();
		expect(request).toHaveBeenCalledOnce();
		expect(request.mock.calls[0][0].detail).toStrictEqual({ id: 'home.clipboard.copy' });
		expect(button(host, 'home.clipboard.formatPainter').dataset.testid).toBe(
			'format-painter-toggle',
		);
		expect(button(host, 'home.clipboard.paste').getAttribute('aria-label')).toBe('Paste');
	});

	it('gates paste, cut and copy and rejects disabled intents', () => {
		const host = mount(
			'clipboard',
			clipboardHomeControls({ ...clipboard, editable: false, hasClipboard: false }),
		);
		const request = vi.fn();
		host.addEventListener('home-request', request);
		expect(button(host, 'home.clipboard.paste').disabled).toBeTruthy();
		expect(button(host, 'home.clipboard.cut').disabled).toBeTruthy();
		expect(button(host, 'home.clipboard.copy').disabled).toBeFalsy();
		button(host, 'home.clipboard.paste').click();
		button(host, 'home.clipboard.cut').click();
		expect(request).not.toHaveBeenCalled();
	});

	it('reflects painter state, hides it when unavailable and keeps it armed to cancel', () => {
		const host = mount(
			'clipboard',
			clipboardHomeControls({ ...clipboard, formatPainterActive: true, canFormatPaint: false }),
		);
		const painter = button(host, 'home.clipboard.formatPainter');
		expect(painter.disabled).toBeFalsy();
		expect(painter.getAttribute('aria-pressed')).toBe('true');
		expect(painter.dataset.active).toBe('true');
		host.state = { controls: clipboardHomeControls({ ...clipboard, showFormatPainter: false }) };
		expect(painter.hidden).toBeTruthy();
		host.state = { controls: clipboardHomeControls({ ...clipboard, canFormatPaint: false }) };
		expect(painter.hidden).toBeFalsy();
		expect(painter.disabled).toBeTruthy();
		expect(painter.dataset.active).toBe('false');
	});

	it('reflects pressed font and alignment state only when the host supplies it', () => {
		const font = mount(
			'font',
			fontHomeControls({
				enabled: true,
				bold: true,
				italic: false,
				underline: false,
				strikethrough: false,
				shadow: false,
			}),
		);
		expect(button(font, 'home.font.bold').getAttribute('aria-pressed')).toBe('true');
		expect(button(font, 'home.font.italic').getAttribute('aria-pressed')).toBe('false');
		expect(button(font, 'home.font.increaseFontSize').hasAttribute('aria-pressed')).toBeFalsy();
		expect(font.querySelectorAll('.cluster')).toHaveLength(3);
		const paragraph = mount('paragraph', paragraphHomeControls({ enabled: true }));
		expect(button(paragraph, 'home.paragraph.alignLeft').hasAttribute('aria-pressed')).toBeFalsy();
		paragraph.state = { controls: paragraphHomeControls({ enabled: true, align: 'center' }) };
		expect(button(paragraph, 'home.paragraph.alignCenter').getAttribute('aria-pressed')).toBe(
			'true',
		);
		expect(button(paragraph, 'home.paragraph.alignLeft').getAttribute('aria-pressed')).toBe(
			'false',
		);
	});

	it('translates labels, keeps independent instances and survives reconnects without duplicates', () => {
		const first = mount('editing');
		const second = mount('editing');
		first.state = {
			controls: {},
			translate: (key) => (key === 'pptx.editing.find' ? 'Zoek' : key),
		};
		expect(button(first, 'home.editing.find').title).toBe('Zoek');
		expect(button(second, 'home.editing.find').title).toBe('Find');
		const stable = button(first, 'home.editing.find');
		first.remove();
		document.body.append(first);
		expect(first.querySelectorAll('button')).toHaveLength(2);
		expect(button(first, 'home.editing.find')).toBe(stable);
		const request = vi.fn();
		first.addEventListener('home-request', request);
		stable.click();
		expect(request).toHaveBeenCalledOnce();
	});

	it('keeps text selection on pointer press and Space or Enter away from slide shortcuts', () => {
		const host = mount(
			'font',
			fontHomeControls({
				enabled: true,
				bold: false,
				italic: false,
				underline: false,
				strikethrough: false,
				shadow: false,
			}),
		);
		const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
		button(host, 'home.font.bold').dispatchEvent(press);
		expect(press.defaultPrevented).toBeTruthy();
		const outer = vi.fn();
		document.addEventListener('keydown', outer);
		button(host, 'home.font.bold').dispatchEvent(
			new KeyboardEvent('keydown', { key: ' ', bubbles: true }),
		);
		document.removeEventListener('keydown', outer);
		expect(outer).not.toHaveBeenCalled();
	});
});
