<script lang="ts">
	/**
	 * TagsSection: the presentation's `ppt/tags/*.xml` name/value metadata,
	 * mirroring React's `inspector/TagsSection.tsx` (a collapsed disclosure with
	 * the tag count in the summary, expanding to editable name/value rows).
	 *
	 * Tags are how add-ins and automation stamp machine-readable data onto a
	 * deck, so losing them silently is a real fidelity bug; core already
	 * round-trips them and this is the surface that makes them editable.
	 *
	 * All the list surgery (flatten a nested collection model into one list,
	 * then map an edit back onto the right collection) comes from the shared
	 * `tag-collections` module, which React uses too.
	 */
	import type { PptxTagCollection } from 'pptx-viewer-core';
	import {
		addTagToCollections,
		deleteTagFromCollections,
		flattenTagCollections,
		updateTagInCollections,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';

	const {
		tagCollections,
		canEdit,
		onupdate,
	}: {
		tagCollections: readonly PptxTagCollection[];
		canEdit: boolean;
		onupdate: (next: PptxTagCollection[]) => void;
	} = $props();
	const t = useTranslator();

	const rows = $derived(flattenTagCollections(tagCollections));
</script>

<details class="pptx-svelte-tags">
	<summary>
		<span>{t('pptx.tags.title')}</span>
		<b>{rows.length}</b>
	</summary>
	{#if rows.length === 0}
		<p class="pptx-svelte-tags-empty">{t('pptx.tags.noTags')}</p>
	{:else}
		{#each rows as row (`${row.colIdx}-${row.tagIdx}`)}
			<div class="pptx-svelte-tags-row">
				<input
					type="text"
					disabled={!canEdit}
					aria-label={t('pptx.tags.name')}
					placeholder={t('pptx.tags.name')}
					value={row.name}
					onchange={(event) =>
						onupdate(
							updateTagInCollections(
								tagCollections,
								row.colIdx,
								row.tagIdx,
								'name',
								event.currentTarget.value,
							),
						)}
				/>
				<input
					type="text"
					disabled={!canEdit}
					aria-label={t('pptx.tags.value')}
					placeholder={t('pptx.tags.value')}
					value={row.value}
					onchange={(event) =>
						onupdate(
							updateTagInCollections(
								tagCollections,
								row.colIdx,
								row.tagIdx,
								'value',
								event.currentTarget.value,
							),
						)}
				/>
				{#if canEdit}
					<button
						type="button"
						class="pptx-svelte-tags-delete"
						title={t('pptx.tags.deleteTag')}
						aria-label={t('pptx.tags.deleteTag')}
						onclick={() => onupdate(deleteTagFromCollections(tagCollections, row.colIdx, row.tagIdx))}
					>
						&times;
					</button>
				{/if}
			</div>
		{/each}
	{/if}
	{#if canEdit}
		<button
			type="button"
			class="pptx-svelte-tags-add"
			onclick={() => onupdate(addTagToCollections(tagCollections))}
		>
			{t('pptx.tags.addTag')}
		</button>
	{/if}
</details>

<style>
	.pptx-svelte-tags summary {
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		color: var(--pptx-card-foreground, #e2e8f0);
		font-weight: 600;
	}

	.pptx-svelte-tags summary b {
		margin-left: auto;
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 10px;
		font-weight: 500;
	}

	.pptx-svelte-tags-empty {
		margin: 6px 0 0;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-tags-row {
		display: grid;
		grid-template-columns: 1fr 1fr auto;
		gap: 4px;
		margin-top: 5px;
	}

	.pptx-svelte-tags-row input {
		min-width: 0;
		height: 25px;
		box-sizing: border-box;
		padding: 0 6px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 5px;
		background: var(--pptx-background, #11111b);
		color: inherit;
		font: inherit;
	}

	.pptx-svelte-tags-delete {
		width: 25px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 5px;
		background: transparent;
		color: #f87171;
		cursor: pointer;
	}

	.pptx-svelte-tags-add {
		margin-top: 7px;
		padding: 3px 8px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 5px;
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
</style>
