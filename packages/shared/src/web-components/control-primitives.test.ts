// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { CONTROL_TOKENS, FOCUS_RING, tok } from './control-tokens';
import type { ControlToken } from './control-tokens';
import { HOST_STYLES } from './host-styles';
import { registerPptxWebControls } from './index';
import { bridgeCss } from './office-token-bridge';

const OFFICE_TOKEN_BRIDGE = bridgeCss('pptx-ui-checkbox');

beforeAll(registerPptxWebControls);
afterEach(() => {
	document.body.replaceChildren();
});

// Search, checkbox, radio and switch are ooxml-ui elements now (`office-ui-*`, aliased under their
// pptx tags); the bridge maps their --office-* tokens onto these pptx control tokens.
const SHARED_CSS = {
	bridge: OFFICE_TOKEN_BRIDGE,
};

/** The CSS a shared control renders into its shadow root (jsdom uses the `<style>` fallback). */
function shadowCss(tag: string): string {
	const el = document.createElement(tag);
	document.body.append(el);
	const text = [...el.shadowRoot!.querySelectorAll('style')].map((s) => s.textContent).join(' ');
	el.remove();
	return text;
}

describe('canonical control tokens', () => {
	it('every shared token a primitive reads is declared with a default', () => {
		const declared = new Set(Object.keys(CONTROL_TOKENS));
		const sources = { ...SHARED_CSS, host: HOST_STYLES };
		for (const css of Object.values(sources)) {
			const used = [
				...css.matchAll(
					/var\((--pptx-(?:field|focus-ring|space|row|touch|checkbox|radio|switch)[a-z0-9-]*)/g,
				),
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
		expect(OFFICE_TOKEN_BRIDGE).toContain('--office-target-size-touch: var(--pptx-touch-target');
		// The shared elements read --office-* focus and size tokens; the bridge feeds them.
		expect(OFFICE_TOKEN_BRIDGE).toContain('--office-focus-width: var(--pptx-focus-ring-width');
		expect(OFFICE_TOKEN_BRIDGE).toContain(
			'--office-checkbox-size-touch: var(--pptx-checkbox-size-touch',
		);
		for (const tag of [
			'pptx-ui-search',
			'pptx-ui-select',
			'pptx-ui-checkbox',
			'pptx-ui-radio',
			'pptx-ui-switch',
		]) {
			const css = shadowCss(tag);
			expect(css.includes('forced-colors: active') ? tag : `${tag}: no forced-colors`).toBe(tag);
			expect(css.includes('var(--office-focus-width') ? tag : `${tag}: no focus token`).toBe(tag);
		}
		for (const css of Object.values(SHARED_CSS)) {
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
		const css = shadowCss('pptx-ui-search');
		expect(css).toMatch(/input \{[^}]*border: 0;[^}]*outline: 0;/);
		expect(input.type).toBe('search');
		expect(css).toContain(':host(:focus-within) { border-color:');
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

describe('radio group', () => {
	type Radio = HTMLElement & { checked: boolean; disabled: boolean; value: string };
	function group(count = 3, name = 'g'): Radio[] {
		const radios: Radio[] = [];
		for (let i = 0; i < count; i += 1) {
			const radio = document.createElement('pptx-ui-radio') as Radio;
			radio.setAttribute('name', name);
			radio.setAttribute('value', String(i));
			document.body.append(radio);
			radios.push(radio);
		}
		return radios;
	}
	const key = (el: HTMLElement, name: string) =>
		el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));

	it('exposes role, checked state and one roving tab stop', () => {
		const [a, b, c] = group();
		expect(a.getAttribute('role')).toBe('radio');
		expect([a, b, c].map((r) => r.tabIndex)).toStrictEqual([0, -1, -1]);
		b.checked = true;
		expect([a, b, c].map((r) => r.tabIndex)).toStrictEqual([-1, 0, -1]);
		expect(b.getAttribute('aria-checked')).toBe('true');
		expect(a.getAttribute('aria-checked')).toBe('false');
	});

	it('checking one radio unchecks its group peers silently', () => {
		const [a, b] = group();
		const onChange = vi.fn();
		document.body.addEventListener('change', onChange);
		a.checked = true;
		b.checked = true;
		expect(a.checked).toBeFalsy();
		expect(onChange).not.toHaveBeenCalled();
	});

	it('keeps separate names independent', () => {
		const [a] = group(2, 'one');
		const [x] = group(2, 'two');
		a.checked = true;
		x.checked = true;
		expect(a.checked).toBeTruthy();
		expect(x.checked).toBeTruthy();
	});

	it('click and space select once and emit input then change', () => {
		const [a, b] = group();
		const seen: string[] = [];
		b.addEventListener('input', () => seen.push('input'));
		b.addEventListener('change', () => seen.push('change'));
		b.click();
		b.click();
		expect(seen).toStrictEqual(['input', 'change']);
		key(a, ' ');
		expect(a.checked).toBeTruthy();
		expect(b.checked).toBeFalsy();
	});

	it('arrows, Home and End move and select, wrapping and skipping disabled radios', () => {
		const [a, b, c] = group();
		a.checked = true;
		b.disabled = true;
		a.focus();
		key(a, 'ArrowDown');
		expect(c.checked).toBeTruthy();
		expect(document.activeElement).toBe(c);
		key(c, 'ArrowRight');
		expect(a.checked).toBeTruthy();
		key(a, 'ArrowLeft');
		expect(c.checked).toBeTruthy();
		key(c, 'Home');
		expect(a.checked).toBeTruthy();
		key(a, 'End');
		expect(c.checked).toBeTruthy();
		expect(b.checked).toBeFalsy();
	});

	it('disabled radios are inert and leave the tab order', () => {
		const [a, b] = group();
		const onChange = vi.fn();
		a.addEventListener('change', onChange);
		a.disabled = true;
		a.click();
		expect(onChange).not.toHaveBeenCalled();
		expect(a.getAttribute('aria-disabled')).toBe('true');
		expect([a.tabIndex, b.tabIndex]).toStrictEqual([-1, 0]);
	});

	it('reports its value, defaulting to on like a native radio', () => {
		const [a, b] = group(2, 'fruit');
		expect(a.value).toBe('0');
		b.removeAttribute('value');
		expect(b.value).toBe('on');
	});
});

describe('switch', () => {
	type Switch = HTMLElement & { checked: boolean; disabled: boolean };
	function make(attributes: Record<string, string> = {}): Switch {
		const toggle = document.createElement('pptx-ui-switch') as Switch;
		for (const [name, value] of Object.entries(attributes)) {
			toggle.setAttribute(name, value);
		}
		document.body.append(toggle);
		return toggle;
	}

	it('exposes role=switch, aria-checked and the tab stop', () => {
		const toggle = make();
		expect(toggle.getAttribute('role')).toBe('switch');
		expect(toggle.getAttribute('aria-checked')).toBe('false');
		expect(toggle.tabIndex).toBe(0);
		toggle.checked = true;
		expect(toggle.getAttribute('aria-checked')).toBe('true');
	});

	it('space, enter and click toggle; programmatic changes stay silent', () => {
		const toggle = make();
		const onChange = vi.fn();
		toggle.addEventListener('change', onChange);
		toggle.checked = true;
		expect(onChange).not.toHaveBeenCalled();
		toggle.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
		toggle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
		toggle.click();
		expect(onChange).toHaveBeenCalledTimes(3);
		expect(toggle.checked).toBeFalsy();
	});

	it('a disabled switch is inert and leaves the tab order', () => {
		const toggle = make({ disabled: '' });
		const onChange = vi.fn();
		toggle.addEventListener('change', onChange);
		toggle.click();
		toggle.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
		expect(onChange).not.toHaveBeenCalled();
		expect(toggle.getAttribute('aria-disabled')).toBe('true');
		expect(toggle.tabIndex).toBe(-1);
	});
});

describe('office token bridge', () => {
	it('is one valid :host block of --office-* declarations per alias', () => {
		const css = bridgeCss('pptx-ui-switch');
		const body = css.slice(css.indexOf('{') + 1, css.indexOf('}'));
		const declarations = body
			.split(';')
			.map((part) => part.trim())
			.filter(Boolean);
		expect(css.startsWith(':host {')).toBeTruthy();
		expect(declarations.length).toBeGreaterThan(30);
		for (const declaration of declarations) {
			expect(declaration).toMatch(/^--office-[a-z0-9-]+:\s\S/u);
		}
	});
});
