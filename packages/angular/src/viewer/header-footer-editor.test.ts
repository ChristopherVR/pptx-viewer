import { describe, expect, it } from 'vitest';

import { EditorStateService } from './editor-state.service';

describe('header and footer editor state', () => {
	it('records document metadata changes in undo history and marks dirty', () => {
		const editor = new EditorStateService();
		editor.setSlides([], [], { hasFooter: false });

		editor.updateHeaderFooter({
			hasFooter: true,
			footerText: 'Confidential',
			hasSlideNumber: true,
		});

		expect(editor.headerFooter()).toStrictEqual({
			hasFooter: true,
			footerText: 'Confidential',
			hasSlideNumber: true,
		});
		expect(editor.dirty()).toBeTruthy();
		expect(editor.canUndo()).toBeTruthy();

		editor.undo();
		expect(editor.headerFooter()).toStrictEqual({ hasFooter: false });
		editor.redo();
		expect(editor.headerFooter().footerText).toBe('Confidential');
	});
});
