<script lang="ts">
	/**
	 * RecentColorsRow: the "Recent colours" swatch strip shown under a colour
	 * input (wave-4 B6). One swatch per colour, most-recent-first; clicking a
	 * swatch applies it through THIS picker's own commit handler (`onselect`),
	 * so a section with several colour inputs (fill, line, ...) gives each its
	 * own row over the SAME shared list, mirroring React's per-`ColorPickerRow`
	 * approach. Renders nothing while the list is empty.
	 */
	import { useTranslator } from '../../../i18n/context';

	const {
		colors,
		onselect,
	}: {
		colors: readonly string[];
		onselect: (hex: string) => void;
	} = $props();

	const t = useTranslator();
</script>

{#if colors.length > 0}
	<div class="pptx-svelte-recent-colors" data-testid="pptx-color-recent">
		<span>{t('pptx.colorPicker.recentColors')}</span>
		<div class="pptx-svelte-recent-colors-swatches">
			{#each colors as hex (hex)}
				<button
					type="button"
					class="pptx-svelte-recent-colors-swatch"
					style={`background-color:${hex}`}
					title={hex}
					aria-label={hex}
					data-pptx-compact
					onclick={() => onselect(hex)}
				></button>
			{/each}
		</div>
	</div>
{/if}

<style>
	.pptx-svelte-recent-colors {
		display: flex;
		flex-direction: column;
		gap: 3px;
		margin-top: 4px;
	}

	.pptx-svelte-recent-colors > span {
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 10px;
	}

	.pptx-svelte-recent-colors-swatches {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.pptx-svelte-recent-colors-swatch {
		width: 16px;
		height: 16px;
		padding: 0;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 3px;
		cursor: pointer;
	}
</style>
