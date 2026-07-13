<script lang="ts">
	import type { CanvasSize } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import type { EditorController } from '../editor/editor-controller.svelte';
	import type { EditorState } from '../editor/editor-state.svelte';
	import { layoutToSlide, masterToSlide, selectedMasterSlide } from '../master/master-view';
	import EditorLayer from './EditorLayer.svelte';
	import InkDrawingOverlay from './InkDrawingOverlay.svelte';
	import InspectorPanel from './inspector/InspectorPanel.svelte';
	import SlideStage from './SlideStage.svelte';

	const { editor, controller, canvasSize, mediaDataUrls, onstageholder } = $props<{
		editor: EditorState;
		controller: EditorController;
		canvasSize: CanvasSize;
		mediaDataUrls: Map<string, string>;
		onstageholder: (element: HTMLDivElement | null) => void;
	}>();
	const t = useTranslator();
	const THUMB_WIDTH = 160;
	const thumbScale = $derived(THUMB_WIDTH / Math.max(1, canvasSize.width));
	const target = $derived(editor.masterViewTarget ?? { masterIndex: 0, layoutIndex: null });
	const active = $derived(selectedMasterSlide(editor.slideMasters, target.masterIndex, target.layoutIndex));
	// eslint-disable-next-line prefer-const
	let viewportWidth = $state(0);
	// eslint-disable-next-line prefer-const
	let viewportHeight = $state(0);
	const scale = $derived(Math.max(0.05, Math.min((viewportWidth - 48) / canvasSize.width, (viewportHeight - 48) / canvasSize.height)));
	function attach(node: HTMLDivElement) {
		onstageholder(node);
		return { destroy: () => onstageholder(null) };
	}
</script>

<div class="pptx-svelte-master-workspace">
	<aside class="pptx-svelte-master-nav" aria-label={t('pptx.masterView.slideMastersTitle')}>
		<header><strong>{t('pptx.masterView.slideMastersTitle')}</strong><button type="button" onclick={() => editor.masterOps.exit()} aria-label={t('pptx.mode.closeMasterViewTooltip')}>×</button></header>
		{#each editor.slideMasters as master, mi (master.path)}
			<button type="button" class:active={mi === target.masterIndex && target.layoutIndex === null} onclick={() => editor.masterOps.enter(mi, null)}>
				<span class="thumb" style={`width:${THUMB_WIDTH}px;height:${canvasSize.height * thumbScale}px`}><SlideStage slide={masterToSlide(master)} {canvasSize} {mediaDataUrls} scale={thumbScale} /></span>
				<span>{master.name || t('pptx.master.master')}</span>
			</button>
			{#each master.layouts ?? [] as layout, li (layout.path)}
				<button type="button" class="layout" class:active={mi === target.masterIndex && li === target.layoutIndex} onclick={() => editor.masterOps.enter(mi, li)}>
					<span class="thumb" style={`width:${THUMB_WIDTH}px;height:${canvasSize.height * thumbScale}px`}><SlideStage slide={layoutToSlide(layout)} {canvasSize} {mediaDataUrls} scale={thumbScale} /></span>
					<span>{layout.name || t('pptx.master.layout')}</span>
				</button>
			{/each}
		{:else}
			<p>{t('pptx.master.noSlideMasters')}</p>
		{/each}
	</aside>
	<main class="pptx-svelte-master-canvas" bind:clientWidth={viewportWidth} bind:clientHeight={viewportHeight} aria-label={t('pptx.mode.masterView')}>
		{#if active}
			<div use:attach class="stage" role="application" aria-label={t('pptx.mode.masterView')} style={`width:${canvasSize.width * scale}px;height:${canvasSize.height * scale}px`} onpointerdown={controller.onStagePointerDown} onpointermove={controller.onStagePointerMove} ondblclick={controller.onStageDblClick} oncontextmenu={controller.onStageContextMenu}>
				<SlideStage slide={active} {canvasSize} {mediaDataUrls} {scale} interactive />
				<EditorLayer {controller} {scale} />
				<InkDrawingOverlay ink={editor.inkOps} {canvasSize} />
			</div>
		{/if}
	</main>
	<InspectorPanel {editor} />
</div>

<style>
	.pptx-svelte-master-workspace { display:flex; flex:1; min-height:0; background:var(--pptx-background,#11111b); }
	.pptx-svelte-master-nav { width:210px; overflow:auto; padding:10px; border-right:1px solid var(--pptx-border,#33334d); background:var(--pptx-card,#1e1e2e); }
	header { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; font-size:12px; }
	header button { border:0; background:transparent; color:inherit; font-size:20px; cursor:pointer; }
	.pptx-svelte-master-nav > button { display:flex; width:100%; flex-direction:column; gap:5px; margin:0 0 8px; padding:5px; border:2px solid transparent; border-radius:6px; background:transparent; color:inherit; text-align:left; cursor:pointer; font:10px system-ui,sans-serif; }
	.pptx-svelte-master-nav > button.layout { width:calc(100% - 14px); margin-left:14px; }
	.pptx-svelte-master-nav > button:hover { background:var(--pptx-accent,#33334d); }
	.pptx-svelte-master-nav > button.active { border-color:var(--pptx-primary,#6366f1); background:color-mix(in srgb,var(--pptx-primary,#6366f1) 12%,transparent); }
	.thumb { position:relative; display:block; overflow:hidden; max-width:100%; background:white; pointer-events:none; }
	.pptx-svelte-master-nav p { color:var(--pptx-muted-foreground,#a5a5b5); font-size:12px; }
	.pptx-svelte-master-canvas { display:flex; flex:1; min-width:0; min-height:0; overflow:hidden; }
	.stage { position:relative; margin:auto; overflow:hidden; box-shadow:0 5px 30px #0008; }
</style>
