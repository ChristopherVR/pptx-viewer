<script lang="ts">
	/**
	 * DrawingGroup: the Home tab's Drawing controls, React's `DrawingGroup` in
	 * Svelte form: a Shapes gallery, an Arrange z-order menu, and the Shape
	 * Effects placeholder.
	 *
	 * Shape Fill, Shape Outline and stroke width are NOT repeated here: Svelte
	 * already ships them as `ShapeFormatGroup`, which sits in the same row. This
	 * file only adds what the Home tab was missing.
	 *
	 * Shape Effects is disabled in React too (nobody has built the effects
	 * dialog); see `RecordTab.svelte` for why the placeholder is rendered rather
	 * than dropped.
	 */
	import { SHAPE_PRESET_DEFS } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import type { ZOrderDirection } from '../../../editor';
	import { newPresetShapeElement } from '../../../editor';
	import { anchoredPopup } from '../anchored-popup';
	import { glyphClassToTransform, isStrokeGlyph, shapeGlyphPath } from '../insert/shape-glyphs';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();

	/** React's gallery shows the first dozen presets; the rest live on Insert. */
	const TOP_SHAPES = SHAPE_PRESET_DEFS.slice(0, 12);

	const ARRANGE_ACTIONS: ReadonlyArray<{ key: string; direction: ZOrderDirection }> = [
		{ key: 'pptx.contextMenu.bringForward', direction: 'forward' },
		{ key: 'pptx.contextMenu.sendBackward', direction: 'backward' },
		{ key: 'pptx.contextMenu.bringToFront', direction: 'front' },
		{ key: 'pptx.contextMenu.sendToBack', direction: 'back' },
	];

	let openMenu = $state<'shapes' | 'arrange' | null>(null);
	// eslint-disable-next-line prefer-const
	let shapesAnchor: HTMLElement | undefined = $state();
	// eslint-disable-next-line prefer-const
	let arrangeAnchor: HTMLElement | undefined = $state();

	const hasSelection = $derived(Boolean(editor.selectedElementId));

	function onFocusOut(event: FocusEvent): void {
		const root = event.currentTarget as HTMLElement;
		if (!(event.relatedTarget instanceof Node) || !root.contains(event.relatedTarget)) {
			openMenu = null;
		}
	}
</script>

<div class="pptx-svelte-drawgrp" role="group" aria-label={t('pptx.drawing.shapes')}>
	<div class="pptx-svelte-drawgrp-menu" bind:this={shapesAnchor} onfocusout={onFocusOut}>
		<button
			type="button"
			disabled={!editor.editable}
			aria-haspopup="menu"
			aria-expanded={openMenu === 'shapes'}
			title={t('pptx.drawing.shapes')}
			onclick={() => (openMenu = openMenu === 'shapes' ? null : 'shapes')}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="5" height="5" fill="none" stroke="currentColor" stroke-width="1.1" /><circle cx="11.5" cy="4.5" r="2.5" fill="none" stroke="currentColor" stroke-width="1.1" /><path d="M2 14 6 8l4 6z" fill="none" stroke="currentColor" stroke-width="1.1" /></svg>
			<span>{t('pptx.drawing.shapes')}</span>
		</button>
		{#if openMenu === 'shapes'}
			<div class="pptx-svelte-drawgrp-grid" role="menu" use:anchoredPopup={{ anchor: shapesAnchor }}>
				{#each TOP_SHAPES as preset (preset.type)}
					<button
						type="button"
						role="menuitem"
						aria-label={t(preset.i18nKey)}
						title={t(preset.i18nKey)}
						onclick={() => {
							openMenu = null;
							editor.insertElement(newPresetShapeElement(preset.type));
						}}
					>
						<svg viewBox="0 0 16 16" aria-hidden="true" style={`transform:${glyphClassToTransform(preset.glyphClass)}`}>
							{#if isStrokeGlyph(preset.glyph)}
								<path d={shapeGlyphPath(preset.glyph)} fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
							{:else}
								<path d={shapeGlyphPath(preset.glyph)} fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round" />
							{/if}
						</svg>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<div class="pptx-svelte-drawgrp-menu" bind:this={arrangeAnchor} onfocusout={onFocusOut}>
		<button
			type="button"
			disabled={!editor.editable || !hasSelection}
			aria-haspopup="menu"
			aria-expanded={openMenu === 'arrange'}
			title={t('pptx.ribbon.arrange')}
			onclick={() => (openMenu = openMenu === 'arrange' ? null : 'arrange')}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5 14 5 8 8.5 2 5zM2 8l6 3.5L14 8M2 11l6 3.5L14 11" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round" /></svg>
			<span>{t('pptx.ribbon.arrange')}</span>
		</button>
		{#if openMenu === 'arrange'}
			<div class="pptx-svelte-drawgrp-pop" role="menu" use:anchoredPopup={{ anchor: arrangeAnchor }}>
				{#each ARRANGE_ACTIONS as action (action.key)}
					<button
						type="button"
						role="menuitem"
						onclick={() => {
							openMenu = null;
							editor.reorderSelected(action.direction);
						}}
					>{t(action.key)}</button>
				{/each}
			</div>
		{/if}
	</div>

	<button type="button" disabled title={t('pptx.drawing.shapeEffectsUnavailable')}>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5 9.4 5.6 13.5 7 9.4 8.4 8 12.5 6.6 8.4 2.5 7 6.6 5.6zM12.5 11.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round" /></svg>
	</button>
</div>

<style>
	.pptx-svelte-drawgrp {
		display: inline-flex;
		align-items: center;
		gap: 3px;
	}

	.pptx-svelte-drawgrp-menu {
		position: relative;
		display: inline-flex;
	}

	.pptx-svelte-drawgrp button {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 26px;
		padding: 0 7px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 11.5px;
		white-space: nowrap;
	}

	.pptx-svelte-drawgrp button:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-drawgrp button:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-drawgrp svg {
		width: 14px;
		height: 14px;
	}

	.pptx-svelte-drawgrp-grid {
		position: absolute;
		top: 100%;
		left: 0;
		z-index: 50;
		margin-top: 4px;
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 3px;
		width: 220px;
		padding: 6px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: calc(var(--pptx-radius, 6px) + 2px);
		background: var(--pptx-popover, #111827);
		color: var(--pptx-popover-foreground, #f3f4f6);
		box-shadow: 0 10px 15px -3px rgb(0 0 0 / 35%), 0 4px 6px -4px rgb(0 0 0 / 35%);
	}

	.pptx-svelte-drawgrp-grid button {
		width: 30px;
		height: 30px;
		padding: 0;
		justify-content: center;
	}

	.pptx-svelte-drawgrp-pop {
		position: absolute;
		top: 100%;
		left: 0;
		z-index: 50;
		margin-top: 4px;
		display: flex;
		min-width: 150px;
		flex-direction: column;
		padding: 4px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: calc(var(--pptx-radius, 6px) + 2px);
		background: var(--pptx-popover, #111827);
		color: var(--pptx-popover-foreground, #f3f4f6);
		box-shadow: 0 10px 15px -3px rgb(0 0 0 / 35%), 0 4px 6px -4px rgb(0 0 0 / 35%);
	}

	.pptx-svelte-drawgrp-pop button {
		width: 100%;
		padding: 6px 10px;
		text-align: left;
	}
</style>
