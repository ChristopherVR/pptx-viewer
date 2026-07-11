import { describe, expect, it, vi } from 'vitest';

import { makeDropdown } from './dropdown';

describe('makeDropdown', () => {
	it('opens on trigger click and closes on item select, firing onSelect', () => {
		const onSelect = vi.fn();
		const dd = makeDropdown(document, {
			triggerLabel: 'Font size',
			triggerText: '18',
			items: [
				{ label: '18', value: 18 },
				{ label: '24', value: 24 },
			],
			onSelect,
		});
		const trigger = dd.el.querySelector<HTMLButtonElement>('.pptxv-dropdown-trigger')!;
		const menu = dd.el.querySelector<HTMLElement>('.pptxv-dropdown-menu')!;
		expect(menu.hidden).toBeTruthy();

		trigger.click();
		expect(menu.hidden).toBeFalsy();

		const items = dd.el.querySelectorAll<HTMLButtonElement>('.pptxv-dropdown-item');
		items[1].click();
		expect(onSelect).toHaveBeenCalledExactlyOnceWith(24);
		expect(menu.hidden).toBeTruthy();
	});

	it('closes on an outside pointerdown', () => {
		const dd = makeDropdown(document, {
			triggerLabel: 'x',
			triggerText: 'x',
			items: [{ label: 'a', value: 'a' }],
			onSelect: vi.fn(),
		});
		document.body.appendChild(dd.el);
		dd.el.querySelector<HTMLButtonElement>('.pptxv-dropdown-trigger')!.click();
		expect(dd.el.querySelector<HTMLElement>('.pptxv-dropdown-menu')!.hidden).toBeFalsy();

		document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
		expect(dd.el.querySelector<HTMLElement>('.pptxv-dropdown-menu')!.hidden).toBeTruthy();
		dd.el.remove();
	});

	it('setDisabled disables the trigger and force-closes the menu', () => {
		const dd = makeDropdown(document, {
			triggerLabel: 'x',
			triggerText: 'x',
			items: [{ label: 'a', value: 'a' }],
			onSelect: vi.fn(),
		});
		const trigger = dd.el.querySelector<HTMLButtonElement>('.pptxv-dropdown-trigger')!;
		trigger.click();
		dd.setDisabled(true);
		expect(trigger.disabled).toBeTruthy();
		expect(dd.el.querySelector<HTMLElement>('.pptxv-dropdown-menu')!.hidden).toBeTruthy();
	});

	it('setTriggerText and setSelected update the visible state', () => {
		const dd = makeDropdown(document, {
			triggerLabel: 'x',
			triggerText: 'Arial',
			items: [
				{ label: 'Arial', value: 'Arial' },
				{ label: 'Georgia', value: 'Georgia' },
			],
			onSelect: vi.fn(),
		});
		dd.setTriggerText('Georgia');
		expect(dd.el.querySelector('.pptxv-dropdown-text')!.textContent).toBe('Georgia');

		dd.setSelected('Georgia');
		const items = dd.el.querySelectorAll<HTMLButtonElement>('.pptxv-dropdown-item');
		expect(items[0].classList.contains('is-selected')).toBeFalsy();
		expect(items[1].classList.contains('is-selected')).toBeTruthy();
	});
});
