<script lang="ts">
	/**
	 * MergeShapesButton: the Home tab Arrange group's "Merge Shapes" dropdown
	 * (PowerPoint's Shape Format > Merge Shapes). The five operations, their
	 * order and labels come from the shared `MERGE_SHAPES_MENU_ITEMS`; choosing
	 * one runs `editor.arrangeOps.mergeSelected`, which plans the merge with the
	 * shared `planMergeShapes` over the selection in selection order.
	 */
	import {
		MERGE_SHAPES_HINT_KEY,
		MERGE_SHAPES_LABEL_KEY,
		MERGE_SHAPES_MENU_ITEMS,
		canMergeShapes,
	} from 'pptx-viewer-shared';
	import type { MergeShapeOperation } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { anchoredPopup, refocusViewerRoot } from '../anchored-popup';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();

	let open = $state(false);
	// eslint-disable-next-line prefer-const
	let anchor: HTMLElement | undefined = $state();

	const enabled = $derived(editor.editable && canMergeShapes(editor.selectedElements));
	$effect(() => {
		if (!enabled) {
			open = false;
		}
	});

	function choose(operation: MergeShapeOperation): void {
		open = false;
		refocusViewerRoot(anchor);
		editor.arrangeOps.mergeSelected(operation);
	}

	function onFocusOut(event: FocusEvent): void {
		const root = event.currentTarget as HTMLElement;
		if (!(event.relatedTarget instanceof Node) || !root.contains(event.relatedTarget)) {
			open = false;
		}
	}
</script>

<div class="pptx-svelte-merge" data-ribbon-control="home.arrange.mergeShapes" bind:this={anchor} onfocusout={onFocusOut}>
	<button
		type="button"
		class="pptx-svelte-merge-trigger"
		data-pptx-ribbon-control="merge-shapes"
		disabled={!enabled}
		aria-haspopup="menu"
		aria-expanded={open}
		aria-label={t(MERGE_SHAPES_LABEL_KEY)}
		title={enabled ? t(MERGE_SHAPES_LABEL_KEY) : t(MERGE_SHAPES_HINT_KEY)}
		onclick={() => (open = !open)}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2h7v4h5v8H6v-4H2z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" /></svg>
		<svg class="pptx-svelte-merge-caret" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
	</button>
	{#if open}
		<div
			class="pptx-svelte-merge-pop"
			role="menu"
			aria-label={t(MERGE_SHAPES_LABEL_KEY)}
			use:anchoredPopup={{ anchor }}
		>
			{#each MERGE_SHAPES_MENU_ITEMS as item (item.operation)}
				<button
					type="button"
					role="menuitem"
					data-pptx-merge-op={item.operation}
					onclick={() => choose(item.operation)}
				>{t(item.labelKey)}</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.pptx-svelte-merge {
		position: relative;
		display: inline-flex;
	}

	.pptx-svelte-merge button {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		height: 26px;
		padding: 0 5px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 11.5px;
		white-space: nowrap;
	}

	.pptx-svelte-merge button:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-merge button:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-merge svg {
		width: 14px;
		height: 14px;
	}

	.pptx-svelte-merge .pptx-svelte-merge-caret {
		width: 9px;
		height: 9px;
	}

	.pptx-svelte-merge-pop {
		position: absolute;
		top: 100%;
		left: 0;
		z-index: 50;
		display: flex;
		min-width: 130px;
		flex-direction: column;
		padding: 4px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: calc(var(--pptx-radius, 6px) + 2px);
		background: var(--pptx-popover, #111827);
		color: var(--pptx-popover-foreground, #f3f4f6);
		box-shadow: 0 10px 15px -3px rgb(0 0 0 / 35%), 0 4px 6px -4px rgb(0 0 0 / 35%);
	}

	.pptx-svelte-merge-pop button {
		width: 100%;
		padding: 6px 10px;
		text-align: left;
	}
</style>
