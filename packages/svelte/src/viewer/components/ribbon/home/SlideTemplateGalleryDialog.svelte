<script lang="ts">
	/**
	 * SlideTemplateGalleryDialog: the Home > Slide Templates modal, mirroring
	 * React's `SlideTemplateGalleryDialog` and this binding's SmartArtDialog
	 * conventions. Presents the shared slide-template catalogue as a listbox
	 * grid of live previews: single click selects, double click or the Insert
	 * button inserts, Escape / backdrop / Cancel dismiss.
	 */
	import { SLIDE_TEMPLATES } from 'pptx-viewer-shared';
	import type { SlideTemplateId } from 'pptx-viewer-shared';
	import { onMount } from 'svelte';

	import { useTranslator } from '../../../../i18n/context';
	import SlideTemplatePreview from './SlideTemplatePreview.svelte';

	const {
		scheme,
		oncancel,
		oninsert,
	}: {
		/** Optional deck scheme so previews show the deck's theme colours. */
		scheme?: Record<string, string>;
		oncancel: () => void;
		oninsert: (templateId: SlideTemplateId) => void;
	} = $props();
	const t = useTranslator();

	let selected = $state<SlideTemplateId | null>(null);
	// eslint-disable-next-line prefer-const
	let panel = $state<HTMLDivElement>();

	onMount(() => panel?.focus());

	function insert(): void {
		if (selected) {
			oninsert(selected);
		}
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

<div class="pptx-svelte-slide-templates-host">
	<button
		type="button"
		class="pptx-svelte-slide-templates-backdrop"
		aria-label={t('pptx.slideTemplates.close')}
		onclick={oncancel}
	></button>
	<div
		bind:this={panel}
		class="pptx-svelte-slide-templates-dialog"
		role="dialog"
		aria-modal="true"
		aria-label={t('pptx.slideTemplates.galleryTitle')}
		tabindex="-1"
	>
		<header>
			<div class="pptx-svelte-slide-templates-heading">
				<h2>{t('pptx.slideTemplates.galleryTitle')}</h2>
				<p>{t('pptx.slideTemplates.galleryDescription')}</p>
			</div>
			<button
				type="button"
				class="pptx-svelte-slide-templates-close"
				aria-label={t('pptx.slideTemplates.close')}
				onclick={oncancel}
			>
				<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 3 10 10M13 3 3 13" /></svg>
			</button>
		</header>

		<div class="pptx-svelte-slide-templates-scroll">
			<div
				class="pptx-svelte-slide-templates-grid"
				role="listbox"
				aria-label={t('pptx.slideTemplates.gallery')}
			>
				{#each SLIDE_TEMPLATES as spec (spec.id)}
					<button
						type="button"
						role="option"
						class="pptx-svelte-slide-templates-tile"
						class:is-selected={selected === spec.id}
						aria-selected={selected === spec.id}
						aria-label={t(spec.nameKey)}
						title={t(spec.descriptionKey)}
						onclick={() => (selected = spec.id)}
						ondblclick={() => oninsert(spec.id)}
					>
						<SlideTemplatePreview templateId={spec.id} {scheme} />
						<span>{t(spec.nameKey)}</span>
					</button>
				{/each}
			</div>
		</div>

		<footer>
			<button type="button" class="secondary" onclick={oncancel}>
				{t('pptx.slideTemplates.cancel')}
			</button>
			<button type="button" class="primary" disabled={!selected} onclick={insert}>
				{t('pptx.slideTemplates.insert')}
			</button>
		</footer>
	</div>
</div>

<style>
	.pptx-svelte-slide-templates-host {
		position: fixed;
		z-index: 1200;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 24px;
	}

	.pptx-svelte-slide-templates-backdrop {
		position: absolute;
		inset: 0;
		width: 100%;
		border: 0;
		background: rgb(0 0 0 / 50%);
	}

	.pptx-svelte-slide-templates-dialog {
		position: relative;
		display: flex;
		flex-direction: column;
		width: min(640px, 92vw);
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

	.pptx-svelte-slide-templates-heading {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.pptx-svelte-slide-templates-heading h2 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
	}

	.pptx-svelte-slide-templates-heading p {
		margin: 0;
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 11px;
	}

	button {
		border: 0;
		border-radius: var(--pptx-radius, 6px);
		font: inherit;
	}

	.pptx-svelte-slide-templates-close {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}

	.pptx-svelte-slide-templates-close:hover,
	.secondary:hover {
		background: var(--pptx-accent, #33334d);
	}

	.pptx-svelte-slide-templates-close svg {
		width: 16px;
		height: 16px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.5;
	}

	.pptx-svelte-slide-templates-scroll {
		flex: 1 1 auto;
		min-height: 0;
		padding: 12px;
		overflow-y: auto;
	}

	.pptx-svelte-slide-templates-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
	}

	.pptx-svelte-slide-templates-tile {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 8px;
		border: 1px solid var(--pptx-border, #33334d);
		background: transparent;
		color: inherit;
		cursor: pointer;
		font-size: 10px;
		line-height: 1.2;
		text-align: center;
	}

	.pptx-svelte-slide-templates-tile:hover {
		background: color-mix(in srgb, var(--pptx-muted, #2a2a3d) 50%, transparent);
	}

	.pptx-svelte-slide-templates-tile.is-selected {
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
		.pptx-svelte-slide-templates-host {
			align-items: end;
			padding: 0;
		}

		.pptx-svelte-slide-templates-dialog {
			width: 100%;
			max-height: 88dvh;
			border-radius: 16px 16px 0 0;
		}
	}
</style>
