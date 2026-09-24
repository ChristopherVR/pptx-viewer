import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { handleInlineFormatShortcut } from './inline-text-editor-shortcuts';
import type { InlineFormatCallbacks } from './inline-text-editor-shortcuts';

/** A minimal text element, enough for the mutation helpers this module calls. */
const TEXT_ELEMENT: PptxElement = {
	id: 'e1',
	type: 'text',
	x: 0,
	y: 0,
	width: 100,
	height: 50,
	rotation: 0,
	textStyle: { bold: false, italic: false, underline: false, fontSize: 24 },
} as PptxElement;

function callbacks(over: Partial<InlineFormatCallbacks> = {}): InlineFormatCallbacks {
	return {
		onformat: vi.fn(),
		oncopyformat: vi.fn(),
		onpasteformat: vi.fn(),
		onhyperlink: vi.fn(),
		onfind: vi.fn(),
		onfindreplace: vi.fn(),
		...over,
	};
}

describe('handleInlineFormatShortcut', () => {
	it('toggles bold/italic/underline via mapInlineTextFormatKey', () => {
		const deps = callbacks();
		expect(
			handleInlineFormatShortcut({ key: 'b', ctrlKey: true }, TEXT_ELEMENT, deps),
		).toBeTruthy();
		expect(deps.onformat).toHaveBeenCalledWith(
			expect.objectContaining({ textStyle: expect.objectContaining({ bold: true }) }),
		);
	});

	it('dispatches paragraph alignment', () => {
		const deps = callbacks();
		handleInlineFormatShortcut({ key: 'e', ctrlKey: true }, TEXT_ELEMENT, deps);
		expect(deps.onformat).toHaveBeenCalledWith(
			expect.objectContaining({ textStyle: expect.objectContaining({ align: 'center' }) }),
		);
	});

	it('steps the font size along the ladder', () => {
		const deps = callbacks();
		handleInlineFormatShortcut({ key: ']', ctrlKey: true }, TEXT_ELEMENT, deps);
		expect(deps.onformat).toHaveBeenCalledWith(
			expect.objectContaining({
				textStyle: expect.objectContaining({ fontSize: expect.any(Number) }),
			}),
		);
	});

	it('dispatches format painter copy/paste', () => {
		const deps = callbacks();
		expect(
			handleInlineFormatShortcut({ key: 'c', ctrlKey: true, shiftKey: true }, TEXT_ELEMENT, deps),
		).toBeTruthy();
		expect(deps.oncopyformat).toHaveBeenCalledOnce();
		expect(
			handleInlineFormatShortcut({ key: 'v', ctrlKey: true, shiftKey: true }, TEXT_ELEMENT, deps),
		).toBeTruthy();
		expect(deps.onpasteformat).toHaveBeenCalledOnce();
	});

	it('dispatches hyperlink, find, and find & replace', () => {
		const deps = callbacks();
		handleInlineFormatShortcut({ key: 'k', ctrlKey: true }, TEXT_ELEMENT, deps);
		handleInlineFormatShortcut({ key: 'f', ctrlKey: true }, TEXT_ELEMENT, deps);
		handleInlineFormatShortcut({ key: 'h', ctrlKey: true }, TEXT_ELEMENT, deps);
		expect(deps.onhyperlink).toHaveBeenCalledOnce();
		expect(deps.onfind).toHaveBeenCalledOnce();
		expect(deps.onfindreplace).toHaveBeenCalledOnce();
	});

	it('clears character formatting on Ctrl+Space', () => {
		const deps = callbacks();
		expect(
			handleInlineFormatShortcut({ key: ' ', ctrlKey: true }, TEXT_ELEMENT, deps),
		).toBeTruthy();
		expect(deps.onformat).toHaveBeenCalledWith(
			expect.objectContaining({ textStyle: expect.objectContaining({ bold: false }) }),
		);
	});

	it('returns false for a key none of the live-format chords or mapEditorKey claims', () => {
		const deps = callbacks();
		expect(handleInlineFormatShortcut({ key: 'z', ctrlKey: true }, TEXT_ELEMENT, deps)).toBeFalsy();
		expect(deps.onformat).not.toHaveBeenCalled();
	});

	it('returns false for a bare printable key (ordinary typing)', () => {
		const deps = callbacks();
		expect(handleInlineFormatShortcut({ key: 'e' }, TEXT_ELEMENT, deps)).toBeFalsy();
	});
});
