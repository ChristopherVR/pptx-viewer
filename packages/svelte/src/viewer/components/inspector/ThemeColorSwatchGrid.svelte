<script lang="ts">
	/**
	 * PowerPoint's "Theme Colors" grid: ten columns (Background 1, Text 1,
	 * Background 2, Text 2, Accent 1..6) each with a base swatch and five
	 * luminance variants, built from the loaded deck's real theme colours
	 * (`EditorState.themeColorMap`) rather than a hard-coded Office palette.
	 *
	 * Renders nothing (not even the heading) when no deck theme is loaded yet,
	 * so callers can render this unconditionally alongside their existing
	 * hex/recent-colour controls.
	 */
	import type { PptxThemeColorRef } from 'pptx-viewer-core';
	import type { ThemeColorPickerCommit } from 'pptx-viewer-shared';
	import {
		buildThemeColorSwatchGrid,
		findSelectedThemeSwatch,
		themeColorSwatchRows,
		themeSwatchCommit,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';

	const {
		themeColorMap,
		selectedRef,
		selectedHex,
		disabled = false,
		onpick,
	}: {
		themeColorMap: Record<string, string> | undefined;
		selectedRef?: PptxThemeColorRef;
		selectedHex?: string;
		disabled?: boolean;
		onpick: (commit: ThemeColorPickerCommit) => void;
	} = $props();

	const t = useTranslator();

	const columns = $derived(buildThemeColorSwatchGrid(themeColorMap));
	const rows = $derived(themeColorSwatchRows(columns));
	const selected = $derived(findSelectedThemeSwatch(columns, selectedRef, selectedHex));
</script>

{#if columns.length > 0}
	<div class="pptx-svelte-theme-swatch-grid">
		<div class="pptx-svelte-theme-swatch-grid-heading">{t('pptx.colorPicker.themeColors')}</div>
		<div class="pptx-svelte-theme-swatch-grid-rows">
			{#each rows as row, rowIndex (rowIndex)}
				<div class="pptx-svelte-theme-swatch-grid-row">
					{#each row as swatch, colIndex (colIndex)}
						{#if swatch}
							<button
								type="button"
								{disabled}
								data-pptx-compact
								class="pptx-svelte-theme-swatch-grid-swatch"
								class:pptx-svelte-theme-swatch-grid-swatch-selected={selected === swatch}
								style={`background-color:${swatch.hex}`}
								title={swatch.label}
								aria-label={swatch.label}
								onclick={() => onpick(themeSwatchCommit(swatch))}
							></button>
						{:else}
							<div class="pptx-svelte-theme-swatch-grid-empty"></div>
						{/if}
					{/each}
				</div>
			{/each}
		</div>
	</div>
{/if}

<style>
	.pptx-svelte-theme-swatch-grid {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-top: 4px;
	}

	.pptx-svelte-theme-swatch-grid-heading {
		font-size: 10px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-theme-swatch-grid-rows {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.pptx-svelte-theme-swatch-grid-row {
		display: flex;
		gap: 2px;
	}

	.pptx-svelte-theme-swatch-grid-swatch,
	.pptx-svelte-theme-swatch-grid-empty {
		width: 16px;
		height: 16px;
	}

	.pptx-svelte-theme-swatch-grid-swatch {
		padding: 0;
		border-radius: 2px;
		border: 1px solid var(--pptx-border, #33334d);
		cursor: pointer;
	}

	.pptx-svelte-theme-swatch-grid-swatch:hover:not(:disabled) {
		transform: scale(1.1);
	}

	.pptx-svelte-theme-swatch-grid-swatch:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.pptx-svelte-theme-swatch-grid-swatch-selected {
		outline: 2px solid var(--pptx-primary, #6366f1);
		outline-offset: 1px;
	}
</style>
