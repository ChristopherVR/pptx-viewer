import { AFTER_ANIMATION_VALUES } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../i18n';
import { createAfterAnimationRow } from './after-animation-row';

const t = createTranslator();

function selectOf(el: HTMLElement): HTMLSelectElement {
	const select = el.querySelector('select');
	if (!select) {
		throw new Error('after animation row has no select');
	}
	return select;
}

function colorInputOf(el: HTMLElement): HTMLInputElement {
	const input = el.querySelector<HTMLInputElement>('input[type="color"]');
	if (!input) {
		throw new Error('after animation row has no color input');
	}
	return input;
}

describe('createAfterAnimationRow', () => {
	it('offers all four actions', () => {
		const row = createAfterAnimationRow(document, t, vi.fn(), vi.fn());
		const select = selectOf(row.el);
		expect([...select.options].map((option) => option.value)).toStrictEqual([
			...AFTER_ANIMATION_VALUES,
		]);
	});

	it('hides the colour swatch unless dimToColor is selected', () => {
		const row = createAfterAnimationRow(document, t, vi.fn(), vi.fn());
		row.update({ action: 'none', color: undefined, editable: true });
		expect(row.el.querySelector('label:last-child')?.hasAttribute('hidden')).toBeTruthy();

		row.update({ action: 'dimToColor', color: '#ff0000', editable: true });
		expect(row.el.querySelector('label:last-child')?.hasAttribute('hidden')).toBeFalsy();
		expect(colorInputOf(row.el).value).toBe('#ff0000');
	});

	it('emits the selected action', () => {
		const onAction = vi.fn();
		const row = createAfterAnimationRow(document, t, onAction, vi.fn());
		const select = selectOf(row.el);
		select.value = 'hideOnNextClick';
		select.dispatchEvent(new Event('change'));
		expect(onAction).toHaveBeenCalledWith('hideOnNextClick');
	});

	it('emits the picked colour', () => {
		const onColor = vi.fn();
		const row = createAfterAnimationRow(document, t, vi.fn(), onColor);
		row.update({ action: 'dimToColor', color: '#000000', editable: true });
		const colorInput = colorInputOf(row.el);
		colorInput.value = '#00ff00';
		colorInput.dispatchEvent(new Event('change'));
		expect(onColor).toHaveBeenCalledWith('#00ff00');
	});

	it('disables both controls when not editable', () => {
		const row = createAfterAnimationRow(document, t, vi.fn(), vi.fn());
		row.update({ action: 'dimToColor', color: '#000000', editable: false });
		expect(selectOf(row.el).disabled).toBeTruthy();
		expect(colorInputOf(row.el).disabled).toBeTruthy();
	});
});
