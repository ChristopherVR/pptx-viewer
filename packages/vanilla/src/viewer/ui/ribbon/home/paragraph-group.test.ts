import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../../i18n';
import { createEditingGroup } from './editing-group';
import { createParagraphGroup } from './paragraph-group';

function paragraphHandlers() {
	return {
		toggleBulletList: vi.fn(),
		toggleNumberedList: vi.fn(),
		increaseIndent: vi.fn(),
		decreaseIndent: vi.fn(),
		setTextAlign: vi.fn(),
		setLineSpacing: vi.fn(),
		setTextDirection: vi.fn(),
		setColumnCount: vi.fn(),
	};
}

function trigger(el: HTMLElement, label: string): HTMLButtonElement {
	const match = [...el.querySelectorAll<HTMLButtonElement>('button')].find(
		(item) => item.getAttribute('aria-label') === label,
	);
	if (!match) {
		throw new Error(`missing control: ${label}`);
	}
	return match;
}

const formattable = { canFormat: true, editable: true, text: {} as never };

describe('createParagraphGroup', () => {
	it('offers the Text Direction and Columns menus React puts in this group', () => {
		const t = createTranslator();
		const group = createParagraphGroup(document, t, paragraphHandlers());
		expect(trigger(group.el, t('pptx.paragraph.textDirection'))).toBeTruthy();
		expect(trigger(group.el, t('pptx.paragraph.columns'))).toBeTruthy();
	});

	it('sets a text direction from its menu', () => {
		const t = createTranslator();
		const handlers = paragraphHandlers();
		const group = createParagraphGroup(document, t, handlers);
		const menu = trigger(group.el, t('pptx.paragraph.textDirection')).parentElement;
		menu?.querySelector<HTMLButtonElement>('.pptxv-dropdown-item')?.click();
		expect(handlers.setTextDirection).toHaveBeenCalledWith('horizontal');
	});

	it('sets a column count from its menu', () => {
		const t = createTranslator();
		const handlers = paragraphHandlers();
		const group = createParagraphGroup(document, t, handlers);
		const menu = trigger(group.el, t('pptx.paragraph.columns')).parentElement;
		const items = menu?.querySelectorAll<HTMLButtonElement>('.pptxv-dropdown-item') ?? [];
		expect(items).toHaveLength(3);
		items[1].click();
		expect(handlers.setColumnCount).toHaveBeenCalledWith(2);
	});

	it('gates both menus on something formattable being selected', () => {
		const t = createTranslator();
		const group = createParagraphGroup(document, t, paragraphHandlers());
		group.update({ ...formattable, canFormat: false });
		expect(trigger(group.el, t('pptx.paragraph.columns')).disabled).toBeTruthy();
		group.update(formattable);
		expect(trigger(group.el, t('pptx.paragraph.columns')).disabled).toBeFalsy();
	});
});

describe('createEditingGroup', () => {
	it('offers the Select menu beside Find and Replace', () => {
		const t = createTranslator();
		const group = createEditingGroup(document, t, {
			toggleFindReplace: vi.fn(),
			selectAll: vi.fn(),
		});
		expect(trigger(group.el, t('pptx.editing.find'))).toBeTruthy();
		expect(trigger(group.el, t('pptx.ribbon.replace'))).toBeTruthy();
		expect(trigger(group.el, t('pptx.ribbon.tool.select'))).toBeTruthy();
	});

	it('selects every element from the Select menu', () => {
		const t = createTranslator();
		const selectAll = vi.fn();
		const group = createEditingGroup(document, t, { toggleFindReplace: vi.fn(), selectAll });
		group.update({ editable: true });
		group.el.querySelector<HTMLButtonElement>('.pptxv-dropdown-item')?.click();
		expect(selectAll).toHaveBeenCalledOnce();
	});
});
