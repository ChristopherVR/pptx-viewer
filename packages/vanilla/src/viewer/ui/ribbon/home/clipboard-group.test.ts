import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../../i18n';
import { createClipboardGroup } from './clipboard-group';

function handlers() {
	return {
		copy: vi.fn(),
		cut: vi.fn(),
		paste: vi.fn(),
		duplicate: vi.fn(),
		delete: vi.fn(),
		toggleFormatPainter: vi.fn(),
	};
}

describe('createClipboardGroup', () => {
	it('dispatches each handler from its button', () => {
		const h = handlers();
		const t = createTranslator();
		const group = createClipboardGroup(document, t, h);
		const [paste, cut, copy, painter, duplicate, del] =
			group.el.querySelectorAll<HTMLButtonElement>('button');

		paste.click();
		cut.click();
		copy.click();
		painter.click();
		duplicate.click();
		del.click();

		expect(h.paste).toHaveBeenCalledOnce();
		expect(h.cut).toHaveBeenCalledOnce();
		expect(h.copy).toHaveBeenCalledOnce();
		expect(h.toggleFormatPainter).toHaveBeenCalledOnce();
		expect(h.duplicate).toHaveBeenCalledOnce();
		expect(h.delete).toHaveBeenCalledOnce();
	});

	it('gates paste on hasClipboard, others on hasSelection/editable', () => {
		const t = createTranslator();
		const group = createClipboardGroup(document, t, handlers());
		const [paste, cut, copy, painter, duplicate, del] =
			group.el.querySelectorAll<HTMLButtonElement>('button');

		group.update({
			hasSelection: false,
			hasClipboard: false,
			editable: true,
			formatPainterActive: false,
		});
		expect(paste.disabled).toBeTruthy();
		expect(cut.disabled).toBeTruthy();
		expect(copy.disabled).toBeTruthy();
		expect(painter.disabled).toBeTruthy();
		expect(duplicate.disabled).toBeTruthy();
		expect(del.disabled).toBeTruthy();

		group.update({
			hasSelection: true,
			hasClipboard: true,
			editable: true,
			formatPainterActive: false,
		});
		expect(paste.disabled).toBeFalsy();
		expect(cut.disabled).toBeFalsy();
		expect(copy.disabled).toBeFalsy();
		expect(painter.disabled).toBeFalsy();
		expect(duplicate.disabled).toBeFalsy();
		expect(del.disabled).toBeFalsy();

		// Copy stays enabled with a selection even when not editable (read-only copy is fine).
		group.update({
			hasSelection: true,
			hasClipboard: true,
			editable: false,
			formatPainterActive: false,
		});
		expect(copy.disabled).toBeFalsy();
		expect(cut.disabled).toBeTruthy();
		expect(paste.disabled).toBeTruthy();
	});
});
