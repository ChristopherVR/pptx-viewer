import type { PptxComment } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { appendCommentMarkers } from './comment-markers';

const canvasSize = { width: 960, height: 540 };

describe('appendCommentMarkers', () => {
	it('appends numbered, titled dots inside the stage and routes clicks', () => {
		const stage = document.createElement('div');
		const onClick = vi.fn();
		const comments: PptxComment[] = [
			{ id: 'c1', text: 'Fix the chart', author: 'Alice' },
			{ id: 'c2', text: 'Second note' },
		];
		appendCommentMarkers(document, stage, comments, canvasSize, createTranslator(), onClick);

		const dots = stage.querySelectorAll<HTMLButtonElement>('button.pptxv-comment-marker');
		expect(dots).toHaveLength(2);
		expect(dots[0].title).toBe('Alice: Fix the chart');
		// Missing author falls back to the localized "Unknown".
		expect(dots[1].title).toBe('Unknown: Second note');
		expect(dots[0].textContent).toBe('1');
		expect(dots[1].textContent).toBe('2');
		dots[0].click();
		expect(onClick).toHaveBeenCalledWith('c1');
	});

	it('appends nothing for an empty comment list', () => {
		const stage = document.createElement('div');
		appendCommentMarkers(document, stage, [], canvasSize, createTranslator());
		expect(stage.querySelector('.pptxv-comment-markers')).toBeNull();
	});
});
