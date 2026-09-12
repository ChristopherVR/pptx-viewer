import type { PptxElement } from 'pptx-viewer-core';
import { buildParagraphs } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { readTextFormatState } from '../../../editor/editor-format-mutations';
import { toggleListType } from '../../../editor/editor-paragraph-mutations';
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
	it('reads loaded bullets and updates real markers and pressed state on clicks', () => {
		let element = {
			type: 'text',
			id: 't',
			x: 0,
			y: 0,
			width: 100,
			height: 50,
			text: 'Body',
			textSegments: [
				{ text: '» ', style: {}, bulletInfo: { char: '»' } },
				{ text: 'Body', style: {} },
			],
		} as PptxElement;
		const t = createTranslator();
		const group = createParagraphGroup(document, t, {
			...paragraphHandlers(),
			toggleBulletList: () => {
				element = { ...element, ...toggleListType(element, 'bullet') } as PptxElement;
				group.update({ ...formattable, text: readTextFormatState(element) });
			},
		});
		group.update({ ...formattable, text: readTextFormatState(element) });
		const button = trigger(group.el, t('pptx.text.bulletList'));
		expect(button.getAttribute('aria-pressed')).toBe('true');
		button.click();
		expect(button.getAttribute('aria-pressed')).toBe('false');
		expect(buildParagraphs(element)[0].bulletMarker).toBeUndefined();
		button.click();
		expect(button.getAttribute('aria-pressed')).toBe('true');
		expect(buildParagraphs(element)[0].bulletMarker).toBe('»');
		expect(
			buildParagraphs(element)[0]
				.runs.map((run) => run.text)
				.join(''),
		).toBe('Body');
		group.update({ ...formattable, editable: false, text: readTextFormatState(element) });
		expect(button.disabled).toBeTruthy();
	});

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
		trigger(group.el, t('pptx.ribbon.tool.select')).click();
		selectAllItem(group.el, t('pptx.editing.selectAll')).click();
		expect(selectAll).toHaveBeenCalledOnce();
	});

	it('names the Select All command itself, as a button like the other bindings', () => {
		const t = createTranslator();
		const group = createEditingGroup(document, t, {
			toggleFindReplace: vi.fn(),
			selectAll: vi.fn(),
		});
		const item = selectAllItem(group.el, t('pptx.editing.selectAll'));
		// It used to be a `role="option"` inside a listbox, so the one command in
		// the menu could not be reached by role+name the way React's, Vue's and
		// Angular's can - which is why the cross-binding effects spec skipped this
		// binding outright.
		expect(item.tagName).toBe('BUTTON');
		expect(item.getAttribute('role')).toBeNull();
		// Hidden until the trigger opens it, so it stays out of the tab inventory.
		expect(item.closest('[hidden]')).not.toBeNull();
	});
});

/** The "Select All" command inside the Select menu, by its visible label. */
function selectAllItem(root: HTMLElement, label: string): HTMLButtonElement {
	const item = [...root.querySelectorAll<HTMLButtonElement>('button')].find(
		(node) => node.textContent?.trim() === label,
	);
	if (!item) {
		throw new Error(`no "${label}" command in the Select menu`);
	}
	return item;
}
