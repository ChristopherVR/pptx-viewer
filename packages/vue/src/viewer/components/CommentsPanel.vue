<script setup lang="ts">
import type { PptxComment } from 'pptx-viewer-core';
import { formatCommentTimestamp } from 'pptx-viewer-core';
import { computed, ref } from 'vue';

/**
 * CommentsPanel — side panel listing the active slide's comments.
 *
 * Presentational only: it renders the supplied `comments` (already filtered to
 * the active slide by the host) and surfaces add / remove / resolve intents via
 * emits. The host owns state and commits history-aware comment-array writes.
 *
 * Timestamps are formatted with the core `formatCommentTimestamp` helper so the
 * Vue binding matches the React/Angular formatting exactly.
 */
const props = defineProps<{
	comments: PptxComment[];
	authorName: string;
}>();

const emit = defineEmits<{
	add: [text: string];
	remove: [id: string];
	resolve: [id: string];
}>();

const draft = ref('');

const canAdd = computed<boolean>(() => draft.value.trim().length > 0);

const submit = (): void => {
	const text = draft.value.trim();
	if (text.length === 0) {
		return;
	}
	emit('add', text);
	draft.value = '';
};

const formatTimestamp = (value: string | undefined): string => formatCommentTimestamp(value);
</script>

<template>
	<aside
		class="pptx-comments-panel flex h-full min-h-0 w-full flex-col border-l border-border bg-card text-foreground"
		aria-label="Slide comments"
	>
		<header
			class="pptx-comments-panel__header flex items-center justify-between border-b border-border px-4 py-3"
		>
			<h2 class="pptx-comments-panel__title m-0 text-sm font-semibold">Comments</h2>
			<span
				class="pptx-comments-panel__count text-xs text-muted-foreground"
				data-testid="comment-count"
			>
				{{ props.comments.length }}
			</span>
		</header>

		<ul
			v-if="props.comments.length > 0"
			class="pptx-comments-panel__list m-0 min-h-0 flex-1 list-none overflow-y-auto p-2"
		>
			<li
				v-for="comment in props.comments"
				:key="comment.id"
				class="pptx-comments-panel__item mb-2 rounded-lg border border-border px-3 py-2.5"
				:class="{ 'pptx-comments-panel__item--resolved opacity-60': comment.resolved }"
				:data-comment-id="comment.id"
			>
				<div class="pptx-comments-panel__meta mb-1 flex items-baseline justify-between gap-2">
					<span class="pptx-comments-panel__author text-[13px] font-semibold">{{
						comment.author || 'Unknown'
					}}</span>
					<time
						v-if="formatTimestamp(comment.createdAt)"
						class="pptx-comments-panel__time text-[11px] text-muted-foreground"
					>
						{{ formatTimestamp(comment.createdAt) }}
					</time>
				</div>
				<p class="pptx-comments-panel__text m-0 mb-2 whitespace-pre-wrap break-words text-[13px]">
					{{ comment.text }}
				</p>
				<div class="pptx-comments-panel__actions flex gap-2">
					<button
						type="button"
						class="pptx-comments-panel__action cursor-pointer rounded-md border border-border bg-transparent px-2 py-1 text-xs text-foreground hover:bg-muted"
						:data-comment-id="comment.id"
						:aria-pressed="comment.resolved ? 'true' : 'false'"
						@click="emit('resolve', comment.id)"
					>
						{{ comment.resolved ? 'Reopen' : 'Resolve' }}
					</button>
					<button
						type="button"
						class="pptx-comments-panel__action pptx-comments-panel__action--danger cursor-pointer rounded-md border border-border bg-transparent px-2 py-1 text-xs text-red-400 hover:bg-muted"
						:data-comment-id="comment.id"
						aria-label="Remove comment"
						@click="emit('remove', comment.id)"
					>
						Remove
					</button>
				</div>
			</li>
		</ul>

		<p
			v-else
			class="pptx-comments-panel__empty flex-1 p-4 text-[13px] text-muted-foreground"
			data-testid="comments-empty"
		>
			No comments on this slide yet.
		</p>

		<form
			class="pptx-comments-panel__compose flex flex-col gap-2 border-t border-border px-4 py-3"
			@submit.prevent="submit"
		>
			<label
				class="pptx-comments-panel__compose-label text-xs font-semibold"
				:title="`Commenting as ${props.authorName}`"
			>
				Add comment
			</label>
			<textarea
				v-model="draft"
				class="pptx-comments-panel__textarea w-full resize-y rounded-md border border-border bg-background p-2 text-[13px] text-foreground"
				rows="3"
				placeholder="Write a comment…"
				aria-label="Add comment"
			></textarea>
			<button
				type="submit"
				class="pptx-comments-panel__submit cursor-pointer self-end rounded-md border-none bg-primary px-3.5 py-1.5 text-[13px] text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
				:disabled="!canAdd"
				data-testid="add-comment"
			>
				Add comment
			</button>
		</form>
	</aside>
</template>
