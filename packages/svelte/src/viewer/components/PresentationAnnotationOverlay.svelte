<script lang="ts">
	import { pointsToSvgPathD } from 'pptx-viewer-shared';
	import type { CanvasSize } from 'pptx-viewer-shared';
	import type { PresentationAnnotations } from '../presentation/presentation-annotations.svelte';
	const { annotations, current, canvasSize }: { annotations: PresentationAnnotations; current: number; canvasSize: CanvasSize } = $props();
	function point(event: PointerEvent): { x: number; y: number } { const rect = (event.currentTarget as SVGSVGElement).getBoundingClientRect(); return { x: (event.clientX - rect.left) * canvasSize.width / rect.width, y: (event.clientY - rect.top) * canvasSize.height / rect.height }; }
</script>
<div class="overlay" class:interactive={annotations.tool !== 'none'}>
	<svg role="application" aria-label="Slide annotations" viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`} preserveAspectRatio="none" onpointerdown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); annotations.pointerDown(current, point(event)); }} onpointermove={(event) => annotations.pointerMove(current, point(event))} onpointerup={() => annotations.pointerUp(current)} onpointerleave={() => (annotations.laser = null)}>
		{#each annotations.strokes(current) as stroke}<path d={pointsToSvgPathD(stroke.points)} stroke={stroke.color} stroke-width={stroke.width} stroke-opacity={stroke.tool === 'highlighter' ? .4 : 1} />{/each}
		{#if annotations.current}<path d={pointsToSvgPathD(annotations.current.points)} stroke={annotations.current.color} stroke-width={annotations.current.width} stroke-opacity={annotations.current.tool === 'highlighter' ? .4 : 1} />{/if}
		{#if annotations.laser}<circle cx={annotations.laser.x} cy={annotations.laser.y} r="7" class="laser" />{/if}
	</svg>
	<nav aria-label="Annotation tools">{#each [['none','↖'],['pen','✎'],['highlighter','▰'],['eraser','⌫'],['laser','●']] as item}<button class:active={annotations.tool === item[0]} type="button" aria-label={item[0]} onclick={() => (annotations.tool = item[0] as typeof annotations.tool)}>{item[1]}</button>{/each}<input type="color" aria-label="Pen color" bind:value={annotations.color} /><button type="button" aria-label="Clear annotations" onclick={() => annotations.clear()}>×</button></nav>
</div>
<style>
	.overlay{position:absolute;inset:0;z-index:68;pointer-events:none}.overlay svg{width:100%;height:100%;touch-action:none}.overlay.interactive svg{pointer-events:auto}.overlay path{fill:none;stroke-linecap:round;stroke-linejoin:round}.laser{fill:#ef4444;filter:drop-shadow(0 0 8px #ef4444)}nav{position:absolute;right:18px;bottom:18px;display:flex;gap:4px;padding:5px;border:1px solid #ffffff33;border-radius:8px;background:#111d;pointer-events:auto}button,input{width:30px;height:30px;border:0;border-radius:5px;background:transparent;color:#fff}button.active,button:hover{background:#ffffff25}input{padding:5px}
</style>
