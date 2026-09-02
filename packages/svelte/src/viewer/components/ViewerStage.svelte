<script lang="ts">
	/**
	 * ViewerStage: everything inside the scrollable viewport, i.e. the load /
	 * encrypted / error placeholders, the scaled slide stage with its overlay
	 * stack and ruler strips, and the two surfaces that must outlive the stage's
	 * own subtree (the element context menu and the hyperlink dialog it opens).
	 *
	 * Split out of `ViewerBody` so the body is only the three-column layout
	 * (thumbnail rail | stage + notes | inspector) and this file owns the stage.
	 * The ruler strips are siblings of the stage rather than children: the stage
	 * is CSS-scaled, and a ruler inside it would scale its strokes and labels
	 * with the zoom instead of tracking it.
	 */
	import { RULER_THICKNESS } from 'pptx-viewer-shared';

	import ElementContextMenu from './ElementContextMenu.svelte';
	import HyperlinkDialog from './ribbon/insert/HyperlinkDialog.svelte';
	import RulerStrips from './RulerStrips.svelte';
	import SlideCanvas from './SlideCanvas.svelte';
	import SlideOverlays from './SlideOverlays.svelte';
	import { createEditCommits } from './viewer-body-commits';
	import type { ViewerStageProps } from './viewer-body-props';

	const {
		t,
		editor,
		controller,
		canvasSize,
		mediaDataUrls,
		current,
		loading,
		isEncrypted,
		error,
		activeSlide,
		scale,
		presenting,
		gridSpacingPx,
		presentationTransition,
		onTransitionDone,
		onAdvance,
		onPresentationContextMenu,
		editingActive,
		blackout = 'none',
		onstageholder,
		collabCursors = [],
		collabPresences = [],
		contextMenu,
		onContextMenuClose,
		annotations,
		guides = [],
		onchangeguide,
		ondeleteguide,
		onaddguide,
		showRulers = false,
		rulerUnit = 'inches',
		spellCheck = false,
		chromeUi,
		aiPickMode = false,
		aiActive = false,
		aiHighlights = [],
		aiChangeBatch = null,
		onaipickelement,
		onaskai,
		onfixai,
	}: ViewerStageProps = $props();

	const commits = $derived(createEditCommits(editor));

	// The context menu's "Edit Hyperlink" opens the same dialog the Insert tab
	// does, hosted here because the menu unmounts the moment a command is run.
	// eslint-disable-next-line prefer-const
	let hyperlinkOpen = $state(false);

	/** "Add Comment": show the inspector's Comments tab, as React's dispatch does. */
	function openComments(): void {
		if (chromeUi) {
			chromeUi.inspectorOpen = true;
			chromeUi.setInspectorTab('comments');
		}
	}

	/** Rulers are an editing aid, so they never intrude on the slide show. */
	const rulersVisible = $derived(showRulers && !presenting);
	/** Only offer drag-out guides where guides themselves are editable. */
	const rulerGuideDrop = $derived(editingActive ? onaddguide : undefined);
	/** The ruler highlights the selected element's extent, as PowerPoint does. */
	const selectedBounds = $derived.by(() => {
		const element = editingActive ? editor.selectedElement : undefined;
		return element
			? { x: element.x, y: element.y, width: element.width, height: element.height }
			: null;
	});
</script>

{#if loading}
	<div class="pptx-svelte-message" role="status">{t('pptx.common.loading')}</div>
{:else if isEncrypted}
	<div class="pptx-svelte-message" role="alert">{t('pptx.encryptedFile.message')}</div>
{:else if error}
	<div class="pptx-svelte-message" role="alert">{error}</div>
{:else if activeSlide}
	<div
		class="pptx-svelte-stage-wrap"
		class:pptx-svelte-stage-ruled={rulersVisible}
		style={rulersVisible ? `padding:${RULER_THICKNESS}px 0 0 ${RULER_THICKNESS}px` : undefined}
	>
		{#if rulersVisible}
			<RulerStrips
				{canvasSize}
				{scale}
				unit={rulerUnit}
				{selectedBounds}
				oncreateguide={rulerGuideDrop}
			/>
		{/if}
		<SlideCanvas
			slide={activeSlide}
			{canvasSize}
			{mediaDataUrls}
			{scale}
			{presenting}
			{gridSpacingPx}
			{editingActive}
			editTemplateMode={editor.editTemplateMode}
			editingElementId={controller.editingId}
			selectedElementIds={editor.selection.ids}
			ontablecellcommit={editingActive ? commits.commitTableCell : undefined}
			onsmartartnodecommit={editingActive ? commits.commitSmartArtNode : undefined}
			onsmartartnodefill={editingActive ? commits.commitSmartArtFill : undefined}
			onchartpointcommit={editingActive ? commits.commitChartPoint : undefined}
			ontableresizecolumns={editingActive ? commits.commitTableResizeColumns : undefined}
			ontableresizerow={editingActive ? commits.commitTableResizeRow : undefined}
			comments={editingActive && !presenting ? (activeSlide.comments ?? []) : []}
			oncommentmarkerclick={openComments}
			{onstageholder}
			onstagepointerdown={controller.onStagePointerDown}
			onstagepointermove={controller.onStagePointerMove}
			onstagedblclick={controller.onStageDblClick}
			onstagecontextmenu={presenting ? onPresentationContextMenu : controller.onStageContextMenu}
			onstageclick={presenting ? onAdvance : undefined}
			{aiPickMode}
			{aiActive}
			{onaipickelement}
		>
			<SlideOverlays
				{editor}
				{controller}
				{canvasSize}
				{mediaDataUrls}
				{current}
				{activeSlide}
				{scale}
				{presenting}
				{presentationTransition}
				{onTransitionDone}
				{editingActive}
				{blackout}
				{collabCursors}
				{collabPresences}
				{annotations}
				{guides}
				{onchangeguide}
				{ondeleteguide}
				{spellCheck}
				{aiHighlights}
				{aiChangeBatch}
			/>
		</SlideCanvas>
	</div>
	{#if contextMenu}
		<ElementContextMenu
			x={contextMenu.x}
			y={contextMenu.y}
			cell={contextMenu.cell}
			{editor}
			{onaskai}
			{onfixai}
			oncomment={openComments}
			onhyperlink={() => (hyperlinkOpen = true)}
			onclose={onContextMenuClose}
		/>
	{/if}
	{#if hyperlinkOpen}<HyperlinkDialog {editor} onclose={() => (hyperlinkOpen = false)} />{/if}
{:else}
	<div class="pptx-svelte-message" role="status">{t('pptx.statusBar.noSlides')}</div>
{/if}

<style>
	/*
	 * Wraps the scaled stage so the ruler strips have a positioning context and
	 * a padding gutter to sit in. `content-box` keeps the padding OUT of the
	 * declared size, so turning rulers on grows the wrapper by exactly one strip
	 * thickness instead of shrinking the slide.
	 */
	.pptx-svelte-stage-wrap {
		position: relative;
		display: flex;
		flex: none;
		margin: auto;
		box-sizing: content-box;
	}

	.pptx-svelte-message {
		margin: auto;
		font-family: system-ui, sans-serif;
		font-size: 14px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}
</style>
