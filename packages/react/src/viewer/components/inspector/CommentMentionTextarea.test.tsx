// @vitest-environment happy-dom
import type { PptxCommentMention, PptxModernCommentAuthor } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CommentMentionTextarea } from './CommentMentionTextarea';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

const AUTHORS: PptxModernCommentAuthor[] = [
	{ id: 'author-1', name: 'Alice', initials: 'AL' },
	{ id: 'author-2', name: 'Bob', initials: 'BO' },
];

interface HarnessHandle {
	getText: () => string;
	getMentions: () => PptxCommentMention[];
}

function Harness({
	initialValue,
	initialSelectionStart,
	onReady,
}: {
	initialValue: string;
	initialSelectionStart: number;
	onReady: (handle: HarnessHandle) => void;
}): React.ReactElement {
	const [value, setValue] = React.useState(initialValue);
	const [mentions, setMentions] = React.useState<PptxCommentMention[]>([]);
	const textareaRef = React.useRef<HTMLTextAreaElement>(null);

	React.useEffect(() => {
		const el = textareaRef.current;
		if (el) {
			el.setSelectionRange(initialSelectionStart, initialSelectionStart);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	onReady({ getText: () => value, getMentions: () => mentions });

	return (
		<CommentMentionTextarea
			value={value}
			mentions={mentions}
			authors={AUTHORS}
			onChange={(text, next) => {
				setValue(text);
				setMentions(next);
			}}
		/>
	);
}

function dispatchSelect(textarea: HTMLTextAreaElement, caret: number): void {
	textarea.setSelectionRange(caret, caret);
	textarea.dispatchEvent(new Event('select', { bubbles: true }));
}

describe('commentMentionTextarea (wave-4 B5)', () => {
	it('lists an author matching the typed query, and accepting inserts the mention', () => {
		let handle: HarnessHandle | null = null;
		act(() => {
			root.render(
				<Harness
					initialValue='@al'
					initialSelectionStart={3}
					onReady={(h) => {
						handle = h;
					}}
				/>,
			);
		});

		const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
		act(() => {
			dispatchSelect(textarea, 3);
		});

		const options = container.querySelectorAll('[data-testid="pptx-comment-mention-option"]');
		expect(options).toHaveLength(1);
		expect(options[0].textContent).toBe('Alice');

		act(() => {
			(options[0] as HTMLButtonElement).dispatchEvent(
				new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
			);
		});

		expect(handle!.getText()).toBe('@Alice ');
		const mentions = handle!.getMentions();
		expect(mentions).toHaveLength(1);
		expect(mentions[0].startIndex).toBe(0);
		// `.length` here is `PptxCommentMention.length` (a character-span field),
		// not an array/string length, so `toHaveLength` does not apply.
		// oxlint-disable-next-line vitest/prefer-to-have-length
		expect(mentions[0].length).toBe('@Alice'.length);
		expect(mentions[0].personId).toBe('author-1');
	});

	it('shows no suggestion list when the caret is not inside an @-token', () => {
		let handle: HarnessHandle | null = null;
		act(() => {
			root.render(
				<Harness
					initialValue='hello world'
					initialSelectionStart={5}
					onReady={(h) => {
						handle = h;
					}}
				/>,
			);
		});
		void handle;
		expect(container.querySelector('[data-testid="pptx-comment-mention-suggestions"]')).toBeNull();
	});
});
