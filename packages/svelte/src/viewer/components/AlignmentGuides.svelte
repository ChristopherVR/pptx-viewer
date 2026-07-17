<script lang="ts">
	const { guides, scale, onchange }: { guides: readonly { axis: 'h' | 'v'; position: number }[]; scale: number; onchange: (index: number, position: number) => void } = $props();
	// eslint-disable-next-line prefer-const
	let active = $state<{ index: number; axis: 'h' | 'v' } | null>(null);
	// eslint-disable-next-line prefer-const
	let holder = $state<HTMLDivElement>();

	function move(event: PointerEvent): void {
		if (!active) {
			return;
		}
		const rect = holder?.parentElement?.getBoundingClientRect();
		if (!rect) {
			return;
		}
		const raw = active.axis === 'v' ? event.clientX - rect.left : event.clientY - rect.top;
		onchange(active.index, Math.max(0, raw / scale));
	}
</script>

<svelte:window onpointermove={move} onpointerup={() => (active = null)} />
<div class="guides" bind:this={holder} aria-label="Alignment guides">{#each guides as guide, index}<button type="button" class:vertical={guide.axis === 'v'} class:horizontal={guide.axis === 'h'} aria-label={`${guide.axis === 'v' ? 'Vertical' : 'Horizontal'} guide ${Math.round(guide.position)}`} style={guide.axis === 'v' ? `left:${guide.position * scale}px` : `top:${guide.position * scale}px`} data-pptx-compact onpointerdown={(event) => { event.stopPropagation(); active = { index, axis: guide.axis }; }}></button>{/each}</div>

<style>.guides{position:absolute;inset:0;z-index:25;pointer-events:none}.guides button{position:absolute;margin:0;padding:0;border:0;background:#06b6d4;pointer-events:auto}.vertical{top:0;bottom:0;width:2px;cursor:ew-resize}.horizontal{left:0;right:0;height:2px;cursor:ns-resize}</style>
