<script lang="ts">
	/**
	 * Home slide controls. Buttons, caption, gating and both layout galleries
	 * (New Slide's caret and Layout) are the shared `pptx-ui-ribbon-home-slides`
	 * element; this adapter loads the deck's layouts when a gallery opens, draws
	 * each layout's artwork through its own slide renderer, keeps the template
	 * gallery dialog and runs every edit so operations keep history and
	 * active-slide navigation.
	 */
	import type { PptxLayoutOption, PptxLayoutPreview } from 'pptx-viewer-core';
	import {
		homeSnapshotTranslator,
		scopeLayoutOptionsToSlide,
		slidesHomeControls,
	} from 'pptx-viewer-shared';
	import type { PptxUiRibbonHomeElement, RibbonHomeRequestEvent } from 'pptx-viewer-shared';
	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { createLayoutArtwork } from './home-adapter';
	import SlideTemplatesLauncher from './SlideTemplatesLauncher.svelte';

	const { editor, onnavigate }: { editor: EditorState; onnavigate: (index: number) => void } =
		$props();
	const t = useTranslator();

	let templatesOpen = $state(false);
	let layouts = $state<PptxLayoutOption[]>([]);
	/** Artwork is fetched alongside the layout list, only once a gallery opens. */
	let previews = $state<ReadonlyMap<string, PptxLayoutPreview>>(new Map());
	const layoutArtwork = createLayoutArtwork();
	const currentLayoutPath = $derived(editor.slides[editor.currentSlideIndex]?.layoutPath);
	/** Scoped to the active slide's own master; dedupes same-named layouts across masters. */
	const scopedLayouts = $derived(scopeLayoutOptionsToSlide(layouts, currentLayoutPath));

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
				layouts: {
					layouts: scopedLayouts.map(({ path, name }) => ({ path, name })),
					current: currentLayoutPath,
					previews,
				},
			}),
			'home.slides.section': { disabled: !editor.editable || editor.slides.length === 0 },
		},
		translate: homeSnapshotTranslator(['slides'], t),
	});

	function go(index: number | null): void {
		if (index !== null) {
			onnavigate(index);
		}
	}
	async function load(): Promise<void> {
		layouts = await editor.slidesOps.availableLayouts();
		previews = await editor.slidesOps.layoutPreviews();
	}
	function popup(event: Event): void {
		const { id, open } = (event as CustomEvent<{ id: string; open: boolean }>).detail;
		if (open && (id === 'home.slides.newSlide' || id === 'home.slides.layout')) {
			void load();
		}
	}
	function request(event: RibbonHomeRequestEvent): void {
		const { id, value } = event.detail;
		switch (id) {
			case 'home.slides.newSlide':
				if (value === undefined) {
					go(editor.slidesOps.insertSlideAfterCurrent());
				} else {
					const name = layouts.find((layout) => layout.path === value)?.name;
					go(editor.slidesOps.insertSlideFromLayout(String(value), name));
				}
				break;
			case 'home.slides.slideTemplates':
				templatesOpen = true;
				break;
			case 'home.slides.layout':
				void editor.slidesOps.applyLayout(String(value)).then(go);
				break;
			case 'home.slides.reset':
				void editor.slidesOps.resetSlide().then(go);
				break;
			case 'home.slides.section':
				editor.sectionOps.add(t('pptx.sections.defaultName'));
		}
	}
	// eslint-disable-next-line prefer-const
	let strip: PptxUiRibbonHomeElement | undefined = $state();
	$effect(() => {
		if (strip) {
			strip.layoutArtwork = layoutArtwork;
		}
	});
</script>

<div class="pptx-svelte-rgroup">
	<pptx-ui-ribbon-home-slides
		bind:this={strip}
		state={view}
		onhome-request={request}
		onhome-popup={popup}
	></pptx-ui-ribbon-home-slides>
	<SlideTemplatesLauncher {editor} {onnavigate} bind:open={templatesOpen} />
</div>

<style>
	.pptx-svelte-rgroup {
		display: contents;
	}
</style>
