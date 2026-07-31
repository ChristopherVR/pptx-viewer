<script lang="ts">
	/**
	 * AnimationPanel: the docked per-element animation editor, port of React's
	 * `inspector/AnimationPanel.tsx`. Docked at the bottom of the inspector
	 * pane whenever an element is selected (any tab), it edits the slide-level
	 * `PptxSlide.animations` entry for the selection: entrance / emphasis /
	 * exit presets, direction (for directional presets), sequence, the TIMING
	 * block ({@link AnimationTimingFields}), and the timeline section
	 * ({@link AnimationTimelineSection}).
	 *
	 * Every mutation goes through the shared `animation-authoring` setters and
	 * commits via `commitSlideAnimations` -> `EditorState.commitSlides`, so each
	 * change is one undoable history step, exactly like React's
	 * `onUpdateSlide({ animations })` path. Self-gating: renders nothing
	 * without a selection, so the host only adds `<AnimationPanel {editor} />`.
	 */
	import Play from '@lucide/svelte/icons/play';
	import type {
		PptxAnimationDirection,
		PptxAnimationPreset,
		PptxAnimationSequence,
		PptxElementAnimation,
	} from 'pptx-viewer-core';
	import {
		animationFor,
		applyMotionPathPreset,
		clearMotionPath,
		hasAnimation,
		setAnimationEmphasis,
		setAnimationEntrance,
		setAnimationExit,
		setDirection,
		setSequence,
		showDirectionPicker,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';
	import { commitSlideAnimations } from './animation-panel-helpers';
	import {
		PANEL_DIRECTION_OPTIONS,
		PANEL_EMPHASIS_PRESETS,
		PANEL_ENTRANCE_PRESETS,
		PANEL_EXIT_PRESETS,
		PANEL_SEQUENCE_OPTIONS,
	} from './animation-panel-options';
	import { startAnimationPreview } from './animation-preview-control';
	import AnimationTimelineSection from './AnimationTimelineSection.svelte';
	import AnimationTimingFields from './AnimationTimingFields.svelte';
	import MotionPathRow from './MotionPathRow.svelte';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();

	const slide = $derived(editor.slides[editor.currentSlideIndex]);
	const el = $derived(editor.selectedElement);
	const anims = $derived<PptxElementAnimation[]>(slide?.animations ?? []);
	const anim = $derived(el ? animationFor(anims, el.id) : undefined);
	const hasAnim = $derived(el ? hasAnimation(anims, el.id) : false);
	const showDirection = $derived(el ? showDirectionPicker(anims, el.id) : false);
	const canEdit = $derived(editor.editable);

	function commit(next: PptxElementAnimation[]): void {
		if (canEdit) {
			commitSlideAnimations(editor, next);
		}
	}

	function onEffect(group: 'entrance' | 'emphasis' | 'exit', value: string): void {
		if (!el) {
			return;
		}
		const preset = value as PptxAnimationPreset | 'none';
		const apply =
			group === 'entrance'
				? setAnimationEntrance
				: group === 'emphasis'
					? setAnimationEmphasis
					: setAnimationExit;
		commit(apply(anims, el.id, preset));
	}

	function onPreview(): void {
		if (anim) {
			startAnimationPreview(anim);
		}
	}

	/**
	 * Motion path is geometry, not a preset, so it never routes through
	 * `onEffect`. `custom` is the read-only marker for a hand-dragged path:
	 * re-selecting it must not snap the path back to a catalogue entry.
	 */
	function onMotionPath(presetId: string): void {
		if (!el || presetId === 'custom') {
			return;
		}
		commit(
			presetId === 'none'
				? clearMotionPath(anims, el.id)
				: applyMotionPathPreset(anims, el.id, presetId),
		);
	}
</script>

{#if el && slide}
	<div class="pptx-svelte-animp" data-pptx-animation-panel>
		<div class="pptx-svelte-animp-header">
			<span class="pptx-svelte-animp-title">{t('pptx.animation.title')}</span>
			{#if hasAnim}
				<button type="button" class="pptx-svelte-animp-preview" title={t('pptx.animation.preview')} onclick={onPreview}>
					<Play size={12} aria-hidden="true" /> {t('pptx.animation.preview')}
				</button>
			{/if}
		</div>

		<label>
			<span>{t('pptx.animation.entrance')}</span>
			<select class="pptx-svelte-animp-entrance" disabled={!canEdit} value={anim?.entrance ?? 'none'} onchange={(e) => onEffect('entrance', e.currentTarget.value)}>
				<option value="none">{t('pptx.animation.none')}</option>
				{#each PANEL_ENTRANCE_PRESETS as preset (preset)}<option value={preset}>{t(`pptx.animation.preset.${preset}`)}</option>{/each}
			</select>
		</label>

		<label>
			<span>{t('pptx.animation.emphasis')}</span>
			<select class="pptx-svelte-animp-emphasis" disabled={!canEdit} value={anim?.emphasis ?? 'none'} onchange={(e) => onEffect('emphasis', e.currentTarget.value)}>
				<option value="none">{t('pptx.animation.none')}</option>
				{#each PANEL_EMPHASIS_PRESETS as preset (preset)}<option value={preset}>{t(`pptx.animation.preset.${preset}`)}</option>{/each}
			</select>
		</label>

		<label>
			<span>{t('pptx.animation.exit')}</span>
			<select class="pptx-svelte-animp-exit" disabled={!canEdit} value={anim?.exit ?? 'none'} onchange={(e) => onEffect('exit', e.currentTarget.value)}>
				<option value="none">{t('pptx.animation.none')}</option>
				{#each PANEL_EXIT_PRESETS as preset (preset)}<option value={preset}>{t(`pptx.animation.preset.${preset}`)}</option>{/each}
			</select>
		</label>

		<!-- Motion path: geometry, not a preset, so it gets its own row. -->
		<MotionPathRow motionPath={anim?.motionPath} {canEdit} onchange={onMotionPath} />

		{#if hasAnim}
			{#if showDirection}
				<div class="pptx-svelte-animp-direction">
					<span>{t('pptx.animation.direction')}</span>
					<div class="pptx-svelte-animp-direction-row">
						{#each PANEL_DIRECTION_OPTIONS as option (option.value)}
							<button
								type="button"
								disabled={!canEdit}
								class:is-active={anim?.direction === option.value}
								title={t(option.labelKey)}
								aria-label={t(option.labelKey)}
								onclick={() => el && commit(setDirection(anims, el.id, option.value as PptxAnimationDirection))}
							>{option.glyph}</button>
						{/each}
					</div>
				</div>
			{/if}

			<label>
				<span>{t('pptx.animation.sequence')}</span>
				<select class="pptx-svelte-animp-sequence" disabled={!canEdit} value={anim?.sequence ?? 'asOne'} onchange={(e) => el && commit(setSequence(anims, el.id, e.currentTarget.value as PptxAnimationSequence))}>
					{#each PANEL_SEQUENCE_OPTIONS as option (option.value)}<option value={option.value}>{t(option.labelKey)}</option>{/each}
				</select>
			</label>

			<AnimationTimingFields {editor} />
		{/if}

		<AnimationTimelineSection {editor} selectedElementId={el.id} />
	</div>
{/if}

<style>
	.pptx-svelte-animp {
		flex: none;
		max-height: 220px;
		overflow-y: auto;
		padding: 8px 12px 12px;
		border-top: 1px solid var(--pptx-border, #33334d);
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-size: 11px;
	}

	.pptx-svelte-animp-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.pptx-svelte-animp-title {
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-animp-preview {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		border: none;
		background: transparent;
		color: var(--pptx-primary, #6366f1);
		cursor: pointer;
		font: inherit;
		font-size: 10px;
	}

	.pptx-svelte-animp label {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.pptx-svelte-animp label > span,
	.pptx-svelte-animp-direction > span {
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-animp select {
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

	.pptx-svelte-animp-direction {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding-top: 6px;
		border-top: 1px solid var(--pptx-border, #33334d);
	}

	.pptx-svelte-animp-direction-row {
		display: flex;
		gap: 4px;
	}

	.pptx-svelte-animp-direction-row button {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		color: var(--pptx-muted-foreground, #94a3b8);
		cursor: pointer;
		font: inherit;
	}

	.pptx-svelte-animp-direction-row button.is-active {
		border-color: var(--pptx-primary, #6366f1);
		background: color-mix(in srgb, var(--pptx-primary, #6366f1) 20%, transparent);
		color: var(--pptx-primary, #6366f1);
	}

	.pptx-svelte-animp-direction-row button:disabled {
		opacity: 0.5;
		cursor: default;
	}
</style>
