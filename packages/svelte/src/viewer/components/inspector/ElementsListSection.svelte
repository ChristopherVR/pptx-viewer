<script lang="ts">
	/**
	 * ElementsListSection: the inspector's Elements tab (React
	 * `InspectorPane`'s layer-order list). Lists the active slide's elements
	 * top-most first (reverse paint order) and selects one on click.
	 */
	import { hasTextProperties } from 'pptx-viewer-core';
	import type { PptxElement } from 'pptx-viewer-core';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();

	const elements = $derived(editor.activeElements);
	const reversed = $derived([...elements].reverse());

	function labelFor(element: PptxElement): string {
		if (hasTextProperties(element)) {
			const text = (element.text ?? '').trim().slice(0, 24);
			if (text) {
				return text;
			}
		}
		return element.type;
	}

	function isSelected(element: PptxElement): boolean {
		return editor.selectedElementId === element.id || editor.selection.ids.includes(element.id);
	}
</script>

<div class="pptx-svelte-layers">
	<h4>{t('pptx.inspector.layerOrder')}</h4>
	{#if reversed.length === 0}
		<p class="pptx-svelte-layers-empty">{t('pptx.inspector.noSlideSelected')}</p>
	{:else}
		{#each reversed as element, reverseIndex (element.id)}
			<button
				type="button"
				class="pptx-svelte-layers-item"
				class:pptx-svelte-layers-selected={isSelected(element)}
				title={`${element.type}: ${element.id}`}
				onclick={() => editor.select(element.id)}
			>
				<span class="pptx-svelte-layers-index">{reversed.length - reverseIndex}</span>
				<span class="pptx-svelte-layers-label">{labelFor(element)}</span>
			</button>
		{/each}
	{/if}
</div>

<style>
	.pptx-svelte-layers {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.pptx-svelte-layers h4 {
		margin: 0 0 8px;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-layers-empty {
		margin: 0;
		color: var(--pptx-muted-foreground, #94a3b8);
		font-style: italic;
	}

	.pptx-svelte-layers-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 4px 8px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 12px;
		text-align: left;
	}

	.pptx-svelte-layers-item:hover {
		background: var(--pptx-muted, #2a2a3d);
	}

	.pptx-svelte-layers-selected {
		background: color-mix(in srgb, var(--pptx-primary, #6366f1) 30%, transparent);
		color: var(--pptx-primary, #818cf8);
	}

	.pptx-svelte-layers-index {
		min-width: 16px;
		color: var(--pptx-muted-foreground, #94a3b8);
		text-align: right;
	}

	.pptx-svelte-layers-label {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
