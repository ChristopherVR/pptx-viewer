import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../../../i18n';
import { createClipboardGroup } from './clipboard-group';

function handlers() {
	return {
		copy: vi.fn(),
		cut: vi.fn(),
		paste: vi.fn(),
		toggleFormatPainter: vi.fn(),
	};
}

describe('createClipboardGroup', () => {
	it('dispatches each handler from its button', () => {
		const h = handlers();
		const t = createTranslator();
		const group = createClipboardGroup(document, t, h);
		const [paste, cut, copy, painter] = group.el.querySelectorAll<HTMLButtonElement>('button');

		paste.click();
		cut.click();
		copy.click();
		painter.click();

		expect(h.paste).toHaveBeenCalledOnce();
		expect(h.cut).toHaveBeenCalledOnce();
		expect(h.copy).toHaveBeenCalledOnce();
		expect(h.toggleFormatPainter).toHaveBeenCalledOnce();
	});

	it('gates paste on the clipboard and cut/copy on the selection', () => {
		const t = createTranslator();
		const group = createClipboardGroup(document, t, handlers());
		const [paste, cut, copy, painter] = group.el.querySelectorAll<HTMLButtonElement>('button');

		group.update({
			hasSelection: false,
			hasClipboard: false,
			editable: true,
			formatPainterActive: false,
		});
		expect(paste.disabled).toBeTruthy();
		// Cut and Copy act on the selection, so with nothing selected they are
		// no-ops and must not render live.
		expect(cut.disabled).toBeTruthy();
		expect(copy.disabled).toBeTruthy();
		expect(painter.disabled).toBeTruthy();

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

		// Copy stays enabled even when not editable (read-only copy is fine).
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
