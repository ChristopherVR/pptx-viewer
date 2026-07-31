<script lang="ts">
	/**
	 * AnimationsTab: the ribbon's Animations tab, at React's `AnimationsSection`
	 * control set (Preview / Animation gallery / Advanced Animation / Timing).
	 *
	 * The gallery adds one of the three effect buckets to the currently selected
	 * element through `EditorState.animationOps`, which writes
	 * `PptxSlide.animations` (keyed by `elementId`), the exact field the
	 * presentation-mode click-stepped playback already reads (see
	 * `buildClickGroups` in `presentation/animation-playback.svelte.ts`). Every
	 * gallery button is disabled without a selection, since an animation always
	 * targets a specific element.
	 *
	 * Svelte's gallery deliberately offers the full shared preset catalogue
	 * rather than React's six-effect sample; the Advanced Animation and Timing
	 * groups beside it live in `AnimationsAdvancedGroup.svelte`.
	 */
	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import type { ChromeUiState } from '../../../state/chrome-ui.svelte';
	import RibbonCommand from '../RibbonCommand.svelte';
	import RibbonGroup from '../RibbonGroup.svelte';
	import { ANIMATION_CATEGORIES } from './animation-categories';
	import AnimationsAdvancedGroup from './AnimationsAdvancedGroup.svelte';
	import AnimationTimeline from './AnimationTimeline.svelte';
	import { previewElementAnimation } from './animation-preview-player';

	const { editor, chromeUi }: { editor: EditorState; chromeUi?: ChromeUiState } = $props();
	const t = useTranslator();

	const disabled = $derived(!editor.editable || !editor.selectedElementId);
	const selectedAnimation = $derived(
		editor.slides[editor.currentSlideIndex]?.animations?.find(
			(animation) => animation.elementId === editor.selectedElementId,
		),
	);
</script>

<div class="pptx-svelte-animationstab" role="group" aria-label={t('pptx.ribbon.tab.animations')}>
	<RibbonGroup label={t('pptx.animations.preview')}>
		<RibbonCommand
			label={t('pptx.animations.preview')}
			disabled={!selectedAnimation}
			onclick={() => {
				if (selectedAnimation) {
					previewElementAnimation(selectedAnimation);
				}
			}}
		>
			{#snippet icon()}<svg viewBox="0 0 20 20"><path d="m5 3 11 7-11 7z" /></svg>{/snippet}
		</RibbonCommand>
	</RibbonGroup>

	<RibbonGroup label={t('pptx.animations.animation')}>
		<div class="pptx-svelte-animationstab-galleries">
			{#each ANIMATION_CATEGORIES as category (category.group)}
				<div class="pptx-svelte-animationstab-group">
					<span class="pptx-svelte-animationstab-label">{t(category.labelKey)}</span>
					<div class="pptx-svelte-animationstab-gallery">
						{#each category.presets as preset (preset)}
							<button
								type="button"
								{disabled}
								title={t(`pptx.animation.preset.${preset}`)}
								onclick={() => editor.animationOps.addAnimation(category.group, preset)}
							>
								{t(`pptx.animation.preset.${preset}`)}
							</button>
						{/each}
					</div>
				</div>
			{/each}
		</div>
	</RibbonGroup>

	<AnimationsAdvancedGroup {editor} {chromeUi} {disabled} />

	<AnimationTimeline {editor} />
</div>

<style>
	.pptx-svelte-animationstab {
		display: flex;
		align-items: stretch;
		flex-wrap: nowrap;
		gap: 4px;
		max-width: 100%;
		overflow-x: auto;
	}

	.pptx-svelte-animationstab-galleries {
		display: flex;
		align-items: flex-start;
		gap: 8px;
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
		max-width: 240px;
	}

	.pptx-svelte-animationstab-gallery button {
		height: 22px;
		padding: 0 6px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 10.5px;
		white-space: nowrap;
	}

	.pptx-svelte-animationstab-gallery button:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-animationstab-gallery button:disabled {
		opacity: 0.35;
		cursor: default;
	}
</style>
