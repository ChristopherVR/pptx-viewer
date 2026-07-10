<script lang="ts">
	/**
	 * ViewerBody: thumbnail rail + slide viewport (stage, editing overlay,
	 * load/error states) + notes panel. Split out of `PowerPointViewer.svelte`
	 * to keep that file under the repo's file-size budget; purely
	 * presentational, all state/logic stays owned by the parent.
	 */
	import type { PptxSlide } from 'pptx-viewer-core';
	import type { CanvasSize } from 'pptx-viewer-shared';

	import type { EditorController } from '../editor/editor-controller.svelte';
	import type { EditorState } from '../editor/editor-state.svelte';
	import type { Translator } from '../../i18n/translator';
	import EditorLayer from './EditorLayer.svelte';
	import InspectorPanel from './InspectorPanel.svelte';
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
		editingActive,
		controller,
		onstageresize,
		onstageholder,
		notesExpanded,
		onNotesCommit,
		onNotesToggle,
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
		editingActive: boolean;
		controller: EditorController;
		/** Reports the viewport's measured client size on every resize. */
		onstageresize: (width: number, height: number) => void;
		/** Reports the stage-holder DOM node once mounted (null on teardown). */
		onstageholder: (el: HTMLDivElement | null) => void;
		notesExpanded: boolean;
		onNotesCommit?: (notes: string) => void;
		onNotesToggle: () => void;
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
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<!-- The stage holder is the editing hit-surface; the overlay above
				     it (pointer-events:none except handles) lets clicks reach the
				     rendered elements underneath. -->
				<div
					use:attachStageHolder={onstageholder}
					class="pptx-svelte-stage-holder"
					class:pptx-svelte-editing={editingActive}
					style={`width: ${canvasSize.width * scale}px; height: ${canvasSize.height * scale}px`}
					onpointerdown={editingActive ? controller.onStagePointerDown : undefined}
					ondblclick={editingActive ? controller.onStageDblClick : undefined}
				>
					<SlideStage slide={activeSlide} {canvasSize} {mediaDataUrls} {scale} {presenting} interactive />
					{#if editingActive}
						<EditorLayer {controller} {scale} />
					{/if}
				</div>
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
