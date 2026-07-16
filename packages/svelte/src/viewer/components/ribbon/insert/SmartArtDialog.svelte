<script lang="ts">
	import type { SmartArtLayout } from 'pptx-viewer-core';
	import type { SmartArtCategory, SmartArtPreset } from 'pptx-viewer-shared';
	import {
		CATEGORIES,
		PRESETS,
	} from 'pptx-viewer-shared';
	import { onMount } from 'svelte';

	import { useTranslator } from '../../../../i18n/context';
	import SmartArtThumbnail from './SmartArtThumbnail.svelte';

	const { oncancel, oninsert }: {
		oncancel: () => void;
		oninsert: (layout: SmartArtLayout, defaultItems: string[]) => void;
	} = $props();
	const t = useTranslator();

	let activeCategory = $state<SmartArtCategory>('list');
	let selectedLayout = $state<SmartArtLayout | null>(null);
	let panel: HTMLDivElement | null = null;
	const filteredPresets = $derived(PRESETS.filter((preset) => preset.category === activeCategory));

	onMount(() => panel?.focus());

	function selectCategory(category: SmartArtCategory): void {
		activeCategory = category;
		selectedLayout = null;
	}

	function insert(): void {
		const preset = PRESETS.find((candidate) => candidate.layout === selectedLayout);
		if (preset) {
			oninsert(preset.layout, preset.defaultItems);
		}
	}

	function selectPreset(preset: SmartArtPreset): void {
		selectedLayout = preset.layout;
	}

	function onWindowKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			oncancel();
		}
	}
</script>

<svelte:window onkeydown={onWindowKeydown} />

<div class="pptx-svelte-smartart-dialog-host">
	<button
		type="button"
		class="pptx-svelte-smartart-backdrop"
		aria-label={t('pptx.smartart.close')}
		onclick={oncancel}
	></button>
	<div
		bind:this={panel}
		class="pptx-svelte-smartart-dialog"
		role="dialog"
		aria-modal="true"
		aria-label={t('pptx.smartart.insertTitle')}
		tabindex="-1"
	>
		<header>
			<h2>{t('pptx.smartart.insertTitle')}</h2>
			<button type="button" class="pptx-svelte-smartart-close" aria-label={t('pptx.smartart.close')} onclick={oncancel}>
				<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 3 10 10M13 3 3 13" /></svg>
			</button>
		</header>

		<div class="pptx-svelte-smartart-body">
			<nav aria-label={t('pptx.insertSmartArt.categories')}>
				{#each CATEGORIES as category (category.id)}
					<button
						type="button"
						class:active={activeCategory === category.id}
						aria-pressed={activeCategory === category.id}
						onclick={() => selectCategory(category.id)}
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
							onclick={() => selectPreset(preset)}
						>
							<SmartArtThumbnail layout={preset.layout} defaultItems={preset.defaultItems} />
							<span>{t(preset.labelKey)}</span>
						</button>
					{/each}
				</div>
			</div>
		</div>

		<footer>
			<button type="button" class="secondary" onclick={oncancel}>{t('pptx.smartart.cancel')}</button>
			<button type="button" class="primary" disabled={!selectedLayout} onclick={insert}>
				{t('pptx.smartart.insert')}
			</button>
		</footer>
	</div>
</div>

<style>
	.pptx-svelte-smartart-dialog-host {
		position: fixed;
		z-index: 1200;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 24px;
	}

	.pptx-svelte-smartart-backdrop {
		position: absolute;
		inset: 0;
		width: 100%;
		border: 0;
		background: rgb(0 0 0 / 50%);
	}

	.pptx-svelte-smartart-dialog {
		position: relative;
		display: flex;
		flex-direction: column;
		width: min(600px, 90vw);
		max-height: 80vh;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: calc(var(--pptx-radius, 6px) + 2px);
		outline: none;
		background: var(--pptx-background, #11111b);
		box-shadow: 0 24px 70px rgb(0 0 0 / 48%);
		color: var(--pptx-foreground, #e2e8f0);
	}

	header,
	footer {
		display: flex;
		align-items: center;
		padding: 12px 16px;
	}

	header {
		justify-content: space-between;
		border-bottom: 1px solid var(--pptx-border, #33334d);
	}

	header h2 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
	}

	button {
		border: 0;
		border-radius: var(--pptx-radius, 6px);
		font: inherit;
	}

	.pptx-svelte-smartart-close {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}

	.pptx-svelte-smartart-close:hover,
	.secondary:hover {
		background: var(--pptx-accent, #33334d);
	}

	.pptx-svelte-smartart-close svg {
		width: 16px;
		height: 16px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
	}

	.pptx-svelte-smartart-body {
		display: flex;
		min-height: 300px;
		overflow: hidden;
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

	footer {
		justify-content: flex-end;
		gap: 8px;
		border-top: 1px solid var(--pptx-border, #33334d);
	}

	footer button {
		padding: 7px 12px;
		color: inherit;
		cursor: pointer;
		font-size: 12px;
	}

	.secondary {
		background: var(--pptx-muted, #2a2a3d);
	}

	.primary {
		background: var(--pptx-primary, #6366f1);
		color: white;
	}

	.primary:hover:not(:disabled) {
		filter: brightness(1.12);
	}

	.primary:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	@media (max-width: 640px) {
		.pptx-svelte-smartart-dialog-host {
			align-items: end;
			padding: 0;
		}

		.pptx-svelte-smartart-dialog {
			width: 100%;
			max-height: 88dvh;
			border-radius: 16px 16px 0 0;
		}

		nav {
			flex-basis: 116px;
		}
	}
</style>
