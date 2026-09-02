<script setup lang="ts">
import type { PptxComment, PptxCommentMention, PptxModernCommentAuthor } from 'pptx-viewer-core';
import { formatCommentTimestamp } from 'pptx-viewer-core';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import CommentBody from './CommentBody.vue';
import CommentMentionTextarea from './CommentMentionTextarea.vue';

/**
 * CommentsPanel: side panel listing the active slide's comments.
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
	/**
	 * True when hosted inside a chrome that already renders its own title +
	 * close button (the mobile `MobileSheet`). Suppresses the internal
	 * `<header>` so mobile doesn't show "Comments" twice stacked.
	 */
	embedded?: boolean;
	/** Modern comment authors (`ppt/commentAuthors.xml`), for the `@`-mention typeahead. */
	modernCommentAuthors?: PptxModernCommentAuthor[];
}>();

const emit = defineEmits<{
	add: [payload: { text: string; mentions?: PptxCommentMention[] }];
	remove: [id: string];
	resolve: [id: string];
	reply: [payload: { parentId: string; text: string; mentions?: PptxCommentMention[] }];
}>();

const { t } = useI18n();

const mentionAuthors = computed(() => props.modernCommentAuthors ?? []);

const draft = ref('');
const draftMentions = ref<PptxCommentMention[]>([]);

// Which comment currently has its reply box open, plus per-comment draft text
// and mentions. Only one reply box is open at a time, so a flat record keyed
// by comment id (rather than a single pair) just keeps a cancelled draft's
// mentions from leaking onto the next comment's reply box.
const replyingTo = ref<string | null>(null);
const replyDrafts = ref<Record<string, string>>({});
const replyMentions = ref<Record<string, PptxCommentMention[]>>({});

function startReply(id: string): void {
	replyingTo.value = id;
	if (!(id in replyDrafts.value)) {
		replyDrafts.value = { ...replyDrafts.value, [id]: '' };
		replyMentions.value = { ...replyMentions.value, [id]: [] };
	}
}

function submitReply(id: string): void {
	const text = (replyDrafts.value[id] ?? '').trim();
	if (text.length === 0) {
		return;
	}
	emit('reply', { parentId: id, text, mentions: replyMentions.value[id] });
	const nextDrafts = { ...replyDrafts.value };
	delete nextDrafts[id];
	replyDrafts.value = nextDrafts;
	const nextMentions = { ...replyMentions.value };
	delete nextMentions[id];
	replyMentions.value = nextMentions;
	replyingTo.value = null;
}

const canAdd = computed<boolean>(() => draft.value.trim().length > 0);

const submit = (): void => {
	const text = draft.value.trim();
	if (text.length === 0) {
		return;
	}
	emit('add', { text, mentions: draftMentions.value });
	draft.value = '';
	draftMentions.value = [];
};

const formatTimestamp = (value: string | undefined): string => formatCommentTimestamp(value);
</script>

