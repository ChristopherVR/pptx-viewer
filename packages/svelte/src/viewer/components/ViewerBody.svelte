<script lang="ts">
	/**
	 * ViewerBody: thumbnail rail + slide viewport (stage, editing overlay,
	 * load/error states) + notes panel. Split out of `PowerPointViewer.svelte`
	 * to keep that file under the repo's file-size budget; purely
	 * presentational, all state/logic stays owned by the parent.
	 */
	import { setSmartArtNodeStyle, updateSmartArtNodeText } from 'pptx-viewer-core';
	import type { PptxHandler, PptxSlide, PptxTheme, TextSegment } from 'pptx-viewer-core';
	import type { CanvasSize, RemoteCursor } from 'pptx-viewer-shared';
	import { setCellText, shouldCommitSmartArtNodeText } from 'pptx-viewer-shared';

	import type { AiCanvasHighlight } from '../ai/ai-panel-controller.svelte';
	import AiFocusHighlightOverlay from './ai/AiFocusHighlightOverlay.svelte';
	import CollaborationCursors from '../collab/components/CollaborationCursors.svelte';
	import type { EditorController } from '../editor/editor-controller.svelte';
	import type { EditorState } from '../editor/editor-state.svelte';
	import type { ChromeUiState } from '../state/chrome-ui.svelte';
	import type { Translator } from '../../i18n/translator';
	import type { TransitionState } from '../presentation';
	import type { PresentationAnnotations } from '../presentation/presentation-annotations.svelte';
	import { PresentationTransitionOverlay } from '../presentation';
	import EditorLayer from './EditorLayer.svelte';
	import ElementContextMenu from './ElementContextMenu.svelte';
	import InkDrawingOverlay from './InkDrawingOverlay.svelte';
	import PresentationAnnotationOverlay from './PresentationAnnotationOverlay.svelte';
	import InspectorPanel from './inspector/InspectorPanel.svelte';
	import NotesPanel from './NotesPanel.svelte';
	import SlideCanvas from './SlideCanvas.svelte';
	import ThumbnailRail from './ThumbnailRail.svelte';
	import AlignmentGuides from './AlignmentGuides.svelte';

	const {
		t,
		editor,
		handler,
		presentationTheme,
		onthemechange,
		chromeVisible,
		showThumbnails,
		showNotes,
		displaySlides,
		canvasSize,
		mediaDataUrls,
		current,
		onselect,
		loading,
		isEncrypted,
		error,
		activeSlide,
		scale,
		presenting,
		presentationTransition,
		onTransitionDone,
		onAdvance,
		editingActive,
		controller,
		onstageresize,
		onstageholder,
		notesExpanded,
		onNotesCommit,
		onNotesToggle,
		collabCursors = [],
		contextMenu,
		onContextMenuClose,
		onmoveSlide,
		annotations,
		guides = [],
		onchangeguide,
		spellCheck = false,
		chromeUi,
		aiPickMode = false,
		aiActive = false,
		aiHighlights = [],
		onaipickelement,
		onaskai,
		onfixai,
	}: {
		t: Translator;
		editor: EditorState;
		handler?: PptxHandler | null;
		presentationTheme?: PptxTheme;
		onthemechange?: (theme: PptxTheme) => void;
		chromeVisible: boolean;
		showThumbnails: boolean;
		showNotes: boolean;
		displaySlides: PptxSlide[];
		canvasSize: CanvasSize;
		mediaDataUrls: Map<string, string>;
		current: number;
		onselect: (index: number) => void;
		loading: boolean;
		isEncrypted: boolean;
		error: string | null;
		activeSlide: PptxSlide | undefined;
		scale: number;
		presenting: boolean;
		/** Active slide-transition overlay state (presentation mode), or null. */
		presentationTransition: TransitionState | null;
		/** Called when the transition overlay finishes (host drops the overlay). */
		onTransitionDone: () => void;
		/** Advance the presentation (step animation build, else next slide). */
		onAdvance: () => void;
		editingActive: boolean;
		controller: EditorController;
		onstageresize: (width: number, height: number) => void;
		onstageholder: (el: HTMLDivElement | null) => void;
		notesExpanded: boolean;
		onNotesCommit?: (notes: string, segments?: TextSegment[]) => void;
		onNotesToggle: () => void;
		/** Remote collaborators' cursors on the active slide (unscaled slide px). */
		collabCursors?: RemoteCursor[];
		/** Open element menu position, supplied by the editing controller. */
		contextMenu: { x: number; y: number } | null;
		onContextMenuClose: () => void;
		onmoveSlide?: (fromIndex: number, toIndex: number) => void;
		annotations: PresentationAnnotations;
		guides?: readonly { axis: 'h' | 'v'; position: number }[];
		onchangeguide?: (index: number, position: number) => void;
		spellCheck?: boolean;
		/** Side-panel open/collapsed state shared with the ribbon's toggles. */
		chromeUi?: ChromeUiState;
		/** True while the AI panel is picking a slide element (see SlideCanvas). */
		aiPickMode?: boolean;
		/** True while a running AI tool is active (enables the canvas colour tween). */
		aiActive?: boolean;
		/** Rings the AI focus overlay should draw on the active slide. */
		aiHighlights?: readonly AiCanvasHighlight[];
		/** Route a picked canvas element to the AI focus (pick mode). */
		onaipickelement?: (elementId: string) => void;
		/** "Ask AI about this" from the element context menu (gated on the `ai` prop). */
		onaskai?: () => void;
		/** "Fix with AI" from the element context menu (gated on the `ai` prop). */
		onfixai?: () => void;
	} = $props();

	// The template's bind:clientWidth/Height write these (invisible to the linter).
	// eslint-disable-next-line prefer-const
	let viewportWidth = $state(0);
	// eslint-disable-next-line prefer-const
	let viewportHeight = $state(0);
	$effect(() => {
		onstageresize(viewportWidth, viewportHeight);
	});

	function commitTableCell(id: string, rowIndex: number, cellIndex: number, text: string): void {
		const table = editor.activeElements.find((element) => element.id === id);
		if (table?.type !== 'table') {
			return;
		}
		const updated = setCellText(table, rowIndex, cellIndex, text);
		editor.applyElementPatch(id, { tableData: updated.tableData });
	}

	function commitSmartArtNode(id: string, nodeId: string, text: string): void {
		const element = editor.activeElements.find((candidate) => candidate.id === id);
		if (
			element?.type !== 'smartArt' ||
			!element.smartArtData ||
			!shouldCommitSmartArtNodeText(element.smartArtData, nodeId, text)
		) {
			return;
		}
		const next = updateSmartArtNodeText(element.smartArtData, nodeId, text);
		editor.applyElementPatch(id, { smartArtData: next });
	}

	function commitSmartArtFill(id: string, nodeId: string, fill: string): void {
		const element = editor.activeElements.find((candidate) => candidate.id === id);
		if (element?.type !== 'smartArt' || !element.smartArtData) {
			return;
		}
		const next = setSmartArtNodeStyle(element.smartArtData, nodeId, { fillColor: fill });
		if (next !== element.smartArtData) {
			editor.applyElementPatch(id, { smartArtData: next });
		}
	}
