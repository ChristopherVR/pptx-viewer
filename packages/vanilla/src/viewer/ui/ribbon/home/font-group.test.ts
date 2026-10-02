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

describe('createFontGroup shared pickers and menus', () => {
	const pick = (root: HTMLElement, id: string, value: string) => {
		const select = root.querySelector<HTMLElement & { value: string }>(
			`[data-ribbon-control="home.font.${id}"]`,
		)!;
		select.value = value;
		select.dispatchEvent(new Event('change', { bubbles: true }));
	};

	it('renders the family and size fields on the shared select and routes changes', () => {
		const h = handlers();
		const group = createFontGroup(document, createTranslator(), h);
		group.update({ canFormat: true, editable: true, text: readTextFormatState(element) });
		const family = group.el.querySelector('[data-font-picker="family"]')!;
		expect(family.localName).toBe('pptx-ui-select');
		expect(group.el.querySelector('[data-font-picker="size"]')).not.toBeNull();
		pick(group.el, 'fontSize', '36');
		pick(group.el, 'fontFamily', 'Arial');
		expect(h.setFontSize).toHaveBeenCalledExactlyOnceWith(36);
		expect(h.setFontFamily).toHaveBeenCalledExactlyOnceWith('Arial');
	});

	it('routes character spacing, change case and the colour popovers', () => {
		const h = handlers();
		const group = createFontGroup(document, createTranslator(), h);
		group.update({
			canFormat: true,
			editable: true,
			text: readTextFormatState(element),
			themeColorMap: {
				dk1: '#000000',
				lt1: '#ffffff',
				dk2: '#111111',
				lt2: '#eeeeee',
				accent1: '#4472c4',
			},
			recentColors: ['#123456'],
		});
		pick(group.el, 'characterSpacing', '75');
		expect(h.setCharacterSpacing).toHaveBeenCalledExactlyOnceWith(75);
		const slot = (id: string) =>
			group.el.querySelector<HTMLElement>(`[data-ribbon-control="home.font.${id}"]`)!;
		slot('changeCase').querySelector('button')!.click();
		slot('changeCase').querySelector<HTMLElement>('[data-value="upper"]')!.click();
		expect(h.changeCase).toHaveBeenCalledExactlyOnceWith('upper');
		slot('fontColor').querySelector('button')!.click();
		slot('fontColor').querySelector<HTMLElement>('[data-theme-swatch="accent1"]')!.click();
		expect(h.setTextColor).toHaveBeenCalledExactlyOnceWith('#4472c4', { scheme: 'accent1' });
		slot('highlightColor').querySelector('button')!.click();
		slot('highlightColor').querySelector<HTMLElement>('.std-grid .sw')!.click();
		expect(h.setHighlightColor).toHaveBeenCalledExactlyOnceWith('#ffff00');
	});

	it('gates every control on an editable, formattable selection', () => {
		const group = createFontGroup(document, createTranslator(), handlers());
		group.update({ canFormat: false, editable: true, text: readTextFormatState(element) });
		for (const id of ['fontFamily', 'fontSize', 'characterSpacing']) {
			expect(
				group.el.querySelector<HTMLElement & { disabled: boolean }>(
					`[data-ribbon-control="home.font.${id}"]`,
				)!.disabled,
			).toBeTruthy();
		}
		expect(
			group.el.querySelector<HTMLButtonElement>(
				'[data-ribbon-control="home.font.fontColor"] button',
			)!.disabled,
		).toBeTruthy();
	});

	it('re-translates labels when the chrome is rebuilt for another locale', () => {
		const t = (key: string) => (key === 'pptx.text.changeCase' ? 'Casse' : createTranslator()(key));
		const group = createFontGroup(document, t as never, handlers());
		group.update({ canFormat: true, editable: true, text: readTextFormatState(element) });
		expect(
			group.el.querySelector<HTMLButtonElement>(
				'[data-ribbon-control="home.font.changeCase"] button',
			)!.title,
		).toBe('Casse');
	});
});
