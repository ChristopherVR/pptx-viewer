<script lang="ts">
	import type { PptxAnimationDirection, PptxAnimationRepeatMode, PptxAnimationSequence, PptxAnimationTimingCurve, PptxAnimationTrigger, PptxElementAnimation } from 'pptx-viewer-core';
	import { DIRECTION_VALUES, REPEAT_MODE_VALUES, SEQUENCE_VALUES, TIMING_CURVE_VALUES, TRIGGER_VALUES } from 'pptx-viewer-shared';

	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { reorderAnimationEntries } from './animation-timeline-editing';

	const { editor }: { editor: EditorState } = $props();
	const slide = $derived(editor.slides[editor.currentSlideIndex]);
	const animations = $derived([...(slide?.animations ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
	let draggingId = $state<string | null>(null);

	function commit(next: PptxElementAnimation[]): void {
		if (!slide) {
			return;
		}
		editor.commitSlides(editor.slides.map((item, index) => index === editor.currentSlideIndex ? { ...item, animations: next } : item));
	}
	function replace(elementId: string, patch: Partial<PptxElementAnimation>): void {
		commit(animations.map((item) => item.elementId === elementId ? { ...item, ...patch } : item));
	}
	function drop(targetId: string): void {
		if (draggingId && draggingId !== targetId) {
			commit(reorderAnimationEntries(animations, draggingId, targetId));
		}
		draggingId = null;
	}
</script>

{#if animations.length}<div class="timeline"><h4>Animation Timeline</h4>{#each animations as animation, index (animation.elementId)}<div role="listitem" class:selected={animation.elementId === editor.selectedElementId} draggable="true" ondragstart={() => (draggingId = animation.elementId)} ondragover={(event) => event.preventDefault()} ondrop={() => drop(animation.elementId)}>
	<button type="button" class="target" onclick={() => editor.select(animation.elementId)}>☰ {index + 1}. {animation.elementId}</button>
	<select aria-label="Trigger" value={animation.trigger ?? 'onClick'} onchange={(event) => replace(animation.elementId, { trigger: event.currentTarget.value as PptxAnimationTrigger })}>{#each TRIGGER_VALUES as trigger}<option value={trigger}>{trigger}</option>{/each}</select>
	{#if animation.trigger === 'onShapeClick' || animation.trigger === 'onHover'}<select aria-label="Trigger shape" value={animation.triggerShapeId ?? ''} onchange={(event) => replace(animation.elementId, { triggerShapeId: event.currentTarget.value || undefined })}><option value="">Choose shape</option>{#each slide?.elements ?? [] as element}<option value={element.id}>{element.id}</option>{/each}</select>{/if}
	<select aria-label="Direction" value={animation.direction ?? 'fromBottom'} onchange={(event) => replace(animation.elementId, { direction: event.currentTarget.value as PptxAnimationDirection })}>{#each DIRECTION_VALUES as direction}<option value={direction}>{direction}</option>{/each}</select>
	<select aria-label="Sequence" value={animation.sequence ?? 'asOne'} onchange={(event) => replace(animation.elementId, { sequence: event.currentTarget.value as PptxAnimationSequence })}>{#each SEQUENCE_VALUES as sequence}<option value={sequence}>{sequence}</option>{/each}</select>
	<select aria-label="Timing curve" value={animation.timingCurve ?? 'ease'} onchange={(event) => replace(animation.elementId, { timingCurve: event.currentTarget.value as PptxAnimationTimingCurve })}>{#each TIMING_CURVE_VALUES as curve}<option value={curve}>{curve}</option>{/each}</select>
	<select aria-label="Repeat" value={animation.repeatMode ?? 'none'} onchange={(event) => replace(animation.elementId, { repeatMode: event.currentTarget.value === 'none' ? undefined : event.currentTarget.value as PptxAnimationRepeatMode })}>{#each REPEAT_MODE_VALUES as repeat}<option value={repeat}>{repeat}</option>{/each}</select>
	<label>Duration<input type="number" min="0" step="100" value={animation.durationMs ?? 500} onchange={(event) => replace(animation.elementId, { durationMs: Number(event.currentTarget.value) })} /></label><label>Delay<input type="number" min="0" step="100" value={animation.delayMs ?? 0} onchange={(event) => replace(animation.elementId, { delayMs: Number(event.currentTarget.value) })} /></label><label>Count<input type="number" min="1" value={animation.repeatCount ?? 1} onchange={(event) => replace(animation.elementId, { repeatCount: Number(event.currentTarget.value) })} /></label>
</div>{/each}</div>{/if}

<style>.timeline{display:grid;flex-basis:100%;gap:4px;padding-top:6px;border-top:1px solid var(--pptx-border)}h4{margin:0;font-size:10px;text-transform:uppercase}.timeline>div{display:grid;grid-template-columns:minmax(130px,1fr) repeat(5,minmax(84px,auto)) repeat(3,64px);gap:4px;align-items:end;padding:4px;border-radius:5px;background:var(--pptx-muted);font-size:9px}.timeline>div.selected{box-shadow:inset 3px 0 var(--pptx-primary)}.target{text-align:left}label{display:grid;gap:2px;color:var(--pptx-muted-foreground)}input,select,button{min-width:0;height:24px;border:1px solid var(--pptx-border);border-radius:4px;background:var(--pptx-background);color:inherit;font-size:9px}</style>
