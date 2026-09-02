/* oxlint-disable eslint/one-var -- independent per-test locals, not intended as one statement */
import { mount } from '@vue/test-utils';
import type { PptxComment, PptxModernCommentAuthor } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import CommentsPanel from './CommentsPanel.vue';

const AUTHORS: PptxModernCommentAuthor[] = [{ id: '{A}', name: 'Alice', initials: 'AL' }];

function comment(overrides: Partial<PptxComment> = {}): PptxComment {
	return {
		id: 'c1',
		text: 'Looks good to me',
		author: 'Alice',
		createdAt: '2024-06-01T10:00:00Z',
		resolved: false,
		...overrides,
	};
}

function mountPanel(comments: PptxComment[], authorName = 'You') {
	return mount(CommentsPanel, { props: { comments, authorName } });
}

describe('commentsPanel', () => {
	it('renders an empty state when there are no comments', () => {
		const wrapper = mountPanel([]);
		expect(wrapper.find('[data-testid="comments-empty"]').exists()).toBeTruthy();
		expect(wrapper.find('[data-testid="comment-count"]').text()).toBe('0');
	});

	it('lists comments with author and text', () => {
		const wrapper = mountPanel([comment(), comment({ id: 'c2', text: 'Second', author: 'Bob' })]);
		expect(wrapper.find('[data-testid="comment-count"]').text()).toBe('2');
		expect(wrapper.text()).toContain('Looks good to me');
		expect(wrapper.text()).toContain('Alice');
		expect(wrapper.text()).toContain('Second');
		expect(wrapper.text()).toContain('Bob');
	});

	it('emits add with trimmed text when the form is submitted', async () => {
		const wrapper = mountPanel([]);
		await wrapper.find('textarea').setValue('  hello world  ');
		await wrapper.find('form').trigger('submit.prevent');
		expect(wrapper.emitted('add')).toStrictEqual([[{ text: 'hello world', mentions: [] }]]);
		// textarea is cleared after submit
		expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('');
	});

	it('does not emit add for blank text and disables the button', async () => {
		const wrapper = mountPanel([]);
		const submit = wrapper.find('[data-testid="add-comment"]');
		expect(submit.attributes('disabled')).toBeDefined();
		await wrapper.find('textarea').setValue('   ');
		await wrapper.find('form').trigger('submit.prevent');
		expect(wrapper.emitted('add')).toBeUndefined();
	});

	it('emits remove with the comment id', async () => {
		const wrapper = mountPanel([comment()]);
		const removeBtn = wrapper.find('.pptx-comments-panel__action--danger');
		await removeBtn.trigger('click');
		expect(wrapper.emitted('remove')).toStrictEqual([['c1']]);
	});

	it('emits resolve with the comment id', async () => {
		const wrapper = mountPanel([comment()]);
		const resolveBtn = wrapper.find(
			'.pptx-comments-panel__action:not(.pptx-comments-panel__action--danger)',
		);
		expect(resolveBtn.text()).toBe('Resolve');
		await resolveBtn.trigger('click');
		expect(wrapper.emitted('resolve')).toStrictEqual([['c1']]);
	});

	it('shows Reopen and dims resolved comments', () => {
		const wrapper = mountPanel([comment({ resolved: true })]);
		const item = wrapper.find('[data-comment-id="c1"].pptx-comments-panel__item');
		expect(item.classes()).toContain('pptx-comments-panel__item--resolved');
		const resolveBtn = wrapper.find(
			'.pptx-comments-panel__action:not(.pptx-comments-panel__action--danger)',
		);
		expect(resolveBtn.text()).toBe('Reopen');
	});

	it('formats the timestamp via the core helper (non-empty for valid dates)', () => {
		const wrapper = mountPanel([comment()]);
		const time = wrapper.find('time');
		expect(time.exists()).toBeTruthy();
		expect(time.text().length).toBeGreaterThan(0);
	});

	it('threads a mention through the add-comment composer', async () => {
		const wrapper = mount(CommentsPanel, {
			props: { comments: [], authorName: 'You', modernCommentAuthors: AUTHORS },
		});
		const textarea = wrapper.find('textarea').element as HTMLTextAreaElement;
		textarea.value = 'hey @al';
		textarea.setSelectionRange(7, 7);
		await wrapper.find('textarea').trigger('input');
		await wrapper.find('[data-testid="pptx-comment-mention-option"]').trigger('mousedown');
		await wrapper.find('form').trigger('submit.prevent');

		const added = wrapper.emitted('add')?.[0]?.[0] as {
			text: string;
			mentions?: { authorName: string }[];
		};
		expect(added.text).toBe('hey @Alice');
		expect(added.mentions?.[0]?.authorName).toBe('Alice');
	});

	it('threads a mention through a reply composer', async () => {
		const wrapper = mount(CommentsPanel, {
			props: { comments: [comment()], authorName: 'You', modernCommentAuthors: AUTHORS },
		});
		const toggleReply = wrapper
			.findAll('.pptx-comments-panel__action')
			.find((b) => b.text() === 'Reply');
		await toggleReply?.trigger('click');

		// The reply composer's own textarea: it renders inside the comment list,
		// which comes before the bottom add-comment form in DOM order, so it is
		// the FIRST textarea once the reply box is open.
		const textarea = wrapper.findAll('textarea')[0].element as HTMLTextAreaElement;
		textarea.value = 'ping @al';
		textarea.setSelectionRange(8, 8);
		await wrapper.findAll('textarea')[0].trigger('input');

		await wrapper.find('[data-testid="pptx-comment-mention-option"]').trigger('mousedown');
		// The composer's submit button, not the top toggle (both read "Reply";
		// only the submit button lacks the toggle's shared action class).
		const submitReply = wrapper
			.findAll('button')
			.find((b) => b.text() === 'Reply' && !b.classes().includes('pptx-comments-panel__action'));
		await submitReply?.trigger('click');

		const replied = wrapper.emitted('reply')?.[0]?.[0] as {
			text: string;
			mentions?: { authorName: string }[];
		};
		expect(replied.text).toBe('ping @Alice');
		expect(replied.mentions?.[0]?.authorName).toBe('Alice');
	});

	it('renders its own header by default, but suppresses it when embedded', () => {
		const standalone = mountPanel([]);
		expect(standalone.find('.pptx-comments-panel__header').exists()).toBeTruthy();

		const embedded = mount(CommentsPanel, {
			props: { comments: [], authorName: 'You', embedded: true },
		});
		expect(embedded.find('.pptx-comments-panel__header').exists()).toBeFalsy();
		// The rest of the panel (compose form) still renders.
		expect(embedded.find('[data-testid="add-comment"]').exists()).toBeTruthy();
	});
});
