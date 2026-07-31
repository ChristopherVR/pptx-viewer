<script lang="ts">
	import type { SmartArtLayout } from 'pptx-viewer-core';
	import type { CanvasSize } from 'pptx-viewer-shared';
	import { tick } from 'svelte';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { buildSmartArtInsertElement } from '../../../editor';
	import SmartArtDialog from './SmartArtDialog.svelte';

	const { editor, canvasSize }: { editor: EditorState; canvasSize: CanvasSize } = $props();
	const t = useTranslator();

	let open = $state(false);
	// eslint-disable-next-line prefer-const -- `trigger` is reassigned by Svelte bind:this.
	let trigger: HTMLButtonElement | null = null;

	function close(): void {
		open = false;
		void tick().then(() => trigger?.focus());
	}

	function openDialog(): void {
		open = true;
	}

	function insert(layout: SmartArtLayout, defaultItems: string[]): void {
		editor.insertElement(buildSmartArtInsertElement(layout, defaultItems, canvasSize));
		close();
	}
</script>

<div class="pptx-svelte-smartart">
	<button
		bind:this={trigger}
		type="button"
		disabled={!editor.editable}
		aria-haspopup="dialog"
		aria-expanded={open}
		title={t('pptx.ribbon.insertSmartArt')}
		onclick={openDialog}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="4" cy="4" r="2" fill="none" stroke="currentColor" stroke-width="1.1" /><circle cx="12" cy="4" r="2" fill="none" stroke="currentColor" stroke-width="1.1" /><circle cx="8" cy="12" r="2" fill="none" stroke="currentColor" stroke-width="1.1" /><path d="M6 5.5 7 10M10 5.5 9 10" stroke="currentColor" stroke-width="1" /></svg>
		<span>{t('pptx.ribbon.smartArt')}</span>
	</button>
</div>

{#if open}
	<SmartArtDialog oncancel={close} oninsert={insert} />
{/if}

<style>
	.pptx-svelte-smartart > button {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 28px;
		padding: 0 8px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 12px;
	}

	.pptx-svelte-smartart > button:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-smartart > button:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-smartart svg {
		width: 15px;
		height: 15px;
	}
</style>
