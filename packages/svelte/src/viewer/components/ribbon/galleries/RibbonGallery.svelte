<script lang="ts">
	/**
	 * RibbonGallery: one PowerPoint-style style gallery (Shape Styles, Theme
	 * Colors, Bullets, ...). Thin presentation over shared's descriptor:
	 * `buildRibbonGallery` decides the tiles, `applyRibbonGalleryItem` decides
	 * what a pick writes, and the host (`ribbon-gallery-host.ts`) dispatches the
	 * result onto the editor's undoable update path.
	 *
	 * Two modes, from the shared placement: `dropdown` is a single trigger
	 * button; `inline` shows the first tiles in the ribbon plus a "more" button.
	 * Both open the same popup with every section's grid. `chevronOnly` renders
	 * the trigger as a bare chevron, for the Bullets / Numbering split buttons
	 * whose toggle half lives in `ParagraphGroup`.
	 *
	 * DOM contract (shared `gallery-view.ts`, identical in all five bindings):
	 * `data-ribbon-control` on the wrapper, `data-ribbon-gallery` on the trigger
	 * or "more" button, `data-ribbon-gallery-popup` on the panel and
	 * `data-gallery-item` + `aria-pressed` on every tile.
	 */
	import {
		buildRibbonGallery,
		galleryHasItems,
		galleryItemLabel,
		inlineGalleryItems,
	} from 'pptx-viewer-shared';
	import type { RibbonGalleryItem, RibbonGalleryPlacement } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import { anchoredPopup, refocusViewerRoot } from '../anchored-popup';
	import { strictTranslator, translatedOr } from './gallery-labels';
	import { useRibbonGalleryHost } from './ribbon-gallery-host';

	const {
		placement,
		chevronOnly = false,
		tagControl = true,
	}: {
		placement: RibbonGalleryPlacement;
		chevronOnly?: boolean;
		/** False when a parent wrapper already carries `data-ribbon-control`. */
		tagControl?: boolean;
	} = $props();

	const t = useTranslator();
	const strictT = $derived(strictTranslator(t));
	const host = useRibbonGalleryHost();

	// Outside a ribbon (no host) the gallery still names itself but stays inert.
	const descriptor = $derived(
		host ? host.build(placement.gallery) : buildRibbonGallery(placement.gallery, { element: null }),
	);
	const title = $derived(translatedOr(t, descriptor.labelKey, descriptor.label));
	const disabled = $derived(!host || descriptor.disabled || !galleryHasItems(descriptor));
	const inline = $derived(placement.mode === 'inline' && !chevronOnly);
	const strip = $derived(inline ? inlineGalleryItems(descriptor) : []);

	let open = $state(false);
	// eslint-disable-next-line prefer-const
	let anchor: HTMLElement | undefined = $state();

	function toggle(): void {
		open = !disabled && !open;
	}

	function pick(item: RibbonGalleryItem): void {
		open = false;
		refocusViewerRoot(anchor);
		void host?.apply(placement.gallery, item.id);
	}

	function onFocusOut(event: FocusEvent): void {
		const root = event.currentTarget as HTMLElement;
		if (!(event.relatedTarget instanceof Node) || !root.contains(event.relatedTarget)) {
			open = false;
		}
	}

	function onKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape' && open) {
			event.stopPropagation();
			open = false;
			anchor?.querySelector<HTMLElement>(`[data-ribbon-gallery]`)?.focus();
		}
	}

	const sectionTitle = (titleKey: string | undefined, fallback: string | undefined): string =>
		translatedOr(t, titleKey, fallback ?? '');
</script>

