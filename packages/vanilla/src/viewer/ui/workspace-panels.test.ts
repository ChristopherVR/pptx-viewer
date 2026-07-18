import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { openCommentsPanel } from './comments-panel';
import { openCustomShowsDialog } from './custom-shows-dialog';
import { openHyperlinkEditDialog } from './hyperlink-edit-dialog';
import { openSelectionPane } from './selection-pane';
import { openSlideSorterOverlay } from './slide-sorter-overlay';

afterEach(() => document.body.replaceChildren());
const element = {
	id: 'shape',
	type: 'shape',
	x: 0,
	y: 0,
	width: 10,
	height: 10,
	text: 'Agenda',
} as PptxElement;
const slide = { id: 'slide', rId: 'rId1', slideNumber: 1, elements: [element] } as PptxSlide;

describe('workspace parity panels', () => {
	it('selects and hides objects from the selection pane', () => {
		const onSelect = vi.fn();
		const onToggleHidden = vi.fn();
		openSelectionPane(document, document.body, createTranslator(), {
			elements: [element],
			selectedIds: [],
			onSelect,
			onToggleHidden,
			onReorder: vi.fn(),
		});
		const buttons = document.querySelectorAll<HTMLButtonElement>('.pptxv-selection-row button');
		buttons[0].click();
		buttons[1].click();
		expect(onSelect).toHaveBeenCalledWith('shape');
		expect(onToggleHidden).toHaveBeenCalledWith('shape');
	});

	it('dispatches sorter and comment actions', () => {
		const onDuplicate = vi.fn();
		openSlideSorterOverlay(document, document.body, createTranslator(), {
			slides: [slide],
			current: 0,
			onSelect: vi.fn(),
			onReorder: vi.fn(),
			onDelete: vi.fn(),
			onDuplicate,
			onToggleHidden: vi.fn(),
		});
		Array.from(document.querySelectorAll('button'))
			.find((button) => button.textContent === 'Duplicate')!
			.click();
		expect(onDuplicate).toHaveBeenCalledWith(0);
		document.body.replaceChildren();
		const addComment = vi.fn(() => 'comment');
		openCommentsPanel(document, document.body, createTranslator(), [], {
			addComment,
			addCommentReply: vi.fn(),
			editComment: vi.fn(),
			deleteComment: vi.fn(),
			toggleCommentResolved: vi.fn(),
		});
		const draft = document.querySelector('textarea')!;
		draft.value = 'Review this';
		Array.from(document.querySelectorAll('button'))
			.find((button) => button.textContent === 'Add Comment')!
			.click();
		expect(addComment).toHaveBeenCalledWith('Review this');
	});

	it('creates custom shows and applies safe hyperlinks', () => {
		const onSave = vi.fn();
		openCustomShowsDialog(document, createTranslator(), [], [slide], onSave, vi.fn());
		Array.from(document.querySelectorAll('button'))
			.find((button) => button.textContent === 'Create New Show')!
			.click();
		Array.from(document.querySelectorAll('button'))
			.find((button) => button.textContent === 'OK')!
			.click();
		expect(onSave.mock.calls[0][0]).toHaveLength(1);
		document.body.replaceChildren();
		const onApply = vi.fn();
		openHyperlinkEditDialog(document, createTranslator(), element, onApply);
		const inputs = document.querySelectorAll<HTMLInputElement>('input');
		inputs[0].value = 'https://example.com';
		inputs[1].value = 'Example';
		Array.from(document.querySelectorAll('button'))
			.find((button) => button.textContent === 'Apply')!
			.click();
		expect(onApply).toHaveBeenCalledWith(
			expect.objectContaining({
				actionClick: expect.objectContaining({ url: 'https://example.com' }),
			}),
		);
	});
});
