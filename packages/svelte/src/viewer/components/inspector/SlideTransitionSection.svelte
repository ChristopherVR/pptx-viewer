<script lang="ts">
	/**
	 * SlideTransitionSection: the active slide's transition settings, mirroring
	 * React's `inspector/SlideTransitionSection.tsx` (reached there through
	 * `SlideProperties`, here through the no-selection Properties tab).
	 *
	 * WHY the conditional controls: OOXML overloads a transition's `dir`
	 * attribute. Most types take a compass token, the blinds/checker/comb/
	 * randomBar family takes `horz`/`vert`, and `wheel` takes a spoke count
	 * instead. `TRANSITION_VALID_DIRECTIONS` (core) and
	 * `TRANSITION_ORIENTATION_TYPES` (shared) decide which control applies, so
	 * the panel never offers a direction PowerPoint would drop on save.
	 *
	 * Every edit is a partial merge onto the slide's existing transition and
	 * goes through `EditorState.commitSlides`, so it is undoable and lands on
	 * the same `PptxSlide.transition` the presentation playback reads.
	 */
	import type { PptxSlideTransition, PptxTransitionType } from 'pptx-viewer-core';
	import { TRANSITION_VALID_DIRECTIONS } from 'pptx-viewer-core';
	import { SLIDE_TRANSITION_OPTIONS, TRANSITION_ORIENTATION_TYPES } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';
	import TransitionDirectionPicker from './TransitionDirectionPicker.svelte';
	import TransitionPreview from './TransitionPreview.svelte';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();

	const activeSlide = $derived(editor.slides[editor.currentSlideIndex]);
	const transition = $derived(activeSlide?.transition);
	const transitionType = $derived<PptxTransitionType>(transition?.type ?? 'none');
	const validDirections = $derived(TRANSITION_VALID_DIRECTIONS[transitionType]);
	const usesOrientation = $derived(TRANSITION_ORIENTATION_TYPES.has(transitionType));
	const hasDirections = $derived(
		!usesOrientation && validDirections !== undefined && validDirections.length > 0,
	);
	const isWheel = $derived(transitionType === 'wheel');
	const canEdit = $derived(editor.editable);

	/** Merge a partial change onto the active slide's transition (undoable). */
	function patch(updates: Partial<PptxSlideTransition>): void {
		const index = editor.currentSlideIndex;
		const slide = editor.slides[index];
		if (!slide) {
			return;
		}
		const next: PptxSlideTransition = { type: 'none', ...slide.transition, ...updates };
		editor.commitSlides(editor.slides.map((s, i) => (i === index ? { ...s, transition: next } : s)));
	}

	function commitNumber(raw: string, min: number, max: number, apply: (value: number) => void): void {
		const value = Number(raw);
		if (Number.isFinite(value)) {
			apply(Math.max(min, Math.min(max, Math.round(value))));
		}
	}
</script>

{#if activeSlide}
	<div class="pptx-svelte-transition-fields">
		<label>
			<span>{t('pptx.transition.type')}</span>
			<select
				aria-label={t('pptx.transition.type')}
				disabled={!canEdit}
				value={transitionType}
				onchange={(event) =>
					patch({ type: event.currentTarget.value as NonNullable<PptxSlideTransition['type']> })}
			>
				{#each SLIDE_TRANSITION_OPTIONS as option (option.value)}
					<option value={option.value}>{t(option.i18nKey)}</option>
				{/each}
			</select>
		</label>

		{#if hasDirections && validDirections}
			<div class="pptx-svelte-transition-field">
				<span>{t('pptx.transition.direction')}</span>
				<TransitionDirectionPicker
					directions={validDirections}
					value={transition?.direction}
					onchange={(direction) => patch({ direction })}
				/>
			</div>
		{/if}

		{#if usesOrientation}
			<div class="pptx-svelte-transition-field">
				<span>{t('pptx.transition.orientation')}</span>
				<div class="pptx-svelte-transition-orient">
					{#each ['horz', 'vert'] as const as orient (orient)}
						<button
							type="button"
							disabled={!canEdit}
							aria-pressed={(transition?.orient ?? 'horz') === orient}
							class:pptx-svelte-transition-orient-active={(transition?.orient ?? 'horz') === orient}
							onclick={() => patch({ orient })}
						>
							{t(
								orient === 'horz'
									? 'pptx.slideInspector.horizontal'
									: 'pptx.slideInspector.vertical',
							)}
						</button>
					{/each}
				</div>
			</div>
		{/if}

		{#if isWheel}
			<label>
				<span>{t('pptx.transition.spokes')}</span>
				<input
					type="number"
					min="1"
					max="8"
					disabled={!canEdit}
					value={transition?.spokes ?? 4}
					onchange={(event) =>
						commitNumber(event.currentTarget.value, 1, 8, (spokes) => patch({ spokes }))}
				/>
			</label>
		{/if}

		<label>
			<span>{t('pptx.transition.duration')}</span>
			<input
				type="number"
				min="0"
				max="10000"
				disabled={!canEdit}
				value={Math.round(transition?.durationMs || 320)}
				onchange={(event) =>
					commitNumber(event.currentTarget.value, 0, 10000, (durationMs) => patch({ durationMs }))}
			/>
		</label>

		<label class="pptx-svelte-transition-check">
			<input
				type="checkbox"
				disabled={!canEdit}
				checked={transition?.advanceOnClick !== false}
				onchange={(event) => patch({ advanceOnClick: event.currentTarget.checked })}
			/>
			<span>{t('pptx.transition.advanceOnClick')}</span>
		</label>

		{#if transition?.soundFileName}
			<p class="pptx-svelte-transition-sound">
				<span>{t('pptx.transition.sound')}:</span>
				<b title={transition.soundFileName}>{transition.soundFileName}</b>
			</p>
		{/if}

		{#if transition}
			<TransitionPreview {transition} />
		{/if}
	</div>
{/if}

<style>
	.pptx-svelte-transition-fields {
		display: grid;
		gap: 8px;
	}

	label,
	.pptx-svelte-transition-field {
		display: grid;
		gap: 3px;
	}

	label > span,
	.pptx-svelte-transition-field > span {
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	select,
	input[type='number'] {
		width: 100%;
		min-width: 0;
		height: 26px;
		box-sizing: border-box;
		padding: 0 6px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-background, #11111b);
		color: inherit;
		font: inherit;
	}

	.pptx-svelte-transition-orient {
		display: flex;
		gap: 4px;
	}

	.pptx-svelte-transition-orient button {
		padding: 3px 8px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 4px;
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.pptx-svelte-transition-orient-active {
		background: var(--pptx-primary, #6366f1);
		border-color: var(--pptx-primary, #6366f1);
		color: #fff;
	}

	.pptx-svelte-transition-check {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.pptx-svelte-transition-check input {
		width: auto;
	}

	.pptx-svelte-transition-sound {
		margin: 0;
		overflow: hidden;
		color: var(--pptx-muted-foreground, #94a3b8);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pptx-svelte-transition-sound b {
		color: var(--pptx-card-foreground, #e2e8f0);
		font-weight: 500;
	}
</style>
