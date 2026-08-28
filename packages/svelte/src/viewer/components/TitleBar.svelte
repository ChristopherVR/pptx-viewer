<script lang="ts">
	/**
	 * Desktop PowerPoint chrome above the editing ribbon. It deliberately owns
	 * only presentation state: command dispatch and document mutation remain in
	 * the viewer host, just like the React title bar.
	 */
	import FileDown from '@lucide/svelte/icons/file-down';
	import Play from '@lucide/svelte/icons/play';
	import Plus from '@lucide/svelte/icons/plus';
	import Printer from '@lucide/svelte/icons/printer';
	import Search from '@lucide/svelte/icons/search';
	import SpellCheck from '@lucide/svelte/icons/spell-check';
	import ZoomIn from '@lucide/svelte/icons/zoom-in';
	import ZoomOut from '@lucide/svelte/icons/zoom-out';
	import {
		extraQuickAccessCommands,
		filterCommands,
		resolveTitleBarStatusKey,
		titleBarStyleAttr,
	} from 'pptx-viewer-shared';
	import type { Component } from 'svelte';

	import { useTranslator } from '../../i18n/context';
	import type { AutosaveStatus } from '../state/autosave.svelte';
	import { useViewerOptions } from '../state/viewer-options-context';

	/** Catalog icon name -> Lucide component (the same map React's title bar uses). */
	const QUICK_ACCESS_ICONS: Record<string, Component> = {
		play: Play,
		printer: Printer,
		fileDown: FileDown,
		plus: Plus,
		spellCheck: SpellCheck,
		zoomIn: ZoomIn,
		zoomOut: ZoomOut,
	};

	const {
		fileName,
		editable,
		isDirty,
		autosaveEnabled,
		autosaveStatus,
		canUndo,
		canRedo,
		findReplaceOpen,
		onautosavetoggle,
		onsave,
		onundo,
		onredo,
		onfindreplace,
		oncommand,
		onquickcommand,
	}: {
		fileName?: string;
		editable: boolean;
		isDirty: boolean;
		autosaveEnabled: boolean;
		autosaveStatus?: AutosaveStatus;
		canUndo: boolean;
		canRedo: boolean;
		findReplaceOpen: boolean;
		onautosavetoggle: () => void;
		onsave: () => void;
		onundo: () => void;
		onredo: () => void;
		onfindreplace: () => void;
		oncommand?: (command: string) => void;
		/**
		 * Run a Quick Access command that is not one of the dedicated
		 * Save/Undo/Redo buttons (`presentFromStart`, `print`, ...), by catalog id.
		 */
		onquickcommand?: (id: string) => void;
	} = $props();

	const t = useTranslator();
	/**
	 * The shared chrome measurements, as CSS custom properties. A scoped style
	 * block is compiled ahead of time and cannot read a TypeScript value, so the
	 * numbers reach the stylesheet through this inline style instead of being
	 * retyped there (which is how this bar drifted off the other four).
	 */
	const metricVars = titleBarStyleAttr();
	// The strip beyond Save/Undo/Redo comes from File > Options; hardcoding three
	// buttons is what left this binding a command short of the shared default.
	// Position `'below'` renders the same extras in `QuickAccessToolbar.svelte`
	// (directly under the ribbon) instead, so they are skipped here to avoid
	// showing every configured command twice.
	const optionsState = useViewerOptions();
	const extraQuickCommands = $derived(
		optionsState.options.quickAccess.visible && optionsState.options.quickAccess.position !== 'below'
			? extraQuickAccessCommands(optionsState.options.quickAccess.commandIds)
			: [],
	);
	const showCommandLabels = $derived(optionsState.options.quickAccess.showCommandLabels);
	let query = $state('');
	let focused = $state(false);
	const results = $derived(filterCommands(query, t));
	const statusKey = $derived(
		resolveTitleBarStatusKey({
			autosaveState: autosaveStatus ?? 'idle',
			isDirty,
			autosaveEnabled,
		}),
	);

	function choose(command: string): void {
		oncommand?.(command);
		query = '';
		focused = false;
	}

	function onSearchKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') {
			query = '';
			focused = false;
		} else if (event.key === 'Enter' && query.trim()) {
			if (results[0]) {
				choose(results[0].command);
			} else {
				onfindreplace();
			}
		}
	}
</script>

