<script lang="ts">
	/**
	 * ViewerBody: the viewer's three-column layout, thumbnail rail | slide
	 * viewport + notes panel | inspector. Split out of `PowerPointViewer.svelte`
	 * to keep that file under the repo's file-size budget; purely presentational,
	 * all state/logic stays owned by the parent.
	 *
	 * Everything inside the viewport (placeholders, the scaled stage, its ruler
	 * strips and overlay stack, the context menu) lives in `ViewerStage`, and the
	 * prop contract lives in `viewer-body-props.ts`, so this file stays layout
	 * only: it measures the viewport and decides which of the three columns are
	 * present, nothing more.
	 */
	import { MAX_ZOOM_SCALE, MIN_ZOOM_SCALE } from 'pptx-viewer-shared';

	import { canvasPinchZoom } from '../canvas-pinch-zoom';
	import InspectorPanel from './inspector/InspectorPanel.svelte';
	import NotesPanel from './NotesPanel.svelte';
	import ThumbnailRail from './ThumbnailRail.svelte';
	import type { ViewerBodyProps } from './viewer-body-props';
	import ViewerStage from './ViewerStage.svelte';

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
		gridSpacingPx,
		presentationTransition,
		onTransitionDone,
		onAdvance,
		editingActive,
		blackout = 'none',
		controller,
		onstageresize,
		onstageholder,
		getzoomscale,
		onpinchzoom,
		notesExpanded,
		onNotesCommit,
		onNotesToggle,
		collabCursors = [],
		collabPresences = [],
		contextMenu,
		onContextMenuClose,
		onmoveSlide,
		annotations,
		guides = [],
		onchangeguide,
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
	}: ViewerBodyProps = $props();

	// The template's bind:clientWidth/Height write these (invisible to the linter).
	// eslint-disable-next-line prefer-const
	let viewportWidth = $state(0);
	// eslint-disable-next-line prefer-const
	let viewportHeight = $state(0);
	$effect(() => {
		onstageresize(viewportWidth, viewportHeight);
	});
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
			use:canvasPinchZoom={{
				getScale: getzoomscale,
				minScale: MIN_ZOOM_SCALE,
				maxScale: MAX_ZOOM_SCALE,
				onPinchZoom: onpinchzoom,
			}}
		>
			<ViewerStage
				{t}
				{editor}
				{controller}
				{canvasSize}
				{mediaDataUrls}
				{current}
				{loading}
				{isEncrypted}
				{error}
				{activeSlide}
				{scale}
				{presenting}
				{gridSpacingPx}
				{presentationTransition}
				{onTransitionDone}
				{onAdvance}
				{editingActive}
				{blackout}
				{onstageholder}
				{collabCursors}
				{collabPresences}
				{contextMenu}
				{onContextMenuClose}
				{annotations}
				{guides}
				{onchangeguide}
				{onaddguide}
				{showRulers}
				{rulerUnit}
				{spellCheck}
				{chromeUi}
				{aiPickMode}
				{aiActive}
				{aiHighlights}
				{aiChangeBatch}
				{onaipickelement}
				{onaskai}
				{onfixai}
			/>
		</div>
		{#if showNotes && chromeVisible && displaySlides.length > 0}
			<NotesPanel
				slide={activeSlide}
				expanded={notesExpanded}
				onupdate={onNotesCommit}
				ontoggle={onNotesToggle}
				notesStyle={editor.notesMaster?.notesStyle}
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
</style>
