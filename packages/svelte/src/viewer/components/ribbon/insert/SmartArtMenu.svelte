<script lang="ts">
	/**
	 * SmartArtMenu: the Insert tab's SmartArt gallery, a trigger button that
	 * opens a popup grid of the shared `PRESETS` catalogue (34 layouts across
	 * 5 categories, `smart-art-presets.ts`), flattened into a single scrollable
	 * grid rather than React's category-tabbed dialog. Picking a preset inserts
	 * it immediately via the shared `buildSmartArtPresetData` factory (wired
	 * through `buildSmartArtInsertElement`).
	 */
	import type { SmartArtLayout } from 'pptx-viewer-core';
	import type { CanvasSize } from 'pptx-viewer-shared';
	import { PRESETS as SMART_ART_PRESETS } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { buildSmartArtInsertElement } from '../../../editor';

	const { editor, canvasSize }: { editor: EditorState; canvasSize: CanvasSize } = $props();
	const t = useTranslator();

	let open = $state(false);

	function onFocusOut(event: FocusEvent): void {
		const root = event.currentTarget as HTMLElement;
		if (!(event.relatedTarget instanceof Node) || !root.contains(event.relatedTarget)) {
			open = false;
		}
	}

	function insert(layout: SmartArtLayout, defaultItems: string[]): void {
		open = false;
		editor.insertElement(buildSmartArtInsertElement(layout, defaultItems, canvasSize));
	}
</script>

<div class="pptx-svelte-smartart" onfocusout={onFocusOut}>
	<button
		type="button"
		disabled={!editor.editable}
		aria-haspopup="menu"
		aria-expanded={open}
		aria-label={t('pptx.ribbon.insertSmartArt')}
		title={t('pptx.ribbon.insertSmartArt')}
		onclick={() => (open = !open)}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="4" cy="4" r="2" fill="none" stroke="currentColor" stroke-width="1.1" /><circle cx="12" cy="4" r="2" fill="none" stroke="currentColor" stroke-width="1.1" /><circle cx="8" cy="12" r="2" fill="none" stroke="currentColor" stroke-width="1.1" /><path d="M6 5.5 7 10M10 5.5 9 10" stroke="currentColor" stroke-width="1" /></svg>
		<span>{t('pptx.ribbon.smartArt')}</span>
	</button>
	{#if open}
		<div class="pptx-svelte-smartart-grid" role="menu">
			{#each SMART_ART_PRESETS as preset (preset.layout)}
				<button type="button" role="menuitem" onclick={() => insert(preset.layout, preset.defaultItems)}>
					{t(preset.labelKey)}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.pptx-svelte-smartart {
		position: relative;
	}

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

	.pptx-svelte-smartart-grid {
		position: absolute;
		top: 100%;
		left: 0;
		z-index: 50;
		margin-top: 4px;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 3px;
		width: 300px;
		max-height: 260px;
		overflow-y: auto;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: calc(var(--pptx-radius, 6px) + 2px);
		background: var(--pptx-popover, #111827);
		color: var(--pptx-popover-foreground, #f3f4f6);
		padding: 6px;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.35), 0 4px 6px -4px rgba(0, 0, 0, 0.35);
	}

	.pptx-svelte-smartart-grid button {
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 10.5px;
		line-height: 1.2;
		padding: 6px 4px;
		text-align: center;
	}

	.pptx-svelte-smartart-grid button:hover {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}
</style>
