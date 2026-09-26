// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { positionSelectMenu } from './select-menu';

afterEach(() => vi.restoreAllMocks());

describe('select popup placement', () => {
	function place(top: number, left = 20, width = 120) {
		const trigger = document.createElement('button');
		const menu = document.createElement('div');
		vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
			top,
			bottom: top + 28,
			left,
			width,
		} as DOMRect);
		// Read the current cap on each measurement, as layout does in the browser.
		// oxlint-disable-next-line vitest/prefer-mock-return-shorthand
		vi.spyOn(menu, 'getBoundingClientRect').mockImplementation(
			() =>
				({
					height: Math.min(200, Number.parseFloat(menu.style.maxHeight)),
					width: 200.5,
				}) as DOMRect,
		);
		positionSelectMenu(menu, trigger);
		return { menu, trigger };
	}

	it('prefers below when the popup fits', () => {
		const { menu } = place(80);
		expect(menu.style.top).toBe('112px');
		expect(menu.style.minWidth).toBe('120px');
	});

	it('opens above a control near the bottom without scrolling it', () => {
		const { menu } = place(window.innerHeight - 40);
		expect(menu.style.top).toBe(`${window.innerHeight - 244}px`);
		expect(menu.style.maxHeight).toBe('240px');
	});

	it('constrains wide controls and keeps the left viewport gutter', () => {
		const { menu } = place(80, -20, window.innerWidth + 100);
		expect(menu.style.minWidth).toBe(`${window.innerWidth - 16}px`);
		expect(menu.style.maxWidth).toBe(`${window.innerWidth - 16}px`);
		expect(menu.style.left).toBe('8px');
	});

	it('uses fractional widths to preserve the right viewport gutter', () => {
		const { menu } = place(80, window.innerWidth - 100);
		expect(menu.style.left).toBe(`${window.innerWidth - 208.5}px`);
	});
});