<template>
	<aside
		class="pptx-comments-panel flex h-full min-h-0 w-full flex-col border-l border-border bg-card text-foreground"
		:aria-label="t('pptx.comments.slideComments')"
	>
		<header
			v-if="!embedded"
			class="pptx-comments-panel__header flex items-center justify-between border-b border-border px-4 py-3"
		>
			<h2 class="pptx-comments-panel__title m-0 text-sm font-semibold">
				{{ t('pptx.toolbar.comments') }}
			</h2>
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
						comment.author || t('pptx.comments.unknownAuthor')
					}}</span>
					<time
						v-if="formatTimestamp(comment.createdAt)"
						class="pptx-comments-panel__time text-[11px] text-muted-foreground"
					>
						{{ formatTimestamp(comment.createdAt) }}
					</time>
				</div>
				<p class="pptx-comments-panel__text m-0 mb-2 whitespace-pre-wrap break-words text-[13px]">
					<CommentBody :text="comment.text" :mentions="comment.mentions" />
				</p>

				<!-- Threaded replies -->
				<ul
					v-if="comment.replies && comment.replies.length > 0"
					class="pptx-comments-panel__replies m-0 mb-2 list-none border-l-2 border-border pl-3"
				>
					<li
						v-for="reply in comment.replies"
						:key="reply.id"
						class="pptx-comments-panel__reply mb-1.5"
						:data-comment-id="reply.id"
					>
						<div class="mb-0.5 flex items-baseline justify-between gap-2">
							<span class="text-[12px] font-semibold">{{
								reply.author || t('pptx.comments.unknownAuthor')
							}}</span>
							<time
								v-if="formatTimestamp(reply.createdAt)"
								class="text-[11px] text-muted-foreground"
							>
								{{ formatTimestamp(reply.createdAt) }}
							</time>
						</div>
						<p class="m-0 whitespace-pre-wrap break-words text-[12px]">
							<CommentBody :text="reply.text" :mentions="reply.mentions" />
						</p>
					</li>
				</ul>

				<div class="pptx-comments-panel__actions flex gap-2">
					<button
						type="button"
						class="pptx-comments-panel__action cursor-pointer rounded-md border border-border bg-transparent px-2 py-1 text-xs text-foreground hover:bg-muted"
						:data-comment-id="comment.id"
						:aria-pressed="comment.resolved ? 'true' : 'false'"
						@click="emit('resolve', comment.id)"
					>
						{{ comment.resolved ? t('pptx.comments.reopen') : t('pptx.comments.resolve') }}
					</button>
					<button
						type="button"
						class="pptx-comments-panel__action cursor-pointer rounded-md border border-border bg-transparent px-2 py-1 text-xs text-foreground hover:bg-muted"
						:data-comment-id="comment.id"
						@click="startReply(comment.id)"
					>
						{{ t('pptx.comments.reply') }}
					</button>
					<button
						type="button"
						class="pptx-comments-panel__action pptx-comments-panel__action--danger cursor-pointer rounded-md border border-border bg-transparent px-2 py-1 text-xs text-red-400 hover:bg-muted"
						:data-comment-id="comment.id"
						:aria-label="t('pptx.comments.removeComment')"
						@click="emit('remove', comment.id)"
					>
						{{ t('pptx.comments.remove') }}
					</button>
				</div>

				<!-- Reply composer -->
				<div v-if="replyingTo === comment.id" class="mt-2 flex flex-col gap-1.5">
					<CommentMentionTextarea
						:model-value="replyDrafts[comment.id] ?? ''"
						:mentions="replyMentions[comment.id] ?? []"
						:authors="mentionAuthors"
						textarea-class="w-full resize-y rounded-md border border-border bg-background p-2 text-[12px] text-foreground"
						:rows="2"
						:placeholder="t('pptx.comments.replyPlaceholder')"
						:aria-label="t('pptx.comments.reply')"
						@update:model-value="replyDrafts[comment.id] = $event"
						@update:mentions="replyMentions[comment.id] = $event"
					/>
					<div class="flex justify-end gap-2">
						<button
							type="button"
							class="cursor-pointer rounded-md border border-border bg-transparent px-2 py-1 text-xs text-foreground hover:bg-muted"
							@click="replyingTo = null"
						>
							{{ t('pptx.comments.cancel') }}
						</button>
						<button
							type="button"
							class="cursor-pointer rounded-md border-none bg-primary px-2.5 py-1 text-xs text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
							:disabled="(replyDrafts[comment.id] ?? '').trim().length === 0"
							@click="submitReply(comment.id)"
						>
							{{ t('pptx.comments.reply') }}
						</button>
					</div>
				</div>
			</li>
		</ul>

		<p
			v-else
			class="pptx-comments-panel__empty flex-1 p-4 text-[13px] text-muted-foreground"
			data-testid="comments-empty"
		>
			{{ t('pptx.comments.noneOnSlide') }}
		</p>

		<form
			class="pptx-comments-panel__compose flex flex-col gap-2 border-t border-border px-4 py-3"
			@submit.prevent="submit"
		>
			<label
				class="pptx-comments-panel__compose-label text-xs font-semibold"
				:title="t('pptx.comments.commentingAs', { name: props.authorName })"
			>
				{{ t('pptx.comments.addComment') }}
			</label>
			<CommentMentionTextarea
				v-model="draft"
				:mentions="draftMentions"
				:authors="mentionAuthors"
				textarea-class="pptx-comments-panel__textarea w-full resize-y rounded-md border border-border bg-background p-2 text-[13px] text-foreground"
				:rows="3"
				:placeholder="t('pptx.comments.addCommentPlaceholder')"
				:aria-label="t('pptx.comments.addComment')"
				@update:mentions="draftMentions = $event"
			/>
			<button
				type="submit"
				class="pptx-comments-panel__submit cursor-pointer self-end rounded-md border-none bg-primary px-3.5 py-1.5 text-[13px] text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
				:disabled="!canAdd"
				data-testid="add-comment"
			>
				{{ t('pptx.comments.addComment') }}
			</button>
		</form>
	</aside>
</template>
