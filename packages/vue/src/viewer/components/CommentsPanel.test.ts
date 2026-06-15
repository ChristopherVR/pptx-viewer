import { mount } from '@vue/test-utils';
import type { PptxComment } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import CommentsPanel from './CommentsPanel.vue';

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
		expect(wrapper.emitted('add')).toStrictEqual([['hello world']]);
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
});
