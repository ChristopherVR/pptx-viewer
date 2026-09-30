<script lang="ts">
	/** Home slide controls; operations preserve history and active-slide navigation. */
	import { ChevronDown, FolderPlus, LayoutGrid, Plus, RotateCcw } from '@lucide/svelte';
	import type { PptxLayoutOption, PptxLayoutPreview } from 'pptx-viewer-core';
	import { scopeLayoutOptionsToSlide } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { anchoredPopup } from '../anchored-popup';
	import LayoutGalleryMenu from './LayoutGalleryMenu.svelte';
	import SlideTemplatesLauncher from './SlideTemplatesLauncher.svelte';

	const { editor, onnavigate }: { editor: EditorState; onnavigate: (index: number) => void } =
		$props();
	const t = useTranslator();

	let openMenu = $state<'new' | 'layout' | null>(null);
	let layouts = $state<PptxLayoutOption[]>([]);
	/**
	 * Layout artwork for the thumbnails, fetched alongside the layout list.
	 *
	 * Parsing every layout part is only worth doing once the user opens the
	 * menu; core memoises the result, so reopening it costs nothing.
	 */
	let previews = $state<ReadonlyMap<string, PptxLayoutPreview>>(new Map());
	// eslint-disable-next-line prefer-const
	let newSplitEl: HTMLElement | undefined = $state();
	// eslint-disable-next-line prefer-const
	let layoutSplitEl: HTMLElement | undefined = $state();

	/** Layout gallery scoped to the active slide's own master (shared `scopeLayoutOptionsToSlide`); dedupes same-named layouts across a multi-master deck. */
	const scopedLayouts = $derived(
		scopeLayoutOptionsToSlide(layouts, editor.slides[editor.currentSlideIndex]?.layoutPath),
	);

	function run(action: () => number | null): void {
		const index = action();
		if (index !== null) {
			onnavigate(index);
		}
		openMenu = null;
	}

	async function runAsync(action: () => Promise<number | null>): Promise<void> {
		const index = await action();
		if (index !== null) {
			onnavigate(index);
		}
		openMenu = null;
	}

	function onFocusOut(event: FocusEvent): void {
		const root = event.currentTarget as HTMLElement;
		if (!(event.relatedTarget instanceof Node) || !root.contains(event.relatedTarget)) {
			openMenu = null;
		}
	}

	async function toggleLayoutMenu(): Promise<void> {
		if (openMenu === 'layout') {
			openMenu = null;
			return;
		}
		layouts = await editor.slidesOps.availableLayouts();
		previews = await editor.slidesOps.layoutPreviews();
		openMenu = 'layout';
	}
</script>

