<script lang="ts">
	/**
	 * AnimationTimelineList: the `order`-sorted animation row list of the
	 * docked panel's timeline, with HTML5 drag-drop reordering plus move
	 * up/down buttons (port of the list half of React's
	 * `AnimationTimelineSection.tsx`). Rows preview their effect on hover.
	 * Split from `AnimationTimelineSection.svelte` for the 300-LOC budget.
	 *
	 * Merges the slide's editor-authored animations with its read-only
	 * `animationTimelineAnchors` (the deck's own effect groups) into one
	 * full-sequence timeline: a native anchor renders as a read-only row that
	 * is still a valid drop target, so an editor-authored effect can be
	 * dragged ahead of or behind an effect the deck already had.
	 */
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import MoveRight from '@lucide/svelte/icons/move-right';
	import RotateCw from '@lucide/svelte/icons/rotate-cw';
	import type { PptxElementAnimation } from 'pptx-viewer-core';
	import {
		applyAnimationTimelineOrder,
		buildAnimationTimelineRows,
		reorderAnimationTimelineRows,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';
	import { commitSlideAnimations, timelineLabel } from './animation-panel-helpers';
	import { startAnimationPreview, stopAnimationPreview } from './animation-preview-control';

	const { editor, selectedElementId }: { editor: EditorState; selectedElementId: string } = $props();
	const t = useTranslator();

	const slide = $derived(editor.slides[editor.currentSlideIndex]);
	const animations = $derived(slide?.animations ?? []);
	const rows = $derived(buildAnimationTimelineRows(animations, slide?.animationTimelineAnchors ?? []));
	const animationByElementId = $derived(new Map(animations.map((anim) => [anim.elementId, anim])));
	const canEdit = $derived(editor.editable);

	let dragIndex = $state<number | null>(null);
	let dragOverIndex = $state<number | null>(null);

	function label(anim: PptxElementAnimation): string {
		return timelineLabel(anim, slide?.elements ?? []);
	}

	function nativeLabel(targetIds: readonly string[]): string {
		return targetIds.map((id) => timelineLabel({ elementId: id } as PptxElementAnimation, slide?.elements ?? [])).join(', ');
	}

	function reorder(sourceIndex: number, targetIndex: number): void {
		if (!canEdit || sourceIndex === targetIndex) {
			return;
		}
		const sourceRow = rows[sourceIndex];
		if (sourceRow?.kind !== 'editor') {
			return;
		}
		const nextRows = reorderAnimationTimelineRows(rows, sourceRow.key, targetIndex);
		commitSlideAnimations(editor, applyAnimationTimelineOrder(animations, nextRows));
	}

	function onDragStart(index: number, event: DragEvent): void {
		if (!canEdit || rows[index]?.kind !== 'editor') {
			return;
		}
		dragIndex = index;
		if (event.dataTransfer) {
			event.dataTransfer.effectAllowed = 'move';
			event.dataTransfer.setData('text/plain', String(index));
		}
	}

	function onDragOver(index: number, event: DragEvent): void {
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
		dragOverIndex = index;
	}

	function onDrop(targetIndex: number, event: DragEvent): void {
		event.preventDefault();
		const sourceIndex = dragIndex;
		dragIndex = null;
		dragOverIndex = null;
		if (sourceIndex === null) {
			return;
		}
		reorder(sourceIndex, targetIndex);
	}

	function onDragEnd(): void {
		dragIndex = null;
		dragOverIndex = null;
	}
</script>

{#if rows.length > 0}
	<div class="pptx-svelte-animtl-block">
		<div class="pptx-svelte-animtl-heading">{t('pptx.animation.timeline')}</div>
		<div class="pptx-svelte-animtl-list" role="list">
			{#each rows as row, index (row.key)}
				{#if row.kind === 'native'}
					<div
						role="listitem"
						class="pptx-svelte-animtl-row is-native"
						class:is-dragover={dragOverIndex === index}
						title={t('pptx.animation.nativeEffectHint')}
						ondragover={(event) => onDragOver(index, event)}
						ondrop={(event) => onDrop(index, event)}
					>
						<span class="pptx-svelte-animtl-index">{index + 1}.</span>
						<span class="pptx-svelte-animtl-label">{t('pptx.animation.nativeEffect')}: {nativeLabel(row.targetIds)}</span>
					</div>
				{:else}
					{@const anim = animationByElementId.get(row.elementId)}
					{#if anim}
						<div
							role="listitem"
							class="pptx-svelte-animtl-row"
							class:is-selected={row.elementId === selectedElementId}
							class:is-dragging={dragIndex === index}
							class:is-dragover={dragOverIndex === index}
							draggable={canEdit}
							ondragstart={(event) => onDragStart(index, event)}
							ondragover={(event) => onDragOver(index, event)}
							ondrop={(event) => onDrop(index, event)}
							ondragend={onDragEnd}
							onmouseenter={() => startAnimationPreview(anim)}
							onmouseleave={stopAnimationPreview}
						>
							{#if canEdit}<span class="pptx-svelte-animtl-grip"><GripVertical size={12} aria-hidden="true" /></span>{/if}
							<span class="pptx-svelte-animtl-index">{index + 1}.</span>
							<span class="pptx-svelte-animtl-label">{label(anim)}</span>
							{#if anim.entrance}<span class="pptx-svelte-animtl-kind is-entrance" title={t('pptx.animation.entrance')}><MoveRight size={12} aria-hidden="true" /></span>{/if}
							{#if anim.emphasis}<span class="pptx-svelte-animtl-kind is-emphasis" title={t('pptx.animation.emphasis')}><RotateCw size={12} aria-hidden="true" /></span>{/if}
							{#if anim.exit}<span class="pptx-svelte-animtl-kind is-exit is-flipped" title={t('pptx.animation.exit')}><MoveRight size={12} aria-hidden="true" /></span>{/if}
							{#if canEdit}
								<span class="pptx-svelte-animtl-move">
									<button
										type="button"
										disabled={index === 0}
										title={t('pptx.animation.moveUp')}
										aria-label={t('pptx.animation.moveUp')}
										onclick={(event) => {
											event.stopPropagation();
											reorder(index, index - 1);
										}}
									><ChevronUp size={12} aria-hidden="true" /></button>
									<button
										type="button"
										disabled={index === rows.length - 1}
										title={t('pptx.animation.moveDown')}
										aria-label={t('pptx.animation.moveDown')}
										onclick={(event) => {
											event.stopPropagation();
											reorder(index, index + 1);
										}}
									><ChevronDown size={12} aria-hidden="true" /></button>
								</span>
							{/if}
						</div>
					{/if}
				{/if}
			{/each}
		</div>
	</div>
{/if}

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

	.pptx-svelte-animtl-list {
		display: grid;
		gap: 2px;
		max-height: 160px;
		overflow-y: auto;
	}

	.pptx-svelte-animtl-row {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 2px 4px;
		border-radius: 4px;
		background: var(--pptx-muted, #2a2a3d);
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 10px;
		cursor: grab;
	}

	.pptx-svelte-animtl-row.is-native {
		cursor: default;
		font-style: italic;
		opacity: 0.7;
	}

	.pptx-svelte-animtl-row.is-selected {
		background: color-mix(in srgb, var(--pptx-primary, #6366f1) 30%, transparent);
		color: var(--pptx-primary, #6366f1);
	}

	.pptx-svelte-animtl-row.is-dragging {
		opacity: 0.4;
	}

	.pptx-svelte-animtl-row.is-dragover {
		box-shadow: 0 -2px 0 var(--pptx-primary, #6366f1);
	}

	.pptx-svelte-animtl-grip {
		display: inline-flex;
		flex: none;
		opacity: 0.5;
	}

	.pptx-svelte-animtl-index {
		flex: none;
		width: 16px;
	}

	.pptx-svelte-animtl-label {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pptx-svelte-animtl-kind {
		display: inline-flex;
		flex: none;
	}

	/* React draws the exit marker as the entrance arrow rotated 180deg. */
	.pptx-svelte-animtl-kind.is-flipped {
		transform: rotate(180deg);
	}

	.pptx-svelte-animtl-kind.is-entrance {
		color: rgb(74 222 128 / 90%);
	}

	.pptx-svelte-animtl-kind.is-emphasis {
		color: rgb(250 204 21 / 90%);
	}

	.pptx-svelte-animtl-kind.is-exit {
		color: rgb(248 113 113 / 90%);
	}

	.pptx-svelte-animtl-move {
		display: inline-flex;
		gap: 2px;
		flex: none;
	}

	.pptx-svelte-animtl-move button {
		display: inline-flex;
		align-items: center;
		padding: 0 2px;
		border: none;
		background: transparent;
		color: inherit;
		cursor: pointer;
		line-height: 1;
	}

	.pptx-svelte-animtl-move button:disabled {
		opacity: 0.3;
		cursor: default;
	}
</style>
