<script lang="ts">
	import type { PptxSlide } from 'pptx-viewer-core';
	import {
		formatElapsed,
		formatTime,
		NOTES_FONT_SIZE_DEFAULT,
		stepPresenterZoom,
	} from 'pptx-viewer-shared';
	import type { CanvasSize, PresentationPointerTool, PresentationSnapshot } from 'pptx-viewer-shared';

	import SlideStage from './SlideStage.svelte';

	const {
		slides,
		current,
		canvasSize,
		mediaDataUrls,
		startedAt,
		audienceOpen,
		onmove,
		onaudience,
		onexit,
		snapshot,
		onupdate,
		onnavigate,
	}: {
		slides: PptxSlide[];
		current: number;
		canvasSize: CanvasSize;
		mediaDataUrls: Map<string, string>;
		startedAt: number;
		audienceOpen: boolean;
		onmove: (direction: -1 | 1) => void;
		onaudience: () => void;
		onexit: () => void;
		snapshot: PresentationSnapshot;
		onupdate: (patch: Partial<PresentationSnapshot>) => void;
		onnavigate: (index: number) => void;
	} = $props();

let now = $state(Date.now());
// eslint-disable-next-line prefer-const
let notesSize = $state(NOTES_FONT_SIZE_DEFAULT);
// eslint-disable-next-line prefer-const
let showSlides = $state(false);
	const setTool = (tool: PresentationPointerTool) => onupdate({ pointer: { ...(snapshot.pointer ?? { x:.5, y:.5, color:'#ef4444' }), tool } });
	$effect(() => {
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});
	const slide = $derived(slides[current]);
	const nextSlide = $derived(slides.slice(current + 1).find((candidate) => !candidate.hidden));
	const mainScale = $derived(
		canvasSize.width > 0 && canvasSize.height > 0
			? Math.min(760 / canvasSize.width, 460 / canvasSize.height)
			: 1,
	);
	const nextScale = $derived(canvasSize.width > 0 ? 240 / canvasSize.width : 1);
</script>

