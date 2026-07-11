<script lang="ts">
	/**
	 * TransitionsTab: the ribbon's Transitions tab. A preset gallery that
	 * assigns a slide transition, a duration input (seconds), and an
	 * "Apply to All Slides" checkbox. Every preset click routes through
	 * `EditorState.transitionOps.applyTransition`, which writes the exact
	 * `PptxSlide.transition` field the presentation-mode playback state machine
	 * already consumes (see `presentation/presentation-controller.svelte.ts`),
	 * so a picked transition plays back immediately in Present mode. The
	 * duration field and checkbox are modifiers applied on the *next* preset
	 * click, not independently committed, so typing a duration never spawns
	 * its own history entry.
	 */
	import type { PptxTransitionType } from 'pptx-viewer-core';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { DEFAULT_TRANSITION_DURATION_SEC, TRANSITION_PRESETS } from './transition-presets';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();

	// eslint-disable-next-line prefer-const
	let durationSec = $state(DEFAULT_TRANSITION_DURATION_SEC);
	// eslint-disable-next-line prefer-const
	let applyToAll = $state(false);

	const activeType = $derived<PptxTransitionType | undefined>(
		editor.slides[editor.currentSlideIndex]?.transition?.type,
	);

	function applyPreset(type: PptxTransitionType): void {
		editor.transitionOps.applyTransition(type, Math.round(durationSec * 1000), applyToAll);
	}
</script>

<div class="pptx-svelte-transitionstab" role="group" aria-label={t('pptx.ribbon.tab.transitions')}>
	<div class="pptx-svelte-transitionstab-gallery">
		{#each TRANSITION_PRESETS as preset (preset.type)}
			<button
				type="button"
				disabled={!editor.editable}
				class:pptx-svelte-transitionstab-active={activeType === preset.type}
				aria-label={t(preset.labelKey)}
				title={t(preset.labelKey)}
				onclick={() => applyPreset(preset.type)}
			>
				{t(preset.labelKey)}
			</button>
		{/each}
	</div>

	<label class="pptx-svelte-transitionstab-duration">
		<span>{t('pptx.ribbon.duration')}</span>
		<input
			type="number"
			min="0"
			max="20"
			step="0.25"
			disabled={!editor.editable}
			value={durationSec}
			oninput={(e) => (durationSec = Math.max(0, Number(e.currentTarget.value) || 0))}
		/>
	</label>

	<label class="pptx-svelte-transitionstab-applyall">
		<input type="checkbox" disabled={!editor.editable} bind:checked={applyToAll} />
		{t('pptx.ribbon.applyTransitionToAll')}
	</label>
</div>

<style>
	.pptx-svelte-transitionstab {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 6px;
	}

	.pptx-svelte-transitionstab-gallery {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 4px;
		max-width: 480px;
	}

	.pptx-svelte-transitionstab-gallery button {
		height: 28px;
		padding: 0 8px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 12px;
		white-space: nowrap;
	}

	.pptx-svelte-transitionstab-gallery button:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-transitionstab-gallery button:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-transitionstab-active {
		outline: 2px solid var(--pptx-primary, #6366f1);
		outline-offset: -2px;
	}

	.pptx-svelte-transitionstab-duration,
	.pptx-svelte-transitionstab-applyall {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--pptx-muted-foreground, #94a3b8);
		white-space: nowrap;
	}

	.pptx-svelte-transitionstab-duration input {
		width: 56px;
		height: 26px;
		padding: 0 6px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-background, #11111b);
		color: inherit;
		font: inherit;
	}

	.pptx-svelte-transitionstab-duration input:disabled,
	.pptx-svelte-transitionstab-applyall input:disabled {
		opacity: 0.4;
	}
</style>
