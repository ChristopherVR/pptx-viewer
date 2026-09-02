<script lang="ts">
	/**
	 * CommentMentionSuggestions: the `@`-mention typeahead popup under a
	 * comment/reply composer (wave-4 B5). Purely presentational: the query,
	 * matching and keyboard-nav state live in {@link CommentComposeState}.
	 */
	import type { PptxModernCommentAuthor } from 'pptx-viewer-core';

	import { useTranslator } from '../../../../i18n/context';

	const {
		authors,
		highlightIndex,
		onselect,
	}: {
		authors: readonly PptxModernCommentAuthor[];
		highlightIndex: number;
		onselect: (author: PptxModernCommentAuthor) => void;
	} = $props();

	const t = useTranslator();
</script>

{#if authors.length > 0}
	<ul
		class="pptx-svelte-comment-mentions"
		role="listbox"
		aria-label={t('pptx.comments.mentionSuggestions')}
		data-testid="pptx-comment-mention-suggestions"
	>
		{#each authors as author, index (author.id)}
			<li>
				<button
					type="button"
					role="option"
					aria-selected={index === highlightIndex}
					class:pptx-svelte-comment-mention-active={index === highlightIndex}
					data-testid="pptx-comment-mention-option"
					data-author-id={author.id}
					onmousedown={(event) => {
						event.preventDefault();
						onselect(author);
					}}
				>
					{author.name}
				</button>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.pptx-svelte-comment-mentions {
		position: absolute;
		z-index: 30;
		display: grid;
		width: 100%;
		max-height: 140px;
		margin: 2px 0 0;
		padding: 4px;
		overflow-y: auto;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-popover, #1e1e2e);
		list-style: none;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
	}

	.pptx-svelte-comment-mentions li {
		display: contents;
	}

	.pptx-svelte-comment-mentions button {
		width: 100%;
		padding: 4px 8px;
		border: 0;
		border-radius: 4px;
		background: transparent;
		color: inherit;
		text-align: left;
		cursor: pointer;
		font: inherit;
		font-size: 11.5px;
	}

	.pptx-svelte-comment-mention-active,
	.pptx-svelte-comment-mentions button:hover {
		background: var(--pptx-accent, #33334d);
	}
</style>
