<script lang="ts">
	/**
	 * InkView: renders `ink` elements (Svelte port of the vanilla / Vue ink
	 * renderer, viewer subset). Freehand strokes (`inkPaths`) render as inline
	 * SVG `<path>`s inside the element's bounding box, with per-stroke colour /
	 * width / opacity from the parallel arrays. Pressure-sensitive strokes
	 * (per-point `inkPointPressures`, or a legacy varying per-point `inkWidths`
	 * array) render as `<circle>`s whose radius follows the interpolated width
	 * (shared `generatePressureCircles` maths).
	 */
	import { INK_REPLAY_KEYFRAMES } from 'pptx-viewer-shared';

	import { buildInkStrokes, inkViewBox } from '../render';
	import { getContainerStyle, styleToString } from '../style';
	import type { ElementRendererProps } from './props';

	const {
		element,
		zIndex,
		presenting = false,
		interactive = false,
	}: ElementRendererProps = $props();

	const ink = $derived(element.type === 'ink' ? element : undefined);
	const strokes = $derived(ink ? buildInkStrokes(ink, presenting) : []);
	const toolStyle = $derived(ink?.inkTool === 'highlighter' ? 'mix-blend-mode:multiply' : undefined);
	const containerStyle = $derived(styleToString(getContainerStyle(element, zIndex)));
</script>

{#if ink}
	<div class="pptx-svelte-element pptx-svelte-ink" style={containerStyle} data-element-id={element.id} data-pptx-element={interactive ? 'true' : undefined}>
		{#if strokes.length > 0}
			<svg class="pptx-svelte-ink-svg" viewBox={inkViewBox(ink)} preserveAspectRatio="none" style={toolStyle}>
				{#if presenting}<style>{INK_REPLAY_KEYFRAMES}</style>{/if}
				{#each strokes as stroke (stroke.key)}
					{#if stroke.circles}
						<g opacity={stroke.opacity}>
							{#each stroke.circles as circle, i (i)}
								<circle cx={circle.cx} cy={circle.cy} r={circle.r} fill={stroke.color} />
							{/each}
						</g>
					{:else}
						<path
							d={stroke.d}
							fill="none"
							stroke={stroke.color}
							stroke-width={stroke.width}
							stroke-opacity={stroke.opacity}
							stroke-linecap="round"
							stroke-linejoin="round"
							vector-effect="non-scaling-stroke"
							stroke-dasharray={stroke.replay?.strokeDasharray}
							stroke-dashoffset={stroke.replay?.strokeDashoffset}
							style={stroke.replay
								? `animation:${stroke.replay.animation};--ink-path-length:${stroke.replay.pathLength}`
								: undefined}
						/>
					{/if}
				{/each}
			</svg>
		{/if}
	</div>
{/if}

<style>
	.pptx-svelte-ink-svg {
		width: 100%;
		height: 100%;
		pointer-events: none;
		display: block;
	}
</style>
