<script lang="ts">
	import type { Extrusion3DData, Extrusion3dCss } from 'pptx-viewer-shared';

	const { data }: { data: Extrusion3DData } = $props();

	function css(style: Extrusion3dCss): string {
		return Object.entries(style)
			.map(([key, value]) => `${key.replace(/[A-Z]/gu, (c) => `-${c.toLowerCase()}`)}:${typeof value === 'number' ? `${value}px` : value}`)
			.join(';');
	}

	const materialStyle = $derived(
		data.materialOverlay
			? css({
					position: 'absolute', inset: 0, backgroundImage: data.materialOverlay,
					pointerEvents: 'none', borderRadius: 'inherit', transform: String(data.frontFaceStyle.transform ?? ''),
					transformStyle: 'preserve-3d', backfaceVisibility: 'hidden', mixBlendMode: 'normal',
				})
			: undefined,
	);
</script>

{#if data.hasExtrusion && data.panels.length > 0}
	<div class="pptx-svelte-extrusion" style={css(data.wrapperStyle)} aria-hidden="true">
		{#each data.panels as panel (panel.side)}
			<div class="pptx-svelte-extrusion-panel" data-side={panel.side} style={css(panel.style)}></div>
		{/each}
		{#if materialStyle}<div class="pptx-svelte-extrusion-material" style={materialStyle}></div>{/if}
	</div>
{/if}
