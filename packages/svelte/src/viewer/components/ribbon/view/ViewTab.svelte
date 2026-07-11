<script lang="ts">
	/**
	 * ViewTab: the ribbon's View tab. Zoom in/out/fit, fullscreen (Slide
	 * Show), and the Notes toggle, relocated from the pre-ribbon toolbar's
	 * always-visible zoom group.
	 */
	import { useTranslator } from '../../../../i18n/context';

	const {
		zoomPercent,
		onzoomin,
		onzoomout,
		onzoomfit,
		isFullscreen,
		onfullscreen,
		showNotes = false,
		notesExpanded = false,
		onnotestoggle,
	}: {
		zoomPercent: number;
		onzoomin: () => void;
		onzoomout: () => void;
		onzoomfit: () => void;
		isFullscreen: boolean;
		onfullscreen: () => void;
		showNotes?: boolean;
		notesExpanded?: boolean;
		onnotestoggle?: () => void;
	} = $props();

	const t = useTranslator();
</script>

<div class="pptx-svelte-viewtab" role="group" aria-label={t('pptx.ribbon.tab.view')}>
	<button type="button" aria-label={t('pptx.statusBar.zoomOut')} title={t('pptx.statusBar.zoomOut')} onclick={onzoomout}>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8h9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" /></svg>
	</button>
	<button
		type="button"
		class="pptx-svelte-viewtab-zoom"
		aria-label={t('pptx.view.zoomToFit')}
		title={t('pptx.view.zoomToFitTooltip')}
		onclick={onzoomfit}
	>
		{zoomPercent}%
	</button>
	<button type="button" aria-label={t('pptx.statusBar.zoomIn')} title={t('pptx.statusBar.zoomIn')} onclick={onzoomin}>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" /></svg>
	</button>

	<span class="pptx-svelte-viewtab-sep" aria-hidden="true"></span>

	<button
		type="button"
		aria-label={t('pptx.statusBar.slideShow')}
		title={t('pptx.statusBar.slideShow')}
		aria-pressed={isFullscreen}
		onclick={onfullscreen}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6v-3.5h3.5M13.5 6v-3.5h-3.5M2.5 10v3.5h3.5M13.5 10v3.5h-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
		<span>{t('pptx.view.presentationViews')}</span>
	</button>
	{#if showNotes}
		<button
			type="button"
			class:pptx-svelte-viewtab-active={notesExpanded}
			aria-label={t('pptx.statusBar.toggleNotes')}
			title={t('pptx.statusBar.toggleNotes')}
			aria-pressed={notesExpanded}
			onclick={() => onnotestoggle?.()}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 2.5h9v11h-9zM5 5.5h6M5 8h6M5 10.5h4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
			<span>{t('pptx.notes.title')}</span>
		</button>
	{/if}
</div>

<style>
	.pptx-svelte-viewtab {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.pptx-svelte-viewtab button {
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

	.pptx-svelte-viewtab button:hover {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-viewtab svg {
		width: 15px;
		height: 15px;
	}

	.pptx-svelte-viewtab-zoom {
		min-width: 52px;
		justify-content: center;
	}

	.pptx-svelte-viewtab-active {
		color: var(--pptx-primary, #6366f1);
	}

	.pptx-svelte-viewtab-sep {
		width: 1px;
		height: 22px;
		background: var(--pptx-border, #33334d);
	}
</style>
