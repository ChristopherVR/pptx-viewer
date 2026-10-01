import { describe, expect, it, vi } from 'vitest';

import { readTextFormatState } from '../../../editor/editor-format-mutations';
import { createTranslator } from '../../../i18n';
import { createFontGroup } from './font-group';

function handlers() {
	return {
		toggleBold: vi.fn(),
		toggleItalic: vi.fn(),
		toggleUnderline: vi.fn(),
		toggleStrikethrough: vi.fn(),
		toggleTextShadow: vi.fn(),
		setFontFamily: vi.fn(),
		setFontSize: vi.fn(),
		changeFontSize: vi.fn(),
		setTextColor: vi.fn(),
		setHighlightColor: vi.fn(),
		setCharacterSpacing: vi.fn(),
		changeCase: vi.fn(),
		clearFormatting: vi.fn(),
	};
}
const element = {
	type: 'text' as const,
	id: 'bold-test',
	x: 0,
	y: 0,
	width: 100,
	height: 20,
	text: 'Hello',
	textStyle: { bold: true },
};
const button = (root: HTMLElement, id: string) =>
	root.querySelector<HTMLButtonElement>(`[data-ribbon-control="home.font.${id}"]`)!;

describe('createFontGroup character strip', () => {
	it('routes shared intents to the native handlers', () => {
		const h = handlers();
		const group = createFontGroup(document, createTranslator(), h);
		group.update({ canFormat: true, editable: true, text: readTextFormatState(element) });
		button(group.el, 'italic').click();
		button(group.el, 'shadow').click();
		button(group.el, 'increaseFontSize').click();
		button(group.el, 'decreaseFontSize').click();
		button(group.el, 'clearFormatting').click();
		expect(h.toggleItalic).toHaveBeenCalledOnce();
		expect(h.toggleTextShadow).toHaveBeenCalledOnce();
		expect(h.changeFontSize.mock.calls).toStrictEqual([[2], [-2]]);
		expect(h.clearFormatting).toHaveBeenCalledOnce();
	});

	it('reflects pressed state and gates on editability and a formattable selection', () => {
		const h = handlers();
		const group = createFontGroup(document, createTranslator(), h);
		group.update({ canFormat: true, editable: true, text: readTextFormatState(element) });
		expect(button(group.el, 'bold').getAttribute('aria-pressed')).toBe('true');
		expect(button(group.el, 'italic').getAttribute('aria-pressed')).toBe('false');
		group.update({ canFormat: true, editable: false, text: readTextFormatState(element) });
		expect(button(group.el, 'bold').disabled).toBeTruthy();
		button(group.el, 'bold').click();
		expect(h.toggleBold).not.toHaveBeenCalled();
	});
});
