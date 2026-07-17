<script lang="ts">
	/**
	 * File > Options > Appearance: swatch gallery over the viewer chrome's
	 * theme catalog. Generalizes the ribbon Design tab's smaller
	 * `THEME_SWATCHES` idiom (see `ribbon/design/theme-swatches.ts`) to the
	 * full `THEME_CATALOG` (or a host-supplied `availableThemes`), and shares
	 * `PowerPointViewer`'s single `themeKey` state with it so both stay in sync.
	 */
	import type { ThemeCatalogEntry } from 'pptx-viewer-shared';
	import { useTranslator } from '../../i18n/context';

	const {
		themeKey,
		themeCatalog,
		onselect,
	}: {
		themeKey: string;
		themeCatalog: readonly ThemeCatalogEntry[];
		onselect: (key: string) => void;
	} = $props();
	const t = useTranslator();
</script>

<div class="gallery">
	{#each themeCatalog as entry (entry.key)}
		<button
			type="button"
			class:active={entry.key === themeKey}
			aria-pressed={entry.key === themeKey}
			onclick={() => onselect(entry.key)}
		>
			<span class="swatch" style={`background:${entry.theme?.colors?.primary ?? '#6b7280'}`}></span>
			<span>{t(entry.labelKey)}</span>
		</button>
	{/each}
</div>

<style>
	.gallery {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		padding: 4px 0;
	}

	.gallery button {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		border: 1px solid var(--pptx-border, #3f3f52);
		border-radius: 8px;
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 12px;
	}

	.gallery button:hover {
		background: var(--pptx-accent, #33334d);
	}

	.gallery button.active {
		outline: 2px solid var(--pptx-primary, #c43b32);
		outline-offset: -2px;
	}

	.swatch {
		display: inline-block;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		border: 1px solid var(--pptx-border, #3f3f52);
	}
</style>
