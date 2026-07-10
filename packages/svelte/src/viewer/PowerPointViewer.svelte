<script lang="ts">
	/**
	 * PowerPointViewer: the Svelte 5 viewer root. Wires the reactive load
	 * pipeline (`PresentationLoader`) and chrome state (`ViewerState`) to the
	 * slide stage, toolbar, and thumbnail rail. All heavy logic lives in
	 * `pptx-viewer-core` / `pptx-viewer-shared` and this package's `.ts`
	 * modules; this SFC is thin composition.
	 */
	import { onDestroy } from 'svelte';
	import { defaultCssVars, themeToCssVars } from 'pptx-viewer-shared';

	import { createTranslator } from '../i18n/translator';
	import { provideTranslator } from '../i18n/context';
	import EditToolbar from './components/EditToolbar.svelte';
	import ViewerBody from './components/ViewerBody.svelte';
	import ViewerToolbar from './components/ViewerToolbar.svelte';
	import { createEditingApi } from './editor/editing-api';
	import { EditorController } from './editor/editor-controller.svelte';
	import { EditorState } from './editor/editor-state.svelte';
	import { createExportWiring } from './export/export-wiring.svelte';
	import { createExportingApi } from './export/exporting-api';
	import { PresentationLoader } from './state/presentation-loader.svelte';
	import { provideSmartArt3D } from './state/smart-art-3d-context';
	import { ViewerState } from './state/viewer-state.svelte';
	import { fitScale } from './state/navigation';
	import { useViewerEffects } from './state/viewer-effects.svelte';
	import { createViewportHandlers } from './state/viewport-handlers';
	import { mergeStyles, styleToString } from './style';
	import type { PowerPointViewerProps } from './types';

	const {
		source,
		theme,
		locale = 'en',
		initialSlide = 0,
		showThumbnails = true,
		showToolbar = true,
		showNotes = true,
		smartArt3D = false,
		editable = false,
		class: className = '',
		onload,
		onerror,
		onslidechange,
		onnotesupdate,
		onchange,
	}: PowerPointViewerProps = $props();

	const t = createTranslator(() => locale);
	provideTranslator(t);
	provideSmartArt3D(() => smartArt3D);

	const loader = new PresentationLoader();
	const viewer = new ViewerState();

	// ── Editing ──────────────────────────────────────────────────────────
	// `editor.slides` is the single editable source of truth for the stage,
	// thumbnails, and notes; it is seeded from the loader on every successful
	// load. The controller wires selection / gestures / inline text / keyboard
	// to the history-tracked editor. Assigned by ViewerBody's onstageholder.
	// eslint-disable-next-line prefer-const
	let stageHolderEl = $state<HTMLDivElement>();
	const editor = new EditorState({
		getCurrent: () => viewer.current,
		getHandler: () => loader.handler,
		onChange: () => onchange?.(),
	});
	const controller = new EditorController(editor, {
		getScale: () => scale,
		getCurrent: () => viewer.current,
		getPresenting: () => viewer.isFullscreen,
		getStageRoot: () => stageHolderEl?.querySelector('.pptx-svelte-stage') ?? null,
		getHolderEl: () => stageHolderEl ?? null,
	});

	useViewerEffects({
		getSource: () => source,
		getEditable: () => editable,
		getInitialSlide: () => initialSlide,
		getTranslator: () => t,
		loader,
		viewer,
		editor,
		controller,
		getOnload: () => onload,
		getOnerror: () => onerror,
		getOnslidechange: () => onslidechange,
	});

	onDestroy(() => {
		controller.destroy();
		exportWiring.destroy();
		loader.dispose();
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
	// Render the editable slide array (single source of truth), so committed
	// edits flow to the stage, thumbnails, and notes panel.
	const displaySlides = $derived(editor.slides);
	const activeSlide = $derived(displaySlides[viewer.current]);
	const chromeVisible = $derived(!viewer.isFullscreen);
	const editingActive = $derived(editable && !viewer.isFullscreen);

	const rootStyle = $derived(
		styleToString(mergeStyles(defaultCssVars(), themeToCssVars(theme))),
	);

	// ── Fullscreen / keyboard ────────────────────────────────────────────
	// Assigned by the template's bind:this (invisible to the linter).
	// eslint-disable-next-line no-unassigned-vars
	let rootEl: HTMLDivElement | undefined;

	const { onFullscreenToggle, onFullscreenChange, onKeydown } = createViewportHandlers({
		getRootEl: () => rootEl,
		viewer,
		controller,
		getEditingActive: () => editingActive,
	});

	// ── Export (PNG / PDF) ───────────────────────────────────────────────
	// The off-screen capture stage mounts into the viewer root once export is
	// first used; see `export/export-wiring.svelte.ts`.
	const exportWiring = createExportWiring({
		getContainer: () => rootEl,
		getSlides: () => editor.slides,
		getCanvasSize: () => loader.canvasSize,
		getMediaDataUrls: () => loader.mediaDataUrls,
		getCurrent: () => viewer.current,
		getTranslator: () => t,
		getSmartArt3D: () => smartArt3D,
	});

	// ── Speaker notes ────────────────────────────────────────────────────
	let notesExpanded = $state(false);

	function onNotesToggle(): void {
		notesExpanded = !notesExpanded;
	}

	// Route notes edits through the history-tracked editor when editable (so
	// they participate in undo/redo and persist to `save()`), then always
	// forward to the host `onnotesupdate` callback.
	function onNotesCommit(notes: string): void {
		if (editable) {
			editor.commitNotes(notes);
		}
		onnotesupdate?.(notes);
	}

	// ── Imperative editing API (exposed on the component instance) ────────
	const editingApi = createEditingApi(editor);
	export const undo = editingApi.undo;
	export const redo = editingApi.redo;
	export const canUndo = editingApi.canUndo;
	export const canRedo = editingApi.canRedo;
	export const deleteSelected = editingApi.deleteSelected;
	export const getSelectedElementId = editingApi.getSelectedElementId;
	export const save = editingApi.save;
	export const downloadPptx = editingApi.downloadPptx;

	// ── Imperative export API (exposed on the component instance) ─────────
	const exportingApi = createExportingApi(exportWiring.controller);
	export const exportSlidePng = exportingApi.exportSlidePng;
	export const exportPdf = exportingApi.exportPdf;
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
			showNotes={showNotes && loader.slides.length > 0}
			{notesExpanded}
			onnotestoggle={onNotesToggle}
			editable={editable && loader.slides.length > 0}
			canUndo={editor.canUndo}
			canRedo={editor.canRedo}
			dirty={editor.dirty}
			onundo={() => editor.undo()}
			onredo={() => editor.redo()}
			onsave={() => void editor.save()}
			ondownload={() => void downloadPptx()}
		/>
	{/if}
	{#if editingActive}
		<EditToolbar {editor} />
	{/if}
	<ViewerBody
		{t}
		{editor}
		{chromeVisible}
		{showThumbnails}
		{showNotes}
		{displaySlides}
		canvasSize={loader.canvasSize}
		mediaDataUrls={loader.mediaDataUrls}
		current={viewer.current}
		onselect={(index) => viewer.goTo(index)}
		loading={loader.loading}
		isEncrypted={loader.isEncrypted}
		error={loader.error}
		{activeSlide}
		{scale}
		presenting={viewer.isFullscreen}
		{editingActive}
		{controller}
		onstageresize={(width, height) => {
			viewportWidth = width;
			viewportHeight = height;
		}}
		onstageholder={(el) => {
			stageHolderEl = el ?? undefined;
		}}
		{notesExpanded}
		onNotesCommit={editable || onnotesupdate ? onNotesCommit : undefined}
		{onNotesToggle}
	/>
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
</style>
