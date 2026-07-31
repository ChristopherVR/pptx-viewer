<script lang="ts">
	/**
	 * ContentPartView: renders `contentPart` elements (embedded XML drawing
	 * parts wrapped in `mc:AlternateContent`), Svelte port of the vanilla /
	 * React `renderContentPart` (viewer subset):
	 *
	 * - Ink strokes (`inkStrokes`) render as inline SVG `<path>`s inside the
	 *   element's bounding box, with per-stroke colour / width / opacity.
	 * - Pressure-sensitive variable-width strokes render when a stroke carries
	 *   varying per-point `pressures`: each sampled point becomes a `<circle>`
	 *   whose radius follows the interpolated width (shared
	 *   `generatePressureCircles` maths, same config as vanilla/React).
	 * - No strokes: a typed fallback box labelled "Content Part", matching the
	 *   other bindings' fallback.
	 * - Presentation mode progressively replays constant-width paths.
	 */
	import { getContentPartReplayStyles, INK_REPLAY_KEYFRAMES } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import { buildContentPartStrokes, contentPartViewBox } from '../render';
	import { getContainerStyle, styleToString } from '../style';
	import type { ElementRendererProps } from './props';

	const {
		element,
		zIndex,
		presenting = false,
		interactive = false,
	}: ElementRendererProps = $props();
	const t = useTranslator();

	const contentPart = $derived(element.type === 'contentPart' ? element : undefined);
	const strokes = $derived(contentPart ? buildContentPartStrokes(contentPart) : []);
	const replayStyles = $derived(
		contentPart && presenting ? getContentPartReplayStyles(contentPart.inkStrokes ?? []) : [],
	);
	const containerStyle = $derived(styleToString(getContainerStyle(element, zIndex)));
</script>

{#if contentPart}
	<div
		class="pptx-svelte-element pptx-svelte-contentpart"
		style={containerStyle}
		data-element-id={element.id}
		data-pptx-element={interactive ? 'true' : undefined}
	>
		{#if strokes.length > 0}
			<svg
				class="pptx-svelte-contentpart-svg"
				viewBox={contentPartViewBox(contentPart)}
				preserveAspectRatio="none"
			>
				{#if presenting}<svelte:element this={'style'}>{INK_REPLAY_KEYFRAMES}</svelte:element>{/if}
				{#each strokes as stroke, index (stroke.key)}
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
							stroke-dasharray={replayStyles[index]?.strokeDasharray}
							stroke-dashoffset={replayStyles[index]?.strokeDashoffset}
							style={replayStyles[index]
								? `animation: ${replayStyles[index].animation}; --ink-path-length: ${replayStyles[index].pathLength}`
								: undefined}
						/>
					{/if}
				{/each}
			</svg>
		{:else}
			<div class="pptx-svelte-contentpart-fallback">
				<span class="pptx-svelte-contentpart-fallback-label">{t('pptx.ink.contentPartFallback')}</span>
			</div>
		{/if}
	</div>
{/if}

<style>
	.pptx-svelte-contentpart-svg {
		width: 100%;
		height: 100%;
		pointer-events: none;
		display: block;
	}

	.pptx-svelte-contentpart-fallback {
		width: 100%;
		height: 100%;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px dashed rgba(100, 116, 139, 0.6);
		border-radius: 4px;
		background: rgba(148, 163, 184, 0.08);
	}

	.pptx-svelte-contentpart-fallback-label {
		font-size: 11px;
		font-family: system-ui, sans-serif;
		color: rgba(100, 116, 139, 0.9);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
</style>
