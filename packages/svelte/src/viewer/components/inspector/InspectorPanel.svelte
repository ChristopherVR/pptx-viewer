<script lang="ts">
	/**
	 * InspectorPanel: collapsible right-hand property panel for the selected
	 * element. Delegates to element-type-aware sub-sections so each stays under
	 * the file-size budget and only renders what's relevant to the selection:
	 *
	 * - {@link PositionSection}: X/Y/W/H/rotation, shown for every selection.
	 * - {@link FillStrokeSection} (+ {@link GradientPanel}): fill/stroke colour,
	 *   opacity, and gradient, for elements with `shapeStyle`.
	 * - {@link TextSection}: vertical anchor, wrap, autofit, for elements with
	 *   `textStyle`.
	 * - {@link ImageSection}: brightness/contrast/saturation + crop, for
	 *   image-like elements.
	 * - {@link TableSection}: header row / banded rows / cell padding, for
	 *   table elements.
	 *
	 * Every control routes edits through `EditorState.applyElementPatch` /
	 * `patchSelected`, so every change is undo/redo-integrated. Vanilla
	 * counterpart: `packages/vanilla/src/viewer/ui/inspector/`.
	 */
	import { hasShapeProperties, hasTextProperties, isImageLikeElement } from 'pptx-viewer-core';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';
	import FillStrokeSection from './FillStrokeSection.svelte';
	import ImageSection from './ImageSection.svelte';
	import PositionSection from './PositionSection.svelte';
	import TableSection from './TableSection.svelte';
	import TextSection from './TextSection.svelte';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();

	// eslint-disable-next-line prefer-const
	let collapsed = $state(false);

	const el = $derived(editor.selectedElement);
	const canShape = $derived(el !== undefined && hasShapeProperties(el));
	const canText = $derived(el !== undefined && hasTextProperties(el));
	const isImage = $derived(el !== undefined && isImageLikeElement(el));
	const isTable = $derived(el?.type === 'table');
</script>

<aside class="pptx-svelte-inspector" class:pptx-svelte-inspector-collapsed={collapsed}>
	<button
		type="button"
		class="pptx-svelte-inspector-header"
		aria-expanded={!collapsed}
		onclick={() => (collapsed = !collapsed)}
	>
		<span>{t('pptx.inspector.properties')}</span>
		<svg
			viewBox="0 0 16 16"
			aria-hidden="true"
			class:pptx-svelte-inspector-chev-collapsed={collapsed}
		>
			<path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
	</button>

	{#if !collapsed}
		<div class="pptx-svelte-inspector-body">
			{#if el}
				<div class="pptx-svelte-inspector-section">
					<PositionSection {editor} {el} />
				</div>

				{#if canShape}
					<div class="pptx-svelte-inspector-section">
						<h4>{t('pptx.inspector.fillStroke')}</h4>
						<FillStrokeSection {editor} {el} />
					</div>
				{/if}

				{#if canText}
					<div class="pptx-svelte-inspector-section">
						<h4>{t('pptx.inspector.text')}</h4>
						<TextSection {editor} {el} />
					</div>
				{/if}

				{#if isImage}
					<div class="pptx-svelte-inspector-section">
						<h4>{t('pptx.inspector.image')}</h4>
						<ImageSection {editor} {el} />
					</div>
				{/if}

				{#if isTable}
					<div class="pptx-svelte-inspector-section">
						<h4>{t('pptx.inspector.table')}</h4>
						<TableSection {editor} {el} />
					</div>
				{/if}
			{:else}
				<p class="pptx-svelte-inspector-empty">{t('pptx.inspector.noSlideSelected')}</p>
			{/if}
		</div>
	{/if}
</aside>

<style>
	.pptx-svelte-inspector {
		display: flex;
		flex-direction: column;
		width: 220px;
		flex: none;
		border-left: 1px solid var(--pptx-border, #33334d);
		background: var(--pptx-card, #1e1e2e);
		color: var(--pptx-card-foreground, #e2e8f0);
		font-family: system-ui, sans-serif;
		font-size: 12px;
		overflow-y: auto;
	}

	.pptx-svelte-inspector-collapsed {
		width: auto;
	}

	.pptx-svelte-inspector-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 8px 12px;
		border: none;
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-weight: 600;
	}

	.pptx-svelte-inspector-header svg {
		width: 14px;
		height: 14px;
		transition: transform 0.15s ease;
	}

	.pptx-svelte-inspector-chev-collapsed {
		transform: rotate(-90deg);
	}

	.pptx-svelte-inspector-body {
		padding: 0 12px 12px;
	}

	.pptx-svelte-inspector-section {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid var(--pptx-border, #33334d);
	}

	.pptx-svelte-inspector-section:first-child {
		margin-top: 0;
		padding-top: 0;
		border-top: none;
	}

	.pptx-svelte-inspector-section h4 {
		margin: 0 0 8px;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-inspector-empty {
		margin: 8px 0 0;
		color: var(--pptx-muted-foreground, #94a3b8);
	}
</style>
