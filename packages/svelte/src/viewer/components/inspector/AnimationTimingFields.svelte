<script lang="ts">
	/**
	 * AnimationTimingFields: the TIMING block of the docked AnimationPanel
	 * (trigger + trigger-shape picker, duration, delay, timing curve, repeat
	 * count, repeat mode), split out of `AnimationPanel.svelte` to keep both
	 * files inside the repo's 300-LOC budget. Mirrors the corresponding rows
	 * of React's `AnimationPanel.tsx`; only mounted while the selection has an
	 * active animation entry.
	 */
	import type {
		PptxAnimationRepeatMode,
		PptxAnimationTimingCurve,
		PptxAnimationTrigger,
		PptxElementAnimation,
	} from 'pptx-viewer-core';
	import {
		animationFor,
		getElementLabel,
		setDelay,
		setDuration,
		setRepeatCount,
		setRepeatMode,
		setTimingCurve,
		setTrigger,
		setTriggerShapeId,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';
	import { commitSlideAnimations } from './animation-panel-helpers';
	import {
		PANEL_REPEAT_MODE_OPTIONS,
		PANEL_TIMING_CURVE_OPTIONS,
		PANEL_TRIGGER_OPTIONS,
	} from './animation-panel-options';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();

	const slide = $derived(editor.slides[editor.currentSlideIndex]);
	const el = $derived(editor.selectedElement);
	const anims = $derived<PptxElementAnimation[]>(slide?.animations ?? []);
	const anim = $derived(el ? animationFor(anims, el.id) : undefined);
	const canEdit = $derived(editor.editable);
	const triggerShapes = $derived(
		(slide?.elements ?? []).filter((candidate) => candidate.id !== el?.id),
	);

	function commit(next: PptxElementAnimation[]): void {
		if (canEdit) {
			commitSlideAnimations(editor, next);
		}
	}
</script>

<div class="pptx-svelte-animp-subhead">{t('pptx.animation.timing')}</div>

<label>
	<span>{t('pptx.animation.trigger')}</span>
	<select aria-label={t('pptx.animation.trigger')} class="pptx-svelte-animp-trigger" disabled={!canEdit} value={anim?.trigger ?? 'onClick'} onchange={(e) => el && commit(setTrigger(anims, el.id, e.currentTarget.value as PptxAnimationTrigger))}>
		{#each PANEL_TRIGGER_OPTIONS as option (option.value)}<option value={option.value}>{t(option.labelKey)}</option>{/each}
	</select>
</label>

{#if anim?.trigger === 'onShapeClick'}
	<label>
		<span>{t('pptx.animation.trigger.shapeLabel')}</span>
		<select aria-label={t('pptx.animation.trigger.shapeLabel')} class="pptx-svelte-animp-trigger-shape" disabled={!canEdit} value={anim?.triggerShapeId ?? ''} onchange={(e) => el && commit(setTriggerShapeId(anims, el.id, e.currentTarget.value || undefined))}>
			<option value="">{t('pptx.animation.trigger.selectShape')}</option>
			{#each triggerShapes as shape (shape.id)}<option value={shape.id}>{getElementLabel(shape)}</option>{/each}
		</select>
	</label>
{/if}

<label>
	<span>{t('pptx.animation.duration')}</span>
	<input class="pptx-svelte-animp-duration" type="number" min="100" max="10000" step="50" disabled={!canEdit} value={anim?.durationMs ?? 450} onchange={(e) => el && commit(setDuration(anims, el.id, Number(e.currentTarget.value) || 450))} />
</label>
<label>
	<span>{t('pptx.animation.delay')}</span>
	<input class="pptx-svelte-animp-delay" type="number" min="0" max="10000" step="50" disabled={!canEdit} value={anim?.delayMs ?? 0} onchange={(e) => el && commit(setDelay(anims, el.id, Number(e.currentTarget.value) || 0))} />
</label>
<label>
	<span>{t('pptx.animation.timingCurve')}</span>
	<select aria-label={t('pptx.animation.timingCurve')} class="pptx-svelte-animp-curve" disabled={!canEdit} value={anim?.timingCurve ?? 'ease'} onchange={(e) => el && commit(setTimingCurve(anims, el.id, e.currentTarget.value as PptxAnimationTimingCurve))}>
		{#each PANEL_TIMING_CURVE_OPTIONS as option (option.value)}<option value={option.value}>{t(option.labelKey)}</option>{/each}
	</select>
</label>
<label>
	<span>{t('pptx.animation.repeatCount')}</span>
	<input class="pptx-svelte-animp-repeat-count" type="number" min="1" max="100" step="1" disabled={!canEdit} value={anim?.repeatCount ?? 1} onchange={(e) => el && commit(setRepeatCount(anims, el.id, Number(e.currentTarget.value) || 1))} />
</label>
<label>
	<span>{t('pptx.animation.repeatUntil')}</span>
	<select aria-label={t('pptx.animation.repeatUntil')} class="pptx-svelte-animp-repeat-mode" disabled={!canEdit} value={anim?.repeatMode ?? 'none'} onchange={(e) => el && commit(setRepeatMode(anims, el.id, e.currentTarget.value as PptxAnimationRepeatMode | 'none'))}>
		{#each PANEL_REPEAT_MODE_OPTIONS as option (option.value)}<option value={option.value}>{t(option.labelKey)}</option>{/each}
	</select>
</label>

<style>
	.pptx-svelte-animp-subhead {
		padding-top: 6px;
		border-top: 1px solid var(--pptx-border, #33334d);
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	label {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	label > span {
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	select,
	input {
		width: 100%;
		height: 26px;
		box-sizing: border-box;
		padding: 0 6px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		font: inherit;
		font-size: 11px;
	}
</style>
