<script setup lang="ts">
/**
 * CommentMentionTextarea: a plain-text `<textarea>` with an `@`-mention
 * typeahead layered on top (`useCommentMentionInput`), shared by the
 * new-comment composer and a reply box in `CommentsPanel.vue`.
 *
 * `v-model` carries the draft text; `mentions` is a second, parallel
 * `v-model`-style prop (`update:mentions`) so the host can pass BOTH straight
 * through to `useComments().addComment` / `replyToComment` on submit,
 * matching the shape `PptxComment.mentions` is stored in.
 */
import type { PptxCommentMention, PptxModernCommentAuthor } from 'pptx-viewer-core';
import { nextTick, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { useCommentMentionInput } from '../composables/useCommentMentionInput';

const props = withDefaults(
	defineProps<{
		modelValue: string;
		mentions: PptxCommentMention[];
		authors: PptxModernCommentAuthor[];
		placeholder?: string;
		ariaLabel?: string;
		rows?: number;
		textareaClass?: string;
	}>(),
	{ placeholder: '', ariaLabel: '', rows: 3, textareaClass: '' },
);

const emit = defineEmits<{
	'update:modelValue': [string];
	'update:mentions': [PptxCommentMention[]];
}>();

const { t } = useI18n();
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const mention = useCommentMentionInput({ authors: () => props.authors });

/** The caret a native textarea reports; `0` for the rare engine that omits it. */
function caretOf(el: HTMLTextAreaElement): number {
	return el.selectionStart ?? el.value.length;
}

function onInput(event: Event): void {
	const el = event.target as HTMLTextAreaElement;
	emit('update:modelValue', el.value);
	mention.sync(el.value, caretOf(el));
}

/** Re-sync on any caret move that is not itself a text change (click, arrow keys). */
function onCaretMove(event: Event): void {
	const el = event.target as HTMLTextAreaElement;
	mention.sync(el.value, caretOf(el));
}

function applyAccept(author?: PptxModernCommentAuthor): void {
	const result = mention.accept(props.modelValue, props.mentions, author);
	if (!result) {
		return;
	}
	emit('update:modelValue', result.text);
	emit('update:mentions', result.mentions);
	void nextTick(() => {
		textareaRef.value?.setSelectionRange(result.caret, result.caret);
		textareaRef.value?.focus();
	});
}

function onKeydown(event: KeyboardEvent): void {
	if (!mention.isOpen.value) {
		return;
	}
	if (event.key === 'ArrowDown') {
		event.preventDefault();
		mention.moveActive(1);
	} else if (event.key === 'ArrowUp') {
		event.preventDefault();
		mention.moveActive(-1);
	} else if (event.key === 'Enter' || event.key === 'Tab') {
		event.preventDefault();
		applyAccept();
	} else if (event.key === 'Escape') {
		event.preventDefault();
		mention.close();
	}
}
</script>

<template>
	<div class="pptx-comment-mention-input relative">
		<textarea
			ref="textareaRef"
			:value="modelValue"
			:class="textareaClass"
			:rows="rows"
			:placeholder="placeholder"
			:aria-label="ariaLabel"
			@input="onInput"
			@click="onCaretMove"
			@keyup="onCaretMove"
			@keydown="onKeydown"
			@blur="mention.close()"
		></textarea>
		<ul
			v-if="mention.isOpen.value"
			data-testid="pptx-comment-mention-suggestions"
			role="listbox"
			:aria-label="t('pptx.comments.mentionSuggestions')"
			class="pptx-comment-mention-suggestions absolute z-10 mt-0.5 max-h-40 w-56 overflow-y-auto rounded-md border border-border bg-popover py-1 text-xs shadow-lg"
		>
			<li
				v-for="(author, index) in mention.suggestions.value"
				:key="author.id"
				role="option"
				:aria-selected="index === mention.activeIndex.value"
				data-testid="pptx-comment-mention-option"
				class="cursor-pointer px-2 py-1"
				:class="index === mention.activeIndex.value ? 'bg-primary/15 text-primary' : ''"
				@mousedown.prevent="applyAccept(author)"
			>
				{{ author.name }}
			</li>
		</ul>
	</div>
</template>
