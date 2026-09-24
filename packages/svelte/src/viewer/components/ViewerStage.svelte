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
	import type { InspectorSectionAnchor } from 'pptx-viewer-shared';
	import { RULER_THICKNESS, scrollInspectorSectionIntoView } from 'pptx-viewer-shared';
	import { tick } from 'svelte';

	import type { PasteSpecialFormat } from 'pptx-viewer-shared';

	import { saveContextMenuElementAsPicture } from '../export/save-element-as-picture';
	import { rasterizePastedElementAsPicture } from '../export/rasterize-picture';
	import ElementContextMenu from './ElementContextMenu.svelte';
	import PasteOptionsToolbar from './PasteOptionsToolbar.svelte';
	import PasteSpecialDialog from './PasteSpecialDialog.svelte';
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

	// The context menu's "Edit Hyperlink" (and the shared keymap's Ctrl+K)
	// open the same dialog the Insert tab does; hosted here, because the menu
	// unmounts the moment a command is run, off `controller.hyperlinkOpen` so
	// the keyboard shortcut has one flag to flip regardless of which trigger
	// fired.

	/** "Add Comment": show the inspector's Comments tab, as React's dispatch does. */
	function openComments(): void {
		if (chromeUi) {
			chromeUi.inspectorOpen = true;
			chromeUi.setInspectorTab('comments');
		}
	}

	/**
	 * "Edit Alt Text" / "Size and Position" / "Format Shape": switch to the
	 * properties tab, then (once the panel has re-rendered) scroll the
	 * matching section into view. A no-op degrade when the section is not
	 * tagged, same as every other binding.
	 */
	function focusInspectorSection(anchor: InspectorSectionAnchor): void {
		if (!chromeUi) {
			return;
		}
		chromeUi.inspectorOpen = true;
		chromeUi.setInspectorTab('properties');
		void tick().then(() => {
			requestAnimationFrame(() => scrollInspectorSectionIntoView(document, anchor));
		});
	}

	/** "Save as Picture": rasterise the right-clicked element's own DOM node. */
	function saveElementAsPicture(elementId: string): void {
		const name = editor.elementById(elementId)?.name;
		void saveContextMenuElementAsPicture(elementId, name, t('pptx.elementType.picture'));
	}

	/** Rasterise the mounted node for `elementId` and replace it with a picture, or no-op if unmounted. */
	async function replaceWithPicture(elementId: string, sourceClone: Parameters<typeof rasterizePastedElementAsPicture>[1]): Promise<void> {
		const picture = await rasterizePastedElementAsPicture(elementId, sourceClone);
		if (picture) {
			editor.clipboardOps.replaceElement(elementId, picture);
		}
	}

	/** Paste Special dialog OK: paste with `format`, rasterizing to picture once mounted. */
	function onPasteSpecialConfirm(format: PasteSpecialFormat): void {
		editor.pasteSpecialDialogOpen = false;
		const id = editor.clipboardOps.pasteWithFormat(format);
		if (!id || format !== 'picture') {
			return;
		}
		const sourceClone = editor.pasteOptionsToolbar?.find((entry) => entry.id === id)?.sourceClone;
		if (!sourceClone) {
			return;
		}
		requestAnimationFrame(() => void replaceWithPicture(id, sourceClone));
	}

	/** Paste Options toolbar: re-derive the already-pasted element from its own pristine clone. */
	function onPasteOptionsChoose(format: PasteSpecialFormat): void {
		const entry = editor.pasteOptionsToolbar?.[0];
		if (!entry) {
			return;
		}
		if (format === 'picture') {
			void replaceWithPicture(entry.id, entry.sourceClone);
			return;
		}
		editor.clipboardOps.reformatPasted(entry.id, entry.sourceClone, format);
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
			onhyperlink={() => (controller.hyperlinkOpen = true)}
			onenterinlineedit={(id) => controller.enterInlineEdit(id)}
			onsaveaspicture={saveElementAsPicture}
			onfocusinspectorsection={focusInspectorSection}
			onclose={onContextMenuClose}
		/>
	{/if}
	{#if controller.hyperlinkOpen}
		<HyperlinkDialog {editor} onclose={() => (controller.hyperlinkOpen = false)} />
	{/if}
	{#if editor.pasteSpecialDialogOpen}
		<PasteSpecialDialog
			oncancel={() => (editor.pasteSpecialDialogOpen = false)}
			onconfirm={onPasteSpecialConfirm}
		/>
	{/if}
	<PasteOptionsToolbar
		elementId={editor.pasteOptionsToolbar?.[0]?.id ?? null}
		onchoose={onPasteOptionsChoose}
		ondismiss={() => (editor.pasteOptionsToolbar = null)}
	/>
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
