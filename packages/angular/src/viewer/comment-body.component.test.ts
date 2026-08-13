/**
 * comment-body.component.test.ts: the `@`-mention runs this binding renders.
 *
 * No Angular TestBed in this package (see `action-settings-panel.component.test.ts`),
 * so the template's only decision is asserted through `commentBodySegments`,
 * and the template WIRING is asserted against the real template sources: the
 * comment panel silently dropping `<pptx-comment-body>` is exactly the kind of
 * drift a per-binding unit suite otherwise misses.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PptxCommentMention } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { CommentBodyComponent, commentBodySegments } from './comment-body.component';

const HERE = dirname(fileURLToPath(import.meta.url));

const BOB = '{2CB2E9D0-D392-EB21-5D46-FBA34C1295E6}';

const mentions: PptxCommentMention[] = [
	{ personId: BOB, authorName: 'Bob Example', startIndex: 3, length: 11 },
];

describe('commentBodySegments', () => {
	it('splits a body into text and mention runs', () => {
		expect(commentBodySegments('Hi Bob Example can you check this', mentions)).toStrictEqual([
			{ kind: 'text', text: 'Hi ' },
			{ kind: 'mention', text: 'Bob Example', authorName: 'Bob Example', personId: BOB },
			{ kind: 'text', text: ' can you check this' },
		]);
	});

	it('leaves a body with no mentions as one text run', () => {
		expect(commentBodySegments('Nothing to see', undefined)).toStrictEqual([
			{ kind: 'text', text: 'Nothing to see' },
		]);
	});
});

describe('commentBody template', () => {
	const template = String(
		(CommentBodyComponent as unknown as { ɵcmp?: { template?: unknown } }).ɵcmp?.template ?? '',
	);

	it('stamps the neutral e2e attribute on a mention run', () => {
		// The decorator metadata is erased by the JIT compiler in this environment,
		// so read the source instead of the compiled definition.
		const source = readFileSync(join(HERE, 'comment-body.component.ts'), 'utf-8');
		expect(source).toContain('[attr.data-pptx-comment-mention]');
		expect(source).toContain('class="pptx-comment-mention"');
		expect(template).toBeDefined();
	});

	it('is wired into both the comment and the reply in the panel template', () => {
		const html = readFileSync(join(HERE, 'comments-panel.component.html'), 'utf-8');
		expect(html).toContain(
			'<pptx-comment-body [text]="comment.text" [mentions]="comment.mentions"',
		);
		expect(html).toContain(
			'<pptx-comment-body [text]="replyItem.text" [mentions]="replyItem.mentions"',
		);
		const panel = readFileSync(join(HERE, 'comments-panel.component.ts'), 'utf-8');
		expect(panel).toContain('CommentBodyComponent');
	});
});
