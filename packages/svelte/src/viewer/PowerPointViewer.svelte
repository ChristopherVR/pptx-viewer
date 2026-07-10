<script lang="ts">
	/**
	 * PowerPointViewer: the Svelte 5 viewer root. Wires the reactive load
	 * pipeline (`PresentationLoader`) and chrome state (`ViewerState`) to the
	 * slide stage, toolbar, and thumbnail rail. All heavy logic lives in
	 * `pptx-viewer-core` / `pptx-viewer-shared` and this package's `.ts`
	 * modules; this SFC is thin composition.
	 */
	import { onDestroy, untrack } from 'svelte';
	import { defaultCssVars, themeToCssVars } from 'pptx-viewer-shared';

	import { createTranslator } from '../i18n/translator';
	import { provideTranslator } from '../i18n/context';
	import SlideStage from './components/SlideStage.svelte';
	import ThumbnailRail from './components/ThumbnailRail.svelte';
	import ViewerToolbar from './components/ViewerToolbar.svelte';
	import { PresentationLoader } from './state/presentation-loader.svelte';
	import { provideSmartArt3D } from './state/smart-art-3d-context';
	import { ViewerState } from './state/viewer-state.svelte';
	import { fitScale } from './state/navigation';
	import { isFullscreenActive, toggleFullscreen } from './state/fullscreen';
	import { mergeStyles, styleToString } from './style';
	import type { PowerPointViewerProps } from './types';

	const {
		source,
		theme,
		locale = 'en',
		initialSlide = 0,
		showThumbnails = true,
		showToolbar = true,
		smartArt3D = false,
		class: className = '',
		onload,
		onerror,
		onslidechange,
	}: PowerPointViewerProps = $props();

	const t = createTranslator(() => locale);
	provideTranslator(t);
	provideSmartArt3D(() => smartArt3D);

	const loader = new PresentationLoader();
	const viewer = new ViewerState();
	onDestroy(() => loader.dispose());

	// ── Load pipeline ────────────────────────────────────────────────────
	$effect(() => {
		const raw = source;
		if (raw) {
			// untrack: load()'s synchronous prefix reads loader state (e.g. the
			// previous handler); without this the effect would re-run, and
			// re-load, every time a load commits.
			untrack(() => void loader.load(raw));
		}
	});

	let announcedLoadCount = 0;
	$effect(() => {
		const count = loader.loadCount;
		if (count > 0 && count !== announcedLoadCount) {
			announcedLoadCount = count;
			viewer.reset(loader.slides.length, initialSlide);
			onload?.({ slideCount: loader.slides.length, canvasSize: loader.canvasSize });
		}
	});

	let announcedError: string | null = null;
	$effect(() => {
		const message = loader.isEncrypted ? t('pptx.encryptedFile.message') : loader.error;
		if (message && message !== announcedError) {
			announcedError = message;
			onerror?.(message);
		}
	});

	let announcedSlide = -1;
	$effect(() => {
		const index = viewer.current;
		if (loader.loadCount > 0 && index !== announcedSlide) {
			announcedSlide = index;
			onslidechange?.(index);
		}
	});

	// ── Layout / zoom ────────────────────────────────────────────────────
	// The template's bind:clientWidth/Height write these (invisible to the linter).
	// eslint-disable-next-line prefer-const
	let viewportWidth = $state(0);
	// eslint-disable-next-line prefer-const
	let viewportHeight = $state(0);
	const fittedScale = $derived(
		fitScale(
			viewportWidth,
			viewportHeight,
			loader.canvasSize.width,
			loader.canvasSize.height,
			viewer.isFullscreen ? 0 : 24,
		),
	);
	const scale = $derived(
		viewer.isFullscreen || viewer.zoomPercent === null ? fittedScale : viewer.zoomPercent / 100,
	);
	const effectivePercent = $derived(Math.max(1, Math.round(scale * 100)));
	const activeSlide = $derived(loader.slides[viewer.current]);
	const chromeVisible = $derived(!viewer.isFullscreen);

	const rootStyle = $derived(
		styleToString(mergeStyles(defaultCssVars(), themeToCssVars(theme))),
	);

	// ── Fullscreen / keyboard ────────────────────────────────────────────
	// Assigned by the template's bind:this (invisible to the linter).
	// eslint-disable-next-line no-unassigned-vars
	let rootEl: HTMLDivElement | undefined;

	function onFullscreenToggle(): void {
		if (rootEl) {
			void toggleFullscreen(rootEl);
		}
	}

	function onFullscreenChange(): void {
		viewer.isFullscreen = isFullscreenActive();
	}

	function onKeydown(event: KeyboardEvent): void {
		if (viewer.handleNavigationKey(event.key)) {
			event.preventDefault();
		}
	}
