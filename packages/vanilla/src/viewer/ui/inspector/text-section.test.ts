import { describe, expect, it, vi } from 'vitest';

import { createTextSection } from './text-section';
import type { InspectorHandlers, InspectorState } from './types';

function baseState(overrides: Partial<InspectorState> = {}): InspectorState {
	return {
		hasSelection: true,
		canText: true,
		vAlign: 'top',
		textWrap: 'square',
		autoFitMode: 'none',
		characterSpacing: 0,
		lineSpacing: 1,
		lineSpacingExactPt: null,
		paragraphSpacingBefore: 0,
		paragraphSpacingAfter: 0,
		paragraphIndent: 0,
		paragraphMarginLeft: 0,
		textDirection: 'horizontal',
		textRtl: false,
		textStyle: { color: '#ff0000' },
		recentColors: [],
		...overrides,
	} as unknown as InspectorState;
}

function mount() {
	const handlers = {
		setTextVerticalAlign: vi.fn(),
		setTextWrap: vi.fn(),
		setAutoFitMode: vi.fn(),
		setTextAdvanced: vi.fn(),
		setTextStyle: vi.fn(),
		pushRecentColor: vi.fn(),
	} as unknown as InspectorHandlers;
	const section = createTextSection(
		document,
		(key) => key,
		(label) => {
			const el = document.createElement('section');
			el.setAttribute('aria-label', label);
			return el;
		},
		handlers,
	);
	return { section, handlers };
}

// B6 (A3): the inspector's own text-colour picker + its "Recent colours" row.
describe('createTextSection text colour', () => {
	it('reflects the selected text style color', () => {
		const { section } = mount();
		section.update(baseState({ textStyle: { color: '#123456' } }));

		const colorInput = section.el.querySelector<HTMLInputElement>('input[type="color"]')!;
		expect(colorInput.value).toBe('#123456');
	});

	it('commits a typed colour through setTextStyle live, and pushes it on commit', () => {
		const { section, handlers } = mount();
		section.update(baseState());

		const colorInput = section.el.querySelector<HTMLInputElement>('input[type="color"]')!;
		colorInput.value = '#00ff00';
		colorInput.dispatchEvent(new Event('input'));
		expect(handlers.setTextStyle).toHaveBeenCalledWith({ color: '#00ff00' });
		expect(handlers.pushRecentColor).not.toHaveBeenCalled();

		colorInput.dispatchEvent(new Event('change'));
		expect(handlers.pushRecentColor).toHaveBeenCalledExactlyOnceWith('#00ff00');
	});

	it('is hidden until there are recent colours, then renders and commits from a swatch', () => {
		const { section, handlers } = mount();
		section.update(baseState());
		const row = section.el.querySelector<HTMLElement>('[data-testid="pptx-color-recent"]')!;
		expect(row.hidden).toBeTruthy();

		section.update(baseState({ recentColors: ['#abcdef'] }));
		expect(row.hidden).toBeFalsy();

		row.querySelector<HTMLButtonElement>('.pptxv-swatch')!.click();
		expect(handlers.setTextStyle).toHaveBeenCalledWith({ color: '#abcdef' });
		expect(handlers.pushRecentColor).toHaveBeenCalledWith('#abcdef');
	});

	it('disables the colour picker and its recent row when text cannot be formatted', () => {
		const { section } = mount();
		section.update(baseState({ canText: false, recentColors: ['#abcdef'] }));

		expect(
			section.el.querySelector<HTMLInputElement>('input[type="color"]')!.disabled,
		).toBeTruthy();
		expect(
			section.el
				.querySelector<HTMLElement>('[data-testid="pptx-color-recent"]')!
				.querySelector<HTMLButtonElement>('.pptxv-swatch')!.disabled,
		).toBeTruthy();
	});
});
