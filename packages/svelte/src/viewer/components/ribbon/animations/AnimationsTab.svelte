<script lang="ts">
	/**
	 * AnimationsTab: the ribbon's Animations tab. Entrance/Emphasis/Exit preset
	 * galleries that add one of the three effect buckets to the currently
	 * selected element, plus a "Remove Animation" action. Both route through
	 * `EditorState.animationOps`, which writes `PptxSlide.animations` (keyed by
	 * `elementId`), the exact field the presentation-mode click-stepped
	 * playback already reads (see `buildClickGroups` in
	 * `presentation/animation-playback.svelte.ts`). Every button is disabled
	 * without an element selection, since animations always target a specific
	 * element.
	 */
	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { ANIMATION_CATEGORIES } from './animation-categories';
	import AnimationTimeline from './AnimationTimeline.svelte';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();

	const disabled = $derived(!editor.editable || !editor.selectedElementId);
</script>

<div class="pptx-svelte-animationstab" role="group" aria-label={t('pptx.ribbon.tab.animations')}>
	{#each ANIMATION_CATEGORIES as category (category.group)}
		<div class="pptx-svelte-animationstab-group">
			<span class="pptx-svelte-animationstab-label">{t(category.labelKey)}</span>
			<div class="pptx-svelte-animationstab-gallery">
				{#each category.presets as preset (preset)}
					<button
						type="button"
						{disabled}
						aria-label={t(`pptx.animation.preset.${preset}`)}
						title={t(`pptx.animation.preset.${preset}`)}
						onclick={() => editor.animationOps.addAnimation(category.group, preset)}
					>
						{t(`pptx.animation.preset.${preset}`)}
					</button>
				{/each}
			</div>
		</div>
	{/each}

	<button
		type="button"
		{disabled}
		class="pptx-svelte-animationstab-remove"
		aria-label={t('pptx.animation.remove')}
		title={t('pptx.animation.remove')}
		onclick={() => editor.animationOps.removeAnimation()}
	>
		{t('pptx.animation.remove')}
	</button>
	<AnimationTimeline {editor} />
</div>

<style>
	.pptx-svelte-animationstab {
		display: flex;
		align-items: flex-start;
		flex-wrap: nowrap;
		gap: 8px;
		max-width: 100%;
		overflow-x: auto;
	}

	.pptx-svelte-animationstab-group {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.pptx-svelte-animationstab-label {
		font-size: 10.5px;
		font-weight: 600;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-animationstab-gallery {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		max-width: 380px;
	}

	.pptx-svelte-animationstab button {
		height: 26px;
		padding: 0 8px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 11.5px;
		white-space: nowrap;
	}

	.pptx-svelte-animationstab button:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-animationstab button:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-animationstab-remove {
		align-self: center;
	}
</style>