{#snippet tile(item: RibbonGalleryItem, width: number, height: number)}
	<button
		type="button"
		class="pptx-svelte-rbgallery-tile"
		class:pptx-svelte-rbgallery-tile-on={item.applied}
		style={`width:${width + 6}px;height:${height + 6}px`}
		data-gallery-item={item.id}
		aria-pressed={item.applied ? 'true' : 'false'}
		aria-label={galleryItemLabel(item, strictT)}
		title={galleryItemLabel(item, strictT)}
		disabled={disabled}
		onmousedown={(event) => event.preventDefault()}
		onclick={() => pick(item)}
	>
		<!-- previewSvg is built by shared from catalogue data and theme colours only. -->
		{@html item.previewSvg}
	</button>
{/snippet}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="pptx-svelte-rbgallery"
	class:pptx-svelte-rbgallery-inline={inline}
	data-ribbon-control={tagControl ? placement.control : undefined}
	bind:this={anchor}
	onfocusout={onFocusOut}
	onkeydown={onKeydown}
>
	{#if inline}
		<div class="pptx-svelte-rbgallery-strip" role="group" aria-label={title}>
			{#each strip as item (item.id)}
				{@render tile(item, descriptor.sections[0]?.tileWidth ?? 40, descriptor.sections[0]?.tileHeight ?? 30)}
			{/each}
		</div>
		<button
			type="button"
			class="pptx-svelte-rbgallery-more"
			data-ribbon-gallery={placement.gallery}
			aria-haspopup="true"
			aria-expanded={open}
			aria-label={t('pptx.gallery.more', { name: title })}
			title={t('pptx.gallery.more', { name: title })}
			{disabled}
			onclick={toggle}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
		</button>
	{:else}
		<button
			type="button"
			class="pptx-svelte-rbgallery-trigger"
			class:pptx-svelte-rbgallery-chevron={chevronOnly}
			data-ribbon-gallery={placement.gallery}
			aria-haspopup="true"
			aria-expanded={open}
			aria-label={title}
			title={title}
			{disabled}
			onmousedown={(event) => event.preventDefault()}
			onclick={toggle}
		>
			{#if !chevronOnly}
				<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="5" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1.1" /><rect x="9" y="2" width="5" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1.1" /><rect x="2" y="9" width="5" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1.1" /><rect x="9" y="9" width="5" height="5" rx="1" fill="currentColor" opacity="0.5" /></svg>
				<span>{title}</span>
			{/if}
			<svg class="pptx-svelte-rbgallery-caret" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
		</button>
	{/if}
	{#if open}
		<div
			class="pptx-svelte-rbgallery-pop"
			role="group"
			aria-label={title}
			data-ribbon-gallery-popup={placement.gallery}
			use:anchoredPopup={{ anchor }}
		>
			{#each descriptor.sections as section (section.id)}
				{#if section.titleKey || section.title}
					<div class="pptx-svelte-rbgallery-heading">{sectionTitle(section.titleKey, section.title)}</div>
				{/if}
				<div class="pptx-svelte-rbgallery-grid" style={`grid-template-columns:repeat(${section.columns}, auto)`}>
					{#each section.items as item (item.id)}
						{@render tile(item, section.tileWidth, section.tileHeight)}
					{/each}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.pptx-svelte-rbgallery {
		position: relative;
		display: inline-flex;
		align-items: center;
		flex: none;
	}

	.pptx-svelte-rbgallery-inline {
		align-items: stretch;
		border: 1px solid color-mix(in srgb, var(--pptx-border, #33334d) 60%, transparent);
		border-radius: 4px;
	}

	.pptx-svelte-rbgallery-strip {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 2px;
	}

	.pptx-svelte-rbgallery button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 11.5px;
		white-space: nowrap;
	}

	.pptx-svelte-rbgallery button:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-rbgallery button:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-rbgallery-trigger {
		height: 26px;
		padding: 0 6px;
	}

	.pptx-svelte-rbgallery-chevron {
		width: 14px;
		padding: 0 !important;
	}

	.pptx-svelte-rbgallery-more {
		width: 16px;
		border-left: 1px solid color-mix(in srgb, var(--pptx-border, #33334d) 60%, transparent) !important;
		border-radius: 0 4px 4px 0 !important;
	}

	.pptx-svelte-rbgallery svg {
		width: 14px;
		height: 14px;
	}

	.pptx-svelte-rbgallery .pptx-svelte-rbgallery-caret,
	.pptx-svelte-rbgallery-more svg {
		width: 10px;
		height: 10px;
	}

	.pptx-svelte-rbgallery-tile {
		padding: 2px !important;
		border: 1px solid transparent !important;
		border-radius: 3px !important;
	}

	.pptx-svelte-rbgallery-tile :global(svg) {
		width: auto;
		height: auto;
		pointer-events: none;
	}

	.pptx-svelte-rbgallery-tile-on {
		border-color: var(--pptx-primary, #6366f1) !important;
	}

	.pptx-svelte-rbgallery-pop {
		position: absolute;
		top: 100%;
		left: 0;
		z-index: 50;
		display: flex;
		flex-direction: column;
		gap: 4px;
		max-height: 420px;
		overflow-y: auto;
		padding: 6px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: calc(var(--pptx-radius, 6px) + 2px);
		background: var(--pptx-popover, #111827);
		color: var(--pptx-popover-foreground, #f3f4f6);
		box-shadow: 0 10px 15px -3px rgb(0 0 0 / 35%), 0 4px 6px -4px rgb(0 0 0 / 35%);
	}

	.pptx-svelte-rbgallery-heading {
		padding: 2px 2px 0;
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 10px;
		font-weight: 600;
	}

	.pptx-svelte-rbgallery-grid {
		display: grid;
		gap: 3px;
	}
</style>
