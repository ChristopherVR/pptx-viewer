import type { PptxComment, PptxElement, PptxSlide } from 'pptx-viewer-core';
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
			onRename: vi.fn(),
		});
		const buttons = document.querySelectorAll<HTMLButtonElement>('.pptxv-selection-row button');
		buttons[0].click();
		buttons[1].click();
		expect(onSelect).toHaveBeenCalledWith('shape');
		expect(onToggleHidden).toHaveBeenCalledWith('shape');
	});

	it('prefers an explicit element name for the row label', () => {
		openSelectionPane(document, document.body, createTranslator(), {
			elements: [{ ...element, name: 'Hero Title' } as PptxElement],
			selectedIds: [],
			onSelect: vi.fn(),
			onToggleHidden: vi.fn(),
			onReorder: vi.fn(),
			onRename: vi.fn(),
		});
		expect(document.querySelector('[data-pptx-selection-name]')?.textContent).toBe('Hero Title');
	});

	it('renames from the selection pane: dblclick edits, Enter commits', () => {
		const onRename = vi.fn();
		openSelectionPane(document, document.body, createTranslator(), {
			elements: [element],
			selectedIds: [],
			onSelect: vi.fn(),
			onToggleHidden: vi.fn(),
			onReorder: vi.fn(),
			onRename,
		});
		const pane = document.querySelector<HTMLElement>('[data-pptx-selection-pane]')!;
		const label = pane.querySelector<HTMLButtonElement>('[data-pptx-selection-name]')!;
		expect(label.textContent).toBe('Agenda');
		label.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

		const input = pane.querySelector<HTMLInputElement>('input[type="text"]')!;
		expect(input.getAttribute('aria-label')).toBe('Rename element');
		expect(input.value).toBe('Agenda');
		input.value = 'Agenda Header';
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

		expect(onRename).toHaveBeenCalledWith('shape', 'Agenda Header');
		expect(pane.querySelector('input[type="text"]')).toBeNull();
		expect(label.textContent).toBe('Agenda Header');
	});

	/**
	 * The pane used to be a snapshot of the deck as it stood when it opened, so
	 * undoing a rename put the old name back in the model while the row went on
	 * showing the new one. It now follows a live feed.
	 */
	it('re-renders its rows from the live model, so an undone rename reverts', () => {
		let push: ((model: { elements: PptxElement[]; selectedIds: string[] }) => void) | null = null;
		openSelectionPane(document, document.body, createTranslator(), {
			elements: [{ ...element, name: 'Rectangle 13' } as PptxElement],
			selectedIds: [],
			onSelect: vi.fn(),
			onToggleHidden: vi.fn(),
			onReorder: vi.fn(),
			onRename: vi.fn(),
			subscribe: (listener) => {
				push = listener;
				return () => {
					push = null;
				};
			},
		});
		const pane = document.querySelector<HTMLElement>('[data-pptx-selection-pane]')!;
		const label = (): string | null =>
			pane.querySelector('[data-pptx-selection-name]')?.textContent ?? null;
		expect(label()).toBe('Rectangle 13');

		push!({ elements: [{ ...element, name: 'Renamed' } as PptxElement], selectedIds: [] });
		expect(label()).toBe('Renamed');

		// Undo: the model goes back, and so must the row.
		push!({ elements: [{ ...element, name: 'Rectangle 13' } as PptxElement], selectedIds: [] });
		expect(label()).toBe('Rectangle 13');
	});

	it('releases its store subscription when the pane is closed', () => {
		const unsubscribe = vi.fn();
		openSelectionPane(document, document.body, createTranslator(), {
			elements: [element],
			selectedIds: [],
			onSelect: vi.fn(),
			onToggleHidden: vi.fn(),
			onReorder: vi.fn(),
			onRename: vi.fn(),
			subscribe: () => unsubscribe,
		});
		document.querySelector<HTMLButtonElement>('[data-pptx-selection-pane] header button')!.click();
		expect(unsubscribe).toHaveBeenCalledOnce();
		expect(document.querySelector('[data-pptx-selection-pane]')).toBeNull();
	});

	/**
	 * Committing a rename must hand the keyboard back to the viewer root: this
	 * binding listens for `keydown` there, and focus otherwise falls to
	 * `document.body` when the input is removed, which silently killed the
	 * Ctrl+Z that undoes the rename.
	 */
	it('returns focus to the viewer root when a rename ends', () => {
		const root = document.createElement('div');
		root.setAttribute('tabindex', '0');
		document.body.append(root);
		openSelectionPane(document, root, createTranslator(), {
			elements: [element],
			selectedIds: [],
			onSelect: vi.fn(),
			onToggleHidden: vi.fn(),
			onReorder: vi.fn(),
			onRename: vi.fn(),
		});
		const label = root.querySelector<HTMLButtonElement>('[data-pptx-selection-name]')!;
		label.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		const input = root.querySelector<HTMLInputElement>('input[type="text"]')!;
		expect(document.activeElement).toBe(input);

		input.value = 'Agenda Header';
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

		expect(document.activeElement).toBe(root);
	});

	it('cancels a selection-pane rename with Escape', () => {
		const onRename = vi.fn();
		openSelectionPane(document, document.body, createTranslator(), {
			elements: [element],
			selectedIds: [],
			onSelect: vi.fn(),
			onToggleHidden: vi.fn(),
			onReorder: vi.fn(),
			onRename,
		});
		const pane = document.querySelector<HTMLElement>('[data-pptx-selection-pane]')!;
		const label = pane.querySelector<HTMLButtonElement>('[data-pptx-selection-name]')!;
		label.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
		const input = pane.querySelector<HTMLInputElement>('input[type="text"]')!;
		input.value = 'Discarded';
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

		expect(onRename).not.toHaveBeenCalled();
		expect(pane.querySelector('input[type="text"]')).toBeNull();
		expect(label.textContent).toBe('Agenda');
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
		openCommentsPanel(
			document,
			document.body,
			createTranslator(),
			{ getComments: () => [], subscribe: () => () => undefined },
			{
				addComment,
				addCommentReply: vi.fn(),
				editComment: vi.fn(),
				deleteComment: vi.fn(),
				toggleCommentResolved: vi.fn(),
			},
		);
		const draft = document.querySelector('textarea')!;
		draft.value = 'Review this';
		Array.from(document.querySelectorAll('button'))
			.find((button) => button.textContent === 'Add Comment')!
			.click();
		expect(addComment).toHaveBeenCalledWith('Review this');
		// The pane is LIVE now: it stays open after an add and clears the draft.
		expect(document.querySelector('[data-pptx-comments-panel]')).not.toBeNull();
		expect(draft.value).toBe('');
	});

	it('re-renders the comments pane when the model notifies a change', () => {
		let comments: readonly PptxComment[] = [
			{ id: 'c1', text: 'First pass', author: 'Alice', resolved: false },
		];
		const listeners: Array<() => void> = [];
		openCommentsPanel(
			document,
			document.body,
			createTranslator(),
			{
				getComments: () => comments,
				subscribe: (listener) => {
					listeners.push(listener);
					return () => undefined;
				},
			},
			{
				addComment: vi.fn(() => null),
				addCommentReply: vi.fn(),
				editComment: vi.fn(),
				deleteComment: vi.fn(),
				toggleCommentResolved: vi.fn(),
			},
		);
		// The pane renders the SAME threaded view as the inspector Comments tab
		// (shared `createCommentThreadView`), so it offers a Reply affordance.
		expect(document.querySelectorAll('.pptxv-inspector-comment')).toHaveLength(1);
		expect(document.querySelector('.pptxv-inspector-comment.is-resolved')).toBeNull();
		const replyButton = Array.from(document.querySelectorAll('button')).find(
			(button) => button.textContent === 'Reply',
		);
		expect(replyButton, 'the workspace pane offers a Reply affordance').toBeDefined();
		// A resolve replaces the comment array; the notified pane re-renders.
		comments = [{ id: 'c1', text: 'First pass', author: 'Alice', resolved: true }];
		for (const listener of listeners) {
			listener();
		}
		expect(document.querySelector('.pptxv-inspector-comment.is-resolved')).not.toBeNull();
	});

	it('submits a reply from the workspace comments pane', () => {
		const addCommentReply = vi.fn();
		openCommentsPanel(
			document,
			document.body,
			createTranslator(),
			{
				getComments: () => [{ id: 'c1', text: 'First pass', author: 'Alice', resolved: false }],
				subscribe: () => () => undefined,
			},
			{
				addComment: vi.fn(() => null),
				addCommentReply,
				editComment: vi.fn(),
				deleteComment: vi.fn(),
				toggleCommentResolved: vi.fn(),
			},
		);
		// `pptx.comments.reply` (open the composer) and `pptx.comments.addReply`
		// (submit it) both read "Reply", so the submit is the LAST match, which
		// is also how the neutral e2e helper picks it.
		const replyButtons = (): HTMLButtonElement[] =>
			Array.from(document.querySelectorAll('button')).filter(
				(button) => button.textContent === 'Reply',
			);
		replyButtons()[0].click();
		const replyBox = document.querySelector<HTMLTextAreaElement>(
			'.pptxv-inspector-comment-reply-form textarea',
		)!;
		replyBox.value = 'Looks good';
		replyBox.dispatchEvent(new Event('input'));
		replyButtons().at(-1)!.click();
		expect(addCommentReply).toHaveBeenCalledWith('c1', 'Looks good');
	});

	it('creates custom shows and applies safe hyperlinks', () => {
		const onSave = vi.fn();
		openCustomShowsDialog(document, createTranslator(), {
			shows: [],
			slides: [slide],
			activeShowId: null,
			onSave,
			onSetActive: vi.fn(),
			onRun: vi.fn(),
		});
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
