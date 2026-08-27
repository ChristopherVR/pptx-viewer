<script lang="ts">
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import type { PptxAnimationDirection, PptxAnimationRepeatMode, PptxAnimationSequence, PptxAnimationTimingCurve, PptxAnimationTrigger, PptxElementAnimation } from 'pptx-viewer-core';
	import { buildAnimationTimelineRows, DIRECTION_VALUES, REPEAT_MODE_VALUES, schemaLabel, SEQUENCE_VALUES, TIMING_CURVE_VALUES, TRIGGER_VALUES } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { animationTypeLabel, timelineLabel } from '../../inspector/animation-panel-helpers';
	import { reorderAnimationEntries } from './animation-timeline-editing';
	import { DIRECTION_LABEL_KEYS, REPEAT_MODE_LABEL_KEYS, SEQUENCE_LABEL_KEYS, TIMING_CURVE_LABEL_KEYS, TRIGGER_LABEL_KEYS } from './animation-timeline-labels';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();
	const slide = $derived(editor.slides[editor.currentSlideIndex]);
	const animations = $derived(slide?.animations ?? []);
	// Merges the editor's own animations with the deck's read-only native
	// anchors into one full-sequence drag-and-drop timeline.
	const rows = $derived(buildAnimationTimelineRows(animations, slide?.animationTimelineAnchors ?? []));
	const animationByElementId = $derived(new Map(animations.map((anim) => [anim.elementId, anim])));
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
	/**
	 * The row's caption: the animated element, then the effect.
	 *
	 * Both used to be wire values here: the element was printed as its raw
	 * `elementId` (`ppt/slides/slide1.xml-shape-0`) and the effect was not shown
	 * at all, so the row named nothing a user could recognise. The other four
	 * bindings name both.
	 */
	function rowLabel(animation: PptxElementAnimation): string {
		const target = timelineLabel(animation, slide?.elements ?? []);
		return `${target} - ${animationTypeLabel(animation, t)}`;
	}
	function nativeLabel(targetIds: readonly string[]): string {
		return targetIds.map((id) => timelineLabel({ elementId: id } as PptxElementAnimation, slide?.elements ?? [])).join(', ');
	}
	function drop(targetKey: string): void {
		if (draggingId) {
			commit(reorderAnimationEntries(animations, slide?.animationTimelineAnchors ?? [], draggingId, targetKey));
		}
		draggingId = null;
	}
</script>

{#if rows.length}<div class="timeline"><h4>Animation Timeline</h4>{#each rows as row, index (row.key)}{#if row.kind === 'native'}<div role="listitem" class="native" title={t('pptx.animation.nativeEffectHint')} ondragover={(event) => event.preventDefault()} ondrop={() => drop(row.key)}>
	<span class="target">{index + 1}. {t('pptx.animation.nativeEffect')}: {nativeLabel(row.targetIds)}</span>
</div>{:else}{@const animation = animationByElementId.get(row.elementId)}{#if animation}<div role="listitem" class:selected={row.elementId === editor.selectedElementId} draggable="true" ondragstart={() => (draggingId = row.elementId)} ondragover={(event) => event.preventDefault()} ondrop={() => drop(row.key)}>
	<button type="button" class="target" onclick={() => editor.select(row.elementId)}><GripVertical size={12} aria-hidden="true" /> {index + 1}. {rowLabel(animation)}</button>
	<select aria-label="Trigger" value={animation.trigger ?? 'onClick'} onchange={(event) => replace(row.elementId, { trigger: event.currentTarget.value as PptxAnimationTrigger })}>{#each TRIGGER_VALUES as trigger}<option value={trigger}>{schemaLabel(TRIGGER_LABEL_KEYS, trigger, t)}</option>{/each}</select>
	{#if animation.trigger === 'onShapeClick' || animation.trigger === 'onHover'}<select aria-label="Trigger shape" value={animation.triggerShapeId ?? ''} onchange={(event) => replace(row.elementId, { triggerShapeId: event.currentTarget.value || undefined })}><option value="">{t('pptx.animation.trigger.selectShape')}</option>{#each slide?.elements ?? [] as element}<option value={element.id}>{timelineLabel({ elementId: element.id }, slide?.elements ?? [])}</option>{/each}</select>{/if}
	<select aria-label="Direction" value={animation.direction ?? 'fromBottom'} onchange={(event) => replace(row.elementId, { direction: event.currentTarget.value as PptxAnimationDirection })}>{#each DIRECTION_VALUES as direction}<option value={direction}>{schemaLabel(DIRECTION_LABEL_KEYS, direction, t)}</option>{/each}</select>
	<select aria-label="Sequence" value={animation.sequence ?? 'asOne'} onchange={(event) => replace(row.elementId, { sequence: event.currentTarget.value as PptxAnimationSequence })}>{#each SEQUENCE_VALUES as sequence}<option value={sequence}>{schemaLabel(SEQUENCE_LABEL_KEYS, sequence, t)}</option>{/each}</select>
	<select aria-label="Timing curve" value={animation.timingCurve ?? 'ease'} onchange={(event) => replace(row.elementId, { timingCurve: event.currentTarget.value as PptxAnimationTimingCurve })}>{#each TIMING_CURVE_VALUES as curve}<option value={curve}>{schemaLabel(TIMING_CURVE_LABEL_KEYS, curve, t)}</option>{/each}</select>
	<select aria-label="Repeat" value={animation.repeatMode ?? 'none'} onchange={(event) => replace(row.elementId, { repeatMode: event.currentTarget.value === 'none' ? undefined : event.currentTarget.value as PptxAnimationRepeatMode })}>{#each REPEAT_MODE_VALUES as repeat}<option value={repeat}>{schemaLabel(REPEAT_MODE_LABEL_KEYS, repeat, t)}</option>{/each}</select>
	<label>Duration<input type="number" min="0" step="100" value={animation.durationMs ?? 500} onchange={(event) => replace(row.elementId, { durationMs: Number(event.currentTarget.value) })} /></label><label>Delay<input type="number" min="0" step="100" value={animation.delayMs ?? 0} onchange={(event) => replace(row.elementId, { delayMs: Number(event.currentTarget.value) })} /></label><label>Count<input type="number" min="1" value={animation.repeatCount ?? 1} onchange={(event) => replace(row.elementId, { repeatCount: Number(event.currentTarget.value) })} /></label>
</div>{/if}{/if}{/each}</div>{/if}

<style>.timeline{display:grid;flex-basis:100%;gap:4px;padding-top:6px;border-top:1px solid var(--pptx-border)}h4{margin:0;font-size:10px;text-transform:uppercase}.timeline>div{display:grid;grid-template-columns:minmax(130px,1fr) repeat(5,minmax(84px,auto)) repeat(3,64px);gap:4px;align-items:end;padding:4px;border-radius:5px;background:var(--pptx-muted);font-size:9px}.timeline>div.selected{box-shadow:inset 3px 0 var(--pptx-primary)}.timeline>div.native{grid-template-columns:1fr;font-style:italic;opacity:0.7}.target{display:inline-flex;align-items:center;gap:4px;text-align:left}label{display:grid;gap:2px;color:var(--pptx-muted-foreground)}input,select,button{min-width:0;height:24px;border:1px solid var(--pptx-border);border-radius:4px;background:var(--pptx-background);color:inherit;font-size:9px}</style>
