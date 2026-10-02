// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { CHECKBOX_STYLES } from './checkbox-styles';
import { CONTROL_TOKENS, FOCUS_RING, tok } from './control-tokens';
import type { ControlToken } from './control-tokens';
import { HOST_STYLES } from './host-styles';
import { registerPptxWebControls } from './index';
import { SEARCH_STYLES } from './search-field-styles';
import { SELECT_STYLES } from './select-styles';

beforeAll(registerPptxWebControls);
afterEach(() => {
	document.body.replaceChildren();
});

const SHARED_CSS = { search: SEARCH_STYLES, select: SELECT_STYLES, checkbox: CHECKBOX_STYLES };

describe('canonical control tokens', () => {
	it('every shared token a primitive reads is declared with a default', () => {
		const declared = new Set(Object.keys(CONTROL_TOKENS));
		const sources = { ...SHARED_CSS, host: HOST_STYLES };
		for (const css of Object.values(sources)) {
			const used = [
				...css.matchAll(/var\((--pptx-(?:field|focus-ring|space|row|touch|checkbox)[a-z0-9-]*)/g),
			].map((match) => match[1]);
			expect(used.length).toBeGreaterThan(0);
			for (const token of used) {
				expect(declared.has(token)).toBeTruthy();
			}
		}
	});

	it('resolves colours at the point of use so viewer-root themes reach them', () => {
		expect(tok('--pptx-checkbox-accent')).toBe(
			'var(--pptx-checkbox-accent, var(--pptx-primary, #6366f1))',
		);
		for (const [token, value] of Object.entries(CONTROL_TOKENS)) {
			if (/(border|bg|fg|accent|color|placeholder)/.test(token)) {
				expect(`${token}: ${value}`).toMatch(/: var\(--pptx-[a-z-]+, #[0-9a-f]{3,8}\)$/);
			}
		}
	});

	it('one focus ring and one touch target feed every primitive', () => {
		expect(FOCUS_RING).toContain('--pptx-focus-ring-width');
		expect(CHECKBOX_STYLES).toContain(FOCUS_RING);
		expect(SELECT_STYLES).toContain(FOCUS_RING);
		expect(SELECT_STYLES).toContain('--pptx-touch-target');
		expect(CHECKBOX_STYLES).toContain('--pptx-checkbox-size-touch');
		for (const css of Object.values(SHARED_CSS)) {
			expect(css).toContain('forced-colors: active');
			expect(css).not.toMatch(/#e86a40|accent-color:\s*#/);
		}
	});

	it('native controls share the checkbox accent and focus ring inside viewer scopes only', () => {
		expect(HOST_STYLES).toContain('accent-color: var(--pptx-checkbox-accent');
		expect(HOST_STYLES).toMatch(
			/:where\(\[data-pptx-editor-chrome\][^)]*\) :is\(input\[type="checkbox"\]/,
		);
		expect(HOST_STYLES).not.toMatch(/^(input|select)\b/m);
	});

	it.each(Object.keys(CONTROL_TOKENS) as ControlToken[])('%s has a non-empty default', (name) => {
		expect(CONTROL_TOKENS[name].length).toBeGreaterThan(0);
	});
});

describe('search field states', () => {
	function make(attributes: Record<string, string> = {}) {
		const search = document.createElement('pptx-ui-search') as HTMLElement & {
			value: string;
			disabled: boolean;
		};
		for (const [name, value] of Object.entries(attributes)) {
			search.setAttribute(name, value);
		}
		document.body.append(search);
		return { search, input: search.shadowRoot!.querySelector('input')! };
	}

	it('names the input from aria-label, falling back to the placeholder', () => {
		expect(make({ placeholder: 'Search recent' }).input.getAttribute('aria-label')).toBe(
			'Search recent',
		);
		expect(make({ placeholder: 'x', 'aria-label': 'Find' }).input.getAttribute('aria-label')).toBe(
			'Find',
		);
	});

	it('placeholder is a property as well as an attribute', () => {
		const { search, input } = make();
		(search as HTMLElement & { placeholder: string }).placeholder = 'Search';
		expect(search.getAttribute('placeholder')).toBe('Search');
		expect(input.placeholder).toBe('Search');
		expect(input.getAttribute('aria-label')).toBe('Search');
	});

	it('disabled blocks the inner input and toggles back', () => {
		const { search, input } = make();
		search.disabled = true;
		expect(input.disabled).toBeTruthy();
		search.disabled = false;
		expect(input.disabled).toBeFalsy();
	});

	it('draws exactly one visible input: the host owns border and focus', () => {
		const { input } = make({ variant: 'titlebar' });
		expect(SEARCH_STYLES).toMatch(/input \{[^}]*border: 0;[^}]*outline: 0;/);
		expect(input.type).toBe('search');
		expect(SEARCH_STYLES).toContain(':host(:focus-within) { border-color:');
	});

	it('forwards one input event per keystroke and keeps value in sync', () => {
		const { search, input } = make();
		const onInput = vi.fn();
		search.addEventListener('input', onInput);
		input.value = 'a';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		input.value = 'ab';
		input.dispatchEvent(new Event('input', { bubbles: true }));
		expect(onInput).toHaveBeenCalledTimes(2);
		expect(search.value).toBe('ab');
	});
});

describe('checkbox states', () => {
	function make(attributes: Record<string, string> = {}) {
		const checkbox = document.createElement('pptx-ui-checkbox') as HTMLElement & {
			checked: boolean;
			disabled: boolean;
		};
		for (const [name, value] of Object.entries(attributes)) {
			checkbox.setAttribute(name, value);
		}
		document.body.append(checkbox);
		return checkbox;
	}

	it('exposes checked, unchecked and disabled state through ARIA and tab order', () => {
		const checkbox = make();
		expect(checkbox.getAttribute('role')).toBe('checkbox');
		expect(checkbox.getAttribute('aria-checked')).toBe('false');
		expect(checkbox.tabIndex).toBe(0);
		checkbox.checked = true;
		expect(checkbox.getAttribute('aria-checked')).toBe('true');
		checkbox.disabled = true;
		expect(checkbox.getAttribute('aria-disabled')).toBe('true');
		expect(checkbox.tabIndex).toBe(-1);
	});

	it('space toggles once, Enter does not, and disabled ignores both', () => {
		const checkbox = make();
		const onChange = vi.fn();
		checkbox.addEventListener('change', onChange);
		checkbox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		expect(onChange).not.toHaveBeenCalled();
		checkbox.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
		expect(onChange).toHaveBeenCalledOnce();
		expect(checkbox.checked).toBeTruthy();
		checkbox.disabled = true;
		checkbox.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
		checkbox.click();
		expect(onChange).toHaveBeenCalledOnce();
	});

	it('programmatic changes emit no events', () => {
		const checkbox = make();
		const onChange = vi.fn();
		checkbox.addEventListener('input', onChange);
		checkbox.addEventListener('change', onChange);
		checkbox.checked = true;
		checkbox.setAttribute('checked', '');
		expect(onChange).not.toHaveBeenCalled();
	});
});

describe('select states', () => {
	function make(disabledBeta = false) {
		const select = document.createElement('pptx-ui-select') as HTMLElement & {
			value: string;
			disabled: boolean;
		};
		select.setAttribute('aria-label', 'Choice');
		select.innerHTML = `<option value="a">Alpha</option><option value="b"${disabledBeta ? ' disabled' : ''}>Beta</option><option value="c">Gamma</option>`;
		document.body.append(select);
		const trigger = select.shadowRoot!.querySelector('button')!;
		const menu = select.shadowRoot!.querySelector<HTMLElement>('[role="listbox"]')!;
		return { select, trigger, menu };
	}
	const key = (target: Element, name: string) =>
		target.dispatchEvent(
			new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }),
		);

	it('is a labelled combobox that controls a listbox', () => {
		const { trigger, menu } = make();
		expect(trigger.getAttribute('role')).toBe('combobox');
		expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
		expect(trigger.getAttribute('aria-label')).toBe('Choice');
		expect(trigger.getAttribute('aria-controls')).toBe(menu.id);
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
	});

	it('marks the selected and disabled options and points activedescendant at the active one', () => {
		const { trigger, menu } = make(true);
		trigger.click();
		const options = [...menu.querySelectorAll('[role="option"]')];
		expect(options.map((option) => option.getAttribute('aria-selected'))).toStrictEqual([
			'true',
			'false',
			'false',
		]);
		expect(options[1].getAttribute('aria-disabled')).toBe('true');
		key(trigger, 'ArrowDown');
		expect(trigger.getAttribute('aria-activedescendant')).toBe(options[2].id);
	});

	it('typeahead jumps to the matching enabled option and Enter commits it once', () => {
		const { select, trigger } = make();
		const onChange = vi.fn();
		select.addEventListener('change', onChange);
		key(trigger, 'g');
		key(trigger, 'Enter');
		expect(select.value).toBe('c');
		expect(onChange).toHaveBeenCalledOnce();
		key(trigger, 'Enter');
		key(trigger, 'Enter');
		expect(onChange).toHaveBeenCalledOnce();
	});

	it('home and end move to the first and last enabled options', () => {
		const { trigger, menu } = make();
		trigger.click();
		key(trigger, 'End');
		expect(menu.querySelector('[data-active]')?.textContent).toBe('Gamma');
		key(trigger, 'Home');
		expect(menu.querySelector('[data-active]')?.textContent).toBe('Alpha');
	});

	it('page down and page up jump a page of enabled options and clamp at the ends', () => {
		const select = document.createElement('pptx-ui-select');
		select.setAttribute('aria-label', 'Long');
		select.innerHTML = Array.from(
			{ length: 20 },
			(_v, i) => `<option value="${i}"${i === 9 ? ' disabled' : ''}>Item ${i}</option>`,
		).join('');
		document.body.append(select);
		const trigger = select.shadowRoot!.querySelector('button')!;
		const menu = select.shadowRoot!.querySelector<HTMLElement>('[role="listbox"]')!;
		trigger.click();
		key(trigger, 'PageDown');
		expect(menu.querySelector('[data-active]')?.textContent).toBe('Item 8');
		key(trigger, 'PageDown');
		expect(menu.querySelector('[data-active]')?.textContent).toBe('Item 16');
		key(trigger, 'PageDown');
		expect(menu.querySelector('[data-active]')?.textContent).toBe('Item 19');
		key(trigger, 'PageUp');
		key(trigger, 'PageUp');
		key(trigger, 'PageUp');
		expect(menu.querySelector('[data-active]')?.textContent).toBe('Item 0');
		select.remove();
	});

	it('keeps the open popup options when a host re-syncs the same value and labels', async () => {
		const { select, trigger, menu } = make();
		trigger.click();
		const first = menu.querySelector('[role="option"]');
		select.value = 'a';
		select.setAttribute('aria-label', 'Choice');
		await new Promise<void>((resolve) => {
			requestAnimationFrame(() => resolve());
		});
		expect(menu.querySelector('[role="option"]')).toBe(first);
		select.value = 'c';
		expect(menu.querySelector('[role="option"]')).not.toBe(first);
	});

	it('escape closes without changing the value and returns to the trigger', () => {
		const { select, trigger } = make();
		const onChange = vi.fn();
		select.addEventListener('change', onChange);
		trigger.click();
		key(trigger, 'ArrowDown');
		key(trigger, 'Escape');
		expect(trigger.getAttribute('aria-expanded')).toBe('false');
		expect(select.value).toBe('a');
		expect(onChange).not.toHaveBeenCalled();
	});
});
