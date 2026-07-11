<script lang="ts">
	/**
	 * DesignTab: the ribbon's Design tab. A theme-preset gallery swapping the
	 * viewer chrome's `ViewerTheme` (see `theme-swatches.ts`), plus a toggle for
	 * the docked `FormatBackgroundPanel`, which edits the current slide's solid
	 * background colour through `EditorState.backgroundOps`.
	 */
	import type { ViewerTheme } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { THEME_SWATCHES } from './theme-swatches';
	import FormatBackgroundPanel from './FormatBackgroundPanel.svelte';

	const {
		editor,
		theme,
		onsettheme,
	}: { editor: EditorState; theme: ViewerTheme | undefined; onsettheme: (theme: ViewerTheme | undefined) => void } =
		$props();
	const t = useTranslator();

	let backgroundOpen = $state(false);

	function toggleBackground(): void {
		backgroundOpen = !backgroundOpen;
	}
</script>

<div class="pptx-svelte-designtab" role="group" aria-label={t('pptx.ribbon.tab.design')}>
	<div class="pptx-svelte-designtab-gallery">
		{#each THEME_SWATCHES as swatch (swatch.labelKey)}
			<button
				type="button"
				disabled={!editor.editable}
				class:pptx-svelte-designtab-active={swatch.theme?.colors?.primary === theme?.colors?.primary}
				aria-label={t(swatch.labelKey)}
				title={t(swatch.labelKey)}
				onclick={() => onsettheme(swatch.theme)}
			>
				<span
					class="pptx-svelte-designtab-swatch"
					style={`background:${swatch.theme?.colors?.primary ?? '#6b7280'}`}
				></span>
				<span>{t(swatch.labelKey)}</span>
			</button>
		{/each}
	</div>

	<button
		type="button"
		disabled={!editor.editable}
		aria-haspopup="dialog"
		aria-expanded={backgroundOpen}
		aria-label={t('pptx.ribbon.formatBackground')}
		title={t('pptx.ribbon.formatBackgroundTitle')}
		onclick={toggleBackground}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 2.5h11v11h-11z" fill="none" stroke="currentColor" stroke-width="1.2" /><path d="M2.5 10.5l3-3 2.5 2.5 3-4 2.5 3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" /></svg>
		<span>{t('pptx.ribbon.formatBackground')}</span>
	</button>

	{#if backgroundOpen}
		<div class="pptx-svelte-designtab-panel">
			<FormatBackgroundPanel {editor} open={backgroundOpen} onclose={() => (backgroundOpen = false)} />
		</div>
	{/if}
</div>

<style>
	.pptx-svelte-designtab {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 4px;
	}

	.pptx-svelte-designtab-gallery {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.pptx-svelte-designtab > .pptx-svelte-designtab-gallery > button,
	.pptx-svelte-designtab > button {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 28px;
		padding: 0 8px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 12px;
	}

	.pptx-svelte-designtab button:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-designtab button:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-designtab-active {
		outline: 2px solid var(--pptx-primary, #6366f1);
		outline-offset: -2px;
	}

	.pptx-svelte-designtab-swatch {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 1px solid var(--pptx-border, #33334d);
	}

	.pptx-svelte-designtab svg {
		width: 15px;
		height: 15px;
	}

	.pptx-svelte-designtab-panel {
		flex-basis: 100%;
	}
</style>
