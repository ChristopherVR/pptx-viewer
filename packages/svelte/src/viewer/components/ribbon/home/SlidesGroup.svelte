<script lang="ts">
	/**
	 * Home slide controls. The buttons, caption and gating come from the shared
	 * `pptx-ui-ribbon-home-slides` element; this adapter keeps the native layout
	 * popovers (anchored to the shared triggers), the template gallery dialog and
	 * every edit, so operations keep history and active-slide navigation.
	 */
	import type { PptxLayoutOption, PptxLayoutPreview } from 'pptx-viewer-core';
	import { scopeLayoutOptionsToSlide, slidesHomeControls, homeSnapshotTranslator } from 'pptx-viewer-shared';
	import type { PptxUiRibbonHomeElement, RibbonHomeRequestEvent } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { anchoredPopup } from '../anchored-popup';
	import LayoutGalleryMenu from './LayoutGalleryMenu.svelte';
	import SlideTemplatesLauncher from './SlideTemplatesLauncher.svelte';

	const { editor, onnavigate }: { editor: EditorState; onnavigate: (index: number) => void } =
		$props();
	const t = useTranslator();

	let openMenu = $state<'new' | 'layout' | null>(null);
	let templatesOpen = $state(false);
	let layouts = $state<PptxLayoutOption[]>([]);
	/**
	 * Layout artwork for the thumbnails, fetched alongside the layout list.
	 *
	 * Parsing every layout part is only worth doing once the user opens the
	 * menu; core memoises the result, so reopening it costs nothing.
	 */
	let previews = $state<ReadonlyMap<string, PptxLayoutPreview>>(new Map());
	// eslint-disable-next-line prefer-const
	let root: HTMLElement | undefined = $state();
	// eslint-disable-next-line prefer-const
	let strip: PptxUiRibbonHomeElement | undefined = $state();
	let anchor: HTMLElement | undefined = $state();

	/** Layout gallery scoped to the active slide's own master (shared `scopeLayoutOptionsToSlide`); dedupes same-named layouts across a multi-master deck. */
	const scopedLayouts = $derived(
		scopeLayoutOptionsToSlide(layouts, editor.slides[editor.currentSlideIndex]?.layoutPath),
	);

	// The layout list loads lazily on opening, so the caret and Layout stay
	// available; Reset has no slide requirement but Section needs a slide.
	const view = $derived({
		controls: {
			...slidesHomeControls({
				editable: editor.editable,
				hasLayouts: true,
				hasSlides: editor.slides.length > 0,
				showTemplates: true,
				newSlideNeedsLayout: false,
				resetNeedsSlide: false,
				layoutOpen: openMenu === 'layout',
				newSlideOpen: openMenu === 'new',
			}),
			'home.slides.section': { disabled: !editor.editable || editor.slides.length === 0 },
		},
		translate: homeSnapshotTranslator(['slides'], t),
	});

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
		if (!(event.relatedTarget instanceof Node) || !root?.contains(event.relatedTarget)) {
			openMenu = null;
		}
	}

	// The shared triggers keep focus in the slide, so close on an outside press too.
	$effect(() => {
		if (openMenu === null) {
			return;
		}
		const close = (event: PointerEvent): void => {
			if (!(event.target instanceof Node) || !root?.contains(event.target)) {
				openMenu = null;
			}
		};
		document.addEventListener('pointerdown', close, true);
		return () => document.removeEventListener('pointerdown', close, true);
	});

	async function toggleLayoutMenu(): Promise<void> {
		if (openMenu === 'layout') {
			openMenu = null;
			return;
		}
		layouts = await editor.slidesOps.availableLayouts();
		previews = await editor.slidesOps.layoutPreviews();
		anchor = strip?.anchor('home.slides.layout');
		openMenu = 'layout';
	}

	function request(event: RibbonHomeRequestEvent): void {
		const { id, part } = event.detail;
		switch (id) {
			case 'home.slides.newSlide':
				if (part === 'caret') {
					anchor = strip?.anchor('home.slides.newSlide');
					openMenu = openMenu === 'new' ? null : 'new';
				} else {
					run(() => editor.slidesOps.insertSlideAfterCurrent());
				}
				break;
			case 'home.slides.slideTemplates':
				templatesOpen = true;
				break;
			case 'home.slides.layout':
				void toggleLayoutMenu();
				break;
			case 'home.slides.reset':
				void runAsync(() => editor.slidesOps.resetSlide());
				break;
			case 'home.slides.section':
				editor.sectionOps.add(t('pptx.sections.defaultName'));
		}
	}
</script>

<div class="pptx-svelte-rgroup" bind:this={root} onfocusout={onFocusOut}>
	<pptx-ui-ribbon-home-slides bind:this={strip} state={view} onhome-request={request}></pptx-ui-ribbon-home-slides>
	{#if openMenu === 'new'}
		<div class="pptx-svelte-rgroup-pop" role="menu" use:anchoredPopup={{ anchor }}>
			<button type="button" role="menuitem" onclick={() => run(() => editor.slidesOps.duplicateCurrentSlide())}>{t('pptx.ribbon.duplicateSlide')}</button>
			<button type="button" role="menuitem" class="pptx-svelte-rgroup-pop-danger" onclick={() => run(() => editor.slidesOps.deleteCurrentSlide())}>{t('pptx.arrange.delete')}</button>
		</div>
	{/if}
	{#if openMenu === 'layout'}
		<div class="pptx-svelte-rgroup-pop pptx-svelte-rgroup-pop-wide" role="menu" use:anchoredPopup={{ anchor }}>
			<LayoutGalleryMenu
				layouts={scopedLayouts}
				{previews}
				currentLayoutPath={editor.slides[editor.currentSlideIndex]?.layoutPath}
				onselect={(layout) => void runAsync(() => editor.slidesOps.applyLayout(layout.path))}
			/>
		</div>
	{/if}
	<SlideTemplatesLauncher {editor} {onnavigate} bind:open={templatesOpen} />
</div>

<style>
	.pptx-svelte-rgroup {
		display: contents;
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
