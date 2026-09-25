<script lang="ts">
	/**
	 * DeckThemeMenu: the Design > Browse Themes list. One entry per shared
	 * `GALLERY_THEME_PRESETS` preset (the set and order React's and Vue's
	 * `ThemeGallery` show), with a four-accent swatch strip; the entry matching
	 * the deck's current theme (`activeGalleryThemePreset`) is marked checked.
	 * Picking one re-themes the PRESENTATION, never the viewer chrome.
	 */
	import type { PptxTheme, PptxThemePreset } from 'pptx-viewer-core';
	import { activeGalleryThemePreset, GALLERY_THEME_PRESETS } from 'pptx-viewer-shared';

	const {
		theme,
		disabled,
		onpick,
	}: {
		theme: PptxTheme | undefined;
		disabled: boolean;
		onpick: (preset: PptxThemePreset) => void;
	} = $props();

	const activeId = $derived(activeGalleryThemePreset(theme)?.id);
	const ACCENTS = ['accent1', 'accent2', 'accent3', 'accent4'] as const;
</script>

{#each GALLERY_THEME_PRESETS as preset (preset.id)}
	<button
		type="button"
		role="menuitemradio"
		data-theme-preset={preset.id}
		aria-checked={preset.id === activeId}
		class:pptx-svelte-decktheme-active={preset.id === activeId}
		{disabled}
		onclick={() => onpick(preset)}
	>
		<span class="pptx-svelte-decktheme-strip" aria-hidden="true">
			{#each ACCENTS as accent (accent)}
				<span style={`background:${preset.colorScheme[accent]}`}></span>
			{/each}
		</span>
		{preset.name}
	</button>
{/each}

<style>
	.pptx-svelte-decktheme-strip {
		display: inline-flex;
		overflow: hidden;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 3px;
	}

	.pptx-svelte-decktheme-strip span {
		width: 8px;
		height: 12px;
	}

	.pptx-svelte-decktheme-active {
		outline: 2px solid var(--pptx-primary, #6366f1);
		outline-offset: -2px;
	}
</style>
