<script lang="ts">
	import type { MediaBookmark } from 'pptx-viewer-core';

	const { duration, startMs, endMs, currentTime, bookmarks, onchange, onseek }: { duration: number; startMs: number; endMs?: number; currentTime: number; bookmarks: MediaBookmark[]; onchange: (startMs: number, endMs: number) => void; onseek: (seconds: number) => void } = $props();
	// eslint-disable-next-line prefer-const
	let bar = $state<HTMLDivElement>();
	// eslint-disable-next-line prefer-const
	let dragging = $state<'start' | 'end' | null>(null);
	const safeDuration = $derived(Math.max(duration, 0.1));
	const effectiveEnd = $derived(endMs && endMs > 0 ? endMs : duration * 1000);

	function timeAt(clientX: number): number {
		const rect = bar?.getBoundingClientRect();
		if (!rect) {
			return 0;
		}
		return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * safeDuration;
	}
	function move(event: PointerEvent): void {
		if (!dragging) {
			return;
		}
		const ms = timeAt(event.clientX) * 1000;
		if (dragging === 'start') {
			onchange(Math.max(0, Math.min(ms, effectiveEnd - 100)), effectiveEnd);
		} else {
			onchange(startMs, Math.min(duration * 1000, Math.max(ms, startMs + 100)));
		}
	}
	function keySeek(event: KeyboardEvent): void {
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
			return;
		}
		event.preventDefault();
		onseek(Math.max(0, Math.min(duration, currentTime + (event.key === 'ArrowRight' ? 0.5 : -0.5))));
	}
</script>

<svelte:window onpointermove={move} onpointerup={() => (dragging = null)} />
<div class="times"><span>{(startMs / 1000).toFixed(1)}s</span><span>{(effectiveEnd / 1000).toFixed(1)}s</span></div>
<div class="timeline" bind:this={bar} role="slider" aria-label="Media trim timeline" aria-valuemin="0" aria-valuemax={duration} aria-valuenow={currentTime} tabindex="0" onclick={(event) => onseek(timeAt(event.clientX))} onkeydown={keySeek}>
	<div class="range" style={`left:${startMs / 1000 / safeDuration * 100}%;right:${100 - effectiveEnd / 1000 / safeDuration * 100}%`}></div>
	<div class="playhead" style={`left:${currentTime / safeDuration * 100}%`}></div>
	<button type="button" class="handle start" aria-label="Trim start" style={`left:${startMs / 1000 / safeDuration * 100}%`} onpointerdown={(event) => { event.stopPropagation(); dragging = 'start'; }}></button>
	<button type="button" class="handle end" aria-label="Trim end" style={`left:${effectiveEnd / 1000 / safeDuration * 100}%`} onpointerdown={(event) => { event.stopPropagation(); dragging = 'end'; }}></button>
	{#each bookmarks as bookmark}<button type="button" class="bookmark" title={bookmark.label} aria-label={bookmark.label} style={`left:${bookmark.time / safeDuration * 100}%`} onclick={(event) => { event.stopPropagation(); onseek(bookmark.time); }}></button>{/each}
</div>

<style>.times{display:flex;justify-content:space-between;color:var(--pptx-muted-foreground);font-size:9px}.timeline{position:relative;height:22px;border-radius:5px;background:var(--pptx-muted);cursor:pointer}.range{position:absolute;inset-block:0;background:color-mix(in srgb,var(--pptx-primary) 30%,transparent)}.playhead{position:absolute;inset-block:0;width:2px;background:white}.handle,.bookmark{position:absolute;top:0;bottom:0;width:7px;transform:translateX(-50%);border:0;background:var(--pptx-primary);cursor:ew-resize}.bookmark{width:3px;background:#facc15;cursor:pointer}</style>