<div class="presenter" role="dialog" aria-label="Presenter view">
	<div class="strip">
		<button onclick={() => onupdate({ paused: !snapshot.paused })}>{snapshot.paused ? 'Resume' : 'Pause'}</button><button onclick={() => onupdate({ paused:false, elapsedMs:0 })}>Reset</button>
		<button onclick={() => showSlides = true}>All slides</button><button onclick={() => onupdate({ zoom: stepPresenterZoom(snapshot.zoom ?? {scale:1,originX:.5,originY:.5}, -1) })}>Zoom -</button><button onclick={() => onupdate({ zoom: stepPresenterZoom(snapshot.zoom ?? {scale:1,originX:.5,originY:.5}, 1) })}>Zoom +</button>
		{#each ['laser','pen','highlighter','eraser'] as tool}<button class:active={snapshot.pointer?.tool === tool} onclick={() => setTool(snapshot.pointer?.tool === tool ? 'none' : tool as PresentationPointerTool)}>{tool}</button>{/each}
		<button class:active={snapshot.blackout === 'black'} onclick={() => onupdate({blackout:snapshot.blackout === 'black'?'none':'black'})}>B</button><button class:active={snapshot.blackout === 'white'} onclick={() => onupdate({blackout:snapshot.blackout === 'white'?'none':'white'})}>W</button>
		<button class:active={snapshot.subtitlesVisible} onclick={() => onupdate({subtitlesVisible:!snapshot.subtitlesVisible})}>Captions</button><span></span><button onclick={onaudience}>{audienceOpen ? 'Disconnect' : 'Audience'}</button><button onclick={onexit}>End</button>
	</div>
	<section class="current-slide">
		{#if slide}
			<div class="stage-frame" style={`width:${canvasSize.width * mainScale}px;height:${canvasSize.height * mainScale}px;transform:scale(${snapshot.zoom?.scale ?? 1});transform-origin:${(snapshot.zoom?.originX ?? .5)*100}% ${(snapshot.zoom?.originY ?? .5)*100}%`}>
				<SlideStage {slide} {canvasSize} {mediaDataUrls} scale={mainScale} />
			</div>
		{/if}
		<span>Slide {current + 1} of {slides.length}</span>
	</section>
	<aside>
		<header>
			<div><small>Current time</small><strong>{formatTime(new Date(now))}</strong></div>
			<div><small>Elapsed</small><strong>{formatElapsed(now - startedAt)}</strong></div>
			<button onclick={onaudience}>{audienceOpen ? 'Disconnect display' : 'Audience display'}</button>
			<button class="close" onclick={onexit} aria-label="End presentation">×</button>
		</header>
		<nav>
			<button onclick={() => onmove(-1)} disabled={current === 0}>Previous</button>
			<span>{current + 1} / {slides.length}</span>
			<button onclick={() => onmove(1)} disabled={current >= slides.length - 1}>Next</button>
		</nav>
		<section class="next">
			<small>Next slide</small>
			{#if nextSlide}
				<div class="next-frame" style={`width:${canvasSize.width * nextScale}px;height:${canvasSize.height * nextScale}px`}>
					<SlideStage slide={nextSlide} {canvasSize} {mediaDataUrls} scale={nextScale} />
				</div>
			{:else}<em>End of presentation</em>{/if}
		</section>
		<section class="notes">
			<header><small>Speaker notes</small><div><button onclick={() => (notesSize = Math.max(12, notesSize - 2))}>A-</button><button onclick={() => (notesSize = Math.min(36, notesSize + 2))}>A+</button></div></header>
			<div class="notes-body" style={`font-size:${notesSize}px`}>{slide?.notes || 'No notes for this slide'}</div>
		</section>
	</aside>
	{#if showSlides}<div class="grid"><header><h2>See all slides</h2><button onclick={() => showSlides=false}>Close</button></header><main>{#each slides as item,index}<button class:active={index===current} class:hidden={item.hidden} onclick={() => { onnavigate(index); showSlides=false; }}><div style={`width:200px;height:${canvasSize.height*(200/canvasSize.width)}px`}><SlideStage slide={item} {canvasSize} {mediaDataUrls} scale={200/canvasSize.width}/></div><small>{index+1}{item.hidden?' - hidden':''}</small></button>{/each}</main></div>{/if}
</div>

<style>
	.presenter { position:absolute; inset:0; z-index:100; display:flex; padding-top:52px; background:#111827; color:#f8fafc; }
	.strip{position:absolute;inset:0 0 auto;min-height:52px;display:flex;align-items:center;gap:4px;padding:8px 12px;background:#020617;border-bottom:1px solid #ffffff1a}.strip span{flex:1}.strip .active{background:#38bdf8;color:#082f49}
	.current-slide { flex:7; min-width:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px; padding:24px; background:#000; }
	.stage-frame,.next-frame { position:relative; overflow:hidden; }
	aside { flex:3; min-width:300px; max-width:460px; display:flex; flex-direction:column; border-left:1px solid #334155; }
	header,nav { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:12px; border-bottom:1px solid #334155; }
	header div { display:flex; flex-direction:column; }
	small { color:#94a3b8; text-transform:uppercase; font-size:10px; letter-spacing:.08em; }
	button { border:0; border-radius:4px; padding:7px 10px; background:#334155; color:inherit; cursor:pointer; }
	button:disabled { opacity:.4; cursor:default; }
	.close { font-size:20px; padding:3px 9px; }
	.next { padding:14px; border-bottom:1px solid #334155; }
	.next-frame { margin-top:8px; }
	.notes { min-height:0; flex:1; display:flex; flex-direction:column; padding:12px; }
	.notes header { padding:0 0 8px; border:0; }
	.notes header div { flex-direction:row; }
	.notes-body { flex:1; overflow:auto; padding:12px; border:1px solid #334155; border-radius:6px; white-space:pre-wrap; line-height:1.5; }
	.grid{position:absolute;inset:0;z-index:10;display:flex;flex-direction:column;background:#020617fa}.grid header{display:flex;justify-content:space-between}.grid main{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:18px;padding:22px;overflow:auto}.grid main button{text-align:left}.grid main .active{outline:2px solid #38bdf8}.grid main .hidden{opacity:.45}
</style>
