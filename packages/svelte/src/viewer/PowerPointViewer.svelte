<script lang="ts">
	/**
	 * PowerPointViewer: the Svelte 5 viewer root. It is deliberately thin
	 * composition: every reactive controller (loader, editor, collaboration,
	 * presentation, export, AI, options) is built by `createViewerState`, all
	 * heavy logic lives in `pptx-viewer-core` / `pptx-viewer-shared` and this
	 * package's `.ts` modules, and the chrome / overlay markup lives in
	 * `components/`. What is left here is the prop contract, the DOM-bound
	 * locals the composition needs getters for (`bind:this` targets and the
	 * measured viewport), and the imperative instance API, which Svelte
	 * requires the component itself to `export`.
	 */
	import { onDestroy } from 'svelte';
	import { buildUserFontFaceStyles, themeToCssVars } from 'pptx-viewer-shared';
	import type { ViewerMode } from 'pptx-viewer-shared';

	import { createTranslator } from '../i18n/translator';
	import AiDock from './components/ai/AiDock.svelte';
	import CollaborationChrome from './collab/components/CollaborationChrome.svelte';
	import ExportProgressModal from './components/ExportProgressModal.svelte';
	import MobileActionSheets from './components/MobileActionSheets.svelte';
	import PresentationOverlays from './components/PresentationOverlays.svelte';
	import SignatureStrippedDialog from './components/SignatureStrippedDialog.svelte';
	import VersionHistoryPanel from './components/VersionHistoryPanel.svelte';
	import ViewerChrome from './components/ViewerChrome.svelte';
	import ViewerMain from './components/ViewerMain.svelte';
	import ViewerGlobalStyles from './components/ViewerGlobalStyles.svelte';
	import ViewerParityOverlays from './components/ViewerParityOverlays.svelte';
	import ViewerStatusBar from './components/ViewerStatusBar.svelte';
	import { presentationSwipe } from './presentation-swipe';
	import { createViewerState } from './state/create-viewer-state.svelte';
	import { ThemeLocaleState } from './state/theme-locale.svelte';
	import { toViewerStateOptions } from './state/viewer-state-options';
	import { styleToString } from './style';
	import type { PowerPointViewerProps } from './types';

	const props: PowerPointViewerProps = $props();
	// Only the defaulted props get an alias; the rest are read as `props.x`, which
	// is what keeps them reactive (a destructured top-level read would snapshot).
	const className = $derived(props.class ?? '');
	const showThumbnails = $derived(props.showThumbnails ?? true);
	const showToolbar = $derived(props.showToolbar ?? true);
	const showNotes = $derived(props.showNotes ?? true);

	$effect(() => {
		const css = buildUserFontFaceStyles(props.fonts ?? []);
		if (!css || typeof document === 'undefined') {
			return;
		}
		const style = document.createElement('style');
		style.dataset.pptxUserFonts = 'svelte';
		style.textContent = css;
		document.head.appendChild(style);
		return () => style.remove();
	});

	// Theme + locale selection (File > Options Appearance/Language, Design tab).
	const themeLocale = new ThemeLocaleState({
		getDefaultThemeKey: () => props.defaultThemeKey,
		getAvailableThemes: () => props.availableThemes,
		getThemeProp: () => props.theme,
		getOnThemeChange: () => props.onThemeChange,
		getDefaultLocale: () => props.defaultLocale,
		getLocaleProp: () => props.locale ?? 'en',
		getOnLocaleChange: () => props.onLocaleChange,
	});
	const t = createTranslator(() => themeLocale.effectiveLocale);

	// DOM-bound locals: `bind:this` / child-reported values the composition can
	// only read through getters, since the markup that owns them lives here.
	// eslint-disable-next-line no-unassigned-vars
	let rootEl: HTMLDivElement | undefined;
	// eslint-disable-next-line prefer-const
	let stageHolderEl = $state<HTMLDivElement>();
	// eslint-disable-next-line prefer-const
	let masterScale = $state(1);
	// eslint-disable-next-line prefer-const
	let viewportWidth = $state(0);
	// eslint-disable-next-line prefer-const
	let viewportHeight = $state(0);

	const vm = createViewerState(
		toViewerStateOptions(() => props, {
			t,
			getStageHolderEl: () => stageHolderEl,
			getRootEl: () => rootEl,
			getViewportWidth: () => viewportWidth,
			getViewportHeight: () => viewportHeight,
			getMasterScale: () => masterScale,
		}),
	);
	onDestroy(() => vm.destroy());

	// Stable controller references (the bag is built once and never reassigned).
	// svelte-ignore state_referenced_locally
	const { loader, viewer, editor, parityUi, collab, dialogs, exportUi } = vm;

	// Emit CSS custom properties ONLY for an explicitly chosen theme, matching
	// React's `useThemeStyle` (returns nothing when no theme is set). Emitting a
	// full `defaultCssVars()` palette here would hard-override any `--pptx-*`
	// vars a host sets on `:root`, freezing the chrome to the built-in dark
	// palette; instead the chrome's own `var(--pptx-*, <dark fallback>)` lookups
	// resolve against the host `:root` (or the dark fallbacks when standalone).
	const rootStyle = $derived(styleToString(themeToCssVars(themeLocale.effectiveTheme)));

	// ── Imperative API (exposed on the component instance) ────────────────
	// Svelte requires these `export`s to live on the component, but every body
	// is built in `editor/`, `export/` and `state/` modules.
	export const undo = vm.editingApi.undo;
	export const redo = vm.editingApi.redo;
	export const canUndo = vm.editingApi.canUndo;
	export const canRedo = vm.editingApi.canRedo;
	export const deleteSelected = vm.editingApi.deleteSelected;
	export const getSelectedElementId = vm.editingApi.getSelectedElementId;
	export const save = vm.editingApi.save;
	export const downloadAs = vm.editingApi.downloadAs;
	export const downloadPptx = vm.editingApi.downloadPptx;
	export const packageForSharing = vm.editingApi.packageForSharing;
	export const getContent = vm.editingApi.save;
	export const exportSlidePng = vm.exportingApi.exportSlidePng;
	export const copySlideAsImage = vm.exportingApi.copySlideAsImage;
	export const exportPdf = vm.exportingApi.exportPdf;
	export const exportGif = vm.exportingApi.exportGif;
	export const exportVideo = vm.exportingApi.exportVideo;
	export const print = vm.exportingApi.print;
	export const goTo = vm.deck.goTo;
	export const goPrev = vm.deck.goPrev;
	export const goNext = vm.deck.goNext;
	export const getZoom = vm.deck.getZoom;
	export const setZoom = vm.deck.setZoom;
	export const zoomIn = vm.deck.zoomIn;
	export const zoomOut = vm.deck.zoomOut;
	export const zoomReset = vm.deck.zoomReset;
	export const getMode = (): ViewerMode => vm.deck.getMode();
	export const setMode = vm.deck.setMode;
	export const getActiveSlideIndex = vm.deck.getActiveSlideIndex;
	export const setActiveSlideIndex = vm.deck.setActiveSlideIndex;
	export const getSlideCount = vm.deck.getSlideCount;
	export const isDirty = vm.deck.isDirty;
	export const getSlides = vm.deck.getSlides;
	export const getSlide = vm.deck.getSlide;
	export const getActiveSlide = vm.deck.getActiveSlide;
	export const getElements = vm.deck.getElements;
	export const getElementById = vm.deck.getElementById;
	export const updateElement = vm.deck.updateElement;
	export const deleteElements = vm.deck.deleteElements;
	export const duplicateElement = vm.deck.duplicateElement;
	export const getSelectedElementIds = vm.deck.getSelectedElementIds;
	export const selectElements = vm.deck.selectElements;
	export const clearSelection = vm.deck.clearSelection;
	export const addSlide = vm.deck.addSlide;
	export const deleteSlides = vm.deck.deleteSlides;
	export const duplicateSlides = vm.deck.duplicateSlides;
	export const moveSlide = vm.deck.moveSlide;
	export const toggleHideSlides = vm.deck.toggleHideSlides;
