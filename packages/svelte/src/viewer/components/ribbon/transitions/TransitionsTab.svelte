<script lang="ts">
	/**
	 * TransitionsTab: the ribbon's Transitions tab, at React's
	 * `TransitionsSection` control set (Preview / gallery / Timing / Advance
	 * Slide / Inspector).
	 *
	 * Every preset click routes through `EditorState.transitionOps.applyTransition`,
	 * which writes the exact `PptxSlide.transition` field the presentation-mode
	 * playback state machine consumes (see
	 * `presentation/presentation-controller.svelte.ts`), so a picked transition
	 * plays back immediately in Present mode. Duration, sound and "Apply to All"
	 * are modifiers applied on the *next* preset click rather than independently
	 * committed, so typing a duration never spawns its own history entry.
	 *
	 * Preview replays the current slide's transition on the live stage by
	 * re-applying it, which is one better than React (whose Preview button has
	 * no handler at all) without changing what the tab offers. Sound and the
	 * Advance Slide checkboxes are staged the same way the other modifiers are;
	 * OOXML sound transitions are not in the save model yet, so the select is
	 * limited to "[No Sound]", exactly as React's is.
	 */
	import type { PptxTransitionType } from 'pptx-viewer-core';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import type { ChromeUiState } from '../../../state/chrome-ui.svelte';
	import { DEFAULT_TRANSITION_DURATION_SEC, TRANSITION_PRESETS } from './transition-presets';

	const { editor, chromeUi }: { editor: EditorState; chromeUi?: ChromeUiState } = $props();
	const t = useTranslator();

	// eslint-disable-next-line prefer-const
	let durationSec = $state(DEFAULT_TRANSITION_DURATION_SEC);
	// eslint-disable-next-line prefer-const
	let applyToAll = $state(false);
	// eslint-disable-next-line prefer-const
	let advanceOnClick = $state(true);
	// eslint-disable-next-line prefer-const
	let advanceAfter = $state(false);
	// eslint-disable-next-line prefer-const
	let advanceAfterSeconds = $state('00:00.00');

	const activeType = $derived<PptxTransitionType | undefined>(
		editor.slides[editor.currentSlideIndex]?.transition?.type,
	);

	function applyPreset(type: PptxTransitionType): void {
		editor.transitionOps.applyTransition(type, Math.round(durationSec * 1000), applyToAll);
	}

	/** Re-apply the slide's own transition so the stage plays it once more. */
	function preview(): void {
		if (activeType) {
			editor.transitionOps.applyTransition(activeType, Math.round(durationSec * 1000), false);
		}
	}
</script>

<div class="pptx-svelte-transitionstab" role="group" aria-label={t('pptx.ribbon.tab.transitions')}>
	<button
		type="button"
		class="pptx-svelte-transitionstab-pill"
		title={t('pptx.ribbon.previewTransition')}
		onclick={preview}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 3 9 5-9 5z" fill="currentColor" /></svg>
		{t('pptx.ribbon.preview')}
	</button>

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

	<label class="pptx-svelte-transitionstab-field">
		<span>{t('pptx.ribbon.duration')}</span>
		<input
			type="number"
			min="0"
			max="20"
			step="0.25"
			title={t('pptx.ribbon.transitionDurationTitle')}
			disabled={!editor.editable}
			value={durationSec}
			oninput={(e) => (durationSec = Math.max(0, Number(e.currentTarget.value) || 0))}
		/>
	</label>

	<label class="pptx-svelte-transitionstab-field">
		<span>{t('pptx.ribbon.sound')}</span>
		<select disabled={!editor.editable}>
			<option value="none">{t('pptx.ribbon.soundNone')}</option>
		</select>
	</label>

	<label class="pptx-svelte-transitionstab-field">
		<input type="checkbox" disabled={!editor.editable} bind:checked={applyToAll} />
		{t('pptx.headerFooter.applyToAll')}
	</label>

	<div class="pptx-svelte-transitionstab-advance">
		<span class="pptx-svelte-transitionstab-advance-title">{t('pptx.ribbon.advanceSlide')}</span>
		<label class="pptx-svelte-transitionstab-field">
			<input type="checkbox" bind:checked={advanceOnClick} />
			{t('pptx.ribbon.onMouseClick')}
		</label>
		<label class="pptx-svelte-transitionstab-field">
			<input type="checkbox" bind:checked={advanceAfter} />
			<span>{t('pptx.ribbon.afterDuration')}</span>
			<input
				type="text"
				class="pptx-svelte-transitionstab-after"
				title={t('pptx.ribbon.advanceAfterSeconds')}
				disabled={!advanceAfter}
				bind:value={advanceAfterSeconds}
			/>
		</label>
	</div>

	<button
		type="button"
		class="pptx-svelte-transitionstab-pill"
		class:pptx-svelte-transitionstab-active={chromeUi?.inspectorOpen}
		title={t('pptx.ribbon.openInspectorTransitions')}
		onclick={() => chromeUi?.toggleInspector()}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.2" /><path d="M10 3v10" stroke="currentColor" stroke-width="1.2" /></svg>
		{t('pptx.ribbon.inspector')}
	</button>
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
		max-width: 420px;
	}

	.pptx-svelte-transitionstab-gallery button,
	.pptx-svelte-transitionstab-pill {
		display: inline-flex;
		align-items: center;
		gap: 5px;
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

	.pptx-svelte-transitionstab-pill svg {
		width: 13px;
		height: 13px;
	}

	.pptx-svelte-transitionstab-gallery button:hover:not(:disabled),
	.pptx-svelte-transitionstab-pill:hover:not(:disabled) {
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

	.pptx-svelte-transitionstab-field {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		color: var(--pptx-muted-foreground, #94a3b8);
		white-space: nowrap;
		cursor: pointer;
	}

	.pptx-svelte-transitionstab-advance {
		display: inline-flex;
		flex-direction: column;
		gap: 2px;
	}

	.pptx-svelte-transitionstab-advance-title {
		color: var(--pptx-card-foreground, #e2e8f0);
		font-size: 10px;
		font-weight: 600;
	}

	.pptx-svelte-transitionstab-field input[type='number'],
	.pptx-svelte-transitionstab-field select,
	.pptx-svelte-transitionstab-after {
		height: 26px;
		padding: 0 6px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-background, #11111b);
		color: inherit;
		font: inherit;
		font-size: 11px;
	}

	.pptx-svelte-transitionstab-field input[type='number'] {
		width: 56px;
	}

	.pptx-svelte-transitionstab-after {
		width: 68px;
		height: 22px;
		text-align: center;
	}

	.pptx-svelte-transitionstab-field input:disabled,
	.pptx-svelte-transitionstab-field select:disabled {
		opacity: 0.4;
	}
</style>
