<script lang="ts">
	import { createTranslator } from 'pptx-svelte-viewer/i18n';
	import { CollaborationCursors, createViewerState, EditorLayer, RemoteSelectionOverlay, SlideCanvas } from 'pptx-svelte-viewer/viewer';
	import type { CollaborationShellState, ViewerStateBag } from 'pptx-svelte-viewer/viewer';
	import { onDestroy } from 'svelte';

	import type { HostOwnedDemo } from '../../shared/host-owned-collaboration';

	const { host }: { host: HostOwnedDemo } = $props();
	let root = $state<HTMLDivElement>();
	let stage = $state<HTMLDivElement>();
	let scale = $state(1);
	const viewerState: ViewerStateBag = createViewerState({
		getSource: () => host.source,
		get collaboration() { return host.config; },
		getEditable: () => host.editable,
		getAutosave: () => false,
		getFilePath: () => undefined,
		getFileName: () => host.fileName,
		getInitialSlide: () => 0,
		t: createTranslator(() => 'en'),
		getSmartArt3D: () => false,
		getSurfaceChart3D: () => false,
		getBarChart3D: () => false,
		getLineChart3D: () => false,
		getAreaChart3D: () => false,
		getPieChart3D: () => false,
		getRootEl: () => root,
		getStageHolderEl: () => stage,
		getViewportWidth: () => viewerState.loader.canvasSize.width,
		getViewportHeight: () => viewerState.loader.canvasSize.height,
		getFitPadding: () => 0,
		getMaxFitScale: () => null,
		getMasterScale: () => 1,
	});
	const shellState: CollaborationShellState = $derived(viewerState.shellState);
	onDestroy(() => viewerState.destroy());
	export function getContent(): Promise<Uint8Array> { return viewerState.editingApi.save(); }
	export function setScale(next: number): void {
		scale = next;
		viewerState.viewer.zoomPercent = next * 100;
	}
</script>

<!-- The editing canvas is keyboard-focusable for native selection and arrow-key commands. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div bind:this={root} data-host-custom-shell="svelte" class="shell" role="application" aria-label="Presentation editor" tabindex="0" onkeydown={viewerState.onKeydown}>
	<nav aria-label="Custom slide navigation">
		{#each viewerState.displaySlides as slide, index (slide.id)}
			<button onclick={() => viewerState.viewer.goTo(index)}>Slide {index + 1}</button>
		{/each}
		<output aria-label="Collaboration status">{shellState.status} · {shellState.connectedCount} connected · {shellState.canEdit ? 'Editable' : 'Read only'}</output>
	</nav>
	<div data-pptx-viewport class="viewport">
		{#if viewerState.loader.error}<p role="alert">{viewerState.loader.error}</p>{/if}
		<SlideCanvas
			slide={viewerState.activeSlide}
			canvasSize={viewerState.loader.canvasSize}
			mediaDataUrls={viewerState.loader.mediaDataUrls}
			{scale}
			editingActive={viewerState.editingActive}
			editingElementId={viewerState.controller.editingId}
			selectedElementIds={viewerState.editor.selection.ids}
			onstageholder={(element) => { stage = element ?? undefined; }}
			onstagepointerdown={viewerState.controller.onStagePointerDown}
			onstagepointermove={viewerState.controller.onStagePointerMove}
			onstagedblclick={viewerState.controller.onStageDblClick}
		>
			{#if viewerState.editingActive}<EditorLayer controller={viewerState.controller} {scale} />{/if}
			<RemoteSelectionOverlay presences={viewerState.collab.remotePresences} elements={viewerState.activeSlide?.elements ?? []} activeSlideIndex={viewerState.viewer.current} zoom={scale} />
			<CollaborationCursors cursors={viewerState.collab.cursors} zoom={scale} />
		</SlideCanvas>
	</div>
</div>

<style>
	.shell { height: 100%; display: flex; flex-direction: column; background: #e2e8f0; color: #0f172a; }
	nav { display: flex; gap: 8px; padding: 8px; }
	.viewport { overflow: auto; flex: 1; display: flex; padding: 24px; }
</style>
