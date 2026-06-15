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
	<aside class="pptx-comments-panel" aria-label="Slide comments">
		<header class="pptx-comments-panel__header">
			<h2 class="pptx-comments-panel__title">Comments</h2>
			<span class="pptx-comments-panel__count" data-testid="comment-count">
				{{ props.comments.length }}
			</span>
		</header>

		<ul v-if="props.comments.length > 0" class="pptx-comments-panel__list">
			<li
				v-for="comment in props.comments"
				:key="comment.id"
				class="pptx-comments-panel__item"
				:class="{ 'pptx-comments-panel__item--resolved': comment.resolved }"
				:data-comment-id="comment.id"
			>
				<div class="pptx-comments-panel__meta">
					<span class="pptx-comments-panel__author">{{ comment.author || 'Unknown' }}</span>
					<time v-if="formatTimestamp(comment.createdAt)" class="pptx-comments-panel__time">
						{{ formatTimestamp(comment.createdAt) }}
					</time>
				</div>
				<p class="pptx-comments-panel__text">{{ comment.text }}</p>
				<div class="pptx-comments-panel__actions">
					<button
						type="button"
						class="pptx-comments-panel__action"
						:data-comment-id="comment.id"
						:aria-pressed="comment.resolved ? 'true' : 'false'"
						@click="emit('resolve', comment.id)"
					>
						{{ comment.resolved ? 'Reopen' : 'Resolve' }}
					</button>
					<button
						type="button"
						class="pptx-comments-panel__action pptx-comments-panel__action--danger"
						:data-comment-id="comment.id"
						aria-label="Remove comment"
						@click="emit('remove', comment.id)"
					>
						Remove
					</button>
				</div>
			</li>
		</ul>

		<p v-else class="pptx-comments-panel__empty" data-testid="comments-empty">
			No comments on this slide yet.
		</p>

		<form class="pptx-comments-panel__compose" @submit.prevent="submit">
			<label
				class="pptx-comments-panel__compose-label"
				:title="`Commenting as ${props.authorName}`"
			>
				Add comment
			</label>
			<textarea
				v-model="draft"
				class="pptx-comments-panel__textarea"
				rows="3"
				placeholder="Write a comment…"
				aria-label="Add comment"
			></textarea>
			<button
				type="submit"
				class="pptx-comments-panel__submit"
				:disabled="!canAdd"
				data-testid="add-comment"
			>
				Add comment
			</button>
		</form>
	</aside>
</template>

<style scoped>
.pptx-comments-panel {
	display: flex;
	flex-direction: column;
	min-height: 0;
	height: 100%;
	width: 100%;
	background: var(--pptx-card, #111827);
	color: var(--pptx-foreground, #f3f4f6);
	border-left: 1px solid var(--pptx-border, #374151);
	font-family: system-ui, sans-serif;
}

.pptx-comments-panel__header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 12px 16px;
	border-bottom: 1px solid var(--pptx-border, #374151);
}

.pptx-comments-panel__title {
	margin: 0;
	font-size: 14px;
	font-weight: 600;
}

.pptx-comments-panel__count {
	font-size: 12px;
	color: var(--pptx-muted-foreground, #9ca3af);
}

.pptx-comments-panel__list {
	list-style: none;
	margin: 0;
	padding: 8px;
	overflow-y: auto;
	flex: 1 1 auto;
	min-height: 0;
}

.pptx-comments-panel__item {
	padding: 10px 12px;
	border: 1px solid var(--pptx-border, #374151);
	border-radius: 8px;
	margin-bottom: 8px;
}

.pptx-comments-panel__item--resolved {
	opacity: 0.6;
}

.pptx-comments-panel__meta {
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 8px;
	margin-bottom: 4px;
}

.pptx-comments-panel__author {
	font-size: 13px;
	font-weight: 600;
}

.pptx-comments-panel__time {
	font-size: 11px;
	color: var(--pptx-muted-foreground, #9ca3af);
}

.pptx-comments-panel__text {
	margin: 0 0 8px;
	font-size: 13px;
	white-space: pre-wrap;
	word-break: break-word;
}

.pptx-comments-panel__actions {
	display: flex;
	gap: 8px;
}

.pptx-comments-panel__action {
	font-size: 12px;
	padding: 4px 8px;
	border-radius: 6px;
	border: 1px solid var(--pptx-border, #374151);
	background: transparent;
	color: inherit;
	cursor: pointer;
}

.pptx-comments-panel__action--danger {
	color: #f87171;
}

.pptx-comments-panel__empty {
	padding: 16px;
	font-size: 13px;
	color: var(--pptx-muted-foreground, #9ca3af);
	flex: 1 1 auto;
}

.pptx-comments-panel__compose {
	display: flex;
	flex-direction: column;
	gap: 8px;
	padding: 12px 16px;
	border-top: 1px solid var(--pptx-border, #374151);
}

.pptx-comments-panel__compose-label {
	font-size: 12px;
	font-weight: 600;
}

.pptx-comments-panel__textarea {
	resize: vertical;
	width: 100%;
	padding: 8px;
	border-radius: 6px;
	border: 1px solid var(--pptx-border, #374151);
	background: var(--pptx-background, #030712);
	color: inherit;
	font: inherit;
	font-size: 13px;
}

.pptx-comments-panel__submit {
	align-self: flex-end;
	font-size: 13px;
	padding: 6px 14px;
	border-radius: 6px;
	border: none;
	background: var(--pptx-primary, #6366f1);
	color: #fff;
	cursor: pointer;
}

.pptx-comments-panel__submit:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}
</style>