<div class="pptx-svelte-titlebar" style={metricVars} data-pptx-title-bar>
	<span class="pptx-svelte-titlebar-logo" aria-hidden="true">P</span>
	{#if editable}
		<span class="pptx-svelte-titlebar-autosave">
			<span>{t('pptx.titleBar.autoSave')}</span>
			<button type="button" role="switch" aria-checked={autosaveEnabled} aria-label={t('pptx.titleBar.toggleAutoSave')} title={t('pptx.titleBar.toggleAutoSave')} onclick={onautosavetoggle}>
				<span></span>
			</button>
			<span>{t(autosaveEnabled ? 'pptx.titleBar.autoSaveOn' : 'pptx.titleBar.autoSaveOff')}</span>
		</span>
		<span class="pptx-svelte-titlebar-separator"></span>
		<div class="pptx-svelte-titlebar-actions" role="group" aria-label={t('pptx.inspector.elementProperties')}>
			<button type="button" aria-label={t('pptx.titleBar.save')} title={t('pptx.titleBar.save')} onclick={onsave}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2.5h8l2 2v9h-10zM5 2.5v4h5v-4M5 13.5v-4h6v4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" /></svg></button>
			<button type="button" aria-label={t('pptx.toolbar.undo')} title={t('pptx.toolbar.undo')} disabled={!canUndo} onclick={onundo}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4 3 7l3 3M3 7h6.5a3.5 3.5 0 0 1 0 7H8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg></button>
			<button type="button" aria-label={t('pptx.toolbar.redo')} title={t('pptx.toolbar.redo')} disabled={!canRedo} onclick={onredo}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 4l3 3-3 3M13 7H6.5a3.5 3.5 0 0 0 0 7H8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg></button>
			<!-- Everything else File > Options > Quick Access Toolbar asks for. -->
			{#each extraQuickCommands as command (command.id)}
				{@const Icon = QUICK_ACCESS_ICONS[command.icon] ?? Play}
				<button type="button" aria-label={t(command.labelKey)} title={t(command.labelKey)} onclick={() => onquickcommand?.(command.id)}><Icon size={14} aria-hidden="true" />{#if showCommandLabels}<small>{t(command.labelKey)}</small>{/if}</button>
			{/each}
		</div>
		<span class="pptx-svelte-titlebar-separator"></span>
	{/if}
	<span class="pptx-svelte-titlebar-file"><strong>{fileName || t('pptx.titleBar.defaultFileName')}</strong>{#if editable}<span aria-hidden="true">&bull;</span><span class:error={autosaveStatus === 'error' && autosaveEnabled} class:saving={autosaveStatus === 'saving' && autosaveEnabled}>{t(statusKey)}</span>{/if}</span>
	{#if editable}<div class="pptx-svelte-titlebar-search">
		<div class:active={focused || findReplaceOpen} class="pptx-svelte-titlebar-searchbox">
			<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="3.7" fill="none" stroke="currentColor" stroke-width="1.4" /><path d="m10 10 3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg>
			<input type="text" bind:value={query} onfocus={() => (focused = true)} onblur={() => setTimeout(() => (focused = false), 120)} onkeydown={onSearchKeydown} placeholder={t('pptx.titleBar.searchPlaceholder')} aria-label={t('pptx.titleBar.search')} />
		</div>
		{#if focused && query.trim()}
			<div class="pptx-svelte-titlebar-results">
				{#if results.length}
					<span>{t('pptx.titleBar.searchCommands')}</span>
					{#each results.slice(0, 8) as entry}
						<button type="button" onmousedown={() => choose(entry.command)}>{t(entry.labelKey)}<small>{entry.category}</small></button>
					{/each}
				{:else}<span>{t('pptx.titleBar.searchNoResults')}</span>{/if}
				<button type="button" onmousedown={() => { onfindreplace(); query = ''; focused = false; }}><Search size={12} aria-hidden="true" />{t('pptx.titleBar.searchContent')} &quot;{query}&quot;</button>
			</div>
		{/if}
	</div>{/if}
</div>

<style>
	/* Every measurement below reads a --pptx-tb-* variable set from the shared
	   TITLE_BAR_METRICS; do not hardcode these numbers back in. */
	.pptx-svelte-titlebar { display:flex; align-items:center; gap:var(--pptx-tb-gap); height:var(--pptx-tb-height); padding:0 var(--pptx-tb-pad-x); border-bottom:1px solid var(--pptx-border,#33334d); background:color-mix(in srgb,var(--pptx-card,#1e1e2e) 88%,#000); color:var(--pptx-card-foreground,#e2e8f0); font:var(--pptx-tb-font-size) system-ui,sans-serif; user-select:none; }
	.pptx-svelte-titlebar-logo { display:grid; place-items:center; width:var(--pptx-tb-logo-size); height:var(--pptx-tb-logo-size); border-radius:var(--pptx-tb-logo-radius); background:var(--pptx-tb-logo-bg); color:#fff; font-weight:800; font-size:var(--pptx-tb-logo-font-size); }
	.pptx-svelte-titlebar-autosave,.pptx-svelte-titlebar-file,.pptx-svelte-titlebar-actions { display:flex; align-items:center; gap:6px; white-space:nowrap; }
	.pptx-svelte-titlebar-autosave { color:var(--pptx-muted-foreground,#a5a5b5); }
	.pptx-svelte-titlebar-autosave button { position:relative; width:var(--pptx-tb-switch-w); height:var(--pptx-tb-switch-h); border:0; border-radius:999px; background:#626270; cursor:pointer; }
	.pptx-svelte-titlebar-autosave button[aria-checked='true'] { background:var(--pptx-primary,#6366f1); }
	.pptx-svelte-titlebar-autosave button span { position:absolute; top:var(--pptx-tb-knob-off); left:var(--pptx-tb-knob-off); width:var(--pptx-tb-knob-size); height:var(--pptx-tb-knob-size); border-radius:50%; background:#fff; transition:transform .15s ease; }
	/* Travel, not the "on" offset: the knob already sits at --pptx-tb-knob-off. */
	.pptx-svelte-titlebar-autosave button[aria-checked='true'] span { transform:translateX(var(--pptx-tb-knob-travel)); }
	.pptx-svelte-titlebar-separator { width:1px; height:var(--pptx-tb-separator-h); background:var(--pptx-border,#33334d); }
	.pptx-svelte-titlebar-actions button { display:flex; align-items:center; justify-content:center; gap:4px; min-width:24px; height:24px; padding:0 4px; border:0; border-radius:3px; background:transparent; color:inherit; cursor:pointer; }
	.pptx-svelte-titlebar-actions button:hover:not(:disabled) { background:var(--pptx-accent,#33334d); }
	.pptx-svelte-titlebar-actions button:disabled { opacity:.4; cursor:default; }
	.pptx-svelte-titlebar-actions button small { font-size:10px; white-space:nowrap; }
	.pptx-svelte-titlebar-actions svg,.pptx-svelte-titlebar-searchbox svg { width:15px; height:15px; }
	.pptx-svelte-titlebar-file { min-width:0; color:var(--pptx-muted-foreground,#a5a5b5); overflow:hidden; }
	.pptx-svelte-titlebar-file strong { max-width:200px; overflow:hidden; color:inherit; font-size:var(--pptx-tb-file-size); font-weight:var(--pptx-tb-file-weight); text-overflow:ellipsis; }
	.pptx-svelte-titlebar-file .error { color:#f87171; }.pptx-svelte-titlebar-file .saving { color:#facc15; }
	.pptx-svelte-titlebar-search { position:relative; display:flex; flex:1; justify-content:center; min-width:0; }
	.pptx-svelte-titlebar-searchbox { display:flex; align-items:center; gap:7px; width:min(100%,448px); padding:4px 10px; border:1px solid var(--pptx-border,#33334d); border-radius:6px; background:var(--pptx-background,#11111b); color:var(--pptx-muted-foreground,#a5a5b5); }
	.pptx-svelte-titlebar-searchbox.active { border-color:var(--pptx-primary,#6366f1); color:var(--pptx-card-foreground,#e2e8f0); }.pptx-svelte-titlebar-searchbox input { width:100%; border:0; outline:0; background:transparent; color:inherit; font:inherit; }
	.pptx-svelte-titlebar-results { position:absolute; top:calc(100% + 4px); z-index:20; width:min(100%,448px); overflow:hidden; border:1px solid var(--pptx-border,#33334d); border-radius:7px; background:var(--pptx-card,#1e1e2e); box-shadow:0 14px 28px #0006; }.pptx-svelte-titlebar-results > span { display:block; padding:7px 10px; color:var(--pptx-muted-foreground,#a5a5b5); font-size:10px; font-weight:700; text-transform:uppercase; }.pptx-svelte-titlebar-results button { display:flex; width:100%; align-items:center; gap:8px; border:0; padding:6px 10px; background:transparent; color:inherit; text-align:left; cursor:pointer; }.pptx-svelte-titlebar-results button:hover { background:var(--pptx-accent,#33334d); }.pptx-svelte-titlebar-results small { margin-left:auto; color:var(--pptx-muted-foreground,#a5a5b5); text-transform:capitalize; }
	@media (max-width: 767px), (max-width: 1023px) and (max-height: 520px) { .pptx-svelte-titlebar { display:none; } }
</style>
