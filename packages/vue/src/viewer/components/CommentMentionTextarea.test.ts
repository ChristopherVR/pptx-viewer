import { mount } from '@vue/test-utils';
import type { PptxCommentMention, PptxModernCommentAuthor } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import CommentMentionTextarea from './CommentMentionTextarea.vue';

const AUTHORS: PptxModernCommentAuthor[] = [
	{ id: '{A}', name: 'Alice', initials: 'AL' },
	{ id: '{B}', name: 'Bob', initials: 'BB' },
];

function mountInput(modelValue = '', mentions: PptxCommentMention[] = []) {
	return mount(CommentMentionTextarea, {
		props: { modelValue, mentions, authors: AUTHORS },
	});
}

/**
 * Set the textarea's text AND caret, the way a real keystroke does both at
 * once, THEN feed the emitted `update:modelValue` back in via `setProps` -
 * the round trip a real `v-model="draft"` parent performs on every keystroke
 * (this isolated mount has no such parent, so the component's own
 * `props.modelValue` would otherwise stay stale for the rest of the test).
 */
async function typeAt(
	wrapper: ReturnType<typeof mountInput>,
	text: string,
	caret = text.length,
): Promise<void> {
	const el = wrapper.find('textarea').element as HTMLTextAreaElement;
	el.value = text;
	el.setSelectionRange(caret, caret);
	await wrapper.find('textarea').trigger('input');
	await wrapper.setProps({ modelValue: text });
}

describe('commentMentionTextarea', () => {
	it('shows no suggestion list until an "@" token is typed', async () => {
		const wrapper = mountInput();
		await typeAt(wrapper, 'hello');
		expect(wrapper.find('[data-testid="pptx-comment-mention-suggestions"]').exists()).toBeFalsy();
	});

	it('lists a matching author for "@al" (typing @ to mention someone)', async () => {
		const wrapper = mountInput();
		await typeAt(wrapper, 'hey @al');
		const options = wrapper.findAll('[data-testid="pptx-comment-mention-option"]');
		expect(options).toHaveLength(1);
		expect(options[0].text()).toBe('Alice');
	});

	it('accepting via click inserts "@Alice " and one mention, and emits both updates', async () => {
		const wrapper = mountInput();
		await typeAt(wrapper, 'hey @al');
		await wrapper.find('[data-testid="pptx-comment-mention-option"]').trigger('mousedown');

		const modelEvents = wrapper.emitted('update:modelValue');
		expect(modelEvents?.at(-1)).toStrictEqual(['hey @Alice ']);
		const mentionEvents = wrapper.emitted('update:mentions');
		const mentions = mentionEvents?.at(-1)?.[0] as PptxCommentMention[];
		expect(mentions).toHaveLength(1);
		expect(mentions[0]).toMatchObject({ authorName: 'Alice', personId: '{A}', startIndex: 4 });
	});

	it('accepting via Enter picks the keyboard-highlighted suggestion', async () => {
		const wrapper = mountInput();
		await typeAt(wrapper, 'hey @b');
		await wrapper.find('textarea').trigger('keydown', { key: 'Enter' });
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toStrictEqual(['hey @Bob ']);
	});

	it('escape closes the suggestion list without accepting', async () => {
		const wrapper = mountInput();
		await typeAt(wrapper, 'hey @al');
		expect(wrapper.find('[data-testid="pptx-comment-mention-suggestions"]').exists()).toBeTruthy();
		const emitsBeforeEscape = wrapper.emitted('update:modelValue')?.length ?? 0;
		await wrapper.find('textarea').trigger('keydown', { key: 'Escape' });
		expect(wrapper.find('[data-testid="pptx-comment-mention-suggestions"]').exists()).toBeFalsy();
		// Escape does not accept a suggestion, so it never fires another
		// update:modelValue on top of the one the typing itself produced.
		expect(wrapper.emitted('update:modelValue')?.length ?? 0).toBe(emitsBeforeEscape);
	});
});
