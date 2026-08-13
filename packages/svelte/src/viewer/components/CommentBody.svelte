<script lang="ts">
	/**
	 * CommentBody: a comment's text with its `@`-mentions highlighted.
	 *
	 * The split into text/mention runs is the shared decision function
	 * `commentTextSegments`, so all five bindings produce identical runs. This
	 * component only maps the resulting descriptor onto spans.
	 */
	import type { PptxComment } from 'pptx-viewer-core';
	import { commentTextSegments } from 'pptx-viewer-shared';

	const { text, mentions }: { text: string; mentions?: PptxComment['mentions'] } = $props();

	const segments = $derived(commentTextSegments(text, mentions));
</script>

<!-- prettier-ignore -->
{#each segments as segment, index (index)}{#if segment.kind === 'mention'}<span
			class="pptx-comment-mention"
			data-pptx-comment-mention={segment.personId || ''}
			title={segment.authorName}>{segment.text}</span
		>{:else}{segment.text}{/if}{/each}

<style>
	.pptx-comment-mention {
		border-radius: 3px;
		background: color-mix(in srgb, var(--pptx-primary, #6366f1) 15%, transparent);
		color: var(--pptx-primary, #6366f1);
		font-weight: 600;
		padding: 0 2px;
	}
</style>
