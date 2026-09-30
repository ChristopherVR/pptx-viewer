// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { registerPptxWebControls } from './index';

beforeAll(registerPptxWebControls);
afterEach(() => document.body.replaceChildren());

function field(value: string, options: string) {
	const select = document.createElement('pptx-ui-select');
	select.setAttribute('variant', 'ribbon-font');
	select.innerHTML = options;
	select.value = value;
	document.body.append(select);
	return select;
}

describe('ribbon font select', () => {
	it.each(['40.5', 'Deck-specific font'])(
		'retains an authored value outside the presets: %s',
		(value) => {
			const select = field(value, '<option value="24">24</option><option value="36">36</option>');
			expect(select.value).toBe(value);
			expect(select.shadowRoot!.querySelector('[part="value"]')?.textContent).toBe(value);
		},
	);

	it('keeps a theme role in the menu while displaying just the font family', () => {
		const select = field(
			'Calibri',
			'<optgroup label="Theme Fonts"><option value="Calibri" data-display-label="Calibri" data-description="Body" style="font-family:Calibri">Calibri (Body)</option></optgroup>',
		);
		expect(select.shadowRoot!.querySelector('[part="value"]')?.textContent).toBe('Calibri');
		select.shadowRoot!.querySelector<HTMLButtonElement>('button')!.click();
		const option = select.shadowRoot!.querySelector<HTMLElement>('[role="option"]')!;
		expect(option.textContent).toBe('CalibriBody');
		expect(option.style.fontFamily).toBe('Calibri');
		expect(option.querySelector('.description')?.textContent).toBe('Body');
	});

	it('commits one native change event through keyboard selection and closes when disabled', () => {
		const select = field('24', '<option value="24">24</option><option value="36">36</option>');
		const change = vi.fn();
		select.addEventListener('change', change);
		const trigger = select.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
		trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
		trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(select.value).toBe('36');
		expect(change).toHaveBeenCalledOnce();
		trigger.click();
		select.disabled = true;
		expect(trigger.disabled).toBeTruthy();
		expect(select.hasAttribute('open')).toBeFalsy();
		select.disabled = false;
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
		expect(change).toHaveBeenCalledOnce();
	});

	it('preserves focusable custom input without cancelling pointer presses', () => {
		const select = field(
			'24',
			'<label slot="custom">Size<input type="number"></label><option value="24">24</option>',
		);
		select.shadowRoot!.querySelector<HTMLButtonElement>('button')!.click();
		const slot = select.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="custom"]')!;
		expect(slot.assignedElements()[0]).toBe(select.querySelector('label'));
		const press = new MouseEvent('pointerdown', {
			bubbles: true,
			composed: true,
			cancelable: true,
		});
		select.querySelector('input')!.dispatchEvent(press);
		expect(press.defaultPrevented).toBeFalsy();
	});
});
