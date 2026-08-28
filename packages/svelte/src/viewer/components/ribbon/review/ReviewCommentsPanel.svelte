<script lang="ts">
	/**
	 * ReviewCommentsPanel: history-aware comment review for the active slide.
	 * Comment list transforms are shared with the other framework bindings; this
	 * component only owns the compact review UI and writes through EditorState.
	 */
	import type { PptxComment, PptxSlide } from 'pptx-viewer-core';
	import {
		addCommentToList,
		removeCommentFromList,
		replyToCommentInList,
		toggleCommentResolvedInList,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import { useViewerOptions } from '../../../state/viewer-options-context';
	import CommentBody from '../../CommentBody.svelte';
	import type { EditorState } from '../../../editor/editor-state.svelte';

	const {
		editor,
		embedded = false,
	}: {
		editor: EditorState;
		/**
		 * True when hosted inside a chrome that already renders its own title +
		 * close button (the mobile `MobileSheet`). Suppresses the internal
		 * heading so mobile doesn't show "Comments" twice stacked.
		 */
		embedded?: boolean;
	} = $props();
	const t = useTranslator();
	const optionsState = useViewerOptions();
	/** Options > General > "User name" wins over the generic default author label. */
	const authorName = $derived(optionsState.options.general.userName || t('pptx.comments.defaultAuthorName'));
	let draft = $state('');
	// Which comment has its reply composer open (one at a time) + its draft.
	let replyingTo = $state<string | null>(null);
	let replyDraft = $state('');
	const slide = $derived(editor.slides[editor.currentSlideIndex]);
	const comments = $derived(slide?.comments ?? []);
	const selectedLabel = $derived(editor.selectedElement?.type ?? null);

	function replaceComments(next: PptxComment[]): void {
		const index = editor.currentSlideIndex;
		const slides = editor.slides.map((item, itemIndex) =>
			itemIndex === index ? { ...item, comments: next } : item,
		) as PptxSlide[];
		editor.commitSlides(slides);
	}

	function addComment(): void {
		const next = addCommentToList(comments, draft, authorName);
		if (!next) {
			return;
		}
		replaceComments(next);
		draft = '';
	}

	function toggleResolved(id: string): void {
		const next = toggleCommentResolvedInList(comments, id);
		if (next) {
			replaceComments(next);
		}
	}

	function removeComment(id: string): void {
		const next = removeCommentFromList(comments, id);
		if (next) {
			replaceComments(next);
		}
	}

	function startReply(id: string): void {
		replyingTo = id;
		replyDraft = '';
	}

	function cancelReply(): void {
		replyingTo = null;
		replyDraft = '';
	}

	function submitReply(id: string): void {
		const next = replyToCommentInList(comments, id, replyDraft, authorName);
		if (!next) {
			return;
		}
		replaceComments(next);
		cancelReply();
	}
</script>

<section
	class="pptx-svelte-comments"
	aria-label={embedded ? t('pptx.comments.slideComments') : undefined}
	aria-labelledby={embedded ? undefined : 'pptx-svelte-comments-title'}
>
	{#if !embedded}
		<div class="pptx-svelte-comments-heading">
			<div>
				<span class="pptx-svelte-comments-eyebrow">{t('pptx.ribbon.tab.review')}</span>
				<h3 id="pptx-svelte-comments-title">{t('pptx.comments.slideComments')}</h3>
			</div>
			<span class="pptx-svelte-comments-count">{comments.length}</span>
		</div>
	{/if}

	{#if selectedLabel}
		<p class="pptx-svelte-comments-target">{t('pptx.comments.commentingOn')} {selectedLabel}</p>
	{/if}
	<div class="pptx-svelte-comments-compose">
		<textarea bind:value={draft} rows="2" placeholder={t('pptx.comments.writePlaceholder')} aria-label={t('pptx.comments.addComment')}></textarea>
		<button type="button" disabled={!draft.trim()} onclick={addComment}>{t('pptx.comments.addComment')}</button>
	</div>

	{#if comments.length === 0}
		<p class="pptx-svelte-comments-empty">{t('pptx.comments.noneOnSlide')}</p>
	{:else}
		<div class="pptx-svelte-comments-list" aria-label={t('pptx.comments.slideComments')}>
			{#each comments as comment (comment.id)}
				<article class:resolved={comment.resolved} class="pptx-svelte-comment-card">
					<div class="pptx-svelte-comment-meta">
						<strong>{comment.author ?? t('pptx.comments.unknownAuthor')}</strong>
						{#if comment.resolved}<span>{t('pptx.comments.resolved')}</span>{/if}
					</div>
					<p><CommentBody text={comment.text} mentions={comment.mentions} /></p>
					{#if comment.replies && comment.replies.length > 0}
						<div class="pptx-svelte-comment-replies">
							{#each comment.replies as reply (reply.id)}
								<div class="pptx-svelte-comment-reply">
									<strong>{reply.author ?? t('pptx.comments.unknownAuthor')}</strong>
									<p><CommentBody text={reply.text} mentions={reply.mentions} /></p>
								</div>
							{/each}
						</div>
					{/if}
					<div class="pptx-svelte-comment-actions">
						<button type="button" onclick={() => toggleResolved(comment.id)}>{comment.resolved ? t('pptx.comments.reopen') : t('pptx.comments.resolve')}</button>
						<button type="button" onclick={() => startReply(comment.id)}>{t('pptx.comments.reply')}</button>
						<button type="button" onclick={() => removeComment(comment.id)}>{t('pptx.comments.remove')}</button>
					</div>
					{#if replyingTo === comment.id}
						<div class="pptx-svelte-comment-reply-compose">
							<textarea bind:value={replyDraft} rows="2" placeholder={t('pptx.comments.replyPlaceholder', { author: comment.author ?? t('pptx.comments.unknownAuthor') })} aria-label={t('pptx.comments.reply')}></textarea>
							<div class="pptx-svelte-comment-reply-buttons">
								<button type="button" class="pptx-svelte-comment-reply-cancel" onclick={cancelReply}>{t('pptx.comments.cancel')}</button>
								<button type="button" class="pptx-svelte-comment-reply-submit" disabled={!replyDraft.trim()} onclick={() => submitReply(comment.id)}>{t('pptx.comments.reply')}</button>
							</div>
						</div>
					{/if}
				</article>
			{/each}
		</div>
	{/if}
</section>

<style>
	.pptx-svelte-comments { display: grid; gap: 8px; width: min(340px, 100%); padding-left: 12px; border-left: 1px solid var(--pptx-border, #33334d); }
	.pptx-svelte-comments-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
	.pptx-svelte-comments-eyebrow { display: block; color: var(--pptx-muted-foreground, #94a3b8); font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
	.pptx-svelte-comments h3 { margin: 1px 0 0; font-size: 13px; }
	.pptx-svelte-comments-count { display: grid; place-items: center; min-width: 20px; height: 20px; border-radius: 10px; background: var(--pptx-muted, #2a2a3d); font-size: 11px; font-weight: 700; }
	.pptx-svelte-comments-target, .pptx-svelte-comments-empty { margin: 0; color: var(--pptx-muted-foreground, #94a3b8); font-size: 11px; }
	.pptx-svelte-comments-compose { display: grid; gap: 5px; }
	.pptx-svelte-comments textarea { box-sizing: border-box; width: 100%; resize: vertical; padding: 6px 7px; border: 1px solid var(--pptx-border, #33334d); border-radius: var(--pptx-radius, 6px); background: var(--pptx-muted, #2a2a3d); color: inherit; font: inherit; font-size: 12px; }
	.pptx-svelte-comments-compose button { justify-self: end; padding: 4px 8px; border: 0; border-radius: var(--pptx-radius, 6px); background: var(--pptx-primary, #6366f1); color: var(--pptx-primary-foreground, white); cursor: pointer; font: inherit; font-size: 11px; font-weight: 600; }
	.pptx-svelte-comments-compose button:disabled { cursor: default; opacity: .45; }
	.pptx-svelte-comments-list { display: grid; gap: 5px; max-height: 230px; overflow-y: auto; }
	.pptx-svelte-comment-card { display: grid; gap: 5px; padding: 7px; border: 1px solid var(--pptx-border, #33334d); border-radius: var(--pptx-radius, 6px); background: var(--pptx-muted, #2a2a3d); }
	.pptx-svelte-comment-card.resolved { opacity: .67; }
	.pptx-svelte-comment-meta, .pptx-svelte-comment-actions { display: flex; align-items: center; gap: 6px; }
	.pptx-svelte-comment-meta { justify-content: space-between; font-size: 11px; }
	.pptx-svelte-comment-meta span { color: #9be9a8; font-size: 10px; font-weight: 600; }
	.pptx-svelte-comment-card p { margin: 0; font-size: 11.5px; line-height: 1.35; white-space: pre-wrap; }
	.pptx-svelte-comment-actions button { padding: 0; border: 0; background: transparent; color: var(--pptx-primary, #818cf8); cursor: pointer; font: inherit; font-size: 10.5px; }
	.pptx-svelte-comment-actions button:last-child { color: #fb7185; }
	.pptx-svelte-comment-replies { display: grid; gap: 4px; padding-left: 8px; border-left: 2px solid var(--pptx-border, #33334d); }
	.pptx-svelte-comment-reply strong { font-size: 10.5px; }
	.pptx-svelte-comment-reply p { margin: 0; font-size: 11px; line-height: 1.35; white-space: pre-wrap; }
	.pptx-svelte-comment-reply-compose { display: grid; gap: 5px; }
	.pptx-svelte-comment-reply-buttons { display: flex; justify-content: flex-end; gap: 6px; }
	.pptx-svelte-comment-reply-cancel { padding: 3px 7px; border: 1px solid var(--pptx-border, #33334d); border-radius: var(--pptx-radius, 6px); background: transparent; color: inherit; cursor: pointer; font: inherit; font-size: 10.5px; }
	.pptx-svelte-comment-reply-submit { padding: 3px 8px; border: 0; border-radius: var(--pptx-radius, 6px); background: var(--pptx-primary, #6366f1); color: var(--pptx-primary-foreground, white); cursor: pointer; font: inherit; font-size: 10.5px; font-weight: 600; }
	.pptx-svelte-comment-reply-submit:disabled { cursor: default; opacity: .45; }
</style>