</script>

<svelte:document onfullscreenchange={onFullscreenChange} />

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<!-- The viewer root is a keyboard-navigable application region (slide navigation). -->
<div
	bind:this={rootEl}
	class={`pptx-svelte-viewer ${className}`}
	class:pptx-svelte-fullscreen={viewer.isFullscreen}
	style={rootStyle}
	role="application"
	aria-label={t('pptx.titleBar.defaultFileName')}
	tabindex="0"
	onkeydown={onKeydown}
>
	{#if showToolbar && chromeVisible}
		<ViewerToolbar
			current={viewer.current}
			total={viewer.slideCount}
			zoomPercent={effectivePercent}
			isFullscreen={viewer.isFullscreen}
			onprev={() => viewer.prev()}
			onnext={() => viewer.next()}
			onzoomin={() => viewer.zoomIn(effectivePercent)}
			onzoomout={() => viewer.zoomOut(effectivePercent)}
			onzoomfit={() => viewer.zoomToFit()}
			onfullscreen={onFullscreenToggle}
		/>
	{/if}
	<div class="pptx-svelte-body">
		{#if showThumbnails && chromeVisible && loader.slides.length > 0}
			<ThumbnailRail
				slides={loader.slides}
				canvasSize={loader.canvasSize}
				mediaDataUrls={loader.mediaDataUrls}
				current={viewer.current}
				onselect={(index) => viewer.goTo(index)}
			/>
		{/if}
		<div
			class="pptx-svelte-viewport"
			bind:clientWidth={viewportWidth}
			bind:clientHeight={viewportHeight}
		>
			{#if loader.loading}
				<div class="pptx-svelte-message" role="status">{t('common.loading')}</div>
			{:else if loader.isEncrypted}
				<div class="pptx-svelte-message" role="alert">{t('pptx.encryptedFile.message')}</div>
			{:else if loader.error}
				<div class="pptx-svelte-message" role="alert">{loader.error}</div>
			{:else if activeSlide}
				<div
					class="pptx-svelte-stage-holder"
					style={`width: ${loader.canvasSize.width * scale}px; height: ${loader.canvasSize.height * scale}px`}
				>
					<SlideStage
						slide={activeSlide}
						canvasSize={loader.canvasSize}
						mediaDataUrls={loader.mediaDataUrls}
						{scale}
						presenting={viewer.isFullscreen}
					/>
				</div>
			{:else}
				<div class="pptx-svelte-message" role="status">{t('pptx.statusBar.noSlides')}</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.pptx-svelte-viewer {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		min-height: 240px;
		background: var(--pptx-background, #11111b);
		color: var(--pptx-foreground, #e2e8f0);
		outline: none;
		overflow: hidden;
	}

	.pptx-svelte-fullscreen {
		background: #000;
	}

	.pptx-svelte-body {
		display: flex;
		flex: 1;
		min-height: 0;
	}

	.pptx-svelte-viewport {
		flex: 1;
		display: flex;
		overflow: auto;
		min-width: 0;
	}

	.pptx-svelte-stage-holder {
		margin: auto;
		flex: none;
		overflow: hidden;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.35);
	}

	.pptx-svelte-message {
		margin: auto;
		font-family: system-ui, sans-serif;
		font-size: 14px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}
</style>
