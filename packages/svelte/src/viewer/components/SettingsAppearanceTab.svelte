<script lang="ts">
	/**
	 * File > Options > Appearance: swatch gallery over the viewer chrome's
	 * theme catalog, mirroring React's `SettingsAppearanceTab` layout: a
	 * 2-column grid of preview cards (split background/primary swatch + label,
	 * highlighted border when selected). Generalizes the ribbon Design tab's
	 * smaller `THEME_SWATCHES` idiom (see `ribbon/design/theme-swatches.ts`) to
	 * the full `THEME_CATALOG` (or a host-supplied `availableThemes`), and
	 * shares `PowerPointViewer`'s single `themeKey` state with it so both stay
	 * in sync.
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
		{@const previewBackground = entry.theme?.colors?.background ?? '#0b0f19'}
		{@const previewPrimary = entry.theme?.colors?.primary ?? '#6366f1'}
		<button
			type="button"
			class:active={entry.key === themeKey}
			aria-pressed={entry.key === themeKey}
			onclick={() => onselect(entry.key)}
		>
			<span
				class="swatch"
				style={`background: linear-gradient(135deg, ${previewBackground} 50%, ${previewPrimary} 50%)`}
			></span>
			<span class="label">{t(entry.labelKey)}</span>
		</button>
	{/each}
</div>

<style>
	.gallery {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
		padding: 4px 0;
	}

	.gallery button {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		border: 1px solid var(--pptx-border, #3f3f52);
		border-radius: 8px;
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
		text-align: left;
		transition:
			border-color 0.15s ease,
			background-color 0.15s ease;
	}

	.gallery button:hover {
		border-color: color-mix(in srgb, var(--pptx-primary, #6366f1) 50%, transparent);
		background: var(--pptx-accent, #33334d);
	}

	.gallery button.active {
		border-color: var(--pptx-primary, #6366f1);
		background: color-mix(in srgb, var(--pptx-primary, #6366f1) 10%, transparent);
	}

	.swatch {
		display: inline-block;
		flex: none;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: 1px solid var(--pptx-border, #3f3f52);
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.25);
	}

	.label {
		font-size: 12px;
		font-weight: 500;
		color: var(--pptx-card-foreground, #e2e8f0);
	}

	.gallery button.active .label {
		color: var(--pptx-primary, #6366f1);
	}
</style>