</script>

<div class="pptx-svelte-body">
	{#if showThumbnails && !chromeUi?.sidebarCollapsed && chromeVisible && displaySlides.length > 0}
		<ThumbnailRail
			slides={displaySlides}
			sections={editor.sections}
			{canvasSize}
			{mediaDataUrls}
			{current}
			{onselect}
			editable={editingActive}
			onmove={onmoveSlide}
			onaddslide={() => {
				const index = editor.slidesOps.insertSlideAfterCurrent();
				if (index !== null) onselect(index);
			}}
			onsectiontoggle={(id) => editor.sectionOps.toggle(id)}
			onsectionrename={(id, name) => editor.sectionOps.rename(id, name)}
			onsectiondelete={(id) => editor.sectionOps.delete(id)}
			onsectionmove={(id, direction) =>
				direction === 'up' ? editor.sectionOps.moveUp(id) : editor.sectionOps.moveDown(id)}
		/>
	{/if}
	<div class="pptx-svelte-main">
		<div
			class="pptx-svelte-viewport"
			bind:clientWidth={viewportWidth}
			bind:clientHeight={viewportHeight}
			data-pptx-viewport
		>
			{#if loading}
				<div class="pptx-svelte-message" role="status">{t('common.loading')}</div>
			{:else if isEncrypted}
				<div class="pptx-svelte-message" role="alert">{t('pptx.encryptedFile.message')}</div>
			{:else if error}
				<div class="pptx-svelte-message" role="alert">{error}</div>
			{:else if activeSlide}
				<SlideCanvas
					slide={activeSlide}
					{canvasSize}
					{mediaDataUrls}
					{scale}
					{presenting}
					{editingActive}
					editTemplateMode={editor.editTemplateMode}
					ontablecellcommit={editingActive ? commitTableCell : undefined}
					onsmartartnodecommit={editingActive ? commitSmartArtNode : undefined}
					onsmartartnodefill={editingActive ? commitSmartArtFill : undefined}
					{onstageholder}
					onstagepointerdown={controller.onStagePointerDown}
					onstagepointermove={controller.onStagePointerMove}
					onstagedblclick={controller.onStageDblClick}
					onstagecontextmenu={controller.onStageContextMenu}
					onstageclick={presenting ? onAdvance : undefined}
					{aiPickMode}
					{aiActive}
					{onaipickelement}
				>
					{#if aiHighlights.length > 0}
						<AiFocusHighlightOverlay
							highlights={aiHighlights}
							elements={activeSlide?.elements ?? []}
							activeSlideIndex={current}
							{scale}
							{canvasSize}
						/>
					{/if}
					{#if editingActive && guides.length && onchangeguide}<AlignmentGuides {guides} {scale} onchange={onchangeguide} />{/if}
					{#if editingActive}
						<EditorLayer {controller} {scale} {spellCheck} />
						<InkDrawingOverlay ink={editor.inkOps} {canvasSize} />
					{/if}
					{#if presenting}<PresentationAnnotationOverlay {annotations} {current} {canvasSize} />{/if}
					{#if collabCursors.length > 0}
						<CollaborationCursors cursors={collabCursors} zoom={scale} />
					{/if}
					{#if presenting && presentationTransition}
						<PresentationTransitionOverlay
							outgoingSlide={presentationTransition.outgoing}
							incomingSlide={presentationTransition.incoming}
							{canvasSize}
							{mediaDataUrls}
							{scale}
							transition={presentationTransition.transition}
							ondone={onTransitionDone}
						/>
					{/if}
				</SlideCanvas>
				{#if contextMenu}
					<ElementContextMenu x={contextMenu.x} y={contextMenu.y} {editor} {onaskai} {onfixai} onclose={onContextMenuClose} />
				{/if}
			{:else}
				<div class="pptx-svelte-message" role="status">{t('pptx.statusBar.noSlides')}</div>
			{/if}
		</div>
		{#if showNotes && chromeVisible && displaySlides.length > 0}
			<NotesPanel
				slide={activeSlide}
				expanded={notesExpanded}
				onupdate={onNotesCommit}
				ontoggle={onNotesToggle}
			/>
		{/if}
	</div>
	{#if editingActive && chromeVisible && displaySlides.length > 0 && chromeUi?.inspectorOpen !== false}
		<InspectorPanel {editor} {handler} {presentationTheme} {onthemechange} {mediaDataUrls} ui={chromeUi} {canvasSize} />
	{/if}
</div>

<style>
	.pptx-svelte-body {
		display: flex;
		flex: 1;
		min-height: 0;
	}

	.pptx-svelte-main {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
		min-height: 0;
	}

	.pptx-svelte-viewport {
		flex: 1;
		display: flex;
		overflow: auto;
		min-width: 0;
		min-height: 0;
	}

	.pptx-svelte-message {
		margin: auto;
		font-family: system-ui, sans-serif;
		font-size: 14px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}
</style>