<div class="pptx-svelte-rgroup" role="group" aria-label={t('pptx.ribbon.slides')} data-ribbon-group="home.slides">
	<div class="pptx-svelte-rgroup-row" data-pptx-chrome="slides-controls">
		<!-- New Slide split button: primary inserts a blank slide; the chevron
		     dropdown re-houses Duplicate / Delete (no thumbnail context menu). -->
		<div class="pptx-svelte-rgroup-split" data-ribbon-control="home.slides.newSlide" data-pptx-chrome="split-button" bind:this={newSplitEl} onfocusout={onFocusOut}>
			<button
				data-pptx-chrome="split-main"
				type="button"
				class="pptx-svelte-rgroup-main"
				disabled={!editor.editable}
				aria-label={t('pptx.home.newSlide')}
				title={t('pptx.home.newSlide')}
				onclick={() => run(() => editor.slidesOps.insertSlideAfterCurrent())}
			>
				<Plus size={16} />
				<span>{t('pptx.home.newSlide')}</span>
			</button>
			<button
				data-pptx-chrome="split-caret"
				type="button"
				class="pptx-svelte-rgroup-caret"
				disabled={!editor.editable}
				aria-haspopup="menu"
				aria-expanded={openMenu === 'new'}
				aria-label={t('pptx.home.chooseLayout')}
				title={t('pptx.home.chooseLayout')}
				onclick={() => (openMenu = openMenu === 'new' ? null : 'new')}
			>
				<ChevronDown size={16} />
			</button>
			{#if openMenu === 'new'}
				<div class="pptx-svelte-rgroup-pop" role="menu" use:anchoredPopup={{ anchor: newSplitEl }}>
					<button type="button" role="menuitem" onclick={() => run(() => editor.slidesOps.duplicateCurrentSlide())}>{t('pptx.ribbon.duplicateSlide')}</button>
					<button type="button" role="menuitem" class="pptx-svelte-rgroup-pop-danger" onclick={() => run(() => editor.slidesOps.deleteCurrentSlide())}>{t('pptx.arrange.delete')}</button>
				</div>
			{/if}
		</div>

		<!-- Slide Templates gallery: pre-designed starter slides (React parity). -->
		<SlideTemplatesLauncher {editor} {onnavigate} />

		<!-- Layout dropdown: re-map the current slide onto another layout. -->
		<div class="pptx-svelte-rgroup-split" data-ribbon-control="home.slides.layout" bind:this={layoutSplitEl} onfocusout={onFocusOut}>
			<button
				type="button"
				class="pptx-svelte-rgroup-main"
				disabled={!editor.editable}
				aria-haspopup="menu"
				aria-expanded={openMenu === 'layout'}
				aria-label={t('pptx.master.layout')}
				title={t('pptx.master.layout')}
				onclick={() => void toggleLayoutMenu()}
			>
				<LayoutGrid size={16} />
				<span>{t('pptx.master.layout')}</span>
			</button>
			{#if openMenu === 'layout'}
				<div class="pptx-svelte-rgroup-pop pptx-svelte-rgroup-pop-wide" role="menu" use:anchoredPopup={{ anchor: layoutSplitEl }}>
					<LayoutGalleryMenu
						layouts={scopedLayouts}
						{previews}
						currentLayoutPath={editor.slides[editor.currentSlideIndex]?.layoutPath}
						onselect={(layout) => void runAsync(() => editor.slidesOps.applyLayout(layout.path))}
					/>
				</div>
			{/if}
		</div>

		<button
			type="button"
			class="pptx-svelte-rgroup-main"
			disabled={!editor.editable}
			title={t('pptx.sections.resetSlideTitle')} data-ribbon-control="home.slides.reset"
			onclick={() => void runAsync(() => editor.slidesOps.resetSlide())}
		>
			<RotateCcw size={16} />
			<span>{t('pptx.animations.reset')}</span>
		</button>

		<button
			type="button"
			class="pptx-svelte-rgroup-main"
			disabled={!editor.editable || editor.slides.length === 0}
			title={t('pptx.sections.addSection')} data-ribbon-control="home.slides.section"
			onclick={() => editor.sectionOps.add(t('pptx.sections.defaultName'))}
		>
			<FolderPlus size={16} />
			<span>{t('pptx.sections.sectionButtonLabel')}</span>
		</button>
	</div>
	<span class="pptx-svelte-rgroup-label">{t('pptx.ribbon.slides')}</span>
</div>

<style>
	.pptx-svelte-rgroup {
		display: flex;
		flex: none;
		flex-direction: column;
		align-items: center;
		gap: 3px;
	}

	.pptx-svelte-rgroup-label {
		font-size: 9px;
		color: var(--pptx-muted-foreground, #94a3b8);
		line-height: 1;
	}

	.pptx-svelte-rgroup-row {
		display: inline-flex;
		align-items: center;
		gap: 3px;
	}

	.pptx-svelte-rgroup-split {
		position: relative;
		display: inline-flex;
		align-items: stretch;
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		overflow: visible;
	}

	.pptx-svelte-rgroup-main,
	.pptx-svelte-rgroup-caret {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		justify-content: center;
		min-width: 26px;
		height: 26px;
		padding: 0 8px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 11.5px;
	}

	.pptx-svelte-rgroup-caret {
		min-width: 18px;
		padding: 0 4px;
		border-left: 1px solid color-mix(in srgb, var(--pptx-border, #33334d) 50%, transparent);
		border-top-left-radius: 0;
		border-bottom-left-radius: 0;
	}

	.pptx-svelte-rgroup-main {
		border-top-right-radius: 0;
		border-bottom-right-radius: 0;
	}

	.pptx-svelte-rgroup-main:hover:not(:disabled),
	.pptx-svelte-rgroup-caret:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-rgroup-main:disabled,
	.pptx-svelte-rgroup-caret:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-rgroup-main :global(svg),
	.pptx-svelte-rgroup-caret :global(svg) {
		width: 14px;
		height: 14px;
	}

	.pptx-svelte-rgroup-pop {
		position: absolute;
		top: 100%;
		left: 0;
		z-index: 50;
		margin-top: 4px;
		display: flex;
		min-width: 168px;
		max-height: 260px;
		overflow-y: auto;
		flex-direction: column;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: calc(var(--pptx-radius, 6px) + 2px);
		background: var(--pptx-popover, #111827);
		color: var(--pptx-popover-foreground, #f3f4f6);
		padding: 4px;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.35), 0 4px 6px -4px rgba(0, 0, 0, 0.35);
	}

	.pptx-svelte-rgroup-pop button {
		display: block;
		width: 100%;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: transparent;
		color: inherit;
		padding: 6px 10px;
		text-align: left;
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}

	.pptx-svelte-rgroup-pop button:hover {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-rgroup-pop-danger:hover {
		background: #7f1d1d !important;
		color: #fecaca !important;
	}

	/* The gallery brings its own grid width and padding. */
	.pptx-svelte-rgroup-pop-wide {
		min-width: 0;
		max-height: none;
		overflow: visible;
		padding: 0;
	}
</style>
