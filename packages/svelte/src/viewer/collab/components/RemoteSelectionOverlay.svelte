<script lang="ts">
	/**
	 * RemoteSelectionOverlay: presentational overlay that draws a coloured
	 * rectangle around each element a remote collaborator has selected,
	 * labelled with that peer's name in their colour (Google-Slides-style
	 * presence). Svelte port of the Vue `RemoteSelectionOverlay.vue`; owns no
	 * network/Yjs logic.
	 *
	 * Like `CollaborationCursors`, this overlay is mounted inside the
	 * non-transformed stage holder (already sized canvasSize * scale), so the
	 * unscaled slide-space element geometry is multiplied by `zoom` here.
	 * The overlay sets `pointer-events: none` so it never intercepts canvas
	 * input, and sits just below the cursors overlay (z-index 9997 < 9999).
	 */
	import { formatCursorLabel } from 'pptx-viewer-shared';

	import type { RemoteSelectionOverlayProps } from './props';
	import type { RemoteSelectionBox } from './remote-selection';
	import { resolveRemoteSelectionBoxes } from './remote-selection';

	const { presences, elements, activeSlideIndex, zoom }: RemoteSelectionOverlayProps = $props();

	const boxes = $derived(resolveRemoteSelectionBoxes(presences, elements, activeSlideIndex));

	function boxStyle(box: RemoteSelectionBox): string {
		return [
			`transform: translate(${box.x * zoom}px, ${box.y * zoom}px)`,
			`width: ${box.width * zoom}px`,
			`height: ${box.height * zoom}px`,
			`border-color: ${box.color}`,
		].join('; ');
	}
</script>

<div class="pptx-svelte-remote-selections" aria-hidden="true" data-export-ignore="true">
	{#each boxes as box (box.key)}
		<div class="pptx-svelte-remote-selection" data-selection-key={box.key} style={boxStyle(box)}>
			<span class="pptx-svelte-remote-selection-label" style={`background-color: ${box.color}`}>
				{formatCursorLabel(box.userName)}
			</span>
		</div>
	{/each}
</div>

<style>
	.pptx-svelte-remote-selections {
		position: absolute;
		inset: 0;
		pointer-events: none;
		overflow: visible;
		z-index: 9997;
	}

	.pptx-svelte-remote-selection {
		position: absolute;
		top: 0;
		left: 0;
		box-sizing: border-box;
		border: 2px solid currentcolor;
		border-radius: 2px;
		pointer-events: none;
		will-change: transform;
		transition: transform 90ms linear;
	}

	.pptx-svelte-remote-selection-label {
		position: absolute;
		top: -18px;
		left: -2px;
		max-width: 150px;
		padding: 1px 5px;
		border-radius: 3px;
		color: #ffffff;
		font-family: system-ui, sans-serif;
		font-size: 9px;
		font-weight: 500;
		line-height: 1.3;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
