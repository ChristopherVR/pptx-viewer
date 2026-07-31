<script lang="ts">
	/**
	 * SmartArtLayoutPicker: the Insert SmartArt dialog's two-pane body, a category
	 * rail beside a gallery of live-rendered layout thumbnails. Split out of
	 * `SmartArtDialog` to keep that file within the repo's file-size budget.
	 *
	 * The catalogue (`CATEGORIES` / `PRESETS`) is shared across every binding, and
	 * each tile renders through this binding's real SmartArt renderer rather than
	 * a static image, so the gallery cannot drift from what Insert produces.
	 * Selection state stays with the dialog, which owns the Insert button.
	 */
	import type { SmartArtLayout } from 'pptx-viewer-core';
	import { CATEGORIES, PRESETS } from 'pptx-viewer-shared';
	import type { SmartArtCategory, SmartArtPreset } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import SmartArtThumbnail from './SmartArtThumbnail.svelte';

	const {
		activeCategory,
		selectedLayout,
		oncategorychange,
		onselect,
	}: {
		activeCategory: SmartArtCategory;
		selectedLayout: SmartArtLayout | null;
		oncategorychange: (category: SmartArtCategory) => void;
		onselect: (preset: SmartArtPreset) => void;
	} = $props();
	const t = useTranslator();

	const filteredPresets = $derived(PRESETS.filter((preset) => preset.category === activeCategory));
</script>

<div class="pptx-svelte-smartart-body">
	<nav aria-label={t('pptx.insertSmartArt.categories')}>
		{#each CATEGORIES as category (category.id)}
			<button
				type="button"
				class:active={activeCategory === category.id}
				aria-pressed={activeCategory === category.id}
				onclick={() => oncategorychange(category.id)}
			>
				{t(category.labelKey)}
			</button>
		{/each}
	</nav>

	<div class="pptx-svelte-smartart-gallery">
		<div role="listbox" aria-label={t('pptx.insertSmartArt.layouts')}>
			{#each filteredPresets as preset (preset.layout)}
				<button
					type="button"
					role="option"
					aria-selected={selectedLayout === preset.layout}
					class:selected={selectedLayout === preset.layout}
					onclick={() => onselect(preset)}
				>
					<SmartArtThumbnail layout={preset.layout} defaultItems={preset.defaultItems} />
					<span>{t(preset.labelKey)}</span>
				</button>
			{/each}
		</div>
	</div>
</div>

<style>
	.pptx-svelte-smartart-body {
		display: flex;
		min-height: 300px;
		overflow: hidden;
	}

	button {
		border: 0;
		border-radius: var(--pptx-radius, 6px);
		font: inherit;
	}

	nav {
		flex: 0 0 160px;
		padding: 8px 0;
		border-right: 1px solid var(--pptx-border, #33334d);
	}

	nav button {
		width: 100%;
		padding: 7px 12px;
		background: transparent;
		color: inherit;
		cursor: pointer;
		font-size: 12px;
		text-align: left;
	}

	nav button:hover {
		background: var(--pptx-muted, #2a2a3d);
	}

	nav button.active {
		background: var(--pptx-primary, #6366f1);
		color: white;
	}

	.pptx-svelte-smartart-gallery {
		flex: 1;
		overflow-y: auto;
		padding: 12px;
	}

	[role='listbox'] {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
	}

	[role='option'] {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		min-height: 76px;
		padding: 8px 4px;
		border: 1px solid var(--pptx-border, #33334d);
		background: transparent;
		color: inherit;
		cursor: pointer;
		font-size: 10px;
		line-height: 1.2;
	}

	[role='option']:hover {
		background: color-mix(in srgb, var(--pptx-muted, #2a2a3d) 55%, transparent);
	}

	[role='option'].selected {
		border-color: var(--pptx-primary, #6366f1);
		background: color-mix(in srgb, var(--pptx-primary, #6366f1) 20%, transparent);
	}

	@media (max-width: 640px) {
		nav {
			flex-basis: 116px;
		}
	}
</style>
