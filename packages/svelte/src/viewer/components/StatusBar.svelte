<script lang="ts">
	/**
	 * Desktop status bar, docked beneath the slide/notes area. This is kept
	 * deliberately independent from the top toolbar so read-only viewers retain
	 * PowerPoint's navigation and zoom chrome.
	 */
	import { useTranslator } from '../../i18n/context';
	import type { AutosaveStatus } from '../state/autosave.svelte';

	const {
		current,
		total,
		zoomPercent,
		isDirty,
		autosaveStatus,
		showNotes = false,
		notesExpanded = false,
		isFullscreen = false,
		onzoomin,
		onzoomout,
		onzoomfit,
		onfullscreen,
		onnotestoggle,
	}: {
		current: number;
		total: number;
		zoomPercent: number;
		isDirty: boolean;
		autosaveStatus?: AutosaveStatus;
		showNotes?: boolean;
		notesExpanded?: boolean;
		isFullscreen?: boolean;
		onzoomin: () => void;
		onzoomout: () => void;
		onzoomfit: () => void;
		onfullscreen: () => void;
		onnotestoggle?: () => void;
	} = $props();

	const t = useTranslator();
	const saveKey = $derived.by(() => {
		if (autosaveStatus === 'saving') {
			return 'pptx.autosave.saving';
		}
		if (autosaveStatus === 'error') {
			return 'pptx.autosave.saveFailed';
		}
		return isDirty ? 'pptx.statusBar.unsavedChanges' : 'pptx.statusBar.allSaved';
	});
</script>

<div class="pptx-svelte-statusbar" role="toolbar" aria-label={t('pptx.statusBar.slideShow')}>
	<div class="pptx-svelte-statusbar-left">
		<span aria-live="polite">{total > 0 ? t('pptx.statusBar.slideOf', { current: current + 1, total }) : t('pptx.statusBar.noSlides')}</span>
		<i></i><span class="pptx-svelte-statusbar-wide">{t('pptx.statusBar.language')}</span><i></i>
		<span class:error={autosaveStatus === 'error'} class:saving={autosaveStatus === 'saving'} class="pptx-svelte-statusbar-save" role="status">{t(saveKey)}</span>
	</div>
	<div class="pptx-svelte-statusbar-right">
		{#if showNotes}
			<button type="button" class:active={notesExpanded} aria-pressed={notesExpanded} aria-label={t('pptx.statusBar.toggleNotes')} title={t('pptx.statusBar.toggleNotes')} onclick={onnotestoggle}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 2.5h9v11h-9zM5 5.5h6M5 8h6M5 10.5h4" /></svg><span class="pptx-svelte-statusbar-wide">{t('pptx.notes.title')}</span></button>
			<i></i>
		{/if}
		<button type="button" class="active" aria-label={t('pptx.statusBar.normalView')} title={t('pptx.statusBar.normalView')}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 3.5h11v8h-11zM6 12.5h4" /></svg></button>
		<button type="button" class:active={isFullscreen} aria-pressed={isFullscreen} aria-label={t('pptx.statusBar.slideShow')} title={t('pptx.statusBar.slideShow')} onclick={onfullscreen}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6v-3.5h3.5M13.5 6v-3.5h-3.5M2.5 10v3.5h3.5M13.5 10v3.5h-3.5" /></svg></button>
		<i></i>
		<button type="button" aria-label={t('pptx.statusBar.zoomOut')} title={t('pptx.statusBar.zoomOut')} onclick={onzoomout}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8h9" /></svg></button>
		<button type="button" class="pptx-svelte-statusbar-zoom" aria-label={t('pptx.statusBar.zoomToFit')} title={t('pptx.statusBar.zoomToFit')} onclick={onzoomfit}>{zoomPercent}%</button>
		<button type="button" aria-label={t('pptx.statusBar.zoomIn')} title={t('pptx.statusBar.zoomIn')} onclick={onzoomin}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5v9M3.5 8h9" /></svg></button>
	</div>
</div>

<style>
	.pptx-svelte-statusbar { display:flex; align-items:center; justify-content:space-between; gap:8px; min-height:27px; padding:0 8px; border-top:1px solid var(--pptx-border,#33334d); background:color-mix(in srgb,var(--pptx-card,#1e1e2e) 76%,#000); color:var(--pptx-muted-foreground,#a5a5b5); font:10px system-ui,sans-serif; flex:none; }
	.pptx-svelte-statusbar-left,.pptx-svelte-statusbar-right { display:flex; align-items:center; gap:3px; min-width:0; }.pptx-svelte-statusbar-left > span { white-space:nowrap; }.pptx-svelte-statusbar i { width:1px; height:13px; margin:0 4px; background:var(--pptx-border,#33334d); }
	.pptx-svelte-statusbar button { display:inline-flex; align-items:center; justify-content:center; gap:4px; min-width:23px; height:22px; padding:0 4px; border:0; border-radius:3px; background:transparent; color:inherit; cursor:pointer; }.pptx-svelte-statusbar button:hover:not(:disabled) { background:var(--pptx-accent,#33334d); color:var(--pptx-card-foreground,#e2e8f0); }.pptx-svelte-statusbar button:disabled { opacity:.38; cursor:default; }.pptx-svelte-statusbar button.active { color:var(--pptx-primary,#6366f1); }.pptx-svelte-statusbar svg { width:14px; height:14px; fill:none; stroke:currentColor; stroke-width:1.45; stroke-linecap:round; stroke-linejoin:round; }.pptx-svelte-statusbar-zoom { min-width:43px !important; font-variant-numeric:tabular-nums; }.pptx-svelte-statusbar-save.error { color:#f87171; }.pptx-svelte-statusbar-save.saving { color:#facc15; }
	@media (max-width:767px), (max-width:1023px) and (max-height:520px) { .pptx-svelte-statusbar { display:none; }.pptx-svelte-statusbar-wide { display:none; } }
</style>
