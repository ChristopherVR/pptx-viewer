import { SHAPE_PRESET_DEFS } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../../i18n';
import { createInsertTab } from './insert-tab';

describe('createInsertTab', () => {
	it('renders text box, table, image, and one button per shape preset', () => {
		const t = createTranslator();
		const tab = createInsertTab(document, t, { insert: vi.fn(), insertImage: vi.fn() });
		const buttons = tab.el.querySelectorAll('button');
		// text box + table + image + the full shape grid.
		expect(buttons).toHaveLength(3 + SHAPE_PRESET_DEFS.length);
	});

	it('dispatches insert("text") / insert("table") for the fixed buttons', () => {
		const insert = vi.fn();
		const t = createTranslator();
		const tab = createInsertTab(document, t, { insert, insertImage: vi.fn() });
		const [textBox, table] = tab.el.querySelectorAll<HTMLButtonElement>('button');
		textBox.click();
		table.click();
		expect(insert).toHaveBeenCalledWith('text');
		expect(insert).toHaveBeenCalledWith('table');
	});

	it('dispatches insert("shape", type) for each shape grid button', () => {
		const insert = vi.fn();
		const t = createTranslator();
		const tab = createInsertTab(document, t, { insert, insertImage: vi.fn() });
		const shapeButtons = tab.el.querySelectorAll<HTMLButtonElement>('.pptxv-shape-grid button');
		expect(shapeButtons).toHaveLength(SHAPE_PRESET_DEFS.length);
		shapeButtons[0].click();
		expect(insert).toHaveBeenCalledWith('shape', SHAPE_PRESET_DEFS[0].type);
	});

	it('calls insertImage() for the image button', () => {
		const insertImage = vi.fn();
		const t = createTranslator();
		const tab = createInsertTab(document, t, { insert: vi.fn(), insertImage });
		const image = tab.el.querySelectorAll<HTMLButtonElement>('button')[2];
		image.click();
		expect(insertImage).toHaveBeenCalledOnce();
	});

	it('setEditable disables/enables every button', () => {
		const t = createTranslator();
		const tab = createInsertTab(document, t, { insert: vi.fn(), insertImage: vi.fn() });
		tab.setEditable(false);
		const buttons = tab.el.querySelectorAll<HTMLButtonElement>('button');
		expect(Array.from(buttons).every((b) => b.disabled)).toBeTruthy();

		tab.setEditable(true);
		expect(Array.from(buttons).every((b) => !b.disabled)).toBeTruthy();
	});
});