</script>

<svelte:document onfullscreenchange={vm.onFullscreenChange} />
<ViewerGlobalStyles />

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<!-- The viewer root is a keyboard-navigable application region (slide navigation). -->
<div
	use:presentationSwipe={{
		isEnabled: () => viewer.isFullscreen,
		onNext: () => vm.presentation.advance(true),
		onPrevious: () => {
			if (!vm.presentation.retreat()) {
				viewer.prev();
			}
		},
	}}
	bind:this={rootEl}
	class={`pptx-svelte-viewer ${className}`}
	class:pptx-svelte-fullscreen={viewer.isFullscreen}
	class:pptx-svelte-show-grid={parityUi.preferences.showGrid}
	class:pptx-svelte-show-rulers={parityUi.preferences.showRulers}
	class:pptx-svelte-show-guides={parityUi.showGuides}
	class:pptx-svelte-reduced-motion={parityUi.preferences.reducedMotion}
	style={rootStyle}
	role="region"
	aria-label={t('pptx.titleBar.defaultFileName')}
	aria-busy={loader.loading}
	tabindex="0"
	onkeydown={vm.onKeydown}
	onwheel={vm.onWheel}
	onpointerdown={() => {
		if (vm.presenterSession.isAudience && !document.fullscreenElement) {
			void rootEl?.requestFullscreen?.().catch(() => undefined);
		}
	}}
