<script lang="ts">
	import { DEFAULT_MASTER_PAGE_SIZE } from 'pptx-viewer-shared';
	import type { CanvasSize } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import type { EditorController } from '../editor/editor-controller.svelte';
	import type { EditorState } from '../editor/editor-state.svelte';
	import { selectedMasterSlide } from '../master/master-view';
	import EditorLayer from './EditorLayer.svelte';
	import ElementRenderer from './ElementRenderer.svelte';
	import HandoutMasterCanvas from './HandoutMasterCanvas.svelte';
	import InkDrawingOverlay from './InkDrawingOverlay.svelte';
	import InspectorPanel from './inspector/InspectorPanel.svelte';
	import MasterViewSidebar from './MasterViewSidebar.svelte';
	import NotesMasterCanvas from './NotesMasterCanvas.svelte';
	import SlideStage from './SlideStage.svelte';

	const { editor, controller, canvasSize, notesCanvasSize, mediaDataUrls, onstageholder, onscalechange } =
		$props<{
			editor: EditorState;
			controller: EditorController;
			canvasSize: CanvasSize;
			notesCanvasSize?: CanvasSize;
			mediaDataUrls: Map<string, string>;
			onstageholder: (element: HTMLDivElement | null) => void;
			onscalechange: (scale: number) => void;
		}>();
	const t = useTranslator();
	const target = $derived(
		editor.masterViewTarget ?? { tab: 'slides' as const, masterIndex: 0, layoutIndex: null },
	);
	const activeSlide = $derived(
		target.tab === 'slides'
			? selectedMasterSlide(editor.slideMasters, target.masterIndex, target.layoutIndex)
			: undefined,
	);
	const activeCanvasSize = $derived(
		target.tab === 'notes'
			? (notesCanvasSize ?? DEFAULT_MASTER_PAGE_SIZE)
			: target.tab === 'handout'
				? DEFAULT_MASTER_PAGE_SIZE
				: canvasSize,
	);
	const activeMaster = $derived(
		target.tab === 'notes'
			? editor.notesMaster
			: target.tab === 'handout'
				? editor.handoutMaster
				: undefined,
	);
	// eslint-disable-next-line prefer-const
	let viewportWidth = $state(0);
	// eslint-disable-next-line prefer-const
	let viewportHeight = $state(0);
	const scale = $derived(
		Math.max(
			0.05,
			Math.min(
				(viewportWidth - 48) / activeCanvasSize.width,
				(viewportHeight - 48) / activeCanvasSize.height,
			),
		),
	);
	$effect(() => onscalechange(scale));

	function attach(node: HTMLDivElement) {
		onstageholder(node);
		return { destroy: () => onstageholder(null) };
	}
</script>

<div class="workspace pptx-svelte-master-workspace">
	<MasterViewSidebar {editor} {canvasSize} {mediaDataUrls} />
	<main
		class="canvas pptx-svelte-master-canvas"
		bind:clientWidth={viewportWidth}
		bind:clientHeight={viewportHeight}
		aria-label={t('pptx.mode.masterView')}
	>
		{#if target.tab === 'slides' && activeSlide}
			<div
				use:attach
				class="stage"
				role="application"
				aria-label={t('pptx.mode.masterView')}
				style={`width:${activeCanvasSize.width * scale}px;height:${activeCanvasSize.height * scale}px`}
				onpointerdown={controller.onStagePointerDown}
				onpointermove={controller.onStagePointerMove}
				ondblclick={controller.onStageDblClick}
				oncontextmenu={controller.onStageContextMenu}
			>
				<SlideStage slide={activeSlide} canvasSize={activeCanvasSize} {mediaDataUrls} {scale} interactive editTemplateMode editable />
				<EditorLayer {controller} {scale} />
				<InkDrawingOverlay ink={editor.inkOps} canvasSize={activeCanvasSize} />
			</div>
		{:else if activeMaster}
			<div
				use:attach
				class="stage"
				role="application"
				aria-label={target.tab === 'notes' ? t('pptx.master.notesMasterTitle') : t('pptx.master.handoutMasterTitle')}
				style={`width:${activeCanvasSize.width * scale}px;height:${activeCanvasSize.height * scale}px`}
				onpointerdown={controller.onStagePointerDown}
				onpointermove={controller.onStagePointerMove}
				ondblclick={controller.onStageDblClick}
				oncontextmenu={controller.onStageContextMenu}
			>
				<div class="pptx-svelte-stage master-page" style={`width:${activeCanvasSize.width}px;height:${activeCanvasSize.height}px;transform:scale(${scale})`}>
					{#if target.tab === 'notes'}
						<NotesMasterCanvas notesMaster={editor.notesMaster} canvasSize={activeCanvasSize} />
					{:else}
						<HandoutMasterCanvas handoutMaster={editor.handoutMaster} canvasSize={activeCanvasSize} slidesPerPage={editor.handoutMaster?.slidesPerPage ?? 6} />
					{/if}
					{#each activeMaster.elements ?? [] as element, index (element.id)}
						<ElementRenderer {element} {mediaDataUrls} zIndex={index + 1} interactive editTemplateMode />
					{/each}
				</div>
				<EditorLayer {controller} {scale} />
				<InkDrawingOverlay ink={editor.inkOps} canvasSize={activeCanvasSize} />
			</div>
		{:else if target.tab === 'notes'}
			<NotesMasterCanvas notesMaster={undefined} canvasSize={activeCanvasSize} />
		{:else if target.tab === 'handout'}
			<HandoutMasterCanvas handoutMaster={undefined} canvasSize={activeCanvasSize} slidesPerPage={6} />
		{/if}
	</main>
	<InspectorPanel {editor} />
</div>

<style>
	.workspace { display:flex; flex:1; min-height:0; background:var(--pptx-background,#11111b); }
	.canvas { display:flex; flex:1; min-width:0; min-height:0; overflow:hidden; }
	.stage { position:relative; margin:auto; overflow:hidden; background:#fff; box-shadow:0 5px 30px #0008; }
	.master-page { position:relative; overflow:hidden; transform-origin:top left; background:#fff; }
</style>
