import type { ParsedTableStyleMap } from 'pptx-viewer-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import type { TableStyleEditorDeps } from './table-style-editor';
import { createTableStyleEditor } from './table-style-editor';

/**
 * W4-E: the table STYLE DEFINITION editor ("Edit style...") lets an author
 * change a `ppt/tableStyles.xml` section's fill/text/borders, and clone /
 * delete a style, entirely through the shared `pptx-viewer-shared`
 * describe/apply pair. Vanilla port of React's `TableStyleEditor.test.tsx`.
 */
const STYLE_ID = '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}';

function styleMap(): ParsedTableStyleMap {
	return {
		[STYLE_ID]: {
			styleId: STYLE_ID,
			styleName: 'Medium Style 2 - Accent 1',
			wholeTblFill: { schemeColor: '', color: '#336699' },
		},
	};
}

function harness(): { deps: TableStyleEditorDeps; getMap: () => ParsedTableStyleMap | undefined } {
	let map: ParsedTableStyleMap | undefined = styleMap();
	const deps: TableStyleEditorDeps = {
		getTableStyleMap: () => map,
		getThemeColorMap: () => undefined,
		onStyleMapChange: vi.fn((next: ParsedTableStyleMap) => {
			map = next;
		}),
		onDeleteStyle: vi.fn(),
		onAssignStyle: vi.fn(),
	};
	return { deps, getMap: () => map };
}

beforeEach(() => {
	document.body.innerHTML = '';
	// happy-dom does not implement window.prompt/confirm; stub them first so
	// vi.spyOn has an existing function to wrap.
	window.prompt = () => null;
	window.confirm = () => false;
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('createTableStyleEditor', () => {
	it('opens the panel and shows all 14 parts when a style is assigned', () => {
		const { deps } = harness();
		const editor = createTableStyleEditor(document, createTranslator(), deps);
		document.body.appendChild(editor.el);
		editor.update(STYLE_ID, true);

		const button = editor.el.querySelector('.pptxv-tse-btn') as HTMLButtonElement;
		button.click();

		const partButtons = editor.el.querySelectorAll('.pptxv-tse-parts button');
		expect(partButtons).toHaveLength(14);
		expect((editor.el.querySelector('.pptxv-tse-empty') as HTMLElement).hidden).toBeTruthy();
	});

	it('edits the fill colour of the selected part', () => {
		const { deps, getMap } = harness();
		const editor = createTableStyleEditor(document, createTranslator(), deps);
		document.body.appendChild(editor.el);
		editor.update(STYLE_ID, true);
		(editor.el.querySelector('.pptxv-tse-btn') as HTMLButtonElement).click();

		const fillInput = editor.el.querySelector(
			'.pptxv-tsef input[type="color"]',
		) as HTMLInputElement;
		fillInput.value = '#ff0000';
		fillInput.dispatchEvent(new Event('input', { bubbles: true }));

		expect(getMap()?.[STYLE_ID].wholeTblFill).toStrictEqual({ schemeColor: '', color: '#ff0000' });
	});

	it('creates a new style from the current one, based on a prompt', () => {
		const { deps, getMap } = harness();
		vi.spyOn(window, 'prompt').mockReturnValue('My Custom Style');
		const editor = createTableStyleEditor(document, createTranslator(), deps);
		document.body.appendChild(editor.el);
		editor.update(STYLE_ID, true);
		(editor.el.querySelector('.pptxv-tse-btn') as HTMLButtonElement).click();

		const newBtn = Array.from(editor.el.querySelectorAll('.pptxv-tse-actions button')).find((b) =>
			b.textContent?.includes('New style from current'),
		) as HTMLButtonElement;
		newBtn.click();

		const ids = Object.keys(getMap() ?? {});
		expect(ids).toHaveLength(2);
		const newId = ids.find((id) => id !== STYLE_ID) as string;
		expect(getMap()?.[newId].styleName).toBe('My Custom Style');
		expect(deps.onAssignStyle).toHaveBeenCalledWith(newId);
	});

	it('deletes the style after confirmation', () => {
		const { deps, getMap } = harness();
		vi.spyOn(window, 'confirm').mockReturnValue(true);
		const editor = createTableStyleEditor(document, createTranslator(), deps);
		document.body.appendChild(editor.el);
		editor.update(STYLE_ID, true);
		(editor.el.querySelector('.pptxv-tse-btn') as HTMLButtonElement).click();

		const deleteBtn = Array.from(editor.el.querySelectorAll('.pptxv-tse-actions button')).find(
			(b) => b.textContent?.includes('Delete style'),
		) as HTMLButtonElement;
		deleteBtn.click();

		expect(deps.onDeleteStyle).toHaveBeenCalledWith(STYLE_ID);
		expect(Object.keys(getMap() ?? {})).toHaveLength(0);
	});

	it('enables the button with no style assigned, and creates+assigns a brand-new style', () => {
		const map: ParsedTableStyleMap = {};
		let assigned: string | undefined;
		const deps: TableStyleEditorDeps = {
			getTableStyleMap: () => map,
			getThemeColorMap: () => undefined,
			onStyleMapChange: vi.fn((next: ParsedTableStyleMap) => {
				Object.assign(map, next);
			}),
			onDeleteStyle: vi.fn(),
			onAssignStyle: vi.fn((id: string) => (assigned = id)),
		};
		vi.spyOn(window, 'prompt').mockReturnValue('Brand New Style');
		const editor = createTableStyleEditor(document, createTranslator(), deps);
		document.body.appendChild(editor.el);
		editor.update(undefined, true);

		const button = editor.el.querySelector('.pptxv-tse-btn') as HTMLButtonElement;
		expect(button.disabled).toBeFalsy();
		button.click();

		expect((editor.el.querySelector('.pptxv-tse-empty') as HTMLElement).hidden).toBeFalsy();
		const createBtn = Array.from(editor.el.querySelectorAll('.pptxv-tse-actions button')).find(
			(b) => b.textContent?.includes('Create new style'),
		) as HTMLButtonElement;
		expect(createBtn).toBeTruthy();
		createBtn.click();

		const ids = Object.keys(map);
		expect(ids).toHaveLength(1);
		expect(map[ids[0]].styleName).toBe('Brand New Style');
		expect(assigned).toBe(ids[0]);
	});

	it('disables the button when canEdit is false', () => {
		const { deps } = harness();
		const editor = createTableStyleEditor(document, createTranslator(), deps);
		editor.update(STYLE_ID, false);
		expect((editor.el.querySelector('.pptxv-tse-btn') as HTMLButtonElement).disabled).toBeTruthy();
	});
});