>
	{#if showToolbar && vm.chromeVisible}
		<ViewerChrome
			{vm}
			fileName={props.fileName}
			{showNotes}
			hiddenActions={props.hiddenActions}
			accountAuth={props.accountAuth}
			theme={themeLocale.effectiveTheme}
			onsettheme={(next) => themeLocale.setTheme(next)}
			aiEnabled={Boolean(props.ai)}
			onpresenter={vm.enterPresenterView}
		/>
	{/if}
	<ExportProgressModal
		open={exportUi.open}
		title={exportUi.title}
		progress={exportUi.progress}
		statusMessage={exportUi.status}
		oncancel={() => exportUi.cancel()}
	/>
	{#if vm.versionHistoryOpen}<VersionHistoryPanel filePath={props.filePath} onclose={() => (vm.versionHistoryOpen = false)} onrestore={(bytes) => loader.load(bytes)} />{/if}
	{#if vm.signatureWarningOpen}<SignatureStrippedDialog signatureCount={loader.digitalSignatureCount} onclose={vm.closeSignatureWarning} />{/if}
	<ViewerParityOverlays ui={parityUi} {editor} {exportUi} slides={vm.displaySlides} canvasSize={loader.canvasSize} mediaDataUrls={loader.mediaDataUrls} current={viewer.current} fullscreen={viewer.isFullscreen} locale={themeLocale.effectiveLocale} themeKey={themeLocale.themeKey} themeCatalog={themeLocale.catalog} onsetthemekey={(key) => themeLocale.setThemeKey(key)} availableLocales={props.availableLocales} onsetlocale={(code) => themeLocale.setLocale(code)} onselectslide={(index) => viewer.goTo(index)} onmoveslide={vm.deck.moveSlide} optionsState={vm.optionsState} aiEnabled={Boolean(props.ai)} />
	<ViewerMain
		{vm}
		{t}
		{showThumbnails}
		{showNotes}
		ai={props.ai}
		onnotesupdate={props.onnotesupdate}
		onstageholder={(el) => {
			stageHolderEl = el ?? undefined;
		}}
		onstageresize={(width, height) => {
			viewportWidth = width;
			viewportHeight = height;
		}}
		onscalechange={(next) => {
			masterScale = next;
		}}
	/>
	<PresentationOverlays {vm} />
	{#if vm.editingActive && vm.displaySlides.length > 0}
		<MobileActionSheets
			active={vm.activeMobileSheet}
			onactivechange={vm.setActiveMobileSheet}
			{editor}
			handler={loader.handler}
			presentationTheme={loader.presentationTheme}
			onthemechange={(next) => { loader.presentationTheme = next; loader.colorScheme = next.colorScheme; }}
			slides={vm.displaySlides}
			canvasSize={loader.canvasSize}
			mediaDataUrls={loader.mediaDataUrls}
			current={viewer.current}
			onselect={(index) => viewer.goTo(index)}
			onzoomin={() => viewer.zoomIn(vm.effectivePercent)}
			onzoomout={() => viewer.zoomOut(vm.effectivePercent)}
			onzoomfit={() => viewer.zoomToFit()}
		/>
	{/if}
	{#if showToolbar && vm.chromeVisible}
		<ViewerStatusBar {vm} {showNotes} collaboration={props.collaboration} />
	{/if}
	<CollaborationChrome
		{collab}
		{dialogs}
		shareDefaults={props.shareDefaults}
		showOverlay={collab.active && vm.chromeVisible}
	/>
	{#if props.ai && vm.ai.panelOpen && vm.chromeVisible}
		<AiDock
			bridge={vm.ai.bridge}
			config={props.ai}
			aiPanel={vm.ai.panel}
			onclose={() => (vm.ai.panelOpen = false)}
		/>
	{/if}
</div>

<style>
	.pptx-svelte-viewer {
		position: relative;
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

</style>
