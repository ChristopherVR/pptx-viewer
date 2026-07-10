<script lang="ts">
	/**
	 * ViewerToolbar: prev/next navigation with a slide counter, zoom controls,
	 * and the fullscreen/presentation toggle. All strings come from the shared
	 * i18n dictionary via the context translator; theming via `--pptx-*` vars.
	 */
	import { useTranslator } from '../../i18n/context';
	import type { ViewerToolbarProps } from './props';

	const {
		current,
		total,
		zoomPercent,
		isFullscreen,
		onprev,
		onnext,
		onzoomin,
		onzoomout,
		onzoomfit,
		onfullscreen,
		showNotes = false,
		notesExpanded = false,
		onnotestoggle,
	}: ViewerToolbarProps = $props();

	const t = useTranslator();
</script>

<div class="pptx-svelte-toolbar" role="toolbar" aria-label={t('pptx.statusBar.slideShow')}>
	<div class="pptx-svelte-toolbar-group">
		<button
			type="button"
			aria-label={t('pptx.mobileBar.previousSlide')}
			title={t('pptx.mobileBar.previousSlide')}
			disabled={current <= 0}
			onclick={onprev}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 3 5.5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
		</button>
		<span class="pptx-svelte-toolbar-counter" aria-live="polite">
			{total > 0
				? t('pptx.statusBar.slideOf', { current: current + 1, total })
				: t('pptx.statusBar.noSlides')}
		</span>
		<button
			type="button"
			aria-label={t('pptx.mobileBar.nextSlide')}
			title={t('pptx.mobileBar.nextSlide')}
			disabled={current >= total - 1}
			onclick={onnext}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3 10.5 8l-5 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" /></svg>
		</button>
	</div>

	<div class="pptx-svelte-toolbar-group">
		<button
			type="button"
			aria-label={t('pptx.statusBar.zoomOut')}
			title={t('pptx.statusBar.zoomOut')}
			onclick={onzoomout}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8h9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" /></svg>
		</button>
		<button
			type="button"
			class="pptx-svelte-toolbar-zoom"
			aria-label={t('pptx.statusBar.zoomToFit')}
			title={t('pptx.statusBar.zoomToFit')}
			onclick={onzoomfit}
		>
			{zoomPercent}%
		</button>
		<button
			type="button"
			aria-label={t('pptx.statusBar.zoomIn')}
			title={t('pptx.statusBar.zoomIn')}
			onclick={onzoomin}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" /></svg>
		</button>
		<button
			type="button"
			aria-label={t('pptx.statusBar.slideShow')}
			title={t('pptx.statusBar.slideShow')}
			aria-pressed={isFullscreen}
			onclick={onfullscreen}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6v-3.5h3.5M13.5 6v-3.5h-3.5M2.5 10v3.5h3.5M13.5 10v3.5h-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
		</button>
		{#if showNotes}
			<button
				type="button"
				class="pptx-svelte-toolbar-notes"
				class:pptx-svelte-toolbar-notes-active={notesExpanded}
				aria-label={t('pptx.statusBar.toggleNotes')}
				title={t('pptx.statusBar.toggleNotes')}
				aria-pressed={notesExpanded}
				onclick={() => onnotestoggle?.()}
			>
				<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 2.5h9v11h-9zM5 5.5h6M5 8h6M5 10.5h4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
				<span class="pptx-svelte-toolbar-notes-label">{t('pptx.notes.title')}</span>
			</button>
		{/if}
	</div>
</div>

<style>
	.pptx-svelte-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 6px 10px;
		background: var(--pptx-card, #1e1e2e);
		color: var(--pptx-card-foreground, #e2e8f0);
		border-bottom: 1px solid var(--pptx-border, #33334d);
		font-family: system-ui, sans-serif;
		font-size: 13px;
		flex: none;
	}

	.pptx-svelte-toolbar-group {
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.pptx-svelte-toolbar button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 28px;
		height: 28px;
		padding: 0 6px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
	}

	.pptx-svelte-toolbar button:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-toolbar button:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.pptx-svelte-toolbar svg {
		width: 16px;
		height: 16px;
	}

	.pptx-svelte-toolbar-counter {
		min-width: 90px;
		text-align: center;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-toolbar-zoom {
		min-width: 48px;
	}

	.pptx-svelte-toolbar-notes {
		width: auto;
		gap: 4px;
		padding: 0 8px;
	}

	.pptx-svelte-toolbar-notes-active {
		color: var(--pptx-primary, #6366f1);
	}

	.pptx-svelte-toolbar-notes-label {
		font-size: 12px;
	}
</style>
