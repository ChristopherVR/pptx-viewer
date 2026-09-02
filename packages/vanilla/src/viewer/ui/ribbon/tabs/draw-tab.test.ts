import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../../i18n';
import type { RibbonDrawHandlers } from '../ribbon-types';
import { createDrawTab } from './draw-tab';

function makeHandlers(over: Partial<RibbonDrawHandlers> = {}): RibbonDrawHandlers {
	return {
		setTool: vi.fn(),
		setColor: vi.fn(),
		setWidth: vi.fn(),
		...over,
	};
}

describe('createDrawTab', () => {
	it('renders one button per tool (select, pen, highlighter, eraser, freeform)', () => {
		const t = createTranslator();
		const tab = createDrawTab(document, t, makeHandlers());
		const toolButtons = tab.el.querySelectorAll<HTMLButtonElement>(
			'.pptxv-rgroup:first-child button',
		);
		expect(toolButtons).toHaveLength(5);
	});

	it('dispatches setTool for each tool in select/pen/highlighter/eraser/freeform order', () => {
		const setTool = vi.fn();
		const t = createTranslator();
		const tab = createDrawTab(document, t, makeHandlers({ setTool }));
		const toolButtons = tab.el.querySelectorAll<HTMLButtonElement>(
			'.pptxv-rgroup:first-child button',
		);
		for (const button of toolButtons) {
			button.click();
		}
		expect(setTool).toHaveBeenNthCalledWith(1, 'select');
		expect(setTool).toHaveBeenNthCalledWith(2, 'pen');
		expect(setTool).toHaveBeenNthCalledWith(3, 'highlighter');
		expect(setTool).toHaveBeenNthCalledWith(4, 'eraser');
		expect(setTool).toHaveBeenNthCalledWith(5, 'freeform');
	});

	it('dispatches setColor from the custom colour input on the swatch picker', () => {
		const setColor = vi.fn();
		const t = createTranslator();
		const tab = createDrawTab(document, t, makeHandlers({ setColor }));
		const customInput = tab.el.querySelector<HTMLInputElement>('.pptxv-swatch-custom-input');
		expect(customInput).not.toBeNull();
		customInput!.value = '#00ff00';
		customInput!.dispatchEvent(new Event('input'));
		expect(setColor).toHaveBeenCalledWith('#00ff00');
	});

	it('dispatches setWidth from the width dropdown', () => {
		const setWidth = vi.fn();
		const t = createTranslator();
		const tab = createDrawTab(document, t, makeHandlers({ setWidth }));
		const item = tab.el.querySelector<HTMLButtonElement>('.pptxv-dropdown-item');
		expect(item).not.toBeNull();
		item!.click();
		expect(setWidth).toHaveBeenCalledWith(1);
	});

	it('update() reflects the active tool, colour, and width', () => {
		const t = createTranslator();
		const tab = createDrawTab(document, t, makeHandlers());
		tab.update({ tool: 'highlighter', color: '#123456', width: 8 });

		const toolButtons = tab.el.querySelectorAll<HTMLButtonElement>(
			'.pptxv-rgroup:first-child button',
		);
		expect(Array.from(toolButtons).map((b) => b.classList.contains('is-active'))).toStrictEqual([
			false,
			false,
			true,
			false,
			false,
		]);
		const widthTrigger = tab.el.querySelector('.pptxv-dropdown-text');
		expect(widthTrigger?.textContent).toBe('8 px');
	});

	// B6: the pen colour picker gets the same deck-level "Recent colours" row.
	it('update() threads recentColors into the pen colour picker', () => {
		const t = createTranslator();
		const tab = createDrawTab(document, t, makeHandlers());
		tab.update({ tool: 'pen', color: '#123456', width: 2, recentColors: ['#112233'] });

		expect(tab.el.querySelector('[data-testid="pptx-color-recent"] .pptxv-swatch')).not.toBeNull();
	});

	it('setEditable disables every tool button and control (trigger buttons, not the swatch/dropdown popover items, which are unreachable behind a disabled trigger)', () => {
		const t = createTranslator();
		const tab = createDrawTab(document, t, makeHandlers());
		const buttons = tab.el.querySelectorAll<HTMLButtonElement>(
			'button:not(.pptxv-dropdown-item):not(.pptxv-swatch)',
		);
		expect(buttons.length).toBeGreaterThan(0);

		tab.setEditable(false);
		expect(Array.from(buttons).every((b) => b.disabled)).toBeTruthy();

		tab.setEditable(true);
		expect(Array.from(buttons).every((b) => !b.disabled)).toBeTruthy();
	});
});
