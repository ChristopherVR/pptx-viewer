<script lang="ts">
	/**
	 * LayoutGalleryMenu: the grid of layout thumbnails shared by the New Slide
	 * and Layout menus. Svelte port of React's `toolbar/LayoutGalleryMenu.tsx`.
	 *
	 * Both menus previously listed layout names as plain text, which is not
	 * enough to tell "Title and Content" from "Two Content" in a themed deck.
	 */
	import type { PptxLayoutOption, PptxLayoutPreview, PptxSlide } from 'pptx-viewer-core';
	import { buildLayoutPreviewGeometry, isCurrentLayout } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import SlideStage from '../../SlideStage.svelte';

	/** Thumbnail box size, matching PowerPoint's gallery tiles. */
	const THUMB_WIDTH = 128;
	const THUMB_HEIGHT = 72;

	/** Cap on artwork drawn per thumbnail; layouts never legitimately exceed this. */
	const MAX_PREVIEW_ELEMENTS = 100;

	/** No media in a layout thumbnail; images arrive already decoded. */
	const EMPTY_MEDIA = new Map<string, string>();

	const {
		layouts,
		previews,
		currentLayoutPath,
		onselect,
	}: {
		layouts: readonly PptxLayoutOption[];
		previews: ReadonlyMap<string, PptxLayoutPreview>;
		currentLayoutPath?: string;
		onselect: (layout: PptxLayoutOption) => void;
	} = $props();

	const t = useTranslator();

	const tiles = $derived(
		layouts.map((layout) => {
			const preview = previews.get(layout.path);
			const geometry = buildLayoutPreviewGeometry(preview, THUMB_WIDTH, THUMB_HEIGHT);
			const slide: PptxSlide = {
				id: `layout-preview-${layout.path}`,
				rId: '',
				slideNumber: 0,
				elements: (preview?.elements ?? []).slice(0, MAX_PREVIEW_ELEMENTS),
				backgroundColor: geometry.backgroundColor,
			};
			return {
				layout,
				geometry,
				slide,
				canvasSize: { width: geometry.surfaceWidth, height: geometry.surfaceHeight },
				current: isCurrentLayout(layout, currentLayoutPath),
			};
		}),
	);
</script>

<div class="pptx-svelte-lgal" data-testid="layout-gallery-menu">
	{#if tiles.length === 0}
		<span class="pptx-svelte-lgal-empty">{t('pptx.layoutGallery.empty')}</span>
	{:else}
		{#each tiles as tile (tile.layout.path)}
			<button
				type="button"
				role="menuitem"
				class="pptx-svelte-lgal-tile"
				class:pptx-svelte-lgal-current={tile.current}
				aria-current={tile.current ? 'true' : undefined}
				title={tile.current
					? `${tile.layout.name} (${t('pptx.layoutGallery.current')})`
					: tile.layout.name}
				onclick={() => onselect(tile.layout)}
			>
				<div
					class="pptx-svelte-lgal-thumb"
					style:width={`${tile.geometry.boxWidth}px`}
					style:height={`${tile.geometry.boxHeight}px`}
					style:background-color={tile.geometry.backgroundColor}
				>
					<SlideStage
						slide={tile.slide}
						canvasSize={tile.canvasSize}
						mediaDataUrls={EMPTY_MEDIA}
						scale={tile.geometry.scale}
					/>
					<!-- Placeholder outlines sit inside the scaled surface, so their
					     border width is pre-divided by the scale to stay visible. -->
					<div
						class="pptx-svelte-lgal-frames"
						style:width={`${tile.geometry.surfaceWidth}px`}
						style:height={`${tile.geometry.surfaceHeight}px`}
						style:transform={`scale(${tile.geometry.scale})`}
					>
						{#each tile.geometry.frames as frame (frame.key)}
							<div
								class="pptx-svelte-lgal-frame"
								style:left={`${frame.left}px`}
								style:top={`${frame.top}px`}
								style:width={`${frame.width}px`}
								style:height={`${frame.height}px`}
								style:border-width={`${tile.geometry.frameBorderWidth}px`}
							></div>
						{/each}
					</div>
				</div>
				<span class="pptx-svelte-lgal-name">{tile.layout.name}</span>
			</button>
		{/each}
	{/if}
</div>

<style>
	.pptx-svelte-lgal {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 8px;
		width: 620px;
		max-height: 520px;
		overflow-y: auto;
		padding: 12px;
	}

	.pptx-svelte-lgal-empty {
		grid-column: 1 / -1;
		padding: 8px;
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 11px;
	}

	.pptx-svelte-lgal-tile {
		display: flex;
		min-width: 0;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		border: 2px solid transparent;
		border-radius: var(--pptx-radius, 6px);
		background: transparent;
		color: inherit;
		padding: 4px;
		font: inherit;
		font-size: 11px;
		cursor: pointer;
	}

	.pptx-svelte-lgal-tile:hover {
		background: var(--pptx-accent, #33334d);
	}

	.pptx-svelte-lgal-current {
		border-color: var(--pptx-primary, #2563eb);
		background: color-mix(in srgb, var(--pptx-primary, #2563eb) 12%, transparent);
	}

	.pptx-svelte-lgal-thumb {
		position: relative;
		flex: none;
		overflow: hidden;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 2px;
	}

	.pptx-svelte-lgal-frames {
		position: absolute;
		left: 0;
		top: 0;
		transform-origin: top left;
	}

	.pptx-svelte-lgal-frame {
		position: absolute;
		border-style: dashed;
		border-color: color-mix(in srgb, var(--pptx-muted-foreground, #94a3b8) 70%, transparent);
		background: color-mix(in srgb, var(--pptx-background, #0f172a) 20%, transparent);
	}

	.pptx-svelte-lgal-name {
		width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: center;
	}
</style>
