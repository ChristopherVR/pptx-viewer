<script lang="ts">
	/**
	 * ThumbnailRail: vertical slide-thumbnail sidebar. Each thumbnail renders
	 * the real `SlideStage` at miniature scale, so thumbnails always match the
	 * main canvas.
	 */
	import { useTranslator } from '../../i18n/context';
	import SlideStage from './SlideStage.svelte';
	import type { ThumbnailRailProps } from './props';

	const { slides, canvasSize, mediaDataUrls, current, onselect, editable = false, onmove }: ThumbnailRailProps = $props();

	const t = useTranslator();

	const THUMB_WIDTH = 148;
	const thumbScale = $derived(canvasSize.width > 0 ? THUMB_WIDTH / canvasSize.width : 0.1);
	const thumbHeight = $derived(Math.round(canvasSize.height * thumbScale));
	let draggedIndex = $state<number | null>(null);

	function onDragStart(index: number, event: DragEvent): void {
		draggedIndex = index;
		event.dataTransfer?.setData('text/plain', String(index));
		if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
	}

	function onDrop(index: number, event: DragEvent): void {
		event.preventDefault();
		if (draggedIndex !== null) onmove?.(draggedIndex, index);
		draggedIndex = null;
	}
</script>

<nav class="pptx-svelte-thumbs" aria-label={t('pptx.sections.slides')}>
	{#each slides as slide, index (slide.id)}
		<button
			type="button"
			class="pptx-svelte-thumb"
			class:pptx-svelte-thumb-active={index === current}
			aria-label={t('pptx.slidesPanel.goToSlide', { n: index + 1 })}
			aria-current={index === current ? 'true' : undefined}
			draggable={editable}
			class:pptx-svelte-thumb-dragging={draggedIndex === index}
			class:pptx-svelte-thumb-drop-target={draggedIndex !== null && draggedIndex !== index}
			onclick={() => onselect(index)}
			ondragstart={(event) => onDragStart(index, event)}
			ondragend={() => { draggedIndex = null; }}
			ondragover={editable ? (event) => event.preventDefault() : undefined}
			ondrop={editable ? (event) => onDrop(index, event) : undefined}
		>
			<span class="pptx-svelte-thumb-number">{index + 1}</span>
			<span class="pptx-svelte-thumb-frame" style={`width: ${THUMB_WIDTH}px; height: ${thumbHeight}px`}>
				<SlideStage {slide} {canvasSize} {mediaDataUrls} scale={thumbScale} />
			</span>
		</button>
	{/each}
</nav>

<style>
	.pptx-svelte-thumbs {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 10px;
		overflow-y: auto;
		background: var(--pptx-card, #1e1e2e);
		border-right: 1px solid var(--pptx-border, #33334d);
		flex: none;
	}

	.pptx-svelte-thumb {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		padding: 4px;
		border: none;
		background: transparent;
		cursor: pointer;
		border-radius: var(--pptx-radius, 6px);
	}

	.pptx-svelte-thumb-number {
		font-family: system-ui, sans-serif;
		font-size: 11px;
		color: var(--pptx-muted-foreground, #94a3b8);
		min-width: 14px;
		text-align: right;
		padding-top: 2px;
	}

	.pptx-svelte-thumb-frame {
		display: block;
		overflow: hidden;
		border-radius: 3px;
		outline: 2px solid var(--pptx-border, #33334d);
		background: #fff;
		pointer-events: none;
	}

	.pptx-svelte-thumb-active .pptx-svelte-thumb-frame {
		outline: 2px solid var(--pptx-primary, #6366f1);
	}

	.pptx-svelte-thumb:hover .pptx-svelte-thumb-frame {
		outline-color: var(--pptx-ring, #6366f1);
	}

	.pptx-svelte-thumb[draggable='true'] { cursor: grab; }
	.pptx-svelte-thumb-dragging { opacity: .45; }
	.pptx-svelte-thumb-drop-target { border-top: 2px solid var(--pptx-primary, #6366f1); }
</style>
