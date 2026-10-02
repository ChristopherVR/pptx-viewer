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
	it('keeps inline focus and selection before pointer list commands', () => {
		const surface = document.createElement('div');
		surface.contentEditable = 'true';
		surface.tabIndex = 0;
		surface.textContent = 'Body';
		const blur = vi.fn();
		surface.addEventListener('blur', blur);
		const handlers = paragraphHandlers();
		const t = createTranslator();
		const group = createParagraphGroup(document, t, handlers);
		group.update(formattable);
		document.body.append(surface, group.el);
		surface.focus();
		const range = document.createRange();
		range.setStart(surface.firstChild!, 2);
		range.collapse(true);
		const selection = window.getSelection()!;
		selection.removeAllRanges();
		selection.addRange(range);
		try {
			for (const label of ['pptx.text.bulletList', 'pptx.text.numberedList']) {
				const button = trigger(group.el, t(label));
				const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
				button.dispatchEvent(down);
				// Model the native focus default which jsdom does not perform.
				if (!down.defaultPrevented) {
					button.focus();
				}
				button.click();
				expect(down.defaultPrevented).toBeTruthy();
				expect(document.activeElement).toBe(surface);
				expect(selection.anchorNode).toBe(surface.firstChild);
				expect(selection.anchorOffset).toBe(2);
			}
			expect(blur).not.toHaveBeenCalled();
			expect(handlers.toggleBulletList).toHaveBeenCalledOnce();
			expect(handlers.toggleNumberedList).toHaveBeenCalledOnce();
		} finally {
			surface.remove();
			group.el.remove();
		}
	});

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

	it('offers the Line Spacing, Text Direction and Columns icon menus on the shared select', () => {
		const group = createParagraphGroup(document, createTranslator(), paragraphHandlers());
		for (const id of ['lineSpacing', 'textDirection', 'columns']) {
			const select = group.el.querySelector(`[data-ribbon-control="home.paragraph.${id}"]`)!;
			expect(select.localName).toBe('pptx-ui-select');
			expect(select.getAttribute('variant')).toBe('ribbon-icon');
		}
	});

	it('maps select changes onto the native handlers', () => {
		const handlers = paragraphHandlers();
		const group = createParagraphGroup(document, createTranslator(), handlers);
		group.update(formattable);
		const pick = (id: string, value: string) => {
			const select = group.el.querySelector<HTMLElement & { value: string }>(
				`[data-ribbon-control="home.paragraph.${id}"]`,
			)!;
			select.value = value;
			select.dispatchEvent(new Event('change', { bubbles: true }));
		};
		pick('lineSpacing', '1.5');
		pick('textDirection', 'vertical');
		pick('columns', '2');
		expect(handlers.setLineSpacing).toHaveBeenCalledExactlyOnceWith(1.5);
		expect(handlers.setTextDirection).toHaveBeenCalledExactlyOnceWith('vertical');
		expect(handlers.setColumnCount).toHaveBeenCalledExactlyOnceWith(2);
	});

	it('gates the menus on something formattable being selected', () => {
		const group = createParagraphGroup(document, createTranslator(), paragraphHandlers());
		const columns = () =>
			group.el.querySelector<HTMLElement & { disabled: boolean }>(
				'[data-ribbon-control="home.paragraph.columns"]',
			)!;
		group.update({ ...formattable, canFormat: false });
		expect(columns().disabled).toBeTruthy();
		group.update(formattable);
		expect(columns().disabled).toBeFalsy();
	});

	it('renders the Bullets and Numbering library galleries beside their toggles', () => {
		const group = createParagraphGroup(document, createTranslator(), paragraphHandlers());
		for (const id of ['bullets', 'numbering']) {
			const slot = group.el.querySelector(`[data-ribbon-control="home.paragraph.${id}"]`)!;
			expect(slot.querySelector('pptx-ui-ribbon-gallery[chevron-only]')).not.toBeNull();
		}
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
		group.update({ editable: true });
		trigger(group.el, t('pptx.ribbon.tool.select')).click();
		const item = selectAllItem(group.el, t('pptx.editing.selectAll'));
		expect(item.getAttribute('role')).toBe('menuitem');
	});

	it('disables the Select menu without edit rights', () => {
		const t = createTranslator();
		const group = createEditingGroup(document, t, {
			toggleFindReplace: vi.fn(),
			selectAll: vi.fn(),
		});
		group.update({ editable: false });
		expect(trigger(group.el, t('pptx.ribbon.tool.select')).disabled).toBeTruthy();
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

describe('shared paragraph and editing strips', () => {
	const control = (root: HTMLElement, id: string) =>
		root.querySelector<HTMLButtonElement>(`[data-ribbon-control="${id}"]`)!;

	it('routes indent and alignment intents and reflects the explicit alignment', () => {
		const handlers = paragraphHandlers();
		const group = createParagraphGroup(document, createTranslator(), handlers);
		const text = readTextFormatState({
			type: 'text',
			id: 'align-test',
			x: 0,
			y: 0,
			width: 100,
			height: 20,
			text: 'Hello',
			textStyle: { align: 'center' },
		});
		group.update({ canFormat: true, editable: true, text });
		control(group.el, 'home.paragraph.alignRight').click();
		control(group.el, 'home.paragraph.increaseIndent').click();
		control(group.el, 'home.paragraph.decreaseIndent').click();
		expect(handlers.setTextAlign).toHaveBeenCalledExactlyOnceWith('right');
		expect(handlers.increaseIndent).toHaveBeenCalledOnce();
		expect(handlers.decreaseIndent).toHaveBeenCalledOnce();
		expect(control(group.el, 'home.paragraph.alignCenter').getAttribute('aria-pressed')).toBe(
			'true',
		);
		group.update({ canFormat: true, editable: false, text });
		control(group.el, 'home.paragraph.alignLeft').click();
		expect(handlers.setTextAlign).toHaveBeenCalledOnce();
	});

	it('opens the find panel from both Find and Replace', () => {
		const toggleFindReplace = vi.fn();
		const group = createEditingGroup(document, createTranslator(), {
			toggleFindReplace,
			selectAll: vi.fn(),
		});
		control(group.el, 'home.editing.find').click();
		control(group.el, 'home.editing.replace').click();
		expect(toggleFindReplace).toHaveBeenCalledTimes(2);
	});
});
