<script lang="ts">
	/**
	 * CommentReplyThread: a comment's `replies` list, rendered RECURSIVELY
	 * (wave-4 B5). `PptxComment.replies` is itself `PptxComment[]`, so a reply
	 * can carry its own nested replies; core now nests legacy `p:cmLst` replies
	 * the same way it always nested modern ones, but the previous panel only
	 * ever unrolled ONE level (`{#each comment.replies as reply}` with no
	 * recursion into `reply.replies`), so a legacy comment loaded with a
	 * grandchild reply silently dropped it from view. Self-recursive component,
	 * the same pattern `ElementRenderer` uses for group children.
	 */
	import type { PptxComment } from 'pptx-viewer-core';

	import { useTranslator } from '../../../../i18n/context';
	import CommentBody from '../../CommentBody.svelte';
	// Self-import: a reply's own replies recurse into this same component.
	// eslint-disable-next-line import/no-self-import
	import CommentReplyThread from './CommentReplyThread.svelte';

	const { replies }: { replies: readonly PptxComment[] } = $props();
	const t = useTranslator();
</script>

{#if replies.length > 0}
	<div class="pptx-svelte-comment-replies">
		{#each replies as reply (reply.id)}
			<div class="pptx-svelte-comment-reply">
				<strong>{reply.author ?? t('pptx.comments.unknownAuthor')}</strong>
				<p><CommentBody text={reply.text} mentions={reply.mentions} /></p>
				{#if reply.replies && reply.replies.length > 0}
					<CommentReplyThread replies={reply.replies} />
				{/if}
			</div>
		{/each}
	</div>
{/if}

<style>
	.pptx-svelte-comment-replies {
		display: grid;
		gap: 4px;
		padding-left: 8px;
		border-left: 2px solid var(--pptx-border, #33334d);
	}
	.pptx-svelte-comment-reply strong {
		font-size: 10.5px;
	}
	.pptx-svelte-comment-reply p {
		margin: 0;
		font-size: 11px;
		line-height: 1.35;
		white-space: pre-wrap;
	}
</style>
