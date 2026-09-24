// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { registerPptxWebControls } from './index';

beforeAll(registerPptxWebControls);
afterEach(() => {
	document.body.replaceChildren();
});

describe('shared Web Components', () => {
	it('search reflects its value and emits an input event on the host', () => {
		const search = document.createElement('pptx-ui-search') as HTMLElement & { value: string };
		search.setAttribute('placeholder', 'Search recent presentations');
		document.body.append(search);
		const input = search.shadowRoot!.querySelector('input')!;
		const onInput = vi.fn();
		search.addEventListener('input', onInput);
		search.value = 'deck';
		expect(input.value).toBe('deck');
		input.value = 'slides';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		expect(search.value).toBe('slides');
		expect(onInput).toHaveBeenCalledOnce();
	});

	it('checkbox toggles once through its label and respects disabled', () => {
		const label = document.createElement('label');
		label.textContent = 'Show Mini Toolbar';
		const checkbox = document.createElement('pptx-ui-checkbox') as HTMLElement & {
			checked: boolean;
			disabled: boolean;
		};
		label.append(checkbox);
		document.body.append(label);
		const onChange = vi.fn();
		checkbox.addEventListener('change', onChange);
		label.click();
		expect(checkbox.checked).toBeTruthy();
		expect(onChange).toHaveBeenCalledOnce();
		checkbox.disabled = true;
		label.click();
		expect(checkbox.checked).toBeTruthy();
		expect(onChange).toHaveBeenCalledOnce();
	});

	it('keeps scoped styles when constructable stylesheets are unavailable', () => {
		const checkbox = document.createElement('pptx-ui-checkbox');
		expect(checkbox.shadowRoot?.querySelector('style')?.textContent).toContain(':host([checked])');
	});

	it('select uses its light DOM options and skips disabled choices', () => {
		const select = document.createElement('pptx-ui-select') as HTMLElement & { value: string };
		select.innerHTML =
			'<option value="a">Alpha</option><option value="b" disabled>Beta</option><option value="c">Charlie</option>';
		select.value = 'a';
		document.body.append(select);
		const trigger = select.shadowRoot!.querySelector('button')!;
		const onChange = vi.fn();
		select.addEventListener('change', onChange);
		trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
		trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(select.value).toBe('c');
		expect(onChange).toHaveBeenCalledOnce();
	});

	it('select exposes the initial option and selectedIndex before attachment', () => {
		const select = document.createElement('pptx-ui-select') as HTMLElement & {
			value: string;
			selectedIndex: number;
			options: HTMLOptionElement[];
		};
		select.innerHTML = '<option value="first">First</option><option value="second">Second</option>';
		expect(select.value).toBe('first');
		expect(select.selectedIndex).toBe(0);
		select.value = 'second';
		expect(select.selectedIndex).toBe(1);
		select.selectedIndex = 0;
		expect(select.value).toBe('first');
		expect(select.options.map((option) => option.value)).toStrictEqual(['first', 'second']);
	});

	it('select keeps option groups and excludes hidden choices from keyboard commits', () => {
		const select = document.createElement('pptx-ui-select') as HTMLElement & { value: string };
		select.innerHTML =
			'<option value="a">Alpha</option><optgroup label="Unavailable" disabled><option value="b">Beta</option></optgroup><option value="c" hidden>Charlie</option><optgroup label="More"><option value="d">Delta</option></optgroup>';
		document.body.append(select);
		const trigger = select.shadowRoot!.querySelector('button')!;
		trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
		trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(select.value).toBe('d');
		expect(select.shadowRoot!.querySelectorAll('[role="option"]')).toHaveLength(3);
		expect(select.shadowRoot!.querySelector('.group')?.textContent).toBe('Unavailable');
	});

	it('opens the select menu below its trigger and Escape closes only the menu', () => {
		const select = document.createElement('pptx-ui-select');
		select.innerHTML = '<option value="a">Alpha</option><option value="b">Beta</option>';
		document.body.append(select);
		const trigger = select.shadowRoot!.querySelector('button')!;
		const menu = select.shadowRoot!.querySelector<HTMLElement>('[role="listbox"]')!;
		expect(menu.childElementCount).toBe(0);
		vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
			x: 20,
			y: 80,
			left: 20,
			top: 80,
			right: 140,
			bottom: 108,
			width: 120,
			height: 28,
			toJSON: () => ({}),
		});
		trigger.click();
		expect(menu.querySelectorAll('[role="option"]')).toHaveLength(2);
		expect(menu.style.top).toBe('112px');
		expect(trigger.getAttribute('aria-expanded')).toBe('true');
		const parentKeydown = vi.fn();
		document.body.addEventListener('keydown', parentKeydown);
		trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
		expect(parentKeydown).not.toHaveBeenCalled();
		document.body.removeEventListener('keydown', parentKeydown);
	});
});
