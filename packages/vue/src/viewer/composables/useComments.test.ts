// oxlint-disable react-hooks/rules-of-hooks
import type { PptxComment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import { generateCommentId, useComments } from './useComments';

function comment(overrides: Partial<PptxComment> = {}): PptxComment {
	return {
		id: 'c1',
		text: 'Existing comment',
		author: 'Alice',
		createdAt: '2024-06-01T10:00:00Z',
		resolved: false,
		...overrides,
	};
}

describe('generateCommentId', () => {
	it('produces unique, prefixed ids', () => {
		const a = generateCommentId();
		const b = generateCommentId();
		expect(a).toMatch(/^comment-/u);
		expect(a).not.toBe(b);
	});
});

describe('useComments', () => {
	it('exposes the active slide comments via slideComments', () => {
		const comments = ref<PptxComment[]>([comment(), comment({ id: 'c2' })]);
		const { slideComments } = useComments({
			comments,
			activeSlideIndex: ref(0),
			authorName: ref('Bob'),
		});
		expect(slideComments.value).toHaveLength(2);
		expect(slideComments.value[0]?.id).toBe('c1');
	});

	it('reacts when the underlying comments ref changes', () => {
		const comments = ref<PptxComment[]>([]);
		const { slideComments } = useComments({
			comments,
			activeSlideIndex: ref(0),
			authorName: ref('Bob'),
		});
		expect(slideComments.value).toHaveLength(0);
		comments.value = [comment()];
		expect(slideComments.value).toHaveLength(1);
	});

	it('addComment returns a new array with a real PptxComment shape', () => {
		const comments = ref<PptxComment[]>([comment()]);
		const { addComment } = useComments({
			comments,
			activeSlideIndex: ref(0),
			authorName: ref('Carol'),
		});

		const next = addComment('A brand new comment', 12, 34);
		expect(next).not.toBeNull();
		expect(next).toHaveLength(2);
		// original array is not mutated
		expect(comments.value).toHaveLength(1);

		const created = next?.[1];
		expect(created?.text).toBe('A brand new comment');
		expect(created?.author).toBe('Carol');
		expect(created?.resolved).toBeFalsy();
		expect(created?.x).toBe(12);
		expect(created?.y).toBe(34);
		expect(created?.id).toMatch(/^comment-/u);
		expect(created?.createdAt).toBeTypeOf('string');
		expect(Number.isNaN(Date.parse(created?.createdAt ?? ''))).toBeFalsy();
	});

	it('addComment trims input and rejects blank text', () => {
		const comments = ref<PptxComment[]>([]);
		const { addComment } = useComments({
			comments,
			activeSlideIndex: ref(0),
			authorName: ref('Carol'),
		});
		expect(addComment('   ')).toBeNull();
		const next = addComment('  hi  ');
		expect(next?.[0]?.text).toBe('hi');
	});

	it('addComment omits x/y when not provided', () => {
		const comments = ref<PptxComment[]>([]);
		const { addComment } = useComments({
			comments,
			activeSlideIndex: ref(0),
			authorName: ref('Carol'),
		});
		const next = addComment('no position');
		expect(next?.[0]).not.toHaveProperty('x');
		expect(next?.[0]).not.toHaveProperty('y');
	});

	it('removeComment drops the matching comment and returns the new array', () => {
		const comments = ref<PptxComment[]>([comment(), comment({ id: 'c2' })]);
		const { removeComment } = useComments({
			comments,
			activeSlideIndex: ref(0),
			authorName: ref('Bob'),
		});
		const next = removeComment('c1');
		expect(next).toHaveLength(1);
		expect(next?.[0]?.id).toBe('c2');
		// no mutation of the source
		expect(comments.value).toHaveLength(2);
	});

	it('removeComment returns null when id is not found', () => {
		const comments = ref<PptxComment[]>([comment()]);
		const { removeComment } = useComments({
			comments,
			activeSlideIndex: ref(0),
			authorName: ref('Bob'),
		});
		expect(removeComment('missing')).toBeNull();
	});

	it('resolveComment toggles the resolved flag', () => {
		const comments = ref<PptxComment[]>([comment({ resolved: false })]);
		const { resolveComment } = useComments({
			comments,
			activeSlideIndex: ref(0),
			authorName: ref('Bob'),
		});
		const next = resolveComment('c1');
		expect(next?.[0]?.resolved).toBeTruthy();
		// toggling again flips it back
		const ref2 = ref<PptxComment[]>(next ?? []);
		const { resolveComment: resolve2 } = useComments({
			comments: ref2,
			activeSlideIndex: ref(0),
			authorName: ref('Bob'),
		});
		expect(resolve2('c1')?.[0]?.resolved).toBeFalsy();
	});

	it('resolveComment returns null when id is not found', () => {
		const comments = ref<PptxComment[]>([comment()]);
		const { resolveComment } = useComments({
			comments,
			activeSlideIndex: ref(0),
			authorName: ref('Bob'),
		});
		expect(resolveComment('missing')).toBeNull();
	});
});
