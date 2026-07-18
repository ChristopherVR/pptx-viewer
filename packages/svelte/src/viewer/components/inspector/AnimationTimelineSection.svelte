<script lang="ts">
	/**
	 * AnimationTimelineSection: the docked panel's timeline visual: a
	 * proportional horizontal bar strip (delay/duration of every animation on
	 * the slide) plus the reorderable animation row list
	 * ({@link AnimationTimelineList}). Port of React's
	 * `AnimationTimelineSection.tsx`; bars preview their effect on hover, like
	 * React's `useAnimationPreview` wiring.
	 */
	import type { PptxElementAnimation } from 'pptx-viewer-core';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';
	import {
		animationTypeLabel,
		buildTimelineBarData,
		sortAnimations,
		timelineLabel,
	} from './animation-panel-helpers';
	import { startAnimationPreview, stopAnimationPreview } from './animation-preview-control';
	import AnimationTimelineList from './AnimationTimelineList.svelte';

	const { editor, selectedElementId }: { editor: EditorState; selectedElementId: string } = $props();
	const t = useTranslator();

	const slide = $derived(editor.slides[editor.currentSlideIndex]);
	const sorted = $derived(sortAnimations(slide?.animations ?? []));
	const bars = $derived(buildTimelineBarData(sorted));

	function label(anim: PptxElementAnimation): string {
		return timelineLabel(anim, slide?.elements ?? []);
	}

	function typeClass(anim: PptxElementAnimation): string {
		if (anim.entrance) {
			return 'is-entrance';
		}
		if (anim.emphasis) {
			return 'is-emphasis';
		}
		if (anim.exit) {
			return 'is-exit';
		}
		return 'is-custom';
	}
</script>

{#if bars.length > 0}
	<div class="pptx-svelte-animtl-block">
		<div class="pptx-svelte-animtl-heading">{t('pptx.animation.timelineBar')}</div>
		<div class="pptx-svelte-animtl-bar">
			{#each bars as bar (bar.anim.elementId)}
				<div
					role="img"
					class={`pptx-svelte-animtl-bar-seg ${typeClass(bar.anim)}`}
					class:is-selected={bar.anim.elementId === selectedElementId}
					style={`left:${bar.leftPercent}%;width:${Math.max(bar.widthPercent, 2)}%`}
					title={`${label(bar.anim)} - ${animationTypeLabel(bar.anim)} (${bar.anim.durationMs ?? 500}ms)`}
					onmouseenter={() => startAnimationPreview(bar.anim)}
					onmouseleave={stopAnimationPreview}
				></div>
			{/each}
		</div>
	</div>
{/if}

<AnimationTimelineList {editor} {selectedElementId} />

<style>
	.pptx-svelte-animtl-block {
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px solid var(--pptx-border, #33334d);
	}

	.pptx-svelte-animtl-heading {
		margin-bottom: 4px;
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-animtl-bar {
		position: relative;
		height: 24px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 4px;
		background: var(--pptx-muted, #2a2a3d);
		overflow: hidden;
	}

	.pptx-svelte-animtl-bar-seg {
		position: absolute;
		top: 2px;
		bottom: 2px;
		border-radius: 2px;
	}

	.pptx-svelte-animtl-bar-seg.is-entrance {
		background: rgb(34 197 94 / 60%);
	}

	.pptx-svelte-animtl-bar-seg.is-emphasis {
		background: rgb(234 179 8 / 60%);
	}

	.pptx-svelte-animtl-bar-seg.is-exit {
		background: rgb(239 68 68 / 60%);
	}

	.pptx-svelte-animtl-bar-seg.is-custom {
		background: rgb(148 163 184 / 40%);
	}

	.pptx-svelte-animtl-bar-seg.is-selected {
		outline: 1px solid var(--pptx-primary, #6366f1);
	}
</style>
