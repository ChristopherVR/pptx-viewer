<script lang="ts">
	/** Phone toolbar matching React's compact top-row action placement. */
	import { useTranslator } from '../../i18n/context';

	const {
		editable,
		canUndo,
		canRedo,
		onmenu,
		onundo,
		onredo,
		onsave,
		onpresent,
		onshare,
	}: {
		editable: boolean;
		canUndo: boolean;
		canRedo: boolean;
		onmenu: () => void;
		onundo: () => void;
		onredo: () => void;
		onsave: () => void;
		onpresent: () => void;
		onshare: () => void;
	} = $props();

	const t = useTranslator();
</script>

<div class="pptx-svelte-mobile-toolbar" role="toolbar" aria-label={t('pptx.mobileToolbar.toolbar')}>
	{#if editable}
		<button type="button" aria-label={t('pptx.mobileToolbar.menu')} title={t('pptx.mobileToolbar.menu')} onclick={onmenu}>
			<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14" /></svg>
		</button>
		<button type="button" aria-label={t('pptx.toolbar.undo')} title={t('pptx.toolbar.undo')} disabled={!canUndo} onclick={onundo}>
			<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5 3 9l4 4M4 9h7a5 5 0 0 1 5 5" /></svg>
		</button>
		<button type="button" aria-label={t('pptx.toolbar.redo')} title={t('pptx.toolbar.redo')} disabled={!canRedo} onclick={onredo}>
			<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m13 5 4 4-4 4M16 9H9a5 5 0 0 0-5 5" /></svg>
		</button>
	{/if}
	<span class="pptx-svelte-mobile-toolbar-spacer"></span>
	<button type="button" aria-label={t('pptx.toolbar.save')} title={t('pptx.toolbar.save')} onclick={onsave}>
		<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v9M6.5 9.5 10 13l3.5-3.5M4 16h12" /></svg>
	</button>
	<button type="button" class="pptx-svelte-mobile-present" aria-label={t('pptx.toolbar.present')} title={t('pptx.toolbar.present')} onclick={onpresent}>
		<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4h12v9H4zM7 17l3-4 3 4" /></svg>
	</button>
	{#if editable}
		<button type="button" class="pptx-svelte-mobile-share" aria-label={t('pptx.toolbar.share')} title={t('pptx.toolbar.share')} onclick={onshare}>
			<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="5" cy="10" r="2" /><circle cx="15" cy="5" r="2" /><circle cx="15" cy="15" r="2" /><path d="m7 9 6-3M7 11l6 3" /></svg>
		</button>
	{/if}
</div>

<style>
	.pptx-svelte-mobile-toolbar { display: none; }
	@media (max-width: 767px), (max-width: 1023px) and (max-height: 520px) {
		.pptx-svelte-mobile-toolbar { position: relative; z-index: 20; display: flex; align-items: center; gap: 4px; min-height: 52px; padding: max(env(safe-area-inset-top), 0px) 8px 4px; border-bottom: 1px solid var(--pptx-border, #33334d); background: color-mix(in srgb, var(--pptx-card, #1e1e2e) 78%, transparent); color: var(--pptx-card-foreground, #e2e8f0); flex: none; }
		.pptx-svelte-mobile-toolbar button { display: inline-flex; align-items: center; justify-content: center; min-width: 44px; min-height: 44px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: inherit; cursor: pointer; }
		.pptx-svelte-mobile-toolbar button:hover:not(:disabled), .pptx-svelte-mobile-toolbar button:focus-visible { background: var(--pptx-accent, #33334d); outline: none; }
		.pptx-svelte-mobile-toolbar button:active { transform: scale(.95); }
		.pptx-svelte-mobile-toolbar button:disabled { opacity: .4; cursor: default; }
		.pptx-svelte-mobile-toolbar svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.55; stroke-linecap: round; stroke-linejoin: round; }
		.pptx-svelte-mobile-toolbar-spacer { flex: 1; }
		.pptx-svelte-mobile-present { color: var(--pptx-primary, #818cf8) !important; }
		.pptx-svelte-mobile-share { padding: 0 12px !important; background: var(--pptx-primary, #6366f1) !important; color: #fff !important; }
	}
</style>
