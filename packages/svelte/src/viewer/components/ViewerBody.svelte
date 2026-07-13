<script lang="ts">
	/**
	 * ViewerBody: thumbnail rail + slide viewport (stage, editing overlay,
	 * load/error states) + notes panel. Split out of `PowerPointViewer.svelte`
	 * to keep that file under the repo's file-size budget; purely
	 * presentational, all state/logic stays owned by the parent.
	 */
	import type { PptxSlide, TextSegment } from 'pptx-viewer-core';
	import type { CanvasSize, RemoteCursor } from 'pptx-viewer-shared';

	import CollaborationCursors from '../collab/components/CollaborationCursors.svelte';
	import type { EditorController } from '../editor/editor-controller.svelte';
	import type { EditorState } from '../editor/editor-state.svelte';
	import type { Translator } from '../../i18n/translator';
	import type { TransitionState } from '../presentation';
	import { PresentationTransitionOverlay } from '../presentation';
	import EditorLayer from './EditorLayer.svelte';
	import ElementContextMenu from './ElementContextMenu.svelte';
	import InkDrawingOverlay from './InkDrawingOverlay.svelte';
	import InspectorPanel from './inspector/InspectorPanel.svelte';
	import NotesPanel from './NotesPanel.svelte';
	import SlideStage from './SlideStage.svelte';
	import ThumbnailRail from './ThumbnailRail.svelte';

	const {
		t,
		editor,
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
	}: {
		t: Translator;
		editor: EditorState;
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
		/** Reports the viewport's measured client size on every resize. */
		onstageresize: (width: number, height: number) => void;
		/** Reports the stage-holder DOM node once mounted (null on teardown). */
		onstageholder: (el: HTMLDivElement | null) => void;
		notesExpanded: boolean;
		onNotesCommit?: (notes: string, segments?: TextSegment[]) => void;
		onNotesToggle: () => void;
		/** Remote collaborators' cursors on the active slide (unscaled slide px). */
		collabCursors?: RemoteCursor[];
		/** Open element menu position, supplied by the editing controller. */
		contextMenu: { x: number; y: number } | null;
		onContextMenuClose: () => void;
	} = $props();

	// The template's bind:clientWidth/Height write these (invisible to the linter).
	// eslint-disable-next-line prefer-const
	let viewportWidth = $state(0);
	// eslint-disable-next-line prefer-const
	let viewportHeight = $state(0);
	$effect(() => {
		onstageresize(viewportWidth, viewportHeight);
	});

	/** Reports the stage-holder node to the parent on mount/teardown. */
	function attachStageHolder(node: HTMLDivElement, callback: (el: HTMLDivElement | null) => void) {
		callback(node);
		return {
			destroy(): void {
				callback(null);
			},
		};
	}
</script>

<div class="pptx-svelte-body">
	{#if showThumbnails && chromeVisible && displaySlides.length > 0}
		<ThumbnailRail slides={displaySlides} {canvasSize} {mediaDataUrls} {current} {onselect} />
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
				<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
				<!-- The stage holder is the editing hit-surface; the overlay above
				     it (pointer-events:none except handles) lets clicks reach the
				     rendered elements underneath. While presenting, a tap advances
				     the show (keyboard advance is handled on the viewer root). -->
				<div
					use:attachStageHolder={onstageholder}
					class="pptx-svelte-stage-holder"
					class:pptx-svelte-editing={editingActive}
					style={`width: ${canvasSize.width * scale}px; height: ${canvasSize.height * scale}px`}
					onpointerdown={editingActive ? controller.onStagePointerDown : undefined}
					onpointermove={editingActive ? controller.onStagePointerMove : undefined}
					ondblclick={editingActive ? controller.onStageDblClick : undefined}
					oncontextmenu={editingActive ? controller.onStageContextMenu : undefined}
					onclick={presenting ? onAdvance : undefined}
				>
					<SlideStage slide={activeSlide} {canvasSize} {mediaDataUrls} {scale} {presenting} interactive />
					{#if editingActive}
						<EditorLayer {controller} {scale} />
						<InkDrawingOverlay ink={editor.inkOps} {canvasSize} />
					{/if}
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
				</div>
				{#if contextMenu}
					<ElementContextMenu x={contextMenu.x} y={contextMenu.y} {editor} onclose={onContextMenuClose} />
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
	{#if editingActive && chromeVisible && displaySlides.length > 0}
		<InspectorPanel {editor} />
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

	.pptx-svelte-stage-holder {
		position: relative;
		margin: auto;
		flex: none;
		overflow: hidden;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.35);
	}

	.pptx-svelte-editing {
		cursor: default;
		touch-action: none;
	}

	.pptx-svelte-message {
		margin: auto;
		font-family: system-ui, sans-serif;
		font-size: 14px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}
</style>
