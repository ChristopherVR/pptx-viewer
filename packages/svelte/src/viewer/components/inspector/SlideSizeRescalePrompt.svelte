<script lang="ts">
	/**
	 * SlideSizeRescalePrompt: PowerPoint's Maximize/Ensure Fit choice, shown by
	 * `SlideSizeSection` when a picked preset/orientation size differs from the
	 * current one and the deck has content to rescale. Svelte port of React's
	 * `SlideSizeRescalePrompt`. Confirming either applies the shared
	 * `scaleSlidesForSizeChange` transform (via the caller) together with the
	 * size change, as one undo step.
	 */
	import type { SlideSizeRescaleMode } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';

	const { onchoose }: { onchoose: (mode: SlideSizeRescaleMode) => void } = $props();
	const t = useTranslator();
</script>

<div class="pptx-svelte-slide-size-rescale" data-testid="pptx-slide-size-rescale-prompt">
	<div class="title">{t('pptx.slideSize.rescaleTitle')}</div>
	<div class="description">{t('pptx.slideSize.rescaleDescription')}</div>
	<div class="choices">
		<button
			type="button"
			data-testid="pptx-slide-size-rescale-maximize"
			title={t('pptx.slideSize.rescaleMaximizeHint')}
			class="maximize"
			onclick={() => onchoose('maximize')}
		>
			{t('pptx.slideSize.rescaleMaximize')}
		</button>
		<button
			type="button"
			data-testid="pptx-slide-size-rescale-ensure-fit"
			title={t('pptx.slideSize.rescaleEnsureFitHint')}
			class="ensure-fit"
			onclick={() => onchoose('ensureFit')}
		>
			{t('pptx.slideSize.rescaleEnsureFit')}
		</button>
	</div>
</div>

<style>
	.pptx-svelte-slide-size-rescale {
		display: grid;
		gap: 4px;
		margin-top: 8px;
		padding: 6px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 6px;
		background: var(--pptx-muted, #2a2a3d);
		font-size: 11px;
	}
	.title {
		font-weight: 600;
	}
	.description {
		color: var(--pptx-muted-foreground, #94a3b8);
	}
	.choices {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
		padding-top: 4px;
	}
	.choices button {
		height: 25px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 5px;
		color: inherit;
		font-size: 11px;
	}
	.maximize {
		background: var(--pptx-primary, #c43b32);
		color: #fff;
	}
	.ensure-fit {
		background: var(--pptx-background, #11111b);
	}
</style>
