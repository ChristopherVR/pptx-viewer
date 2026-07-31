<script lang="ts">
	/**
	 * QuickStylesGallery: the 6-column preset swatch grid that PowerPoint calls
	 * Shape Styles, mirroring React's `inspector/QuickStylesGallery.tsx`.
	 *
	 * Both the preset catalogue and the swatch CSS come from
	 * `pptx-viewer-shared` (`SHAPE_QUICK_STYLES` / `quickStyleSwatchStyleAttr`),
	 * so every binding renders the same gallery; applying a preset goes through
	 * the shared `shapeQuickStylePatch`, which MERGES over the element's current
	 * `shapeStyle` instead of replacing it (a quick style is an overlay in
	 * PowerPoint, not a reset).
	 *
	 * Each swatch carries its preset name as its accessible name so an e2e spec
	 * can drive it by role+name exactly as it does in React.
	 */
	import type { PptxElement } from 'pptx-viewer-core';
	import {
		quickStyleSwatchStyleAttr,
		SHAPE_QUICK_STYLES,
		shapeQuickStylePatch,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';

	const { editor, el }: { editor: EditorState; el: PptxElement } = $props();
	const t = useTranslator();
	const canEdit = $derived(editor.editable);
</script>

<div class="pptx-svelte-quick-styles">
	<span class="pptx-svelte-quick-styles-label">{t('pptx.shape.quickStyles')}</span>
	<div class="pptx-svelte-quick-styles-grid">
		{#each SHAPE_QUICK_STYLES as quickStyle (quickStyle.name)}
			<button
				type="button"
				disabled={!canEdit}
				title={quickStyle.name}
				aria-label={quickStyle.name}
				style={quickStyleSwatchStyleAttr(quickStyle)}
				onclick={() => editor.applyElementPatch(el.id, shapeQuickStylePatch(el, quickStyle.style))}
			></button>
		{/each}
	</div>
</div>

<style>
	.pptx-svelte-quick-styles {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-bottom: 10px;
	}

	.pptx-svelte-quick-styles-label {
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-quick-styles-grid {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 4px;
	}

	.pptx-svelte-quick-styles-grid button {
		height: 28px;
		width: 100%;
		padding: 0;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 4px;
		cursor: pointer;
	}

	.pptx-svelte-quick-styles-grid button:hover:not(:disabled) {
		outline: 1px solid var(--pptx-primary, #6366f1);
	}

	.pptx-svelte-quick-styles-grid button:disabled {
		cursor: not-allowed;
		opacity: 0.4;
	}
</style>
