<script lang="ts">
	/**
	 * ThumbnailRail: vertical slide-thumbnail sidebar. Each thumbnail renders
	 * the real `SlideStage` at miniature scale, so thumbnails always match the
	 * main canvas.
	 */
	import { computeVirtualRange, SLIDE_VIRTUALIZATION_THRESHOLD } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import SlideStage from './SlideStage.svelte';
	import type { ThumbnailRailProps } from './props';

	const { slides, canvasSize, mediaDataUrls, current, onselect, editable = false, onmove }: ThumbnailRailProps = $props();

	const t = useTranslator();

	const THUMB_WIDTH = 148;
	const thumbScale = $derived(canvasSize.width > 0 ? THUMB_WIDTH / canvasSize.width : 0.1);
	const thumbHeight = $derived(Math.round(canvasSize.height * thumbScale));
	const itemHeight = $derived(thumbHeight + 16);
	const shouldVirtualize = $derived(slides.length >= SLIDE_VIRTUALIZATION_THRESHOLD);
	let draggedIndex = $state<number | null>(null);
	let railEl = $state<HTMLElement>();
	let scrollTop = $state(0);
	let viewportHeight = $state(600);
	const virtualRange = $derived(
		computeVirtualRange(slides.length, itemHeight, scrollTop, viewportHeight),
	);
	const renderedSlides = $derived.by(() => {
		const start = shouldVirtualize ? virtualRange.startIndex : 0;
		const end = shouldVirtualize ? virtualRange.endIndex : slides.length - 1;
		return slides.slice(start, end + 1).map((slide, offset) => ({ slide, index: start + offset }));
	});

	function onScroll(): void {
		if (!railEl) return;
		scrollTop = railEl.scrollTop;
		viewportHeight = railEl.clientHeight || 600;
	}

	$effect(() => {
		if (!shouldVirtualize || !railEl) return;
		const top = current * itemHeight;
		const bottom = top + itemHeight;
		if (top < railEl.scrollTop) railEl.scrollTop = top;
		else if (bottom > railEl.scrollTop + viewportHeight) {
			railEl.scrollTop = Math.max(0, bottom - viewportHeight);
		}
		onScroll();
	});

	function onDragStart(index: number, event: DragEvent): void {
		draggedIndex = index;
		event.dataTransfer?.setData('text/plain', String(index));
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
		}
	}

	function onDrop(index: number, event: DragEvent): void {
		event.preventDefault();
		if (draggedIndex !== null) onmove?.(draggedIndex, index);
		draggedIndex = null;
	}
</script>

<nav bind:this={railEl} bind:clientHeight={viewportHeight} class="pptx-svelte-thumbs" aria-label={t('pptx.sections.slides')} onscroll={onScroll}>
	<div class="pptx-svelte-thumbs-space" data-virtualized={shouldVirtualize ? 'true' : undefined} style={shouldVirtualize ? `height:${virtualRange.totalHeight}px` : undefined}>
	<div class="pptx-svelte-thumbs-window" style={shouldVirtualize ? `position:absolute;inset-inline:0;top:${virtualRange.offsetY}px` : undefined}>
	{#each renderedSlides as { slide, index } (slide.id)}
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
	</div>
	</div>
</nav>

<style>
	.pptx-svelte-thumbs {
		padding: 10px;
		overflow-y: auto;
		background: var(--pptx-card, #1e1e2e);
		border-right: 1px solid var(--pptx-border, #33334d);
		flex: none;
	}

	.pptx-svelte-thumbs-space {
		position: relative;
	}

	.pptx-svelte-thumbs-window {
		display: flex;
		flex-direction: column;
		gap: 8px;
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
