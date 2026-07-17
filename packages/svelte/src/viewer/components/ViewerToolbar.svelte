<script lang="ts">
	/**
	 * ViewerToolbar: prev/next navigation with a slide counter, zoom controls,
	 * and the fullscreen/presentation toggle. All strings come from the shared
	 * i18n dictionary via the context translator; theming via `--pptx-*` vars.
	 */
	import { isActionHidden } from 'pptx-viewer-shared';
	import { useTranslator } from '../../i18n/context';
	import AutosaveIndicator from './AutosaveIndicator.svelte';
	import ExportMenu from './ExportMenu.svelte';
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
		editable = false,
		canUndo = false,
		canRedo = false,
		dirty = false,
		onundo,
		onredo,
		onsave,
		ondownload,
		autosaveStatus,
		autosaveDirty = false,
		exportUi,
		onshare,
		onbroadcast,
		collabActive = false,
		hiddenActions,
	}: ViewerToolbarProps = $props();

	const t = useTranslator();
</script>

<div class="pptx-svelte-toolbar" role="toolbar" aria-label={t('pptx.statusBar.slideShow')}>
	{#if editable}
		<div class="pptx-svelte-toolbar-group pptx-svelte-toolbar-edit">
			<button
				type="button"
				aria-label={t('pptx.toolbar.undo')}
				title={t('pptx.toolbar.undo')}
				disabled={!canUndo}
				onclick={() => onundo?.()}
			>
				<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4 3 7l3 3M3 7h6.5a3.5 3.5 0 0 1 0 7H8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
			</button>
			<button
				type="button"
				aria-label={t('pptx.toolbar.redo')}
				title={t('pptx.toolbar.redo')}
				disabled={!canRedo}
				onclick={() => onredo?.()}
			>
				<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 4l3 3-3 3M13 7H6.5a3.5 3.5 0 0 0 0 7H8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
			</button>
			<button
				type="button"
				class="pptx-svelte-toolbar-save"
				class:pptx-svelte-toolbar-dirty={dirty}
				aria-label={t('pptx.toolbar.save')}
				title={t('pptx.toolbar.save')}
				onclick={() => onsave?.()}
			>
				<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2.5h8l2 2v9h-10zM5 2.5v4h5v-4M5 13.5v-4h6v4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" /></svg>
			</button>
			<button
				type="button"
				aria-label={t('pptx.ribbon.saveAsPptx')}
				title={t('pptx.ribbon.saveAsPptx')}
				onclick={() => ondownload?.()}
			>
				<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v7m0 0 3-3m-3 3-3-3M3 12.5h10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
			</button>
			{#if autosaveStatus}
				<AutosaveIndicator status={autosaveStatus} isDirty={autosaveDirty} />
			{/if}
		</div>
	{/if}
	{#if !isActionHidden('navigation', hiddenActions)}
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
	{/if}

	<div class="pptx-svelte-toolbar-group">
		{#if !isActionHidden('zoom', hiddenActions)}
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
		{/if}
		{#if !isActionHidden('fullscreen', hiddenActions)}
			<button
				type="button"
				aria-label={t('pptx.statusBar.slideShow')}
				title={t('pptx.statusBar.slideShow')}
				aria-pressed={isFullscreen}
				onclick={onfullscreen}
			>
				<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6v-3.5h3.5M13.5 6v-3.5h-3.5M2.5 10v3.5h3.5M13.5 10v3.5h-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
			</button>
		{/if}
		{#if showNotes && !isActionHidden('notes', hiddenActions)}
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
		{#if onshare && !isActionHidden('share', hiddenActions)}
			<button
				type="button"
				class="pptx-svelte-toolbar-share"
				class:pptx-svelte-toolbar-share-active={collabActive}
				aria-label={t('pptx.toolbar.share')}
				title={t('pptx.toolbar.share')}
				aria-pressed={collabActive}
				onclick={() => onshare?.()}
			>
				<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="4" cy="8" r="1.6" fill="none" stroke="currentColor" stroke-width="1.3" /><circle cx="12" cy="3.5" r="1.6" fill="none" stroke="currentColor" stroke-width="1.3" /><circle cx="12" cy="12.5" r="1.6" fill="none" stroke="currentColor" stroke-width="1.3" /><path d="M5.4 7.2 10.6 4.3M5.4 8.8 10.6 11.7" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
			</button>
		{/if}
		{#if onbroadcast && !isActionHidden('broadcast', hiddenActions)}
			<button
				type="button"
				aria-label={t('pptx.broadcast.title')}
				title={t('pptx.broadcast.title')}
				onclick={() => onbroadcast?.()}
			>
				<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="1.4" fill="currentColor" /><path d="M5.5 5.5a3.5 3.5 0 0 0 0 5M10.5 5.5a3.5 3.5 0 0 1 0 5M3.3 3.3a6.5 6.5 0 0 0 0 9.4M12.7 3.3a6.5 6.5 0 0 1 0 9.4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
			</button>
		{/if}
		{#if exportUi && !isActionHidden('export', hiddenActions)}
			<ExportMenu {exportUi} />
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

	.pptx-svelte-toolbar-edit {
		margin-right: 4px;
		padding-right: 8px;
		border-right: 1px solid var(--pptx-border, #33334d);
	}

	.pptx-svelte-toolbar-dirty {
		color: var(--pptx-primary, #6366f1);
	}

	.pptx-svelte-toolbar-share-active {
		color: var(--pptx-primary, #6366f1);
	}
</style>
