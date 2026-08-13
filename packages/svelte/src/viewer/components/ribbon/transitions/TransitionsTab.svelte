<script lang="ts">
	/**
	 * TransitionsTab: the ribbon's Transitions tab, at React's
	 * `TransitionsSection` control set (Preview / gallery / Timing / Advance
	 * Slide / Inspector).
	 *
	 * The controls hold a `RibbonTransitionDraft` (shared's
	 * `render/ribbon-transitions`), seeded from the active slide so the tab
	 * cannot lie after a navigation, and EVERY control commits that whole draft
	 * through `EditorState.transitionOps.applyRibbonDraft`. That writes the exact
	 * `PptxSlide.transition` field the playback state machine consumes (see
	 * `presentation/presentation-controller.svelte.ts`), so duration and the
	 * Advance Slide boxes take effect on their own rather than waiting for the
	 * next preset click (which is how they used to reach nothing at all).
	 *
	 * Preview REPLAYS the transition on the editing stage through the shared
	 * `playSlideTransitionPreview`, without writing to the deck: re-committing
	 * the values the slide already had (what this and two other bindings used to
	 * do) is a no-op the user cannot see.
	 */
	import type { PptxTransitionType } from 'pptx-viewer-core';
	import type { RibbonTransitionDraft } from 'pptx-viewer-shared';
	import {
		applyRibbonTransitionDraft,
		EMPTY_RIBBON_TRANSITION_DRAFT,
		playSlideTransitionPreview,
		readRibbonTransitionDraft,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import type { ChromeUiState } from '../../../state/chrome-ui.svelte';
	import { TRANSITION_PRESETS } from './transition-presets';

	const { editor, chromeUi }: { editor: EditorState; chromeUi?: ChromeUiState } = $props();
	const t = useTranslator();

	let draft = $state<RibbonTransitionDraft>({ ...EMPTY_RIBBON_TRANSITION_DRAFT });

	// Seeded by the effect below (not at init, which would only ever capture the
	// first `editor`), and re-seeded only when the ACTIVE SLIDE changes rather
	// than after our own commits: a commit-triggered re-seed would untick "After"
	// the moment it is ticked, since an armed-but-zero advance reads back as
	// unarmed.
	let seededKey: string | null = null;
	$effect(() => {
		const index = editor.currentSlideIndex;
		const slide = editor.slides[index];
		const key = `${index}:${slide?.id ?? ''}`;
		if (key !== seededKey) {
			seededKey = key;
			draft = readRibbonTransitionDraft(slide);
		}
	});

	const activeType = $derived<PptxTransitionType | undefined>(
		editor.slides[editor.currentSlideIndex]?.transition?.type,
	);

	/** Fold a control's change into the draft and commit the whole draft. */
	function commit(change: Partial<RibbonTransitionDraft>): void {
		draft = { ...draft, ...change };
		editor.transitionOps.applyRibbonDraft(draft, false);
	}

	/**
	 * PowerPoint's "Apply To All" is a BUTTON that pushes the current timing onto
	 * every slide when pressed, not the arming checkbox this binding used to
	 * render (which made the same preset click mean two different things).
	 */
	function applyToAll(): void {
		editor.transitionOps.applyRibbonDraft(draft, true);
	}

	/** Replay the active slide's transition on the stage. Never writes. */
	function preview(): void {
		const slide = editor.slides[editor.currentSlideIndex];
		playSlideTransitionPreview(
			slide?.transition ?? applyRibbonTransitionDraft(undefined, draft),
			document,
		);
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
				onclick={() => commit({ type: preset.type })}
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
			value={draft.durationSec}
			oninput={(e) => commit({ durationSec: Math.max(0, Number(e.currentTarget.value) || 0) })}
		/>
	</label>

	<!-- Always disabled: no binding can author a transition sound (there is no
	     `p:sndAc` write path in the save model), so an enabled select would be a
	     control that cannot do anything. -->
	<label class="pptx-svelte-transitionstab-field">
		<span>{t('pptx.ribbon.sound')}</span>
		<select disabled>
			<option value="none">{t('pptx.ribbon.soundNone')}</option>
		</select>
	</label>

	<button
		type="button"
		class="pptx-svelte-transitionstab-pill"
		disabled={!editor.editable}
		title={t('pptx.ribbon.applyTransitionToAll')}
		onclick={applyToAll}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="6" y="6" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.2" /><path d="M3 10H2.5a.5.5 0 0 1-.5-.5v-7a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 .5.5V3" fill="none" stroke="currentColor" stroke-width="1.2" /></svg>
		{t('pptx.headerFooter.applyToAll')}
	</button>

	<div class="pptx-svelte-transitionstab-advance">
		<span class="pptx-svelte-transitionstab-advance-title">{t('pptx.ribbon.advanceSlide')}</span>
		<label class="pptx-svelte-transitionstab-field">
			<input
				type="checkbox"
				disabled={!editor.editable}
				checked={draft.advanceOnClick}
				onchange={(e) => commit({ advanceOnClick: e.currentTarget.checked })}
			/>
			{t('pptx.ribbon.onMouseClick')}
		</label>
		<label class="pptx-svelte-transitionstab-field">
			<input
				type="checkbox"
				disabled={!editor.editable}
				checked={draft.advanceAfter}
				onchange={(e) => commit({ advanceAfter: e.currentTarget.checked })}
			/>
			<span>{t('pptx.ribbon.afterDuration')}</span>
			<!-- Committed on `change`, not `input`: half-typed `mm:ss.hh` text would
			     otherwise write a stream of nonsense advances (and history steps). -->
			<input
				type="text"
				class="pptx-svelte-transitionstab-after"
				title={t('pptx.ribbon.advanceAfterSeconds')}
				disabled={!editor.editable || !draft.advanceAfter}
				value={draft.advanceAfterText}
				oninput={(e) => (draft = { ...draft, advanceAfterText: e.currentTarget.value })}
				onchange={(e) => commit({ advanceAfterText: e.currentTarget.value })}
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
