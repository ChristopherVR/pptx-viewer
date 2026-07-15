<script lang="ts">
	/**
	 * PowerPointViewer: the Svelte 5 viewer root. Wires the reactive load
	 * pipeline (`PresentationLoader`) and chrome state (`ViewerState`) to the
	 * slide stage, toolbar, and thumbnail rail. All heavy logic lives in
	 * `pptx-viewer-core` / `pptx-viewer-shared` and this package's `.ts`
	 * modules; this SFC is thin composition.
	 */
	import { onDestroy, onMount } from 'svelte';
	import { cloneSlide } from 'pptx-viewer-core';
	import type { PptxElement, TextSegment } from 'pptx-viewer-core';
	import { buildUserFontFaceStyles, createBlankSlide, defaultCssVars, makeSlideId, themeToCssVars, toggleSheet } from 'pptx-viewer-shared';
	import type { MobileSheetKey, ViewerMode } from 'pptx-viewer-shared';

	import { createTranslator } from '../i18n/translator';
	import { provideTranslator } from '../i18n/context';
	import { CollaborationController, CollaborationDialogsState } from './collab';
	import CollaborationChrome from './collab/components/CollaborationChrome.svelte';
	import { useCollaborationPresenceEffects } from './collab/collaboration-presence-effects.svelte';
	import ExportProgressModal from './components/ExportProgressModal.svelte';
	import MobileActionSheets from './components/MobileActionSheets.svelte';
	import MobileChrome from './components/MobileChrome.svelte';
	import MasterViewBody from './components/MasterViewBody.svelte';
	import PresentationTouchControls from './components/PresentationTouchControls.svelte';
	import PresenterView from './components/PresenterView.svelte';
	import StatusBar from './components/StatusBar.svelte';
	import TitleBar from './components/TitleBar.svelte';
	import Ribbon from './components/ribbon/Ribbon.svelte';
	import ViewerBody from './components/ViewerBody.svelte';
	import { presentationSwipe } from './presentation-swipe';
	import ViewerToolbar from './components/ViewerToolbar.svelte';
	import { createEditingApi } from './editor/editing-api';
	import { EditorController } from './editor/editor-controller.svelte';
	import { EditorState } from './editor/editor-state.svelte';
	import { FindReplaceState } from './editor/editor-find-replace.svelte';
	import { AutosaveController } from './state/autosave.svelte';
	import { createExportWiring } from './export/export-wiring.svelte';
	import { createExportingApi } from './export/exporting-api';
	import { ExportUiState } from './export/export-ui.svelte';
	import { PresentationController, PresenterSession, usePresentationEffects } from './presentation';
	import { PresentationLoader } from './state/presentation-loader.svelte';
	import { provideSmartArt3D } from './state/smart-art-3d-context';
	import { provideRenderContext } from './state/render-context';
	import { provideZoomNavigation } from './state/zoom-navigation-context';
	import { ViewerState } from './state/viewer-state.svelte';
	import { fitScale } from './state/navigation';
	import { useViewerEffects } from './state/viewer-effects.svelte';
	import { createViewportHandlers } from './state/viewport-handlers';
	import { mergeStyles, styleToString } from './style';
	import type { PowerPointViewerProps } from './types';

	const {
		source,
		fonts = [],
		theme,
		locale = 'en',
		initialSlide = 0,
		showThumbnails = true,
		showToolbar = true,
		showNotes = true,
		smartArt3D = false,
		editable: editableProp = false,
		class: className = '',
		autosave = false,
		onautosavetoggle,
		fileName,
		filePath,
		autosaveIntervalMs = 2000,
		collaboration,
		shareDefaults,
		onload,
		onerror,
		onslidechange,
		onnotesupdate,
		onchange,
		ondirtychange,
		oncontentchange,
		onmodechange,
		onzoomchange,
		onselectionchange,
		onslidecountchange,
		onopenfile,
		onautosave,
		onstartcollaboration,
		onstopcollaboration,
	}: PowerPointViewerProps = $props();
	let editable = $state(false);
	$effect(() => { editable = editableProp; });
	$effect(() => {
		const css = buildUserFontFaceStyles(fonts);
		if (!css || typeof document === 'undefined') {
			return;
		}
		const style = document.createElement('style');
		style.dataset.pptxUserFonts = 'svelte';
		style.textContent = css;
		document.head.appendChild(style);
		return () => style.remove();
	});

	const t = createTranslator(() => locale);
	provideTranslator(t);
	provideSmartArt3D(() => smartArt3D);

	const loader = new PresentationLoader();
	provideRenderContext({
		getColorScheme: () => loader.colorScheme,
		getTableStyleMap: () => loader.tableStyleMap,
	});
	const viewer = new ViewerState();
	let presenterMode = $state(false);
	let presenterStartedAt = $state(Date.now());
	const presenterSession = new PresenterSession({
		getSource: () => source,
		getSlideIndex: () => viewer.current,
		onAudienceSlide: (index) => viewer.goTo(index),
		onAudienceExit: () => (viewer.isFullscreen = false),
	});
	onMount(() => {
		presenterSession.connect();
		if (presenterSession.isAudience) {viewer.isFullscreen = true;}
	});
	onDestroy(() => presenterSession.dispose());
	$effect(() => {
		presenterSession.sync(viewer.current);
	});
	function enterPresenterView(): void {
		presenterStartedAt = Date.now();
		presenterMode = true;
	}

	// ── Editing ──────────────────────────────────────────────────────────
	// `editor.slides` is the single editable source of truth for the stage,
	// thumbnails, and notes; it is seeded from the loader on every successful
	// load. The controller wires selection / gestures / inline text / keyboard
	// to the history-tracked editor. Assigned by ViewerBody's onstageholder.
	// eslint-disable-next-line prefer-const
	let stageHolderEl = $state<HTMLDivElement>();
	// eslint-disable-next-line prefer-const
	let masterScale = $state(1);
	let stageContextMenu = $state<{ x: number; y: number } | null>(null);
	let activeMobileSheet = $state<MobileSheetKey>(null);
	const editor = new EditorState({
		getCurrent: () => viewer.current,
		getHandler: () => loader.handler,
		onChange: () => {
			onchange?.();
			void editor.save().then((bytes) => oncontentchange?.(bytes));
		},
	});
	provideZoomNavigation({
		navigateToZoomTarget: (index) => viewer.goTo(index),
		getSlides: () => editor.renderedSlides,
	});
	const controller = new EditorController(editor, {
		getScale: () => (editor.masterViewTarget ? masterScale : scale),
		getCurrent: () => viewer.current,
		getPresenting: () => viewer.isFullscreen,
		getStageRoot: () => stageHolderEl?.querySelector('.pptx-svelte-stage') ?? null,
		getHolderEl: () => stageHolderEl ?? null,
		onCursorMove: (x, y) => collab.setCursor(x, y, viewer.current),
		onContextMenu: (x, y) => {
			stageContextMenu = { x, y };
		},
	});
	// The ribbon's Home tab Editing group / Ctrl+F Find & Replace panel.
	const findReplace = new FindReplaceState({
		getSlides: () => editor.slides,
		commitSlides: (next) => editor.commitSlides(next),
		onNavigate: (slideIndex, elementId) => {
			viewer.goTo(slideIndex);
			editor.select(elementId);
		},
	});

	// ── Collaboration ────────────────────────────────────────────────────
	// Auto start/stop from the `collaboration` prop; local edits publish
	// granularly and remote peers' edits apply into `editor.slides`. A `viewer`
	// role folds into `getEditable` below so the local user stays read-only.
	function sourceBytes(): Uint8Array | null {
		if (!source) {
			return null;
		}
		return source instanceof Uint8Array ? source : new Uint8Array(source);
	}
	const collab = new CollaborationController({
		getSlides: () => editor.renderedSlides,
		applyRemoteSlides: (slides) => editor.applyRemoteSlides(slides),
		getConfig: () => collaboration,
		getSourceBytes: sourceBytes,
		getCanvasWidth: () => loader.canvasSize.width,
		getCanvasHeight: () => loader.canvasSize.height,
		onStart: (config) => onstartcollaboration?.(config),
		onStop: () => onstopcollaboration?.(),
	});

	// Publish local active-slide/selection changes; drive follow-mode navigation.
	useCollaborationPresenceEffects({
		collab,
		getCurrentSlide: () => viewer.current,
		getSelectedElementId: () => editor.selectedElementId,
		goTo: (index) => viewer.goTo(index),
	});

	// Share / Broadcast dialogs (open state + start/stop handlers) live in
	// `CollaborationDialogsState`, both driving the same `collab` controller
	// the `collaboration` prop auto-starts.
	const dialogs = new CollaborationDialogsState(collab, () => shareDefaults);

	// ── Autosave ─────────────────────────────────────────────────────────
	// Debounced crash-recovery autosave: enabled only when the host opts in,
	// editing is allowed, and a `filePath` key is supplied. Persists to the
	// shared IndexedDB store and fires `onautosave` with the bytes.
	let autosaveEnabled = $state(false);
	$effect(() => {
		autosaveEnabled = autosave;
	});
	const autosaveActive = $derived(editable && autosaveEnabled && Boolean(filePath) && !collab.readOnly);
	const autosaveCtl = new AutosaveController({
		getEnabled: () => autosaveActive,
		getIntervalMs: () => autosaveIntervalMs,
		getFilePath: () => filePath,
		getSlides: () => editor.renderedSlides,
		getSlideMasters: () => editor.slideMasters,
		getNotesMaster: () => editor.notesMaster,
		getHandoutMaster: () => editor.handoutMaster,
		getHandler: () => loader.handler,
		getLoadCount: () => loader.loadCount,
		onSaved: (bytes) => onautosave?.(bytes),
	});

	useViewerEffects({
		getSource: () => source,
		getEditable: () => editable && !collab.readOnly,
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
		collab.stop();
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
	const displaySlides = $derived(editor.renderedSlides);
	const activeSlide = $derived(displaySlides[viewer.current]);
	const chromeVisible = $derived(!viewer.isFullscreen);
	const editingActive = $derived(editable && !viewer.isFullscreen && !collab.readOnly);
	// The ribbon replaces the lean `ViewerToolbar` once a presentation is
	// loaded and editing is actually available; read-only mode (or no
	// presentation yet) keeps the compact viewer chrome unchanged.
	const showRibbon = $derived(editable && !collab.readOnly && loader.slides.length > 0);
	const viewerMode = $derived<ViewerMode>(editor.masterViewTarget ? 'master' : viewer.isFullscreen ? 'present' : editable ? 'edit' : 'preview');
	$effect(() => ondirtychange?.(editor.dirty));
	$effect(() => onmodechange?.(viewerMode));
	$effect(() => onzoomchange?.(effectivePercent / 100));
	$effect(() => onselectionchange?.([...editor.selection.ids]));
	$effect(() => onslidecountchange?.(displaySlides.length));

	// The Design tab's theme-preset gallery overrides the host `theme` prop
	// locally (React/vanilla's `setTheme` public API pattern); clearing it
	// (`undefined`) falls back to whatever the host passed in.
	let themeOverride = $state<PowerPointViewerProps['theme']>(undefined);
	const effectiveTheme = $derived(themeOverride ?? theme);

	const rootStyle = $derived(
		styleToString(mergeStyles(defaultCssVars(), themeToCssVars(effectiveTheme))),
	);

	// ── Presentation mode (animations + slide transitions) ───────────────
	// Owns the click-stepped element-animation playback and the transient
	// slide-transition overlay state; driven by `usePresentationEffects` off the
	// fullscreen flag + current slide. All the preset/transition CSS maths lives
	// in `pptx-viewer-shared`.
	const presentation = new PresentationController({
		getSlides: () => editor.renderedSlides,
		getCurrentIndex: () => viewer.current,
		navigate: (index) => viewer.goTo(index),
	});
	usePresentationEffects({
		controller: presentation,
		getPresenting: () => viewer.isFullscreen,
		getCurrentIndex: () => viewer.current,
		getActiveSlide: () => activeSlide,
		getStageRoot: () => stageHolderEl?.querySelector('.pptx-svelte-stage') ?? null,
	});

	// ── Fullscreen / keyboard ────────────────────────────────────────────
	// Assigned by the template's bind:this (invisible to the linter).
	// eslint-disable-next-line no-unassigned-vars
	let rootEl: HTMLDivElement | undefined;

	const { onFullscreenToggle, onFullscreenChange, onKeydown } = createViewportHandlers({
		getRootEl: () => rootEl,
		viewer,
		controller,
		getEditingActive: () => editingActive,
		presentation,
	});

	// ── Export (PNG / PDF) ───────────────────────────────────────────────
	// The off-screen capture stage mounts into the viewer root once export is
	// first used; see `export/export-wiring.svelte.ts`.
	const exportWiring = createExportWiring({
		getContainer: () => rootEl,
		getSlides: () => editor.renderedSlides,
		getCanvasSize: () => loader.canvasSize,
		getMediaDataUrls: () => loader.mediaDataUrls,
		getCurrent: () => viewer.current,
		getTranslator: () => t,
		getSmartArt3D: () => smartArt3D,
	});
	// Toolbar export menu + progress modal state (Vue `useExportProgress` port).
	const exportUi = new ExportUiState({
		controller: exportWiring.controller,
		getTranslator: () => t,
	});

	// ── Speaker notes ────────────────────────────────────────────────────
	let notesExpanded = $state(false);

	function onNotesToggle(): void {
		notesExpanded = !notesExpanded;
		activeMobileSheet = notesExpanded ? 'notes' : null;
	}

	function setActiveMobileSheet(next: MobileSheetKey): void {
		if (next === 'notes') {
			notesExpanded = true;
		} else if (activeMobileSheet === 'notes') {
			notesExpanded = false;
		}
		activeMobileSheet = next;
	}

	// ── Design tab theme switching ──────────────────────────────────────
	function onSetTheme(next: PowerPointViewerProps['theme']): void {
		themeOverride = next;
	}

	// Route notes edits through the history-tracked editor when editable (so
	// they participate in undo/redo and persist to `save()`), then always
	// forward to the host `onnotesupdate` callback.
	function onNotesCommit(notes: string, segments?: TextSegment[]): void {
		if (editable) {
			editor.commitNotes(notes, segments);
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
	export const getContent = editingApi.save;
	export const goTo = (index: number): void => viewer.goTo(index);
	export const goPrev = (): void => viewer.prev();
	export const goNext = (): void => viewer.next();
	export const getZoom = (): number => effectivePercent / 100;
	export const setZoom = (level: number): void => { viewer.zoomPercent = Math.max(10, Math.min(400, level * 100)); };
	export const zoomIn = (): void => viewer.zoomIn(effectivePercent);
	export const zoomOut = (): void => viewer.zoomOut(effectivePercent);
	export const zoomReset = (): void => { viewer.zoomPercent = 100; };
	export const getMode = (): ViewerMode => viewerMode;
	export const setMode = (mode: ViewerMode): void => {
		if (mode === 'present') { if (!viewer.isFullscreen) onFullscreenToggle(); return; }
		if (viewer.isFullscreen) onFullscreenToggle();
		editable = mode === 'edit' || mode === 'master';
		if (mode === 'master') editor.masterOps.enter();
		else if (editor.masterViewTarget) editor.masterOps.exit();
	};
	export const getActiveSlideIndex = (): number => viewer.current;
	export const setActiveSlideIndex = goTo;
	export const getSlideCount = (): number => displaySlides.length;
	export const isDirty = (): boolean => editor.dirty;
	export const getSlides = () => editor.renderedSlides;
	export const getSlide = (index: number) => editor.renderedSlides[index];
	export const getActiveSlide = () => editor.renderedSlides[viewer.current];
	export const getElements = (slideIndex = viewer.current) => editor.renderedSlides[slideIndex]?.elements ?? [];
	export const getElementById = (id: string, slideIndex = viewer.current) => getElements(slideIndex).find((element: PptxElement) => element.id === id);
	export const updateElement = (id: string, updates: Partial<PptxElement>): void => editor.applyElementPatch(id, updates);
	export const deleteElements = (ids: string[]): void => { editor.selection.setAll(ids); editor.deleteSelected(); };
	export const duplicateElement = (id: string): string | undefined => { editor.selection.set(id); return editor.duplicateSelected() ?? undefined; };
	export const getSelectedElementIds = (): string[] => [...editor.selection.ids];
	export const selectElements = (ids: string[]): void => editor.selection.setAll(ids);
	export const clearSelection = (): void => editor.selection.clear();
	export const addSlide = (afterIndex = editor.slides.length - 1): void => {
		const next = [...editor.slides];
		const index = Math.min(Math.max(afterIndex + 1, 0), next.length);
		next.splice(index, 0, createBlankSlide(index + 1, makeSlideId));
		editor.commitSlides(next.map((slide, i) => ({ ...slide, slideNumber: i + 1 })));
		viewer.goTo(index);
	};
	export const deleteSlides = (indexes: number[]): void => {
		if (editor.slides.length <= 1) return;
		const remove = new Set(indexes);
		const next = editor.slides.filter((_, i) => !remove.has(i));
		if (next.length === 0) return;
		editor.commitSlides(next.map((slide, i) => ({ ...slide, slideNumber: i + 1 })));
		viewer.goTo(Math.min(viewer.current, next.length - 1));
	};
	export const duplicateSlides = (indexes: number[]): void => {
		const selected = new Set(indexes);
		const next = editor.slides.flatMap((slide, index) => selected.has(index) ? [slide, { ...cloneSlide(slide), id: makeSlideId() }] : [slide]);
		editor.commitSlides(next.map((slide, i) => ({ ...slide, slideNumber: i + 1 })));
	};
	export const moveSlide = (fromIndex: number, toIndex: number): void => {
		const next = [...editor.slides];
		if (!next[fromIndex] || toIndex < 0 || toIndex >= next.length || fromIndex === toIndex) return;
		const [slide] = next.splice(fromIndex, 1); next.splice(toIndex, 0, slide);
		editor.commitSlides(next.map((item, i) => ({ ...item, slideNumber: i + 1 }))); viewer.goTo(toIndex);
	};
	export const toggleHideSlides = (indexes: number[]): void => {
		const selected = new Set(indexes);
		editor.commitSlides(editor.slides.map((slide, index) => selected.has(index) ? { ...slide, hidden: !slide.hidden } : slide));
	};

	// ── Imperative export API (exposed on the component instance) ─────────
	const exportingApi = createExportingApi(exportWiring.controller);
	export const exportSlidePng = exportingApi.exportSlidePng;
	export const exportPdf = exportingApi.exportPdf;
	export const exportGif = exportingApi.exportGif;
	export const exportVideo = exportingApi.exportVideo;
	export const print = exportingApi.print;
</script>

<svelte:document onfullscreenchange={onFullscreenChange} />

<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<!-- The viewer root is a keyboard-navigable application region (slide navigation). -->
<div
	use:presentationSwipe={{
		isEnabled: () => viewer.isFullscreen,
		onNext: () => presentation.advance(),
		onPrevious: () => viewer.prev(),
	}}
	bind:this={rootEl}
	class={`pptx-svelte-viewer ${className}`}
	class:pptx-svelte-fullscreen={viewer.isFullscreen}
	style={rootStyle}
	role="region"
	aria-label={t('pptx.titleBar.defaultFileName')}
	aria-busy={loader.loading}
	tabindex="0"
	onkeydown={onKeydown}
	onpointerdown={() => {
		if (presenterSession.isAudience && !document.fullscreenElement) {
			void rootEl?.requestFullscreen?.().catch(() => undefined);
		}
	}}
>
	{#if showToolbar && chromeVisible}
		<MobileChrome
			editable={editingActive}
			canUndo={editor.canUndo}
			canRedo={editor.canRedo}
			onmenu={() => setActiveMobileSheet(toggleSheet(activeMobileSheet, 'menu'))}
			onundo={() => editor.undo()}
			onredo={() => editor.redo()}
			onsave={() => void downloadPptx()}
			onpresent={onFullscreenToggle}
			onshare={() => dialogs.openShare()}
		/>
		<TitleBar
			{fileName}
			editable={editingActive}
			isDirty={editor.dirty}
			{autosaveEnabled}
			autosaveStatus={autosaveActive ? autosaveCtl.status : undefined}
			canUndo={editor.canUndo}
			canRedo={editor.canRedo}
			findReplaceOpen={findReplace.open}
			onautosavetoggle={() => { autosaveEnabled = !autosaveEnabled; onautosavetoggle?.(autosaveEnabled); }}
			onsave={() => void downloadPptx()}
			onundo={() => editor.undo()}
			onredo={() => editor.redo()}
			onfindreplace={() => findReplace.toggle()}
		/>
		{#if showRibbon}
			<Ribbon
				{editor}
				{findReplace}
				canvasSize={loader.canvasSize}
				current={viewer.current}
				total={viewer.slideCount}
				onprev={() => viewer.prev()}
				onnext={() => viewer.next()}
				onnavigateslide={(index) => viewer.goTo(index)}
				canUndo={editor.canUndo}
				canRedo={editor.canRedo}
				dirty={editor.dirty}
				onundo={() => editor.undo()}
				onredo={() => editor.redo()}
				onsave={() => void editor.save()}
				ondownload={() => void downloadPptx()}
				autosaveStatus={autosaveActive ? autosaveCtl.status : undefined}
				autosaveDirty={autosaveCtl.isDirty}
				zoomPercent={effectivePercent}
				onzoomin={() => viewer.zoomIn(effectivePercent)}
				onzoomout={() => viewer.zoomOut(effectivePercent)}
				onzoomfit={() => viewer.zoomToFit()}
				isFullscreen={viewer.isFullscreen}
				onfullscreen={onFullscreenToggle}
				showNotes={showNotes && loader.slides.length > 0}
				{notesExpanded}
				onnotestoggle={onNotesToggle}
				onshare={() => dialogs.openShare()}
				onbroadcast={() => dialogs.openBroadcast()}
				collabActive={collab.active}
				slides={displaySlides}
				onnavigatetoissue={(slideIndex, elementId) => {
					viewer.goTo(slideIndex);
					if (elementId) editor.select(elementId);
				}}
				onfrombeginning={() => {
					viewer.goTo(0);
					onFullscreenToggle();
				}}
				onfromcurrent={onFullscreenToggle}
				onpresenter={enterPresenterView}
				{exportUi}
				{onopenfile}
				theme={effectiveTheme}
				onsettheme={onSetTheme}
				onentermasterview={() => editor.masterOps.enter()}
			/>
		{:else}
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
				exportUi={loader.slides.length > 0 ? exportUi : undefined}
				onshare={() => dialogs.openShare()}
				onbroadcast={() => dialogs.openBroadcast()}
				collabActive={collab.active}
			/>
		{/if}
	{/if}
	<ExportProgressModal
		open={exportUi.open}
		title={exportUi.title}
		progress={exportUi.progress}
		statusMessage={exportUi.status}
		oncancel={() => exportUi.cancel()}
	/>
	{#if editor.masterViewTarget}
		<MasterViewBody
			{editor}
			{controller}
			canvasSize={loader.canvasSize}
			notesCanvasSize={loader.notesCanvasSize}
			mediaDataUrls={loader.mediaDataUrls}
			onstageholder={(el) => { stageHolderEl = el ?? undefined; }}
			onscalechange={(next) => { masterScale = next; }}
		/>
	{:else}<ViewerBody
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
		presentationTransition={presentation.transition}
		onTransitionDone={() => presentation.endTransition()}
		onAdvance={() => presentation.advance()}
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
		collabCursors={collab.cursors}
		contextMenu={stageContextMenu}
		onContextMenuClose={() => { stageContextMenu = null; }}
		onmoveSlide={(fromIndex, toIndex) => {
			const target = editor.slidesOps.moveSlide(fromIndex, toIndex);
			if (target !== null) viewer.goTo(target);
		}}
	/>{/if}
	{#if viewer.isFullscreen}
		<PresentationTouchControls
			current={viewer.current}
			total={viewer.slideCount}
			onprev={() => viewer.prev()}
			onnext={() => presentation.advance()}
			onexit={onFullscreenToggle}
		/>
	{/if}
	{#if presenterSession.snapshot.blackout !== 'none'}<div class="presenter-blackout" style={`background:${presenterSession.snapshot.blackout}`}></div>{/if}
	{#if presenterSession.snapshot.pointer?.tool === 'laser'}<div class="presenter-laser" style={`left:${(presenterSession.snapshot.pointer?.x ?? .5)*100}%;top:${(presenterSession.snapshot.pointer?.y ?? .5)*100}%`}></div>{/if}
	{#if presenterSession.snapshot.subtitlesVisible && presenterSession.snapshot.caption}<div class="presenter-caption">{presenterSession.snapshot.caption}</div>{/if}
	{#if presenterMode}
		<PresenterView
			slides={editor.renderedSlides}
			current={viewer.current}
			canvasSize={loader.canvasSize}
			mediaDataUrls={loader.mediaDataUrls}
			startedAt={presenterStartedAt}
			audienceOpen={presenterSession.audienceOpen}
			onmove={(direction) => viewer.goTo(viewer.current + direction)}
			onaudience={() => presenterSession.audienceOpen ? presenterSession.closeAudience() : presenterSession.openAudience()}
			onexit={() => { presenterSession.closeAudience(); presenterMode = false; }}
			snapshot={presenterSession.snapshot}
			onupdate={(patch) => presenterSession.updateSnapshot(patch)}
			onnavigate={(index) => viewer.goTo(index)}
		/>
	{/if}
	{#if editingActive && displaySlides.length > 0}
		<MobileActionSheets
			active={activeMobileSheet}
			onactivechange={setActiveMobileSheet}
			{editor}
			slides={displaySlides}
			canvasSize={loader.canvasSize}
			mediaDataUrls={loader.mediaDataUrls}
			current={viewer.current}
			onselect={(index) => viewer.goTo(index)}
			onzoomin={() => viewer.zoomIn(effectivePercent)}
			onzoomout={() => viewer.zoomOut(effectivePercent)}
			onzoomfit={() => viewer.zoomToFit()}
		/>
	{/if}
	{#if showToolbar && chromeVisible}
		<StatusBar
			current={viewer.current}
			total={viewer.slideCount}
			zoomPercent={effectivePercent}
			isDirty={editor.dirty}
			autosaveStatus={autosaveActive ? autosaveCtl.status : undefined}
			showNotes={showNotes && loader.slides.length > 0}
			{notesExpanded}
			isFullscreen={viewer.isFullscreen}
			onzoomin={() => viewer.zoomIn(effectivePercent)}
			onzoomout={() => viewer.zoomOut(effectivePercent)}
			onzoomfit={() => viewer.zoomToFit()}
			onfullscreen={onFullscreenToggle}
			onnotestoggle={onNotesToggle}
		/>
	{/if}
	<CollaborationChrome
		{collab}
		{dialogs}
		{shareDefaults}
		showOverlay={collab.active && chromeVisible}
		{collaboration}
	/>
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
	.presenter-blackout{position:absolute;inset:0;z-index:75}.presenter-laser{position:absolute;z-index:76;width:20px;height:20px;transform:translate(-50%,-50%);border-radius:50%;background:#ef4444;box-shadow:0 0 20px 8px #ef444488;pointer-events:none}.presenter-caption{position:absolute;z-index:77;left:10%;right:10%;bottom:32px;padding:12px 24px;border-radius:8px;background:#000c;color:#fff;text-align:center;font-size:20px;pointer-events:none}

	:global(.pptx-svelte-viewer :is(button, a, input, select, textarea, [tabindex]):focus-visible) {
		outline: 2px solid var(--pptx-ring, #818cf8) !important;
		outline-offset: 2px;
	}

	:global(.pptx-svelte-viewer :is(button, [role='button'])) {
		min-width: 24px;
		min-height: 24px;
		touch-action: manipulation;
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.pptx-svelte-viewer *),
		:global(.pptx-svelte-viewer *::before),
		:global(.pptx-svelte-viewer *::after) {
			animation-duration: 0.01ms !important;
			animation-iteration-count: 1 !important;
			transition-duration: 0.01ms !important;
			scroll-behavior: auto !important;
		}
	}

	@media (forced-colors: active) {
		:global(.pptx-svelte-viewer :is(button, a, input, select, textarea, [tabindex]):focus-visible) {
			outline-color: Highlight;
		}
	}

	@media (max-width: 767px), (max-width: 1023px) and (max-height: 520px) {
		:global(.pptx-svelte-titlebar),
		:global(.pptx-svelte-ribbon),
		:global(.pptx-svelte-toolbar),
		:global(.pptx-svelte-statusbar),
		:global(.pptx-svelte-thumbs),
		:global(.pptx-svelte-inspector) {
			display: none !important;
		}

		:global(.pptx-svelte-viewport) {
			padding-bottom: 64px;
		}
	}
</style>
