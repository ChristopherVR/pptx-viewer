<script lang="ts">
	/**
	 * ViewerMain: whichever body is on screen, the master/layout workspace or the
	 * normal three-column deck view, plus the mapping from the viewer's
	 * composition bag onto that body's prop contract. Split out of
	 * `PowerPointViewer.svelte` to keep that file within the repo's file-size
	 * budget; it owns no state.
	 *
	 * The DOM-bound callbacks (`onstageholder` / `onstageresize` /
	 * `onscalechange`) are forwarded rather than handled here: the values they
	 * report back are read by `createViewerState` through getters, so they have
	 * to stay owned by the component that constructed it.
	 */
	import type { Translator } from '../../i18n/translator';
	import type { PptxAiConfig } from 'pptx-viewer-shared/ai';

	import type { ViewerStateBag } from '../state/create-viewer-state-types';
	import MasterViewBody from './MasterViewBody.svelte';
	import ViewerBody from './ViewerBody.svelte';

	interface ViewerMainProps {
		vm: ViewerStateBag;
		t: Translator;
		showThumbnails: boolean;
		showNotes: boolean;
		/** Host `ai` prop; the on-canvas AI affordances are inert without it. */
		ai: PptxAiConfig | undefined;
		/** Host `onnotesupdate`; a read-only deck still forwards notes edits. */
		onnotesupdate: ((notes: string) => void) | undefined;
		/** Reports the scaled stage holder (editing hit-surface, export anchor). */
		onstageholder: (el: HTMLDivElement | null) => void;
		/** Reports the measured viewport, which drives fit-to-viewport scale. */
		onstageresize: (width: number, height: number) => void;
		/** Reports the master workspace's own zoom (gesture maths uses it there). */
		onscalechange: (scale: number) => void;
	}

	const {
		vm,
		t,
		showThumbnails,
		showNotes,
		ai,
		onnotesupdate,
		onstageholder,
		onstageresize,
		onscalechange,
	}: ViewerMainProps = $props();

	// Stable controller references (the bag is built once and never reassigned).
	// svelte-ignore state_referenced_locally
	const { loader, viewer, editor, controller, chromeUi, parityUi, collab } = vm;

	function applyTheme(next: NonNullable<typeof loader.presentationTheme>): void {
		loader.presentationTheme = next;
		loader.colorScheme = next.colorScheme;
	}
</script>

{#if editor.masterViewTarget}
	<MasterViewBody
		{editor}
		{controller}
		canvasSize={loader.canvasSize}
		notesCanvasSize={loader.notesCanvasSize}
		mediaDataUrls={loader.mediaDataUrls}
		onstageholder={(el) => onstageholder(el)}
		onscalechange={(next) => onscalechange(next)}
	/>
{:else}
	<ViewerBody
		{t}
		{editor}
		{chromeUi}
		handler={loader.handler}
		presentationTheme={loader.presentationTheme}
		onthemechange={applyTheme}
		chromeVisible={vm.chromeVisible}
		{showThumbnails}
		{showNotes}
		displaySlides={vm.displaySlides}
		canvasSize={loader.canvasSize}
		mediaDataUrls={loader.mediaDataUrls}
		current={viewer.current}
		onselect={(index) => viewer.goTo(index)}
		loading={loader.loading}
		isEncrypted={loader.isEncrypted}
		error={loader.error}
		activeSlide={vm.activeSlide}
		scale={vm.scale}
		presenting={viewer.isFullscreen}
		presentationTransition={vm.presentation.transition}
		onTransitionDone={() => vm.presentation.endTransition()}
		onAdvance={(event) => vm.presentation.handleStageClick(event.target)}
		editingActive={vm.editingActive}
		{controller}
		annotations={parityUi.annotations}
		guides={parityUi.showGuides ? parityUi.guides : []}
		onchangeguide={(index, position) => {
			parityUi.guides = parityUi.guides.map((guide, guideIndex) =>
				guideIndex === index ? { ...guide, position } : guide,
			);
		}}
		onaddguide={(axis, position) => {
			parityUi.guides = [...parityUi.guides, { axis, position }];
			parityUi.showGuides = true;
		}}
		showRulers={parityUi.preferences.showRulers}
		spellCheck={parityUi.preferences.spellCheck}
		{onstageresize}
		onstageholder={(el) => onstageholder(el)}
		notesExpanded={vm.notesExpanded}
		onNotesCommit={vm.editable || onnotesupdate ? vm.onNotesCommit : undefined}
		onNotesToggle={vm.onNotesToggle}
		collabCursors={collab.cursors}
		collabPresences={collab.remotePresences}
		contextMenu={vm.stageContextMenu}
		onContextMenuClose={() => {
			vm.stageContextMenu = null;
		}}
		onmoveSlide={(fromIndex, toIndex) => {
			const target = editor.slidesOps.moveSlide(fromIndex, toIndex);
			if (target !== null) viewer.goTo(target);
		}}
		aiPickMode={ai ? vm.ai.panel.pickMode : false}
		aiActive={ai ? vm.ai.panel.canvasAnimating : false}
		aiHighlights={vm.ai.canvasHighlights}
		aiChangeBatch={ai ? vm.ai.panel.changeBatch : null}
		onaipickelement={ai ? (elementId) => vm.ai.panel.addPick(viewer.current, elementId) : undefined}
		onaskai={ai && editor.selectedElement ? () => vm.ai.panel.askAboutSelection() : undefined}
		onfixai={ai && editor.selectedElement ? () => vm.ai.panel.fixSelection() : undefined}
	/>
{/if}
